<?php
namespace local_hse_evidence\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

defined('MOODLE_INTERNAL') || die();

/** Narrow authentication-state write for HSE coordinated worker sign-out. */
class end_user_sessions extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'Server-resolved mapped learner ID'),
        ]);
    }

    public static function execute(int $userid): array {
        global $USER;
        $params = self::validate_parameters(self::execute_parameters(), compact('userid'));
        $context = \context_system::instance();
        self::validate_context($context);
        require_capability('local/hse_evidence:endsessions', $context);
        $target = \core_user::get_user($params['userid'], '*', MUST_EXIST);
        // The HSE server accepts no caller-supplied Moodle ID: it resolves its
        // authenticated person's tenant/instance mapping. Moodle independently
        // protects privileged and technical principals from this worker API.
        if ($target->deleted || isguestuser($target) || is_siteadmin($target)
            || $target->id == $USER->id || $target->auth === 'webservice'
            || has_capability('moodle/site:config', $context, $target)
            || has_capability('moodle/user:update', $context, $target)
            || has_capability('local/hse_evidence:endsessions', $context, $target)) {
            throw new \moodle_exception('accessdenied', 'admin');
        }
        \core\session\manager::destroy_user_sessions($target->id);
        if (\core\session\manager::get_sessions_by_userid($target->id)) {
            throw new \moodle_exception('sessionerroruser', 'error');
        }
        return ['userid' => (int) $target->id, 'ended' => true];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'userid' => new external_value(PARAM_INT, 'Mapped learner whose sessions ended'),
            'ended' => new external_value(PARAM_BOOL, 'Supported session-ending API completed'),
        ]);
    }
}
