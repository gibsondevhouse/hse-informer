'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('../../web/node_modules/@playwright/test');
const { default: AxeBuilder } = require('../../web/node_modules/@axe-core/playwright');
const { reviewMoodleFocusGuard } = require('./moodle-focus-guard.cjs');

async function fixture(browser, redirect = true, extra = '') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html lang="en"><title>Focus guard fixture</title>
    <style>.visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden;
      clip:rect(0,0,0,0); white-space:nowrap; }</style>
    <main><form><button type="button" id="previous">Previous</button><div class="que multichoice">
    <fieldset><legend>Practice question</legend><div class="answer">
    ${[0, 1, 2, 3].map(i => `<label>Option ${i}<input type="radio" id="q1:1_answer${i}" name="q1:1_answer" value="${i}"></label>`).join('')}
    </div><div id="q1:1_clearchoice" class="qtype_multichoice_clearchoice visually-hidden" aria-hidden="true">
      <input type="radio" value="-1" name="q1:1_answer" id="q1:1_answer-1" class="visually-hidden" aria-hidden="true" checked>
      <label for="q1:1_answer-1"><a href="#" role="button" tabindex="-1">Clear my choice</a></label>${extra}
    </div></fieldset></div><button type="button" id="next">Next</button></form></main></html>`);
  if (redirect) await page.evaluate(() => document.getElementById('q1:1_answer-1').addEventListener('focus', () =>
    document.getElementById('q1:1_answer0').focus()));
  const report = await new AxeBuilder({ page }).withRules(['aria-hidden-focus']).analyze();
  assert.equal(report.violations.length, 1); assert.equal(report.violations[0].nodes.length, 1);
  return { page, node: report.violations[0].nodes[0] };
}

test('focus-guard disposition proves behavior and rejects broader exceptions', async t => {
  const browser = await chromium.launch({ headless: true });
  try {
    await t.test('real axe finding is retained and exact focus redirection passes without selecting an answer', async () => {
      const { page, node } = await fixture(browser);
      try {
        const proof = await reviewMoodleFocusGuard(page, node);
        assert.equal(proof.keyboardTabRedirect, true); assert.equal(proof.responsesUnchanged, true);
        assert.equal(await page.locator('.answer input:checked').count(), 0);
      } finally { await page.close(); }
    });
    await t.test('a hidden radio without its focus handler remains a failure', async () => {
      const { page, node } = await fixture(browser, false);
      try { await assert.rejects(reviewMoodleFocusGuard(page, node), /Actual focus must enter and leave/); }
      finally { await page.close(); }
    });
    await t.test('an extra tabbable control or broad ancestor cannot be reviewed', async () => {
      const { page, node } = await fixture(browser, true, '<button type="button">Unexpected control</button>');
      try {
        await assert.rejects(reviewMoodleFocusGuard(page, node), /Unexpected interactive content/);
        await assert.rejects(reviewMoodleFocusGuard(page, { ...node, target: ['form'] }), /not a Moodle/);
      } finally { await page.close(); }
    });
    await t.test('foreign related targets and multi-part targets cannot be reviewed', async () => {
      const { page, node } = await fixture(browser);
      try {
        await assert.rejects(reviewMoodleFocusGuard(page, { ...node,
          all: [{ id: 'focusable-disabled', relatedNodes: [{ target: ['#previous'] }] }] }), /exact sentinel/);
        await assert.rejects(reviewMoodleFocusGuard(page, { ...node, target: ['iframe', node.target[0]] }), /single light-DOM/);
      } finally { await page.close(); }
    });
  } finally { await browser.close(); }
});
