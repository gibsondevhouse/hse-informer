# Beta accessibility evidence

The portal browser suite runs axe checks on the administrator, learner, profile and record workflows. The native Moodle practice rehearsal checks the three lessons on phone/desktop and the first assessment page, then uses keyboard responses and navigation through failed, resumed and passed attempts. These are synthetic checks. Manual keyboard/screen-reader testing on the chosen company environment remains a release gate.

## Native Moodle clear-choice controls

The Moodle 5.3 rehearsal initially reported two `aria-hidden-focus` findings on the first assessment page. Moodle's [single-choice renderer](https://github.com/moodle/moodle/blob/v5.3.0/public/question/type/multichoice/renderer.php) adds a hidden radio representing an unanswered question, and its [clear-choice module](https://github.com/moodle/moodle/blob/v5.3.0/public/question/type/multichoice/amd/src/clearchoice.js) moves focus from that radio to the first visible answer. The installed axe engine's static check does not recognize that event listener. Actual node identity and behavior must be verified before treating a finding as a focus guard.

[W3C ACT rule 6cfa84](https://www.w3.org/WAI/standards-guidelines/act/rules/6cfa84/#focusable) excludes an element that loses focus within one second without further user interaction; its passed example 4 demonstrates a focus guard. The practice verifier applies that narrow disposition only on the native Quiz attempt screen and only when all of these checks pass:

- The finding and its related nodes resolve to exactly the expected hidden clear-choice wrapper/radio, with four visible unanswered radios in the same group and no other hidden tabbable control.
- Captured focus events prove that focus enters the hidden radio and immediately leaves for the same question's first visible answer, within one second.
- Actual backward/forward Tab navigation returns to that visible answer, and neither focus nor keyboard entry changes the responses or submitted group values.

The verifier changes no Moodle markup, focus behavior or answer state. It keeps the raw findings, selectors, check IDs, actual axe version and runtime disposition in the evidence artifact. Any other finding or failed focus proof remains fatal. Local browser regression checks also reject a missing redirect listener, unexpected hidden control, broad ancestor, unrelated target and multi-part selector. A local regression result does not establish the real Moodle run's result; use the linked CI evidence on the draft pull request.

## Remaining acceptance

Check the approved course's full lessons, assessment feedback, retry, resume and completion history with keyboard and a supported screen reader on company IT's deployed environment. Include mobile reflow and any company theme or proxy changes. Record the tester, browser/assistive technology, findings and fixes. The synthetic focus-guard disposition does not close this human test or establish WCAG conformance for every Moodle course.
