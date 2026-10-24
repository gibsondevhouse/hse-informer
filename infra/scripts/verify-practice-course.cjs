#!/usr/bin/env node
/* Disposable native Moodle course acceptance. Answer keys remain operator-only. */
'use strict';

const assert = require('node:assert/strict');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('../../web/node_modules/@playwright/test');
const BASE = 'http://localhost:8081';
const SOURCE = path.resolve(__dirname, '../../content/beta-practice/1.0.0');

function validateFixture(environment, manifest) {
  assert.equal(environment.HSE_PRACTICE_FIXTURE, '1', 'Explicit disposable practice fixture flag is required');
  const fixture = JSON.parse(environment.MOODLE_PRACTICE_FIXTURE || '{}');
  assert.equal(fixture.courseShortname, 'HSE-BETA-PRACTICE-SYNTHETIC-1.0.0');
  assert.equal(fixture.username, 'synthetic.practice.learner');
  assert.equal(fixture.sourceDigest, manifest.sourceSha256, 'Fixture must match the prepared course source');
  for (const key of ['courseid', 'quizid', 'quizcmid', 'userid']) {
    assert.ok(Number.isSafeInteger(fixture[key]) && fixture[key] > 0, `Invalid ${key}`);
  }
  assert.ok(Array.isArray(fixture.pagecmids) && fixture.pagecmids.length === 3);
  assert.ok(fixture.pagecmids.every(id => Number.isSafeInteger(id) && id > 0));
  assert.equal(new Set([...fixture.pagecmids, fixture.quizcmid]).size, 4, 'Activity mappings must be distinct');
  assert.ok(environment.PRACTICE_LEARNER_PASSWORD, 'Disposable learner password is required');
  assert.ok(JSON.parse(environment.MOODLE_A_PILOT || '{}').token, 'Read-only pilot access is required');
  return fixture;
}

