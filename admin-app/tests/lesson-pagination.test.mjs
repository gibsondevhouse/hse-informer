import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement, Children, isValidElement } from 'react';
import ts from 'typescript';

const source = readFileSync(
  new URL('../components/split-lesson-block.tsx', import.meta.url),
  'utf8',
);
const compiled = ts
  .transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(
    /from ['"]react['"]/,
    `from ${JSON.stringify(import.meta.resolve('react'))}`,
  );
const { splitLessonBlock, refineLessonBlock } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const textOf = (node) =>
  typeof node === 'string'
    ? node
    : isValidElement(node)
      ? Children.toArray(node.props.children).map(textOf).join(' ')
      : '';
const wordsOf = (nodes) => nodes.map(textOf).join(' ').trim().split(/\s+/);

test('oversized reading blocks subdivide without losing or reordering words', () => {
  const note = createElement(
    'p',
    { className: 'rp-note' },
    createElement('strong', {}, 'Important guidance'),
    'Keep all of these words in their original order while making smaller reading pages.',
  );
  assert.deepEqual(wordsOf(refineLessonBlock(note, 4)), wordsOf([note]));
  assert.ok(refineLessonBlock(note, 4).length > 2);
  assert.equal(splitLessonBlock(createElement('p', {}, 'Single')).length, 1);
});

test('continued answer blocks retain a radio and the full accessible answer', () => {
  const answer =
    'Stop the task and report the failed exhaust before work resumes.';
  const radio = createElement('input', {
    type: 'radio',
    value: 'stop',
    'aria-label': answer,
  });
  const label = createElement(
    'label',
    { className: 'rp-option' },
    radio,
    createElement('span', {}, createElement('strong', {}, 'C.'), ` ${answer}`),
  );
  const parts = splitLessonBlock(label);
  assert.equal(parts.length, 2);
  for (const part of parts)
    assert.equal(
      Children.toArray(part.props.children)[0].props['aria-label'],
      answer,
    );
  assert.deepEqual(
    parts.flatMap((part) =>
      wordsOf([Children.toArray(part.props.children).at(-1)]).slice(1),
    ),
    answer.split(' '),
  );
});
