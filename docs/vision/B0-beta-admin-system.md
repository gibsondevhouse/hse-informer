# B0 Beta Admin System Phased Approach

**Status:** Planning proposal

**Prepared:** October 3, 2026

**Audience:** HSE Informer product, design, engineering, HSE subject matter reviewers, and beta customer administrators

## Decision and scope

B0 should deliver a usable corporate training administration system for a small, controlled chemical industrial beta. An administrator must be able to identify who needs which training, assign it, see what is late or blocked, complete site and practical steps, and produce a defensible record of what happened. The dashboard is the entry point to those actions; its counts must come from durable, permission scoped records.

The initial target remains U.S. private sector general industry, with chemical manufacturing and related sites as the primary use case. [The existing product vision](phases.txt) describes the regulatory and qualification direction; its interpretations require domain review before they become product rules. B0 is an administration milestone, not a claim that the course library or the platform is legally compliant in every workplace. Course completion, site training, practical evaluation, employer authorization, and external credential verification remain distinct outcomes.

**Beta exit definition:** at least one pilot employer can administer its sites and workers through the system using real accounts and durable records, complete the workflows in this document, and recover an accurate evidence package after an assignment, content, personnel, or authorization change. The existing local preview alone does not meet this definition.

## What competitive platforms establish

This is a feature benchmark from vendors' current product documentation, not a hands on evaluation of their full products or a claim that every feature is in every subscription tier. The B0 choices in the right column are HSE Informer product proposals.

