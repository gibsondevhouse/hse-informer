# Moodle completion evidence and coordinated sign-out

Moodle delivers all beta courses. Its core course-completion REST response exposes criterion timestamps, but omits the canonical course timestamp. This optional local plugin exposes the existing `completion_completion::fetch()` record and numeric course grade through Moodle's External Services API. Its evidence endpoint is read-only: it never marks training complete, changes course evidence, or modifies Moodle core.

Install this directory as `public/local/hse_evidence` in each customer's Moodle 5.3 installation and run the supported Moodle upgrade command. Enable `local_hse_evidence_get_completion` in the HSE service's allowlist. The dedicated service account needs `report/completion:view` and `moodle/grade:viewall` in the mapped course; normal Moodle context, active enrollment, user, and group checks also apply. Do not grant a learner this service token.

Set `completionEvidence` to `local_hse_evidence` on that tenant's `MOODLE_CONNECTIONS_JSON` entry. Tokens stay on the HSE server. Without this explicit setting, the adapter continues to report observations without fabricating a completion date. An unavailable plugin, missing capability, mismatched identity, or invalid timestamp fails reconciliation and leaves existing evidence unchanged.

Course grades are normalized from the numeric course total and are not represented as a particular quiz score. Scale grades and absent grades stay null. Attempts and SCORM details continue to use the core SCORM APIs when a verified activity mapping exists. Pass marks, assessment attempts, remediation and course-completion criteria are configured and tested in Moodle before the HSE mapping is published.

Before production, run the plugin's PHPUnit tests on the exact deployed Moodle patch and demonstrate an actual learner's fail, retry, pass, cron aggregation, and unchanged timestamp after synchronization. TypeScript adapter tests exercise the declared response contract; they do not replace deployment verification.

## Coordinated sign-out

`local_hse_evidence_end_user_sessions` is a separately declared **authentication-state write**. It calls Moodle's supported `core\session\manager::destroy_user_sessions()` API and confirms no sessions remain for that worker. It never edits learning records. Add this function to the HSE service allowlist and explicitly grant `local/hse_evidence:endsessions` to its dedicated service role at system context; no standard role receives it automatically. Install/upgrade plugin version `2026102401` or later.

The HSE logout server resolves the current authenticated person's Moodle user through its validated tenant/instance mapping. It must not accept an arbitrary Moodle user ID from the browser. The plugin independently rejects guest, deleted, site administrator, service-account, webservice-auth, and system/user-administration targets. This company-specific Moodle instance remains the service boundary. The operation ends all Moodle sessions for that ordinary worker, including sessions on another device, before identity-provider logout prevents immediate single-sign-on reentry.

The adapter requires the configured plugin and a matching `{userid, ended:true}` response; service or permission failures must be reported as incomplete coordinated sign-out. A local HSE cookie being cleared alone is not proof that a Moodle browser session ended. Test the actual existing Moodle browser session and Keycloak session on the deployed pair. [Supported Moodle session manager](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/lib/classes/session/manager.php).

Primary references: [Moodle completion external service](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/completion/classes/external.php), [canonical completion API](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/completion/completion_completion.php), and [external service development](https://moodledev.io/docs/5.3/apis/subsystems/external/writing-a-service).
