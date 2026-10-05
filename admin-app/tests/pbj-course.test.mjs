import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blockTypes,
  estimatedMinutes,
  interactionBlockTypes,
  isInteractionBlock,
  lessonOrder,
} from '../lib/lms/engine.ts';
import { pbjCourse, pbjComponentLabCourse } from '../lib/lms/pbj-course.ts';

const course = pbjComponentLabCourse;
const lessons = lessonOrder(course);
const allBlocks = lessons.flatMap((lesson) => lesson.blocks);
const identified = [
  ...allBlocks.filter((block) => 'id' in block),
  ...course.assessment.questions,
];

test('the sandbox course uses every block type at least once', () => {
  const used = new Set(allBlocks.map((block) => block.type));
  const missing = blockTypes.filter((type) => !used.has(type));
  assert.deepEqual(missing, []);
  const assessed = new Set(course.assessment.questions.map((q) => q.type));
  assert.deepEqual(
    interactionBlockTypes.filter((type) => !assessed.has(type)),
    [],
    'the final assessment exercises every interaction type',
  );
});

test('structure, identifiers, and durations are consistent', () => {
  assert.ok(course.modules.length >= 7);
  assert.ok(lessons.length >= 15);
  const ids = identified.map((block) => block.id);
  assert.equal(new Set(ids).size, ids.length, 'block ids are unique');
  const lessonIds = lessons.map((lesson) => lesson.id);
  assert.equal(new Set(lessonIds).size, lessonIds.length);
  const moduleIds = course.modules.map((module) => module.id);
  assert.equal(new Set(moduleIds).size, moduleIds.length);
  assert.ok(lessons.every((lesson) => lesson.minutes > 0 && lesson.blocks.length));
  assert.ok(estimatedMinutes(course) >= 60);
  assert.ok(course.assessment.passingPercent > 0 && course.assessment.passingPercent <= 100);
  assert.ok(course.assessment.maxAttempts >= 1);
  assert.equal(course.assessment.questions.length, 12);
  assert.ok(course.assessment.questions.every((q) => q.required !== false));
});

test('interaction answers reference real options, pairs, items, and categories', () => {
  for (const block of identified.filter(isInteractionBlock)) {
    const optionIds = (items) => items.map((item) => item.id);
    switch (block.type) {
      case 'multipleChoice':
        assert.ok(optionIds(block.options).includes(block.answer), block.id);
        assert.equal(new Set(optionIds(block.options)).size, block.options.length, block.id);
        break;
      case 'multipleResponse':
        assert.ok(block.answers.length > 0, block.id);
        for (const answer of block.answers)
          assert.ok(optionIds(block.options).includes(answer), `${block.id}:${answer}`);
        break;
      case 'trueFalse':
        assert.equal(typeof block.answer, 'boolean', block.id);
        break;
      case 'fillBlank':
        assert.match(block.text, /___/, block.id);
        assert.ok(block.accepted.length > 0, block.id);
        break;
      case 'numeric':
        assert.ok(block.min <= block.max, block.id);
        break;
      case 'matching':
        assert.ok(block.pairs.length >= 2, block.id);
        assert.equal(new Set(optionIds(block.pairs)).size, block.pairs.length, block.id);
        break;
      case 'sequencing':
        assert.ok(block.items.length >= 3, block.id);
        assert.equal(new Set(optionIds(block.items)).size, block.items.length, block.id);
        break;
      case 'sorting': {
        const categories = new Set(optionIds(block.categories));
        assert.ok(categories.size >= 2, block.id);
        for (const item of block.items)
          assert.ok(categories.has(item.category), `${block.id}:${item.id}`);
        assert.equal(new Set(optionIds(block.items)).size, block.items.length, block.id);
        break;
      }
      case 'scenario':
        assert.equal(block.options.filter((option) => option.correct).length, 1, block.id);
        assert.ok(block.options.every((option) => option.outcome.length > 0), block.id);
        break;
      default:
        assert.fail(`Unhandled interaction ${block.type}`);
    }
  }
});

test('hotspots stay inside the illustration and every link is https', () => {
  for (const block of allBlocks.filter((item) => item.type === 'hotspots')) {
    assert.ok(block.hotspots.length > 0, block.id);
    assert.equal(
      new Set(block.hotspots.map((spot) => spot.id)).size,
      block.hotspots.length,
      block.id,
    );
    for (const spot of block.hotspots) {
      assert.ok(spot.x >= 0 && spot.x <= 100, `${block.id}:${spot.id}`);
      assert.ok(spot.y >= 0 && spot.y <= 100, `${block.id}:${spot.id}`);
    }
  }
  const links = [
    ...course.references,
    ...allBlocks.flatMap((block) =>
      block.type === 'references'
        ? block.items
        : block.type === 'resource' && block.href
          ? [{ href: block.href }]
          : [],
    ),
  ];
  assert.ok(links.length >= 7);
  for (const { href } of links) assert.equal(new URL(href).protocol, 'https:');
});

test('the catalog module annotates its blocks and keeps its interactions optional', () => {
  const catalog = course.modules.find((module) => module.id === 'm7');
  assert.ok(catalog);
  const catalogBlocks = catalog.lessons.flatMap((lesson) => lesson.blocks);
  assert.ok(catalogBlocks.filter((block) => block.devNote).length >= 30);
  for (const block of catalogBlocks.filter(isInteractionBlock))
    assert.equal(block.required, false, block.id);
  assert.ok(
    allBlocks.some((block) => block.type === 'media' && block.transcript.length > 0 && block.captions),
  );
});

test('the learner course has a complete path without author-only material', () => {
  const learnerLessons = lessonOrder(pbjCourse);
  const learnerBlocks = learnerLessons.flatMap((lesson) => lesson.blocks);
  assert.equal(pbjCourse.modules.length, 6);
  assert.equal(learnerLessons.length, 15);
  assert.ok(!pbjCourse.modules.some((module) => module.id === 'm7'));
  assert.ok(!learnerBlocks.some((block) => block.type === 'media'));
  assert.ok(!learnerBlocks.some((block) => block.type === 'resource' && !block.href));
  assert.ok(!learnerBlocks.some((block) =>
    ('text' in block && typeof block.text === 'string' && /sandbox|placeholder|component library|development control/i.test(block.text)) ||
    ('note' in block && /placeholder/i.test(block.note ?? '')),
  ));
  assert.equal(pbjCourse.references.length, 3);
  const learnerIds = [...learnerBlocks.filter((block) => 'id' in block).map((block) => block.id), ...pbjCourse.assessment.questions.map((question) => question.id)];
  assert.equal(new Set(learnerIds).size, learnerIds.length);
  assert.equal(new Set(learnerLessons.map((lesson) => lesson.id)).size, learnerLessons.length);
  for (const reference of pbjCourse.references) assert.equal(new URL(reference.href).protocol, 'https:');
  const aid = learnerBlocks.find((block) => block.type === 'resource' && block.title.includes('One-page job aid'));
  assert.equal(aid.href, '/training/pb-and-j/job-aid');
  assert.match(pbjCourse.assessment.questions.find((question) => question.id === 'fa-8').prompt, /scrubbing your hands/);
  assert.match(pbjCourse.boundary, /not create a training record/);
  assert.notEqual(course.id, pbjCourse.id);
});
