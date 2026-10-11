import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptsRemaining,
  blockTypes,
  courseStatus,
  gradeInteraction,
  initialState,
  isAnswered,
  isAssessmentLocked,
  isLessonLocked,
  isPlayerState,
  lessonOrder,
  lessonRequirements,
  lessonSlides,
  navigationDirection,
  outlineModuleId,
  progressSegments,
  questionOrder,
  reducePlayer,
  scoreAssessment,
  seededShuffle,
  slideBudget,
  slideIndexOf,
  storageKeyFor,
  xapiInteractionType,
} from '../lib/lms/engine.ts';
import { pbjCourse } from '../lib/lms/pbj-course.ts';

const course = pbjCourse;
const reduce = (state, ...actions) =>
  actions.reduce((current, action) => reducePlayer(course, current, action), state);
const findBlock = (id) =>
  lessonOrder(course)
    .flatMap((lesson) => lesson.blocks)
    .find((block) => 'id' in block && block.id === id);

test('every block type has an xAPI mapping where graded and a stable catalog order', () => {
  assert.equal(new Set(blockTypes).size, blockTypes.length);
  assert.equal(blockTypes.length, 34);
  for (const type of Object.keys(xapiInteractionType))
    assert.ok(blockTypes.includes(type), type);
  assert.equal(storageKeyFor(course), 'hse-lms-preview-pbj-101-1.0.0-preview-v2');
});

test('single-answer interactions grade exact matches and surface option feedback', () => {
  const mc = findBlock('q-3-1-label');
  assert.equal(gradeInteraction(mc, 'b').correct, true);
  assert.match(gradeInteraction(mc, 'b').feedback, /Labels change/);
  assert.equal(gradeInteraction(mc, 'a').correct, false);
  assert.equal(gradeInteraction(mc, undefined).score, 0);
  const tf = findBlock('q-1-2-edges');
  assert.equal(gradeInteraction(tf, false).correct, true);
  assert.equal(gradeInteraction(tf, true).correct, false);
  assert.equal(isAnswered(tf, 'false'), false);
  const scenario = findBlock('q-5-2-soggy');
  assert.equal(gradeInteraction(scenario, 'b').correct, true);
  assert.match(gradeInteraction(scenario, 'd').feedback, /Toasting/);
});

test('fill-in and numeric interactions normalize text and accept ranges', () => {
  const fill = findBlock('q-5-1-utensil');
  assert.equal(gradeInteraction(fill, '  Dedicated ').correct, true);
  assert.equal(gradeInteraction(fill, 'shared').correct, false);
  assert.equal(
    gradeInteraction(
      { ...fill, caseSensitive: true, accepted: ['Separate'] },
      'separate',
    ).correct,
    false,
  );
  const numeric = findBlock('q-3-2-seconds');
  assert.equal(gradeInteraction(numeric, 20).correct, true);
  assert.equal(gradeInteraction(numeric, 60).correct, false);
  assert.equal(gradeInteraction({ ...numeric, max: 60 }, 60).correct, true);
  assert.equal(gradeInteraction(numeric, 19).correct, false);
  assert.equal(isAnswered(numeric, Number.NaN), false);
});

