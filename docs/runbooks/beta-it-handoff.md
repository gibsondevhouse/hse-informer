# Company IT handoff for the beta

**Hosting direction confirmed by the owner: 2026-10-24.** The company's IT team will provide hosting. No rented provider or purchase is selected. The actual server, addresses, access, cost and operating owners still need IT's confirmation.

## Note to share with IT

We are preparing a small HSE Informer beta for administrators and learners. It needs an online test environment that stays available when a developer's computer is off. HSE Informer manages people, assignments and completion records; Moodle delivers every course; Keycloak provides individual sign-in. The beta includes no HSI or DeepHow integration.

Please identify a technical contact and provide a company-approved place to run these services, three secure web addresses, database and file storage, invitation email, and backup/alert services. Existing company infrastructure is welcome. The technical details below are for IT; the product owner does not need to choose a cloud provider or configure servers.

## Information IT should return

| Item | IT response needed |
|---|---|
| Accountable technical contact | Name, deployment operator, backup owner, alert recipient and escalation contact |
| Hosting | Company platform, region, approved access route and expected cost; size against the agreed pilot group and concurrent use |
| Web addresses | Names for the portal, sign-in and courses, who manages DNS and HTTPS certificates, and whether participants need the company network/VPN |
| Databases | Managed PostgreSQL 17 for the pinned Moodle 5.3 stack (validate all pinned service requirements before choosing a newer major); separate HSE, Keycloak and Moodle databases/roles, private connectivity, TLS and point-in-time recovery |
| Persistent files | Moodle course/data files, the exact installed Moodle code/extensions, and application uploads; capacity and growth monitoring |
| Invitations | Approved SMTP service, sender address, delivery restrictions and a test recipient |
| Secrets and deployment | Approved secret manager, restricted CI/host access and image registry or approved image delivery path |
| Recovery | Offsite encrypted backup storage, retention, independently retrievable recovery keys, and accepted recovery time/data-loss window |
| Participant handling | Approved hosting region/support access, privacy contact, retention/deletion decision owner and pilot group/sites |

Return configuration details and access instructions through the company's approved channel. Keep passwords, tokens and recovery keys out of this document, source control and chat.

## Technical starting point

The reviewed code includes production Node images, Moodle with the evidence extension, Keycloak setup, migrations, scheduled synchronization, failure alerts and encrypted recovery tools. [Deployment and recovery](../../infra/beta/README.md), [identity setup](beta-identity.md) and [Moodle setup](beta-moodle.md) describe the operator steps. Use the exact reviewed commit and its pinned versions; validate compatibility with the company's platform before rollout.

The [single-server configuration](../../infra/beta/single-host/README.md) is a tested reference for private startup and recovery. Its local PostgreSQL container and periodic dumps do not provide the managed database or point-in-time recovery required by the beta plan. Adapt the topology for IT's database/storage services and test the actual role privileges, migrations, TLS and recovery. The local database initialization assumes a privileged PostgreSQL operator and cannot be copied blindly to a managed service.

Each service needs only its own database, using a role without superuser, role-creation or database-creation privileges. The HSE database must support `pgcrypto` and the application's table/index/function/trigger migrations. The current deployment uses one HSE database account for migrations, web and jobs; separate runtime and migration roles are not implemented. Keep backup/restore administration credentials separate from the web container and verify that each service is denied access to the other databases. Validate database TLS certificate/hostname verification and approved CA trust for all three service clients on the actual platform.

Expose only the approved HTTPS ingress. Keep databases and application/service ports private; restrict administrative access. Configure the real OIDC/Moodle callbacks (`https://APP_HOST/auth/callback` and `https://COURSES_HOST/admin/oauth2callback.php`) and scoped service accounts, individual administrator MFA, proxy trust and rate limits. Keep the ordinary Moodle service token separate from its restricted identity-bridge token. Never use the disposable development fixture or development authentication for participant data. Operate Moodle cron as well as HSE's five-minute synchronization worker, with alerts for failures. Confirm DNS/certificate renewal, independent uptime checks, disk/backup monitoring, and alert receipt by the named person.

## Before participants receive access

The deployment operator must record the chosen topology and owners, deploy the reviewed images through the approved CI path, apply migrations, and exercise application rollback. Verify sign-in and invitations; an approved course's launch, cross-device resume, failed/passed attempts and completion synchronization; deactivation/sign-out; and cross-user/site/tenant denials on this environment. Test automated accessibility and complete a manual keyboard/screen-reader pass.

Restore the coordinated databases and files into an isolated environment using the offsite archive and independently retrieved key. Verify evidence history and working restored services, measure the recovery window, and confirm the original environment is untouched. Test the managed database's point-in-time recovery separately. CI rehearsals establish the tools' behavior; they do not establish this host's recovery, mail or network configuration.

The product owner still approves course content and the completed [participant privacy note](../../infra/beta/participant-privacy-note.md), selects participants, and accepts the [focused test run](../plans/beta/09-test-run.md). This handoff records the hosting direction; it does not claim deployment or participant acceptance.
