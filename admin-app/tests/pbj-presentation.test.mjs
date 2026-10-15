import assert from 'node:assert/strict';
import test from 'node:test';
import { pbjCourse } from '../lib/lms/pbj-course.ts';
import { pbjPresentation, pbjSlides } from '../lib/lms/pbj-presentation.ts';

test('the presentation has unique stable destinations and all eight reusable Overview templates', () => {
  assert.equal(pbjPresentation.slides, pbjSlides);
  const slideIds = new Set(pbjSlides.map((slide) => slide.id));
  assert.equal(slideIds.size, pbjSlides.length);
  assert.equal(pbjSlides.length, 38);
  const overview = pbjSlides.filter((slide) => slide.chapter === 'Overview');
  assert.deepEqual(
    overview.map((slide) => slide.template),
    [
      'introduction',
      'objectives',
      'roadmap',
      'diagram',
      'table',
      'procedure',
      'practice',
      'summary',
    ],
  );
  assert.ok(pbjSlides.slice(37).every((slide) => slide.layout !== 'template'));
  for (const slide of pbjSlides) {
    assert.ok(slide.title && slide.lead && slide.caption, slide.id);
    assert.ok(slide.transcript.length > 0, slide.id);
    if (slide.template === 'roadmap') {
      const chapters = [...new Set(pbjSlides.map((item) => item.chapter))];
      assert.deepEqual(
        slide.content.chapters.map((chapter) => chapter.title),
        chapters,
      );
      for (const chapter of slide.content.chapters) {
        const destination = pbjSlides.find(
          (item) => item.id === chapter.targetSlideId,
        );
        assert.ok(
          destination,
          `missing roadmap destination ${chapter.targetSlideId}`,
        );
        assert.equal(destination.chapter, chapter.title);
      }
    }
    if (slide.template === 'diagram') {
      assert.ok(
        slide.content.description,
        'the diagram has an equivalent text description',
      );
      assert.equal(
        new Set(slide.content.nodes.map((node) => node.id)).size,
        slide.content.nodes.length,
      );
    }
    if (slide.template === 'table') {
      assert.ok(
        slide.content.caption,
        'a comparison needs its own description',
      );
      assert.equal(
        slide.content.rowLabels.length,
        slide.content.rows.length,
        'every comparison situation has a concise topic label',
      );
      assert.equal(
        new Set(slide.content.rowLabels).size,
        slide.content.rowLabels.length,
      );
      assert.ok(slide.content.rowLabels.every((label) => label.trim()));
      assert.ok(
        slide.content.rows.every(
          (row) => row.length === slide.content.columns.length,
        ),
      );
    }
  }
});

test('presentation citations use the existing PBJ course sources and job aid', () => {
  const referenceUrls = new Set(
    pbjCourse.references.map((reference) => reference.href),
  );
  const presentationSources = pbjSlides.flatMap((slide) => [
    ...(slide.details?.sources ?? []),
    ...(slide.template === 'summary' ? slide.content.references : []),
  ]);
  assert.ok(presentationSources.length > 0);
  for (const source of presentationSources) {
    assert.ok(
      referenceUrls.has(source.href),
      `unrecognized course source ${source.href}`,
    );
    assert.ok(source.label);
  }
  assert.deepEqual(
    new Set(presentationSources.map((source) => source.href)),
    referenceUrls,
  );
  const summary = pbjSlides.find((slide) => slide.template === 'summary');
  assert.equal(summary.content.jobAid.href, '/training/pb-and-j/job-aid');
});

test('ungraded practice has distinct choices and explanatory feedback for every response', () => {
  const practice = pbjSlides.filter((slide) => slide.template === 'practice');
  assert.equal(practice.length, 1);
  for (const slide of practice) {
    const { prompt, situation, options } = slide.content;
    assert.ok(prompt && situation);
    assert.ok(options.length >= 3);
    assert.equal(
      new Set(options.map((option) => option.id)).size,
      options.length,
    );
    assert.equal(options.filter((option) => option.correct).length, 1);
    assert.ok(options.every((option) => option.text && option.outcome));
    assert.equal('required' in slide.content, false);
    assert.equal('passingPercent' in slide.content, false);
  }
});

