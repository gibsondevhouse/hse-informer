# 09 · Test run

**Goal:** run the beta with a small group of real people at the same time, and decide whether it passed.

## Participants

| Role | Count | Who |
|---|---|---|
| Tenant admin | 1 | TBD |
| Site admins or managers | 2 to 4, across two sites | TBD |
| Evaluators | 2, one per site | TBD |
| HSE reviewer | 1 | Named in [02](02-content-and-hse-review.md) |
| Auditor | 1 | TBD |
| Workers | 20 to 50, across two sites, with at least 5 who prefer Spanish | TBD |

Pilot company and sites: TBD. The recommendation is the first company's Tifton and Ocilla sites.

## Data handling

- The test run uses real names and contact details, so participants are told what is collected and agree to it, using the privacy note from [08](08-operations-and-security.md).
- Beta records are not workplace authorization. Every learner screen, certificate, and export in staging carries a "Beta test record" label.
- No synthetic fixture or React preview record is loaded into the test-run database.
- After the test run, records are kept or deleted according to what participants were told.

## Scenarios

These follow the six pilot scenarios in the [B0 plan](../../vision/B0-beta-admin-system.md#pilot-scenarios-to-prove-end-to-end), adjusted for beta. Each is run by the participants in the role named, not by a developer.

| # | Scenario | Run by | Pass when |
|---|---|---|---|
| 1 | Import the roster, invite everyone, and get each person signed in | Tenant admin | Every participant signs in; nobody sees another site's records unless granted |
| 2 | Assign the pilot course by rule to everyone in scope at both sites | Site admins | Recipients match the dry run; each worker gets a notice; no duplicates |
| 3 | Workers take the course and assessment, in English or Spanish, on phones and shared tablets | Workers | Attempts, scores, and language are recorded; certificates are worded correctly |
| 4 | Evaluators record practical signoff, and an approver issues authorizations | Evaluators, tenant admin | Only workers with every prerequisite become Authorized; an unqualified signoff is rejected |
| 5 | Record a toolbox talk and an instructor-led session | Evaluators or site admins | Attendance and signatures appear as evidence on each attendee |
| 6 | Change a site procedure at one site and publish a new addendum version | HSE reviewer, site admin | Exactly the affected workers are reassigned; prior evidence is unchanged |
| 7 | Let some assignments go overdue | Site admins | Overdue notices send once each; the matrix and reports show the right people |
| 8 | Revoke one authorization | Tenant admin | Status updates everywhere and the history keeps the revoked record |
| 9 | Produce evidence for two workers on request | Auditor | PDF and CSV packets match the records, and the exports are logged |
| 10 | Restore staging from backup partway through | Operator | No committed record is lost, and the auditor's packets match before and after |

## Feedback

- [ ] Give each participant a short survey after their scenarios: task success, confusion points, language clarity, device used.
- [ ] Watch at least three workers and two admins use the product live, and note where they get stuck.
- [ ] Log every defect with severity. Critical means a wrong status, a wrong person seeing data, lost evidence, or a misleading claim.

## Go / no-go

Beta passes when:

- [ ] Every scenario above passes.
- [ ] No critical defect is open.
- [ ] Every exit criterion in the [beta README](README.md#beta-exit-criteria) is met, with evidence linked from this file.
- [ ] The HSE owner and the tenant admin sign off, with names and dates recorded here.

## Results

Not run yet.
