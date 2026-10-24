#!/usr/bin/env node
/* Launch the real synthetic SCO as a disposable manual-auth Moodle learner. */
'use strict';

const { chromium } = require('../../web/node_modules/@playwright/test');

async function main() {
  const base = (process.env.MOODLE_SCORM_URL || 'http://localhost:8081').replace(/\/$/, '');
  const fixture = JSON.parse(process.env.MOODLE_SCORM_FIXTURE || '{}');
  const pilot = JSON.parse(process.env.MOODLE_A_PILOT || '{}');
  const password = process.env.SCORM_LEARNER_PASSWORD;
  if (!Number.isSafeInteger(fixture.cmid) || !Number.isSafeInteger(fixture.scoid)
      || !fixture.username || !password) {
    throw new Error('Synthetic SCORM fixture IDs, username, and password are required');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/login/index.php`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').fill(fixture.username);
    await page.locator('#password').fill(password);
    await page.locator('#loginbtn').click();
    await page.waitForLoadState('domcontentloaded');
    if (new URL(page.url()).pathname === '/login/index.php') {
      throw new Error('Synthetic SCORM learner could not sign in to Moodle');
    }

    await page.goto(`${base}/mod/scorm/player.php?cm=${fixture.cmid}&scoid=${fixture.scoid}`,
      { waitUntil: 'domcontentloaded' });
    const sco = page.frameLocator('iframe#scorm_object');
    const button = sco.getByRole('button', { name: 'Record synthetic completion' });
    await button.waitFor({ state: 'visible', timeout: 30000 });
    await button.click();
    await sco.getByRole('status').getByText('Synthetic SCORM status completed; score 100.',
      { exact: false }).waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1500); // Allow Moodle's SCORM AJAX commit to finish.
    console.log('OK synthetic learner launched the real SCORM 1.2 SCO and committed completed / score 100');
    if (!pilot.token || !Number.isSafeInteger(fixture.userid)) {
      throw new Error('Synthetic service token and learner ID are required to verify session termination');
    }
    const response = await fetch(`${base}/webservice/rest/server.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ wstoken: pilot.token, wsfunction: 'local_hse_evidence_end_user_sessions',
        moodlewsrestformat: 'json', userid: String(fixture.userid) }),
      signal: AbortSignal.timeout(15000)
    });
    const ended = await response.json();
    if (!response.ok || ended.userid !== fixture.userid || ended.ended !== true) {
      throw new Error('Moodle did not confirm synthetic learner session termination');
    }
    await page.goto(`${base}/course/view.php?id=${fixture.courseid}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    if (new URL(page.url()).pathname !== '/login/index.php') {
      throw new Error('Existing Moodle browser session survived supported session termination');
    }
    console.log('OK supported HSE session endpoint ended the existing synthetic Moodle browser session');
  } catch (error) {
    await page.screenshot({ path: 'infra/scorm-browser-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
