# One server option

This option puts the beta application, sign-in service, course player, databases, and worker on **one Linux server**, using three addresses on a domain you control: `app.your-domain`, `auth.your-domain`, and `courses.your-domain`. One private settings file holds the generated passwords and configuration. It is an alternative to the [separately hosted services option](../README.md).

**Prepared, not deployed:** no server, DNS record, certificate, account, or public URL has been created. Docker is unavailable on the implementation machine. Image builds, first startup, TLS, real sign-in/course playback, coordinated sign-out, backups, and recovery still need verification on the chosen server before participants use it.

## Operator setup

After the owner chooses the server and domain, an operator can use this path. It requires Linux with Docker Compose, Git, and Python 3. Point the three DNS names at that server; allow only SSH from approved administrators and public ports 80/443. PostgreSQL has no published port. Other service ports bind to loopback.

1. Check out the clean reviewed commit. Generate one private settings file **outside the checkout**, replacing the domain, owner email, and commit SHA:

   ```sh
   export BETA_ENV_FILE="$HOME/.config/hse-beta/beta.env"
   python3 infra/beta/single-host/prepare.py create \
     --domain your-domain.example --admin-email owner@your-domain.example \
     --image-tag REVIEWED_FULL_COMMIT_SHA --output "$BETA_ENV_FILE"
   ```

   This writes fresh secrets with mode 600 and starts nothing. `SMTP_FROM` defaults to the supplied administrator email and must remain a valid sender address for Keycloak realm startup. Add the organization's SMTP delivery settings to that same file, using a verified sender if the mail provider requires one. The initial administrator bootstrap sends an invitation and requires working email. Configure the alert recipient/webhook and public `AGE_RECIPIENT` recovery key before enabling jobs and backups. Keep the private age identity separately. No sample workers, company data, learner passwords, or development authentication are installed.
2. Build the reviewed application/tools images, checksum-verified Moodle base, evidence-plugin Moodle image, and recovery image:

   ```sh
   sh infra/beta/single-host/build.sh
   ```

   This builds locally without requiring a registry account, and starts nothing. The image tags use the full Git commit. Existing registry/CI workflows may build and distribute the same tags instead.
3. When public startup has been approved, validate and start this option with its optional Caddy HTTPS proxy:

   ```sh
   python3 infra/beta/single-host/prepare.py validate --env-file "$BETA_ENV_FILE"
   docker compose --env-file "$BETA_ENV_FILE" -f infra/beta/single-host/compose.yaml --profile tls up -d
   ```

   Omitting `--profile tls` keeps only loopback service ports for an operator-supplied HTTPS ingress. It does not make HTTP a supported sign-in mode. Caddy obtains certificates for the configured names; DNS and public connectivity must work first.

The initial databases and Moodle site use only supplied/generated credentials. Keycloak imports a production-mode beta realm with the interactive app/Moodle clients, completed-authentication AMR flow, and restricted account service; it imports no synthetic people. Imports happen only for an empty realm. Changing the settings file later does not rotate existing database/user/client credentials or update an imported realm's SMTP configuration; update existing provider configuration through its administration tools.

Configuration validation checks the sender's syntax, not mail delivery. The private CI smoke uses `owner@single-host.test`, leaves `SMTP_HOST` unset, and isolates runtime networks; it sends no email. Real SMTP authentication, provider-approved sender, and invitation receipt remain deployment checks.

## Finish the beta setup

Use [initial tenant and identity setup](../../../docs/runbooks/beta-identity.md) and [Moodle setup](../../../docs/runbooks/beta-moodle.md) to create the real administrator/sites, enable the dedicated OAuth client, configure the restricted Moodle service and approved course mappings, and verify SMTP. The Moodle client is `hse-moodle`, its callback is `https://COURSES_HOST/admin/oauth2callback.php`, and its secret is `MOODLE_OIDC_CLIENT_SECRET` in the same private settings file. Configure only the documented read/course/user-state operations plus the explicit `local_hse_evidence_end_user_sessions` capability. Do not issue a site-administrator service token.

For native Quiz courses, the ordinary learning service also needs `mod_quiz_get_quizzes_by_courses` and `mod_quiz_get_user_quiz_attempts`, with `mod/quiz:view` and `mod/quiz:viewreports` restricted to approved course/module contexts. Configure the exact Quiz instance and course-module IDs on the HSE course version, separately from any SCORM mapping. These reads do not belong to the identity bridge token and require no Quiz-write capabilities. Verify returned identity/activity and attempt observations using the restricted service before publishing; course completion time and course grade continue to come from the completion plugin.

For the initial bootstrap, the tools image is available through the `jobs` service: an operator may override its entrypoint with `node_modules/.bin/tsx`, mount the private tenant JSON read-only, and run `scripts/bootstrap-tenant.ts /tmp/tenant.json`. The environment already contains the private DB and identity endpoints. SMTP must be tested first; failed invitation delivery rolls back bootstrap.

