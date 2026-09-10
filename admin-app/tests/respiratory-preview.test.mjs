import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialPreviewState,
  reducePreview,
  previewSteps,
  scenarioOptions,
  paginateBlocks,
} from '../lib/respiratory-preview.ts';
import { courses } from '../lib/training.ts';

test('only the first course has a launchable preview', () => {
  assert.deepEqual(
    courses.filter((c) => c.previewPath).map((c) => [c.id, c.previewPath]),
    [['respiratory', '/training/respiratory-protection']],
  );
});
test('preview navigation stays within the available draft and requires scenario review', () => {
  assert.equal(reducePreview(initialPreviewState, { type: 'back' }).step, 0);
  let state = { ...initialPreviewState, step: 4 };
  assert.equal(reducePreview(state, { type: 'next' }).step, 4);
  for (const option of scenarioOptions) {
    let response = reducePreview(state, { type: 'answer', value: option.id });
    assert.equal(reducePreview(response, { type: 'next' }).step, 4);
    response = reducePreview(response, { type: 'check' });
    assert.equal(
      reducePreview(response, { type: 'next' }).step,
      option.id === 'stop' ? 5 : 4,
    );
  }
  state = {
    ...state,
    step: previewSteps.length - 1,
    answer: 'stop',
    checked: true,
  };
  assert.equal(
    reducePreview(state, { type: 'next' }).step,
    previewSteps.length - 1,
  );
});
test('changing an answer clears feedback and restarting resets the draft activity', () => {
  const answered = {
    ...initialPreviewState,
    step: 4,
    answer: 'stop',
    checked: true,
  };
  assert.deepEqual(reducePreview(answered, { type: 'answer', value: 'mask' }), {
    ...answered,
    answer: 'mask',
    checked: false,
  });
  assert.deepEqual(
    reducePreview(answered, { type: 'answer', value: 'invented' }),
    answered,
  );
  assert.deepEqual(reducePreview(answered, { type: 'restart' }), {
    ...initialPreviewState,
    step: 1,
  });
});

test('section navigation and resuming preserve preview progress without earning completion', () => {
  let state = reducePreview(initialPreviewState, { type: 'resume' });
  assert.equal(state.step, 1);
  assert.deepEqual(state.completed, []);
  assert.equal(reducePreview(state, { type: 'section', value: 3 }), state);
  state = reducePreview(state, { type: 'next' });
  assert.deepEqual(state.completed, [1]);
  state = reducePreview(state, { type: 'overview' });
  state = reducePreview(state, { type: 'resume' });
  assert.equal(state.step, 2);
  assert.deepEqual(state.completed, [1]);
  state = reducePreview(state, { type: 'section', value: 1 });
  assert.equal(state.step, 1);
  assert.equal(reducePreview(state, { type: 'section', value: NaN }), state);
});

test('failed practice cannot earn a marker and the recap requires its finish action', () => {
  const practice = {
    ...initialPreviewState,
    step: 4,
    completed: [1, 2, 3],
    answer: 'mask',
    checked: true,
  };
  assert.deepEqual(reducePreview(practice, { type: 'next' }), practice);
  const passed = reducePreview(
    { ...practice, answer: 'stop' },
    { type: 'next' },
  );
  assert.deepEqual(passed.completed, [1, 2, 3, 4]);
  const finished = reducePreview(passed, { type: 'next' });
  assert.deepEqual(finished.completed, [1, 2, 3, 4, 5]);
});

test('viewport pagination preserves block order and repacks without losing content', () => {
  const heights = [60, 80, 120, 40, 90];
  assert.deepEqual(paginateBlocks(heights, 180), [[0, 1], [2, 3], [4]]);
  for (const available of [150, 200, 400, 900]) {
    const pages = paginateBlocks(heights, available);
    assert.deepEqual(pages.flat(), [0, 1, 2, 3, 4]);
    for (const page of pages)
      assert.ok(
        page.reduce((sum, i) => sum + heights[i], 0) + (page.length - 1) * 16 <=
          available,
      );
  }
});

test('a larger viewport never packs duplicate radio fragments onto one page', () => {
  const pages = paginateBlocks([50, 50, 40], 800, 16, [3, 3, undefined]);
  assert.deepEqual(pages, [[0], [1, 2]]);
});