// This intentionally accepts only the simple fixed practice source. It is not a
// general GIFT parser and never runs in the learner portal or Moodle web root.
function parseQuestions(gift) {
  const blocks = [...gift.matchAll(/::(BETA-1\.0\.0-Q\d{2})::([^\n{]+)\s*\{\n([^}]+)\}/g)];
  assert.equal(blocks.length, 10, 'Expected the ten prepared practice questions');
  return blocks.map(([, id, text, body]) => {
    const choices = body.trim().split('\n').map(line => {
      assert.match(line, /^[=~][^#]+#/);
      return { correct: line[0] === '=', text: line.slice(1).split('#')[0].trim() };
    });
    assert.equal(choices.length, 4); assert.equal(choices.filter(choice => choice.correct).length, 1);
    return { id, text: text.trim(), correct: choices.find(choice => choice.correct).text,
      wrong: choices.find(choice => !choice.correct).text };
  });
}

async function call(token, functionName, fields) {
  const response = await fetch(`${BASE}/webservice/rest/server.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ wstoken: token, wsfunction: functionName, moodlewsrestformat: 'json', ...fields }),
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, `Moodle HTTP failure during ${functionName}`);
  const result = await response.json();
  assert.ok(!result?.exception, `Moodle rejected ${functionName}`);
  if (result.warnings !== undefined) assert.deepEqual(result.warnings, [], `${functionName} returned warnings`);
  return result;
}

async function snapshot(fixture, token) {
  const params = { quizid: String(fixture.quizid), userid: String(fixture.userid) };
  const attempts = await call(token, 'mod_quiz_get_user_quiz_attempts', { ...params, status: 'all', includepreviews: '0' });
  const grade = await call(token, 'mod_quiz_get_user_best_grade', params);
  const activities = await call(token, 'core_completion_get_activities_completion_status', {
    courseid: String(fixture.courseid), userid: String(fixture.userid)
  });
  const course = await call(token, 'core_completion_get_course_completion_status', {
    courseid: String(fixture.courseid), userid: String(fixture.userid)
  });
  assert.ok(Array.isArray(attempts.attempts));
  for (const attempt of attempts.attempts) {
    assert.equal(attempt.quiz, fixture.quizid); assert.equal(attempt.userid, fixture.userid); assert.equal(attempt.preview, 0);
  }
  return {
    attempts: attempts.attempts.map(a => ({ id: a.id, attempt: a.attempt, state: a.state,
      currentpage: a.currentpage, sumgrades: a.sumgrades, timefinish: a.timefinish })),
    bestGrade: grade.hasgrade ? Number(grade.grade) : null,
    activities: activities.statuses.map(a => ({ cmid: a.cmid, state: a.state, timecompleted: a.timecompleted })),
    completed: course.completionstatus.completed
  };
}

async function graded(fixture, token, count) {
  let result;
  await expect.poll(async () => {
    result = await snapshot(fixture, token);
    return result.attempts.length === count && result.attempts.every(a => a.state === 'finished');
  }, { timeout: 90000, intervals: [500, 1000, 2000] }).toBe(true);
  return result;
}

async function signIn(page, fixture, password) {
  await page.goto(`${BASE}/login/index.php`, { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill(fixture.username); await page.locator('#password').fill(password);
  await page.locator('#loginbtn').click();
  await page.waitForURL(url => url.origin === BASE && url.pathname !== '/login/index.php');
  assert.equal(await page.evaluate(() => window.M?.cfg?.userId), fixture.userid);
}

async function start(page, fixture, resume = false) {
  await page.goto(`${BASE}/mod/quiz/view.php?id=${fixture.quizcmid}`, { waitUntil: 'domcontentloaded' });
  const button = resume ? page.getByRole('button', { name: 'Continue your attempt', exact: true })
    : page.locator('.quizstartbuttondiv button[type="submit"]');
  await button.click();
  await page.waitForURL(url => url.origin === BASE && url.pathname === '/mod/quiz/attempt.php');
}

function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
async function answerPage(page, questions, passing, checkSaved = false) {
  const items = page.locator('.que.multichoice');
  assert.equal(await items.count(), 2, 'Practice quiz must show two questions per page');
  for (const item of await items.all()) {
    const text = (await item.locator('.qtext').innerText()).replace(/\s+/g, ' ').trim();
    const question = questions.find(candidate => candidate.text === text);
    assert.ok(question, 'Rendered quiz question must match the prepared source');
    const radio = item.getByRole('radio', { name: new RegExp(escaped(passing ? question.correct : question.wrong)) });
    if (checkSaved) await expect(radio).toBeChecked();
    else { await radio.focus(); await radio.press('Space'); await expect(radio).toBeChecked(); }
  }
}

async function next(page) {
  const previous = page.url(); await page.locator('#mod_quiz-next-nav').press('Enter');
  await page.waitForURL(url => url.href !== previous && url.origin === BASE
    && ['/mod/quiz/attempt.php', '/mod/quiz/summary.php'].includes(url.pathname));
}

async function finish(page, questions, passing) {
  while (new URL(page.url()).pathname === '/mod/quiz/attempt.php') {
    await answerPage(page, questions, passing); await next(page);
  }
  assert.equal(new URL(page.url()).pathname, '/mod/quiz/summary.php');
  await page.getByRole('button', { name: 'Submit all and finish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit all and finish', exact: true }).click();
  await page.waitForURL(url => url.origin === BASE
    && ['/mod/quiz/review.php', '/mod/quiz/view.php'].includes(url.pathname));
}

async function accessibility(page, label, evidence) {
  const { default: AxeBuilder } = require('../../web/node_modules/@axe-core/playwright');
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const violations = report.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length }));
  evidence.accessibility.push({ screen: label, violations });
  assert.deepEqual(violations, [], `Accessibility violations on ${label}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
    `Horizontal page overflow on ${label}`);
}

async function browserProof(fixture, token, password, questions) {
  const browser = await chromium.launch({ headless: true }); let context, page, phase = 'initial state';
  const evidence = { fixture: 'SYNTHETIC ONLY — native Moodle practice; no approval or training credit',
    sourceDigest: fixture.sourceDigest, courseId: fixture.courseid, quizId: fixture.quizid,
    learnerId: fixture.userid, accessibility: [], checkpoints: {} };
  try {
    const initial = await snapshot(fixture, token); assert.equal(initial.attempts.length, 0); assert.equal(initial.completed, false);
    const quizzes = await call(token, 'mod_quiz_get_quizzes_by_courses', { 'courseids[0]': String(fixture.courseid) });
    const quiz = quizzes.quizzes.find(q => q.id === fixture.quizid);
    assert.ok(quiz); assert.equal(quiz.attempts, 3); assert.equal(quiz.grademethod, 1); assert.equal(quiz.grade, 100);
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page = await context.newPage(); phase = 'phone lesson progress'; await signIn(page, fixture, password);
    for (const cmid of fixture.pagecmids.slice(0, 2)) {
      await page.goto(`${BASE}/mod/page/view.php?id=${cmid}`, { waitUntil: 'domcontentloaded' });
      await accessibility(page, `phone lesson ${fixture.pagecmids.indexOf(cmid) + 1}`, evidence);
    }
    const phoneProgress = await snapshot(fixture, token);
    for (const cmid of fixture.pagecmids.slice(0, 2)) assert.equal(phoneProgress.activities.find(a => a.cmid === cmid)?.state, 1);
    assert.equal(phoneProgress.activities.find(a => a.cmid === fixture.pagecmids[2])?.state, 0);
    evidence.checkpoints.phoneProgress = phoneProgress;
    await context.close();
    phase = 'desktop lesson resume'; context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage(); await signIn(page, fixture, password);
    const resumed = await snapshot(fixture, token); assert.deepEqual(resumed.activities, phoneProgress.activities);
    await page.goto(`${BASE}/mod/page/view.php?id=${fixture.pagecmids[2]}`, { waitUntil: 'domcontentloaded' });
    await accessibility(page, 'desktop lesson 3', evidence);
    phase = 'failed first attempt'; await start(page, fixture);
    await accessibility(page, 'native quiz attempt', evidence); await finish(page, questions, false);
    const failed = await graded(fixture, token, 1); assert.equal(failed.bestGrade, 0); assert.equal(failed.completed, false);
    assert.equal(failed.activities.find(a => a.cmid === fixture.quizcmid)?.state, 3);
    evidence.checkpoints.failed = failed;
    phase = 'save partial retry'; await start(page, fixture); await answerPage(page, questions, true); await next(page);
    const savedUrl = new URL(page.url()), savedAttempt = Number(savedUrl.searchParams.get('attempt'));
    assert.ok(savedAttempt > 0); const saved = await snapshot(fixture, token);
    assert.equal(saved.attempts.length, 2); assert.equal(saved.attempts[1].state, 'inprogress');
    evidence.checkpoints.savedRetry = saved; await context.close();
    phase = 'resume quiz on phone';
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page = await context.newPage(); await signIn(page, fixture, password); await start(page, fixture, true);
    assert.equal(Number(new URL(page.url()).searchParams.get('attempt')), savedAttempt);
    await page.goto(`${BASE}/mod/quiz/attempt.php?attempt=${savedAttempt}&cmid=${fixture.quizcmid}&page=0`, { waitUntil: 'domcontentloaded' });
    await answerPage(page, questions, true, true); await next(page); await finish(page, questions, true);
    const passed = await graded(fixture, token, 2); assert.equal(passed.bestGrade, 100);
    assert.equal(passed.activities.find(a => a.cmid === fixture.quizcmid)?.state, 2);
    evidence.checkpoints.passed = passed;
    phase = 'highest grade and attempt limit'; await start(page, fixture); await finish(page, questions, false);
    const exhausted = await graded(fixture, token, 3); assert.equal(exhausted.bestGrade, 100);
    assert.deepEqual(exhausted.attempts.map(a => a.sumgrades), [0, 10, 0]);
    await page.goto(`${BASE}/mod/quiz/view.php?id=${fixture.quizcmid}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.quizstartbuttondiv')).toHaveCount(0);
    await expect(page.getByText('No more attempts are allowed', { exact: false })).toBeVisible();
    const sesskey = await page.evaluate(() => window.M?.cfg?.sesskey); assert.ok(sesskey);
    const denied = await page.request.post(`${BASE}/mod/quiz/startattempt.php`, { form: { cmid: String(fixture.quizcmid), sesskey } });
    assert.ok(denied.status() < 500); assert.equal((await snapshot(fixture, token)).attempts.length, 3);
    evidence.checkpoints.exhausted = exhausted;
    evidence.crossDeviceLessons = true; evidence.crossDeviceSavedAnswers = true; evidence.keyboardResponses = true;
    evidence.fourthAttemptDenied = true;
    await writeFile('infra/practice-browser-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log('OK native Moodle lessons resume across devices; failed quiz grants no completion; saved answers resume; retry passes; highest grade and three-attempt limit hold');
  } catch (error) {
    if (page) await page.screenshot({ path: 'infra/practice-browser-failure.png', fullPage: true,
      mask: [page.locator('input[type="password"],input[name="username"]')] }).catch(() => {});
    await writeFile('infra/practice-browser-evidence.json', JSON.stringify({ ...evidence, failedPhase: phase }, null, 2) + '\n');
    throw new Error(`Native Moodle practice failed during ${phase}: ${String(error.message).replaceAll(password, '[redacted]')}`);
  } finally { if (context) await context.close(); await browser.close(); }
}

async function completionProof(fixture, token) {
  const state = await graded(fixture, token, 3); assert.equal(state.bestGrade, 100); assert.equal(state.completed, true);
  for (const cmid of fixture.pagecmids) assert.equal(state.activities.find(a => a.cmid === cmid)?.state, 1);
  assert.equal(state.activities.find(a => a.cmid === fixture.quizcmid)?.state, 2);
  const params = { courseid: String(fixture.courseid), userid: String(fixture.userid) };
  const canonical = await call(token, 'local_hse_evidence_get_completion', params);
  assert.equal(canonical.courseid, fixture.courseid); assert.equal(canonical.userid, fixture.userid);
  assert.equal(canonical.completed, true); assert.equal(canonical.score, 100);
  assert.ok(Number.isSafeInteger(canonical.timecompleted) && canonical.timecompleted > 0);
  assert.deepEqual(await call(token, 'local_hse_evidence_get_completion', params), canonical);
  await writeFile('infra/practice-completion-evidence.json', JSON.stringify({
    fixture: 'SYNTHETIC ONLY — native Moodle practice; no approval or training credit',
    sourceDigest: fixture.sourceDigest, observed: state, canonicalCompletion: canonical,
    limitations: ['Chosen deployment and human content approval remain required', 'No workplace authorization is granted']
  }, null, 2) + '\n');
  console.log('OK native Moodle quiz produced a stable canonical completion and highest course grade after three real browser attempts');
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(SOURCE, 'manifest.json'), 'utf8'));
  const fixture = validateFixture(process.env, manifest), token = JSON.parse(process.env.MOODLE_A_PILOT).token;
  if (process.argv[2] === 'completion') return completionProof(fixture, token);
  assert.equal(process.argv[2], 'browser', 'Choose browser or completion proof');
  return browserProof(fixture, token, process.env.PRACTICE_LEARNER_PASSWORD,
    parseQuestions(await readFile(path.join(SOURCE, 'questions.gift'), 'utf8')));
}
module.exports = { parseQuestions, validateFixture };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
