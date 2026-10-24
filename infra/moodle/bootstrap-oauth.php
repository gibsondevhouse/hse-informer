<?php
// Disposable development fixture only. No per-user login links are created here.
define('CLI_SCRIPT', true);
require_once('/var/www/moodle/config.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/webservice/lib.php');

global $DB, $USER;
$USER = get_admin();
$issuerurl = 'https://auth.localhost:8443/realms/hse-dev';
$secret = getenv('MOODLE_A_OIDC_CLIENT_SECRET');
if (!$secret || $CFG->wwwroot !== 'http://localhost:8081') {
    throw new RuntimeException('This bootstrap requires the disposable company A fixture and its client secret');
}
// Retain the HTTP block list except for the one Keycloak container address.
// Moodle's normal discovery/token HTTP client still performs its security checks.
$ip = gethostbyname('auth.localhost');
if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) || $ip === '127.0.0.1') {
    throw new RuntimeException('Development Keycloak container address could not be resolved');
}
$address = ip2long($ip) & 0xffffffff;
$blocked = preg_split('/\s+/', trim($CFG->curlsecurityblockedhosts ?? ''), -1, PREG_SPLIT_NO_EMPTY);
$remaining = [];
foreach ($blocked as $entry) {
    if (!preg_match('~^(\d+\.\d+\.\d+\.\d+)/(\d+)$~', $entry, $parts)) {
        if ($entry !== $ip) { $remaining[] = $entry; }
        continue;
    }
    $prefix = (int) $parts[2];
    $network = ip2long($parts[1]) & 0xffffffff;
    $mask = $prefix ? ((0xffffffff << (32 - $prefix)) & 0xffffffff) : 0;
    if (($address & $mask) !== ($network & $mask)) { $remaining[] = $entry; continue; }
    $network &= $mask;
    while ($prefix < 32) {
        $prefix++;
        $bit = 1 << (32 - $prefix);
        $sibling = ($address & $bit) ? $network : ($network | $bit);
        $remaining[] = long2ip($sibling) . '/' . $prefix;
        if ($address & $bit) { $network |= $bit; }
    }
}
set_config('curlsecurityblockedhosts', implode("\n", $remaining));
$ports = preg_split('/\s+/', trim($CFG->curlsecurityallowedport ?? "80\n443"), -1, PREG_SPLIT_NO_EMPTY);
set_config('curlsecurityallowedport', implode("\n", array_unique(array_merge($ports, ['8443']))));
$auth = array_filter(explode(',', $CFG->auth ?? ''));
set_config('auth', implode(',', array_unique(array_merge($auth, ['oauth2']))));
set_config('authpreventaccountcreation', 1);
set_config('field_lock_idnumber', 'locked', 'auth_oauth2');
set_config('field_lock_email', 'locked', 'auth_oauth2');
$issuers = \core\oauth2\issuer::get_records(['name' => 'HSE portal synthetic SSO']);
if (count($issuers) > 1) { throw new RuntimeException('Ambiguous synthetic issuer'); }
if (!$issuers) {
    $issuer = \core\oauth2\api::create_issuer((object) [
        'name' => 'HSE portal synthetic SSO', 'baseurl' => $issuerurl,
        'clientid' => 'moodle-hse-a', 'clientsecret' => $secret,
        'enabled' => 1, 'showonloginpage' => \core\oauth2\issuer::EVERYWHERE,
        'loginpagename' => 'HSE portal synthetic SSO', 'requireconfirmation' => 1,
        'loginscopes' => 'openid profile email', 'loginscopesoffline' => 'openid profile email',
        'basicauth' => 0,
    ]);
} else {
    $issuer = reset($issuers);
    if ($issuer->get('baseurl') !== $issuerurl || $issuer->get('clientid') !== 'moodle-hse-a'
            || !$issuer->get('requireconfirmation') || !$issuer->get('enabled')) {
        throw new RuntimeException('Existing synthetic issuer has unexpected security settings');
    }
}
$mappings = \core\oauth2\api::get_user_field_mappings($issuer);
$username = array_filter($mappings, static fn($m) => $m->get('internalfield') === 'username');
if (!$username) {
    \core\oauth2\api::create_user_field_mapping((object) [
        'issuerid' => $issuer->get('id'), 'externalfield' => 'sub', 'internalfield' => 'username',
    ]);
} else if (count($username) !== 1 || reset($username)->get('externalfield') !== 'sub') {
    throw new RuntimeException('Synthetic issuer username mapping must use the immutable OIDC subject');
}
set_config('oauthissuerid', $issuer->get('id'), 'local_hse_evidence');
set_config('oauthissuerurl', $issuerurl, 'local_hse_evidence');

// A dedicated identity-bridge account has no enrolment, user-edit, or site-config capabilities.
$bridge = $DB->get_record('user', ['username' => 'hse.identity.bridge', 'mnethostid' => $CFG->mnet_localhost_id]);
if (!$bridge) {
    $bridgeid = user_create_user((object) ['username' => 'hse.identity.bridge', 'auth' => 'manual',
        'password' => 'HseBridge1!' . random_string(50), 'firstname' => 'Synthetic', 'lastname' => 'Identity bridge',
        'email' => 'bridge@example.invalid', 'confirmed' => 1, 'emailstop' => 1,
        'mnethostid' => $CFG->mnet_localhost_id], true, false);
    $bridge = core_user::get_user($bridgeid, '*', MUST_EXIST);
}
$roleid = $DB->get_field('role', 'id', ['shortname' => 'hseidentitybridge']);
if (!$roleid) { $roleid = create_role('HSE synthetic identity bridge', 'hseidentitybridge', 'Disposable CI service'); }
$system = context_system::instance();
foreach (['local/hse_evidence:linkoauth', 'auth/oauth2:managelinkedlogins', 'webservice/rest:use'] as $capability) {
    assign_capability($capability, CAP_ALLOW, $roleid, $system->id);
}
role_assign($roleid, $bridge->id, $system->id);
$manager = new webservice();
$service = $manager->get_external_service_by_shortname('hse_identity_bridge');
if (!$service) { throw new RuntimeException('Install or upgrade local_hse_evidence before configuring its identity bridge'); }
$service->enabled = 1;
$service->restrictedusers = 1;
$manager->update_external_service($service);
if (!$DB->record_exists('external_services_users', ['externalserviceid' => $service->id, 'userid' => $bridge->id])) {
    $manager->add_ws_authorised_user((object) ['externalserviceid' => $service->id, 'userid' => $bridge->id]);
}
$token = \core_external\util::generate_token(EXTERNAL_TOKEN_PERMANENT, $service, $bridge->id,
    $system, time() + 3600, '', 'HSE synthetic identity bridge CI');
fwrite(STDOUT, json_encode(['issuerid' => (int) $issuer->get('id'), 'bridgeToken' => $token], JSON_THROW_ON_ERROR) . PHP_EOL);
