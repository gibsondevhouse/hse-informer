# 06 · Notifications

> **Deferred — 2026-10-24:** This automation plan is later-version work and is not a beta exit gate. Beta account invitation/reset delivery is covered by 03; learners can view assignments in the app.

**Goal:** people find out what they need to do without logging in to check, and administrators can see whether each notice arrived.

## Why

`web/` sends no notifications. `admin-app/` has a webhook outbox with no provider attached. A test run in which nobody is told about their assignments tests nothing.

## Work

- [ ] Choose an email provider and an SMS provider that support idempotency keys and delivery webhooks. Record the choice and its data-processing terms.
- [ ] Add a notification outbox in PostgreSQL, written in the same transaction as the change that causes it, following the existing integration outbox pattern in `web/src/lib/server/jobs.ts`.
- [ ] Send these notices:

  | Notice | To | When |
  |---|---|---|
  | New assignment | Worker | On assignment |
  | Due soon | Worker | 7 days and 1 day before the due date, site local time |
  | Overdue | Worker and supervisor | Day after the due date, then weekly |
  | Evaluation needed | Evaluators for that site | When a worker reaches the practical step |
  | Failed final attempt | Site admin | On failure |
  | Credential or authorization expiring | Worker, supervisor, site admin | 30 days before |
  | Invitation | New user | On invite |

- [ ] Write notices in the worker's language, in plain words, with one link to the task.
- [ ] Retry failed sends with backoff, then mark them failed. Never resend a delivered notice.
- [ ] Show delivery status per notice on the assignment and on a failed-delivery list in the dashboard.
- [ ] Let workers choose email, SMS, or both. Invitations and overdue notices can't be turned off.
- [ ] Run the scheduler for reminders as a deployed job with alerting, covered in [08](08-operations-and-security.md).

## Done when

- Each notice in the table reaches a test inbox and phone in staging.
- Running the reminder job twice sends each reminder once.
- A forced provider failure shows as failed on the dashboard and raises an alert.