test('multi-item interactions award partial credit and only full credit is correct', () => {
  const mr = findBlock('q-2-2-allergens');
  const full = gradeInteraction(mr, ['peanut', 'wheat', 'milk']);
  assert.equal(full.correct, true);
  assert.equal(full.score, 1);
  assert.equal(gradeInteraction(mr, ['peanut', 'wheat']).score, 0.667);
  assert.equal(gradeInteraction(mr, ['peanut', 'grape']).score, 0);
  assert.equal(gradeInteraction(mr, ['grape', 'strawberry']).score, 0);
  assert.equal(gradeInteraction(mr, ['peanut', 'wheat']).correct, false);

  const matching = findBlock('q-4-2-tools');
  const allRight = Object.fromEntries(matching.pairs.map((p) => [p.id, p.id]));
  assert.equal(gradeInteraction(matching, allRight).correct, true);
  assert.equal(
    gradeInteraction(matching, { ...allRight, m1: 'm2' }).score,
    0.75,
  );
  assert.equal(isAnswered(matching, { m1: 'm1' }), false);

  const sequencing = findBlock('q-5-1-order');
  const ordered = sequencing.items.map((item) => item.id);
  assert.equal(gradeInteraction(sequencing, ordered).correct, true);
  const swapped = [...ordered];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.equal(gradeInteraction(sequencing, swapped).score, 0.714);
  assert.equal(isAnswered(sequencing, ordered.slice(1)), false);

  const sorting = findBlock('q-3-1-sort');
  const sorted = Object.fromEntries(
    sorting.items.map((item) => [item.id, item.category]),
  );
  assert.equal(gradeInteraction(sorting, sorted).correct, true);
  assert.equal(gradeInteraction(sorting, { ...sorted, s1: 'safe' }).score, 0.8);
});

test('assessment scoring applies the passing threshold and seeded shuffles are stable permutations', () => {
  const perfect = Object.fromEntries(
    course.assessment.questions.map((question) => [
      question.id,
      correctResponse(question),
    ]),
  );
  const full = scoreAssessment(course.assessment, perfect);
  assert.equal(full.percent, 100);
  assert.equal(full.passed, true);
  assert.equal(full.perQuestion.length, 12);
  const partial = { ...perfect };
  delete partial['fa-1'];
  delete partial['fa-2'];
  delete partial['fa-3'];
  assert.equal(scoreAssessment(course.assessment, partial).percent, 75);
  assert.equal(scoreAssessment(course.assessment, partial).passed, false);
  assert.equal(scoreAssessment(course.assessment, {}).percent, 0);

  const ids = course.assessment.questions.map((question) => question.id);
  const shuffled = questionOrder(course.assessment, 42).map((q) => q.id);
  assert.deepEqual(shuffled, questionOrder(course.assessment, 42).map((q) => q.id));
  assert.deepEqual([...shuffled].sort(), [...ids].sort());
  assert.notDeepEqual(shuffled, ids);
  assert.deepEqual(seededShuffle([], 1), []);
  assert.deepEqual(seededShuffle(['only'], 9), ['only']);
});

test('lesson completion is guarded by requirements and linear mode locks later lessons', () => {
  const order = lessonOrder(course);
  let state = initialState(course);
  assert.equal(courseStatus(course, state), 'not-started');
  assert.equal(isLessonLocked(course, state, order[0].id), false);
  assert.equal(isLessonLocked(course, state, order[1].id), true);
  assert.equal(
    reduce(state, { type: 'open-lesson', lessonId: order[1].id }).view,
    'overview',
  );
  state = reduce(state, { type: 'open-lesson', lessonId: order[0].id });
  assert.equal(state.view, 'lesson');
  assert.deepEqual(
    lessonRequirements(order[0], state).map((item) => item.met),
    [false],
  );
  assert.equal(reduce(state, { type: 'complete-lesson' }), state);
  assert.equal(
    reduce(state, { type: 'check', blockId: 'q-1-1-complete' }),
    state,
    'checking without an answer is ignored',
  );
  state = reduce(
    state,
    { type: 'answer', blockId: 'q-1-1-complete', response: 'a' },
    { type: 'check', blockId: 'q-1-1-complete' },
  );
  assert.deepEqual(state.checked, ['q-1-1-complete']);
  assert.equal(courseStatus(course, state), 'in-progress');
  state = reduce(state, { type: 'complete-lesson' });
  assert.deepEqual(state.completedLessons, [order[0].id]);
  assert.equal(state.lessonId, order[1].id);
  assert.equal(isLessonLocked(course, state, order[1].id), false);
  assert.equal(isLessonLocked(course, state, order[2].id), true);
  assert.equal(isAssessmentLocked(course, state), true);
  state = reduce(state, { type: 'set-linear', value: false });
  assert.equal(isLessonLocked(course, state, order.at(-1).id), false);
  assert.equal(isAssessmentLocked(course, state), false);
  const changed = reduce(state, {
    type: 'answer',
    blockId: 'q-1-1-complete',
    response: 'b',
  });
  assert.deepEqual(changed.checked, [], 'changing an answer clears its check');
});

