import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import quote, quote_plus

spec = importlib.util.spec_from_file_location("single_host_ci", Path(__file__).with_name("verify-single-host.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class SingleHostCiGuardrails(unittest.TestCase):
    def test_destructive_operations_are_refused_outside_github_ci(self):
        with patch.dict(os.environ, {"CI": "true", "GITHUB_ACTIONS": "false"}, clear=False):
            with self.assertRaisesRegex(ValueError, "only in GitHub"):
                verifier.ci_paths()

    def test_diagnostics_redact_raw_and_encoded_generated_credentials(self):
        secret = "Synthetic+A!Password /?"
        message = " ".join([secret, quote(secret, safe=""), quote_plus(secret), "ordinary diagnostic"])
        result = verifier.redact(message, {"MOODLE_ADMIN_PASSWORD": secret, "APP_HOST": "app.single-host.test"})
        self.assertNotIn(secret, result)
        self.assertNotIn(quote(secret, safe=""), result)
        self.assertNotIn(quote_plus(secret), result)
        self.assertEqual(result.count("[redacted]"), 3)
        self.assertIn("ordinary diagnostic", result)

    def test_private_fixture_has_no_smtp_delivery_or_public_network_and_is_not_an_artifact(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.dict(os.environ, {"CI": "true", "GITHUB_ACTIONS": "true", "RUNNER_TEMP": temporary}, clear=False):
                work, evidence = verifier.ci_paths()
                with contextlib.redirect_stdout(io.StringIO()):
                    verifier.prepare(work)
                settings = verifier.load_settings(work)
                self.assertEqual(stat.S_IMODE((work / "beta.env").stat().st_mode), 0o600)
                self.assertEqual(settings["SMTP_HOST"], "")
                self.assertNotIn("DEV_AUTH", settings)
                self.assertNotIn(work, evidence.parents)
                self.assertNotEqual(work, evidence)
                isolation = json.loads((work / "ci-isolation.json").read_text())
                self.assertTrue(isolation["networks"]["edge"]["internal"])
                self.assertEqual(settings["ALERT_WEBHOOK_URL"], "https://alerts.single-host.test/no-delivery")
                # Any real/domain-replaced configuration must be rejected before
                # a cleanup command can reach Docker.
                data = (work / "beta.env").read_text().replace("app.single-host.test", "app.real-company.example")
                (work / "beta.env").write_text(data)
                with self.assertRaisesRegex(ValueError, "ephemeral CI fixture"):
                    verifier.load_settings(work)


if __name__ == "__main__":
    unittest.main()