test('interactive chapters preserve all 11 destinations and contain usable activity data', () => {
  const slides = pbjSlides.slice(8, 19);
  assert.deepEqual(
    slides.map((s) => s.id),
    [
      'ingredient-families',
      'choose-bread',
      'choose-spreads',
      'read-labels',
      'resolve-uncertainty',
      'know-the-recipient',
      'cross-contact',
      'dedicated-utensils',
      'handwashing-start',
      'handwashing-finish',
      'wash-again',
    ],
  );
  assert.equal(new Set(slides.map((s) => s.template)).size, 5);
  for (const slide of slides) {
    assert.equal(slide.layout, 'template');
    const c = slide.content;
    assert.ok(c.activityId);
    const items = c.targets ?? c.items ?? c.steps ?? c.stages ?? [];
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
    for (const item of items) {
      assert.ok(item.label && item.text);
      if (item.visual) assert.ok(item.visual.art && item.visual.description);
      if (c.targets)
        assert.ok(item.x >= 0 && item.x <= 100 && item.y >= 0 && item.y <= 100);
      if (c.categories)
        assert.ok(
          c.categories.some((category) => category.id === item.category) &&
            item.explanation,
        );
    }
    if (c.visual) assert.ok(c.visual.art && c.visual.description);
    if (c.decision) {
      assert.equal(c.decision.options.filter((o) => o.correct).length, 1);
      for (const option of c.decision.options) {
        assert.ok(option.text && option.outcome);
        assert.ok(slide.transcript.some((p) => p.includes(option.outcome)));
      }
    }
    assert.ok(slide.details.sources.length);
  }
});

test('text-led chapters preserve their twelve destinations and expose complete optional explanations', () => {
  const slides = pbjSlides.slice(19, 31);
  assert.deepEqual(
    slides.map((slide) => slide.id),
    [
      'station-layout',
      'surface-readiness',
      'tool-handling',
      'tool-care',
      'step-1-inspect',
      'step-2-bread',
      'step-3-peanut-butter',
      'step-4-fruit-spread',
      'step-5-close',
      'step-6-cut',
      'step-7-serve-reset',
      'barrier-method',
    ],
  );
  assert.equal(new Set(slides.map((slide) => slide.template)).size, 5);
  for (const slide of slides) {
    assert.equal(slide.layout, 'template');
    assert.ok(slide.template.startsWith('text-'));
    assert.equal(
      new Set(slide.content.sections.map((part) => part.id)).size,
      slide.content.sections.length,
    );
    for (const part of slide.content.sections) {
      assert.ok(part.title && part.text);
      assert.ok(slide.transcript.join(' ').includes(part.text));
      for (const detail of part.more ?? []) {
        assert.ok(detail.title && detail.text);
        assert.ok(slide.transcript.join(' ').includes(detail.text));
      }
    }
  }
});

test('the Quality pilot preserves seven destinations and supplies complete evidence equivalents', () => {
  const slides = pbjSlides.slice(31);
  assert.deepEqual(
    slides.map((slide) => slide.id),
    [
      'final-inspection',
      'troubleshooting',
      'serve-or-pack',
      'variations',
      'store-ingredients',
      'reset-station',
      'method-recap',
    ],
  );
  assert.deepEqual(
    slides.slice(0, 6).map((slide) => slide.template),
    [
      'inspection',
      'before-after',
      'comparison-activity',
      'branching-case',
      'text-ledger',
      'before-after',
    ],
  );
  for (const slide of slides) {
    const text = slide.transcript.join(' ');
    if (slide.template === 'before-after') {
      for (const pair of slide.content.pairs) {
        for (const view of [pair.before, pair.after]) {
          assert.ok(view.art && view.description);
          assert.ok(text.includes(view.description));
        }
        assert.ok(text.includes(pair.explanation) && text.includes(pair.check));
      }
    }
    if (slide.template === 'inspection') {
      assert.ok(text.includes(slide.content.visual.description));
      assert.equal(
        slide.content.decision.options.filter((option) => option.correct)
          .length,
        1,
      );
      for (const point of slide.content.annotations) {
        assert.ok(
          point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100,
        );
        assert.ok(text.includes(point.text));
      }
      for (const option of slide.content.decision.options)
        assert.ok(text.includes(option.outcome));
    }
  }
});

test('every branch is reachable, has explanatory feedback, and terminates in a debrief', () => {
  const slide = pbjSlides.find((item) => item.template === 'branching-case');
  const { nodes, startNodeId } = slide.content;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  assert.equal(byId.size, nodes.length);
  const visited = new Set();
  function visit(id, ancestors = []) {
    assert.ok(byId.has(id), `Unknown branch destination ${id}`);
    assert.ok(!ancestors.includes(id), `Non-terminating cycle ${id}`);
    visited.add(id);
    const node = byId.get(id);
    if (node.kind === 'outcome') {
      assert.ok(node.text);
      return;
    }
    assert.ok(node.options.length >= 2);
    assert.equal(node.options.filter((option) => option.correct).length, 1);
    assert.equal(
      new Set(node.options.map((option) => option.id)).size,
      node.options.length,
    );
    for (const option of node.options) {
      assert.ok(option.text && option.outcome);
      assert.ok(slide.transcript.join(' ').includes(option.outcome));
      visit(option.nextNodeId, [...ancestors, id]);
    }
  }
  visit(startNodeId);
  assert.equal(visited.size, nodes.length);
});