test('activities gate completion only when required and attestation records a name', () => {
  const setup = lessonOrder(course).find((lesson) => lesson.id === 'l4-1');
  let state = { ...initialState(course), linear: false, view: 'lesson', lessonId: 'l4-1' };
  assert.equal(lessonRequirements(setup, state)[0].met, false);
  for (let index = 0; index < 6; index++)
    state = reduce(state, { type: 'toggle-checklist', blockId: 'cl-4-1-setup', index });
  assert.equal(lessonRequirements(setup, state)[0].met, true);
  state = reduce(state, { type: 'toggle-checklist', blockId: 'cl-4-1-setup', index: 2 });
  assert.deepEqual(state.checklists['cl-4-1-setup'], [0, 1, 3, 4, 5]);

  const closing = lessonOrder(course).find((lesson) => lesson.id === 'l6-3');
  state = { ...state, lessonId: 'l6-3' };
  const labels = lessonRequirements(closing, state).map((item) => item.label);
  assert.equal(labels.length, 2);
  assert.match(labels[0], /reflection of at least 20/);
  state = reduce(
    state,
    { type: 'set-reflection', blockId: 'rf-6-3', text: 'Too short' },
    { type: 'attest', blockId: 'at-6-3', name: '   ', at: '2026-10-03T12:00:00Z' },
  );
  assert.deepEqual(
    lessonRequirements(closing, state).map((item) => item.met),
    [false, false],
  );
  state = reduce(
    state,
    { type: 'set-reflection', blockId: 'rf-6-3', text: 'Skipping the label check is easiest; I would keep it by reading aloud.' },
    { type: 'attest', blockId: 'at-6-3', name: 'Sample Learner', at: '2026-10-03T12:00:00Z' },
    { type: 'set-survey', blockId: 'sv-6-3', value: '4' },
  );
  assert.deepEqual(
    lessonRequirements(closing, state).map((item) => item.met),
    [true, true],
  );
  assert.equal(state.surveys['sv-6-3'], '4');
  state = reduce(state, { type: 'complete-lesson' });
  assert.ok(state.completedLessons.includes('l6-3'));
});

test('assessment attempts are capped, graded on submit, and reset preserves sandbox toggles', () => {
  let state = { ...initialState(course), linear: false };
  state = reduce(state, { type: 'start-assessment', seed: 7, at: '2026-10-03T12:00:00Z' });
  assert.equal(state.view, 'assessment');
  assert.equal(state.assessment.current.seed, 7);
  assert.equal(
    reduce(state, { type: 'start-assessment', seed: 8, at: 'x' }).assessment.current.seed,
    7,
    'a running attempt cannot be restarted',
  );
  assert.equal(
    reduce(state, { type: 'answer-assessment', questionId: 'missing', response: 'a' }),
    state,
  );
  for (const question of course.assessment.questions)
    state = reduce(state, {
      type: 'answer-assessment',
      questionId: question.id,
      response: correctResponse(question),
    });
  state = reduce(state, { type: 'submit-assessment', at: '2026-10-03T12:10:00Z' });
  assert.equal(state.assessment.current, null);
  assert.equal(state.assessment.reviewing, true);
  assert.equal(state.assessment.attempts[0].percent, 100);
  assert.equal(state.assessment.attempts[0].passed, true);
  assert.equal(attemptsRemaining(course, state), 2);
  assert.equal(courseStatus(course, state), 'in-progress', 'lessons still incomplete');

  for (const seed of [1, 2]) {
    state = reduce(
      state,
      { type: 'start-assessment', seed, at: 'x' },
      { type: 'submit-assessment', at: 'y' },
    );
  }
  assert.equal(attemptsRemaining(course, state), 0);
  assert.equal(reduce(state, { type: 'start-assessment', seed: 3, at: 'z' }), state);
  assert.equal(state.assessment.attempts.at(-1).percent, 0);

  const reset = reduce(
    { ...state, showDevNotes: true },
    { type: 'reset' },
  );
  assert.deepEqual(reset.assessment.attempts, []);
  assert.equal(reset.linear, false);
  assert.equal(reset.showDevNotes, true);
});

