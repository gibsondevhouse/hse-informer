import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '../src/lib/server/db';
import { runJobs } from '../src/lib/server/jobs';
import { activateAccount, editPerson, manageAccount } from '../src/lib/server/people';
import type { IdentityAdmin } from '../src/lib/server/keycloak';
import type { Actor } from '../src/lib/server/auth';
const mock = vi.hoisted(() => ({ link: vi.fn(), provision: vi.fn(), enrol: vi.fn(), cohort: vi.fn(), find: vi.fn(), enrolled: vi.fn(), suspend: vi.fn() }));
const instanceId = '28e2f274-f82d-4f84-a9be-a14095fa784b';
vi.mock('../src/lib/server/moodle', () => ({
  moodleConnection: () => ({ instanceId: '28e2f274-f82d-4f84-a9be-a14095fa784b', authMethod: 'oauth2', oauthIssuerId: 3, oauthBridgeToken: 'synthetic-bridge', learnerRoleId: 5 }),
  linkMoodleUser: mock.link, provisionMoodleUser: mock.provision, enrollUser: mock.enrol,
  addUserToCohort: mock.cohort, findMoodleUserByHseId: mock.find,
  isUserEnrolled: mock.enrolled, readCompletion: vi.fn(), suspendMoodleUser: mock.suspend, suppressMoodleEmail: vi.fn()
}));
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)('OAuth enrollment identity boundary', () => {
  const id = { tenant: randomUUID(), other: randomUUID(), site: randomUUID(), person: randomUUID(),
    requirement: randomUUID(), version: randomUUID(), course: randomUUID(), assignment: randomUUID(), job: randomUUID(), admin: randomUUID() };
  const issuer = 'https://identity.example.test/realms/hse';
  const actor: Actor = {id:id.admin,tenantId:id.tenant,tenantName:'OAuth test',tenantSynthetic:false,personId:null,displayName:'Synthetic admin',role:'tenant_admin',siteIds:[]};
  const provider: IdentityAdmin = {issuer,createAccount:vi.fn(),removeAccount:vi.fn(),configureAccount:vi.fn(),updateProfile:vi.fn(),invite:vi.fn(),setPassword:vi.fn(),logout:vi.fn()};
  beforeAll(async () => {
    vi.stubEnv('OIDC_ISSUER', issuer); mock.find.mockResolvedValue(17); mock.link.mockResolvedValue(undefined);
    const db = database();
    await db.query(`INSERT INTO tenants(id,slug,name,synthetic) VALUES($1::uuid,$1::text,'OAuth test',false),($2::uuid,$2::text,'Other tenant',false)`, [id.tenant,id.other]);
    await db.query(`INSERT INTO sites(id,tenant_id,code,name,state_code) VALUES($1,$2,'test','OAuth site','GA')`, [id.site,id.tenant]);
    await db.query(`INSERT INTO people(id,tenant_id,display_name,person_type,synthetic,email) VALUES($1,$2,'OAuth worker','employee',false,'worker@example.test')`, [id.person,id.tenant]);
    await db.query(`INSERT INTO principals(id,tenant_id,oidc_issuer,oidc_subject,role) VALUES($1::uuid,$2,$3,$1::text,'tenant_admin')`, [id.admin,id.tenant,issuer]);
    await db.query(`INSERT INTO requirements(id,tenant_id,code,title) VALUES($1,$2,'test','OAuth course')`, [id.requirement,id.tenant]);
    await db.query(`INSERT INTO requirement_versions(id,tenant_id,requirement_id,version,legal_status,authority,audience,site_overlay_requirement,content_digest,authorization_prerequisites,review_status,reviewed_by,reviewed_at)
      VALUES($1,$2,$3,'test','general_awareness','Synthetic','Synthetic','None',repeat('a',64),'["knowledge"]','approved','Synthetic',now())`, [id.version,id.tenant,id.requirement]);
    await db.query(`INSERT INTO course_versions(id,tenant_id,requirement_version_id,deephow_content_id,deephow_version,package_sha256,export_format,moodle_course_id,review_status,reviewed_by,reviewed_at)
      VALUES($1,$2,$3,'synthetic','test',repeat('b',64),'scorm_1_2',42,'approved','Synthetic',now())`, [id.course,id.tenant,id.version]);
    await db.query(`INSERT INTO assignments(id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,course_version_id,reason,trigger_kind,due_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'OAuth test','manual',now()+interval '1 day')`, [id.assignment,id.tenant,id.person,id.site,id.requirement,id.version,id.course]);
    await db.query(`INSERT INTO site_moodle_cohorts(tenant_id,site_id,moodle_cohort_id,instance_key) VALUES($1,$2,3,$3)`, [id.tenant,id.site,instanceId]);
    await db.query(`INSERT INTO integration_outbox(id,tenant_id,kind,aggregate_id) VALUES($1,$2,'moodle_enrol',$3)`, [id.job,id.tenant,id.assignment]);
  });
  afterAll(() => vi.unstubAllEnvs());
  async function retry() { await database().query(`UPDATE integration_outbox SET state='pending',next_attempt_at=now() WHERE id=$1`, [id.job]); }
  it('waits for an active expected-issuer principal and does not provision from a foreign or disabled identity', async () => {
    const db = database();
    await db.query(`INSERT INTO principals(tenant_id,person_id,oidc_issuer,oidc_subject,role) VALUES($1,$2,'https://foreign.example.test','foreign','learner')`, [id.tenant,id.person]);
    await db.query(`INSERT INTO principals(tenant_id,oidc_issuer,oidc_subject,role) VALUES($1,$2,'other-tenant','learner')`, [id.other,issuer]);
    expect(await runJobs(1,id.tenant)).toEqual({done:0,failed:1});
    expect(mock.find).not.toHaveBeenCalled(); expect(mock.provision).not.toHaveBeenCalled(); expect(mock.link).not.toHaveBeenCalled();
    await db.query(`INSERT INTO principals(tenant_id,person_id,oidc_issuer,oidc_subject,role,active) VALUES($1,$2,$3,'correct-worker','learner',false)`, [id.tenant,id.person,issuer]);
    await retry(); expect(await runJobs(1,id.tenant)).toEqual({done:0,failed:1}); expect(mock.enrol).not.toHaveBeenCalled();
    await db.query(`UPDATE principals SET active=true WHERE tenant_id=$1 AND person_id=$2 AND oidc_issuer=$3`, [id.tenant,id.person,issuer]);
    await retry(); expect(await runJobs(1,id.tenant)).toEqual({done:1,failed:0});
    const person = await db.query(`SELECT hse_id,identity_email FROM people WHERE tenant_id=$1 AND id=$2`, [id.tenant,id.person]);
    expect(mock.link).toHaveBeenCalledWith(id.tenant,{userId:17,hseId:person.rows[0].hse_id,identityEmail:person.rows[0].identity_email,subject:'correct-worker',issuer});
    expect(mock.enrol).toHaveBeenCalledOnce();
  });
  it('keeps a mapped-user bridge mismatch retryable and never records enrollment success', async () => {
    const db = database(); await db.query('DELETE FROM moodle_enrollments WHERE tenant_id=$1',[id.tenant]);
    mock.enrol.mockClear(); mock.cohort.mockClear(); mock.link.mockRejectedValueOnce(new Error('Moodle rejected the identity binding'));
    await retry(); expect(await runJobs(1,id.tenant)).toEqual({done:0,failed:1});
    expect(mock.enrol).not.toHaveBeenCalled(); expect(mock.cohort).not.toHaveBeenCalled();
    const result = await db.query(`SELECT state,last_error FROM integration_outbox WHERE id=$1`,[id.job]);
    expect(result.rows[0]).toMatchObject({state:'failed',last_error:'Moodle rejected the identity binding'});
    const enrolled = await db.query('SELECT 1 FROM moodle_enrollments WHERE tenant_id=$1',[id.tenant]);
    expect(enrolled.rows).toHaveLength(0);
    await retry(); expect(await runJobs(1,id.tenant)).toEqual({done:1,failed:0}); expect(mock.enrol).toHaveBeenCalledOnce();
  });
  it('does not mutate OAuth links while reconciling mapped source records', async () => {
    const db = database(); mock.link.mockClear(); mock.enrolled.mockResolvedValue(true);
    await db.query(`UPDATE principals SET active=false WHERE tenant_id=$1 AND oidc_issuer=$2`, [id.tenant,issuer]);
    await db.query(`INSERT INTO integration_outbox(tenant_id,kind,aggregate_id) VALUES($1,'moodle_reconcile',$2)`, [id.tenant,id.assignment]);
    expect(await runJobs(1,id.tenant)).toEqual({done:1,failed:0});
    expect(mock.link).not.toHaveBeenCalled();
    expect(mock.enrolled).toHaveBeenCalledWith(id.tenant,42,17);
  });
  it('wakes failed assignment enrollment immediately after printed activation', async () => {
    const db = database(), admin = randomUUID();
    await db.query(`INSERT INTO principals(id,tenant_id,oidc_issuer,oidc_subject,role) VALUES($1::uuid,$2,$3,$1::text,'tenant_admin')`, [admin,id.tenant,issuer]);
    await db.query('DELETE FROM moodle_enrollments WHERE tenant_id=$1',[id.tenant]);
    await db.query(`UPDATE integration_outbox SET state='failed',next_attempt_at=now()+interval '1 hour' WHERE id=$1`,[id.job]);
    const actor: Actor = {id:admin,tenantId:id.tenant,tenantName:'OAuth test',tenantSynthetic:false,personId:null,displayName:'Synthetic admin',role:'tenant_admin',siteIds:[]};
    const provider: IdentityAdmin = {issuer,createAccount:vi.fn(),removeAccount:vi.fn(),configureAccount:vi.fn(),updateProfile:vi.fn(),invite:vi.fn(),setPassword:vi.fn(),logout:vi.fn()};
    const printed = await manageAccount(actor,id.person,{action:'printed',reason:'Synthetic printed activation test'},provider);
    let job = await db.query(`SELECT state FROM integration_outbox WHERE id=$1`,[id.job]);
    expect(job.rows[0].state).toBe('failed');
    await activateAccount({code:printed.activationCode,password:'Synthetic chosen password 123!'},provider);
    job = await db.query(`SELECT state,next_attempt_at<=now() AS ready FROM integration_outbox WHERE id=$1`,[id.job]);
    expect(job.rows[0]).toEqual({state:'pending',ready:true});
  });

  it.each(['deactivate','printed'] as const)('serializes paused provisioning with %s and its Moodle state sync', async (transition) => {
    const db = database();
    mock.suspend.mockClear();
    await db.query(`DELETE FROM principals WHERE tenant_id=$1 AND person_id=$2 AND oidc_issuer<>$3`,[id.tenant,id.person,issuer]);
    await db.query(`UPDATE people SET active=true,account_access_locked=false WHERE tenant_id=$1 AND id=$2`,[id.tenant,id.person]);
    await db.query(`UPDATE principals SET active=true WHERE tenant_id=$1 AND person_id=$2`,[id.tenant,id.person]);
    await db.query('DELETE FROM moodle_enrollments WHERE tenant_id=$1',[id.tenant]);
    await db.query(`DELETE FROM person_external_ids WHERE tenant_id=$1 AND person_id=$2 AND source='moodle'`,[id.tenant,id.person]);
    await db.query(`UPDATE integration_outbox SET state='done',completed_at=now() WHERE tenant_id=$1`,[id.tenant]);
    await retry();
    // Keep a current-state worker ready, so it also competes for the person lock.
    await db.query(`INSERT INTO integration_outbox(tenant_id,kind,aggregate_id) VALUES($1,'moodle_user_state',$2)
      ON CONFLICT(tenant_id,kind,aggregate_id) DO UPDATE SET state='pending',next_attempt_at=now()`,[id.tenant,id.person]);
    let account: { id: number; suspended: boolean; enrolled: boolean } | null = null;
    let releaseProvision!: () => void, provisionStarted!: () => void;
    const started = new Promise<void>(resolve => {provisionStarted=resolve;});
    const release = new Promise<void>(resolve => {releaseProvision=resolve;});
    mock.find.mockImplementation(async () => account?.id ?? null);
    mock.provision.mockImplementationOnce(async () => {
      provisionStarted(); await release; account={id:71,suspended:false,enrolled:false}; return account.id;
    });
    mock.enrol.mockImplementation(async () => {
      expect(account).not.toBeNull(); account!.enrolled=true;
      const active=await db.query(`SELECT active,account_access_locked FROM people WHERE id=$1`,[id.person]);
      expect(active.rows[0]).toEqual({active:true,account_access_locked:false});
    });
    mock.suspend.mockImplementation(async (_tenant: string,userId: number,suspended: boolean) => {
      expect(userId).toBe(account!.id); account!.suspended=suspended;
    });
    const enrollment=runJobs(1,id.tenant); enrollment.catch(()=>{});
    await started;
    let transitionFinished=false;
    const change=(transition==='deactivate'
      ? editPerson(actor,id.person,{active:false,reason:'Synthetic concurrent deactivation'},provider)
      : manageAccount(actor,id.person,{action:'printed',reason:'Synthetic concurrent printed reset'},provider))
      .then(result=>{transitionFinished=true;return result;});
    change.catch(()=>{});
    async function blockedWorkers() {
      const result=await db.query<{count:string}>(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
        AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF p%'`);
      return Number(result.rows[0].count);
    }
    let synchronization: ReturnType<typeof runJobs> | undefined;
    try {
      // Use observed database lock waits, rather than a timing-dependent sleep.
      await vi.waitFor(async()=>expect(await blockedWorkers()).toBeGreaterThanOrEqual(1),{timeout:5000,interval:10});
      expect(transitionFinished).toBe(false); expect(account).toBeNull();
      synchronization=runJobs(1,id.tenant); synchronization.catch(()=>{});
      await vi.waitFor(async()=>expect(await blockedWorkers()).toBeGreaterThanOrEqual(2),{timeout:5000,interval:10});
      expect(mock.suspend).not.toHaveBeenCalledWith(id.tenant,71,true);
      releaseProvision();
      expect(await enrollment).toEqual({done:1,failed:0});
      await change;
      expect(await synchronization).toEqual({done:1,failed:0});
      // A requeue while the state job waited must also be safe and retryable.
      await runJobs(2,id.tenant);
      expect(account).toEqual({id:71,suspended:true,enrolled:true});
      expect(account!.enrolled&&!account!.suspended).toBe(false);
      const status=await db.query(`SELECT p.active,p.account_access_locked,pr.active AS principal_active
        FROM people p JOIN principals pr ON pr.tenant_id=p.tenant_id AND pr.person_id=p.id
        WHERE p.id=$1 AND pr.oidc_issuer=$2`,[id.person,issuer]);
      expect(status.rows[0]).toEqual({active:transition!=='deactivate',account_access_locked:transition==='printed',principal_active:false});
      // If the transition commits first, the retry is truthfully blocked, with
      // no further remote effects and no falsely successful enrollment job.
      const calls=mock.enrol.mock.calls.length;
      await retry(); expect(await runJobs(1,id.tenant)).toEqual({done:0,failed:1});
      expect(mock.enrol).toHaveBeenCalledTimes(calls);
      const job=await db.query('SELECT state,last_error FROM integration_outbox WHERE id=$1',[id.job]);
      expect(job.rows[0].state).toBe('failed'); expect(job.rows[0].last_error).toContain('inactive or awaiting account activation');
    } finally {releaseProvision(); await Promise.allSettled([enrollment,change,...(synchronization?[synchronization]:[])]);}
  });
});
