#!/usr/bin/env python3
"""Read only real Moodle tracking created by the synthetic browser SCO launch."""

import json
import os
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def call(base_url: str, token: str, function: str, fields: dict[str, object]) -> object:
    request = Request(
        f"{base_url.rstrip('/')}/webservice/rest/server.php",
        data=urlencode({"wstoken": token, "wsfunction": function,
                        "moodlewsrestformat": "json", **fields}).encode("utf-8"),
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


def main() -> None:
    fixture = json.loads(os.environ["MOODLE_SCORM_FIXTURE"])
    pilot = json.loads(os.environ["MOODLE_A_PILOT"])
    base = os.environ.get("MOODLE_SCORM_URL", "http://localhost:8081")
    token = pilot["token"]
    course_id = positive_id(fixture["courseid"], "SCORM course ID")
    cm_id = positive_id(fixture["cmid"], "SCORM course module ID")
    scorm_id = positive_id(fixture["scormid"], "SCORM activity ID")
    sco_id = positive_id(fixture["scoid"], "SCORM SCO ID")
    user_id = positive_id(fixture["userid"], "SCORM learner ID")
    output = Path(os.environ.get("MOODLE_SCORM_EVIDENCE", "scorm-browser-evidence.json"))

    sco_list = call(base, token, "mod_scorm_get_scorm_scoes", {"scormid": scorm_id})
    items = sco_list.get("scoes") if isinstance(sco_list, dict) else None
    matches = [item for item in items if isinstance(item, dict) and item.get("id") == sco_id] \
        if isinstance(items, list) else []
    if not isinstance(sco_list, dict) or sco_list.get("warnings") != [] or len(matches) != 1 \
            or matches[0].get("scorm") != scorm_id or matches[0].get("scormtype") != "sco":
        output.write_text(json.dumps({
            "fixture": "SYNTHETIC ONLY - SCORM SCO metadata read failed",
            "packageSha256": fixture["packageSha256"],
            "observed": {"scoListRead": sco_list},
        }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise RuntimeError(f"Moodle SCO metadata did not match the parsed synthetic package: {sco_list}")

    last = None
    for _ in range(18):
        attempts = call(base, token, "mod_scorm_get_scorm_attempt_count",
                        {"scormid": scorm_id, "userid": user_id})
        tracks = call(base, token, "mod_scorm_get_scorm_sco_tracks",
                      {"scoid": sco_id, "userid": user_id, "attempt": 0})
        activities = call(base, token, "core_completion_get_activities_completion_status",
                          {"courseid": course_id, "userid": user_id})
        completion = call(base, token, "core_completion_get_course_completion_status",
                          {"courseid": course_id, "userid": user_id})
        last = {"scoListRead": sco_list, "attemptCountRead": attempts, "scoTracksRead": tracks,
                "activityCompletionRead": activities, "courseCompletionRead": completion}

        track_data = tracks.get("data", {}) if isinstance(tracks, dict) else {}
        track_values = {item.get("element"): item.get("value")
                        for item in track_data.get("tracks", []) if isinstance(item, dict)}
        try:
            score = float(track_values.get("score_raw", "nan"))
            raw_score = float(track_values.get("cmi.core.score.raw", "nan"))
        except (TypeError, ValueError):
            score = raw_score = float("nan")
        activity = next((item for item in activities.get("statuses", [])
                         if item.get("cmid") == cm_id), None)
        status = completion.get("completionstatus", {}) if isinstance(completion, dict) else {}
        count = attempts.get("attemptscount") if isinstance(attempts, dict) else None
        if count and count >= 1 and track_values.get("status") == "completed" \
                and track_values.get("cmi.core.lesson_status") == "completed" \
                and score == 100 and raw_score == 100 and activity \
                and activity.get("state") in (1, 2) and activity.get("timecompleted", 0) > 0 \
                and status.get("completed") is True:
            break
        time.sleep(5)
    else:
        output.write_text(json.dumps({
            "fixture": "SYNTHETIC ONLY - SCORM browser read failed",
            "packageSha256": fixture["packageSha256"],
            "observed": last,
        }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise RuntimeError(f"Moodle did not record the browser SCORM completion: {last}")

    if "timecompleted" in status:
        raise RuntimeError("Course completion REST shape changed; review canonical timestamp semantics")
    canonical = call(base, token, "local_hse_evidence_get_completion",
                     {"courseid": course_id, "userid": user_id})
    if not isinstance(canonical, dict) or canonical.get("completed") is not True \
            or canonical.get("courseid") != course_id or canonical.get("userid") != user_id:
        raise RuntimeError(f"Canonical completion has wrong identity or status: {canonical}")
    positive_id(canonical.get("completionid"), "canonical course completion record")
    positive_id(canonical.get("timecompleted"), "canonical course completion time")
    repeated = call(base, token, "local_hse_evidence_get_completion",
                    {"courseid": course_id, "userid": user_id})
    if canonical != repeated:
        raise RuntimeError("Read-only canonical evidence changed on repeat read")
    last["canonicalCompletionRead"] = canonical
    evidence = {
        "fixture": "SYNTHETIC ONLY - manual-auth browser learner; no training credit",
        "packageSha256": fixture["packageSha256"],
        "courseId": course_id,
        "moduleId": cm_id,
        "scormId": scorm_id,
        "scoId": sco_id,
        "learnerId": user_id,
        "observed": last,
        "limitations": [
            "Browser learner uses disposable Moodle manual authentication, not Keycloak OAuth linking",
            "The package is synthetic practice content, not approved workplace training",
            "Canonical course time requires the installed read-only HSE evidence plugin",
            "Neither activity nor course completion grants HSE authorization",
        ],
    }
    output.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"OK Moodle recorded real synthetic SCORM attempt, status, score, activity completion, and course status; evidence: {output}")


if __name__ == "__main__":
    main()
