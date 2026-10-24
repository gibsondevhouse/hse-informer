import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("recovery_ci", Path(__file__).with_name("verify-recovery.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def production_model():
    services = {name: {"image": "ci/app:" + "a" * 40, "ports": [{"published": "3000"}],
        "volumes": [], "environment": {"DATABASE_URL": "postgres://hse_app:synthetic@postgres:5432/hse"}}
        for name in ("postgres", "keycloak", "moodle", "migrate", "web", "jobs", "caddy")}
    services["postgres"]["environment"] = {key: "synthetic" for key in ("HSE_DB_PASSWORD", "KEYCLOAK_DB_PASSWORD", "MOODLE_DB_PASSWORD")}
    return {"name": verifier.SOURCE_PROJECT, "services": services,
            "networks": {"data": {"internal": True}, "edge": {"internal": True}}, "volumes": {}}


class RecoveryCiGuardrails(unittest.TestCase):
    def test_same_row_count_cannot_hide_changed_learning_source_facts(self):
        original = [{"tenant_id": "synthetic-tenant", "assignment_id": "synthetic-assignment",
            "course_version_id": "original-version", "started": True,
            "source_observation": {"startedAttempts": 2}}]
        result = verifier.verify_progress_snapshot(original, json.loads(json.dumps(original)))
        self.assertTrue(result["sourceEqualsRestored"])
        for change in ({"course_version_id": "different-version"}, {"started": False},
                       {"source_observation": {"startedAttempts": 0}}):
            with self.assertRaisesRegex(RuntimeError, "Restored learning observation"):
                verifier.verify_progress_snapshot(original, [{**original[0], **change}])

    def test_refuses_operations_outside_github_ci(self):
        with patch.dict(os.environ, {"CI": "true", "GITHUB_ACTIONS": "false"}, clear=False):
            with self.assertRaisesRegex(ValueError, "only in GitHub"):
                verifier.paths()

    def test_target_uses_distinct_database_identity_storage_and_no_published_ports(self):
        original = production_model()
        target = verifier.target_model(original)
        verifier.validate_target_model(target)
        self.assertEqual(original["name"], verifier.SOURCE_PROJECT)
        self.assertIn("@postgres:5432/hse", original["services"]["web"]["environment"]["DATABASE_URL"])
        self.assertEqual(target["services"]["moodle"]["environment"]["MOODLE_DB_HOST"], "restore-postgres")
        code = next(item for item in target["services"]["moodle"]["volumes"] if item["target"] == "/var/www/moodle")
        self.assertEqual(code["source"], "moodle-code")
        self.assertTrue(code["volume"]["nocopy"])
        target["volumes"]["postgres-data"]["name"] = verifier.SOURCE_PROJECT + "_postgres-data"
        with self.assertRaisesRegex(RuntimeError, "fresh isolated"):
            verifier.validate_target_model(target)

    def test_target_rejects_public_network_or_port(self):
        for mutation in (lambda model: model["networks"]["edge"].update(internal=False),
                         lambda model: model["services"]["web"].update(ports=[{"published": "3000"}])):
            model = verifier.target_model(production_model())
            mutation(model)
            with self.assertRaises(RuntimeError):
                verifier.validate_target_model(model)

    def test_upload_fixture_initializes_scoped_volume_and_keeps_app_nonroot(self):
        successful = subprocess.CompletedProcess([], 0, '{"uploadCreated":true}', '')
        with patch.object(verifier, "helper") as helper:
            with patch.object(verifier.source, "compose", return_value=successful) as compose:
                verifier.prepare_upload(Path("/private-ci-fixture"), "fresh-synthetic-uploads")
                self.assertEqual(helper.call_args.args[1], [("fresh-synthetic-uploads", "/uploads", False)])
                self.assertTrue(any("os.chown('/uploads',1000,1000)" in str(arg) for arg in helper.call_args.args))
                self.assertNotIn("--user", compose.call_args.args)
                self.assertIn("web", compose.call_args.args)
                self.assertTrue(any("process.getuid()===0" in str(arg) for arg in compose.call_args.args))

    def test_private_settings_are_separate_from_evidence_and_marker_is_required(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.dict(os.environ, {"CI": "true", "GITHUB_ACTIONS": "true", "RUNNER_TEMP": temporary}, clear=False):
                work, evidence = verifier.paths()
                with contextlib.redirect_stdout(io.StringIO()):
                    verifier.prepare(work)
                values = verifier.load(work)
                self.assertEqual(values["SMTP_HOST"], "")
                self.assertNotIn(work, evidence.parents)
                self.assertNotEqual(work, evidence)
                (work / "marker").write_text("some other task")
                with self.assertRaisesRegex(ValueError, "marked private"):
                    verifier.load(work)

    def test_file_digest_covers_content_paths_permissions_and_rejects_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            file = root / "canary.txt"
            file.write_text("original")

            def observed(check=True):
                return subprocess.run([sys.executable, "-c", verifier.FILE_STATE_PROGRAM,
                    json.dumps({"uploads": str(root)})], capture_output=True, text=True, check=check)

            initial = json.loads(observed().stdout)
            file.write_text("modified")
            changed = json.loads(observed().stdout)
            self.assertNotEqual(initial, changed)
            file.chmod(0o600)
            changed_mode = json.loads(observed().stdout)
            self.assertNotEqual(changed, changed_mode)
            file.rename(root / "renamed.txt")
            self.assertNotEqual(changed_mode, json.loads(observed().stdout))
            (root / "linked").symlink_to(root / "renamed.txt")
            self.assertNotEqual(observed(check=False).returncode, 0)


if __name__ == "__main__":
    unittest.main()
