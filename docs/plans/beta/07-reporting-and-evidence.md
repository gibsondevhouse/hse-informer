# 07 · Reporting and evidence

**Goal:** a site manager can see who is compliant and act on gaps, and an auditor can reconstruct one worker's history without database access.

## Why

`web/` shows dashboard counts and has a per-person, per-requirement audit packet as JSON (`web/src/routes/api/audit/`). There is no training matrix, no drill-down report, and no human-readable export.

## Work

### Training matrix

- [ ] Add a matrix of people (rows) by requirement (columns) for a selected site, filterable by department, role, and supervisor.
- [ ] Each cell shows the five-state status, with Overdue and expiring highlighted, and opens that person's evidence for that requirement.
- [ ] Export the matrix to CSV.

### Standard reports

- [ ] Overdue assignments, by site and supervisor.
- [ ] Expiring in 30, 60, and 90 days: recurrence due dates, evaluations, credentials, authorizations.
- [ ] Completion by course version and language.
- [ ] Qualification readiness: who is Knowledge Complete but still blocked, and on what.
- [ ] Failed notifications and integration drift.
- [ ] Every report shows its scope, denominator, and as-of time, and exports to CSV. A missing feed shows as missing, never as zero.

### Evidence exports

- [ ] Render the audit packet as a PDF: worker, site and role at the time, assignment reason, course and addendum versions, language, attempts and scores, evaluator and qualification, attestations, authorization history, and corrections.
- [ ] Export the same packet as CSV.
- [ ] Log every export with who, what, and when, and show the log to tenant admins.
- [ ] Leave personal contact details out of exports unless the viewer's role allows them. The current packet already drops email.

### Dashboard

- [ ] Make every dashboard number open the filtered records behind it, following the [B0 dashboard contract](../../vision/B0-beta-admin-system.md#admin-information-architecture-and-dashboard-contract).

## Done when

- A site manager clears an overdue list for one site using only the matrix and reports.
- An auditor exports a worker's packet as PDF and CSV, and an automated test checks it field by field against the database.
- Report counts match direct queries in an integration test with synthetic data.
