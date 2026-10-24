#!/usr/bin/env python3
"""Private GitHub CI drill using the unchanged production recovery.py tool.

Never deploys, starts public TLS, sends invitations, or uploads private settings,
archives, database dumps, file contents, or recovery keys.
"""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

spec = importlib.util.spec_from_file_location("single_host_smoke", Path(__file__).with_name("verify-single-host.py"))
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
SOURCE_PROJECT = "hse-beta-recovery-source-ci"
TARGET_PROJECT = "hse-beta-recovery-target-ci"
source.PROJECT = SOURCE_PROJECT
MARKER = "hse-private-three-service-recovery-ci-v1"
EXTRA_VOLUMES = {name: f"{SOURCE_PROJECT}_{name}" for name in ("archive", "keys", "code")}
CANARY = "Fictional HSE recovery CI file; no participant data.\n"

# This measures all regular files and directory ownership/permissions, not only
# canaries. File timestamps are excluded because tar's precision may differ.
FILE_STATE_PROGRAM = r'''
import hashlib,json,pathlib,stat,sys
result={}
for label,location in json.loads(sys.argv[1]).items():
    root=pathlib.Path(location)
    records=[]
    total=0
    for path in sorted(root.rglob('*')):
        info=path.lstat()
        if not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
            raise ValueError('File recovery requires self-contained regular files/directories')
        record=[str(path.relative_to(root)),stat.S_IMODE(info.st_mode),info.st_uid,info.st_gid]
        if path.is_file():
            digest=hashlib.sha256()
            with path.open('rb') as stream:
                for chunk in iter(lambda:stream.read(1024*1024),b''):
                    digest.update(chunk)
            record.extend([info.st_size,digest.hexdigest()])
            total+=info.st_size
        records.append(record)
    result[label]={'entries':len(records),'bytes':total,'sha256':hashlib.sha256(json.dumps(records,separators=(',',':')).encode()).hexdigest()}
print(json.dumps(result,sort_keys=True))
'''


def paths():
    source.ci_paths()  # Identical strict CI=true + GITHUB_ACTIONS=true boundary.
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve()
    return temporary / "hse-recovery-ci", temporary / "hse-recovery-evidence"


def load(work):
    if (work / "marker").read_text() != MARKER:
        raise ValueError("Refusing recovery operations outside the marked private CI fixture")
    return source.load_settings(work / "source")


