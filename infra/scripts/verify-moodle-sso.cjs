#!/usr/bin/env node
/* Disposable Moodle + Keycloak browser proof; never logs credentials or callback queries. */
'use strict';
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const { chromium } = require('../../web/node_modules/@playwright/test');
const { requestFailureDetails } = require('./verify-hse-identity.cjs');
const base = 'http://localhost:8081';
const auth = (process.env.KEYCLOAK_URL || 'https://auth.localhost:8443').replace(/\/$/, '');
const issuer = `${auth}/realms/hse-dev`;

async function call(token, fn, fields = {}, expectFailure = false) {
  const response = await fetch(`${base}/webservice/rest/server.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: 'json', ...fields }),
    signal: AbortSignal.timeout(15000)
  });
  assert.ok(response.ok, `Moodle HTTP failure during ${fn}`);
  const result = await response.json();
  if (expectFailure) { assert.ok(result?.exception, `${fn} unexpectedly accepted an unauthorized request`); return; }
  assert.ok(!result?.exception, `Moodle rejected ${fn}`);
  return result;
}
function destination(value) { try { const u = new URL(value); return `${u.origin}${u.pathname}`; } catch { return 'unavailable'; } }
async function main() {
  const pilot = JSON.parse(process.env.MOODLE_A_PILOT || '{}');
  const bridge = JSON.parse(process.env.MOODLE_OAUTH_FIXTURE || '{}');
  const scorm = JSON.parse(process.env.MOODLE_SCORM_FIXTURE || '{}');
  const password = process.env.DEV_WORKER_PASSWORD, serviceSecret = process.env.HSE_ADMIN_CLIENT_SECRET;
  assert.ok(pilot.token && bridge.bridgeToken && Number.isSafeInteger(bridge.issuerid) && scorm.courseid && scorm.cmid && scorm.scoid && password && serviceSecret,
    'Pilot, OAuth bridge, SCORM fixtures and development identity secrets are required');
  const serviceResponse = await fetch(`${issuer}/protocol/openid-connect/token`, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
      grant_type: 'client_credentials', client_id: 'hse-account-admin', client_secret: serviceSecret }) });
  assert.equal(serviceResponse.status, 200, 'Account service authentication failed');
  const serviceToken = (await serviceResponse.json()).access_token;
  const hseId = randomUUID(), tenantId = randomUUID(), username = `sso-printed-${hseId}`;
  const email = `${hseId}@${tenantId}.login.invalid`, printedPassword = `Activated-${randomBytes(18).toString('base64url')}!`;
  const createdIdentity = await fetch(`${auth}/admin/realms/hse-dev/users`, { method: 'POST',
    headers: { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, firstName: 'Synthetic', lastName: 'Printed learner', enabled: true,
      emailVerified: false, attributes: { hse_person_id: [hseId], hse_tenant_id: [tenantId], hse_identity_email_technical: ['true'] },
      credentials: [{ type: 'password', value: printedPassword, temporary: false }] }) });
  assert.equal(createdIdentity.status, 201, 'Could not create the activated printed identity fixture');
  const subject = createdIdentity.headers.get('location')?.split('/').at(-1);
  assert.ok(subject, 'Created identity subject missing');
  let browser;
  try {
    const created = await call(pilot.token, 'core_user_create_users', {
      'users[0][username]': `hse_${hseId.replaceAll('-', '')}`, 'users[0][firstname]': 'Synthetic',
      'users[0][lastname]': 'Printed learner', 'users[0][email]': email, 'users[0][idnumber]': hseId,
      'users[0][auth]': 'oauth2', 'users[0][createpassword]': '0'
    });
    assert.equal(created.length, 1); const technicalUser = created[0].id;
    await call(pilot.token, 'core_user_update_user_preferences', { userid: technicalUser, emailstop: '1' });
    const regularHse = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const regular = await call(pilot.token, 'core_user_get_users_by_field', { field: 'idnumber', 'values[0]': regularHse });
    assert.equal(regular.length, 1, 'Run the REST pilot provisioning proof first');
    const users = [
      { userid: regular[0].id, hseid: regularHse, subject: '11111111-1111-4111-8111-111111111111', identityemail: 'worker.a@example.invalid', username: 'synthetic.worker.a', password, technical: false },
      { userid: technicalUser, hseid: hseId, subject, identityemail: email, username, password: printedPassword, technical: true }
    ];
    const link = (user, overrides = {}, failure = false) => call(bridge.bridgeToken, 'local_hse_evidence_link_oauth_login', {
      userid: user.userid, hseid: user.hseid, subject: user.subject, identityemail: user.identityemail,
      issuerid: bridge.issuerid, issuerurl: issuer, ...overrides
    }, failure);
    // No link is established by the CLI bootstrap: both bindings use the production bridge.
    for (const user of users) {
      assert.deepEqual(await link(user), { userid: user.userid, issuerid: bridge.issuerid, linked: true });
      assert.deepEqual(await link(user), { userid: user.userid, issuerid: bridge.issuerid, linked: true });
      await call(pilot.token, 'enrol_manual_enrol_users', { 'enrolments[0][roleid]': pilot.studentroleid,
        'enrolments[0][userid]': user.userid, 'enrolments[0][courseid]': scorm.courseid });
    }
    await link(users[1], { hseid: randomUUID() }, true);
    await link(users[1], { subject: users[0].subject }, true);
    await link(users[1], { issuerurl: `${auth}/realms/moodle-company-b` }, true);
    await link(users[1], { userid: scorm.userid }, true);
    await call(bridge.bridgeToken, 'core_user_update_users', { 'users[0][id]': technicalUser, 'users[0][suspended]': '1' }, true);
    console.log('OK production OAuth bridge is idempotent and rejects foreign identity/user/issuer bindings; bridge token cannot edit users');
    browser = await chromium.launch({ headless: true });
    for (const user of users) {
      const context = await browser.newContext(), page = await context.newPage(); let phase = 'Moodle course entry';
      page.on('requestfailed', request => console.error(`SSO browser request failed: ${JSON.stringify(requestFailureDetails(request))}`));
      try {
        await page.goto(`${base}/course/view.php?id=${scorm.courseid}`, { waitUntil: 'domcontentloaded' });
        phase = 'Moodle issuer selection';
        await page.locator('.login-identityproviders a').filter({ hasText: 'HSE portal synthetic SSO' }).click();
        phase = 'Keycloak password authentication';
        await page.locator('input[name="username"]').fill(user.username);
        await page.locator('input[name="password"]').fill(user.password);
        await page.locator('#kc-login').click();
        phase = 'Moodle OAuth callback and session';
        await page.waitForURL(url => url.origin === base && url.pathname === '/course/view.php' && url.searchParams.get('id') === String(scorm.courseid), { timeout: 30000 });
        const session = await page.evaluate(() => ({ userid: window.M?.cfg?.userId, courseid: window.M?.cfg?.courseId }));
        assert.equal(session.userid, user.userid, 'Browser session must use the REST-provisioned Moodle user');
        assert.equal(session.courseid, scorm.courseid);
        phase = 'Actual SCORM launch';
        await page.goto(`${base}/mod/scorm/player.php?cm=${scorm.cmid}&scoid=${scorm.scoid}`, { waitUntil: 'domcontentloaded' });
        await page.frameLocator('iframe#scorm_object').getByRole('button', { name: 'Record synthetic completion' }).waitFor({ state: 'visible', timeout: 30000 });
        phase = 'Stable HSE identity readback';
        const readback = await call(pilot.token, 'core_user_get_users_by_field', { field: 'idnumber', 'values[0]': user.hseid });
        assert.equal(readback.length, 1); assert.equal(readback[0].id, user.userid);
        assert.equal(readback[0].idnumber, user.hseid); assert.equal(readback[0].email, user.identityemail);
        if (user.technical) {
          const preferences = await call(pilot.token, 'core_message_get_user_notification_preferences', { userid: user.userid });
          assert.equal(preferences.preferences.userid, user.userid); assert.equal(preferences.preferences.disableall, 1);
          const identityResponse = await fetch(`${auth}/admin/realms/hse-dev/users/${encodeURIComponent(subject)}`, { headers: { Authorization: `Bearer ${serviceToken}` } });
          assert.equal(identityResponse.status, 200); const identity = await identityResponse.json();
          assert.equal(identity.emailVerified, false, 'Technical email must remain unverified after browser SSO');
          assert.deepEqual(identity.requiredActions || [], [], 'Printed learner must not need an email action');
        }
        console.log(`OK ${user.technical ? 'printed technical-email' : 'contact-email'} learner used Keycloak/Moodle SSO, retained the exact REST-provisioned HSE identity and launched the real SCO`);
      } catch (error) {
        await page.screenshot({ path: 'infra/moodle-sso-failure.png', fullPage: true,
          mask: [page.locator('input[name="username"],input[type="password"],input[type="email"]')] }).catch(() => {});
        console.error(`SSO browser failure: ${JSON.stringify({ phase, destination: destination(page.url()), errorType: error.name })}`);
        throw new Error(`Moodle SSO proof failed during ${phase}`);
      } finally { await context.close(); }
    }
    // Same IdP realm is insufficient: an unprovisioned tenant-B worker must not
    // create a Moodle-A account or acquire a course session through OAuth.
    const foreignLookup = { field: 'email', 'values[0]': 'worker.b@example.invalid' };
    assert.deepEqual(await call(pilot.token, 'core_user_get_users_by_field', foreignLookup), []);
    const deniedContext = await browser.newContext(), deniedPage = await deniedContext.newPage();
    try {
      await deniedPage.goto(`${base}/course/view.php?id=${scorm.courseid}`, { waitUntil: 'domcontentloaded' });
      await deniedPage.locator('.login-identityproviders a').filter({ hasText: 'HSE portal synthetic SSO' }).click();
      await deniedPage.locator('input[name="username"]').fill('synthetic.worker.b');
      await deniedPage.locator('input[name="password"]').fill(password);
      await deniedPage.locator('#kc-login').click();
      await deniedPage.waitForURL(url => url.origin === base && url.pathname === '/login/index.php', { timeout: 30000 });
      await deniedPage.getByText('An account with your email address could not be found.', { exact: false }).waitFor();
      assert.deepEqual(await call(pilot.token, 'core_user_get_users_by_field', foreignLookup), []);
      console.log('OK unprovisioned tenant-B identity is denied on Moodle-A without self-registration');
    } catch (error) {
      console.error(`SSO denial proof failure: ${JSON.stringify({ destination: destination(deniedPage.url()), errorType: error.name })}`);
      throw new Error('Unprovisioned identity browser denial proof failed');
    } finally { await deniedContext.close(); }
    await writeFile(process.env.MOODLE_SSO_EVIDENCE || 'infra/moodle-sso-evidence.json', JSON.stringify({
      fixture: 'SYNTHETIC ONLY - no training credit or production evidence',
      scope: 'Production OAuth bridge, real Keycloak/Moodle browser SSO, exact REST identity, actual SCO launch',
      issuerId: bridge.issuerid, courseId: scorm.courseid, activityId: scorm.cmid,
      contactEmailUserId: users[0].userid, printedUserId: technicalUser,
      technicalEmailVerified: false, technicalNotificationsDisabled: true,
      foreignUnprovisionedIdentityDenied: true,
      limitations: ['Synthetic fixture only; deployed issuer and client secrets still require staging acceptance', 'SCO launch does not establish training completion or authorization']
    }, null, 2) + '\n');
  } finally {
    try { if (browser) await browser.close(); } finally {
      const removed = await fetch(`${auth}/admin/realms/hse-dev/users/${encodeURIComponent(subject)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${serviceToken}` } });
      assert.equal(removed.status, 204, 'Synthetic printed identity cleanup failed');
    }
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
