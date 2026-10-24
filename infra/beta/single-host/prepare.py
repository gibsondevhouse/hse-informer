#!/usr/bin/env python3
"""Create or validate one private env file; never starts or publishes services."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import sys
from urllib.parse import urlparse
from uuid import UUID, uuid4

ROOT = Path(__file__).resolve().parents[3]
HEX_SECRETS = ("POSTGRES_ADMIN_PASSWORD", "HSE_DB_PASSWORD", "KEYCLOAK_DB_PASSWORD", "MOODLE_DB_PASSWORD",
               "HSE_OIDC_CLIENT_SECRET", "HSE_ADMIN_CLIENT_SECRET", "MOODLE_OIDC_CLIENT_SECRET", "SESSION_SECRET")


def read_env(path):
    result = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            raise ValueError("Invalid env file assignment")
        value = value.strip()
        if value.startswith("'"):
            if not value.endswith("'"):
                raise ValueError(f"Unclosed env value: {key}")
            value = re.sub(r"\\(['\\])", r"\1", value[1:-1])
        elif value.startswith('"'):
            value = json.loads(value)
        else:
            value = value.split(" #", 1)[0].strip()
        if any(ord(char) < 32 for char in value):
            raise ValueError(f"Control character in env value: {key}")
        if key in result:
            raise ValueError(f"Duplicate env setting: {key}")
        result[key] = value
    return result


def hostname(value):
    return len(value) <= 253 and bool(re.fullmatch(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", value))


def email_address(value):
    local, separator, domain = value.rpartition("@")
    return (len(value) <= 254 and len(local) <= 64 and separator == "@"
            and bool(re.fullmatch(r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*", local))
            and hostname(domain.lower()) and not domain.lower().endswith(".invalid"))


def validate(values, mode):
    if values.get("DEV_AUTH"):
        raise ValueError("DEV_AUTH cannot be used here")
    if not re.fullmatch(r"[a-f0-9]{40}", values.get("BETA_IMAGE_TAG", "")):
        raise ValueError("BETA_IMAGE_TAG must be the reviewed full Git commit SHA")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._:/-]+", values.get("BETA_IMAGE_REPOSITORY", "")):
        raise ValueError("Set a valid image repository")
    hosts = [values.get(key, "") for key in ("APP_HOST", "AUTH_HOST", "COURSES_HOST")]
    if len(set(hosts)) != 3 or not all(hostname(value) for value in hosts):
        raise ValueError("Set three distinct app/auth/courses DNS hostnames")
    if not email_address(values.get("ADMIN_EMAIL", "")):
        raise ValueError("Set the actual administrator email")
    if not email_address(values.get("SMTP_FROM", "")):
        raise ValueError("SMTP_FROM must be a valid sender email address")
    for key in HEX_SECRETS:
        if not re.fullmatch(r"[a-fA-F0-9]{48,128}", values.get(key, "")):
            raise ValueError(f"Generate a fresh strong hexadecimal {key}")
    for key in ("KEYCLOAK_ADMIN_PASSWORD", "MOODLE_ADMIN_PASSWORD"):
        if len(values.get(key, "")) < 24:
            raise ValueError(f"Generate a fresh strong {key}")
    for key in ("KEYCLOAK_ADMIN_USER", "MOODLE_ADMIN_USER", "MOODLE_SITE_FULLNAME", "MOODLE_SITE_SHORTNAME"):
        if not values.get(key, "").strip():
            raise ValueError(f"{key} is required")
    try:
        UUID(values.get("MOODLE_INSTANCE_ID", ""))
    except ValueError:
        raise ValueError("MOODLE_INSTANCE_ID must be a stable UUID")
    if bool(values.get("HSE_TENANT_ID")) != bool(values.get("MOODLE_SERVICE_TOKEN")):
        raise ValueError("Set HSE_TENANT_ID and MOODLE_SERVICE_TOKEN together after Moodle setup")
    if mode == "operations":
        try:
            UUID(values.get("HSE_TENANT_ID", ""))
        except ValueError:
            raise ValueError("Set HSE_TENANT_ID from the initial tenant bootstrap")
        if len(values.get("MOODLE_SERVICE_TOKEN", "")) < 20:
            raise ValueError("Set the actual restricted Moodle service token")
        if not re.fullmatch(r"[1-9][0-9]*", values.get("MOODLE_OAUTH_ISSUER_ID", "")) or int(values["MOODLE_OAUTH_ISSUER_ID"]) > 9007199254740991:
            raise ValueError("Set the actual positive Moodle OAuth issuer ID")
        if len(values.get("MOODLE_OAUTH_BRIDGE_TOKEN", "")) < 20:
            raise ValueError("Set the dedicated restricted Moodle OAuth identity bridge token")
        if values["MOODLE_OAUTH_BRIDGE_TOKEN"] == values["MOODLE_SERVICE_TOKEN"]:
            raise ValueError("Moodle OAuth identity bridge token must be separate from the course service token")
        endpoint = urlparse(values.get("ALERT_WEBHOOK_URL", ""))
        if endpoint.scheme != "https" or not endpoint.hostname or not values.get("ALERT_OWNER", "").strip():
            raise ValueError("Configure the HTTPS alert hook and named recipient")
    if mode == "backup" and not values.get("AGE_RECIPIENT", "").startswith("age1"):
        raise ValueError("Set the age public recovery recipient")


def generate(args):
    domain = args.domain.lower().strip()
    if not hostname(domain) or domain.endswith(".invalid"):
        raise ValueError("Provide the domain that will be used for this beta")
    output = args.output.expanduser().resolve()
    if ROOT == output or ROOT in output.parents:
        raise ValueError("Keep the private env file outside this repository")
    values = {key: secrets.token_hex(32) for key in HEX_SECRETS}
    values.update(BETA_IMAGE_REPOSITORY=args.image_repository, BETA_IMAGE_TAG=args.image_tag,
                  APP_HOST=f"app.{domain}", AUTH_HOST=f"auth.{domain}", COURSES_HOST=f"courses.{domain}",
                  ADMIN_EMAIL=args.admin_email, KEYCLOAK_ADMIN_USER="beta-owner", MOODLE_ADMIN_USER="beta-owner",
                  KEYCLOAK_ADMIN_PASSWORD="A9!" + secrets.token_hex(24), MOODLE_ADMIN_PASSWORD="A9!" + secrets.token_hex(24),
                  MOODLE_SITE_FULLNAME="HSE Informer beta", MOODLE_SITE_SHORTNAME="HSE-BETA",
                  MOODLE_INSTANCE_ID=str(uuid4()), HSE_TENANT_ID="", MOODLE_SERVICE_TOKEN="",
                  MOODLE_OAUTH_ISSUER_ID="", MOODLE_OAUTH_BRIDGE_TOKEN="",
                  SMTP_HOST="", SMTP_PORT="587", SMTP_FROM=args.admin_email, SMTP_USER="", SMTP_PASSWORD="",
                  SMTP_AUTH="true", SMTP_STARTTLS="true", SMTP_SSL="false",
                  ALERT_OWNER=args.admin_email, ALERT_WEBHOOK_URL="", BETA_JOB_INTERVAL_SECONDS="300", AGE_RECIPIENT="")
    validate(values, "core")
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as target:
        target.write("# Private single-host beta settings. Never commit, email, or paste this file into chat.\n")
        for key, value in values.items():
            quoted = value.replace("\\", "\\\\").replace("'", "\\'")
            target.write(f"{key}='{quoted}'\n")
    print(json.dumps({"event": "beta-config.created", "path": str(output), "servicesStarted": False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--domain", required=True)
    create.add_argument("--admin-email", required=True)
    create.add_argument("--image-tag", required=True)
    create.add_argument("--image-repository", default="hse-beta/app")
    create.add_argument("--output", required=True, type=Path)
    check = commands.add_parser("validate")
    check.add_argument("--env-file", required=True, type=Path)
    check.add_argument("--mode", choices=("core", "operations", "backup"), default="core")
    read = commands.add_parser("value")
    read.add_argument("--env-file", required=True, type=Path)
    read.add_argument("--key", choices=("BETA_IMAGE_REPOSITORY", "BETA_IMAGE_TAG"), required=True)
    args = parser.parse_args()
    if args.command == "create":
        generate(args)
    elif args.command == "validate":
        validate(read_env(args.env_file), args.mode)
        print(json.dumps({"event": "beta-config.valid", "mode": args.mode, "runtimeVerified": False}))
    else:
        print(read_env(args.env_file)[args.key])


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as cause:
        print(json.dumps({"event": "beta-config.failed", "reason": str(cause)}), file=sys.stderr)
        sys.exit(1)
