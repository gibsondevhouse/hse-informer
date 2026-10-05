# HSE Informer admin workspace

The administrator preview for ten course outlines. The first five follow the launch syllabus; five additional outlines follow the [regulatory training source map](../docs/regulatory/training-source-map.md). The HSE Informer reference package remains in `docs/coursera-audit`.

## Run

Use Node 22.13+ and npm. Run `npm install`, then `npm run dev`.

## Included

- Site-scoped program summaries and a ten-course management table. The knowledge-completion detail counts distinct people with at least one incomplete assignment. Clicking the card replaces the assignment table with four circular status indicators: Not started, In progress, Knowledge Complete, and Overdue. Each shows its assignment count and percentage for the selected sites and opens the matching records. Overdue takes precedence over Not started/In progress, so the groups do not overlap. View assignment records restores the full table.
- Assignment filters, learner records, editable deadlines, and ascending/descending sorting by learner, site, course, assignment reason, displayed status, and due date. Fixed column proportions keep sorting and pagination from changing the layout. Sorting covers the full filtered set before pagination and does not rewrite saved records.
- Course detail panels with 94 outline titles, including seven Respiratory Protection modules, local instruction outlines, and a regulatory-basis tab; library cards show each course's legal-status label.
- Five new outlines cover Electrical Safety, Heat and Thermal Stress, Powered Industrial Trucks, Bloodborne Pathogens, and Walking-Working Surfaces.
- A Preview training action beside the Respiratory Protection title, opening a separate learner preview while preserving the admin page.
- Respiratory Protection is the first course in development: seven instructional modules map to the OSHA training topics; only opening sections of Module 1 and a practice decision are previewable. Six modules, full assessment, and site-specific instruction remain in development. The program overview lists medical evaluation, tight-fitting fit testing, equipment issuance, practical validation, and employer authorization as separate gates; preview progress satisfies none of them.
- The learner player has a fixed viewport, independently scrollable course outline, and lesson pages packed to the available reading height. Oversized reading blocks are subdivided without shrinking text. Expand lesson 1 beneath its number to see the current section and preview completion markers; only finishing a section advances those markers. A dark-mode preference is stored on this device. References open separately, and narrow screens use an outline drawer. The brand and Return to admin links load the admin home directly through native navigation.
- An assignment form with explicit audience, site selection, purpose, deadline, recurrence metadata, duplicate-open-assignment exclusion, and recipient review.
- Browser-local preview persistence with storage-change synchronization and stale-snapshot protection.
- A reusable learning player and block library (`lib/lms`, `components/lms`) with 33 block types across content, disclosure, activity, and graded interaction families, formative and exam modes, partial-credit grading, a seeded-shuffle assessment with attempt limits, requirement-gated lesson completion, and browser-local progress. The polished PBJ-101 practice course is at `/training/pb-and-j`; the full author component lab is at `/training/pb-and-j/component-lab`. See [the component library reference](../docs/lms/component-library.md).

## Preview boundary

All organizations, sites, learners, and records are fictional. The reporting date is fixed at September 9, 2026. Browser-local records are not a production database and do not synchronize across devices or administrators. No notifications, recurring jobs, real learner delivery, or authorization decisions occur. Course content, assessments, approved versions, tenant authentication, server-enforced site permissions, and local/practical evidence records remain future integrations. The foundation preview is a syllabus, not a released course.

The course library contains the five original syllabi and five source-map-derived outlines. Regulatory metadata is a planning summary, not legal advice or an applicability decision. Chemical Hygiene's production scope does not match the laboratory-only 1910.1450 citation and remains under domain review. Knowledge completion never changes authorization. Recurrence suggestions do not create recurring jobs or establish qualification.

PBJ-101 is an unassigned practice course for refining the learner experience. It is not an HSE compliance course or part of assignment records. Its progress, acknowledgements, and assessment attempts stay in this browser and are not training records. The author component lab remains separate from the learner course.

## Checks

`npm exec tsc -- --noEmit`

`npm run lint`

`node --experimental-strip-types --test tests/*.test.mjs`

`npm run build`

Lint excludes the generated Shadcn component catalog and its generated mobile hook, which have inherited rule incompatibilities; application code uses the original strict rules. Generated primitives are unmodified. No browser interaction, screenshot, or assistive-technology audit has been performed in this task.

The locally bundled Source Sans 3 font uses the SIL Open Font License in `public/OFL.txt`.

## Compact presentation

`app/hse-tokens.css` bundles the foundations from the checked-in `docs/coursera-audit/hse-tokens.css`, with the font path adapted to this app. The compact desktop presentation uses the documented 36px compact control token, 24px dashboard title, 14px meaningful labels, 16px instructional text, and the 4px spacing rhythm. Touch controls retain the 48px target token.

The narrower sidebar, 500px program drawer, reduced row padding, and tighter section spacing are deliberate adaptations to the user's request for a denser admin app. They do not claim that the reference's more generous default geometry was copied verbatim. Large-screen breakpoints no longer enlarge typography or padding. Browser zoom is unchanged.

Programs, Assignments, and Sites share one summary-card layout in `components/training-summary.css`: consistent minimum height, label/value/detail rows, spacing, and responsive grid. The admin shell reserves scrollbar space so page length does not change the content width. Account identity appears once in the sidebar footer.
