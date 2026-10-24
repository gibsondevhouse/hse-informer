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
];
