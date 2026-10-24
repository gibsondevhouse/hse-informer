'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { validateFixture, parseQuestions } = require('./verify-practice-course.cjs');
const manifest = JSON.parse(readFileSync('content/beta-practice/1.0.0/manifest.json', 'utf8'));
const fixture = { courseShortname: 'HSE-BETA-PRACTICE-SYNTHETIC-1.0.0', username: 'synthetic.practice.learner',
  sourceDigest: manifest.sourceSha256, courseid: 1, quizid: 1, quizcmid: 5, userid: 3, pagecmids: [2, 3, 4] };
function environment(changes = {}) { return { HSE_PRACTICE_FIXTURE: '1', PRACTICE_LEARNER_PASSWORD: 'synthetic only',
  MOODLE_A_PILOT: JSON.stringify({ token: 'synthetic only' }), MOODLE_PRACTICE_FIXTURE: JSON.stringify(fixture), ...changes }; }
test('practice browser refuses implicit activation and non-fixture courses or identities', () => {
  assert.throws(() => validateFixture(environment({ HSE_PRACTICE_FIXTURE: '' }), manifest));
  for (const changes of [{ courseShortname: 'REAL-COURSE' }, { username: 'real.person' }]) {
    assert.throws(() => validateFixture(environment({ MOODLE_PRACTICE_FIXTURE: JSON.stringify({ ...fixture, ...changes }) }), manifest));
  }
});
test('practice browser refuses stale content and ambiguous or invalid activity mappings', () => {
  for (const changes of [{ sourceDigest: '0'.repeat(64) }, { pagecmids: [2, 2, 4] }, { quizcmid: 3 },
    { userid: 0 }, { quizid: '1' }, { pagecmids: [2, 3] }]) {
    assert.throws(() => validateFixture(environment({ MOODLE_PRACTICE_FIXTURE: JSON.stringify({ ...fixture, ...changes }) }), manifest));
  }
});
test('operator source parser rejects incomplete questions and ambiguous answer keys', () => {
  const gift = readFileSync('content/beta-practice/1.0.0/questions.gift', 'utf8');
  assert.equal(parseQuestions(gift).length, 10);
  assert.throws(() => parseQuestions(gift.slice(0, gift.indexOf('::BETA-1.0.0-Q10::'))));
  assert.throws(() => parseQuestions(gift.replace("~Another person's profile", "=Another person's profile")));
});
