#!/usr/bin/env python3
"""Encrypted full-stack backup/restore and a measured HSE database restore drill.

Requires PostgreSQL client tools on PATH, and age for full-stack archives.
Credentials travel in child environment variables, never process arguments.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from urllib.parse import parse_qs, unquote, urlparse


def required(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"{name} is required")
    return value


def connection(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError("Use a PostgreSQL URL containing a host and database")
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env.update(PGHOST=parsed.hostname, PGPORT=str(parsed.port or 5432),
               PGDATABASE=unquote(parsed.path[1:]), PGUSER=unquote(parsed.username or ""),
               PGPASSWORD=unquote(parsed.password or ""), PGOPTIONS="-c timezone=UTC", PGCONNECT_TIMEOUT="10")
    accepted = {"sslmode": "PGSSLMODE", "sslrootcert": "PGSSLROOTCERT", "sslcert": "PGSSLCERT", "sslkey": "PGSSLKEY"}
    for key, values in parse_qs(parsed.query).items():
        if key not in accepted:
            raise ValueError(f"Unsupported PostgreSQL URL option: {key}")
        env[accepted[key]] = values[-1]
    identity = f"{parsed.hostname.lower()}:{parsed.port or 5432}/{unquote(parsed.path[1:])}"
    return env, hashlib.sha256(identity.encode()).hexdigest()


def command(args, env=None, **kwargs):
    result = subprocess.run(args, env=env, check=False, capture_output=True, **kwargs)
    if result.returncode:
        # Do not include connection strings, server diagnostics, or record payloads in operational logs.
        raise RuntimeError(f"{Path(args[0]).name} failed (exit {result.returncode}); inspect restricted host diagnostics")
    return result.stdout


def sql(url, statement, snapshot=None):
    env, _ = connection(url)
    if snapshot:
        if not re.fullmatch(r"[0-9A-Fa-f-]+", snapshot):
            raise ValueError("Invalid exported PostgreSQL snapshot")
        statement = f"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '{snapshot}'; {statement}; COMMIT;"
    return command(["psql", "-XqAt", "--set=ON_ERROR_STOP=1"], env=env,
                   input=statement.encode()).decode().strip()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def database_counts(url, snapshot=None):
    tables = json.loads(sql(url, "SELECT COALESCE(json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename),'[]') FROM pg_tables WHERE schemaname !~ '^pg_' AND schemaname <> 'information_schema'", snapshot))
    counts = {}
    for table in tables:
        quoted = '.'.join('"' + table[key].replace('"', '""') + '"' for key in ('schema','table'))
        label = table['table'] if table['schema'] == 'public' else f"{table['schema']}.{table['table']}"
        counts[label] = int(sql(url, f"SELECT count(*) FROM {quoted}", snapshot))
    return counts


def hse_state(url, snapshot=None):
    counts = database_counts(url, snapshot)
    packet = None
    if "knowledge_evidence" in counts and counts["knowledge_evidence"]:
        packet = json.loads(sql(url, """WITH RECURSIVE selected AS (
            SELECT k.tenant_id,k.id FROM knowledge_evidence k
            ORDER BY EXISTS (SELECT 1 FROM completion_record_events e WHERE e.tenant_id=k.tenant_id
              AND (e.evidence_id=k.id OR e.replacement_evidence_id=k.id)) DESC,k.id LIMIT 1
          ), lineage AS (
            SELECT tenant_id,id FROM selected
            UNION
            SELECT e.tenant_id,CASE WHEN e.evidence_id=l.id THEN e.replacement_evidence_id ELSE e.evidence_id END
            FROM lineage l JOIN completion_record_events e ON e.tenant_id=l.tenant_id
              AND (e.evidence_id=l.id OR e.replacement_evidence_id=l.id)
            WHERE CASE WHEN e.evidence_id=l.id THEN e.replacement_evidence_id ELSE e.evidence_id END IS NOT NULL
          ) SELECT jsonb_build_object(
            'evidence', (SELECT jsonb_agg(to_jsonb(k) ORDER BY k.id) FROM knowledge_evidence k
              JOIN lineage l ON l.tenant_id=k.tenant_id AND l.id=k.id),
            'manual', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.evidence_id) FROM manual_completion_details m
              JOIN lineage l ON l.tenant_id=m.tenant_id AND l.id=m.evidence_id),
            'events', (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.recorded_at,e.id) FROM completion_record_events e
              JOIN lineage l ON l.tenant_id=e.tenant_id AND l.id=e.evidence_id),
            'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_log a
              JOIN lineage l ON l.tenant_id=a.tenant_id AND l.id=a.entity_id))""", snapshot))
    return {"counts": counts, "evidencePacketSha256": digest(packet) if packet else None}


def dump_database(url, output, include_state=False):
    env, identity = connection(url)
    holder = subprocess.Popen(["psql", "-XqAt", "--set=ON_ERROR_STOP=1"], env=env,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        holder.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n")
        holder.stdin.flush()
        snapshot = holder.stdout.readline().strip()
        if not re.fullmatch(r"[0-9A-Fa-f-]+", snapshot):
            raise RuntimeError("Could not obtain a consistent backup snapshot")
        command(["pg_dump", "--format=custom", "--no-owner", "--no-acl", f"--snapshot={snapshot}", f"--file={output}"], env=env)
        state = hse_state(url, snapshot) if include_state else {"counts": database_counts(url, snapshot)}
        holder.stdin.write("COMMIT;\n\\q\n")
        holder.stdin.flush()
        holder.communicate(timeout=10)
        if holder.returncode:
            raise RuntimeError("Backup snapshot session failed")
        return {"sourceIdentitySha256": identity, "state": state}
    finally:
        if holder.poll() is None:
            holder.kill()
            holder.wait()


def sha256(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def archive_directory(source, output):
    source = source.resolve(strict=True)
    if not source.is_dir():
        raise ValueError("Backup file sources must be directories")
    if any(path.is_symlink() for path in source.rglob("*")):
        raise ValueError("Stage file backups without symbolic links so the recovery set is self-contained")
    with tarfile.open(output, "w:gz", dereference=False) as archive:
        archive.add(source, arcname=".")


def extract(archive_path, target):
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "r:*") as archive:
        for member in archive.getmembers():
            name = Path(member.name)
            if name.is_absolute() or ".." in name.parts or not (member.isfile() or member.isdir()):
                raise ValueError("Unsafe member in recovery archive")
        archive.extractall(target)


def validate_target(url, source_identities):
    env, identity = connection(url)
    if identity in source_identities:
        raise ValueError("Restore target matches a source database")
    tables = int(sql(url, "SELECT count(*) FROM pg_tables WHERE schemaname !~ '^pg_' AND schemaname <> 'information_schema'"))
    if tables:
        raise ValueError("Restore requires a precreated empty isolated database")
    return env, identity


def restore_database(url, dump, source_identities):
    env, identity = validate_target(url, source_identities)
    command(["pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "--dbname", env["PGDATABASE"], str(dump)], env=env)
    return identity


def confirmation():
    if required("BETA_RESTORE_CONFIRM") != "isolated-target":
        raise ValueError("Set BETA_RESTORE_CONFIRM=isolated-target after checking every restore target")


def write_evidence(path, evidence):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(evidence, output, indent=2)
        output.write("\n")


def backup(output):
    if required("BETA_BACKUP_QUIESCED") != "yes":
        raise ValueError("Quiesce app/jobs, Moodle writes and uploads, then set BETA_BACKUP_QUIESCED=yes")
    recipient = required("AGE_RECIPIENT")
    if output.exists():
        raise ValueError("Refusing to overwrite a recovery archive")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hse-backup-") as work:
        root = Path(work)
        bundle = root / "bundle"
        bundle.mkdir(mode=0o700)
        manifest = {"format": 1, "createdAt": datetime.now(timezone.utc).isoformat(), "databases": {}, "files": {}}
        for name in ("hse", "keycloak", "moodle"):
            manifest["databases"][name] = dump_database(required(f"{name.upper()}_DATABASE_URL"), bundle / f"{name}.dump", name == "hse")
        for name, variable in (("moodledata", "MOODLE_FILES_DIR"), ("moodlecode", "MOODLE_CODE_DIR"), ("uploads", "HSE_UPLOADS_DIR")):
            archive_directory(Path(required(variable)), bundle / f"{name}.tar.gz")
        for path in bundle.iterdir():
            manifest["files"][path.name] = sha256(path)
        write_evidence(bundle / "manifest.json", manifest)
        plaintext = root / "bundle.tar"
        with tarfile.open(plaintext, "w") as archive:
            archive.add(bundle, arcname=".")
        encrypted = root / "bundle.tar.age"
        command(["age", "--recipient", recipient, "--output", str(encrypted), str(plaintext)])
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as destination, encrypted.open("rb") as source:
            shutil.copyfileobj(source, destination)
    return {"event": "backup.completed", "createdAt": manifest["createdAt"], "archiveSha256": sha256(output)}


def restore(archive, target):
    confirmation()
    if target.exists() and any(target.iterdir()):
        raise ValueError("Restore file target must be empty")
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(prefix="hse-restore-") as work:
        root = Path(work)
        plaintext = root / "bundle.tar"
        command(["age", "--decrypt", "--identity", required("AGE_IDENTITY_FILE"), "--output", str(plaintext), str(archive)])
        extract(plaintext, root / "bundle")
        bundle = root / "bundle"
        manifest = json.loads((bundle / "manifest.json").read_text())
        if manifest.get("format") != 1:
            raise ValueError("Unsupported recovery archive format")
        expected_files = {"hse.dump", "keycloak.dump", "moodle.dump", "moodledata.tar.gz", "moodlecode.tar.gz", "uploads.tar.gz"}
        if set(manifest.get("files", {})) != expected_files or set(manifest.get("databases", {})) != {"hse", "keycloak", "moodle"}:
            raise ValueError("Recovery manifest does not describe the complete required recovery set")
        for name, expected in manifest["files"].items():
            if Path(name).name != name or sha256(bundle / name) != expected:
                raise ValueError("Recovery archive checksum mismatch")
        sources = {item["sourceIdentitySha256"] for item in manifest["databases"].values()}
        targets = {}
        for name in ("hse", "keycloak", "moodle"):
            url = required(f"RESTORE_{name.upper()}_DATABASE_URL")
            _, identity = validate_target(url, sources)
            if identity in targets.values():
                raise ValueError("Every service needs a separate restore database")
            targets[name] = identity
        for name in ("hse", "keycloak", "moodle"):
            restore_database(required(f"RESTORE_{name.upper()}_DATABASE_URL"), bundle / f"{name}.dump", sources)
            if name != "hse" and database_counts(required(f"RESTORE_{name.upper()}_DATABASE_URL")) != manifest["databases"][name]["state"]["counts"]:
                raise ValueError(f"Restored {name} table counts do not match the backup snapshot")
        for name in ("moodledata", "moodlecode", "uploads"):
            extract(bundle / f"{name}.tar.gz", target / name)
        observed = hse_state(required("RESTORE_HSE_DATABASE_URL"))
        expected = manifest["databases"]["hse"]["state"]
        if observed != expected:
            raise ValueError("Restored HSE counts or evidence digest do not match the backup snapshot")
        evidence = {"event": "restore.verified", "verifiedAt": datetime.now(timezone.utc).isoformat(),
                    "backupCreatedAt": manifest["createdAt"], "scope": "hse,keycloak,moodle,files",
                    "countsVerified": True, "evidencePacketVerified": bool(observed["evidencePacketSha256"]),
                    "serviceDatabaseCountsVerified": ["hse", "keycloak", "moodle"],
                    "state": observed, "archiveSha256": sha256(archive)}
        write_evidence(target / "restore-evidence.json", evidence)
        return evidence


def hse_drill(output):
    confirmation()
    source = required("HSE_DATABASE_URL")
    target = required("RESTORE_HSE_DATABASE_URL")
    _, source_identity = connection(source)
    validate_target(target, {source_identity})
    started = datetime.now(timezone.utc)
    with tempfile.TemporaryDirectory(prefix="hse-drill-") as work:
        dump = Path(work) / "hse.dump"
        backup_result = dump_database(source, dump, True)
        if not backup_result["state"]["evidencePacketSha256"]:
            raise ValueError("No completion evidence exists; an evidence restore drill cannot pass")
        restore_database(target, dump, {source_identity})
        observed = hse_state(target)
        if observed != backup_result["state"]:
            raise ValueError("Restored counts or evidence digest differ from the recovery point")
    evidence = {"event": "restore.verified", "scope": "hse-database-only", "startedAt": started.isoformat(),
                "verifiedAt": datetime.now(timezone.utc).isoformat(), "countsVerified": True,
                "evidencePacketVerified": True, "state": observed,
                "pending": ["Keycloak recovery", "Moodle database and file recovery", "staging restore drill"]}
    write_evidence(output, evidence)
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("backup").add_argument("--output", type=Path, required=True)
    restore_parser = sub.add_parser("restore")
    restore_parser.add_argument("--archive", type=Path, required=True)
    restore_parser.add_argument("--target-root", type=Path, required=True)
    sub.add_parser("hse-drill").add_argument("--output-evidence", type=Path, required=True)
    args = parser.parse_args()
    if args.action == "backup":
        result = backup(args.output)
    elif args.action == "restore":
        result = restore(args.archive, args.target_root)
    else:
        result = hse_drill(args.output_evidence)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except (ValueError, RuntimeError, OSError) as cause:
        print(json.dumps({"event": "recovery.failed", "reason": str(cause)}), file=sys.stderr)
        sys.exit(1)
