'use strict';
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const TENANT = 'e9999999-9999-4999-8999-999999999999';
const INSTANCE = 'a9999999-9999-4999-8999-999999999999';
const ORIGIN = 'http://localhost:5173';
const MOODLE = 'http://localhost:8081';
const ISSUER = 'https://auth.localhost:8443/realms/hse-dev';

function validateJourney(environment) {
  assert.equal(environment.HSE_BETA_JOURNEY_FIXTURE, '1', 'Explicit disposable joined-journey flag is required');
  assert.ok(!environment.DEV_AUTH, 'The joined journey must use real authentication');
  assert.notEqual(environment.NODE_ENV, 'production', 'Only the disposable HTTP development fixture is allowed');
  const database = new URL(environment.DATABASE_URL || '');
  assert.ok(['postgres:', 'postgresql:'].includes(database.protocol)
    && ['localhost', '127.0.0.1'].includes(database.hostname) && database.port === '54329'
    && database.pathname === '/hse' && database.username === 'hse' && database.password
    && !database.search && !database.hash, 'Use only the disposable Compose hse database on port54329');
  assert.equal(environment.KEYCLOAK_URL, 'https://auth.localhost:8443', 'Use only the disposable HTTPS issuer');
  for (const key of ['DEV_WORKER_PASSWORD', 'DEV_ADMIN_OTP_SECRET', 'HSE_OIDC_CLIENT_SECRET', 'HSE_ADMIN_CLIENT_SECRET']) {
    assert.ok(environment[key], `Missing fixture setting ${key}`);
  }
  const pilot = JSON.parse(environment.MOODLE_A_PILOT || '{}');
  const scorm = JSON.parse(environment.MOODLE_SCORM_FIXTURE || '{}');
  const oauth = JSON.parse(environment.MOODLE_OAUTH_FIXTURE || '{}');
  assert.ok(pilot.token && oauth.bridgeToken, 'Missing disposable Moodle service credentials');
  for (const value of [pilot.studentroleid, scorm.courseid, scorm.cmid, scorm.scormid, scorm.scoid, oauth.issuerid]) {
    assert.ok(Number.isSafeInteger(value) && value > 0, 'Invalid disposable Moodle fixture identifier');
  }
  assert.match(scorm.packageSha256, /^[a-f0-9]{64}$/);
  return { pilot, scorm, oauth };
}

function otp(secret, time = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const value = alphabet.indexOf(char); assert.ok(value >= 0, 'Invalid fixture OTP seed');
    bits += value.toString(2).padStart(5, '0');
  }
  const key = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest(), offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
function safeMessage(value, secrets) {
  let result = String(value).replace(/https?:\/\/[^\s"']+/g, value => {
    try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return '[URL redacted]'; }
  });
  for (const secret of secrets) if (typeof secret === 'string' && secret) result = result.replaceAll(secret, '[redacted]');
  return result.slice(0, 1500);
}
module.exports = { TENANT, INSTANCE, ORIGIN, MOODLE, ISSUER, validateJourney, otp, safeMessage };
