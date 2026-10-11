#!/usr/bin/env python3
"""Exercise documented Moodle REST calls on disposable, synthetic sites only.

This probe validates an incomplete course response. It does not manufacture a
SCORM attempt, knowledge completion, or authorization decision.
"""

import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def call(base_url: str, token: str, function: str, fields: dict[str, object]) -> object:
    form = {
        "wstoken": token,
        "wsfunction": function,
        "moodlewsrestformat": "json",
        **fields,
    }
    request = Request(
        f"{base_url.rstrip('/')}/webservice/rest/server.php",
        data=urlencode(form).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urlopen(request, timeout=20) as response:
        result = json.load(response)
    if isinstance(result, dict) and "exception" in result:
        raise RuntimeError(f"{function} failed: {result.get('errorcode')}: {result.get('message')}")
    return result


def positive_id(value: object, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise RuntimeError(f"Invalid {label}: {value!r}")
    return value


def verify_site(label: str, base_url: str, fixture: dict[str, object],
                hse_id: str, username: str, email: str) -> dict[str, object]:
    token = fixture["token"]
    if not isinstance(token, str) or len(token) != 32:
        raise RuntimeError(f"Invalid {label} pilot token")
    course_id = positive_id(fixture["courseid"], f"{label} course ID")
    role_id = positive_id(fixture["studentroleid"], f"{label} student role ID")

    def ws(function: str, **fields: object) -> object:
        return call(base_url, token, function, fields)

    before = ws("core_user_get_users_by_field", field="idnumber", **{"values[0]": hse_id})
    if before != []:
        raise RuntimeError(f"{label} synthetic HSE ID already exists before provisioning: {before}")

    created = ws("core_user_create_users", **{
        "users[0][username]": username,
        "users[0][firstname]": "Synthetic",
        "users[0][lastname]": f"Worker {label}",
        "users[0][email]": email,
        "users[0][idnumber]": hse_id,
        "users[0][auth]": "oauth2",
        "users[0][createpassword]": 0,
    })
    if not isinstance(created, list) or len(created) != 1 or not isinstance(created[0], dict):
        raise RuntimeError(f"{label} did not return exactly one created user: {created}")
    user_id = positive_id(created[0].get("id"), f"{label} Moodle user ID")

    found = ws("core_user_get_users_by_field", field="idnumber", **{"values[0]": hse_id})
    if not isinstance(found, list) or len(found) != 1 or not isinstance(found[0], dict) \
            or found[0].get("id") != user_id or found[0].get("idnumber") != hse_id:
        raise RuntimeError(f"{label} HSE-ID lookup did not recover the created Moodle user: {found}")

    enrolled = ws("enrol_manual_enrol_users", **{
        "enrollments[0][roleid]": role_id,
        "enrollments[0][userid]": user_id,
        "enrollments[0][courseid]": course_id,
    })
    if enrolled is not None:
        raise RuntimeError(f"{label} enrollment did not return Moodle's documented null result: {enrolled}")

    courses = ws("core_enrol_get_users_courses", userid=user_id, returnusercount=0)
    if not isinstance(courses, list) or sum(isinstance(item, dict) and item.get("id") == course_id
                                            for item in courses) != 1:
        raise RuntimeError(f"{label} course was not visible after enrollment: {courses}")

    completion = ws("core_completion_get_course_completion_status", courseid=course_id,
                    userid=user_id)
    status = completion.get("completionstatus") if isinstance(completion, dict) else None
    if not isinstance(status, dict) or status.get("completed") is not False:
        raise RuntimeError(f"{label} fixture did not return incomplete course status: {completion}")
    criteria = status.get("completions")
    if not isinstance(criteria, list) or len(criteria) != 1 or criteria[0].get("complete") is not False:
        raise RuntimeError(f"{label} expected one incomplete future-date criterion: {completion}")
    if "timecompleted" in status:
        raise RuntimeError(f"{label} course completion response gained a timestamp; review adapter semantics")

    print(f"OK {label}: OAuth2-auth Moodle account, HSE-ID lookup, manual enrollment, enrolled-course read, incomplete completion read")
    return {
        "courseId": course_id,
        "userId": user_id,
        "hseId": hse_id,
        "authMethod": found[0].get("auth"),
        "enrolledCourseRead": next(item for item in courses if item.get("id") == course_id),
        "completionRead": completion,
    }


def main() -> None:
    a = json.loads(os.environ["MOODLE_A_PILOT"])
    b = json.loads(os.environ["MOODLE_B_PILOT"])
    a_url = os.environ.get("MOODLE_A_URL", "http://localhost:8081")
    b_url = os.environ.get("MOODLE_B_URL", "http://localhost:8082")
    a_hse = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    b_hse = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    a_result = verify_site("A", a_url, a, a_hse, "synthetic.worker.a", "worker.a@example.invalid")
    b_result = verify_site("B", b_url, b, b_hse, "synthetic.worker.b", "worker.b@example.invalid")

    for label, url, token, foreign_hse in (
        ("A", a_url, a["token"], b_hse),
        ("B", b_url, b["token"], a_hse),
    ):
        foreign = call(url, token, "core_user_get_users_by_field",
                       {"field": "idnumber", "values[0]": foreign_hse})
        if foreign != []:
            raise RuntimeError(f"{label} Moodle exposed a foreign synthetic HSE ID: {foreign}")
        print(f"OK {label}: foreign HSE ID absent")

    evidence = {
        "fixture": "SYNTHETIC ONLY - no training credit or production evidence",
        "scope": "Moodle 5.3.0 REST provisioning, enrollment, and incomplete completion read",
        "limitations": [
            "Moodle browser OAuth issuer and subject linking were not configured or tested",
            "The synthetic SCORM ZIP was validated as an artifact but not imported or launched",
            "The course uses a future-date criterion; no SCORM attempt or completed course was observed",
            "Course completion REST status has no canonical course completion timestamp",
        ],
        "companyA": a_result,
        "companyB": b_result,
    }
    output = Path(os.environ.get("MOODLE_PILOT_EVIDENCE", "moodle-pilot-evidence.json"))
    output.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Saved synthetic Moodle REST evidence to {output}")


if __name__ == "__main__":
    main()
