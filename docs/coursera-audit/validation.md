# Reference package validation

September 7, 2026 · Local Codex Chromium browser · Windows

This record validates the documentation and its local interaction examples. It is not a WCAG conformance certificate or an acceptance test of a production HSE app.

## Completed checks

| Check | Result |
|---|---|
| Reference package integrity | HTML IDs, local links and anchors, JSON parsing, token references, PNG integrity, and unresolved build markers checked by `validate-package.py`; machine-readable results and SHA-256 manifest in [qa/integrity.json](qa/integrity.json). |
| Component coverage | 32 distinct component contracts, each with coverage, evidence, anatomy, states, behavior, and accessibility notes. Unobserved HSE extensions explicitly labelled. |
| Token coverage | 73 proposed HSE variables; measured Coursera values stored separately in [design-tokens.json](design-tokens.json). |
| Contrast | 16 calculated pairs: 14 pass their stated thresholds. Two pale Coursera borders fail 3:1 when treated as an essential cue; they are restricted to decorative use. Proposed HSE control borders and semantic text pairs pass. See [contrast-results.json](contrast-results.json). |
| Responsive guide | Checked at 1440, 1024, 768, 390, and 320 CSS pixels. No document-level horizontal overflow; one H1, 32 rendered contracts, local font loaded, and no broken loaded images. See [qa/browser-checks.json](qa/browser-checks.json). |
| Search and recovery example | A nonmatching query shows the distinct empty state; Clear search restores the sample catalog. |
| Staged filter example | Applying PPE yields one course and count 1. Cancelling a draft second selection with Escape preserves applied PPE and returns focus to the trigger. |
| Dialog keyboard behavior | Forward and reverse Tab remain within the dialog; Escape closes and restores trigger focus. An explicit focus loop was added after the initial native-dialog check exposed browser-chrome traversal. Final drawer checks confirm 320px full-width mobile and 360px desktop layouts with background scroll locked; see [qa/final-dialog-checks.json](qa/final-dialog-checks.json). |
| Form feedback | Blank submission sets a linked error and `aria-invalid`, focuses the required field, and preserves input. A valid title clears the error and announces the local example result. |
| Tabs and record preview | ArrowRight moves tab focus without activation; Enter activates the chosen panel. Record preview closes with Escape and restores its trigger. |
| Component search | A nonmatching query shows zero contracts and a recovery message; clearing restores all 32. |
| Visual review | Desktop and narrow layouts, long labels, cards, typography, dialogs, and selected source captures reviewed. Screenshots are in [qa](qa). |
| JavaScript | `node --check style-guide.js` validates syntax. The guide requires no framework or external service. Font, styles, scripts, and images are bundled locally. |

The Coursera audit sampled search at 1440, 768, 390, and 320 CSS pixels and detail at desktop and 390px. Browser screenshots can omit a scrollbar or be scaled relative to the CSS viewport; crop dimensions are not layout measurements. Personal headings were excluded from the dashboard and learning evidence. Fixed overlays were retained as full frames or a nonpersonal submenu so their controls remain visible. The guide was verified through a loopback HTTP preview. Direct file navigation was blocked by the browser tool's URL policy, so direct-file execution was not browser-tested.

## Production checks still required

- Full keyboard and screen-reader journeys with NVDA and VoiceOver, including status updates and dialogs during asynchronous requests.
- Actual 200% browser zoom, real mobile touch, coarse pointers, and responsive checks with production content and translations.
- Rendered contrast across every state, image background, validation message, and theme. Dark mode was not specified or audited.
- Loading, offline, denied, stale, retry, partial failure, save conflicts, upload failure, and accessible assessment timing.
- Server-confirmed qualification transitions, permission checks, exact course and addendum versions, and immutable signed evidence.
- Representative worker, supervisor, and evaluator usability sessions. Verify they can explain the difference between knowledge completion and authorization and find their next required step.

The evidence supports traceable design decisions. It does not establish market conversion gains, universal user preference, legal compliance, or the accessibility of untested Coursera surfaces.

## Rebuild

Run `python build-data.py`, then `python build-guide.py`, then `python validate-package.py` from this directory. The validation script uses Pillow to verify PNGs. Run `node --check style-guide.js` after JavaScript changes. Refresh the browser before reviewing edited files.
