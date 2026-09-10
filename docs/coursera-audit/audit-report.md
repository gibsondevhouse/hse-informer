# Coursera UI/UX audit and HSE Informer style guide

**Version 1.0 · September 7, 2026 · Prepared for HSE Informer, a web app**

## 1. Design decision

Use Coursera's clear content hierarchy, search-led discovery, reusable cards, calm neutral surfaces, and visible provider attribution as the visual benchmark. Adopt a light interface with blue actions, a humanist sans serif, generous control targets, and compact content groups. Add the explicit qualification stages, applicability, version history, and evidence workflows required by HSE Informer's existing product vision.

This is a complete **v1 implementation reference for the scoped HSE app**, with a bounded audit of Coursera. It is not a claim that every Coursera page, account state, brand token, or accessible interaction has been reverse engineered. “Defensible against market expectations” here means traceable to observed product conventions and published interface standards, with testable HSE decisions. It does not establish customer preference, legal compliance, or improved conversion without further testing.

The [existing vision](../vision/phases.txt) establishes a training-management product with site qualification and retained evidence. Its UI contract has **five distinct milestones**: Knowledge Complete, Site Training Complete, Practical Evaluation Passed, Authorized / Qualified, and External Credential Verified. The source's heading says four while its table lists five; this guide preserves all five meanings. These are not universally sequential requirements: the applicability model determines which are required, and an external credential can be an alternate prerequisite.

## 2. Method, scope, and confidence

Inspection used the live, already signed-in Coursera browser tab, screenshots, rendered DOM/computed CSS, selected keyboard interactions, and public web retrieval. No enrollment, assessment, purchase, account preference, or stored learning record was changed. The original homepage and normal viewport were restored. Search queries and filter URLs were used as ordinary navigation.

**Evidence labels:** M = measured computed CSS or geometry; O = observed visual/interaction behavior; R = recommended for HSE Informer; U = unverified. Coursera's class names and computed values are not evidence of its internal token names. Screen appearance can vary with account, region, content, A/B tests, hydration, and viewport. Measurements use CSS pixels; the Windows scrollbar occupied 15px in several captures.

| Surface | Coverage | Evidence |
|---|---|---|
| Signed-in homepage | Desktop recommendations, chips, notice, carousel, provider identities | E01; measured |
| Global navigation | Desktop mega menu; mobile nested navigation; Escape dismissal | E02, E09 |
| Search | Suggestions, standard query, result cards, desktop/tablet/mobile layouts | E03, E04, E07, E10, E11 |
| Filters | Drawer, accordion, radio, checkbox, count, active filter, URL persistence; Escape | E05, E06, E08; interaction JSON |
| Course detail | Header, breadcrumb, promotion, CTA, summary facts, sticky section navigation, assistant rail | E12, E12a, E15 |
| Syllabus and FAQ | Expansion, headings, supporting facts, complementary provider panel | E13, E14 |
| My Learning | Empty state, tab roles, keyboard arrow movement, focus appearance | E17; measured |
| Search recovery probe | One deliberately unmatched query; broad results returned | E16 |
| Anonymous homepage | Public text/structure only, via web retrieval | S01; no anonymous CSS measurements |
| edX and FutureLearn | Public content/structure benchmark only | S02–S03; not full visual audits |
| Auth, payment, learner player, assessments, populated records, admin, dark mode | Not exercised | U; HSE contracts are recommendations |

Responsive samples: **1440 × 1000**, **768 × 1024**, **390 × 844**, **320 × 800**. Search was measured at all four. Course detail was measured at desktop and 390px. These are viewport samples, not extracted production breakpoint definitions. True device touch, 200% browser zoom, assistive-technology speech output, and constrained networks remain release tests.

## 3. What the market evidence supports

