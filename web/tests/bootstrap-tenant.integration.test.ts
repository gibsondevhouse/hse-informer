import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '../src/lib/server/db';

const enabled=Boolean(process.env.TEST_DATABASE_URL);
if(enabled)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
const run=promisify(execFile);
describe.skipIf(!enabled)('operator tenant bootstrap command',()=>{
  let server:Server,base:string,directory:string;
  let failMail=false;const operations:string[]=[];
  beforeAll(async()=>{
    directory=await mkdtemp(join(tmpdir(),'hse-bootstrap-'));
    server=createServer((request,response)=>{
      operations.push(`${request.method} ${request.url}`);
      if(request.url?.endsWith('/token')){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({access_token:'test-service-token'}));}
      else if(request.method==='POST'&&request.url==='/admin/realms/operator/users'){response.writeHead(201,{location:`${base}/admin/realms/operator/users/${randomUUID()}`});response.end();}
      else if(request.url?.includes('/execute-actions-email')){response.writeHead(failMail?500:204);response.end();}
      else if(request.method==='DELETE'){response.writeHead(204);response.end();}
      else{response.writeHead(404);response.end();}
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  });
  afterAll(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(directory)await rm(directory,{recursive:true});});
  async function bootstrap(slug:string){
    const file=join(directory,`${slug}.json`);
    await writeFile(file,JSON.stringify({slug,name:'Operator Test',sites:[{code:'one',name:'Site One',stateCode:'GA',timeZone:'America/New_York'},{code:'two',name:'Site Two',stateCode:'GA',timeZone:'America/New_York'}],admin:{displayName:'First Administrator',email:'operator@example.invalid'},reason:'Approved tenant setup test'}));
    return run(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/bootstrap-tenant.ts',file],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,OIDC_ISSUER:`${base}/realms/operator`,OIDC_CLIENT_ID:'hse-test',KEYCLOAK_ADMIN_CLIENT_ID:'hse-account-admin',KEYCLOAK_ADMIN_CLIENT_SECRET:'test-only-secret',APP_ORIGIN:'http://hse.example.invalid'}});
  }
  it('creates sites, stable first-admin identity, audit and an expiring delivered invitation without manual SQL',async()=>{
    const slug=`operator-${randomUUID()}`;
    const result=JSON.parse((await bootstrap(slug)).stdout);
    expect(result.invitation).toBe('sent');expect(result.siteIds).toHaveLength(2);
    const principal=await database().query('SELECT role FROM principals WHERE tenant_id=$1 AND person_id=$2',[result.tenantId,result.adminPersonId]);
    expect(principal.rows[0].role).toBe('tenant_admin');
    const invitation=await database().query('SELECT expires_at,delivery FROM person_account_invitations WHERE tenant_id=$1',[result.tenantId]);
    expect(invitation.rows[0].delivery).toBe('email');expect(invitation.rows[0].expires_at.getTime()).toBeGreaterThan(Date.now()+29*60000);
    const audit=await database().query(`SELECT after_value FROM audit_log WHERE tenant_id=$1 AND action='tenant.bootstrapped'`,[result.tenantId]);
    expect(audit.rows[0].after_value.reason).toBe('Approved tenant setup test');
  });
  it('rolls back the tenant and removes its remote identity when the invitation cannot be delivered',async()=>{
    const slug=`operator-failed-${randomUUID()}`;failMail=true;
    await expect(bootstrap(slug)).rejects.toThrow();
    expect((await database().query('SELECT id FROM tenants WHERE slug=$1',[slug])).rows).toHaveLength(0);
    expect(operations.some(operation=>operation.startsWith('DELETE /admin/realms/operator/users/'))).toBe(true);
  });
});
