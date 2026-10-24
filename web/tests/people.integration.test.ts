import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { actorForSubject, type Actor } from '../src/lib/server/auth';
import { database } from '../src/lib/server/db';
import { activateAccount, createPerson, editPerson, importRoster, listPeople, manageAccount, personDetail } from '../src/lib/server/people';
import type { IdentityAdmin } from '../src/lib/server/keycloak';

const enabled=Boolean(process.env.TEST_DATABASE_URL);
if(enabled)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)('beta profile, account, and roster integration',()=>{
  const tenant=randomUUID(),otherTenant=randomUUID(),site=randomUUID(),otherSite=randomUUID(),principal=randomUUID();
  const actor:Actor={id:principal,tenantId:tenant,tenantName:'Profile test',tenantSynthetic:true,personId:null,displayName:'Admin',role:'tenant_admin',siteIds:[]};
  const siteAdmin:Actor={...actor,role:'site_admin',siteIds:[site]};
  const provider:IdentityAdmin={issuer:`https://identity.test/realms/${tenant}`,createAccount:vi.fn(async()=>randomUUID()),removeAccount:vi.fn(async()=>{}),configureAccount:vi.fn(async()=>{}),updateProfile:vi.fn(async()=>{}),invite:vi.fn(async()=>{}),setPassword:vi.fn(async()=>{}),logout:vi.fn(async()=>{})};
  let worker:string;
  beforeAll(async()=>{
    const db=database();
    for(const [id,name]of[[tenant,'People test'],[otherTenant,'Other tenant']])await db.query('INSERT INTO tenants (id,slug,name,synthetic) VALUES ($1,$2,$3,true)',[id,id,name]);
    for(const[id,code]of[[site,'alpha'],[otherSite,'beta']])await db.query(`INSERT INTO sites (id,tenant_id,code,name,state_code) VALUES ($1,$2,$3,$3,'GA')`,[id,tenant,code]);
    await db.query(`INSERT INTO principals (id,tenant_id,oidc_issuer,oidc_subject,role) VALUES ($1,$2,'test',$3,'tenant_admin')`,[principal,tenant,principal]);
    worker=await createPerson(actor,{displayName:'Worker One',employeeNumber:'E1',phone:'555-0100',siteIds:[site],reason:'Test profile creation'});
  });
  it('keeps profile identity stable, records changes and prevents tenant and site escape',async()=>{
    await editPerson(actor,worker,{department:'Operations',reason:'Department correction'});
    expect((await listPeople(actor)).find(p=>p.id===worker)?.department).toBe('Operations');
    await expect(editPerson({...actor,tenantId:otherTenant},worker,{displayName:'Forbidden',reason:'Cross tenant attempt'})).rejects.toMatchObject({status:404});
    const hidden=await createPerson(actor,{displayName:'Other site',employeeNumber:'E2',siteIds:[otherSite],reason:'Test other site creation'});
    expect((await listPeople(siteAdmin)).map(p=>p.id)).not.toContain(hidden);
    await expect(personDetail(siteAdmin,hidden)).rejects.toMatchObject({status:404});
    await expect(editPerson(siteAdmin,worker,{siteIds:[otherSite],reason:'Attempt site escape'})).rejects.toMatchObject({status:403});
    const audit=await database().query(`SELECT before_value,after_value FROM audit_log WHERE tenant_id=$1 AND entity_id=$2 AND action='person.updated'`,[tenant,worker]);
    expect(audit.rows[0].after_value.reason).toBe('Department correction');expect(audit.rows[0].before_value.id).toBe(worker);
  });
  it('allows a learner to edit contact and language while rejecting role/site/state changes',async()=>{
    const learner={...actor,role:'learner' as const,personId:worker,siteIds:[site]};
    await editPerson(learner,worker,{phone:'555-0101',language:'es',reason:'Update my contact details'});
    await expect(editPerson(learner,worker,{active:false,reason:'Change account state'})).rejects.toMatchObject({status:403});
    await expect(editPerson(learner,worker,{siteIds:[otherSite],reason:'Change my site'})).rejects.toMatchObject({status:403});
  });
  it('keeps a distinct technical login stable across contact edits and rejects email delivery',async()=>{
    const id=await createPerson(actor,{displayName:'Printed Identity Worker',phone:'555-0199',siteIds:[site],reason:'Create printed identity worker'});
    const before=(await listPeople(actor)).find(p=>p.id===id)!;
    expect(before.identityEmail).toBe(`${id}@${tenant}.login.invalid`);expect(before.identityEmailTechnical).toBe(true);expect(before.email).toBeNull();
    await editPerson(actor,id,{email:'contact@example.invalid',reason:'Add contact email only'});
    const after=(await listPeople(actor)).find(p=>p.id===id)!;
    expect(after.identityEmail).toBe(before.identityEmail);expect(after.email).toBe('contact@example.invalid');
    await expect(manageAccount(actor,id,{action:'invite',reason:'Attempt mail to technical account'},provider)).rejects.toMatchObject({status:400});
    await manageAccount(actor,id,{action:'printed',reason:'Issue printed identity access'},provider);
    expect(provider.createAccount).toHaveBeenCalledWith(expect.objectContaining({personId:id,email:before.identityEmail,technicalEmail:true}));
    await expect(manageAccount(actor,id,{action:'reset',reason:'Attempt email password reset'},provider)).rejects.toMatchObject({status:400});
  });
  it('creates a hashed activation code, enables sign-in only after redemption, and preserves records on deactivation',async()=>{
    const result=await manageAccount(actor,worker,{action:'printed',reason:'Provide worker sign-in'},provider);
    expect(result.activationCode).toHaveLength(32);
    const account=await database().query('SELECT oidc_subject FROM principals WHERE tenant_id=$1 AND person_id=$2',[tenant,worker]);
    expect(await actorForSubject(provider.issuer,account.rows[0].oidc_subject)).toBeNull();
    const invitation=await database().query('SELECT activation_code_sha256 FROM person_account_invitations WHERE tenant_id=$1 AND principal_id=$2',[tenant,result.principalId]);
    expect(invitation.rows[0].activation_code_sha256).toMatch(/^[a-f0-9]{64}$/);expect(invitation.rows[0].activation_code_sha256).not.toBe(result.activationCode);
    await activateAccount({code:result.activationCode,password:'Chosen password 123!'},provider);
    expect(provider.setPassword).toHaveBeenCalledWith(account.rows[0].oidc_subject,'Chosen password 123!');
    expect((await actorForSubject(provider.issuer,account.rows[0].oidc_subject))?.personId).toBe(worker);
    await expect(activateAccount({code:result.activationCode,password:'Another password 123!'},provider)).rejects.toMatchObject({status:400});
    await editPerson(actor,worker,{active:false,reason:'Worker has left the pilot'},provider);
    expect(provider.configureAccount).toHaveBeenCalledWith(account.rows[0].oidc_subject,false,'learner');expect(provider.logout).toHaveBeenCalled();
    expect(await actorForSubject(provider.issuer,account.rows[0].oidc_subject)).toBeNull();
    expect((await listPeople(actor,true)).find(p=>p.id===worker)?.active).toBe(false);
    const audit=await database().query('SELECT after_value::text AS value FROM audit_log WHERE tenant_id=$1 AND entity_id=$2',[tenant,worker]);
    expect(audit.rows.some(row=>row.value.includes(result.activationCode!)||row.value.includes('Chosen password 123!'))).toBe(false);
  });
  it('expires printed invitations without changing existing records',async()=>{
    const id=await createPerson(actor,{displayName:'Expiry Worker',siteIds:[site],reason:'Invitation expiry test'});
    const printed=await manageAccount(actor,id,{action:'printed',reason:'Issue one-time sign-in'},provider);
    const account=await database().query('SELECT id,oidc_subject FROM principals WHERE tenant_id=$1 AND person_id=$2',[tenant,id]);
    await database().query(`UPDATE person_account_invitations SET expires_at=now()-interval '1 minute' WHERE tenant_id=$1 AND principal_id=$2`,[tenant,account.rows[0].id]);
    expect(await actorForSubject(provider.issuer,account.rows[0].oidc_subject)).toBeNull();
    await expect(activateAccount({code:printed.activationCode,password:'Expired code password 123!'},provider)).rejects.toMatchObject({status:400});
    expect((await listPeople(actor)).some(p=>p.id===id)).toBe(true);
  });
  it('revokes an existing accepted account for printed reset, rejects an expired replacement code and allows only one concurrent redemption',async()=>{
    const id=await createPerson(actor,{displayName:'Reset Worker',siteIds:[site],reason:'Printed reset expiry test'});
    const first=await manageAccount(actor,id,{action:'printed',reason:'First account activation'},provider);
    await activateAccount({code:first.activationCode,password:'Initial password 123!'},provider);
    const reset=await manageAccount(actor,id,{action:'printed',reason:'Reset existing account by code'},provider);
    const account=await database().query('SELECT oidc_subject,active FROM principals WHERE tenant_id=$1 AND person_id=$2',[tenant,id]);
    expect(account.rows[0].active).toBe(false);expect(await actorForSubject(provider.issuer,account.rows[0].oidc_subject)).toBeNull();
    await database().query(`UPDATE person_account_invitations SET expires_at=now()-interval '1 second' WHERE tenant_id=$1 AND principal_id=$2`,[tenant,reset.principalId]);
    await expect(activateAccount({code:reset.activationCode,password:'Late reset password 123!'},provider)).rejects.toMatchObject({status:400});
    const renewed=await manageAccount(actor,id,{action:'printed',reason:'Reissue expired activation code'},provider);
    const results=await Promise.allSettled([activateAccount({code:renewed.activationCode,password:'Concurrent password 123!'},provider),activateAccount({code:renewed.activationCode,password:'Other concurrent password 123!'},provider)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
  });
  it('leaves a code usable and the account locked when the identity provider rejects activation',async()=>{
    const id=await createPerson(actor,{displayName:'Retry Worker',siteIds:[site],reason:'Activation failure retry test'});
    const result=await manageAccount(actor,id,{action:'printed',reason:'Issue activation before provider error'},provider);
    vi.mocked(provider.setPassword).mockRejectedValueOnce(new Error('Provider unavailable'));
    await expect(activateAccount({code:result.activationCode,password:'Retry password 123!'},provider)).rejects.toThrow('Provider unavailable');
    expect((await listPeople(actor)).find(p=>p.id===id)?.accountAccessLocked).toBe(true);
    await expect(activateAccount({code:result.activationCode,password:'Retry password 123!'},provider)).resolves.toEqual({activated:true});
  });
  it('prevents a deactivated profile from redeeming an otherwise valid code',async()=>{
    const id=await createPerson(actor,{displayName:'Inactive Code Worker',siteIds:[site],reason:'Inactive activation boundary test'});
    const result=await manageAccount(actor,id,{action:'printed',reason:'Issue code before deactivation'},provider);
    await editPerson(actor,id,{active:false,reason:'Worker is no longer participating'},provider);
    await expect(activateAccount({code:result.activationCode,password:'Inactive worker password 123!'},provider)).rejects.toMatchObject({status:400});
  });
  it('audits tenant-admin role/site grants and rejects site-admin privilege escalation',async()=>{
    const id=await createPerson(actor,{displayName:'Grant Worker',siteIds:[site],reason:'Account grant boundary test'});
    await manageAccount(actor,id,{action:'printed',reason:'Create learner account'},provider);
    await expect(manageAccount(siteAdmin,id,{action:'grants',role:'tenant_admin',reason:'Attempt privilege escalation'},provider)).rejects.toMatchObject({status:403});
    await expect(manageAccount({...actor,tenantId:otherTenant},id,{action:'grants',role:'site_admin',siteIds:[site],reason:'Attempt cross tenant grant'},provider)).rejects.toMatchObject({status:404});
    await expect(manageAccount(actor,id,{action:'grants',role:'site_admin',siteIds:[randomUUID()],reason:'Attempt unknown site grant'},provider)).rejects.toMatchObject({status:404});
    await manageAccount(actor,id,{action:'grants',role:'site_admin',siteIds:[site],reason:'Approved site administrator'},provider);
    const grants=await database().query(`SELECT before_value,after_value FROM audit_log WHERE tenant_id=$1 AND entity_id=$2 AND action='person.account.grants'`,[tenant,id]);
    expect(grants.rows[0].before_value.role).toBe('learner');expect(grants.rows[0].after_value.value.role).toBe('site_admin');expect(grants.rows[0].after_value.value.siteIds).toEqual([site]);
    expect(grants.rows[0].after_value.reason).toBe('Approved site administrator');
  });
  it('refuses to remove the last active tenant administrator',async()=>{
    const tenantId=randomUUID(),personId=randomUUID(),principalId=randomUUID();
    await database().query('INSERT INTO tenants (id,slug,name,synthetic) VALUES ($1,$2,$2,true)',[tenantId,`last-admin-${tenantId}`]);
    await database().query(`INSERT INTO people (id,tenant_id,display_name,person_type,synthetic) VALUES ($1,$2,'Last Admin','employee',true)`,[personId,tenantId]);
    await database().query(`INSERT INTO principals (id,tenant_id,person_id,oidc_issuer,oidc_subject,role) VALUES ($1,$2,$3,$4,$5,'tenant_admin')`,[principalId,tenantId,personId,provider.issuer,randomUUID()]);
    const lastAdmin={...actor,id:principalId,tenantId,personId};
    await expect(manageAccount(lastAdmin,personId,{action:'grants',role:'learner',reason:'Attempt last administrator removal'},provider)).rejects.toMatchObject({status:409});
  });
  it('dry runs 50 rows without writing, imports once, detects unchanged rows and flags a site change',async()=>{
    const makeCsv=(changed=false)=>'employeeNumber,displayName,email,phone,siteCode,department,jobTitle,language,contractor\n'+Array.from({length:50},(_,i)=>`B${i},Beta Worker ${i},,555-${String(i).padStart(4,'0')},${changed&&i===0?'beta':'alpha'},Operations,Operator,en,false`).join('\n');
    const csv=makeCsv();const preview=await importRoster(actor,{csv,dryRun:true});expect(preview.counts.new).toBe(50);
    expect((await listPeople(actor)).filter(p=>p.employeeNumber?.startsWith('B'))).toHaveLength(0);
    await importRoster(actor,{csv,dryRun:false,previewHash:preview.previewHash,reason:'Approved 50-worker pilot roster'});
    expect((await importRoster(actor,{csv,dryRun:true})).counts.unchanged).toBe(50);
    const changedCsv=makeCsv(true),changed=await importRoster(actor,{csv:changedCsv,dryRun:true});expect(changed.counts.changed).toBe(1);
    await importRoster(actor,{csv:changedCsv,dryRun:false,previewHash:changed.previewHash,reason:'Worker transferred to second site'});
    const changes=await database().query(`SELECT after_value FROM person_context_changes c JOIN people p ON p.tenant_id=c.tenant_id AND p.id=c.person_id WHERE c.tenant_id=$1 AND p.employee_number='B0'`,[tenant]);
    expect(changes.rows[0].after_value.siteIds).toEqual([otherSite]);
    await expect(importRoster(actor,{csv,dryRun:false,previewHash:preview.previewHash})).rejects.toMatchObject({status:409});
  });
  it('rejects duplicate/malformed/out-of-scope roster rows and never deactivates missing people',async()=>{
    const csv='employeeNumber,displayName,siteCode\nB0,Duplicate,beta\nB0,Duplicate again,beta\nBAD,Bad site,foreign';
    const result=await importRoster(siteAdmin,{csv,dryRun:true});expect(result.counts.rejected).toBe(3);
    await expect(importRoster(siteAdmin,{csv,dryRun:false,previewHash:result.previewHash})).rejects.toMatchObject({status:400});
    expect((await listPeople(actor)).filter(p=>p.employeeNumber?.startsWith('B'))).toHaveLength(50);
  });
});
