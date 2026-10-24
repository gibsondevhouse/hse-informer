# Local integration environment

This is a **development fixture**, not a production deployment. It starts PostgreSQL 17 for HSE Informer, Keycloak 26.7.3 for individual sign-in, and two independent instances of unmodified Moodle 5.3.0. HSE Informer's synthetic seed defines Tifton, Ocilla, and Vernon for company A; company B exists only to test isolation. The Moodle image uses the [official 5.3.0 package](https://download.moodle.org/download.php/direct/stable503/moodle-5.3.tgz) and verifies its published SHA-256 before extraction. Moodle 5.3 requires PHP 8.3 and PostgreSQL 17 and serves from `public/` ([release requirements](https://moodledev.io/general/releases/5.3), [install guide](https://docs.moodle.org/503/en/Installation_quick_guide)).

## Start

Docker Compose is required. Docker is unavailable on this machine, so stack startup and external integrations remain unverified here. A local Homebrew PostgreSQL 16 installation was available for HSE schema tests; Moodle 5.3 still requires PostgreSQL 17, provided by this Compose stack.

```sh
cp infra/.env.example infra/.env
# Replace every development password and secret in infra/.env.
infra/scripts/prepare-dev-tls.sh
export NODE_EXTRA_CA_CERTS="$PWD/infra/.dev-tls/ca.crt"
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
python3 infra/scripts/check-stack.py
```

URLs: Keycloak `https://auth.localhost:8443`, company A Moodle `http://localhost:8081`, company B Moodle `http://localhost:8082`, and HSE PostgreSQL `localhost:54329`. Keycloak imports three realms on first start: `hse-dev` for HSE Informer, `moodle-company-a` for company A Moodle, and `moodle-company-b` for company B Moodle. Each interactive client is confidential and exists only in its designated realm. The exact HSE callback is `http://localhost:5173/auth/callback`; the Moodle callbacks use each site's `/admin/oauth2callback.php` path. Both synthetic workers exist in `hse-dev` because HSE Informer serves both tenants, while each Moodle realm contains only its own worker. Their password is `DEV_WORKER_PASSWORD`. HSE Informer's synthetic seed maps `(issuer, subject)` to tenant-scoped principals. The fixture gives each realm user a distinct subject UUID; a production link must use the HSE-generated stable ID and verified external mappings, including Moodle's `idnumber`. The separate synthetic SSO probe below configures an additional `moodle-hse-a` client in `hse-dev` to test the actual portal identity path; the two dedicated Moodle realms remain credential-isolation fixtures. Tenant and site authorization still belongs to HSE Informer's database and server; Keycloak groups are identity hints, not an authorization shortcut. Keycloak skips realm import after the first startup, so changing `.env` later does not rotate existing client secrets or user passwords.

For the SvelteKit app on the host, use `DATABASE_URL=postgres://hse:<HSE_DB_PASSWORD>@localhost:54329/hse`, `OIDC_ISSUER=https://auth.localhost:8443/realms/hse-dev`, `OIDC_CLIENT_ID=hse-web`, and `OIDC_CLIENT_SECRET=<HSE_OIDC_CLIENT_SECRET>`. These values must stay server-side. If `auth.localhost` does not resolve to loopback on the host, add a local hosts entry. Inside Compose, `auth.localhost` is a Keycloak network alias, so Moodle uses its own realm issuer URL without routing through a published host port. Published development web ports are bound to host loopback. Keycloak uses a generated, short-lived development CA and HTTPS leaf certificate; Moodle 5.3 requires HTTPS issuer and endpoint URLs. The fixture mounts only the server certificate/key into Keycloak and only the public CA into Moodle. Python probes trust that CA explicitly, and Node uses `NODE_EXTRA_CA_CERTS`. Import the CA into a disposable browser trust store before interactive sign-in. Do not install this synthetic CA into production or a personal system trust store.

Use `docker compose --env-file infra/.env -f infra/compose.yaml down` to stop services. Volumes intentionally persist. Keycloak does not update an existing realm on import; a stack created before the three-realm split can still contain the old Moodle clients in `hse-dev`. The live client-placement probe below fails in that case. Remove those old clients through Keycloak administration or reset this disposable synthetic stack with `down -v` before trusting an isolation result. Removing volumes deletes only this synthetic local environment.

## Configure the pilot

