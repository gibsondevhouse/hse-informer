# HSE Informer admin workspace

The app includes a sample administrator preview and a protected pilot workspace. The preview shows ten course outlines; the first five follow the launch syllabus and five more follow the [regulatory training source map](../docs/regulatory/training-source-map.md). The HSE Informer reference package remains in `docs/coursera-audit`.

## Run

Use Node 22.13+ and npm. From this directory, run `npm ci`, then `npm run dev`. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Pilot server setup

The protected `/api/admin/*` and `/api/learner/*` routes use Cloudflare D1 and Cloudflare Access. They fail closed when either service is absent. This checkout's `.openai/hosting.json` currently has `d1: null`; the sample records in the UI are not a shared pilot database. An operator must attach a real D1 database to the deployed worker as binding **`DB`**, then apply `migrations/0001_core.sql` followed by `migrations/0002_qualification.sql` to that same database. With a Wrangler configuration that maps `DB` to the real database ID, the commands are `npx wrangler d1 execute DB --remote --config <wrangler-config> --file migrations/0001_core.sql` and then the same command for `0002_qualification.sql`. The local Vite binding uses `DB` when the hosting manifest enables D1, but its placeholder database ID is only for local emulation. For a custom Cloudflare deployment, configure the real D1 database ID in the deployment configuration. For Sites hosting, allocate/attach D1 in the hosting project and verify that the deployed worker exposes it as `DB` before changing `.openai/hosting.json` from `null` to `"DB"`.

Configure a Cloudflare Access application in front of the admin, learner, and API paths. Set `HSE_ACCESS_TEAM_DOMAIN` to the team domain (for example `example.cloudflareaccess.com`) and `HSE_ACCESS_AUD` to that Access application's audience. The server verifies the Access JWT signature, issuer, audience, expiry, and email; it never trusts an unsigned email header. Access must be enforced at the public edge too. The job endpoint also needs an Access service-token policy if the Access application covers `/api/admin/jobs`.

Provision admin users explicitly in D1: `users.sub` and `users.email` must match the signed Access identity, with one of `admin`, `site_manager`, `evaluator`, or `auditor`. An `admin` has organization scope; other roles need `user_sites` rows for each permitted site. `site_manager` can manage people and assignments in granted sites, `evaluator` can record qualification evidence there, and `auditor` has read access. Worker sign-in matches the verified Access email to an active `workers.email` row. A roster entry alone cannot log in without a valid Access identity.

The first admin and site grants are an operator provisioning step because the UI cannot grant itself access. For example, after confirming the Access subject and creating a site, execute parameterized equivalents of:

```sql
INSERT INTO users (sub,email,role) VALUES ('<Access subject>','admin@example.com','admin');
INSERT INTO user_sites (user_sub,site_id) VALUES ('<Access subject>','<site id>');
```

An organization admin can register an immutable package through `POST /api/admin/releases` with `courseId`, `version`, `action: "approve"`, and a reason. The server only approves versions present in `lib/lms/recorded-courses.ts`. Approval and revocation are audited. Currently that map contains only PBJ-101, a **practice sandbox**; no HSE course is approved or deliverable. PBJ completion must not be treated as workplace qualification. Shipping a full HSE package and obtaining domain approval are release prerequisites.

Set `HSE_JOB_TOKEN` to a secret of at least 24 characters and schedule authenticated `POST /api/admin/jobs` calls. That endpoint creates due recurring assignments and processes the durable notification outbox. To actually send assignments and reminders, also set `HSE_NOTIFICATION_WEBHOOK` and `HSE_NOTIFICATION_TOKEN` for a provider that accepts the JSON request and honors its `Idempotency-Key` header. Without a provider, delivery stays `configuration_required`; a saved assignment is never described as delivered. Without an external scheduler, recurrence and dispatch do not run automatically. Keep the scheduler's Access service-token credentials separate from `HSE_JOB_TOKEN`.

