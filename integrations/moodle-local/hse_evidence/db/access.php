<?php
defined('MOODLE_INTERNAL') || die();
$capabilities = [
    'local/hse_evidence:endsessions' => [
        'riskbitmask' => RISK_PERSONAL,
        'captype' => 'write',
        'contextlevel' => CONTEXT_SYSTEM,
        'archetypes' => [],
    ],
];
