<?php
defined('MOODLE_INTERNAL') || die();
$functions = [
    'local_hse_evidence_get_completion' => [
        'classname' => 'local_hse_evidence\external\get_completion',
        'methodname' => 'execute',
        'description' => 'Read canonical course completion time and a numeric course grade. Never writes completion.',
        'type' => 'read',
        'capabilities' => 'report/completion:view,moodle/grade:viewall',
        'ajax' => false,
    ],
    'local_hse_evidence_end_user_sessions' => [
        'classname' => 'local_hse_evidence\external\end_user_sessions',
        'methodname' => 'execute',
        'description' => 'End mapped ordinary learner sessions using the supported Moodle session API. Never changes learning records.',
        'type' => 'write',
        'capabilities' => 'local/hse_evidence:endsessions',
        'ajax' => false,
    ],
    'local_hse_evidence_link_oauth_login' => [
        'classname' => 'local_hse_evidence\external\link_oauth_login',
        'methodname' => 'execute',
        'description' => 'Bind an exact server-verified HSE identity to an existing ordinary OAuth learner. Never changes learning records.',
        'type' => 'write',
        'capabilities' => 'local/hse_evidence:linkoauth,auth/oauth2:managelinkedlogins',
        'ajax' => false,
    ],
];

// Separate token and restricted service assignment keep identity writes outside
// the course/enrolment/evidence service. An administrator must enable it.
$services = [
    'HSE identity bridge' => [
        'shortname' => 'hse_identity_bridge',
        'functions' => ['local_hse_evidence_link_oauth_login'],
        'restrictedusers' => 1,
        'enabled' => 0,
        'requiredcapability' => 'local/hse_evidence:linkoauth',
        'downloadfiles' => 0,
        'uploadfiles' => 0,
    ],
];
