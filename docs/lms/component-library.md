# HSE Informer learning player and component library

**Status:** learner practice course and separate author lab · **Learner route:** `/training/pb-and-j` · **Author lab:** `/training/pb-and-j/component-lab` · **Code:** `admin-app/lib/lms/`, `admin-app/components/lms/`

The library is a reusable shell for course playback. A course is plain serializable data; the player renders it, grades interactions, tracks progress, and persists state. PBJ-101 presents a complete 15-lesson learner path with a printable job aid. The separate author lab retains the component catalog and media placeholders to exercise all 33 block types. Neither route is part of the assignable HSE course library or creates a training record.

## Research basis

| Source | What it contributed |
|---|---|
| [xAPI specification, interaction activities](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md) (ADL; based on SCORM 2004 `cmi.interactions`) | The graded interaction taxonomy and response formats: true-false, choice (single and multiple), fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other. Each graded block records the xAPI type it would emit (`xapiInteractionType`). |
| [H5P content types](https://h5p.org/content-types-and-applications) | Presentation and disclosure families in common authoring tools: accordion, dialog/flash cards, image hotspots, timeline, sort the paragraphs, drag and drop, fill in the blanks, branching scenario, questionnaire, interactive book, documentation tool. |
| [WCAG 2.2 · 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Every interaction that authoring tools usually implement with drag-and-drop (sequencing, sorting, matching, hotspots) is implemented here with single-pointer alternatives: move up/down buttons, selects, and a list equivalent to positioned markers. |
| [WCAG 2.2 · 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Knowledge-check feedback, hotspot details, submission confirmations, and completion announcements are rendered in `output` elements (implicit `role="status"`) so assistive technology hears them without a focus change. |
| [CDC · About Handwashing](https://www.cdc.gov/clean-hands/about/index.html), [FDA · Food Allergies](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies), [FDA Food Code 2026](https://www.fda.gov/food/fda-food-code/food-code-2026) | Factual basis for the practice content: the five handwashing steps and key times to wash, the nine major U.S. food allergens, and the model retail food code. |

## Block catalog

Every block carries an optional `devNote`. In the author lab, the **Component notes** switch reveals the block type and note above each block. Author controls and placeholder media do not appear in the learner course.

### Content blocks (presentational)

| Block | Purpose | Notes |
|---|---|---|
| `heading` | Section heading, level 2 or 3, optional kicker | The player owns the single `h1` per view. |
| `paragraph` | Body text; `lead` / `body` / `muted` variants | Reading width is capped at 68ch. |
| `callout` | `info`, `tip`, `note`, `warning`, `danger`, `success` | Mapped to HSE semantic tokens; `info`/`tip`/`note` carry `role="note"`. |
| `objectives` | Learning outcomes list | Reserved for outcomes, not general lists. |
| `list` | `bullet`, `numbered`, `check` | Static; the interactive version is `checklist`. |
| `keyTakeaways` | Summary cards | Title plus one sentence per card. |
| `definition` | Single term with definition and example | Renders as a `dl`. |
| `glossary` | Several terms inline | The course-level glossary opens from the toolbar. |
| `figure` | Inline SVG illustration with required alt and optional caption | Illustration ids are typed; art lives in `illustrations.tsx`. |
| `media` | Video or audio placeholder with duration, captions flag, and transcript | A real player would mount in the frame; the transcript disclosure stays. |
| `steps` | Numbered procedure with optional caution per step | |
| `timeline` | Labeled events | Labels are free text. |
| `table` | Captioned data table | `scope="col"` headers and `scope="row"` first cells. |
| `resource` | Job aid or link with format label | Without `href` it renders as a placeholder. |
| `references` | External links | Open in a new tab with `rel="noopener noreferrer"`. |
| `divider` | Slide break | Ends the current slide; renders nothing. |

### Disclosure blocks (progressive reveal, ungraded)

| Block | Pattern | Accessibility |
|---|---|---|
| `accordion` | Base UI Accordion, several panels open at once | Triggers are buttons with `aria-expanded`. |
| `tabs` | Base UI Tabs, line variant | `tablist` / `tab` / `tabpanel`; arrow keys move between tabs. |
| `flashcards` | Grid of toggle buttons | `aria-pressed`; the visible face is prefixed Front/Back; reset control. |
| `hotspots` | Numbered markers positioned by percentage over an illustration, plus an equivalent list | Markers and list items are buttons with `aria-expanded` / `aria-controls`; the detail panel is an `output`. |

### Activity blocks (ungraded learner input)

| Block | Stored state | Completion rule |
|---|---|---|
| `checklist` | Checked item indices | Required only when `required: true`; then every item must be checked. |
| `reflection` | Free text | Required only when `required: true`; then `minLength` (default 1) applies. xAPI analogue: `long-fill-in`. |
| `survey` | Selected scale point | Never required; never graded. xAPI analogue: `likert`. |
| `attestation` | Trimmed name and ISO timestamp | Required by default; `requiresName` demands a non-empty name. Stored in the browser only and labelled as not a training record. |

### Interaction blocks (graded)

| Block | xAPI type | Response shape | Grading | Non-drag input |
|---|---|---|---|---|
| `multipleChoice` | `choice` | option id | exact match; per-option feedback | radio group |
| `multipleResponse` | `choice` | option ids | partial credit `(hits − misses) / expected`, floored at 0 | checkboxes in a fieldset |
| `trueFalse` | `true-false` | boolean | exact match | radio group |
| `fillBlank` | `fill-in` | string | whitespace collapsed; case-insensitive unless `caseSensitive` | inline text input |
| `numeric` | `numeric` | number | `min ≤ value ≤ max` | number input with unit |
| `matching` | `matching` | left id → right id | partial credit by pair | one select per left item; right options shuffled by block id |
| `sequencing` | `sequencing` | ordered ids | partial credit by position | move up/down buttons; initial order shuffled and never equal to the key |
| `sorting` | `matching` | item id → category id | partial credit by item | one select per item plus a read-only bucket summary |
| `scenario` | `choice` | option id | the option flagged `correct`; feedback is that option's `outcome` | radio group; other outcomes revealed after checking |

A result is **correct** only at full credit. Partial scores feed the assessment percentage.

## Player contracts

**Slides.** A lesson is presented one slide at a time. `lessonSlides(lesson)` derives the slides from the flat block list, so authors never maintain two structures: a `heading` starts a new slide, a `divider` forces a break, every interaction or activity stands on its own slide (keeping a heading placed directly above it), and other content fills a slide up to a visual budget of 5 (paragraph, callout, definition, resource, references = 1; lists, objectives, key takeaways, glossary, figure, media, steps, accordion, tabs, flashcards = 2; table, timeline, hotspots = 3). Block order is preserved. Next and Back step through slides and cross lesson boundaries; the completion control appears on the last slide, where the requirements panel links to any slide that still needs attention. The current slide index is part of `PlayerState` so a learner resumes where they stopped.

**Modes.** Interactions render in one of three modes: `lesson` (formative: Check answer, feedback, Try again), `exam` (inputs only, no feedback), and `review` (read-only with feedback and correct answers revealed).

**Lesson completion** requires engagement, not correctness. Each interaction with `required !== false` must be checked; required checklists, reflections, and attestations must be satisfied. The requirements panel lists each item and its state.

**Linear navigation** (default on) locks a lesson until every earlier lesson is complete and locks the assessment until every lesson is complete. The author lab can turn it off to inspect any block; the learner course follows the lesson order.

**Assessment.** Questions are shuffled per attempt with a stored seed so an attempt can be replayed. Unanswered questions score zero. Attempts are capped by `maxAttempts`; after submission the player shows the score, pass/fail against `passingPercent`, and a per-question review. A sequencing question counts as answered as soon as it is shown, because its displayed order is a valid response.

**Course status** is `not-started`, `in-progress`, or `knowledge-complete` (every lesson complete and at least one passing attempt). This vocabulary matches the admin app's "Knowledge Complete" and deliberately stops short of any authorization claim.

**State and persistence.** `PlayerState` is a plain object owned by `reducePlayer`. The player stores it in `localStorage` under `hse-lms-preview-<courseId>-<version>-v2` and only restores snapshots that pass `isPlayerState`, which checks the shape and that every referenced lesson exists in the current course. The learner route has a confirmed reset action; the author lab retains its development toggles.

**Focus and announcements.** Changing view or lesson scrolls the main region to the top and moves focus to the view heading; changing slides within a lesson focuses the slide region, which is labelled "Slide n of m" with the slide's heading. Lesson completion, submission, and reset are announced through a visually hidden `output`.

**Theming.** All styles use the `.lms-` prefix and `--lms-*` custom properties, with a dark theme on `data-theme="dark"` that shares the learner theme preference key with the Respiratory preview. Base UI primitives are re-themed through the same variables.

## Authoring a course

1. Create a `Course` object (see `lib/lms/schema.ts`). Give every interaction, activity, and hotspots block a unique `id`; author `sequencing` items in the correct order.
2. Add tests like `tests/pbj-course.test.mjs` to assert unique ids, valid answer references, hotspot bounds, and https links.
3. Render `<CoursePlayer course={course} />` from a route. The player needs nothing else.

## Deferred

- Real media files and a captioned player inside the `media` frame.
- xAPI statement emission; the type mapping and response shapes are ready.
- Server-side persistence, identity, and a true training record. Progress is browser-local by design.
- An authoring interface. Courses are TypeScript data checked by tests.
- Timed assessments, question pools, and randomized distractor order for choice questions.
