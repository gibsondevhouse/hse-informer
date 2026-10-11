#!/usr/bin/env node
/* Launch the real synthetic SCO as a disposable manual-auth Moodle learner. */
'use strict';

const { chromium } = require('../../web/node_modules/@playwright/test');

async function main() {
  const base = (process.env.MOODLE_SCORM_URL || 'http://localhost:8081').replace(/\/$/, '');
  const fixture = JSON.parse(process.env.MOODLE_SCORM_FIXTURE || '{}');
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
