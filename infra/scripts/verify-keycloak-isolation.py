#!/usr/bin/env python3
"""Check synthetic Moodle realm boundaries, including credential denial in CI.

The direct-grant clients used here exist only in the development fixture. Moodle's
real OIDC clients retain authorization-code flow and have direct grants disabled.
"""

import argparse
import base64
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


REALM_DIR = Path(__file__).resolve().parents[1] / "keycloak"
REALM_FILES = {
    "hse-dev": REALM_DIR / "hse-dev-realm.json",
    "moodle-company-a": REALM_DIR / "moodle-company-a-realm.json",
    "moodle-company-b": REALM_DIR / "moodle-company-b-realm.json",
}
WORKERS = (
    ("moodle-company-a", "moodle-a-isolation-probe", "synthetic.worker.a", "11111111-1111-4111-8111-111111111111"),
    ("moodle-company-b", "moodle-b-isolation-probe", "synthetic.worker.b", "22222222-2222-4222-8222-222222222222"),
)


def verify_realm_files() -> None:
    realms = {name: json.loads(path.read_text()) for name, path in REALM_FILES.items()}
    expected_clients = {
        "hse-dev": {"hse-web"},
        "moodle-company-a": {"moodle-company-a", "moodle-a-isolation-probe"},
        "moodle-company-b": {"moodle-company-b", "moodle-b-isolation-probe"},
    }
    expected_workers = {
        "hse-dev": {"synthetic.worker.a", "synthetic.worker.b"},
        "moodle-company-a": {"synthetic.worker.a"},
        "moodle-company-b": {"synthetic.worker.b"},
    }
    for name, data in realms.items():
        if data["realm"] != name:
            raise RuntimeError(f"Wrong realm in {REALM_FILES[name]}")
        clients = {client["clientId"]: client for client in data["clients"]}
        if len(clients) != len(data["clients"]) or set(clients) != expected_clients[name]:
            raise RuntimeError(f"Unexpected clients in {name}: {set(clients)}")
        usernames = {user["username"] for user in data["users"]}
        if name == "hse-dev":
            if not expected_workers[name] <= usernames:
                raise RuntimeError("HSE realm must retain both tenant-scoped synthetic workers")
        elif usernames != expected_workers[name]:
            raise RuntimeError(f"Unexpected users in {name}: {usernames}")
        for client in clients.values():
            if client["clientId"].endswith("-isolation-probe"):
                if not client["directAccessGrantsEnabled"] or client["standardFlowEnabled"]:
                    raise RuntimeError(f"Invalid test-only probe client in {name}")
            elif client["directAccessGrantsEnabled"] or not client["standardFlowEnabled"]:
                raise RuntimeError(f"Interactive OIDC client in {name} has unexpected flow settings")
        if name.startswith("moodle-"):
            port = "8081" if name.endswith("-a") else "8082"
            if clients[name]["redirectUris"] != [f"http://localhost:{port}/admin/oauth2callback.php"]:
                raise RuntimeError(f"Moodle callback does not match {name}'s site")
    print("OK three realm files have exclusive Moodle clients and worker inventories")


def token_request(base_url: str, realm: str, client: str, username: str, password: str) -> tuple[int, dict]:
    url = f"{base_url.rstrip('/')}/realms/{realm}/protocol/openid-connect/token"
    body = urlencode({
        "grant_type": "password",
        "client_id": client,
        "username": username,
        "password": password,
    }).encode()
    request = Request(url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urlopen(request, timeout=20) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def token_claims(token: str) -> dict:
    # Claims are inspected only after receiving a token directly from local Keycloak.
    # Application token verification is performed separately by the OIDC library.
    encoded = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))


def verify_token_boundary(base_url: str, password: str) -> None:
    for realm, client, username, subject in WORKERS:
        status, response = token_request(base_url, realm, client, username, password)
        if status != 200 or not response.get("access_token"):
            raise RuntimeError(f"{username} could not sign in to own realm: HTTP {status}, {response.get('error')}")
        claims = token_claims(response["access_token"])
        expected_issuer = f"{base_url.rstrip('/')}/realms/{realm}"
        if claims.get("iss") != expected_issuer or claims.get("sub") != subject or claims.get("azp") != client:
            raise RuntimeError(f"Wrong OIDC claims for {username} in {realm}")
        print(f"OK {username} can authenticate to {realm} and has expected issuer/subject/client")

    for realm, client, username in (
        ("moodle-company-a", "moodle-a-isolation-probe", "synthetic.worker.b"),
        ("moodle-company-b", "moodle-b-isolation-probe", "synthetic.worker.a"),
    ):
        status, response = token_request(base_url, realm, client, username, password)
        if status != 400 or response.get("error") != "invalid_grant" or response.get("access_token"):
            raise RuntimeError(f"{username} unexpectedly authenticated to {realm}: HTTP {status}")
        print(f"OK {realm} rejects the other company's worker credentials")

    for realm, client, username in (
        ("moodle-company-a", "moodle-company-b", "synthetic.worker.a"),
        ("moodle-company-b", "moodle-company-a", "synthetic.worker.b"),
        ("moodle-company-a", "hse-web", "synthetic.worker.a"),
    ):
        status, response = token_request(base_url, realm, client, username, password)
        if status not in (400, 401) or response.get("error") != "invalid_client" or response.get("access_token"):
            raise RuntimeError(f"Foreign client {client} unexpectedly accepted by {realm}: HTTP {status}")
        print(f"OK {realm} rejects foreign client {client}")


def verify_live_client_placement(base_url: str, admin_password: str) -> None:
    status, response = token_request(base_url, "master", "admin-cli", "admin", admin_password)
    admin_token = response.get("access_token")
    if status != 200 or not admin_token:
        raise RuntimeError(f"Could not inspect live Keycloak client placement: HTTP {status}")
    for realm in REALM_FILES:
        for client_id in ("hse-web", "moodle-company-a", "moodle-company-b"):
            url = f"{base_url.rstrip('/')}/admin/realms/{realm}/clients?{urlencode({'clientId': client_id})}"
            request = Request(url, headers={"Authorization": f"Bearer {admin_token}"})
            with urlopen(request, timeout=20) as result:
                clients = json.load(result)
            found = [client for client in clients if client.get("clientId") == client_id]
            expected = client_id == ("hse-web" if realm == "hse-dev" else realm)
            if len(found) != int(expected):
                raise RuntimeError(f"Live realm {realm} has incorrect placement for {client_id}; an old realm import may remain")
    print("OK live interactive clients are present only in their designated realms")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-only", action="store_true", help="validate realm files without a running Keycloak")
    args = parser.parse_args()
    verify_realm_files()
    if args.config_only:
        return
    password = os.environ.get("DEV_WORKER_PASSWORD")
    admin_password = os.environ.get("KEYCLOAK_ADMIN_PASSWORD")
    if not password or not admin_password:
        raise SystemExit("DEV_WORKER_PASSWORD and KEYCLOAK_ADMIN_PASSWORD are required for the synthetic sign-in probe")
    base_url = os.environ.get("KEYCLOAK_URL", "http://auth.localhost:8080")
    verify_token_boundary(base_url, password)
    verify_live_client_placement(base_url, admin_password)


if __name__ == "__main__":
    main()