def private_json(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(value, output)
        output.write("\n")


def prepare(work):
    work.mkdir(mode=0o700, parents=True, exist_ok=False)
    (work / "marker").write_text(MARKER)
    source.prepare(work / "source")
    print(json.dumps({"event": "recovery-ci.prepared", "externalNetwork": False, "settingsUploaded": False}))


def target_model(model):
    """Derive the restored runtime from the resolved production Compose model."""
    model = json.loads(json.dumps(model))
    model["name"] = TARGET_PROJECT
    model["services"] = {key: value for key, value in model["services"].items()
                         if key in ("postgres", "keycloak", "moodle", "migrate", "web")}
    for service in model["services"].values():
        service.pop("ports", None)
        service.pop("build", None)
        service.pop("profiles", None)
        service["restart"] = "no"
    for key in ("data", "edge"):
        model["networks"][key] = {"name": f"{TARGET_PROJECT}_{key}", "internal": True}
    model["volumes"] = {key: {"name": f"{TARGET_PROJECT}_{key}"}
                        for key in ("postgres-data", "moodle-data", "app-uploads", "moodle-code", "restored")}
    for key in ("archive", "keys"):
        model["volumes"][key] = {"name": EXTRA_VOLUMES[key], "external": True}
    services = model["services"]
    services["postgres"]["networks"] = {"data": {"aliases": ["restore-postgres"]}}
    for key in ("web", "migrate"):
        services[key]["environment"]["DATABASE_URL"] = services[key]["environment"]["DATABASE_URL"].replace("@postgres:5432/", "@restore-postgres:5432/")
    services["keycloak"]["environment"]["KC_DB_URL"] = "jdbc:postgresql://restore-postgres:5432/keycloak"
    services["moodle"]["environment"]["MOODLE_DB_HOST"] = "restore-postgres"
    services["moodle"]["volumes"].append({"type": "volume", "source": "moodle-code", "target": "/var/www/moodle", "volume": {"nocopy": True}})
    image = services["web"]["image"] + "-recovery"
    passwords = services["postgres"]["environment"]
    services["recovery"] = {
        "image": image, "networks": {"data": None}, "restart": "no",
        "environment": {
            "RESTORE_HSE_DATABASE_URL": f"postgres://hse_app:{passwords['HSE_DB_PASSWORD']}@restore-postgres:5432/hse",
            "RESTORE_KEYCLOAK_DATABASE_URL": f"postgres://keycloak:{passwords['KEYCLOAK_DB_PASSWORD']}@restore-postgres:5432/keycloak",
            "RESTORE_MOODLE_DATABASE_URL": f"postgres://moodle:{passwords['MOODLE_DB_PASSWORD']}@restore-postgres:5432/moodle",
            "BETA_RESTORE_CONFIRM": "isolated-target", "AGE_IDENTITY_FILE": "/keys/identity"},
        "volumes": [{"type": "volume", "source": name, "target": location, "read_only": name != "restored"}
                    for name, location in (("restored", "/restore"), ("archive", "/transfer"), ("keys", "/keys"))],
        "cap_drop": ["ALL"], "cap_add": ["CHOWN", "FOWNER", "FSETID", "DAC_OVERRIDE"],
        "security_opt": ["no-new-privileges:true"],
    }
    return model


def validate_target_model(model):
    source.require(model.get("name") == TARGET_PROJECT, "Unexpected recovery target project")
    source.require(set(model["services"]) == {"postgres", "keycloak", "moodle", "migrate", "web", "recovery"}, "Unexpected recovery target services")
    source.require(all(item.get("internal") and item.get("name") == f"{TARGET_PROJECT}_{key}"
                       for key, item in model["networks"].items()), "Recovery target networks must be isolated")
    source.require(all(not service.get("ports") for service in model["services"].values()), "Recovery target must not publish any ports")
    for key, volume in model["volumes"].items():
        expected = EXTRA_VOLUMES[key] if key in ("archive", "keys") else f"{TARGET_PROJECT}_{key}"
        source.require(volume.get("name") == expected, "Recovery target storage must use fresh isolated names")
    for key in ("web", "migrate"):
        source.require("@restore-postgres:5432/hse" in model["services"][key]["environment"]["DATABASE_URL"], "Recovered app must use the separate target database")
    source.require(model["services"]["keycloak"]["environment"]["KC_DB_URL"] == "jdbc:postgresql://restore-postgres:5432/keycloak"
                   and model["services"]["moodle"]["environment"]["MOODLE_DB_HOST"] == "restore-postgres", "Recovered providers must use the separate target database")
    for name in ("hse", "keycloak", "moodle"):
        source.require(f"@restore-postgres:5432/{name}" in model["services"]["recovery"]["environment"][f"RESTORE_{name.upper()}_DATABASE_URL"], "Recovery tool must use separate target databases")


def target(work, *arguments, check=True, timeout=120):
    load(work)
    model = json.loads((work / "target.json").read_text())
    validate_target_model(model)
    return source.run(["docker", "compose", "--project-name", TARGET_PROJECT, "--file", str(work / "target.json"), *arguments], check=check, timeout=timeout)


def helper(work, volumes, *arguments, input_stream=None):
    settings = load(work)
    image = settings["BETA_IMAGE_REPOSITORY"] + ":" + settings["BETA_IMAGE_TAG"] + "-recovery"
    command = ["docker", "run", "--rm", "--network", "none", "--cap-drop", "ALL",
               "--cap-add", "CHOWN", "--cap-add", "FOWNER", "--cap-add", "FSETID", "--cap-add", "DAC_OVERRIDE",
               "--security-opt", "no-new-privileges:true"]
    for name, location, readonly in volumes:
        command.extend(["--volume", f"{name}:{location}" + (":ro" if readonly else "")])
    if input_stream is not None:
        command.append("--interactive")
    command.extend(["--entrypoint", arguments[0], image, *arguments[1:]])
    if input_stream is None:
        return checked(work, "recovery-helper", source.run(command, check=False, timeout=240))
    return subprocess.Popen(command, cwd=source.ROOT, stdin=input_stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def checked(work, phase, result):
    if result.returncode:
        _, evidence = paths()
        evidence.mkdir(mode=0o700, parents=True, exist_ok=True)
        (evidence / f"{phase}-failure.txt").write_text(source.redact(result.stdout + result.stderr, load(work)))
        raise RuntimeError(f"{phase} failed; see redacted diagnostics")
    return result


def copy_frozen_code(work):
    identifier = source.compose(work / "source", "ps", "--all", "--quiet", "moodle").stdout.strip()
    source.require(bool(identifier) and "\n" not in identifier, "Expected one frozen Moodle container")
    # Follow links only while staging the trusted image's code, so recovery.py's
    # unchanged prohibition on links in self-contained archives still applies.
    producer = subprocess.Popen(["docker", "cp", "--follow-link", f"{identifier}:/var/www/moodle/.", "-"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    consumer = helper(work, [(EXTRA_VOLUMES["code"], "/code", False)], "tar", "-xpf", "-", "-C", "/code", input_stream=producer.stdout)
    producer.stdout.close()
    try:
        consumer.communicate(timeout=240)
        producer.wait(timeout=30)
        source.require(producer.returncode == 0 and consumer.returncode == 0, "Could not stage the frozen Moodle code")
        helper(work, [(EXTRA_VOLUMES["code"], "/code", True)], "sh", "-ec",
               "test -f /code/config.php; test -f /code/public/local/hse_evidence/version.php")
    finally:
        for process in (producer, consumer):
            if process.poll() is None:
                process.kill()
                process.wait()
        producer.stderr.close()


def tree_state(work, volumes):
    mounts = [(name, f"/tree/{label}", True) for label, name in volumes.items()]
    roots = {label: f"/tree/{label}" for label in volumes}
    return json.loads(helper(work, mounts, "python3", "-c", FILE_STATE_PROGRAM, json.dumps(roots)).stdout)


def moodle_file(work, recovered=False, create=False):
    execute = target if recovered else lambda root, *args, **kwargs: source.compose(root / "source", *args, **kwargs)
    operation = ("$file=$storage->create_file_from_string($record," + json.dumps(CANARY) + ");"
                 if create else "$file=$storage->get_file($record['contextid'],$record['component'],$record['filearea'],0,'/',$record['filename']);")
    program = "define('CLI_SCRIPT',true); require('/var/www/moodle/config.php'); "
    program += "$record=['contextid'=>context_system::instance()->id,'component'=>'local_hse_evidence','filearea'=>'recovery_ci','itemid'=>0,'filepath'=>'/','filename'=>'recovery-canary.txt']; $storage=get_file_storage(); "
    program += operation + " if(!$file || $file->get_content()!==" + json.dumps(CANARY) + ") { throw new Exception('Recovery file content mismatch'); } echo json_encode(['fileApiContentVerified'=>true]);"
    result = checked(work, "restored-moodle-file" if recovered else "source-moodle-file",
                     execute(work, "exec", "-T", "moodle", "runuser", "-u", "www-data", "--", "php", "-r", program, check=False))
    return json.loads(result.stdout)


def prepare_upload(work, volume):
    # The app drops ALL capabilities. exec --user 0 does not restore CHOWN;
    # initialize only this fresh synthetic volume with the scoped helper, then
    # write the canary through the normal non-root application user.
    helper(work, [(volume, "/uploads", False)], "python3", "-c",
           "import os; os.chown('/uploads',1000,1000)")
    program = "const fs=await import('node:fs'); if(process.getuid()===0)throw new Error('App fixture must remain non-root'); fs.writeFileSync('/app/uploads/recovery-ci.txt'," + json.dumps(CANARY) + "); console.log(JSON.stringify({uploadCreated:true}));"
    return checked(work, "source-upload", source.compose(work / "source", "exec", "-T", "web", "node", "--input-type=module", "--eval", program, check=False))


def phase(name):
    print(json.dumps({"event": "recovery-ci.phase", "phase": name}), flush=True)


def assert_frozen(work):
    for service in ("web", "jobs", "keycloak", "moodle"):
        identifier = source.compose(work / "source", "--profile", "operations", "ps", "--all", "--quiet", service).stdout.strip()
        detail = json.loads(source.run(["docker", "inspect", identifier]).stdout)[0]
        source.require(not detail["State"]["Running"], f"Source {service} must remain stopped during recovery")


def target_query(work, role, database, variable, statement):
    script = f'PGPASSWORD="${{{variable}}}" exec psql -h 127.0.0.1 -U "$1" -d "$2" -XAt --set=ON_ERROR_STOP=1 --command "$3"'
    return target(work, "exec", "-T", "postgres", "sh", "-c", script, "hse-ci-query", role, database, statement).stdout.strip()


def recovered_startup(work):
    target(work, "up", "-d", "--no-build", "--wait", "--wait-timeout", "420", "keycloak", "moodle", "web", timeout=480)
    services = {}
    for name in ("postgres", "keycloak", "moodle", "web"):
        identifier = target(work, "ps", "--quiet", name).stdout.strip()
        detail = json.loads(source.run(["docker", "inspect", identifier]).stdout)[0]
        source.require(detail["State"]["Running"] and detail["State"].get("Health", {}).get("Status") == "healthy", f"Recovered {name} is not healthy")
        environment = dict(item.split("=", 1) for item in detail["Config"].get("Env", []) if "=" in item)
        source.require("DEV_AUTH" not in environment, "Recovered service configured development authentication")
        services[name] = {"image": detail["Config"]["Image"], "imageId": detail["Image"], "health": "healthy"}
    network_ids = source.run(["docker", "network", "ls", "--quiet", "--filter", f"label=com.docker.compose.project={TARGET_PROJECT}"]).stdout.split()
    source.require(len(network_ids) == 2, "Unexpected recovered runtime networks")
    networks = json.loads(source.run(["docker", "network", "inspect", *network_ids]).stdout)
    source.require(all(network.get("Internal") and network["Name"].startswith(TARGET_PROJECT + "_") for network in networks), "Recovered runtime networks must remain private and separate")
    program = """
      if(process.env.NODE_ENV!=='production'||process.env.DEV_AUTH||process.getuid()===0) throw new Error('Production contract failed');
      const health=await fetch('http://127.0.0.1:3000/api/health');
      if(health.status!==200||(await health.json()).status!=='ready') throw new Error('Recovered readiness failed');
      if((await fetch('http://127.0.0.1:3000/api/me')).status!==401) throw new Error('Recovered anonymous access failed');
      const headers={'X-Forwarded-Proto':'https','X-Forwarded-Host':'auth.single-host.test'};
      const discovery=await fetch('http://keycloak:8080/realms/hse-beta/.well-known/openid-configuration',{headers});
      if(!discovery.ok||(await discovery.json()).issuer!==process.env.OIDC_ISSUER) throw new Error('Recovered issuer mismatch');
      const response=await fetch('http://keycloak:8080/realms/hse-beta/protocol/openid-connect/token',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:process.env.KEYCLOAK_ADMIN_CLIENT_ID,client_secret:process.env.KEYCLOAK_ADMIN_CLIENT_SECRET})});
      if(!response.ok||!(await response.json()).access_token) throw new Error('Recovered machine credential failed');
      console.log(JSON.stringify({readiness:200,anonymousIdentity:401,issuerMatches:true,restoredMachineCredentialAccepted:true,productionMode:true}));
    """
    http = json.loads(target(work, "exec", "-T", "web", "node", "--input-type=module", "--eval", program).stdout)
    lineage = json.loads(target_query(work, "hse_app", "hse", "HSE_DB_PASSWORD", """
      SELECT json_build_object('evidence',(SELECT count(*) FROM knowledge_evidence),
        'amendments',(SELECT count(*) FROM completion_record_events),
        'manualProvenance',(SELECT count(*) FROM manual_completion_details),
        'audit',(SELECT count(*) FROM audit_log),
        'effective',(SELECT count(*) FROM effective_knowledge_evidence),
        'sourceScore',(SELECT score FROM knowledge_evidence WHERE delivery_source='moodle'),
        'sourceAttempts',(SELECT source_payload->'attempts' FROM knowledge_evidence WHERE delivery_source='moodle'))
    """))
    source.require(lineage == {"evidence": 2, "amendments": 2, "manualProvenance": 1, "audit": 2,
                              "effective": 0, "sourceScore": 85, "sourceAttempts": [{"score": 40}, {"score": 85}]}, "Recovered evidence lineage is incomplete")
    file_result = moodle_file(work, recovered=True)
    return {"services": services, "http": http, "lineage": lineage, "moodleFile": file_result}


def drill(work, evidence):
    settings = load(work)
    source_work = work / "source"
    phase("source-production-startup")
    source.smoke(source_work, evidence / "source-startup")
    model = json.loads(source.compose(source_work, "--profile", "operations", "--profile", "backup", "config", "--format", "json").stdout)
    source.require(not source.run(["docker", "ps", "--all", "--quiet", "--filter", f"label=com.docker.compose.project={TARGET_PROJECT}"]).stdout.strip(), "Recovery target must start without containers")
    for name in EXTRA_VOLUMES.values():
        source.require(source.run(["docker", "volume", "inspect", name], check=False).returncode != 0, "Recovery transfer volumes must be fresh")
        source.run(["docker", "volume", "create", "--label", f"hse.recovery-ci={SOURCE_PROJECT}", name])
    for key in ("postgres-data", "moodle-data", "app-uploads", "moodle-code", "restored"):
        source.require(source.run(["docker", "volume", "inspect", f"{TARGET_PROJECT}_{key}"], check=False).returncode != 0, "Recovery target volumes must be fresh")
    phase("synthetic-record-and-file-fixtures")
    checked(work, "source-hse-fixture", source.query(source_work, "hse_app", "hse", "HSE_DB_PASSWORD",
            (source.ROOT / "infra/scripts/fixtures/recovery-ci.sql").read_text(), check=False))
    moodle_file(work, create=True)
    prepare_upload(work, model["volumes"]["app-uploads"]["name"])
    # No app, Moodle cron, identity or worker writer remains running while any
    # database or file snapshot is measured, encrypted, or restored.
    phase("freeze-source-writers")
    source.compose(source_work, "--profile", "operations", "stop", "web", "jobs", "keycloak", "moodle", timeout=180)
    assert_frozen(work)
    copy_frozen_code(work)
    source_files = tree_state(work, {"moodlecode": EXTRA_VOLUMES["code"],
        "moodledata": model["volumes"]["moodle-data"]["name"], "uploads": model["volumes"]["app-uploads"]["name"]})
    source.require(all(item["entries"] and item["bytes"] for item in source_files.values()), "Every recovery file set must contain actual content")
    recipient = helper(work, [(EXTRA_VOLUMES["keys"], "/keys", False)], "sh", "-ec",
        "umask 077; age-keygen -o /keys/identity >/dev/null 2>&1; age-keygen -y /keys/identity").stdout.strip()
    source.require(recipient.startswith("age1") and "\n" not in recipient, "Could not create the ephemeral encryption recipient")
    phase("encrypted-complete-backup")
    backup = json.loads(checked(work, "encrypted-backup", source.compose(source_work, "--profile", "backup", "run", "--rm", "--no-deps",
        "--env", f"AGE_RECIPIENT={recipient}", "--volume", f"{EXTRA_VOLUMES['code']}:/backup-input/moodlecode:ro",
        "--volume", f"{EXTRA_VOLUMES['archive']}:/transfer", "recovery", "backup", "--output", "/transfer/beta.tar.age", check=False, timeout=900)).stdout)
    private_json(work / "target.json", target_model(model))
    target(work, "config", "--quiet")
    target(work, "up", "-d", "--no-build", "--wait", "--wait-timeout", "120", "postgres", timeout=180)
    for role, database, variable in (("hse_app", "hse", "HSE_DB_PASSWORD"), ("keycloak", "keycloak", "KEYCLOAK_DB_PASSWORD"), ("moodle", "moodle", "MOODLE_DB_PASSWORD")):
        source.require(target_query(work, role, database, variable, "SELECT count(*) FROM pg_tables WHERE schemaname !~ '^pg_' AND schemaname <> 'information_schema'") == "0", "Every restore database must be empty before recovery")
    phase("restore-into-empty-target")
    restored = json.loads(checked(work, "isolated-restore", target(work, "run", "--rm", "--no-deps", "recovery", "restore", "--archive", "/transfer/beta.tar.age", "--target-root", "/restore", check=False, timeout=1200)).stdout)
    source.require(restored.get("event") == "restore.verified" and restored.get("countsVerified") and restored.get("evidencePacketVerified")
                   and restored.get("serviceDatabaseCountsVerified") == ["hse", "keycloak", "moodle"], "The exact recovery tool did not verify the complete restored set")
    source.require(restored.get("archiveSha256") == backup.get("archiveSha256"), "Restore did not use the measured encrypted archive")
    # Promote only restored bytes into fresh runtime volumes. The image's Moodle
    # code is hidden by the restored code volume; it cannot mask a missing file.
    for key in ("moodle-code", "moodle-data", "app-uploads"):
        source.run(["docker", "volume", "create", "--label", f"com.docker.compose.project={TARGET_PROJECT}",
                    "--label", f"com.docker.compose.volume={key}", f"{TARGET_PROJECT}_{key}"])
    helper(work, [(f"{TARGET_PROJECT}_restored", "/restored", True),
                  (f"{TARGET_PROJECT}_moodle-code", "/moodlecode", False),
                  (f"{TARGET_PROJECT}_moodle-data", "/moodledata", False),
                  (f"{TARGET_PROJECT}_app-uploads", "/uploads", False)], "sh", "-ec",
           "cp -a /restored/moodlecode/. /moodlecode/; cp -a /restored/moodledata/. /moodledata/; cp -a /restored/uploads/. /uploads/")
    target_files = tree_state(work, {"moodlecode": f"{TARGET_PROJECT}_moodle-code", "moodledata": f"{TARGET_PROJECT}_moodle-data", "uploads": f"{TARGET_PROJECT}_app-uploads"})
    source.require(source_files == target_files, "Restored runtime file paths, contents or ownership differ from the frozen source")
    assert_frozen(work)
    phase("recovered-service-startup")
    startup = recovered_startup(work)
    assert_frozen(work)
    source.require(tree_state(work, {"uploads": f"{TARGET_PROJECT}_app-uploads"})["uploads"] == source_files["uploads"], "Recovered app upload changed during startup")
    report = {"event": "full-recovery-ci.verified", "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "commit": settings["BETA_IMAGE_TAG"], "tool": "infra/beta/recovery.py (unchanged)",
        "sourceWritersStopped": True, "targetDatabasesInitiallyEmpty": True,
        "separateComposeProjectsAndStorage": True, "encryptedArchiveSha256": backup["archiveSha256"],
        "restore": restored, "fileSets": target_files, "recoveredStartup": startup,
        "publicPortsPublishedOnTarget": False, "externalRuntimeNetwork": False,
        "settingsOrKeysUploaded": False, "syntheticHseRecordsOnly": True,
        "limitations": ["Ephemeral Linux CI, not the chosen deployment host", "No public DNS/TLS or human SSO/course playback",
                        "No offsite storage/key retrieval, production SMTP, or measured host-loss recovery window"]}
    evidence.mkdir(mode=0o700, parents=True, exist_ok=True)
    (evidence / "recovery-evidence.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"event": report["event"], "databaseCountsVerified": 3, "fileSetsVerified": 3, "recoveredServicesHealthy": 4}))


def logs(work, evidence):
    if not (work / "source/beta.env").exists():
        return
    values = load(work)
    source.logs(work / "source", evidence / "source-diagnostics")
    if (work / "target.json").exists():
        evidence.mkdir(mode=0o700, parents=True, exist_ok=True)
        for name, arguments in (("target-containers", ("ps", "--all")), ("target-logs", ("logs", "--no-color", "--tail", "300"))):
            result = target(work, *arguments, check=False)
            (evidence / f"{name}.txt").write_text(source.redact(result.stdout + result.stderr, values))


def cleanup(work, evidence):
    if not (work / "source/beta.env").exists():
        shutil.rmtree(work, ignore_errors=True)
        return
    # Validate before any destructive Docker operation. Invalid settings are
    # removed locally, while unproven Docker resources are left untouched.
    try:
        load(work)
    except (ValueError, OSError):
        shutil.rmtree(work, ignore_errors=True)
        raise RuntimeError("Invalid private recovery fixture removed; Docker cleanup was refused")
    failures = []
    try:
        if (work / "target.json").exists():
            try:
                result = target(work, "down", "--volumes", "--remove-orphans", check=False, timeout=180)
                if result.returncode:
                    failures.append("target cleanup")
            except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired):
                failures.append("target cleanup")
        try:
            source.cleanup(work / "source", evidence / "source-diagnostics")
        except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired):
            failures.append("source cleanup")
        for name in EXTRA_VOLUMES.values():
            try:
                inspection = source.run(["docker", "volume", "inspect", name], check=False)
                if inspection.returncode == 0:
                    details = json.loads(inspection.stdout)[0]
                    if details.get("Labels", {}).get("hse.recovery-ci") != SOURCE_PROJECT:
                        failures.append("unproven transfer volume")
                    elif source.run(["docker", "volume", "rm", name], check=False).returncode:
                        failures.append("transfer volume cleanup")
            except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired):
                failures.append("transfer volume cleanup")
    finally:
        shutil.rmtree(work, ignore_errors=True)
    source.require(not failures, "Recovery cleanup failed: " + ", ".join(failures))
    print(json.dumps({"event": "recovery-ci.cleaned", "privateSettingsArchiveAndKeyRemoved": True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "drill", "logs", "cleanup"))
    args = parser.parse_args()
    work, evidence = paths()
    {"prepare": lambda: prepare(work), "drill": lambda: drill(work, evidence),
     "logs": lambda: logs(work, evidence), "cleanup": lambda: cleanup(work, evidence)}[args.action]()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as cause:
        print(json.dumps({"event": "recovery-ci.failed", "reason": str(cause)}), file=sys.stderr)
        sys.exit(1)