| Admin capability | Documented market pattern | B0 implication |
| --- | --- | --- |
| Role aware overview | Docebo's manager dashboards show course and learning plan status, overdue work, filters, detailed rows, and exports; its admin navigation also separates people, content, and analytics. [Docebo dashboards](https://help.docebo.com/hc/en-us/articles/29543826719378-Courses-and-Learning-Plans-dashboards-in-My-team), [Docebo navigation](https://help.docebo.com/hc/en-us/articles/30839505728914-New-navigation-interface) | Give each role a scoped overview with counts that open the underlying records and next actions. |
| People, groups, and delegated administration | LearnUpon uses groups for assignments and compliance reporting, with managers restricted to their groups. Absorb supports custom admin roles and user management scope. [LearnUpon groups](https://support.learnupon.com/hc/en-us/articles/360002220098-Create-groups-and-assign-users-to-groups), [Absorb roles](https://support.absorblms.com/hc/en-us/articles/360053227673-Admin-Roles-Permissions) | Model employer, site, department, worker, manager, and evaluator relationships; enforce scope on the server and in exports. |
| Assignments and automation | Absorb documents rule based automatic enrollment for existing and new workers. LearnUpon documents dynamic groups and automatic enrollment. [Absorb enrollment rules](https://support.absorblms.com/hc/en-us/articles/360053094693-Automatic-Enrollment-Rules), [LearnUpon dynamic rules](https://support.learnupon.com/hc/en-us/articles/360016528037-Dynamic-rules-overview) | Support reviewed assignment rules, manual exceptions, dry run recipient counts, and traceable assignment reasons. |
| Progress and reporting | LearnUpon provides configurable reports, filters, exports, scheduled delivery, and manager scoped access. Docebo exposes course, plan, certification, and session reporting. [LearnUpon reporting](https://support.learnupon.com/hc/en-us/articles/4410406397073-Reports-overview-and-setup), [Docebo manager reports](https://help.docebo.com/hc/en-us/articles/4411987588242-Reports-for-managers) | Ship a small set of reliable operational and audit reports before a general report builder. Show the data as of time. |
| Content and history | Docebo documents versioned training material and reporting of the version a learner completed. LearnUpon's progress report can include course version. [Docebo versions](https://help.docebo.com/hc/en-us/articles/360020124619-Managing-the-Training-materials-page), [LearnUpon report fields](https://support.learnupon.com/hc/en-us/articles/13657510482973-Reports-advanced-report-types-and-filters-reference) | Freeze the exact released course, assessment, translation, and site addendum versions referenced by a completion. |
| Auditability | Docebo describes an immutable audit trail covering users, enrollments, learning plans, reports, and certifications. [Docebo audit trail](https://help.docebo.com/hc/en-us/articles/6095145987346-Audit-trail-events-details) | Record actor, time, scope, before and after values, and reason for consequential changes. Make corrections additive. |
| Live and external training | LearnUpon supports instructor led sessions, attendance records, and reporting on external training. [LearnUpon sessions](https://support.learnupon.com/hc/en-us/articles/4411340805521-Live-Learning-create-and-edit-sessions), [LearnUpon reporting](https://support.learnupon.com/hc/en-us/articles/4410406397073-Reports-overview-and-setup) | Capture evaluator led site instruction and external prerequisite evidence in B0; schedule and capacity management for classes can follow the beta unless a pilot needs it. |
| Notifications and follow up | Docebo documents notifications by event, schedule, audience, and recipient. [Docebo notification events](https://help.docebo.com/hc/en-us/articles/4429113070226-Notification-events-and-conditions) | Send assignment, due, overdue, and evaluator action notices with delivery status and retry history. |

The broader competitive admin surface also includes assessments, learning paths, certificates, instructor led events, bulk imports, integrations, localization, and support tools. B0 must define where each capability lives, even when it is outside the first beta release. In HSE Informer, certificates and badges must not imply workplace authorization; a qualification record needs its own prerequisite and approval model.

**HSE specific extension:** the market benchmark establishes LMS administration expectations. HSE Informer also needs a visible boundary between knowledge and workplace qualification. OSHA states that self paced computer training alone may be insufficient where interaction and hands on components are needed, and that workers need timely access to a qualified trainer for questions. [OSHA electronic worker training records interpretation](https://www.osha.gov/laws-regs/standardinterpretations/2019-07-11). Training must be understandable to the worker; [OSHA's education and training guidance](https://www.osha.gov/safety-management/education-training) calls for appropriate language and literacy level. These sources guide product controls, while the applicable standard and employer program must determine each actual requirement.

## Current starting point and gap

The administrator app in `admin-app/` already demonstrates site scoped program summaries, ten course outlines, assignment filtering and sorting, deadline edits, recipient review, and the four mutually exclusive knowledge assignment states: Not started, In progress, Knowledge Complete, and Overdue. Its first five outlines are the original shared foundations; Respiratory Protection is still a draft lesson preview. The [app README](../../admin-app/README.md) explicitly describes fictional users and browser local persistence, with no tenant authentication, server permissions, recurring jobs, notifications, real learner delivery, or qualification evidence. Treat the preview as interaction design and sample logic to reuse selectively, not as migrated production records.

B0 adds the missing administrative operating system: durable identity and records, role and site boundaries, real assignment delivery, content governance, qualification steps, action queues, exports, and recovery. It does not require expanding the course catalog or polishing every draft course before the admin foundation works.

## Admin information architecture and dashboard contract

| Area | Primary question and action | B0 view |
| --- | --- | --- |
| Overview | What needs attention today? | Site and date scope; overdue, due soon, unassigned eligible workers, pending site instruction, pending practical evaluation, expiring prerequisites, failed jobs; every figure opens a filtered worklist. |
| People and sites | Who is here, and what work may they do? | Worker roster, status, employer/site/department/role, supervisor, contractor flag, site configuration, import issues, and change history. |
| Programs | What approved training exists? | Five foundational course identities plus the current outlines as applicable; published version, owner, reviewer, legal status, language, site addendum, release history, and draft approval queue. |
| Assignments | Who was assigned what, why, and when? | Individual and rule assignments; recipient preview, due date, recurrence or event trigger, progress, reminders, exceptions, and bulk actions with review. |
| Qualifications | What remains before a worker may perform a task? | Requirement checklist, site instruction, practical evaluation, external prerequisites, evaluator, scope and restrictions, approval or revocation, and next responsible person. |
| Reports and evidence | Can we explain and reproduce the record? | Site/role/course status, due and overdue, completion by version, qualification readiness, exceptions, audit history, and worker evidence export. |
| Settings | Who may administer the system? | Roles, site boundaries, identity connection, notification settings, assignment defaults, retention policy, and integration health. |

Dashboard measures need written definitions. Count **assignments** for course progress and **distinct workers** for worker reach; never mix them in one percentage. The knowledge status partition retains Overdue precedence and sums to all in scope assignments. Report qualification readiness separately: a worker with Knowledge Complete can remain blocked from site training, practical evaluation, medical or fit testing prerequisites, or authorization. Each number exposes denominator, scope, time basis, last refresh, and a drill down to the exact records. No blank or stale feed may silently appear as zero.

## Phased delivery

Each phase is a working vertical slice through data, permissions, interface, and verification. The sequence is dependency based; durations depend on team capacity and pilot access.

| Phase | Working outcome | Required deliverables and exit gate |
| --- | --- | --- |
| **B0.0 Product and beta contract** | The pilot use cases and data meanings are agreed. | Identify pilot employer and two representative sites; map admin, site manager, evaluator, worker, and auditor tasks; define assignment and qualification states, denominator rules, retention and export requirements, and the six end to end scenarios below. HSE reviewer signs off on each initial course's applicability and legal status. Resolve whether “easy to specify to cite” means site tailoring, source citation, or both before authoring the production workflow. Gate: approved data/permission contract and a prioritized pilot backlog. |
| **B0.1 Durable foundation** | A real administrator can sign in and see only permitted sites and workers. | Tenant and site model; identity and role based access; invitations or pilot SSO; durable database; migration path for schema changes; audit event schema; backup and restore; import of pilot people/sites with validation. Rebuild the overview shell against server data. Gate: cross tenant/site access tests, import reconciliation, restore drill, and two admin sessions see the same committed record. |
| **B0.2 Assignment operations** | An admin can assign and follow up on real training. | Course catalog records; manual and group/role/site assignment; reviewed recipient preview; idempotent assignment rules; explicit due and recurrence/event metadata; worker delivery; reminder jobs; exceptions and reassignment history. Preserve the four way knowledge status partition. Gate: hire, role transfer, site transfer, due date change, and duplicate rule run produce correct visible records and audit events. |
| **B0.3 Site qualification and content governance** | The system can capture what the course did and did not qualify a person to do. | Draft, review, publish, retire, and version course/assessment/translation artifacts; site addenda tied to a version; evaluator checklist and signoff; external prerequisite evidence; authorization with scope, restrictions, approver, effective date, and revocation. Block authorization while required evidence is missing. Gate: a changed course or site procedure leaves prior completion evidence intact; an incomplete worker cannot be marked authorized. |
| **B0.4 Operational dashboard and evidence** | Administrators can manage exceptions and answer an audit request. | Action queues and drillable cards from the sections above; saved filters; standard site, worker, assignment, version, and qualification reports; scheduled scoped summaries; CSV export and a human readable worker evidence packet; export access log; data freshness and job failure indicators. Gate: a site admin resolves overdue and evaluation queues, and an auditor reconstructs one worker's history without database access. |
| **B0.5 Beta hardening and pilot acceptance** | A pilot employer can rely on the system within its agreed scope. | Keyboard and screen reader checks; mobile worklist review; language and comprehension path; authorization and tenant penetration checks; load and retry checks for imports/jobs/exports; support and incident runbook; privacy/retention review; onboarding guide and known limits. Gate: pilot scenarios pass with representative admins and evaluators, critical defects are closed, recovery is demonstrated, and the release record states the exact enabled courses, sites, and constraints. |

### Pilot scenarios to prove end to end

1. Add a new worker, set their site and role, preview applicable assignments, and deliver onboarding without a duplicate assignment.
2. Move a worker to a different task or site; show new obligations, retain previous completions, and explain why each assignment exists.
3. Complete a knowledge course while a site addendum and practical evaluation remain open; the dashboard shows the blocker and does not label the worker authorized.
4. Record a practical evaluation and issue a scoped authorization only through an authorized approver; revoke it and preserve the history.
5. Publish a revised course or site procedure; retain the exact prior evidence, assign affected workers according to a reviewed rule, and export both versions' history.
6. Run a late assignment reminder and an export retry twice; each operation is idempotent and its success or failure is visible to an admin.

## Data and control requirements across all phases

- **Identity and privacy:** tenant isolation and least privilege apply in application logic, queries, background jobs, and exports. Separate confidential medical details from training administration; store only the prerequisite status and authorized reference needed for a qualification decision.
- **Evidence:** preserve worker and employer/site/role at the time of training, assignment reason, content and site addendum versions, language, attempt/result, trainer or evaluator, attestations, authorization scope, and change history. Corrections append a superseding event rather than rewriting history.
- **Rules:** show source, owner, effective date, applicable audience, event or interval, last review, and exception reason. Administrators preview who will be affected before activating a rule. Regulatory interpretation requires HSE review; software does not silently make a legal applicability determination.
- **Reliability:** record import and job outcomes, retries, and dead letters; monitor failed notifications and overdue calculations. Define an as of time for dashboards and exports. Restore and reconciliation must be exercised with pilot data.
- **Usability:** an admin starts from an exception and reaches the worker and evidence in a few steps. Compact tables, clear labels, bulk action review, keyboard access, and understandable language are release criteria. [The existing Coursera audit](../coursera-audit/audit-report.md) supplies HSE visual and component guidance, not evidence that the admin product is complete.

## Deliberate beta boundary and decisions to make

B0 should ship standard reports, CSV and worker evidence exports, and a narrow set of validated assignment rules. A general report builder, content marketplace, gamification, AI authored qualification decisions, broad industry packs, and complex HR integrations can follow the beta. SSO may be a pilot entry requirement; full SCIM provisioning should be scheduled when a pilot employer needs it. A pilot requiring a feature outside this boundary must be named in the B0.0 contract, rather than implied by “competitive.”

The [HSE Informer repository](https://github.com/gibsondevhouse/hse-informer) now holds the administrator app and this plan together; product documentation lives in `docs/`. Before implementation, settle the pilot's real roles, site hierarchy, first production courses, data retention terms, notification channels, and the meaning of “specify to cite.” These are product decisions, not blockers to researching or defining B0.
