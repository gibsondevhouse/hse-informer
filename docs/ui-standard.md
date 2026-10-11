# HSE Informer UI standard

This is the product UI contract for the React pilot and the SvelteKit replacement. The audited reference in `docs/coursera-audit/` explains the origin of the visual choices. The maintained product tokens live in `ui/tokens.css`.

## Visual foundations

- Use Source Sans 3 for the admin and learner workspace. Use the light HSE blue and neutral palette in the shared tokens: blue for actions and links, neutral surfaces for records, and semantic colors for status. Do not use color alone to identify a state.
- Use the 4px spacing scale, the tokenized card/control radii, and the 44px default control height. Keep touch controls at least 48px when a coarse pointer is detected. The compact 36px size is for dense, non-touch controls only.
- The course lesson/player may keep its scoped dark theme. Its navigation, focus, and status wording must follow this contract. Dark player rules must not leak into the workspace.
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

React and Svelte implement their own components, but consume the same token source and follow these behaviors. New screens should reuse local components before adding a one-off visual rule.

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

Use deterministic synthetic records for browser checks. Cover overview, assignment filters/table, learner/course preview, and dialogs at desktop and phone widths, plus a tablet layout check. Validate focus order and dialog keyboard behavior. Record screenshots in CI on a pinned browser/runtime so visual changes require review. The screenshots are UI fixtures, never evidence of training completion or HSE approval.

The two applications remain visible during parity work. React is the pilot reference; SvelteKit becomes the replacement only after the behavior and evidence gates in `docs/refactor-001.md` are met.
