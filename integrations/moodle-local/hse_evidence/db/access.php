<?php
defined('MOODLE_INTERNAL') || die();
$capabilities = [
    'local/hse_evidence:linkoauth' => [
        'riskbitmask' => RISK_PERSONAL | RISK_CONFIG,
        'captype' => 'write',
        'contextlevel' => CONTEXT_SYSTEM,
        'archetypes' => [],
    ],
    'local/hse_evidence:endsessions' => [
        'riskbitmask' => RISK_PERSONAL,
        'captype' => 'write',
        'contextlevel' => CONTEXT_SYSTEM,
        'archetypes' => [],
    ],
];
