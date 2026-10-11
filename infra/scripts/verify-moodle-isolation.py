#!/usr/bin/env python3
"""Verify that each Moodle web-service token is rejected by the other instance."""

import json
import os
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def site_info(base_url: str, token: str) -> dict:
    body = urlencode(
        {
            "wstoken": token,
            "wsfunction": "core_webservice_get_site_info",
            "moodlewsrestformat": "json",
        }
    ).encode("utf-8")
    request = Request(
        f"{base_url.rstrip('/')}/webservice/rest/server.php",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.load(response)
    except HTTPError as error:
        if error.code in (401, 403):
            return {"exception": "http_denied", "errorcode": str(error.code)}
        raise


def main() -> None:
    a_token = os.environ.get("MOODLE_A_TOKEN")
    b_token = os.environ.get("MOODLE_B_TOKEN")
    if not a_token or not b_token:
        raise SystemExit("Set MOODLE_A_TOKEN and MOODLE_B_TOKEN from separate development Moodle sites")

    a_url = os.environ.get("MOODLE_A_URL", "http://localhost:8081")
    b_url = os.environ.get("MOODLE_B_URL", "http://localhost:8082")
    a_name = os.environ.get("MOODLE_A_NAME", "HSE synthetic company A")
    b_name = os.environ.get("MOODLE_B_NAME", "HSE synthetic company B")

    for label, url, token, expected_name in (
        ("A token on A", a_url, a_token, a_name),
        ("B token on B", b_url, b_token, b_name),
    ):
        response = site_info(url, token)
        if response.get("sitename") != expected_name:
            raise RuntimeError(f"{label} did not access its own site: {response}")
        print(f"OK {label}")

    for label, url, token in (
        ("A token on B", b_url, a_token),
        ("B token on A", a_url, b_token),
    ):
        response = site_info(url, token)
        if "exception" not in response:
            raise RuntimeError(f"{label} unexpectedly succeeded: {response}")
        print(f"OK rejected {label}: {response.get('errorcode', response['exception'])}")


if __name__ == "__main__":
    main()
