# Local integration environment

This is a **development fixture**, not a production deployment. It starts PostgreSQL 17 for HSE Informer, Keycloak 26.7.3 for individual sign-in, and two independent instances of unmodified Moodle 5.3.0. HSE Informer's synthetic seed defines Tifton, Ocilla, and Vernon for company A; company B exists only to test isolation. The Moodle image uses the [official 5.3.0 package](https://download.moodle.org/download.php/direct/stable503/moodle-5.3.tgz) and verifies its published SHA-256 before extraction. Moodle 5.3 requires PHP 8.3 and PostgreSQL 17 and serves from `public/` ([release requirements](https://moodledev.io/general/releases/5.3), [install guide](https://docs.moodle.org/503/en/Installation_quick_guide)).

## Start

Docker Compose is required. Docker is unavailable on this machine, so stack startup and external integrations remain unverified here. A local Homebrew PostgreSQL 16 installation was available for HSE schema tests; Moodle 5.3 still requires PostgreSQL 17, provided by this Compose stack.

```sh
cp infra/.env.example infra/.env
# Replace every development password and secret in infra/.env.
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
python3 infra/scripts/check-stack.py
```

URLs: Keycloak `http://auth.localhost:8080`, company A Moodle `http://localhost:8081`, company B Moodle `http://localhost:8082`, and HSE PostgreSQL `localhost:54329`. Keycloak imports the `hse-dev` realm on its first start. Its confidential clients are `hse-web`, `moodle-company-a`, and `moodle-company-b`; each has a different secret from `.env`. The exact HSE callback is `http://localhost:5173/auth/callback`. The Moodle callbacks use each site's `/admin/oauth2callback.php` path. A synthetic company A admin and two workers have stable Keycloak subject IDs; HSE Informer's synthetic seed maps them to tenant-scoped principals. Their password is `DEV_WORKER_PASSWORD`. Tenant and site authorization still belongs to HSE Informer's database and server; Keycloak groups are identity hints, not an authorization shortcut. Keycloak skips realm import after the first startup, so changing `.env` later does not rotate existing client secrets or user passwords.

For the SvelteKit app on the host, use `DATABASE_URL=postgres://hse:<HSE_DB_PASSWORD>@localhost:54329/hse`, `OIDC_ISSUER=http://auth.localhost:8080/realms/hse-dev`, `OIDC_CLIENT_ID=hse-web`, and `OIDC_CLIENT_SECRET=<HSE_OIDC_CLIENT_SECRET>`. These values must stay server-side. If `auth.localhost` does not resolve to loopback on the host, add a local hosts entry. Inside Compose, `auth.localhost` is a Keycloak network alias, so Moodle uses the same issuer URL without routing through a published host port. Published development web ports are bound to host loopback.

Use `docker compose --env-file infra/.env -f infra/compose.yaml down` to stop services. Volumes intentionally persist. Removing volumes deletes only this synthetic local environment.

## Configure the pilot

1. Log in to each Moodle site as `admin` with `MOODLE_ADMIN_PASSWORD`. In Keycloak's imported realm, inspect the three clients and create individual accounts as needed. The two synthetic workers are for isolation tests only.
2. In each Moodle site, enable core **OAuth 2** authentication and create a custom OpenID Connect OAuth 2 service whose issuer is `http://auth.localhost:8080/realms/hse-dev`, using that site's own Keycloak client ID and secret. Check the callback URL before saving. Moodle's [OAuth 2 service guide](https://docs.moodle.org/503/en/OAuth_2_services) describes discovery and the callback. Validate actual browser sign-in for both synthetic workers; a realm import alone does not configure Moodle authentication.
3. In company A, create cohorts for Tifton, Ocilla, and Vernon. Create a dedicated web-service account with only the approved integration capabilities. Enable web services and REST, create a custom service with the documented functions the app uses, and issue a token for that service. Do the same independently in company B. Store each token only in the SvelteKit server environment, never in the browser or Git. See Moodle's [web-service setup](https://docs.moodle.org/503/en/Using_web_services).
4. Build the synthetic SCORM 1.2 package with `python3 infra/scorm/build.py`. Upload `infra/scorm/synthetic-scorm-1.2.zip` as a SCORM activity in a company A test course. Set Moodle's activity and course completion criteria, enroll `synthetic.worker.a` through the HSE server, click **Record synthetic completion**, then capture the recorded completion time, score, attempt, and response from the documented completion read. Repeat after re-enrollment, reset, and a new content version. The package does not represent DeepHow content or approved training.
5. Once both service tokens can call `core_webservice_get_site_info`, run `MOODLE_A_TOKEN=... MOODLE_B_TOKEN=... python3 infra/scripts/verify-moodle-isolation.py`. This checks that each token works only on its own instance. CI creates one-hour, synthetic probe tokens with `bootstrap-isolation.php` for this test; these admin-owned probe tokens must never be used by the HSE app. Also test Moodle UI access: worker B must not see company A's course, enrollment, or completion. Run the HSE API's cross-tenant tests in CI separately.

Record the real DeepHow export's format, version ID, checksum, Moodle completion behavior, and any failed assumptions in `docs/refactor-001.md` before moving past Gate A or B. The external pilot, Moodle OAuth setup, tenant UI test, and HSI backfill remain **pending**, not passed. No live DeepHow, HSI, or real employee data belongs in this stack.

## CI boundary

`.github/workflows/ci.yml` validates the Compose and realm files, runs the frozen React preview tests, the SvelteKit checks and PostgreSQL integration tests, the synthetic SCORM package check, the synthetic HSI reconciliation tests, and a two-instance Moodle token-isolation probe. The latter checks the instance boundary, not per-user Moodle UI authorization. CI does not assert that a real DeepHow export imports, that Moodle records the expected completion fields, or that a historical HSI record can be backfilled. A release still needs the learner UI isolation check and the Gate A/B/C evidence.
