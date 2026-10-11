<?php
// Creates a narrowly scoped, synthetic web-service token for cross-instance CI.
// This is an external test fixture and never changes Moodle core files.
define('CLI_SCRIPT', true);
require_once('/var/www/moodle/config.php');
require_once($CFG->dirroot . '/webservice/lib.php');

global $DB, $USER;
$admin = get_admin();
$USER = $admin;
$manager = new webservice();
$shortname = 'hse_synthetic_isolation_probe';

set_config('enablewebservices', 1);
set_config('webserviceprotocols', 'rest');

$service = $manager->get_external_service_by_shortname($shortname);
if (!$service) {
    $service = (object) [
        'name' => 'HSE synthetic isolation probe',
        'shortname' => $shortname,
        'enabled' => 1,
        'restrictedusers' => 1,
        'downloadfiles' => 0,
        'uploadfiles' => 0,
    ];
    $service->id = $manager->add_external_service($service);
    $manager->add_external_function_to_service('core_webservice_get_site_info', $service->id);
    $manager->add_ws_authorised_user((object) [
        'externalserviceid' => $service->id,
        'userid' => $admin->id,
    ]);
}

$token = \core_external\util::generate_token(
    EXTERNAL_TOKEN_PERMANENT,
    $service,
    $admin->id,
    context_system::instance(),
    time() + 3600,
    '',
    'HSE synthetic isolation CI'
);
fwrite(STDOUT, $token . PHP_EOL);
