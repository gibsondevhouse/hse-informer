# Five starter requirement records

**ALL FIVE RECORDS ARE UNAPPROVED.** These are implementation fixtures based on the five preview course families, not approved legal interpretations, released courses, assignment rules, or qualifications. No production rule may activate until a named qualified HSE reviewer verifies authority, jurisdiction, legal status, applicability, delivery, recurrence, evidence, and site content for each company/site. See [the domain contract](../contracts/domain.md) and [product direction](../vision/phases.txt).

Each record is a proposed requirement *family*, not one universal assignment. `TBD by HSE review` is an intentional unresolved field. Any missing applicability input yields `needs_review`; it must not assign the course to all staff by default. The 48 preview lesson titles and draft respiratory lesson are reference syllabi only.

## R-001 — Respiratory Protection: required use

| Field | Draft value |
|---|---|
| Approval and authority | **UNAPPROVED**. Applicable authority/citation, state overlay, and employer respiratory program: **TBD by HSE review**. |
| Legal-status label | **Pending review**; do not display as a verified federal requirement yet. |
| Proposed applicability and audience | Workers whose assigned tasks/site program require respirator use. Inputs: site, task, exposure/program determination, respirator type and work area. Voluntary use must be a separate path, not absorbed into this record. |
| Proposed delivery constraints | DeepHow knowledge module alone is insufficient for authorization. Require verified site procedure, respirator-specific instruction/demonstration, and any clearance/fit-test evidence that the approved rule calls for. Keep confidential medical answers outside HSE Informer. |
| Proposed recurrence and retraining | Annual training and fit-test review are planning hypotheses from `phases.txt`; HSE reviewer must verify exact triggers, interval, exceptions, and source before activation. Procedure, respirator, task, exposure, or demonstrated-understanding changes are candidate event triggers. |
| Proposed record requirements | Course/version, language, completion/assessment, site addendum/procedure version, respirator make/model/size or relevant scope, clearance/fit-test **status and date only**, evaluator/approval, restrictions and authorization decision. |
| Site overlay | Required for actual respirators, filters/cartridges, procedures, hazards, emergency limitations, and program contacts at Tifton, Ocilla, or Vernon as applicable; content owner and version **TBD**. |

## R-002 — Lockout/Tagout: authorized employee

| Field | Draft value |
|---|---|
| Approval and authority | **UNAPPROVED**. Applicable authority/citation, state overlay, and employer energy-control program: **TBD by HSE review**. |
| Legal-status label | **Pending review**. |
| Proposed applicability and audience | Workers assigned to perform energy-control tasks on identified equipment. Inputs: site, machine/process, task, authorized role, procedure version. Affected/other employees require a separately reviewed path. |
| Proposed delivery constraints | Knowledge module plus actual site/machine procedure and observed application/removal where the approved program requires it. A Moodle completion does not grant authorization. |
| Proposed recurrence and retraining | Event-driven candidates: new or changed machine, process, procedure, role, hazard, observed deviation, or knowledge gap. HSE reviewer must set any interval and exact triggers; do **not** infer annual retraining from a procedure-inspection schedule. |
| Proposed record requirements | Course/version, procedure/version and equipment scope, assignment reason, training/assessment, practical checklist/result, evaluator qualification, employee/evaluator attestations, approval and restrictions. |
| Site overlay | Required machine-specific procedures, energy sources, isolation points, group/shift-change practices, and local contacts; version and owner **TBD**. |

## R-003 — Permit-required confined space: site role

