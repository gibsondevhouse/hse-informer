'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateJourney, otp, safeMessage } = require('./beta-journey-guards.cjs');
const valid = () => ({ HSE_BETA_JOURNEY_FIXTURE: '1', DATABASE_URL: 'postgresql://hse:fixture-only@localhost:54329/hse',
  KEYCLOAK_URL: 'https://auth.localhost:8443', DEV_WORKER_PASSWORD: 'fixture-only', DEV_ADMIN_OTP_SECRET: 'JBSWY3DPEHPK3PXP',
  HSE_OIDC_CLIENT_SECRET: 'fixture-only', HSE_ADMIN_CLIENT_SECRET: 'fixture-only',
  MOODLE_A_PILOT: JSON.stringify({ token: 'fixture-only', studentroleid: 5 }),
  MOODLE_SCORM_FIXTURE: JSON.stringify({ courseid: 3, cmid: 4, scormid: 5, scoid: 6, packageSha256: 'a'.repeat(64) }),
  MOODLE_OAUTH_FIXTURE: JSON.stringify({ issuerid: 1, bridgeToken: 'fixture-only' }) });
test('joined journey accepts only explicitly enabled disposable service identities and ports', () => {
  assert.equal(validateJourney(valid()).scorm.courseid, 3);
  for (const patch of [{ HSE_BETA_JOURNEY_FIXTURE: '' }, { DEV_AUTH: 'synthetic' }, { NODE_ENV: 'production' },
    { DATABASE_URL: 'postgresql://hse:fixture-only@company.example:54329/hse' },
    { DATABASE_URL: 'postgresql://hse:fixture-only@localhost:5432/hse' },
    { DATABASE_URL: 'postgresql://hse:fixture-only@localhost:54329/company' },
    { DATABASE_URL: 'postgresql://hse:fixture-only@localhost:54329/hse?host=company.example' },
    { KEYCLOAK_URL: 'https://company.example' }]) assert.throws(() => validateJourney({ ...valid(), ...patch }));
});
test('joined journey rejects missing bridge credentials and malformed assessment mapping', () => {
  assert.throws(() => validateJourney({ ...valid(), MOODLE_OAUTH_FIXTURE: '{}' }));
  assert.throws(() => validateJourney({ ...valid(), MOODLE_SCORM_FIXTURE: JSON.stringify({ courseid: 3 }) }));
});
test('diagnostics redact raw activation/password/service secrets and callback query values', () => {
  assert.equal(safeMessage('code=one-time-code password=private-password https://auth.localhost/callback?code=sensitive&state=private',
    ['one-time-code', 'private-password']), 'code=[redacted] password=[redacted] https://auth.localhost/callback');
  // RFC6238's SHA-1 vector, reduced to the fixture's six displayed digits.
  assert.equal(otp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000), '287082');
});
