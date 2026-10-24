<?php
// Disposable Moodle 5.3 development fixture. This script uses Moodle APIs to
// configure a synthetic course; HSE's integration calls below use REST only.
define('CLI_SCRIPT', true);
require_once('/var/www/moodle/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->dirroot . '/completion/criteria/completion_criteria_date.php');
require_once($CFG->dirroot . '/webservice/lib.php');
require_once($CFG->libdir . '/enrollib.php');

global $DB, $USER;
$USER = get_admin();
set_config('enablecompletion', 1);
set_config('enablewebservices', 1);
set_config('webserviceprotocols', 'rest');

$shortname = 'HSE-SYNTHETIC-PILOT';
$course = $DB->get_record('course', ['shortname' => $shortname]);
if (!$course) {
    $category = core_course_category::get_default();
    $course = create_course((object) [
        'category' => $category->id,
        'fullname' => 'HSE synthetic REST pilot - no training credit',
        'shortname' => $shortname,
        'idnumber' => 'HSE-SYNTHETIC-ONLY',
        'format' => 'topics',
        'enablecompletion' => 1,
        'visible' => 1,
    ]);
}
if ((int) $course->enablecompletion !== 1) {
    throw new RuntimeException('Synthetic course completion tracking is disabled');
}

// A future date criterion makes a real incomplete REST response available
// without fabricating SCORM completion or a historical evidence timestamp.
if (!completion_criteria_date::fetch(['course' => $course->id])) {
    $criterion = new completion_criteria_date();
    $data = (object) [
        'id' => $course->id,
        'criteria_date' => 1,
        'criteria_date_value' => time() + 10 * 365 * DAYSECS,
    ];
    $criterion->update_config($data);
}

$manual = enrol_get_plugin('manual');
if (!$manual) {
    throw new RuntimeException('Manual enrolment plugin is unavailable');
}
$hasmanual = false;
foreach (enrol_get_instances($course->id, true) as $instance) {
    $hasmanual = $hasmanual || $instance->enrol === 'manual';
}
if (!$hasmanual) {
    $manual->add_instance($course);
}

$manager = new webservice();
$service = $manager->get_external_service_by_shortname('hse_synthetic_pilot_probe');
if (!$service) {
    $service = (object) [
        'name' => 'HSE synthetic REST pilot probe',
        'shortname' => 'hse_synthetic_pilot_probe',
        'enabled' => 1,
        'restrictedusers' => 1,
        'downloadfiles' => 0,
        'uploadfiles' => 0,
    ];
    $service->id = $manager->add_external_service($service);
    $manager->add_ws_authorised_user((object) [
        'externalserviceid' => $service->id,
        'userid' => $USER->id,
    ]);
}
$existing = array_map(static fn($function) => $function->name,
    $manager->get_external_functions([$service->id]));
foreach ([
    'core_webservice_get_site_info',
    'core_user_get_users_by_field',
    'core_user_create_users',
    'core_user_update_users',
    'core_user_update_user_preferences',
    'core_message_get_user_notification_preferences',
    'core_course_get_courses_by_field',
    'local_hse_evidence_get_completion',
    'local_hse_evidence_end_user_sessions',
    'enrol_manual_enrol_users',
    'core_enrol_get_users_courses',
    'core_completion_get_course_completion_status',
    'core_cohort_create_cohorts',
    'core_cohort_get_cohorts',
    'core_cohort_add_cohort_members',
    'core_cohort_get_cohort_members',
] as $function) {
    if (!in_array($function, $existing, true)) {
        $manager->add_external_function_to_service($function, $service->id);
    }
}

$token = \core_external\util::generate_token(
    EXTERNAL_TOKEN_PERMANENT,
    $service,
    $USER->id,
    context_system::instance(),
    time() + 3600,
    '',
    'HSE synthetic pilot CI'
);
$roleid = (int) $DB->get_field('role', 'id', ['shortname' => 'student'], MUST_EXIST);
fwrite(STDOUT, json_encode([
    'token' => $token,
    'courseid' => (int) $course->id,
    'studentroleid' => $roleid,
], JSON_THROW_ON_ERROR) . PHP_EOL);