test('course status is knowledge-complete only when every lesson is done and an attempt passed', () => {
  const state = {
    ...initialState(course),
    linear: false,
    completedLessons: lessonOrder(course).map((lesson) => lesson.id),
    assessment: {
      attempts: [{ at: 'x', percent: 83, passed: true, responses: {} }],
      current: null,
      reviewing: false,
    },
  };
  assert.equal(courseStatus(course, state), 'knowledge-complete');
  assert.equal(
    courseStatus(course, { ...state, completedLessons: state.completedLessons.slice(1) }),
    'in-progress',
  );
});

test('stored snapshots are validated against the course before restore', () => {
  const state = initialState(course);
  assert.equal(isPlayerState(state, course), true);
  assert.equal(isPlayerState(JSON.parse(JSON.stringify(state)), course), true);
  assert.equal(isPlayerState(null, course), false);
  assert.equal(isPlayerState({ ...state, version: 2 }, course), false);
  assert.equal(isPlayerState({ ...state, courseId: 'other' }, course), false);
  assert.equal(isPlayerState({ ...state, view: 'dashboard' }, course), false);
  assert.equal(isPlayerState({ ...state, lessonId: 'nope' }, course), false);
  assert.equal(
    isPlayerState({ ...state, completedLessons: ['nope'] }, course),
    false,
  );
  assert.equal(
    isPlayerState({ ...state, responses: { q: { nested: 1 } } }, course),
    false,
  );
  assert.equal(
    isPlayerState({ ...state, checklists: { cl: [1.5] } }, course),
    false,
  );
  assert.equal(
    isPlayerState(
      { ...state, assessment: { attempts: [{ at: 'x' }], current: null, reviewing: false } },
      course,
    ),
    false,
  );
  assert.equal(isPlayerState({ ...state, slide: 2 }, course), true);
  assert.equal(isPlayerState({ ...state, slide: -1 }, course), false);
  assert.equal(isPlayerState({ ...state, slide: 1.5 }, course), false);
  const { slide, ...legacy } = state;
  assert.equal(slide, 0);
  assert.equal(isPlayerState(legacy, course), true, 'pre-slide snapshots restore');
});

test('slides break at headings and dividers, isolate interactions and activities, and keep order', () => {
  const lesson = (blocks) => ({ id: 'x', title: 'x', summary: '', minutes: 1, blocks });
  const h = (text) => ({ type: 'heading', text });
  const p = (text) => ({ type: 'paragraph', text });
  const mc = (id) => ({ type: 'multipleChoice', id, prompt: '', options: [], answer: 'a' });
  assert.deepEqual(lessonSlides(lesson([])), [[]]);
  assert.deepEqual(
    lessonSlides(lesson([h('A'), p('1'), h('B'), p('2'), { type: 'divider' }, p('3')])).map(
      (slide) => slide.map((block) => block.text),
    ),
    [['A', '1'], ['B', '2'], ['3']],
    'headings start slides and dividers break without rendering',
  );
  assert.deepEqual(
    lessonSlides(lesson([p('1'), h('Check'), mc('q1'), mc('q2'), p('2')])).map((slide) =>
      slide.map((block) => block.id ?? block.text),
    ),
    [['1'], ['Check', 'q1'], ['q2'], ['2']],
    'a heading directly above a question stays with it',
  );
  const checklist = { type: 'checklist', id: 'cl', title: '', items: ['a'] };
  assert.deepEqual(
    lessonSlides(lesson([h('A'), checklist, p('1')])).map((slide) => slide.length),
    [2, 1],
  );
  const many = lessonSlides(lesson([h('A'), ...Array.from({ length: 12 }, (_, i) => p(`${i}`))]));
  assert.ok(many.length > 2, 'long runs of content split into several slides');
  for (const slide of many)
    assert.ok(slide.filter((block) => block.type !== 'heading').length <= slideBudget);
  assert.deepEqual(
    many.flatMap((slide) => slide.filter((block) => block.type === 'paragraph').map((block) => block.text)),
    Array.from({ length: 12 }, (_, i) => `${i}`),
    'content order is preserved across slides',
  );
  assert.deepEqual(
    lessonSlides(lesson([h('A'), { type: 'table', caption: '', columns: [], rows: [] }, { type: 'timeline', title: '', events: [] }])).map((slide) => slide.length),
    [2, 1],
    'heavy blocks do not share a slide once the budget is spent',
  );
  for (const item of lessonOrder(course)) {
    const slides = lessonSlides(item);
    assert.deepEqual(
      slides.flat(),
      item.blocks.filter((block) => block.type !== 'divider'),
      `${item.id} keeps every rendered block exactly once`,
    );
    for (const block of item.blocks)
      if (block.type !== 'divider' && 'id' in block && typeof block.id === 'string')
        assert.ok(slideIndexOf(item, block.id) >= 0, `${item.id} ${block.id} is on a slide`);
  }
});