After setup, an authenticated admin should receive a live `asOf` from `GET /api/admin/bootstrap`. Verify that an unprovisioned identity cannot read it, that a site-scoped account cannot read another site's assignment, and that a worker can see only their own assignment. Verify notification acceptance and learner completion against the same assignment ID before entering real records.

The pilot is ready for operational acceptance only after D1, Access, user grants, notification delivery, a scheduler, and an approved HSE course package are configured and verified end to end. The October 7, 2026 dependency audit still reports nine production advisories (six high, three moderate) in the Vinext dependency chain; resolve or formally assess them before a pilot release.

When D1 and Access are configured, `/` switches to the live pilot workspace. It shows site-scoped assignments, workers, sites, course releases, and audit history with a live `asOf` time. An admin can approve or revoke a packaged release, select a role/site cohort plus individual exceptions, review recipients, create assignments, queue reminders, and make reasoned due-date, cancellation, or reassignment changes. Workers use `/learn` to open their own assignments and save server-scored progress. Evaluators use `/qualifications` to record separate local instruction, prerequisite, practical evaluation, and employer authorization evidence. The worklists and CSV report expose the supporting records and later corrections.

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
- A reusable learning player and block library (`lib/lms`, `components/lms`) with 34 block types across content, disclosure, activity, and graded interaction families, formative and exam modes, partial-credit grading, a seeded-shuffle assessment with attempt limits, requirement-gated slide and lesson completion, and browser-local progress. Interactive option cards track which choices have been explored. The polished PBJ-101 practice course is at `/training/pb-and-j`; the full author component lab is at `/training/pb-and-j/component-lab`. See [the component library reference](../docs/lms/component-library.md).

## Preview boundary

The original sample organizations, sites, learners, and records are fictional. Browser-local preview data is not a production database and does not synchronize across devices. Protected server routes, audit tables, delivery outbox, and qualification records now provide a pilot integration path, but are inactive until the services above are provisioned. The foundation course outlines remain syllabi, not released courses.

The course library contains the five original syllabi and five source-map-derived outlines. Regulatory metadata is a planning summary, not legal advice or an applicability decision. Chemical Hygiene's production scope does not match the laboratory-only 1910.1450 citation and remains under domain review. Knowledge completion never changes authorization. Recurrence suggestions do not create recurring jobs or establish qualification.

PBJ-101 at `/training/pb-and-j` remains unassigned browser-local practice. If an admin explicitly approves and assigns its recorded sandbox package, the separate `/learn/assignments/[id]` path saves server-side practice evidence for workflow testing. Neither path is HSE compliance training or workplace authorization. The author component lab remains separate from the learner course.

## Checks

`npm exec tsc -- --noEmit`

`npm run lint`

`node --experimental-strip-types --test tests/*.test.mjs`

`npm run build`

Lint excludes the generated Shadcn component catalog and its generated mobile hook, which have inherited rule incompatibilities; application code uses the original strict rules. Generated primitives are unmodified. The sample admin was visually checked at 390 × 844 and at desktop width, including assignment-table scrolling; a filtered worklist was checked across a browser refresh. The live protected workspace and assistive-technology behavior still need acceptance testing with configured services.

The locally bundled Source Sans 3 font uses the SIL Open Font License in `public/OFL.txt`.

## Compact presentation

`app/hse-tokens.css` bundles the foundations from the checked-in `docs/coursera-audit/hse-tokens.css`, with the font path adapted to this app. The compact desktop presentation uses the documented 36px compact control token, 24px dashboard title, 14px meaningful labels, 16px instructional text, and the 4px spacing rhythm. Touch controls retain the 48px target token.

The narrower sidebar, 500px program drawer, reduced row padding, and tighter section spacing are deliberate adaptations to the user's request for a denser admin app. They do not claim that the reference's more generous default geometry was copied verbatim. Large-screen breakpoints no longer enlarge typography or padding. Browser zoom is unchanged.

Programs, Assignments, and Sites share one summary-card layout in `components/training-summary.css`: consistent minimum height, label/value/detail rows, spacing, and responsive grid. The admin shell reserves scrollbar space so page length does not change the content width. Account identity appears once in the sidebar footer.
