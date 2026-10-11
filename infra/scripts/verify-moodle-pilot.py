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
        "enrolments[0][roleid]": role_id,
        "enrolments[0][userid]": user_id,
        "enrolments[0][courseid]": course_id,
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

    site_names = ("Tifton", "Ocilla", "Vernon") if label == "A" else ("Isolation",)
    idnumbers = {site: f"HSE-SYNTHETIC-{label}-{site.upper()}" for site in site_names}
    create_fields = {}
    for index, site in enumerate(site_names):
        prefix = f"cohorts[{index}]"
        create_fields[f"{prefix}[categorytype][type]"] = "system"
        create_fields[f"{prefix}[categorytype][value]"] = "0"
        create_fields[f"{prefix}[name]"] = f"{site} synthetic site"
        create_fields[f"{prefix}[idnumber]"] = idnumbers[site]
        create_fields[f"{prefix}[description]"] = "SYNTHETIC ONLY - no real workers or training credit"
    created_cohorts = ws("core_cohort_create_cohorts", **create_fields)
    if not isinstance(created_cohorts, list) or len(created_cohorts) != len(site_names):
        raise RuntimeError(f"{label} Moodle did not create the expected synthetic site cohorts: {created_cohorts}")
    cohort_ids = {}
    for site, cohort in zip(site_names, created_cohorts):
        if not isinstance(cohort, dict) or cohort.get("idnumber") != idnumbers[site]:
            raise RuntimeError(f"{label} site cohort idnumber mismatch: {created_cohorts}")
        cohort_ids[site] = positive_id(cohort.get("id"), f"{label} {site} cohort ID")

    all_cohorts = ws("core_cohort_get_cohorts")
    if not isinstance(all_cohorts, list) or {
            item.get("idnumber") for item in all_cohorts if isinstance(item, dict)
    } != set(idnumbers.values()):
        raise RuntimeError(f"{label} Moodle cohort inventory was not company-scoped: {all_cohorts}")

    target = site_names[0]
    membership = ws("core_cohort_add_cohort_members", **{
        "members[0][cohorttype][type]": "id",
        "members[0][cohorttype][value]": cohort_ids[target],
        "members[0][usertype][type]": "id",
        "members[0][usertype][value]": user_id,
    })
    if not isinstance(membership, dict) or membership.get("warnings") != []:
        raise RuntimeError(f"{label} Moodle did not confirm site cohort membership: {membership}")
    members = ws("core_cohort_get_cohort_members", **{
        f"cohortids[{index}]": cohort_ids[site] for index, site in enumerate(site_names)
    })
    expected_members = {cohort_ids[site]: ([user_id] if site == target else []) for site in site_names}
    if not isinstance(members, list) or {
            item.get("cohortid"): item.get("userids") for item in members if isinstance(item, dict)
    } != expected_members:
        raise RuntimeError(f"{label} site cohort membership read did not match: {members}")

    print(f"OK {label}: OAuth2-auth account, HSE-ID lookup, enrollment, incomplete completion read, site cohorts and membership")
    return {
        "courseId": course_id,
        "userId": user_id,
        "hseId": hse_id,
        "authMethod": found[0].get("auth"),
        "enrolledCourseRead": next(item for item in courses if item.get("id") == course_id),
        "completionRead": completion,
        "siteCohorts": {site: {"id": cohort_ids[site],
                               "idnumber": idnumbers[site],
                               "memberIds": expected_members[cohort_ids[site]]} for site in site_names},
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
        "scope": "Moodle 5.3.0 REST provisioning, enrollment, site cohorts, and incomplete completion read",
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