test('slide navigation steps within a lesson and crosses lesson boundaries', () => {
  const order = lessonOrder(course);
  const first = order[0];
  const firstSlides = lessonSlides(first).length;
  assert.ok(firstSlides > 1, 'the welcome lesson has several slides');
  let state = reduce(initialState(course), { type: 'open-lesson', lessonId: first.id });
  assert.equal(state.slide, 0);
  assert.equal(reduce(state, { type: 'go-slide', index: -4 }), state, 'clamped to the first slide');
  state = reduce(state, { type: 'go-slide', index: 1 });
  assert.equal(state.slide, 1);
  state = reduce(state, { type: 'go-slide', index: 99 });
  assert.equal(state.slide, firstSlides - 1, 'clamped to the last slide');
  assert.equal(
    slideIndexOf(first, 'q-1-1-complete'),
    firstSlides - 1,
    'the knowledge check sits on the final slide',
  );
  state = reduce(state, { type: 'back' });
  assert.equal(state.slide, firstSlides - 2, 'back moves one slide');
  state = reduce(state, { type: 'go-slide', index: 0 }, { type: 'back' });
  assert.equal(state.view, 'overview', 'back from the first slide of the first lesson returns to the overview');
  state = reduce(
    initialState(course),
    { type: 'set-linear', value: false },
    { type: 'open-lesson', lessonId: order[1].id },
    { type: 'back' },
  );
  assert.equal(state.lessonId, first.id);
  assert.equal(state.slide, firstSlides - 1, 'back from a lesson start lands on the previous lesson\'s last slide');
  state = reduce(
    state,
    { type: 'answer', blockId: 'q-1-1-complete', response: 'b' },
    { type: 'check', blockId: 'q-1-1-complete' },
    { type: 'complete-lesson' },
  );
  assert.equal(state.lessonId, order[1].id);
  assert.equal(state.slide, 0, 'completing a lesson opens the next one at its first slide');
  assert.equal(reduce(state, { type: 'open-overview' }, { type: 'go-slide', index: 1 }).slide, 0, 'slides only move inside a lesson');
  const atAssessment = reduce(state, { type: 'open-assessment' }, { type: 'back' });
  assert.equal(atAssessment.lessonId, order.at(-1).id);
  assert.equal(atAssessment.slide, lessonSlides(order.at(-1)).length - 1);
});

test('the outline expands the open lesson module, else the next unfinished one', () => {
  const order = lessonOrder(course);
  const moduleOfLesson = (id) =>
    course.modules.find((item) => item.lessons.some((lesson) => lesson.id === id)).id;
  const state = initialState(course);
  assert.equal(outlineModuleId(course, state), course.modules[0].id);
  const opened = reduce(
    state,
    { type: 'set-linear', value: false },
    { type: 'open-lesson', lessonId: order[5].id },
  );
  assert.equal(outlineModuleId(course, opened), moduleOfLesson(order[5].id));
  const finished = { ...state, completedLessons: order.map((lesson) => lesson.id) };
  assert.equal(outlineModuleId(course, finished), null, 'nothing to expand once every lesson is done');
  assert.equal(
    outlineModuleId(course, { ...finished, view: 'lesson', lessonId: order[2].id }),
    moduleOfLesson(order[2].id),
  );
  const partial = {
    ...state,
    view: 'summary',
    completedLessons: order.slice(0, 3).map((lesson) => lesson.id),
  };
  assert.equal(outlineModuleId(course, partial), moduleOfLesson(order[3].id));
});

