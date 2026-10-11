#!/usr/bin/env python3
"""Smoke check the local identity issuer and two independent Moodle sites."""

import json
import time
from urllib.parse import urlparse
from urllib.request import urlopen


def get_json(url: str) -> dict:
    with urlopen(url, timeout=15) as response:
        return json.load(response)


def check_moodle(url: str) -> None:
    with urlopen(f"{url}/login/index.php", timeout=15) as response:
        final = response.geturl()
        if (urlparse(final).scheme, urlparse(final).netloc) != (
            urlparse(url).scheme,
            urlparse(url).netloc,
        ):
            raise RuntimeError(f"Moodle redirected outside its own site: {final}")
        if response.status != 200:
            raise RuntimeError(f"Moodle did not return 200: {url}")
    print(f"OK Moodle login page: {url}")


def wait_for(label: str, check) -> None:
    deadline = time.monotonic() + 600
    while True:
        try:
            check()
            return
        except Exception as error:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"{label} did not become ready within 10 minutes") from error
            time.sleep(5)


def main() -> None:
    issuer = "http://auth.localhost:8080/realms/hse-dev"
    def check_issuer() -> None:
        discovery = get_json(f"{issuer}/.well-known/openid-configuration")
        if discovery.get("issuer") != issuer:
            raise RuntimeError(f"Unexpected OIDC issuer: {discovery.get('issuer')}")

    wait_for("Keycloak", check_issuer)
    print(f"OK OIDC issuer: {issuer}")
    wait_for("company A Moodle", lambda: check_moodle("http://localhost:8081"))
    wait_for("company B Moodle", lambda: check_moodle("http://localhost:8082"))


if __name__ == "__main__":
    main()
