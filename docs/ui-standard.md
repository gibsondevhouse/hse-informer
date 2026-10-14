# HSE Informer UI standard

This is the product UI contract for the React pilot and the SvelteKit replacement. The React admin workspace now takes its visual language from the PBJ-101 course player: graphite surfaces, indigo actions, Inter typography, subtle borders, and compact raised controls. The maintained values live in `ui/tokens.css` as `--hse-night-*` tokens and are also used by the player. The SvelteKit replacement still uses the light HSE tokens while its behavior and release gates are developed; that difference is explicit during parity work.

## Visual foundations

- Use Inter and the PBJ-101 graphite/indigo palette in the React admin, qualifications, and learner workspace. Use the same `--hse-night-*` color values as the course player: a near-black frame, raised panels, hairline dividers, indigo actions, and readable neutral text. The SvelteKit workspace currently uses Source Sans 3 and the light HSE palette. Do not use color alone to identify a state.
- Use the 4px spacing scale, the tokenized card/control radii, and the 44px default control height. Keep touch controls at least 48px when a coarse pointer is detected. The compact 36px size is for dense, non-touch controls only.
- The course player keeps its own layout and interaction rules, but shares the React workspace's visual foundations. Its full-height lesson shell and browser-local practice state must not leak into the admin workspace.
- Use the same responsive intent in both apps: preserve primary actions and readable cards at phone widths, let wide data tables scroll, and avoid horizontal overflow of the page itself. Treat 320px, 390px, 768px, and desktop widths as review points.
- Prefer outlined SVG icons with an accessible name where the icon is the only label. Decorative icons are hidden from assistive technology.

## Core patterns

| Pattern | Contract |
|---|---|
| App shell | Identical hierarchy: product/tenant identity, primary navigation, current page, content. The main content has a skip target. |
| Page heading | One `h1`, a short purpose sentence, and one primary action when the user can take it. |
| Button | Primary for the next task, secondary for alternatives, text for navigation. Disabled actions explain the prerequisite nearby. |
| Field | Visible label, help or error close to the control, server-side validation, and a visible focus ring. |
| Status badge | Text plus semantic color. Keep requirement review, training progress, evidence, and authorization as separate concepts. |
| Card and table | Use the same surface, border, spacing, and typography tokens. Tables expose column headings and sort state. |
| Dialog or drawer | Named dialog, initial focus inside, Tab contained, Escape closes, and focus returns to the trigger. Background content is inert while open. |
| Empty, loading, error | Say what happened and provide the next available action. Use live status or alert semantics where appropriate. |

React and Svelte implement their own components, consume the same token source, and follow these behaviors. Visual parity between the React pilot and SvelteKit replacement remains a separate release check. New screens should reuse local components before adding a one-off visual rule.

## Status language

| Axis | User-facing labels | Meaning |
|---|---|---|
| Assignment | Not started, In progress, Knowledge complete, Overdue, Needs review, Closed | Progress or exception for the assignment. |
| Requirement review | Unapproved, Approved | HSE approval of an exact requirement version. |
| Site instruction | Pending, Satisfied, Not satisfied, Revoked | Site-specific evidence and employee acknowledgement where required. |
| Practical evaluation | Pending, Satisfied, Not satisfied, Revoked | Qualified evaluator's separate record. |
| Authorization | Pending, Authorized, Restricted authorization, Revoked | Explicit employer decision for a defined scope. |
| Delivery | Draft, Pending enrollment, Enrolled, Failed, Needs review | Integration state, separate from knowledge progress. Draft means the course is not released. |

Stored values and external service payloads may use different casing or machine keys. Translate them at the UI boundary; do not rename persisted values solely for presentation. A knowledge completion must never appear as a workplace authorization.

## Stability gate

Use deterministic synthetic records for browser checks. Cover the React admin, PBJ-101 visual reference, assignment filters/table, learner/course preview, and dialogs at desktop and phone widths, plus a tablet layout check. Validate focus order and dialog keyboard behavior. Record screenshots in CI on a pinned browser/runtime so visual changes require review. The protected D1/Access pilot also needs a provisioned browser review before release. The screenshots are UI fixtures, never evidence of training completion or HSE approval.

The two applications remain visible during parity work. React is the pilot reference; SvelteKit becomes the replacement only after the behavior and evidence gates in `docs/refactor-001.md` are met.
