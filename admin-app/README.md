# HSE Informer admin workspace

The first administrator page for the five fixed launch courses. The implementation follows the HSE Informer reference package in the parent workspace's `docs/coursera-audit` and the supplied launch syllabus.

## Run

Use Node 22.13+ and npm. Run `npm install`, then `npm run dev`.

## Included

- Site-scoped program summaries and a five-course management table. The knowledge-completion detail counts distinct people with at least one incomplete assignment. Clicking the card replaces the assignment table with four circular status indicators: Not started, In progress, Knowledge Complete, and Overdue. Each shows its assignment count and percentage for the selected sites and opens the matching records. Overdue takes precedence over Not started/In progress, so the groups do not overlap. View assignment records restores the full table.
- Assignment filters, learner records, editable deadlines, and ascending/descending sorting by learner, site, course, assignment reason, displayed status, and due date. Fixed column proportions keep sorting and pagination from changing the layout. Sorting covers the full filtered set before pagination and does not rewrite saved records.
- Course detail panels with all 48 lesson titles and local instruction outlines.
- A Preview training action beside the Respiratory Protection title, opening a separate learner preview while preserving the admin page.
- Respiratory Protection is the first course in development: an introduction, five opening-lesson sections, and a practice decision with corrective feedback. Eight later lessons remain explicitly in development. Preview state is isolated from assignment records and does not create training completions.
- The learner player has a fixed viewport, independently scrollable course outline, and lesson pages packed to the available reading height. Oversized reading blocks are subdivided without shrinking text. Expand lesson 1 beneath its number to see the current section and preview completion markers; only finishing a section advances those markers. A dark-mode preference is stored on this device. References open separately, and narrow screens use an outline drawer. The brand and Return to admin links load the admin home directly through native navigation.
- An assignment form with explicit audience, site selection, purpose, deadline, recurrence metadata, duplicate-open-assignment exclusion, and recipient review.
- Browser-local preview persistence with storage-change synchronization and stale-snapshot protection.

## Preview boundary

All organizations, sites, learners, and records are fictional. The reporting date is fixed at September 9, 2026. Browser-local records are not a production database and do not synchronize across devices or administrators. No notifications, recurring jobs, real learner delivery, or authorization decisions occur. Course content, assessments, approved versions, tenant authentication, server-enforced site permissions, and local/practical evidence records remain future integrations. The foundation preview is a syllabus, not a released course.

The course library and lesson counts are fixed to the user's five-course brief. Knowledge completion never changes authorization. Recurrence is planning metadata, not a claim about required regulatory intervals.

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
