#!/usr/bin/env python3
"""CI-only production image/startup smoke; no public TLS, deployment or invitations.

The production Compose file is used unchanged. A generated CI override isolates
its edge network, so containers cannot send mail, alerts or provider requests.
Settings and keys stay outside the checkout and never enter uploaded artifacts.
"""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from urllib.parse import quote, quote_plus
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
STACK = ROOT / "infra/beta/single-host"
PROJECT = "hse-beta-production-ci"
REPOSITORY = "hse-single-host-ci/app"


def ci_paths():
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("CI") != "true":
        raise ValueError("This destructive ephemeral-stack verifier runs only in GitHub Actions")
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve()
    return temporary / "hse-single-host-ci", temporary / "hse-single-host-evidence"


def settings_module():
    spec = importlib.util.spec_from_file_location("single_host_settings", STACK / "prepare.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(arguments, *, check=True, timeout=120):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True, timeout=timeout, check=False)
    if check and result.returncode:
        # Arguments contain only public paths/commands; do not attach subprocess
        # stdout/stderr to exceptions because a container could echo a secret.
        raise RuntimeError(f"{Path(arguments[0]).name} operation failed (exit {result.returncode}); see redacted diagnostics")
    return result


def load_settings(work):
    values = settings_module().read_env(work / "beta.env")
    if (values.get("HSE_SINGLE_HOST_CI_ONLY") != "true"
            or values.get("BETA_IMAGE_REPOSITORY") != REPOSITORY
            or values.get("APP_HOST") != "app.single-host.test"
            or values.get("AUTH_HOST") != "auth.single-host.test"
            or values.get("COURSES_HOST") != "courses.single-host.test"):
        raise ValueError("Refusing to operate on settings other than this private ephemeral CI fixture")
    return values


def compose(work, *arguments, check=True, timeout=120):
    load_settings(work)
    return run(["docker", "compose", "--project-name", PROJECT,
                "--env-file", str(work / "beta.env"), "--file", str(STACK / "compose.yaml"),
                "--file", str(work / "ci-isolation.json"), *arguments], check=check, timeout=timeout)


def prepare(work):
    work.mkdir(mode=0o700, parents=True, exist_ok=False)
    module = settings_module()
    commit = run(["git", "rev-parse", "HEAD"]).stdout.strip()
    module.generate(argparse.Namespace(domain="single-host.test", admin_email="owner@single-host.test",
        image_tag=commit, image_repository=REPOSITORY, output=work / "beta.env"))
    # The valid reserved sender lets Keycloak import its SMTP configuration.
    # SMTP_HOST remains unset; delivery is neither attempted nor claimed here.
    # No HSE person/tenant or Moodle learner/service account is created. These
    # unused random connection credentials let the real worker run an empty DB
    # cycle; a .test alert endpoint and isolated network prevent external sends.
    with (work / "beta.env").open("a") as output:
        output.write("HSE_SINGLE_HOST_CI_ONLY='true'\n")
    values = module.read_env(work / "beta.env")
    values["HSE_TENANT_ID"] = str(uuid4())
    values["MOODLE_SERVICE_TOKEN"] = os.urandom(24).hex()
    values["ALERT_WEBHOOK_URL"] = "https://alerts.single-host.test/no-delivery"
    # Replace the existing blank assignments without shell evaluation.
    lines = (work / "beta.env").read_text().splitlines()
    for key in ("HSE_TENANT_ID", "MOODLE_SERVICE_TOKEN", "ALERT_WEBHOOK_URL"):
        lines = [f"{key}='{values[key]}'" if line.startswith(f"{key}=") else line for line in lines]
    (work / "beta.env").write_text("\n".join(lines) + "\n")
    os.chmod(work / "beta.env", 0o600)
    module.validate(values, "operations")
    (work / "ci-isolation.json").write_text(json.dumps({"networks": {"edge": {"internal": True}}}) + "\n")
    print(json.dumps({"event": "single-host-ci.prepared", "publicTls": False,
                      "externalNetwork": False, "settingsUploaded": False}))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def query(work, role, database, password_variable, statement, *, check=True):
    # The password is read only inside the PostgreSQL container. It is never a
    # host process argument and the generated shell text contains no secret.
    script = f'PGPASSWORD="${{{password_variable}}}" exec psql -h 127.0.0.1 -U "$1" -d "$2" -XAt --set=ON_ERROR_STOP=1 --command "$3"'
    return compose(work, "exec", "-T", "postgres", "sh", "-c", script,
                   "hse-ci-query", role, database, statement, check=check)


def node(work, service, source):
    return compose(work, "exec", "-T", service, "node", "--input-type=module", "--eval", source).stdout.strip()


def inspect_service(work, service):
    identifier = compose(work, "--profile", "operations", "ps", "--all", "--quiet", service).stdout.strip()
    require(bool(identifier) and "\n" not in identifier, f"Expected one {service} container")
    detail = json.loads(run(["docker", "inspect", identifier]).stdout)[0]
    settings = load_settings(work)
    prefix = f"{settings['BETA_IMAGE_REPOSITORY']}:{settings['BETA_IMAGE_TAG']}"
    expected_image = {"web": prefix, "jobs": prefix + "-tools", "migrate": prefix + "-tools",
                      "moodle": prefix + "-moodle", "keycloak": "quay.io/keycloak/keycloak:26.7.3",
                      "postgres": "postgres:17-bookworm"}[service]
    require(detail["Config"]["Image"] == expected_image, f"{service} did not start the expected production image")
    environment = dict(value.split("=", 1) for value in detail["Config"].get("Env", []) if "=" in value)
    if service in ("web", "jobs", "migrate"):
        require(environment.get("NODE_ENV") == "production", f"{service} did not use production mode")
        require("DEV_AUTH" not in environment, f"{service} configured development authentication")
    if service == "migrate":
        require(detail["State"]["Status"] == "exited" and detail["State"]["ExitCode"] == 0, "Production migrations did not finish successfully")
    else:
        require(detail["State"]["Running"], f"{service} is not running")
    if service in ("postgres", "keycloak", "moodle", "web"):
        require(detail["State"].get("Health", {}).get("Status") == "healthy", f"{service} is unhealthy")
    return {"image": detail["Config"]["Image"], "imageId": detail["Image"],
            "state": detail["State"]["Status"], "health": detail["State"].get("Health", {}).get("Status"),
            "productionMode": environment.get("NODE_ENV") == "production" if service in ("web", "jobs", "migrate") else None,
            "developmentAuthConfigured": "DEV_AUTH" in environment}


def smoke(work, evidence):
    values = load_settings(work)
    compose(work, "--profile", "operations", "config", "--quiet")
    model = json.loads(compose(work, "--profile", "operations", "config", "--format", "json").stdout)
    require(model["networks"]["edge"]["internal"] and model["networks"]["data"]["internal"], "CI networks must have no external routing")
    require(not model["services"]["postgres"].get("ports"), "PostgreSQL must not publish a port")
    for name in ("web", "keycloak", "moodle"):
        require(all(port.get("host_ip") == "127.0.0.1" for port in model["services"][name].get("ports", [])), "Only loopback service ports are permitted")
    compose(work, "--profile", "operations", "up", "-d", "--no-build", "--wait", "--wait-timeout", "420",
            "postgres", "keycloak", "moodle", "migrate", "web", "jobs", timeout=480)
    services = {name: inspect_service(work, name) for name in ("postgres", "keycloak", "moodle", "migrate", "web", "jobs")}
    caddy = run(["docker", "ps", "--all", "--quiet", "--filter", f"label=com.docker.compose.project={PROJECT}",
                 "--filter", "label=com.docker.compose.service=caddy"]).stdout.strip()
    require(not caddy, "CI must not start the public TLS proxy")

    http = json.loads(node(work, "web", """
      if (process.env.NODE_ENV !== 'production' || process.env.DEV_AUTH || process.getuid() === 0) throw new Error('Production process contract failed');
      const ready = await fetch('http://127.0.0.1:3000/api/health');
      const body = await ready.json();
      if (ready.status !== 200 || body.status !== 'ready') throw new Error('Readiness failed');
      const me = await fetch('http://127.0.0.1:3000/api/me');
      if (me.status !== 401) throw new Error('Anonymous access was not denied');
      console.log(JSON.stringify({readiness:ready.status,anonymousIdentity:me.status,rootProcess:false}));
    """))
    identity = json.loads(node(work, "web", """
      const base='http://keycloak:8080';
      const realm=base+'/realms/hse-beta';
      const headers={'X-Forwarded-Proto':'https','X-Forwarded-Host':'auth.single-host.test'};
      const discovery=await fetch(realm+'/.well-known/openid-configuration',{headers});
      if(!discovery.ok || (await discovery.json()).issuer!==process.env.OIDC_ISSUER) throw new Error('Realm issuer mismatch');
      const response=await fetch(realm+'/protocol/openid-connect/token',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:process.env.KEYCLOAK_ADMIN_CLIENT_ID,client_secret:process.env.KEYCLOAK_ADMIN_CLIENT_SECRET})});
      if(!response.ok) throw new Error('Restricted account service authentication failed');
      const token=(await response.json()).access_token;
      if(!token) throw new Error('Missing account service token');
      const privileged={...headers,Authorization:'Bearer '+token};
      const users=await fetch(base+'/admin/realms/hse-beta/users',{headers:privileged});
      if(!users.ok) throw new Error('Account service read denied');
      const records=await users.json();
      if(records.some(record=>record.username!=='service-account-hse-account-admin')) throw new Error('Unexpected realm participants');
      const clients=await fetch(base+'/admin/realms/hse-beta/clients',{headers:privileged});
      if(clients.status!==403) throw new Error('Account service can administer clients');
      console.log(JSON.stringify({issuerMatches:true,visibleHumanAccounts:0,clientAdministrationDenied:true}));
    """))

    expected_migrations = sorted(path.name for path in (ROOT / "web/migrations").glob("[0-9]*_*.sql"))
    migrations = json.loads(query(work, "hse_app", "hse", "HSE_DB_PASSWORD",
        "SELECT json_agg(name ORDER BY name) FROM schema_migrations").stdout.strip())
    require(migrations == expected_migrations, "Production image did not apply the exact migration set")
    require(query(work, "hse_app", "hse", "HSE_DB_PASSWORD", "SELECT count(*) FROM people").stdout.strip() == "0", "Unexpected participant seed data")
    require(query(work, "hse_app", "hse", "HSE_DB_PASSWORD", "SELECT count(*) FROM tenants").stdout.strip() == "0", "Unexpected tenant seed data")
    require(query(work, "keycloak", "keycloak", "KEYCLOAK_DB_PASSWORD",
        "SELECT count(*) FROM user_entity u JOIN realm r ON r.id=u.realm_id WHERE r.name='hse-beta' AND u.service_account_client_link IS NULL").stdout.strip() == "0",
        "Unexpected interactive realm users")
    require(query(work, "keycloak", "keycloak", "KEYCLOAK_DB_PASSWORD",
        "SELECT count(*) FROM user_entity u JOIN realm r ON r.id=u.realm_id WHERE r.name='hse-beta' AND u.service_account_client_link IS NOT NULL").stdout.strip() == "1",
        "Unexpected number of realm machine accounts")
    for database in ("keycloak", "moodle"):
        require(query(work, "hse_app", database, "HSE_DB_PASSWORD", "SELECT 1", check=False).returncode != 0,
                "Application DB role crossed a service database boundary")
    for role, variable in (("keycloak", "KEYCLOAK_DB_PASSWORD"), ("moodle", "MOODLE_DB_PASSWORD")):
        require(query(work, role, "hse", variable, "SELECT 1", check=False).returncode != 0,
                "Provider DB role crossed the application database boundary")
    version_source = (ROOT / "integrations/moodle-local/hse_evidence/version.php").read_text()
    expected_plugin = re.search(r"\$plugin->version\s*=\s*(\d+)", version_source).group(1)
    plugin = query(work, "moodle", "moodle", "MOODLE_DB_PASSWORD",
        "SELECT value FROM mdl_config_plugins WHERE plugin='local_hse_evidence' AND name='version'").stdout.strip()
    require(plugin == expected_plugin, "Moodle wrapper did not install the exact evidence extension version")
    functions = query(work, "moodle", "moodle", "MOODLE_DB_PASSWORD",
        "SELECT count(*) FROM mdl_external_functions WHERE name IN ('local_hse_evidence_get_completion','local_hse_evidence_end_user_sessions')").stdout.strip()
    require(functions == "2", "Moodle evidence/session service functions were not installed")

    worker_complete = False
    for _ in range(30):
        logs = compose(work, "--profile", "operations", "logs", "--no-color", "--tail", "100", "jobs").stdout
        worker_complete = any('"event":"jobs.completed"' in line and '"exitCodes":[0]' in line for line in logs.splitlines())
        if worker_complete:
            break
        time.sleep(2)
    require(worker_complete, "Production worker did not complete an empty Moodle outbox cycle")
    network_ids = run(["docker", "network", "ls", "--filter", f"label=com.docker.compose.project={PROJECT}", "--quiet"]).stdout.split()
    require(len(network_ids) == 2, "Unexpected runtime networks")
    networks = json.loads(run(["docker", "network", "inspect", *network_ids]).stdout)
    require(all(network.get("Internal") for network in networks), "A runtime network permits external routing")
    compose(work, "--profile", "backup", "run", "--rm", "--no-deps", "--entrypoint", "sh", "recovery", "-ec",
            "python3 --version >/dev/null; pg_dump --version >/dev/null; age --version >/dev/null; python3 /opt/hse/recovery.py --help >/dev/null")
    evidence.mkdir(mode=0o700, parents=True, exist_ok=True)
    report = {"event": "single-host-ci.verified", "verifiedAt": datetime.now(timezone.utc).isoformat(),
              "commit": values["BETA_IMAGE_TAG"], "services": services, "http": http, "identity": identity,
              "migrations": migrations, "moodleEvidenceVersion": plugin, "workerCycleCompleted": worker_complete,
              "databaseRoleIsolation": True, "recoveryImageStarted": True,
              "internalRuntimeNetworksVerified": len(networks),
              "publicTlsStarted": False, "externalRuntimeNetwork": False, "participantAccountsCreated": False,
              "limitations": ["No public DNS or TLS validation", "No real learner SSO or course fail/retry/pass",
                              "No real recipient/invitation delivery", "No full-stack restore or live deployment"]}
    (evidence / "smoke-evidence.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"event": report["event"], "services": len(services), "workerCycleCompleted": True,
                      "databaseRoleIsolation": True, "publicTlsStarted": False}))


