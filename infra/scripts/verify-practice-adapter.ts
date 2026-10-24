/** Read the browser-created native Quiz through the production Moodle boundary. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { inspectMoodleCourse, MoodleError, readCompletion } from '../../web/src/lib/server/moodle';
import practice from './verify-practice-course.cjs';

async function main() {
  const { validateFixture } = practice;
  const manifest = JSON.parse(await readFile('content/beta-practice/1.0.0/manifest.json', 'utf8'));
  const fixture = validateFixture(process.env, manifest);
  assert.notEqual(process.env.NODE_ENV, 'production', 'The disposable HTTP fixture cannot run as production');
  const token = JSON.parse(process.env.MOODLE_A_PILOT || '{}').token;
  const tenantId = 'e7777777-7777-4777-8777-777777777777';
  process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenantId]: {
    instanceId: 'a8888888-8888-4888-8888-888888888888', baseUrl: 'http://localhost:8081',
    token, completionEvidence: 'local_hse_evidence'
  } });
  const course = await inspectMoodleCourse(tenantId, fixture.courseid);
  assert.ok(course.title.startsWith('SYNTHETIC beta practice'), 'The adapter must read the disposable practice course');
  const completion = await readCompletion(tenantId, fixture.courseid, fixture.userid, null, fixture.quizcmid, fixture.quizid);
  assert.equal(completion.completed, true); assert.equal(completion.score, 100); assert.equal(completion.attempts, 3);
  assert.ok(completion.completedAt && completion.sourceCompletionId);
  assert.equal(completion.quizObservation?.quizId, fixture.quizid);
  assert.equal(completion.quizObservation?.courseId, fixture.courseid);
  assert.equal(completion.quizObservation?.activityModuleId, fixture.quizcmid);
  assert.deepEqual(completion.quizObservation?.attempts.map(attempt => attempt.rawMarks), [0, 10, 0]);
  const repeated = await readCompletion(tenantId, fixture.courseid, fixture.userid, null, fixture.quizcmid, fixture.quizid);
  assert.equal(repeated.sourceCompletionId, completion.sourceCompletionId);
  assert.equal(repeated.completedAt?.toISOString(), completion.completedAt.toISOString());
  assert.equal(repeated.attempts, 3); assert.equal(repeated.score, 100);
  await assert.rejects(() => readCompletion(tenantId, fixture.courseid, fixture.userid, null, fixture.pagecmids[0], fixture.quizid),
    error => error instanceof MoodleError && error.functionName === 'mod_quiz_get_quizzes_by_courses' && error.code === 'invalid_mapping');
  await writeFile('infra/practice-adapter-evidence.json', JSON.stringify({
    fixture: 'SYNTHETIC ONLY — production native-Quiz read boundary; no training credit',
    sourceDigest: fixture.sourceDigest, courseId: fixture.courseid, learnerId: fixture.userid,
    sourceCompletionId: completion.sourceCompletionId, completedAt: completion.completedAt.toISOString(),
    score: completion.score, attempts: completion.attempts, quizObservation: completion.quizObservation,
    wrongActivityMappingRejected: true, repeatedCanonicalEvidenceStable: true
  }, null, 2) + '\n');
  console.log('OK production Moodle boundary retains three native Quiz attempts, highest course grade, stable source completion and exact assessment mapping');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