| Field | Draft value |
|---|---|
| Approval and authority | **UNAPPROVED**. Space classification, applicable authority/citation, state overlay, permits, and employer program: **TBD by HSE review**. |
| Legal-status label | **Pending review**. |
| Proposed applicability and audience | Staff explicitly assigned a defined site-space role, such as entrant, attendant, supervisor, tester, permit issuer, or rescue role. Inputs: site, identified space, hazards, permit/program status, role and tasks. |
| Proposed delivery constraints | National concepts must be supplemented by the site's actual spaces, permit, hazards, monitoring, ventilation, communication, retrieval and emergency arrangements. Role competency and any practical signoff must be verified separately from knowledge completion. |
| Proposed recurrence and retraining | Duty, space, hazard, procedure, equipment, permit, or demonstrated-performance changes are candidate triggers. Exact intervals and evidence requirements **TBD by HSE review**; no automatic annual expiry. |
| Proposed record requirements | Employee/role, space/permit and procedure version, content/assessment, site instruction, practical checklist/result if applicable, trainer/evaluator identity and qualifications, date, restrictions, authorization. |
| Site overlay | Required space inventory and actual permit/emergency process for each site that uses this requirement; version and owner **TBD**. |

## R-004 — Chemical Hygiene: laboratory scope

| Field | Draft value |
|---|---|
| Approval and authority | **UNAPPROVED**. First determine whether a given site/work area has a covered laboratory and a chemical hygiene plan; applicable authority/citation and state overlay **TBD by HSE review**. |
| Legal-status label | **Pending review**. The preview title is not proof that all plant chemical workers need this course. |
| Proposed applicability and audience | Workers in a verified covered laboratory who perform tasks within its chemical hygiene program. Inputs: site, laboratory/work area, duties, chemicals/exposure group, program/plan version. Non-laboratory chemical work must be evaluated under its own applicable requirements. |
| Proposed delivery constraints | DeepHow general concepts plus the actual laboratory plan, hazards, controls, PPE, equipment, response procedures, and opportunity to confirm comprehension; HSE reviewer decides whether practical evidence is needed for each task. |
| Proposed recurrence and retraining | Plan, hazard, task, control, chemical or procedure changes are candidate triggers. Any periodic requirement is **TBD by HSE review**; no blanket expiry. |
| Proposed record requirements | Course/version, plan/procedure version, work area and chemicals/tasks in scope, language, assessment, site instruction and comprehension, trainer/evaluator and practical evidence where required. |
| Site overlay | Required laboratory-specific plan and procedures where a laboratory exists; no site overlay is published for a site without an approved applicability determination. |

## R-005 — Hazard Communication: exposed work area

| Field | Draft value |
|---|---|
| Approval and authority | **UNAPPROVED**. Applicable authority/citation, state overlay, employer HazCom program, and area hazards: **TBD by HSE review**. |
| Legal-status label | **Pending review**. |
| Proposed applicability and audience | Workers with relevant chemical hazards in assigned work areas/tasks. Inputs: site, work area, chemical/hazard group, role, SDS/labeling and program scope. |
| Proposed delivery constraints | General concepts plus the employer's actual chemical hazards, labels, SDS access, controls, and emergency procedures; verify language and comprehension. Knowledge completion is not proof of site instruction. |
| Proposed recurrence and retraining | Initial assignment and newly introduced hazards are candidates from `phases.txt`. HSE reviewer must verify exact triggers and jurisdiction; do not create an automatic annual generic-course cycle. |
| Proposed record requirements | Course/version, chemical/hazard scope, site addendum/program version, language, assessment/comprehension, assignment reason, completion date, trainer/employee acknowledgment where required. |
| Site overlay | Required actual work-area chemical inventory/hazards, labels, SDS access, controls, and emergency response; version and owner **TBD**. |

## Approval record to complete before activation

For **each** record, capture: reviewer name and qualification, employer/site/jurisdiction scope, cited source and revision/date, final legal-status label, approved rule/version, delivery/practical requirements, recurrence and trigger rationale, required record fields, site addendum owner/version, decision date, and next review date. A reviewer may split a family into narrower role-specific requirements. The approval event must be immutable and linked to the exact requirement version. Until then, test fixtures may use these records only with `synthetic=true` and no production assignment or claim.