Once the tenant exists and the restricted Moodle token has been issued, put `HSE_TENANT_ID` and `MOODLE_SERVICE_TOKEN` together into the same file. Also set `MOODLE_OAUTH_ISSUER_ID` to the actual Moodle OAuth issuer ID and `MOODLE_OAUTH_BRIDGE_TOKEN` to a separate token for the `hse_identity_bridge` service. That restricted service exposes only `local_hse_evidence_link_oauth_login` and requires `local/hse_evidence:linkoauth` plus `auth/oauth2:managelinkedlogins`; keep its token separate from the ordinary course/user-state service token. The bridge binds the active Keycloak subject to Moodle before enrollment, including learners without email. Core startup is possible before these operational settings exist; starting the worker requires them. Then:

```sh
python3 infra/beta/single-host/prepare.py validate --env-file "$BETA_ENV_FILE" --mode operations
docker compose --env-file "$BETA_ENV_FILE" -f infra/beta/single-host/compose.yaml --profile tls --profile operations up -d
```

The worker processes Moodle reconciliation and account state; it does not schedule advanced reassignment. Test a real user's invite/printed activation, MFA as required, course launch/resume/fail/retry/pass, captured score/time, suspension and coordinated sign-out, site/tenant denials, and alert receipt. Enabling the worker is not proof these checks passed. Publish the participant address only after these checks and the beta acceptance gates pass.

## Persistent data and recovery

| Recovery item | Storage in this option |
|---|---|
| HSE, Keycloak, and Moodle databases | `postgres-data`, with separate `hse_app`, `keycloak`, and `moodle` owner roles/databases; cross-database `PUBLIC CONNECT` revoked |
| Moodle course/upload files | `moodle-data` mounted at `/var/moodledata` |
| Moodle core, config, installed evidence extension | Exact reviewed `-moodle` image, copied from its container for each backup |
| App/media upload directory | `app-uploads`; reserved for app uploads, with current course files stored in Moodle |
| Caddy certificate state | `caddy-data` and `caddy-config`; retain these or reissue certificates during isolated recovery |
| Credentials and stable instance ID | The one private settings file, protected and backed up separately with the recovery keys |

`sh infra/beta/single-host/backup.sh /absolute/protected/backup-directory` stops the previously running application, identity, Moodle and worker writers for a short maintenance window, copies the exact Moodle code, and runs the existing encrypted three-database/files backup tool on the private Docker network. It restarts only the services that had been running. The recovery container has read-only access to data/files and the read-search capability needed for files owned by service users. The result is an age-encrypted archive with counts/checksums and an evidence-lineage digest. Back up the settings file and Caddy volumes separately; the archive alone is not the complete secret/certificate recovery set.

Copy encrypted backups off this server to protected storage, alert on missing/failed backups, and exercise [isolated restore](../README.md#restore-into-isolation) including the three services and files. A single server/volume is a shared failure point; periodic dumps alone do not provide point-in-time recovery or high availability. Keep participants out until the owner accepts the backup/recovery window and the actual restore succeeds.

The separate [private recovery CI workflow](../../../.github/workflows/beta-recovery.yml) exercises the unchanged `recovery.py` backup and restore commands on ephemeral Linux storage. It stops all source writers, encrypts all three databases and Moodle code/data/app uploads with a temporary age key, restores into a second project with fresh databases and volumes, and compares table counts, completion correction/void lineage, and every file's path/content/ownership/permissions. It then starts the recovered application, Keycloak and Moodle and reads a restored file through Moodle's file API. Both runtime networks are private, the target publishes no ports, and settings, archives, data files and keys are excluded from artifacts. Only measured evidence and redacted failure diagnostics are uploaded. A green run verifies these mechanics; the chosen server's offsite archive/key retrieval, DNS/TLS, recipient delivery and recovery window still require an operator drill. Until the workflow passes, this remains an unexecuted check.

## Proxy and version checks

The application trusts one forwarded-address hop (`ADDRESS_HEADER=x-forwarded-for`, `XFF_DEPTH=1`). Caddy overwrites that header with the immediate client address, and the app port stays private/loopback. Do not expose port 3000 directly or add another proxy/CDN without reviewing that trust boundary and shared rate limiting. The app's `/api/health` checks database readiness; separate external monitoring and the named alert recipient are still required.

The Moodle upstream receives its internal `Host: moodle`, with `reverseproxy` and `sslproxy` enabled. An alternative HTTPS proxy must preserve this host handling: Moodle's [reverse proxy implementation](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/lib/setuplib.php) rejects the public Host when its reverse-proxy mode is enabled.

Keycloak is pinned to the repository's 26.7.3 version; PostgreSQL is major 17. Moodle reuses the existing 5.3.0 archive and SHA-256 verification and adds the existing `hse_evidence` extension without changing core. Caddy uses the reviewed [2.10.2 release](https://github.com/caddyserver/caddy/releases/tag/v2.10.2); the HTTPS proxy settings follow Moodle's [documented reverse/SSL proxy configuration](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/config-dist.php). Review image digests and upstream security updates before live deployment, then verify this exact bundle on the server.