1. Log in to each Moodle site as `admin` with `MOODLE_ADMIN_PASSWORD`. Inspect its dedicated Keycloak realm and create individual accounts there as needed. The two synthetic workers are for isolation tests only. The `moodle-*-isolation-probe` clients permit password grants solely for the development CI credential test; the real Moodle clients retain authorization-code flow and disable password grants. Do not copy probe clients into a live realm.
2. For the HSE portal path, use the same realm issuer as HSE and the restricted automatic identity bridge in [identity operations](../docs/runbooks/beta-identity.md#automatic-moodle-login-binding). The synthetic SSO bootstrap below creates company A's `hse-dev` issuer with client `moodle-hse-a`, exact callback, required confirmation, subject mapping, immutable identity locks, and automatic account creation disabled. It creates no per-person links. The separate Moodle realms and clients are retained for negative credential-isolation tests. [Moodle’s OAuth 2 guide](https://docs.moodle.org/503/en/OAuth_2_services) describes discovery and callbacks.
3. In company A, create cohorts for Tifton, Ocilla, and Vernon. Create a dedicated web-service account with only the approved integration capabilities. Enable web services and REST, create a custom service with the documented functions the app uses, and issue a token for that service. Do the same independently in company B. Store each token only in the SvelteKit server environment, never in the browser or Git. See Moodle's [web-service setup](https://docs.moodle.org/503/en/Using_web_services).
4. Build the synthetic SCORM 1.2 package with `python3 infra/scorm/build.py`. Hosted CI stages this package using Moodle's course/module/file APIs, launches it in a browser as a disposable manual-auth learner, and reads attempts, SCO tracks, activity status, and course status through documented web services. The [observed fixture result](../docs/refactor-001-progress.md) is a plumbing check; it does not exercise HSE server enrollment, Keycloak OAuth account linking, re-enrollment, reset, or a new content version. For the live pilot, upload the real course package after its format is reviewed, enroll the HSE-mapped learner through the server, and capture the exact Moodle behavior for those cases. The synthetic package does not represent approved training.
5. Run `DEV_WORKER_PASSWORD=... KEYCLOAK_ADMIN_PASSWORD=... python3 infra/scripts/verify-keycloak-isolation.py` to confirm each synthetic worker gets a token only in its own Moodle realm, foreign clients are rejected, and live clients are placed in the correct realms. Once both Moodle service tokens can call `core_webservice_get_site_info`, run `MOODLE_A_TOKEN=... MOODLE_B_TOKEN=... python3 infra/scripts/verify-moodle-isolation.py`. This checks that each token works only on its own instance. CI creates one-hour, admin-owned synthetic pilot tokens with `bootstrap-pilot.php` for both the REST pilot and this cross-instance check; these tokens must never be used by the HSE app. Also test Moodle UI access after OAuth setup: worker B must not see company A's course, enrollment, or completion. Run the HSE API's cross-tenant tests in CI separately.

Record the real course package's format, version ID, checksum, Moodle completion behavior, and any failed assumptions in `docs/refactor-001.md` before moving past the Moodle delivery gate. The external pilot, Moodle OAuth setup, tenant UI test, remain **pending**, not passed. No real employee data belongs in this stack.

## CI boundary

`.github/workflows/ci.yml` validates the Compose and realm files, runs the frozen React preview tests, the SvelteKit checks and PostgreSQL integration tests, the synthetic SCORM package check, the synthetic HSI reconciliation tests, a per-company Keycloak credential denial probe, and two-instance Moodle token, REST provisioning, enrollment, cohort, and incomplete-completion probes. It also browser-runs the synthetic SCORM package on Moodle 5.3.0 and reads its attempt, score, activity timestamp, and course status. [SCORM run 38169852450](https://github.com/gibsondevhouse/hse-informer/actions/runs/38169852450) and [cohort run 38170568941](https://github.com/gibsondevhouse/hse-informer/actions/runs/38170568941) passed these synthetic checks. The separate SSO probe below exercises the production bridge, exact linked accounts, and foreign unprovisioned user denial; its runtime result must be checked independently. The real HSE-to-Moodle pilot still needs deployed verification. CI does not assert that a real course package imports, that its completion semantics match this fixture, or that untested content is valid for release. A release still needs the learner UI isolation check and the Moodle delivery evidence.


## Synthetic Moodle SSO probe

This probe requires the REST pilot to have provisioned its worker and the synthetic SCORM bootstrap to have created its course. All data is disposable and grants no training credit. `bootstrap-oauth.php` creates only issuer/service configuration; both worker links are established by the production external bridge. Its dedicated service user receives only the REST, custom link, and normal OAuth link capabilities. Technical email remains unverified, notifications are disabled, and confirmation/self-registration policies stay enforced. For local Docker networking, the bootstrap removes only the resolved Keycloak IPv4 address from Moodle’s blocked-host ranges and adds port 8443; the rest of its HTTP block list remains intact.

After preparing TLS, install the public CA into the **disposable CI Chromium profile** (Ubuntu example; `libnss3-tools` supplies `certutil`):

```sh
mkdir -p "$HOME/.pki/nssdb"
certutil -N -d "sql:$HOME/.pki/nssdb" --empty-password
certutil -A -d "sql:$HOME/.pki/nssdb" -n hse-dev -t 'C,,' -i infra/.dev-tls/ca.crt
export NODE_EXTRA_CA_CERTS="$PWD/infra/.dev-tls/ca.crt"
export KEYCLOAK_URL=https://auth.localhost:8443
```

Load the fixture environment without echoing secrets. Keep `A` and `SCORM` from the existing pilot/SCORM bootstrap commands, then run:

```sh
OAUTH="$(docker compose --env-file infra/.env -f infra/compose.yaml exec -T -u www-data \
  -e MOODLE_A_OIDC_CLIENT_SECRET="$MOODLE_A_OIDC_CLIENT_SECRET" \
  moodle-a php /opt/hse/bootstrap-oauth.php)"
# In CI mask $(jq -r .bridgeToken <<<"$OAUTH") before any later output.
MOODLE_A_PILOT="$A" MOODLE_SCORM_FIXTURE="$SCORM" MOODLE_OAUTH_FIXTURE="$OAUTH" \
  node infra/scripts/verify-moodle-sso.cjs
```

The script checks exact idempotent bindings and rejection cases, then signs in two REST-provisioned learners through real Keycloak/Moodle browser redirects and launches the actual SCO. It checks `M.cfg.userId` against the expected Moodle user, rereads the immutable HSE ID/email, confirms technical notification suppression, and rejects an unprovisioned company B identity without creating an account. Its output is `infra/moodle-sso-evidence.json`; failed browser navigation produces `infra/moodle-sso-failure.png` with credential inputs masked and diagnostics without URL queries. The live CI runtime result and deployed staging acceptance remain separate gates; static checks do not establish SSO success.

## Joined beta account and learning journey

The CI step **Verify the joined beta account and Moodle learning journey** runs `verify-beta-journey.ts` against the same real providers and an empty, migrated HSE database on loopback port 54329. It requires `HSE_BETA_JOURNEY_FIXTURE=1`, refreshed pilot/SCORM/OAuth fixture JSON, the development secrets, and trusted development TLS. It refuses production mode, development authentication bypasses, foreign endpoints, or an HSE database containing a tenant. Do not seed the regular synthetic workspace into this database first.

The journey signs an administrator into the actual HSE application with password and OTP, creates a phone-only profile in the UI, issues and redeems a hashed one-time activation code, and signs the learner in through HSE's real OIDC callback. Authenticated administration publishes an exact practice mapping and assigns its selected version. Production outbox code provisions the technical identity, suppresses notifications, binds the active principal through the restricted OAuth bridge, and enrolls the learner. The learner opens Moodle through the portal, authenticates the same individual identity, and commits the real synthetic SCO. Supported Moodle completion tasks and production reconciliation must produce the exact source completion time, score, attempt count, package/version snapshot, learner history, and administrator record. Reconciliation must remain idempotent. Deactivation must reject the existing HSE session, suspend Moodle and end its existing browser session, reject fresh identity sign-in, and preserve the original completion.

Run the guard tests with `node --test infra/scripts/test-beta-journey.cjs`; CI supplies the protected fixture environment before running `./web/node_modules/.bin/tsx infra/scripts/verify-beta-journey.ts`. The output is `infra/beta-journey-evidence.json`; failures include the phase, destinations without URL queries, and masked `infra/beta-journey-admin-failure.png` / `infra/beta-journey-worker-failure.png`. The generated identity is removed during cleanup; HSE/Moodle fixture data remains only in disposable volumes until workflow teardown.

The joined probe is implemented; its actual CI outcome must be checked before claiming this journey passed. A green synthetic run establishes these connected application/provider paths, while deployed SMTP, restricted service-role permissions, content approval, browser accessibility, recovery, and actual participant acceptance remain separate checks. The development AMR flow prompts for credentials again for Moodle's client; it proves the same federated identity and callbacks, without proving a single-prompt experience. Native server-graded Quiz retry/resume/attempt-limit behavior is exercised by the separate native practice probe, not by this SCORM package.
