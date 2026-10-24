<?php
$string['pluginname'] = 'HSE completion evidence';
$string['privacy:metadata'] = 'This plugin uses existing Moodle completion, session, and OAuth linked-login APIs and stores no personal data in additional plugin tables.';
$string['hse_evidence:endsessions'] = 'End mapped learner sessions during HSE coordinated sign-out';
$string['hse_evidence:linkoauth'] = 'Bind a verified HSE identity to an existing ordinary OAuth learner';
$string['oauthissuerid'] = 'HSE identity bridge OAuth issuer ID';
$string['oauthissuerid_desc'] = 'Explicit Moodle OAuth service ID. Zero disables identity linking. The bridge never selects an issuer by email or display name.';
$string['oauthissuerurl'] = 'HSE identity bridge OIDC issuer URL';
$string['oauthissuerurl_desc'] = 'Exact expected OIDC issuer base URL, including any trailing slash. It must match the configured Moodle OAuth service and the HSE portal.';
$string['oauthbridgebusy'] = 'The identity binding is busy. Retry the request.';
$string['oauthbridgeconfiguration'] = 'The HSE identity bridge issuer or immutable-field configuration is invalid.';
$string['oauthbridgetarget'] = 'The Moodle account does not match an eligible HSE learner identity.';
$string['oauthbridgeconflict'] = 'An existing OAuth identity binding conflicts with this request. An administrator must review it.';