def redact(text, values):
    sensitive = [value for key, value in values.items() if value and any(part in key for part in ("PASSWORD", "SECRET", "TOKEN"))]
    for secret in sorted(sensitive, key=len, reverse=True):
        for encoded in {secret, quote(secret, safe=""), quote_plus(secret)}:
            text = text.replace(encoded, "[redacted]")
    text = re.sub(r"[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "[redacted-jwt]", text)
    return text


def logs(work, evidence):
    if not (work / "beta.env").exists():
        return
    values = load_settings(work)
    evidence.mkdir(mode=0o700, parents=True, exist_ok=True)
    for name, arguments in (("containers", ("--profile", "operations", "ps", "--all")),
                            ("container-logs", ("--profile", "operations", "logs", "--no-color", "--tail", "300"))):
        result = compose(work, *arguments, check=False)
        (evidence / f"{name}.txt").write_text(redact(result.stdout + result.stderr, values))
    print(json.dumps({"event": "single-host-ci.diagnostics_saved", "redacted": True}))


def cleanup(work, evidence):
    if not (work / "beta.env").exists():
        shutil.rmtree(work, ignore_errors=True)
        return
    try:
        values = load_settings(work)
    except (ValueError, OSError):
        shutil.rmtree(work, ignore_errors=True)
        raise RuntimeError("Private settings were invalid and removed; no Docker cleanup was attempted")
    try:
        result = compose(work, "--profile", "operations", "--profile", "backup", "--profile", "tls",
                         "down", "--volumes", "--remove-orphans", check=False, timeout=180)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    if result.returncode:
        evidence.mkdir(mode=0o700, parents=True, exist_ok=True)
        (evidence / "cleanup.txt").write_text(redact(result.stdout + result.stderr, values))
    require(result.returncode == 0, "Ephemeral Compose cleanup failed; private settings were removed")
    print(json.dumps({"event": "single-host-ci.cleaned", "privateSettingsRemoved": True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "smoke", "logs", "cleanup"))
    args = parser.parse_args()
    work, evidence = ci_paths()
    if args.action == "prepare":
        prepare(work)
    elif args.action == "smoke":
        smoke(work, evidence)
    elif args.action == "logs":
        logs(work, evidence)
    else:
        cleanup(work, evidence)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as cause:
        print(json.dumps({"event": "single-host-ci.failed", "reason": str(cause)}), file=sys.stderr)
        sys.exit(1)
