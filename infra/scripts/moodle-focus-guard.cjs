'use strict';
const assert = require('node:assert/strict');
const { expect } = require('../../web/node_modules/@playwright/test');

// ACT 6cfa84 excludes controls that immediately move focus elsewhere. Moodle's
// unanswered single-choice radio uses a jQuery focus listener that axe cannot
// classify statically. Prove the exact behavior; never disable the axe rule.
async function reviewMoodleFocusGuard(page, finding) {
  assert.ok(Array.isArray(finding.target) && finding.target.length === 1
    && typeof finding.target[0] === 'string', 'Only a single light-DOM target can be reviewed');
  const target = page.locator(finding.target[0]);
  assert.equal(await target.count(), 1, 'The finding must identify exactly one control');
  const shape = await target.evaluate(root => {
    const selector = 'div.qtype_multichoice_clearchoice[aria-hidden="true"]';
    const wrapper = root.matches(selector) ? root : root.parentElement;
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    require(wrapper?.matches(selector), 'Finding is not a Moodle clear-choice wrapper or its direct radio');
    const hidden = wrapper.querySelector('input[type="radio"][value="-1"][aria-hidden="true"]');
    require(hidden && (root === wrapper || root === hidden) && hidden.parentElement === wrapper,
      'Finding must be the exact clear-choice wrapper or sentinel');
    require(/^q\d+:\d+_answer$/.test(hidden.name) && hidden.id === `${hidden.name}-1`
      && wrapper.id === hidden.name.replace(/_answer$/, '_clearchoice') && wrapper.classList.contains('visually-hidden')
      && hidden.classList.contains('visually-hidden') && hidden.checked && !hidden.disabled,
    'Only an active unanswered Moodle sentinel can be reviewed');
    const descendants = [...wrapper.querySelectorAll('input,button,select,textarea,a[href],[tabindex]')];
    require(descendants.length === 2 && descendants.includes(hidden)
      && descendants.every(node => node === hidden || (node.matches('a[role="button"]') && node.tabIndex === -1)),
    'Unexpected interactive content in the hidden wrapper');
    const question = wrapper.closest('.que.multichoice');
    const answers = question && [...question.querySelectorAll('.answer input[type="radio"]')];
    require(answers?.length === 4 && answers.every(answer => answer.name === hidden.name
      && !answer.checked && !answer.disabled && answer.getClientRects().length > 0
      && !answer.closest('[aria-hidden="true"],[inert]')), 'Expected four visible unanswered radios in the same group');
    require(hidden.form && hidden.form === question.closest('form') && answers.every(answer => answer.form === hidden.form),
      'The radio group must belong to the native attempt form');
    return { sentinelId: hidden.id, firstAnswerId: answers[0].id };
  });
  for (const check of [...(finding.any || []), ...(finding.all || []), ...(finding.none || [])]) {
    assert.ok(['focusable-disabled', 'focusable-not-tabbable', 'focusable-modal-open'].includes(check.id),
      'An unknown accessibility check cannot be reviewed');
    for (const related of check.relatedNodes || []) {
      assert.ok(Array.isArray(related.target) && related.target.length === 1 && typeof related.target[0] === 'string');
      const relatedNode = page.locator(related.target[0]);
      assert.equal(await relatedNode.count(), 1);
      assert.equal(await relatedNode.evaluate((node, id) => node.id === id, shape.sentinelId), true,
        'Every related focusable node must be the exact sentinel');
    }
  }
  const sentinel = page.locator(`[id=${JSON.stringify(shape.sentinelId)}]`);
  const first = page.locator(`[id=${JSON.stringify(shape.firstAnswerId)}]`);
  const snapshot = () => sentinel.evaluate(hidden => {
    const radios = [...hidden.form.querySelectorAll('.que.multichoice input[type="radio"]')];
    const values = new FormData(hidden.form);
    return JSON.stringify(radios.map(radio => [radio.id, radio.checked, radio.disabled]))
      + JSON.stringify([...new Set(radios.map(radio => radio.name))].map(name => values.getAll(name)));
  });
  const before = await snapshot();
  const probe = await sentinel.evaluate(hidden => {
    const first = hidden.closest('.que.multichoice').querySelector('.answer input[type="radio"]');
    first.focus();
    const events = [];
    const listener = event => events.push(event.target.id);
    document.addEventListener('focus', listener, true);
    try {
      const started = performance.now(); hidden.focus();
      return { events, elapsedMs: performance.now() - started, redirected: document.activeElement === first };
    } finally { document.removeEventListener('focus', listener, true); }
  });
  assert.deepEqual(probe.events, [shape.sentinelId, shape.firstAnswerId], 'Actual focus must enter and leave the sentinel');
  assert.ok(probe.redirected && probe.elapsedMs < 1000, 'Focus must immediately move to the first visible answer');
  await first.focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await first.evaluate(node => document.activeElement === node), false, 'Backward Tab must leave the answer');
  await page.keyboard.press('Tab'); await expect(first).toBeFocused({ timeout: 1000 });
  assert.equal(before === await snapshot(), true, 'Focus and keyboard entry must not change any response');
  return { target: finding.target, ...shape, elapsedMs: probe.elapsedMs, keyboardTabRedirect: true,
    responsesUnchanged: true, disposition: 'ACT 6cfa84 immediate focus redirection; screen-reader review remains required' };
}
module.exports = { reviewMoodleFocusGuard };
