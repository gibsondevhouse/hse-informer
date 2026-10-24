/** Disposable joined portal → identity → Moodle → immutable record acceptance. */
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { database, transaction } from '../../web/src/lib/server/db';
import { enqueueReconciliation, runJobs } from '../../web/src/lib/server/jobs';
import guards from './beta-journey-guards.cjs';

const { TENANT, INSTANCE, ORIGIN, MOODLE, ISSUER, validateJourney, otp, safeMessage } = guards;
const requireWeb = createRequire(resolve('web/package.json'));
const { chromium, expect: baseExpect } = requireWeb('@playwright/test');
const expect = baseExpect.configure({ timeout: 20000 });
const run = promisify(execFile);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const SITE = 'e9999999-9999-4999-8999-999999999991';
const ADMIN = 'e9999999-9999-4999-8999-999999999992';
const ADMIN_PERSON = 'e9999999-9999-4999-8999-999999999993';
const ADMIN_SUBJECT = '33333333-3333-4333-8333-333333333333';

async function main() {
  const { pilot, scorm, oauth } = validateJourney(process.env);
  assert.equal(createHash('sha256').update(await readFile('infra/scorm/synthetic-scorm-1.2.zip')).digest('hex'), scorm.packageSha256,
    'The joined mapping must pin the actual prepared SCORM package');
  process.env.APP_ORIGIN = ORIGIN;
  process.env.OIDC_ISSUER = ISSUER;
  process.env.OIDC_CLIENT_ID = 'hse-web';
  process.env.OIDC_CLIENT_SECRET = process.env.HSE_OIDC_CLIENT_SECRET!;
  process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'hse-account-admin';
  process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = process.env.HSE_ADMIN_CLIENT_SECRET!;
  process.env.SESSION_SECRET = randomBytes(48).toString('base64url');
  process.env.DEV_AUTH = '';
  process.env.NODE_ENV = 'development';
  process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [TENANT]: { instanceId: INSTANCE, baseUrl: MOODLE,
    token: pilot.token, learnerRoleId: pilot.studentroleid, authMethod: 'oauth2', oauthIssuerId: oauth.issuerid,
    oauthBridgeToken: oauth.bridgeToken, completionEvidence: 'local_hse_evidence' } });
  const workerPassword = `Journey-${randomBytes(20).toString('base64url')}!`;
  const secrets = [workerPassword, process.env.DEV_WORKER_PASSWORD, process.env.HSE_OIDC_CLIENT_SECRET,
    process.env.HSE_ADMIN_CLIENT_SECRET, process.env.DEV_ADMIN_OTP_SECRET, process.env.SESSION_SECRET,
    process.env.DATABASE_URL, decodeURIComponent(new URL(process.env.DATABASE_URL!).password), pilot.token, oauth.bridgeToken];
  const evidence: Record<string, any> = { fixture: 'SYNTHETIC ONLY — joined beta journey; no training credit',
    scope: 'Real portal UI, printed activation, OIDC/MFA, production jobs, Moodle OAuth/SCORM and source evidence',
    tenantId: TENANT, sourcePackageSha256: scorm.packageSha256, checkpoints: {}, cleanup: {} };
  let browser: any, server: ReturnType<typeof spawn> | undefined, adminPage: any, workerPage: any;
  let personId = '', subject = '', moodleUserId: number | undefined, phase = 'fresh disposable database guard';
  let failure: Error | undefined, serviceToken: string | undefined, serviceTokenExpiresAt = 0, serverError = false;
  const failedRequests: { surface: string; destination: string; error: string }[] = [];
  const db = database();

  async function portal(context: any, path: string, method = 'GET', body?: unknown, status = 200) {
    const response = await context.request.fetch(`${ORIGIN}${path}`, { method,
      ...(body === undefined ? {} : { data: body, headers: { Origin: ORIGIN } }) });
    assert.equal(response.status(), status, `Portal ${method} ${path.split('?')[0]} returned an unexpected status`);
    return response.json();
  }
  async function moodle(fn: string, fields: Record<string, string | number>) {
    const response = await fetch(`${MOODLE}/webservice/rest/server.php`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ wstoken: pilot.token, wsfunction: fn, moodlewsrestformat: 'json',
        ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)])) }),
      signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `Moodle HTTP failure in ${fn}`);
    const value = await response.json(); assert.ok(!value?.exception, `Moodle rejected ${fn}`);
    if (value?.warnings !== undefined) assert.deepEqual(value.warnings, [], `Moodle warned during ${fn}`);
    return value;
  }
  async function identity(method: string, targetSubject: string) {
    if (!serviceToken || Date.now() >= serviceTokenExpiresAt) {
      const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
          grant_type: 'client_credentials', client_id: 'hse-account-admin', client_secret: process.env.HSE_ADMIN_CLIENT_SECRET! }),
        signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, 'Identity fixture service authentication failed');
      const credentials = await response.json();
      assert.equal(typeof credentials.access_token, 'string', 'Identity service returned no token');
      serviceToken = credentials.access_token;
      serviceTokenExpiresAt = Date.now() + Math.max(1, Number(credentials.expires_in || 60) - 30) * 1000;
      secrets.push(serviceToken);
    }
    return fetch(`https://auth.localhost:8443/admin/realms/hse-dev/users/${encodeURIComponent(targetSubject)}`, {
      method, headers: { Authorization: `Bearer ${serviceToken}` }, signal: AbortSignal.timeout(10000) });
  }
  async function signIn(page: any, username: string, password: string, destination: string, mfa = false) {
    const navigation = await page.goto(`${ORIGIN}/auth/login?returnTo=${encodeURIComponent(destination)}`, { waitUntil: 'domcontentloaded' });
    assert.ok(navigation, 'HSE sign-in navigation returned no response');
    assert.equal(navigation.status(), 200, 'HSE sign-in navigation must reach a successful identity-provider login page');
    assert.equal(new URL(page.url()).origin, new URL(ISSUER).origin,
      'HSE sign-in navigation must reach the configured identity-provider origin');
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password); await page.locator('#kc-login').click();
    if (mfa) {
      await page.locator('input[name="otp"]').waitFor();
      await page.locator('input[name="otp"]').fill(otp(process.env.DEV_ADMIN_OTP_SECRET));
      await page.locator('#kc-login').click();
    }
    await page.waitForURL((url: URL) => url.origin === ORIGIN && url.pathname === destination, { timeout: 30000 });
  }
  async function jobs() {
    const result = await runJobs(30, TENANT);
    assert.equal(result.failed, 0, 'Production Moodle outbox reported a failed operation');
    return result;
  }
  async function cron() {
    // Supported CLI tasks only. Capture their output instead of leaking raw server logs.
    const args = ['compose', '--env-file', 'infra/.env', '-f', 'infra/compose.yaml', 'exec', '-T', '-u', 'www-data', 'moodle-a', 'php'];
    try {
      await run('docker', [...args, '/var/www/moodle/admin/cli/cron.php', '--keep-alive=0'], { timeout: 120000, maxBuffer: 10_000_000 });
      await run('docker', [...args, '/var/www/moodle/admin/cli/scheduled_task.php', '--execute=\\core\\task\\completion_regular_task'],
        { timeout: 120000, maxBuffer: 10_000_000 });
    } catch { throw new Error('Supported Moodle completion task failed; raw server output is deliberately omitted'); }
  }
  try {
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM tenants')).rows[0].count), 0,
      'Joined acceptance requires an empty disposable HSE database');
    const cohort = await moodle('core_cohort_create_cohorts', { 'cohorts[0][categorytype][type]': 'system',
      'cohorts[0][categorytype][value]': '0', 'cohorts[0][name]': 'SYNTHETIC joined beta CI site',
      'cohorts[0][idnumber]': 'HSE-SYNTHETIC-JOINED-BETA-CI' });
    assert.ok(Array.isArray(cohort) && cohort.length === 1 && Number.isSafeInteger(cohort[0].id));
    await transaction(async client => {
      // These are only the initial operator fixtures. Profiles, account actions,
      // mappings and assignments below must use authenticated application paths.
      // Real-worker guards deliberately require synthetic=false; the exact DB,
      // ports and explicit fixture flag above contain this disposable exercise.
      await client.query(`INSERT INTO tenants(id,slug,name,synthetic)
        VALUES($1,'synthetic-joined-beta-ci','SYNTHETIC joined beta CI — no training credit',false)`, [TENANT]);
      await client.query(`INSERT INTO sites(id,tenant_id,code,name,state_code,time_zone)
        VALUES($1,$2,'synthetic-journey','SYNTHETIC journey site','GA','America/New_York')`, [SITE, TENANT]);
      await client.query(`INSERT INTO people(id,tenant_id,display_name,email,person_type,synthetic)
        VALUES($1,$2,'SYNTHETIC journey administrator','admin.a@example.invalid','employee',false)`, [ADMIN_PERSON, TENANT]);
      await client.query('INSERT INTO person_site_memberships(tenant_id,person_id,site_id) VALUES($1,$2,$3)', [TENANT, ADMIN_PERSON, SITE]);
      await client.query(`INSERT INTO principals(id,tenant_id,person_id,oidc_issuer,oidc_subject,role)
        VALUES($1,$2,$3,$4,$5,'tenant_admin')`, [ADMIN, TENANT, ADMIN_PERSON, ISSUER, ADMIN_SUBJECT]);
      await client.query('INSERT INTO principal_site_access(tenant_id,principal_id,site_id) VALUES($1,$2,$3)', [TENANT, ADMIN, SITE]);
      await client.query(`INSERT INTO site_moodle_cohorts(tenant_id,site_id,moodle_cohort_id,instance_key) VALUES($1,$2,$3,$4)`,
        [TENANT, SITE, cohort[0].id, INSTANCE]);
    });
    phase = 'actual HSE server startup';
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
      { cwd: resolve('web'), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.once('error', () => { serverError = true; });
    server.stdout!.resume(); server.stderr!.resume();
    const deadline = Date.now() + 90000;
    for (;;) {
      if (serverError || server.exitCode !== null) throw new Error('Actual HSE server exited before readiness');
      const ready = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false);
      if (ready) break;
      assert.ok(Date.now() < deadline, 'Actual HSE server did not become ready'); await sleep(300);
    }
    browser = await chromium.launch({ headless: true });
    const adminContext = await browser.newContext(); adminPage = await adminContext.newPage();
    const workerContext = await browser.newContext(); workerPage = await workerContext.newPage();
    for (const [surface, page] of [['admin', adminPage], ['worker', workerPage]] as const) page.on('requestfailed', (request: any) => {
      failedRequests.push({ surface, destination: safeMessage(request.url(), secrets),
        error: safeMessage(request.failure()?.errorText || 'unavailable', secrets) });
    });
    phase = 'real administrator OIDC and OTP';
    await signIn(adminPage, 'synthetic.admin.a', process.env.DEV_WORKER_PASSWORD!, '/people', true);
    const adminActor = (await portal(adminContext, '/api/me')).actor;
    assert.equal(adminActor.id, ADMIN); assert.equal(adminActor.role, 'tenant_admin');
    evidence.checkpoints.administratorOidcMfa = true;
    phase = 'administrator creates phone-only profile through people UI';
    await expect(adminPage.getByRole('button', { name: 'Add person', exact: true })).toBeEnabled();
    await adminPage.getByRole('button', { name: 'Add person', exact: true }).click();
    await adminPage.getByLabel('Name', { exact: true }).fill('SYNTHETIC Joined Learner');
    await adminPage.getByLabel('Employee number', { exact: true }).fill('SYNTHETIC-JOINED-001');
    await adminPage.getByLabel('Phone', { exact: true }).fill('555-0199');
    await adminPage.getByLabel('SYNTHETIC journey site', { exact: true }).check();
    await adminPage.getByLabel('Reason for change', { exact: true }).fill('Synthetic joined beta acceptance only');
    const personResponse = adminPage.waitForResponse((r: any) => new URL(r.url()).pathname === '/api/people' && r.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Save profile', exact: true }).click();
    const created = await personResponse; assert.equal(created.status(), 201); personId = (await created.json()).id;
    await expect(adminPage.getByRole('status').filter({ hasText: 'Profile saved' })).toBeVisible();
    const person = (await portal(adminContext, `/api/people/${personId}`)).person;
    assert.equal(person.email, null); assert.equal(person.identityEmailTechnical, true);
    assert.equal(person.identityEmail, `${personId}@${TENANT}.login.invalid`);
    const hseId = (await db.query('SELECT hse_id FROM people WHERE tenant_id=$1 AND id=$2', [TENANT, personId])).rows[0].hse_id;
    phase = 'administrator issues printed activation through account UI';
    await adminPage.getByLabel('Reason for account action', { exact: true }).fill('Synthetic printed activation acceptance');
    const printedResponse = adminPage.waitForResponse((r: any) => new URL(r.url()).pathname === `/api/people/${personId}/account` && r.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Create printed activation code', exact: true }).click();
    const printedHttp = await printedResponse; assert.equal(printedHttp.status(), 200);
    const printed = await printedHttp.json(); secrets.push(printed.activationCode);
    assert.equal(printed.activationUrl, `${ORIGIN}/activate`); assert.equal(printed.activationCode.length, 32);
    const principal = (await db.query(`SELECT p.oidc_subject,p.active,i.activation_code_sha256 FROM principals p
      JOIN person_account_invitations i ON i.tenant_id=p.tenant_id AND i.principal_id=p.id
      WHERE p.tenant_id=$1 AND p.person_id=$2`, [TENANT, personId])).rows[0];
    subject = principal.oidc_subject; assert.equal(principal.active, false);
    assert.equal(principal.activation_code_sha256, createHash('sha256').update(printed.activationCode).digest('hex'));
    assert.equal((await (await identity('GET', subject)).json()).enabled, false);
    evidence.checkpoints.printedAccountLockedAndCodeHashed = true;
    phase = 'worker redeems actual public activation UI';
    await workerPage.goto(`${ORIGIN}/activate`, { waitUntil: 'domcontentloaded' });
    await expect(workerPage.getByRole('button', { name: 'Set password and activate', exact: true })).toBeEnabled();
    await workerPage.getByLabel('Activation code', { exact: true }).fill(printed.activationCode);
    await workerPage.getByLabel('New password', { exact: true }).fill(workerPassword);
    await workerPage.getByLabel('Confirm password', { exact: true }).fill(workerPassword);
    await workerPage.getByRole('button', { name: 'Set password and activate', exact: true }).click();
    await expect(workerPage.getByRole('status')).toContainText('Your password has been set');
    await portal(workerContext, '/api/activate', 'POST', { code: printed.activationCode, password: workerPassword }, 400);
    const cutoff = (await db.query('SELECT auth_valid_after FROM principals WHERE tenant_id=$1 AND person_id=$2', [TENANT, personId])).rows[0].auth_valid_after;
    await sleep(Math.max(0, (Math.floor(cutoff.getTime() / 1000) + 1) * 1000 - Date.now() + 20));
    phase = 'activated worker uses actual HSE OIDC callback';
    await signIn(workerPage, printed.username, workerPassword, '/learn');
    assert.equal((await portal(workerContext, '/api/me')).actor.personId, personId);
    evidence.checkpoints.actualActivationAndWorkerOidc = true;
    phase = 'administrator publishes exact practice mapping and assigns selected version';
    const courseId = (await portal(adminContext, '/api/courses', 'POST', { code: 'SYNTHETIC-JOINED-SCORM',
      title: 'SYNTHETIC joined SCORM — no training credit', sourceContentId: 'SYNTHETIC-JOINED-SCORM', version: '1.0.0',
      packageSha256: scorm.packageSha256, exportFormat: 'scorm_1_2', moodleCourseId: scorm.courseid,
      moodleActivityId: scorm.cmid, moodleScormId: scorm.scormid, practiceOnly: true }, 201)).id;
    await portal(adminContext, `/api/courses/${courseId}`, 'PATCH', { action: 'verify', note: 'Synthetic CI has verified this exact package and its configured SCORM completion criterion.' });
    await portal(adminContext, `/api/courses/${courseId}`, 'PATCH', { action: 'approve' });
    const selected = (await portal(adminContext, '/api/assignments/options')).items.find((c: any) => c.id === courseId);
    assert.ok(selected, 'Published exact course version must be selectable');
    const assignment = await portal(adminContext, '/api/assignments', 'POST', { personIds: [personId], siteId: SITE,
      requirementId: selected.requirementId, courseVersionId: courseId, dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      reason: 'Synthetic joined learner course acceptance' }, 201);
    assert.equal(assignment.created.length, 1); const assignmentId = assignment.created[0];
    evidence.checkpoints.explicitPublishedCourseVersionAssigned = { courseVersionId: courseId, assignmentId };
    phase = 'production outbox provisions identity, OAuth link and enrollment';
    await jobs();
    const mapping = (await db.query(`SELECT me.moodle_user_id FROM moodle_enrollments me
      WHERE tenant_id=$1 AND assignment_id=$2`, [TENANT, assignmentId])).rows[0];
    assert.ok(mapping); moodleUserId = Number(mapping.moodle_user_id);
    const sourceUser = await moodle('core_user_get_users_by_field', { field: 'idnumber', 'values[0]': hseId });
    assert.equal(sourceUser.length, 1); assert.equal(sourceUser[0].id, moodleUserId); assert.equal(sourceUser[0].email, person.identityEmail);
    const notifications = await moodle('core_message_get_user_notification_preferences', { userid: moodleUserId! });
    assert.equal(notifications.preferences.userid, moodleUserId);
    assert.equal(notifications.preferences.disableall, 1);
    const identityUser = await (await identity('GET', subject)).json();
    assert.equal(identityUser.emailVerified, false); assert.deepEqual(identityUser.attributes.hse_person_id, [personId]);
    assert.deepEqual(identityUser.requiredActions || [], []);
    evidence.checkpoints.productionEnrollmentAndTechnicalIdentity = { userId: moodleUserId, hseId, emailUnverified: true, notificationsDisabled: true };
    async function incompleteProgress() {
      await enqueueReconciliation(TENANT); await jobs();
      const rows = (await db.query(`SELECT * FROM moodle_learning_progress
        WHERE tenant_id=$1 AND assignment_id=$2`, [TENANT, assignmentId])).rows;
      assert.equal(rows.length, 1, 'Incomplete reconciliation must retain one current source observation');
      const observed = rows[0];
      assert.equal(observed.tenant_id, TENANT); assert.equal(observed.assignment_id, assignmentId);
      assert.equal(observed.course_version_id, courseId); assert.equal(observed.instance_key, INSTANCE);
      assert.equal(Number(observed.moodle_course_id), scorm.courseid); assert.equal(Number(observed.moodle_user_id), moodleUserId);
      assert.equal(observed.source_observation.courseId, scorm.courseid);
      assert.equal(observed.source_observation.userId, moodleUserId);
      assert.ok(observed.observed_at >= observed.read_started_at);
      assert.equal(observed.source_observation.observedAt, observed.observed_at.toISOString());
      assert.equal(observed.source_observation.started, observed.started);
      const sourcePositive = observed.course_last_access_at !== null || observed.activities_with_progress > 0
        || (observed.started_attempts ?? 0) > 0;
      assert.equal(observed.started === true, sourcePositive, 'Only positive Moodle source activity may establish a start');
      assert.equal((await db.query('SELECT count(*) AS count FROM knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2',
        [TENANT, assignmentId])).rows[0].count, '0', 'Progress must not create a completion record');
      assert.equal((await moodle('local_hse_evidence_get_completion', { courseid: scorm.courseid, userid: moodleUserId! })).completed, false);
      const visible = (await portal(workerContext, '/api/assignments')).items.find((item: any) => item.id === assignmentId);
      assert.ok(visible, 'The learner must see the exact reconciled assignment');
      assert.equal(visible.person.id, personId); assert.equal(visible.courseVersionId, courseId);
      assert.equal(visible.knowledgeComplete, false); assert.equal(visible.deliveryState, 'enrolled');
      assert.equal(visible.progress.observedAt, observed.observed_at.toISOString());
      assert.equal(visible.progress.status, observed.started === true ? 'in_progress' : observed.started === false ? 'not_started' : 'unknown');
      if (!sourcePositive) assert.notEqual(visible.state, 'in_progress', 'Enrollment alone must not imply learning has started');
      return { started: observed.started, lastAccessAt: observed.course_last_access_at?.toISOString() ?? null,
        activitiesWithProgress: observed.activities_with_progress, trackedActivities: observed.tracked_activities,
        startedAttempts: observed.started_attempts, observedAt: observed.observed_at.toISOString(),
        assignmentState: visible.state, progressStatus: visible.progress.status, completionCount: 0,
        courseVersionId: courseId, courseId: scorm.courseid, userId: moodleUserId };
    }
    phase = 'production reconciliation observes incomplete progress before course launch';
    evidence.checkpoints.progressBeforeCourseLaunch = await incompleteProgress();
    phase = 'learner launches Moodle from actual portal';
    await workerPage.reload();
    await expect(workerPage.getByRole('link', { name: 'Open course in Moodle ↗', exact: true })).toHaveAttribute('href', `${MOODLE}/course/view.php?id=${scorm.courseid}`);
    await workerPage.getByRole('link', { name: 'Open course in Moodle ↗', exact: true }).click();
    await workerPage.locator('.login-identityproviders a').filter({ hasText: 'HSE portal synthetic SSO' }).click();
    // The dev AMR flow deliberately requires credentials for each client.
    // Authenticate the same activated identity through Moodle's OAuth client.
    await workerPage.locator('input[name="username"]').fill(printed.username);
    await workerPage.locator('input[name="password"]').fill(workerPassword); await workerPage.locator('#kc-login').click();
    await workerPage.waitForURL((url: URL) => url.origin === MOODLE && url.pathname === '/course/view.php' && url.searchParams.get('id') === String(scorm.courseid));
    assert.equal(await workerPage.evaluate(() => (window as any).M?.cfg?.userId), moodleUserId);
    phase = 'production reconciliation observes real course visit while still incomplete';
    let visitedProgress: Awaited<ReturnType<typeof incompleteProgress>> | undefined;
    // The course request records access at shutdown. Poll actual reconciliation
    // for that source write; do not turn browser navigation into a start signal.
    await expect.poll(async () => { visitedProgress = await incompleteProgress(); return visitedProgress.started; },
      { timeout: 45000, intervals: [500, 1000, 2000] }).toBe(true);
    assert.equal(visitedProgress!.assignmentState, 'in_progress');
    evidence.checkpoints.progressAfterCourseVisit = visitedProgress;
    phase = 'learner commits actual SCORM completion';
    await workerPage.goto(`${MOODLE}/mod/scorm/player.php?cm=${scorm.cmid}&scoid=${scorm.scoid}`, { waitUntil: 'domcontentloaded' });
    const sco = workerPage.frameLocator('iframe#scorm_object');
    await sco.getByRole('button', { name: 'Record synthetic completion', exact: true }).click();
    await expect(sco.getByRole('status')).toContainText('Synthetic SCORM status completed; score 100.');
    await expect.poll(async () => {
      const count = await moodle('mod_scorm_get_scorm_attempt_count', { scormid: scorm.scormid, userid: moodleUserId! });
      return count.attemptscount;
    }, { timeout: 30000 }).toBe(1);
    phase = 'supported Moodle completion task and production reconciliation';
    await cron();
    await enqueueReconciliation(TENANT); await jobs();
    const canonical = await moodle('local_hse_evidence_get_completion', { courseid: scorm.courseid, userid: moodleUserId! });
    assert.equal(canonical.completed, true); assert.equal(canonical.score, 100);
    const completions = await portal(workerContext, '/api/completions');
    assert.equal(completions.items.length, 1); const completion = completions.items[0];
    assert.equal(completion.personId, personId); assert.equal(completion.courseVersionId, courseId);
    assert.equal(completion.source, 'moodle'); assert.equal(completion.score, 100); assert.equal(completion.attempts, 1);
    assert.equal(completion.completedAt, new Date(canonical.timecompleted * 1000).toISOString());
    assert.equal(completion.snapshot.course.packageSha256, scorm.packageSha256);
    const original = (await db.query('SELECT id,source_payload,completion_snapshot,completed_at,score,attempts FROM knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [TENANT, assignmentId])).rows[0];
    assert.equal(original.source_payload.canonical.completionid, canonical.completionid);
    await enqueueReconciliation(TENANT); await jobs();
    assert.equal((await db.query('SELECT count(*) AS count FROM knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [TENANT, assignmentId])).rows[0].count, '1');
    phase = 'learner history and administrator records UI';
    await workerPage.goto(`${ORIGIN}/learn`, { waitUntil: 'domcontentloaded' });
    await expect(workerPage.getByRole('table')).toContainText('SYNTHETIC joined SCORM');
    await expect(workerPage.getByRole('table')).toContainText('100');
    await adminPage.goto(`${ORIGIN}/records?personId=${personId}`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByRole('button', { name: 'Inspect record', exact: true })).toBeEnabled();
    await adminPage.getByRole('button', { name: 'Inspect record', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: 'SYNTHETIC Joined Learner · SYNTHETIC joined SCORM — no training credit', exact: true })).toBeVisible();
    evidence.checkpoints.joinedSourceCompletion = { assignmentId, personId, courseVersionId: courseId, version: completion.courseVersion,
      completedAt: completion.completedAt, score: completion.score, attempts: completion.attempts,
      sourceCompletionId: canonical.completionid, learnerHistoryVisible: true, adminRecordVisible: true, repeatedReadIdempotent: true };
    phase = 'actual portal sign-out form and identity-provider confirmation';
    const oldSession = (await workerContext.cookies(ORIGIN)).find((cookie: any) => cookie.name === 'hse_session');
    assert.ok(oldSession, 'The worker must have an existing portal session before sign-out'); secrets.push(oldSession.value);
    const logoutResponse = workerPage.waitForResponse((response: any) => new URL(response.url()).pathname === '/auth/logout'
      && response.request().method() === 'POST');
    await workerPage.getByRole('button', { name: 'Sign out', exact: true }).click();
    const logoutHttp = await logoutResponse;
    assert.equal(logoutHttp.status(), 303, 'The actual portal sign-out form must redirect to the identity provider');
    const logoutTarget = new URL(logoutHttp.headers().location);
    assert.equal(logoutTarget.origin, new URL(ISSUER).origin);
    assert.equal(logoutTarget.pathname, '/realms/hse-dev/protocol/openid-connect/logout');
    await workerPage.waitForURL((url: URL) => url.origin === new URL(ISSUER).origin
      || (url.origin === ORIGIN && url.pathname === '/signed-out'), { timeout: 30000 });
    if (new URL(workerPage.url()).origin === new URL(ISSUER).origin) {
      await workerPage.locator('#kc-logout[name="confirmLogout"]').click();
    }
    await workerPage.waitForURL((url: URL) => url.origin === ORIGIN && url.pathname === '/signed-out', { timeout: 30000 });
    assert.equal(new URL(workerPage.url()).search, '', 'Coordinated sign-out must not return an unconfirmed-service warning');
    await expect(workerPage.getByRole('heading', { name: 'You’re signed out of HSE Informer', exact: true })).toBeVisible();
    assert.equal((await workerContext.request.get(`${ORIGIN}/api/me`)).status(), 401);
    assert.equal((await workerContext.request.get(`${ORIGIN}/api/me`, { headers: { Cookie: `hse_session=${oldSession.value}` } })).status(), 401,
      'Replaying the pre-logout portal cookie must not restore its session');
    phase = 'coordinated sign-out denies the existing Moodle session';
    await workerPage.goto(`${MOODLE}/course/view.php?id=${scorm.courseid}`, { waitUntil: 'domcontentloaded' });
    await workerPage.waitForURL((url: URL) => url.origin === MOODLE && url.pathname === '/login/index.php');
    evidence.checkpoints.coordinatedSignOut = { actualPortalForm: true, identityProviderLogout: true,
      returnedWithoutWarnings: true, oldPortalCookieDenied: true, oldMoodleSessionDenied: true };
    phase = 'worker recreates real portal and Moodle sessions after sign-out';
    const logoutCutoff = (await db.query('SELECT auth_valid_after FROM principals WHERE tenant_id=$1 AND person_id=$2',
      [TENANT, personId])).rows[0].auth_valid_after;
    await sleep(Math.max(0, (Math.floor(logoutCutoff.getTime() / 1000) + 1) * 1000 - Date.now() + 20));
    await signIn(workerPage, printed.username, workerPassword, '/learn');
    assert.equal((await portal(workerContext, '/api/me')).actor.personId, personId);
    await expect(workerPage.getByLabel('Show', { exact: true })).toBeEnabled();
    await workerPage.getByLabel('Show', { exact: true }).selectOption('completed');
    await workerPage.getByRole('link', { name: 'Open course in Moodle ↗', exact: true }).click();
    await workerPage.locator('.login-identityproviders a').filter({ hasText: 'HSE portal synthetic SSO' }).click();
    await workerPage.locator('input[name="username"]').fill(printed.username);
    await workerPage.locator('input[name="password"]').fill(workerPassword); await workerPage.locator('#kc-login').click();
    await workerPage.waitForURL((url: URL) => url.origin === MOODLE && url.pathname === '/course/view.php'
      && url.searchParams.get('id') === String(scorm.courseid));
    assert.equal(await workerPage.evaluate(() => (window as any).M?.cfg?.userId), moodleUserId);
    evidence.checkpoints.sessionsRecreatedBeforeDeactivation = true;
    phase = 'admin deactivation revokes existing portal and Moodle sessions';
    await portal(adminContext, `/api/people/${personId}`, 'PATCH', { active: false, reason: 'Synthetic joined deactivation acceptance' });
    assert.equal((await workerContext.request.get(`${ORIGIN}/api/me`)).status(), 401);
    await jobs();
    const suspended = await moodle('core_user_get_users_by_field', { field: 'id', 'values[0]': moodleUserId! });
    assert.equal(suspended.length, 1); assert.equal(Boolean(suspended[0].suspended), true);
    await workerPage.goto(`${MOODLE}/course/view.php?id=${scorm.courseid}`, { waitUntil: 'domcontentloaded' });
    await workerPage.waitForURL((url: URL) => url.origin === MOODLE && url.pathname === '/login/index.php');
    const disabledIdentity = await (await identity('GET', subject)).json(); assert.equal(disabledIdentity.enabled, false);
    await workerPage.goto(`${ORIGIN}/auth/login?returnTo=/learn`, { waitUntil: 'domcontentloaded' });
    await workerPage.locator('input[name="username"]').fill(printed.username);
    await workerPage.locator('input[name="password"]').fill(workerPassword); await workerPage.locator('#kc-login').click();
    await expect(workerPage.getByText(/account is disabled/i)).toBeVisible();
    const retained = await portal(adminContext, `/api/completions?personId=${personId}`);
    assert.equal(retained.items.length, 1); assert.equal(retained.items[0].id, completion.id);
    assert.deepEqual((await db.query('SELECT id,source_payload,completion_snapshot,completed_at,score,attempts FROM knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [TENANT, assignmentId])).rows[0], original);
    evidence.checkpoints.deactivation = { existingPortalSessionDenied: true, moodleSuspendedAndExistingSessionDenied: true,
      freshIdentitySignInDenied: true, originalCompletionPreserved: true };
    evidence.success = true;
  } catch (error) {
    failure = error as Error; evidence.success = false; evidence.failedPhase = phase;
    evidence.error = { name: failure.name, message: safeMessage(failure.message, secrets) };
    evidence.failedRequests = failedRequests.slice(-10);
    evidence.destinations = { admin: adminPage ? safeMessage(adminPage.url(), secrets) : 'unavailable',
      worker: workerPage ? safeMessage(workerPage.url(), secrets) : 'unavailable' };
    for (const [name, page] of [['admin', adminPage], ['worker', workerPage]] as const) if (page) {
      await page.screenshot({ path: `infra/beta-journey-${name}-failure.png`, fullPage: true,
        mask: [page.locator('.print-card,input[type="password"],input[name="username"],input[name="otp"],input[autocomplete="one-time-code"]')] }).catch(() => {});
    }
  } finally {
    // A UI failure after the provider succeeded can precede our response read.
    // Recover only this fixture person's persisted subject for scoped cleanup.
    if (!subject && personId) subject = (await db.query('SELECT oidc_subject FROM principals WHERE tenant_id=$1 AND person_id=$2 AND oidc_issuer=$3',
      [TENANT, personId, ISSUER]).catch(() => ({ rows: [] }))).rows[0]?.oidc_subject || '';
    if (subject && personId) {
      try {
        const current = await (await identity('GET', subject)).json();
        assert.deepEqual(current.attributes.hse_person_id, [personId]); assert.deepEqual(current.attributes.hse_tenant_id, [TENANT]);
        assert.equal((await identity('DELETE', subject)).status, 204); evidence.cleanup.createdIdentityRemoved = true;
      } catch {
        evidence.cleanup.createdIdentityRemoved = false;
        if (!failure) { failure = new Error('Created identity cleanup could not be confirmed'); phase = 'created identity cleanup'; }
      }
    }
    try { if (browser) await browser.close(); } catch {
      evidence.cleanup.browserClosed = false;
      if (!failure) { failure = new Error('Browser cleanup could not be confirmed'); phase = 'browser cleanup'; }
    } finally {
      if (server && server.exitCode === null) {
        server.kill('SIGTERM'); await Promise.race([new Promise(resolve => server!.once('exit', resolve)), sleep(5000)]);
        if (server.exitCode === null) server.kill('SIGKILL');
      }
      await db.end().catch(() => {
        if (!failure) { failure = new Error('Database cleanup could not be confirmed'); phase = 'database cleanup'; }
      });
    }
    if (failure) { evidence.success = false; evidence.failedPhase ??= phase; evidence.error ??= { name: failure.name, message: safeMessage(failure.message, secrets) }; }
    evidence.cleanup.moodleAndHseData = 'Retained only in disposable Compose volumes; workflow teardown removes them';
    await writeFile('infra/beta-journey-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
  }
  if (failure) throw new Error(`Joined beta journey failed during ${phase}: ${safeMessage(failure.message, secrets)}`);
  console.log('OK joined real-provider beta: admin MFA → phone profile → printed activation → HSE OIDC → production enrollment/bridge → Moodle SCORM → canonical HSE history → deactivation with preserved evidence');
}
main().catch(error => { console.error(safeMessage(error.message, [process.env.DATABASE_URL])); process.exitCode = 1; });
