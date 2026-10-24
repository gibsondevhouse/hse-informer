# 09 · Focused beta test run

**Goal:** administrators and learners prove the four core workflows against deployed staging.

Participants: a named tenant administrator, site administrators, and a small named group of learners across two sites. Confirm names, count, and sites before the run; the earlier 20–50-worker target is not a release requirement.

## Data handling

Participants receive a privacy note covering collection, access, retention, and deletion. Real participant profiles are permitted in staging for this controlled beta. Do not load synthetic preview records into their database. Label screens and exports as beta test records; no record grants workplace authorization. Keep or delete participant records according to the agreed policy.

## Scenarios

1. Create/edit a user profile, invite the learner, grant site access, and verify access boundaries.
2. Publish a versioned practice course; assign it individually and in bulk; change a due date and cancel an assignment.
3. Learn on a phone, resume on another device, fail/retry within the rules, pass, and inspect completion history.
4. Find the same completion as an administrator; confirm version, attempts, score, and time.
5. Add a manual completion with provenance, correct it, then void it; confirm original evidence, audit history, and effective assignment state remain explainable.
6. Edit the user's name/site and deactivate the account; history remains accurate and the disabled account loses access.
7. Verify learners cannot edit completions or access other users; verify cross-site and cross-tenant denials.
8. Export scoped completion records to CSV and compare them to the UI/database.
9. Restore a backup to a separate environment and compare profiles, attempts, completions, corrections, and audit records to the recovery point. Record the recovery window and any later transactions needing replay.

## Go / no-go

- [ ] All scenarios and beta README exit criteria pass with linked evidence.
- [ ] No open critical defects: wrong access, lost records, incorrect status, or misleading claims.
- [ ] Administrator and learner feedback is recorded; product owner accepts the run with name/date.

**Results:** Not run yet.
