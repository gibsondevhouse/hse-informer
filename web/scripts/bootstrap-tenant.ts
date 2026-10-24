import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, transaction } from '../src/lib/server/db';
import { keycloakAdmin } from '../src/lib/server/keycloak';

const inputSchema=z.strictObject({
  slug:z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),name:z.string().trim().min(1).max(200),
  sites:z.array(z.strictObject({code:z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    name:z.string().trim().min(1).max(200),stateCode:z.string().regex(/^[A-Z]{2}$/),
    timeZone:z.string().refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Invalid IANA time zone')})).min(1).max(100),
  admin:z.strictObject({displayName:z.string().trim().min(1).max(200),email:z.email(),employeeNumber:z.string().trim().min(1).max(100).optional()}),
  reason:z.string().trim().min(5).max(500)
}).refine(value=>new Set(value.sites.map(s=>s.code)).size===value.sites.length,'Duplicate site codes');

const inputFile=process.argv[2];
if(!inputFile)throw new Error('Usage: npm run tenant:bootstrap -- /absolute/path/tenant.json');
const input=inputSchema.parse(JSON.parse(await readFile(inputFile,'utf8')));
const identity=keycloakAdmin();
let createdSubject:string|undefined;
try {
  const result=await transaction(async client=>{
    const tenantId=randomUUID(),personId=randomUUID(),principalId=randomUUID();
    await client.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$3)',[tenantId,input.slug,input.name]);
    const siteIds:string[]=[];
    for(const site of input.sites){const id=randomUUID();siteIds.push(id);await client.query(`INSERT INTO sites
      (id,tenant_id,code,name,state_code,time_zone) VALUES ($1,$2,$3,$4,$5,$6)`,[id,tenantId,site.code,site.name,site.stateCode,site.timeZone]);}
    await client.query(`INSERT INTO people (id,tenant_id,display_name,email,employee_number,person_type)
      VALUES ($1,$2,$3,$4,$5,'employee')`,[personId,tenantId,input.admin.displayName,input.admin.email,input.admin.employeeNumber??null]);
    for(const siteId of siteIds)await client.query('INSERT INTO person_site_memberships (tenant_id,person_id,site_id) VALUES ($1,$2,$3)',[tenantId,personId,siteId]);
    createdSubject=await identity.createAccount({tenantId,personId,displayName:input.admin.displayName,email:input.admin.email,role:'tenant_admin'});
    await client.query(`INSERT INTO principals (id,tenant_id,person_id,oidc_issuer,oidc_subject,role)
      VALUES ($1,$2,$3,$4,$5,'tenant_admin')`,[principalId,tenantId,personId,identity.issuer,createdSubject]);
    for(const siteId of siteIds)await client.query('INSERT INTO principal_site_access (tenant_id,principal_id,site_id) VALUES ($1,$2,$3)',[tenantId,principalId,siteId]);
    await identity.invite(createdSubject,1800);
    await client.query(`INSERT INTO person_account_invitations (tenant_id,principal_id,expires_at,delivery)
      VALUES ($1,$2,now()+interval '30 minutes','email')`,[tenantId,principalId]);
    await client.query(`INSERT INTO audit_log (tenant_id,actor_principal_id,action,entity_type,entity_id,after_value)
      VALUES ($1,$2,'tenant.bootstrapped','tenant',$1,$3::jsonb)`,[tenantId,principalId,JSON.stringify({slug:input.slug,siteIds,adminPersonId:personId,reason:input.reason,source:'operator command'})]);
    return {tenantId,siteIds,adminPersonId:personId,invitation:'sent',expiresInMinutes:30};
  });
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}catch(cause){
  if(createdSubject){try{await identity.removeAccount(createdSubject);}catch{process.stderr.write('Identity cleanup failed; inspect the identity provider account before retrying.\n');}}
  throw cause;
}finally{await database().end();}
