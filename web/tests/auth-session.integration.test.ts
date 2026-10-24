import {randomUUID} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {decodeJwt,exportJWK,generateKeyPair,SignJWT} from 'jose';
import type {Cookies} from '@sveltejs/kit';
import {actorForSubject,actorFromRequest,finishLogin,revokePrincipalSessions,type Actor} from '../src/lib/server/auth';
import {database} from '../src/lib/server/db';
import {activateAccount,createPerson,editPerson,manageAccount} from '../src/lib/server/people';
import type {IdentityAdmin} from '../src/lib/server/keycloak';

const enabled=Boolean(process.env.TEST_DATABASE_URL);
if(enabled)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)('persistent HSE session and identity token revocation',()=>{
  const tenantId=randomUUID(),principalId=randomUUID(),siteId=randomUUID(),subject=randomUUID();
  const sessionSecret='session-revocation-test-key-at-least-32-characters';
  let server:Server,issuer:string,personId:string,userPrincipalId:string,keys:Awaited<ReturnType<typeof generateKeyPair>>;
  const admin:Actor={id:principalId,tenantId,tenantName:'Session revocation',tenantSynthetic:true,personId:null,displayName:'Admin',role:'tenant_admin',siteIds:[]};
  let identity:IdentityAdmin;
  let callbackToken='';
  const cookies=(value:string)=>({get:(name:string)=>name==='hse_session'?value:undefined})as Cookies;
  async function cookie(version?:number){return new SignJWT({sub:subject,oidcIssuer:issuer,tenantId,principalId:userPrincipalId,mfa:true,...(version===undefined?{}:{sessionVersion:version})})
    .setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(sessionSecret));}
  async function currentCookie(){return cookie((await actorForSubject(issuer,subject))!.sessionVersion);}
  beforeAll(async()=>{
    keys=await generateKeyPair('RS256',{extractable:true});const jwk=await exportJWK(keys.publicKey);jwk.kid='revocation-test';jwk.alg='RS256';jwk.use='sig';
    server=createServer((request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(request.url?.endsWith('/token')?{id_token:callbackToken}:request.url?.endsWith('/certs')?{keys:[jwk]}:{issuer,authorization_endpoint:`${issuer}/authorize`,token_endpoint:`${issuer}/token`,jwks_uri:`${issuer}/certs`}));});
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));issuer=`http://127.0.0.1:${(server.address()as{port:number}).port}/realms/revocation`;
    vi.stubEnv('DEV_AUTH','');vi.stubEnv('OIDC_ISSUER',issuer);vi.stubEnv('OIDC_CLIENT_ID','hse-test');vi.stubEnv('OIDC_CLIENT_SECRET','not-a-real-secret');vi.stubEnv('APP_ORIGIN','http://hse.example.invalid');vi.stubEnv('SESSION_SECRET',sessionSecret);
    identity={issuer,createAccount:vi.fn(async()=>subject),removeAccount:vi.fn(async()=>{}),configureAccount:vi.fn(async()=>{}),updateProfile:vi.fn(async()=>{}),invite:vi.fn(async()=>{}),setPassword:vi.fn(async()=>{}),logout:vi.fn(async()=>{})};
    await database().query('INSERT INTO tenants (id,slug,name,synthetic)VALUES($1,$2,$2,true)',[tenantId,`session-${tenantId}`]);
    await database().query(`INSERT INTO sites(id,tenant_id,code,name,state_code)VALUES($1,$2,'one','Site One','GA')`,[siteId,tenantId]);
    await database().query(`INSERT INTO principals(id,tenant_id,oidc_issuer,oidc_subject,role)VALUES($1,$2,$3,$4,'tenant_admin')`,[principalId,tenantId,issuer,randomUUID()]);
    personId=await createPerson(admin,{displayName:'Session Worker',email:'session@example.invalid',siteIds:[siteId],reason:'Session revocation fixture'});
    const result=await manageAccount(admin,personId,{action:'printed',reason:'Initial account activation'},identity);userPrincipalId=result.principalId;
    await activateAccount({code:result.activationCode,password:'Initial password 123!'},identity);
  });
  afterAll(async()=>{vi.unstubAllEnvs();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));});
  it('rejects legacy cookies missing the persisted session version',async()=>{
    expect(await actorFromRequest(cookies(await cookie()))).toBeNull();
    expect((await actorFromRequest(cookies(await currentCookie())))?.personId).toBe(personId);
  });
  it('never revives a signed pre-reset cookie after printed activation',async()=>{
    const previous=await currentCookie();
    const reset=await manageAccount(admin,personId,{action:'printed',reason:'Reset worker sign-in'},identity);
    expect(await actorFromRequest(cookies(previous))).toBeNull();
    await activateAccount({code:reset.activationCode,password:'Replacement password 123!'},identity);
    expect(await actorFromRequest(cookies(previous))).toBeNull();
    expect((await actorFromRequest(cookies(await currentCookie())))?.personId).toBe(personId);
  });
  it('keeps pre-deactivation cookies invalid after reactivation',async()=>{
    const previous=await currentCookie();
    await editPerson(admin,personId,{active:false,reason:'Temporarily suspend worker'},identity);
    await editPerson(admin,personId,{active:true,reason:'Worker returns to pilot'},identity);
    expect(await actorFromRequest(cookies(previous))).toBeNull();expect(await actorFromRequest(cookies(await currentCookie()))).not.toBeNull();
  });
  it('revokes cookies on site grant changes, role changes, email reset and logout',async()=>{
    for(const action of['site','role','reset','logout']){
      const previous=await currentCookie(),before=(await actorForSubject(issuer,subject))!.sessionVersion!;
      if(action==='site')await manageAccount(admin,personId,{action:'grants',role:'learner',siteIds:[siteId],reason:'Change site grants'},identity);
      else if(action==='role')await manageAccount(admin,personId,{action:'grants',role:'auditor',reason:'Grant audit access'},identity);
      else if(action==='reset')await manageAccount(admin,personId,{action:'reset',reason:'Send password reset'},identity);
      else await revokePrincipalSessions((await actorForSubject(issuer,subject))!);
      expect((await actorForSubject(issuer,subject))!.sessionVersion).toBe(before+1);
      expect(await actorFromRequest(cookies(previous))).toBeNull();expect(await actorFromRequest(cookies(await currentCookie()))).not.toBeNull();
    }
  });
  it('rejects a validly signed bearer token minted before revocation even after the principal is active again',async()=>{
    const before=(await actorForSubject(issuer,subject))!;
    const oldIssuedAt=Math.floor(Date.parse(before.authValidAfter!)/1000)-1;
    const bearer=(issuedAt:number)=>new SignJWT({sub:subject,amr:['pwd','otp']}).setProtectedHeader({alg:'RS256',kid:'revocation-test'}).setIssuer(issuer).setAudience('hse-test').setIssuedAt(issuedAt).setExpirationTime('1h').sign(keys.privateKey);
    const old=await bearer(oldIssuedAt);await revokePrincipalSessions(before);
    expect(await actorFromRequest(cookies(''),old)).toBeNull();
    const freshIssuedAt=Math.floor(Date.parse((await actorForSubject(issuer,subject))!.authValidAfter!)/1000)+1;
    expect((await actorFromRequest(cookies(''),await bearer(freshIssuedAt)))?.personId).toBe(personId);
  });
  it('rejects pre-revocation ID tokens and binds newly signed cookies to the current database version',async()=>{
    const actor=(await actorForSubject(issuer,subject))!,nonce=randomUUID(),state=randomUUID();
    const token=(issuedAt:number)=>new SignJWT({sub:subject,nonce,amr:['pwd','otp']}).setProtectedHeader({alg:'RS256',kid:'revocation-test'}).setIssuer(issuer).setAudience('hse-test').setIssuedAt(issuedAt).setExpirationTime('1h').sign(keys.privateKey);
    async function jar(){
      const values=new Map<string,string>();values.set('hse_oidc_flow',await new SignJWT({state,nonce,verifier:'fixture-pkce-verifier',returnTo:'/learn'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(sessionSecret)));
      return {values,cookies:{get:(name:string)=>values.get(name),set:(name:string,value:string)=>values.set(name,value),delete:(name:string)=>values.delete(name)}as unknown as Cookies};
    }
    callbackToken=await token(Math.floor(Date.parse(actor.authValidAfter!)/1000)-1);const old=await jar();
    await expect(finishLogin(old.cookies,'fixture-code',state)).rejects.toMatchObject({status:401});expect(old.values.has('hse_session')).toBe(false);
    callbackToken=await token(Math.floor(Date.parse(actor.authValidAfter!)/1000)+1);const fresh=await jar();
    await expect(finishLogin(fresh.cookies,'fixture-code',state)).resolves.toBe('/learn');
    expect(decodeJwt(fresh.values.get('hse_session')!).sessionVersion).toBe(actor.sessionVersion);
    expect((await actorFromRequest(fresh.cookies))?.personId).toBe(personId);
  });
});