| Decision | Evidence | HSE application | Confidence / limit |
|---|---|---|---|
| Offer search alongside topic browsing | Coursera live; [USWDS Search](https://designsystem.digital.gov/components/search/) | Persistent catalog search with descriptive accessible name and preserved query | High for a substantial catalog; validate vocabulary with workers |
| Use consistent summaries with named providers | Coursera cards; [edX](https://www.edx.org/) and [FutureLearn](https://www.futurelearn.com/) identify institutions and course types | Show owner/provider, scope, delivery format, version, and duration | Repeated category convention; no conversion claim |
| Explain what a learner receives before commitment | Coursera detail; FutureLearn distinguishes access tiers and certificates | State knowledge, site, practical, and authorization outcomes before starting | Strong content convention; HSE semantics come from product vision |
| Use progressive disclosure for secondary material | Coursera syllabus, FAQs, filters | Reveal module content, optional details, and filter groups | Observed; never hide a blocking qualification requirement |
| Use tables for cross-person record comparison | [USWDS Card](https://designsystem.digital.gov/components/card/) and [Table](https://designsystem.digital.gov/components/table/) | Learner catalog uses cards; evaluator records use semantic tables | Published pattern guidance, not evidence that Coursera has this admin UI |
| Make accessibility a design baseline | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and WAI patterns | Define release gates per component | Standards basis; conformance requires the final product to be tested |

edX and FutureLearn reinforce categorization, institutional trust, career/learning outcomes, and explicit course/program distinctions. Their marketing pages do not prove how frontline workers behave or establish HSE enterprise workflow expectations. No market percentile, usability score, or fabricated user research is assigned.

## 4. Findings and priorities

Priorities below describe **HSE design consequences**, not verified financial impact on Coursera. P1 is a potential task/access barrier; P2 is meaningful friction; P3 is polish. An observed issue is not automatically a WCAG failure.

| ID | Finding | Evidence / confidence | HSE decision |
|---|---|---|---|
| F01 · P1 | Filter dismissal left the main root `aria-hidden="true"` with focus on BODY in the first run, although the page was visually present. Reload restored it. | `filter-escape-observation.json`; subsequent mobile and desktop attempts correctly restored focus. **Intermittent, not consistently reproduced.** | On every close path remove background hiding, restore focus, and test dismissal while result requests resolve. |
| F02 · P2 | A deliberately unmatched query returned broad courses under the original query heading; there was no visible indication in the sampled viewport that results were substitutes. | E16; one probe, not a search-quality benchmark | Separate exact matches from suggested material. For zero exact matches, state that and offer query/filter recovery. |
| F03 · P2 | Key card metadata is 12px/18px; skill descriptions are clamped and dense. | E04, E07; computed CSS | Use 14px/20px for meaningful HSE metadata; keep critical scope, status, and restrictions fully visible. |
| F04 · P2 | On mobile, the horizontal filter row exposes only a few choices at once; an active level may be outside the viewport. | E07, E11 | Show a visible active-filter count and a wrapping removable summary below the toolbar. |
| F05 · P2 | The inspected empty learning state explains the situation but contains no direct recovery CTA in the empty panel. | E17 | Add “Browse courses” or “Ask your supervisor,” appropriate to the role and assignment model. |
| F06 · P2 | The AI panel was expanded on course arrival in this session and materially reduced the content width. | E12a versus E12; cause of initial opening unverified | Default HSE assistance to collapsed; provide an explicit restore control; do not obscure the learning task. |
| F07 · P2 | Discovery, trial, preview, and completion labels describe different access/outcome concepts. A visual badge alone cannot explain qualification. | E01, E04, E12; HSE-specific interpretation | Keep access, learning progress, validity, and authorization as separate fields. |
| F08 · P3 | Promotional bands and recommended material compete with the main task on detail pages. | E12, E14, E15 | Reserve promotion for acquisition surfaces. Assigned learning and evaluation screens emphasize task, due date, and next step. |
| F09 · Review | The course DOM exposed another H1 for an enterprise promotion, and a nested Preview button within a module button. | Course DOM snapshot; no screen-reader failure asserted | Use one descriptive page H1; separate the accordion trigger and Preview action as siblings. |
| F10 · Review | Some icon controls measure 20px or 32px; visual dimensions alone do not establish target-spacing compliance. | E01 measurements; WCAG exceptions apply | Prefer 44px minimum interactive boxes and 48px on coarse pointers. Audit actual target bounds and spacing. |

Strengths to retain: search terms persisted into results and URL; selected filters displayed count/state; desktop menu and normal mobile drawer Escape paths restored focus; course facts are grouped into a clear summary; provider names remain visible without relying on logos; FAQ/module expansion exposes named content regions; the sampled search page had no document-level horizontal overflow at 320px.

## 5. Measured Coursera foundations

### Color reference

These names are descriptive labels assigned for this audit. They are **not official Coursera tokens**.

| Role observed | Computed value | Where | Treatment for HSE |
|---|---|---|---|
| Primary action/link | `#0056D2` | Search, enrollment CTA, links | Reuse as proposed starting action blue |
| Primary text | `#0D0F12` | Headings, course titles | Reuse |
| Secondary text | `#48546E` | Metadata and navigation | Reuse; increase metadata size |
| Surface | `#FFFFFF` | Cards, header, panel | Reuse |
| Pale blue surface | `#F0F6FF` | Dashboard title band; expanded/highlighted areas | Reuse for selection/information |
| Neutral light | `#F2F5FA` | Light text in information banner | Use as a proposed subtle surface; original observed usage differs |
| Card border | `#C1CBDB` | Result-card boundary | Decorative boundary only; stronger control border below |
| Filter border/divider | `#DAE1ED` | Search pills | Decorative division; not the sole essential control cue |
| Dark information surface | `#002457` | Dashboard announcement | Optional inverse information treatment |
| Inverse link | `#87B8FF` | Link inside dark announcement | Use only with tested dark background |
| Keyboard outline | `#804EE4`, 1px solid, 2px offset | My Learning tab after ArrowRight | HSE strengthens to 3px `#6B3AC7`, 3px offset |

Text contrast is calculated from unrounded sRGB relative luminance; use the exact values in [contrast-results.json](contrast-results.json). White/action-blue is about 6.4:1; muted/white about 7.5:1; primary/white about 19.2:1. These pairs satisfy normal-text contrast at their measured opaque colors. Border `#C1CBDB` on white is about 1.6:1 and `#DAE1ED` about 1.3:1: they are unsuitable as the only visual boundary needed to identify an input. This is a token-use limitation, not a blanket failure of every outlined card or pill. See [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

### Typography reference

| Observed context | Family | Size / line height | Weight |
|---|---|---|---|
| Course detail H1, desktop | Source Sans Pro, Arial, sans-serif | 44 / 52px | 600 |
| Course detail H1, mobile | Same | 32 / 40px | 600 |
| Dashboard greeting | Same | 24 / 28px | 600 |
| Dashboard section / recommendation title | Same | 20 / 24px | 600 |
| Search-card title | Same | 16 / 20px | 600 |
| Body/search input/provider | Same | 16 / 24px | 400 |
| Small button / chip | Same | 14 / 20px | 400 or 600 |
| Search-card metadata | Same | 12 / 18px | 400 |

The HSE package uses **Source Sans 3**, a proposed, bundled open-source UI font from [Adobe](https://github.com/adobe-fonts/source-sans), with Source Sans Pro, Segoe UI, Arial, and sans-serif fallbacks. It is not mislabelled as the measured Coursera font. Use 400 for body, 600 for headings/actions, and 700 sparingly for strong emphasis. Keep a 16px root and rem-based text. HSE body is 16/24, metadata 14/20, section headings 24/32, app page titles 32/40, and marketing display 44/52. Prose width is at most 68ch; do not stretch learning text across a 1280px page.

### Geometry, density, and surfaces

| Measured specimen | Value | Interpretation |
|---|---|---|
| Desktop result card | 331.25px wide; 16px radius; 1px border; no shadow | At 1440px viewport / 1425px client width |
| Desktop catalog gutters | First card x = 32px; card-to-card gap = 12px | This result route; dashboard uses different margins |
| Dashboard / detail left margin | 48px | At sampled desktop viewport |
| Card internal rhythm | 8px image wrapper padding, 8px content padding, 4/8px internal gaps | Nested padding totals about 16px to text |
| Small primary action | 36px high; 8px radius; 8px 16px padding | Dashboard enrollment action |
| Large detail action | 48px high; 8px radius | Desktop intrinsic width; mobile available width |
| Search input | 48px high; 16/24px text | Rounded outer shell; circular 36px submit |
| Topic chip | 32px high; 32px radius; 4px 12px padding | Selected chip uses dark muted fill |
| Filter trigger | 36px high; 20px radius | 14px/20px semibold |
| Filter drawer | About 360px desktop; fills 390px mobile viewport | Fixed header/footer; scrollable middle |

HSE standardizes a **4px spacing scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96. This scale is recommended from recurring samples; it is not an extracted Coursera spacing specification. Use 16px card padding, 24px between related groups, 32–48px between sections, 64px for marketing sections. Use a flat card by default, raised shadow for a meaningful hover/elevation, and the stronger overlay shadow only for floating surfaces.

## 6. HSE semantic tokens and states

The authoritative proposed values are in [hse-tokens.css](hse-tokens.css) and [design-tokens.json](design-tokens.json). Do not put raw color values inside product components. Map primitives to semantic roles and component states.

| Semantic role | Foreground / background | Meaning |
|---|---|---|
| Information | `#0048B1` / `#F0F6FF` | Neutral help, current selection, instructions |
| Success | `#166534` / `#ECFDF3` | A verified successful milestone, with explicit label |
| Warning | `#854D0E` / `#FFF8E6` | Pending evaluation, upcoming due date, missing prerequisite |
| Danger | `#B42318` / `#FFF1F0` | Failed action, expired/revoked authorization, blocking condition |
| Neutral | `#48546E` / `#F2F5FA` | Draft, not started, descriptive classification |

An authorization badge always names its scope and is derived from verified prerequisites. “Knowledge Complete” may be green while the adjacent authorization field says “Not authorized — practical evaluation pending.” Never derive authorization from course progress percentage. Show Unknown or Not assessed when data is missing. Keep legal-status classification separate from lifecycle state and due-date urgency. The suggested semantic colors are HSE extensions; they were not all observed on Coursera.

Button states: default blue; hover darker blue; active darker again; keyboard focus 3px purple ring with an offset; disabled neutral with native `disabled`; loading keeps the same width, communicates its verb (“Saving…”), and prevents duplicate submission. The complete matrix applies to primary, secondary, tertiary, icon, and destructive variants. Hover alone must not expose essential actions. Reduced motion removes transforms and animation; a pending label remains.

Form states: label always visible; optional helper; required indication in text; focus ring; invalid border **and** specific inline error linked with `aria-describedby`; preserved entered values after failure; read-only values visually readable; disabled fields explain why nearby when needed. Do not use placeholders as labels or make color the only error indication.

## 7. Component library contract

[components.json](components.json) and the visual guide provide 32 components with evidence, anatomy, states, behavior, and accessibility notes. The following families define the implementation boundary.

| Family | Coursera pattern | Required HSE contract |
|---|---|---|
| App shell and navigation | Brand, explore, search, learning, help/account | Stable role navigation; visible current site/organization; route title; skip link; one main landmark. Mobile menu becomes a modal with Escape/restore. |
| Breadcrumb | Home → category → detail | Actual hierarchy, current page as text, ellipsis disclosure on mobile; never the only way back. |
| Search / suggestions | Named combobox, clear, submit, suggested results | Enter submits; arrows traverse suggestions; Escape closes; keep query in URL; label suggested versus exact content; avoid logging sensitive free text by default. |
| Filter toolbar / drawer | Pills, count, multi-select, radio sort, scroll panel | Show applied count and removable chips; choose explicit apply/cancel semantics. HSE stages drafts and applies on “Show results”; Escape cancels draft changes. This deliberately differs from Coursera's observed immediate URL updates. |
| Card / collection | Image, provider, title, metadata, status | One primary linked title; optional sibling Save; no nested interactive elements; preserve full critical scope/status; decorative image can be omitted. |
| Learning card | My Learning tabs; populated cards unverified | Assignment reason, due date, version, completion stage, next action, progress with exact value/text. Learner assignments precede recommendations. |
| Detail hero / summary | H1, provider, CTA, duration/level | Add assignment scope, learning outcomes, jurisdiction/context, content version, approval and last review date, practical/site prerequisites. |
| Tabs / section navigation | My Learning tabs; sticky detail anchors | True tabs use tablist/tab/tabpanel and arrow keys; page-section links remain links with active-location styling. Do not label ordinary filter pills as tabs. |
| Accordion / syllabus | Button, summary, region, chevron | Trigger owns only expansion. Preview/Start is a sibling button/link. Enter/Space toggles; `aria-expanded` and target association are synchronized. |
| Forms | Search, radio, checkbox observed; general forms unverified | Native label/input, fieldset/legend, helper/error text, locale-aware dates, keyboard-operable select, explicit save state. |
| Badges / alerts / progress | Category/access badges; information notice | Distinguish status dimensions. Alerts explain condition + action. Progress has an accessible value and never implies authorization. |
| Dialog / contextual rail | Filter modal; course AI rail | Initial focus, focus containment, Escape, explicit close, restored trigger; no hidden background after close. Non-modal rails must not trap focus. |
| Table / evidence record | Not observed in Coursera scope | Native table headers/caption; sortable headers expose `aria-sort`; text status and restrictions; explicit selection count; immutable version reference in record detail. |
| Upload / evaluation / timeline | Not observed in Coursera scope | Type/size constraints, progress, recoverable errors, preview before submission; evaluator identity/scope; event timestamps and version references. These are HSE-specific requirements. |
| Empty / error / loading / toast | Empty learning state observed | Distinguish no data, no matching data, access denied, stale data, request failure. Give useful next action; preserve layout while loading; announce meaningful changes politely. |
| Help / AI / footer | Help controls, suggested AI prompts, multi-column footer | Reachable human support; AI content labelled and sourced; generated content cannot approve a qualification; keep legal/support links discoverable. |

Iconography: consistent outlined SVGs, 20px in normal controls, 16px in metadata, 24px in prominent utility actions. Use a 1.5–2px stroke consistently as a proposed HSE rule. Decorative SVGs are hidden from assistive technology; icon-only buttons have an accessible name and a visible tooltip on focus and hover. Do not use emoji as the production icon family. Pair status icons with text.

Imagery: Coursera uses varied course art and provider marks. HSE should use original or licensed instructional photographs/diagrams with consistent crops. Prefer 16:9 catalog media, 64px thumbnails in compact mobile rows, and plain fallback art when no image is needed. Keep essential safety instructions in accessible text; never embed the only required instruction inside an image. Avoid image-heavy assignment lists and invented partner logos.

## 8. Responsive and layout rules

| Width | Coursera observation | Proposed HSE rule |
|---|---|---|
| 1440px | Four result columns, full desktop navigation, broad detail hero | 1280px max content; 32–48px gutters; 3–4 columns if each card stays at least 260px |
| 768px | Two result columns; mobile-style top navigation | 24px gutters; two columns if space allows; rail below content or dismissible drawer |
| 390px | Compact thumbnail rows; menu button; full-width filters; stacked detail facts | 16px gutters; one column; 48px controls on coarse pointers; primary action available without horizontal scrolling |
| 320px | Result document width equalled client width; chips had local horizontal scrolling | 16px gutters; wrapping active filters; no document overflow; collapse optional media before compressing critical text |

HSE starting breakpoints are **640, 960, and 1280px**. They are recommendations, not Coursera's exact breakpoints. At <640px use one-column layouts and full-width action groups; 640–959px permits two columns; ≥960px permits a main/rail layout only if main content remains ≥600px; ≥1280px allows four catalog columns. Component content, text enlargement, and navigation fit override nominal device categories.

Use CSS Grid/Flexbox and intrinsic widths. Never fit an interface by globally shrinking text. Keep navigation and summary bars sticky only when they leave a usable reading area; set scroll padding so focused items and anchors remain visible. Tables can have a labelled, keyboard-scrollable local region when two-dimensional relationships must be preserved. The document itself must reflow. [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

No dark palette was measured. Coursera displayed a notice that dark mode is supported, but no account preference was changed. HSE v1 here is deliberately light only. A future dark theme must separately map every semantic token and be tested; simply inverting the light palette is insufficient.

## 9. Page templates for the HSE web app

**Learner home:** compact greeting/context; due and assigned learning; resume action; explicit qualification blockers; optional discovery below. A learner with no assignments sees an explanation and the permitted next step. Avoid decorative scoreboards and fabricated compliance percentages.

**Catalog:** title and purpose; query; facet controls; applied filters; result count; cards or compact list; pagination/load-more with preserved position. Each card contains subject, provider/owner, version, duration, delivery format, audience, and learning outcome type. Use topics such as HazCom and PPE as content taxonomy, with applicability determined separately.

**Course detail:** breadcrumbs; title, purpose and provider; assigned/due state when applicable; version and review metadata; outcomes; required site addendum/practical steps; syllabus; accessibility/language options; next action. Price/access, if relevant, is separate from completion and qualification claims.

**Learning screen:** reading/video surface with captions/transcript; module navigation; save status; Back/Next; knowledge-check feedback; route out to a knowledgeable person. This is a proposed template: Coursera's player was not accessed. Completion must follow defined assessment logic and confirmed server persistence.

**Qualification detail:** a requirements list showing each applicable prerequisite, its evidence/version, status, responsible role, and next action. Authorization has scope, restrictions, effective/expiry information if applicable, and authorized approver. A green knowledge milestone does not override a pending practical evaluation.

**Evaluator workspace:** a sortable/filterable record table, upcoming work, assignment context, evaluation rubric, evidence attachments, review step, explicit signoff result, and audit trail. Actions are governed by roles and trusted server context. UI hiding alone is not an authorization boundary.

**Evidence record:** preserve course and addendum versions, training date/language/delivery, evaluator and basis, applicability at the time, and immutable event history. Show superseded versus current information clearly. Download/export actions identify the record version and generation timestamp. Record numbers are identifiers, not gamified completion counts.

## 10. Content and interaction rules

Use concise action verbs: “Resume course,” “Review site addendum,” “Schedule evaluation,” “View evidence.” Name what an action changes. Distinguish “Save draft” from “Submit evaluation.” Confirm a consequential authorization with the exact person, scope, and outstanding checks; do not insert confirmations for ordinary navigation.

Errors name the problem and recovery: “The evidence file could not be uploaded. Your evaluation draft is saved. Try again.” Empty search says “No courses match these filters” with a clear-filter action. Missing data says “Not assessed” or “Not available,” not 0 or Complete. Dates include a clear locale convention; exact event records include timezone. Long labels wrap. Preserve readable text in translated interfaces and budget for at least 30% text expansion as a design test assumption.

HSE's UI adopts the product vision's legal-status categories and avoids unsupported approval/certification labels. This guide defines wording and information hierarchy; the domain team must validate jurisdiction-specific content and rules separately. A visual style guide does not provide legal assurance.

## 11. Accessibility and release acceptance

Target WCAG 2.2 AA for the implemented product. At AA, normal text needs 4.5:1 and large text 3:1, subject to stated exceptions; necessary component/graphic cues need 3:1 against adjacent colors. AA target size is **24 × 24 CSS px or a qualifying exception**, not universally 44px. HSE's 44px/48px target policy is a stronger product choice. Focus must be visible and not entirely obscured by authored content. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)

| Gate | Acceptance evidence required |
|---|---|
| Keyboard | Every task works without a pointer; no trap; clear focus; predictable order; skip link works. |
| Search | Label, suggestion keyboard navigation, Enter submit, clear action, query persistence, count announcement, exact/suggested distinction. Use [WAI combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). |
| Modal/drawer | Initial focus, Tab loop, Shift+Tab loop, Escape/cancel/apply/close behavior, focus restoration, cleanup during requests and route changes. Use [WAI dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). |
| Tabs | Correct roles/states and labelled panels; Arrow/Home/End support; manual activation uses Enter/Space. Section anchors are tested separately. Use [WAI tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). |
| Forms | Programmatic labels, errors connected to controls, summary links for multi-field errors, values preserved, native validation semantics respected. |
| Reflow | 320 CSS px and 200% browser text/zoom; no clipped status/restriction; local table scrolling only when justified. |
| Text / colors | Actual rendered pairs including hover, focus, error, placeholder, inverse and forced-colors states; no color-only meaning. |
| Touch | 44px policy / 48px coarse-pointer targets, safe spacing, no hover-only controls, no drag-only action. |
| Learning | Captions/transcript, keyboard player, comprehensible feedback, no forced timer without an accessible alternative. |
| Async / resilience | Loading, empty, denied, offline, stale, validation, partial failure, save conflict, retry; announcements do not flood the user. |
| Qualification integrity | Incomplete prerequisites cannot produce authorization; missing data is explicit; scope/version survives navigation/reload/export. |
| Assistive technology | NVDA + Chrome/Edge and VoiceOver + Safari on representative tasks, plus real mobile checks. |

Package validation checks are recorded in [validation.md](validation.md). Passing token contrast or a local prototype check does not certify the eventual app.

## 12. Implementation and validation sequence

1. Adopt semantic tokens, typography, standard focus, control sizes, form field, buttons, badges, and app shell.
2. Build the catalog → detail → assigned learning vertical slice, including query/filter persistence and full empty/error/loading states.
3. Build qualification requirements → evaluation → evidence record, maintaining separate progress/authorization semantics.
4. Validate three learner tasks (find assigned course, understand next qualification step, recover failed save) and two evaluator tasks (find pending practical evaluation, inspect exact evidence version) with representative users. Include frontline workers, low digital confidence, and keyboard/assistive-technology users.
5. Set baseline task success, time, error count, and interpretation accuracy before setting improvement targets. A recommended launch gate is that every participant can distinguish Knowledge Complete from Authorized in the tested scenarios; investigate every confusion rather than publishing an invented success rate.

Ownership: product owns task scope and labels; domain reviewers own applicability and qualification rules; design owns tokens and component patterns; engineering owns state, semantics, persistence, and role enforcement; QA owns the evidence for acceptance. Version the guide and record a decision when a pattern diverges. Review the benchmark before a major redesign rather than treating this point-in-time capture as permanent.

## 13. Sources

All sources accessed September 7, 2026, local date. Browser screenshots and measurements in [evidence/index.md](evidence/index.md) are the primary sources for Coursera visual claims.

- S01 — [Coursera public homepage](https://www.coursera.org/): acquisition content, discovery, providers, outcomes, FAQ.
- S02 — [edX homepage](https://www.edx.org/): subjects, providers, program types, learning outcomes; public structure review.
- S03 — [FutureLearn homepage](https://www.futurelearn.com/): subjects, providers, course types, access distinctions; public structure review.
- S04 — [USWDS Search](https://designsystem.digital.gov/components/search/): search field placement, labeling, query persistence.
- S05 — [USWDS Card](https://designsystem.digital.gov/components/card/): modular content summaries and when to use a table instead.
- S06 — [USWDS Table](https://designsystem.digital.gov/components/table/): tabular relationships and responsive variants.
- S07 — [WCAG 2.2](https://www.w3.org/TR/WCAG22/): accessibility target.
- S08 — [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- S09 — [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- S10 — [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- S11 — [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum).
- S12 — [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- S13 — [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- S14 — [WAI combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
- S15 — [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- S16 — [Adobe Source Sans](https://github.com/adobe-fonts/source-sans): proposed HSE font and license.
- P01 — [HSE Informer product vision](../vision/phases.txt): product-specific requirements, not independently validated regulatory guidance.

An attempted SafetyCulture training-page retrieval returned HTTP 429; no claims or recommendations rely on it. No anonymous Coursera screenshot, dark-theme token, checkout result, paid-player behavior, or empirical market performance is asserted.
