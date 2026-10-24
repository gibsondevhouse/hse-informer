<?php
namespace local_hse_evidence\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

defined('MOODLE_INTERNAL') || die();

/** Bind one server-verified HSE identity to an existing ordinary Moodle learner. */
class link_oauth_login extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'Server-resolved mapped learner ID'),
            'hseid' => new external_value(PARAM_RAW, 'Exact immutable HSE UUID stored as Moodle idnumber'),
            'subject' => new external_value(PARAM_RAW, 'Active portal principal subject from the expected OIDC issuer'),
            'identityemail' => new external_value(PARAM_RAW, 'Exact immutable identity email, including technical addresses'),
            'issuerid' => new external_value(PARAM_INT, 'Explicit Moodle OAuth issuer ID'),
            'issuerurl' => new external_value(PARAM_RAW, 'Exact expected OIDC issuer base URL'),
        ]);
    }

    public static function execute(
        int $userid,
        string $hseid,
        string $subject,
        string $identityemail,
        int $issuerid,
        string $issuerurl
    ): array {
        global $DB;
        $params = self::validate_parameters(self::execute_parameters(),
            compact('userid', 'hseid', 'subject', 'identityemail', 'issuerid', 'issuerurl'));
        $context = \context_system::instance();
        self::validate_context($context);
        require_capability('local/hse_evidence:linkoauth', $context);
        require_capability('auth/oauth2:managelinkedlogins', \context_user::instance($params['userid']));
        if (\core\session\manager::is_loggedinas()) {
            throw new \moodle_exception('notwhileloggedinas', 'auth_oauth2');
        }
        // Moodle lowercases the mapped username during OAuth login. Refuse a
        // subject it would change instead of linking a different OIDC identity.
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $params['hseid'])
            || !preg_match('/^[a-z0-9][a-z0-9._:@-]{0,254}$/D', $params['subject'])
            || !validate_email($params['identityemail']) || strlen($params['identityemail']) > 254) {
            throw new \invalid_parameter_exception('Invalid immutable identity fields');
        }
        $issuer = self::validated_issuer($params['issuerid'], $params['issuerurl']);
        if (!$issuer->is_valid_login_domain($params['identityemail'])) {
            throw new \moodle_exception('oauthbridgeconfiguration', 'local_hse_evidence');
        }

        // Serialize bridge calls sharing either side of the binding. All core
        // data writes remain inside the supported auth_oauth2 API below.
        $factory = \core\lock\lock_config::get_lock_factory('local_hse_evidence');
        $resources = ['oauthuser:' . $params['userid'],
            'oauthsubject:' . $params['issuerid'] . ':' . hash('sha256', $params['subject'])];
        sort($resources, SORT_STRING);
        $locks = [];
        try {
            foreach ($resources as $resource) {
                $lock = $factory->get_lock($resource, 10);
                if (!$lock) {
                    throw new \moodle_exception('oauthbridgebusy', 'local_hse_evidence');
                }
                $locks[] = $lock;
            }
            self::validate_target($params);
            if (!self::validated_link($params)) {
                $transaction = $DB->start_delegated_transaction();
                try {
                    \auth_oauth2\api::link_login([
                        'username' => $params['subject'],
                        'email' => $params['identityemail'],
                    ], $issuer, $params['userid']);
                    // Check the supported API produced exactly the intended binding.
                    if (!self::validated_link($params)) {
                        throw new \moodle_exception('oauthbridgeconflict', 'local_hse_evidence');
                    }
                    $transaction->allow_commit();
                } catch (\Throwable $error) {
                    $transaction->rollback($error);
                }
            }
            return ['userid' => $params['userid'], 'issuerid' => $params['issuerid'], 'linked' => true];
        } finally {
            foreach (array_reverse($locks) as $lock) {
                $lock->release();
            }
        }
    }

    /** Require one explicitly configured, usable issuer whose mapping uses OIDC sub. */
    private static function validated_issuer(int $issuerid, string $issuerurl): \core\oauth2\issuer {
        $configuredid = (int) get_config('local_hse_evidence', 'oauthissuerid');
        $configuredurl = (string) get_config('local_hse_evidence', 'oauthissuerurl');
        if ($configuredid < 1 || $configuredurl === '' || $issuerid !== $configuredid || $issuerurl !== $configuredurl) {
            throw new \moodle_exception('oauthbridgeconfiguration', 'local_hse_evidence');
        }
        $issuer = \core\oauth2\api::get_issuer($configuredid);
        if ($issuer->get('baseurl') !== $configuredurl || !$issuer->get('requireconfirmation')
            || !$issuer->is_available_for_login()
            || !\core\di::get(\core\authentication::class)->is_enabled('oauth2')
            || get_config('auth_oauth2', 'field_lock_idnumber') !== 'locked'
            || get_config('auth_oauth2', 'field_lock_email') !== 'locked') {
            throw new \moodle_exception('oauthbridgeconfiguration', 'local_hse_evidence');
        }
        $identitymappings = ['username' => [], 'email' => []];
        foreach (\core\oauth2\api::get_user_field_mappings($issuer) as $mapping) {
            $field = $mapping->get('internalfield');
            if ($field === 'idnumber') {
                throw new \moodle_exception('oauthbridgeconfiguration', 'local_hse_evidence');
            }
            if (array_key_exists($field, $identitymappings)) {
                $identitymappings[$field][] = $mapping->get('externalfield');
            }
        }
        if ($identitymappings !== ['username' => ['sub'], 'email' => ['email']]) {
            throw new \moodle_exception('oauthbridgeconfiguration', 'local_hse_evidence');
        }
        return $issuer;
    }

    /** Verify exact immutable metadata and keep the bridge away from administrators. */
    private static function validate_target(array $params): void {
        global $CFG, $DB, $USER;
        $target = \core_user::get_user($params['userid'], '*', MUST_EXIST);
        $context = \context_system::instance();
        if ($target->deleted || $target->suspended || !$target->confirmed || $target->auth !== 'oauth2'
            || $target->mnethostid != $CFG->mnet_localhost_id || isguestuser($target) || is_siteadmin($target)
            || $target->id == $USER->id || $target->idnumber !== $params['hseid']
            || $target->email !== $params['identityemail']
            || $DB->count_records('user', ['idnumber' => $params['hseid'], 'deleted' => 0]) !== 1
            || $DB->count_records('user', ['email' => $params['identityemail'], 'deleted' => 0]) !== 1) {
            throw new \moodle_exception('oauthbridgetarget', 'local_hse_evidence');
        }
        foreach (['moodle/site:config', 'moodle/user:create', 'moodle/user:update', 'moodle/user:delete',
            'moodle/role:assign', 'moodle/webservice:createtoken', 'local/hse_evidence:linkoauth',
            'local/hse_evidence:endsessions'] as $capability) {
            if (has_capability($capability, $context, $target)) {
                throw new \moodle_exception('oauthbridgetarget', 'local_hse_evidence');
            }
        }
    }

    /** Never repair, confirm, replace, or adopt any existing conflicting link. */
    private static function validated_link(array $params): bool {
        $userlinks = \auth_oauth2\linked_login::get_records(['userid' => $params['userid']]);
        $subjectlinks = \auth_oauth2\linked_login::get_records([
            'issuerid' => $params['issuerid'], 'username' => $params['subject'],
        ]);
        if (!$userlinks && !$subjectlinks) {
            return false;
        }
        if (count($userlinks) !== 1 || count($subjectlinks) !== 1) {
            throw new \moodle_exception('oauthbridgeconflict', 'local_hse_evidence');
        }
        $link = reset($userlinks);
        $subjectlink = reset($subjectlinks);
        if ($link->get('id') !== $subjectlink->get('id') || (int) $link->get('userid') !== $params['userid']
            || (int) $link->get('issuerid') !== $params['issuerid'] || $link->get('username') !== $params['subject']
            || $link->get('email') !== $params['identityemail'] || $link->get('confirmtoken') !== ''
            || (int) $link->get('confirmtokenexpires') !== 0) {
            throw new \moodle_exception('oauthbridgeconflict', 'local_hse_evidence');
        }
        return true;
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'userid' => new external_value(PARAM_INT, 'Exactly matched Moodle learner ID'),
            'issuerid' => new external_value(PARAM_INT, 'Explicit configured OAuth issuer ID'),
            'linked' => new external_value(PARAM_BOOL, 'Exact confirmed identity binding exists'),
        ]);
    }
}