test('the top progress bar shows slides in a lesson, answers in an attempt, and lessons elsewhere', () => {
  const order = lessonOrder(course);
  let state = initialState(course);
  let segments = progressSegments(course, state);
  assert.equal(segments.length, order.length);
  assert.deepEqual(segments.slice(0, 2), ['current', 'todo']);
  state = reduce(
    state,
    { type: 'open-lesson', lessonId: order[0].id },
    { type: 'go-slide', index: 1 },
  );
  segments = progressSegments(course, state);
  assert.equal(segments.length, lessonSlides(order[0]).length);
  assert.ok(segments.length >= 3, 'the welcome lesson has at least three slides');
  assert.deepEqual(segments.slice(0, 3), ['done', 'current', 'todo']);
  state = reduce(
    { ...initialState(course), completedLessons: order.map((lesson) => lesson.id) },
    { type: 'start-assessment', seed: 7, at: 'now' },
  );
  assert.equal(state.view, 'assessment');
  const ordered = questionOrder(course.assessment, 7);
  assert.equal(progressSegments(course, state).length, ordered.length);
  assert.ok(progressSegments(course, state).every((segment) => segment === 'todo'));
  state = reduce(state, {
    type: 'answer-assessment',
    questionId: ordered[1].id,
    response: correctResponse(ordered[1]),
  });
  assert.deepEqual(
    progressSegments(course, state).slice(0, 3),
    ['todo', 'done', 'todo'],
    'segments follow the shuffled display order',
  );
  assert.equal(progressSegments(course, { ...state, view: 'summary' }).length, order.length);
});

test('navigation direction reverses for Back, earlier slides, and earlier lessons', () => {
  const order = lessonOrder(course);
  const base = reduce(
    initialState(course),
    { type: 'set-linear', value: false },
    { type: 'open-lesson', lessonId: order[3].id },
    { type: 'go-slide', index: 1 },
  );
  assert.equal(base.slide, 1);
  const direction = (action, from = base) => navigationDirection(course, from, action);
  assert.equal(direction({ type: 'back' }), 'back');
  assert.equal(direction({ type: 'open-overview' }), 'back');
  assert.equal(direction({ type: 'go-slide', index: 0 }), 'back');
  assert.equal(direction({ type: 'go-slide', index: 2 }), 'forward');
  assert.equal(direction({ type: 'open-lesson', lessonId: order[1].id }), 'back');
  assert.equal(direction({ type: 'open-lesson', lessonId: order[5].id }), 'forward');
  assert.equal(
    direction({ type: 'open-lesson', lessonId: order[0].id }, initialState(course)),
    'forward',
    'opening a lesson from the overview always moves forward',
  );
  assert.equal(direction({ type: 'complete-lesson' }), 'forward');
});

function correctResponse(question) {
  switch (question.type) {
    case 'multipleChoice':
      return question.answer;
    case 'multipleResponse':
      return question.answers;
    case 'trueFalse':
      return question.answer;
    case 'fillBlank':
      return question.accepted[0];
    case 'numeric':
      return question.min;
    case 'matching':
      return Object.fromEntries(question.pairs.map((pair) => [pair.id, pair.id]));
    case 'sequencing':
      return question.items.map((item) => item.id);
    case 'sorting':
      return Object.fromEntries(
        question.items.map((item) => [item.id, item.category]),
      );
    case 'scenario':
      return question.options.find((option) => option.correct).id;
    default:
      throw new Error(`Unhandled ${question.type}`);
  }
}
