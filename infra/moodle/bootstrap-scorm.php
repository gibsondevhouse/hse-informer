<?php
// Disposable Moodle 5.3 SCORM browser fixture. Uses Moodle course, file,
// module, completion, and enrolment APIs; it never writes tracking records.
define('CLI_SCRIPT', true);
require_once('/var/www/moodle/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/completion/criteria/completion_criteria_activity.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');
require_once($CFG->dirroot . '/webservice/lib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/enrollib.php');

global $CFG, $DB, $PAGE, $USER;
$USER = get_admin();
$package = getenv('SCORM_PACKAGE_PATH') ?: '/tmp/synthetic-scorm-1.2.zip';
$password = getenv('SCORM_LEARNER_PASSWORD');
if (!is_file($package) || !$password) {
    throw new RuntimeException('Synthetic SCORM ZIP and learner password are required');
}
set_config('enablecompletion', 1);

$course = $DB->get_record('course', ['shortname' => 'HSE-SCORM-SYNTHETIC']);
if (!$course) {
    $category = core_course_category::get_default();
    $course = create_course((object) [
        'category' => $category->id,
        'fullname' => 'HSE synthetic SCORM browser probe - no training credit',
        'shortname' => 'HSE-SCORM-SYNTHETIC',
        'idnumber' => 'HSE-SCORM-SYNTHETIC-ONLY',
        'format' => 'topics',
        'enablecompletion' => 1,
        'visible' => 1,
    ]);
}
if ((int) $course->enablecompletion !== 1) {
    throw new RuntimeException('SCORM fixture course completion is disabled');
}

$PAGE->set_context(context_course::instance($course->id));
$PAGE->set_url(new moodle_url('/course/view.php', ['id' => $course->id]));
$existing = $DB->get_record('scorm', [
    'course' => $course->id,
    'name' => 'Synthetic SCORM 1.2 completion probe',
]);
$cm = $existing ? get_coursemodule_from_instance('scorm', $existing->id, $course->id) : false;
if (!$cm) {
    // Moodle's SCORM test generator stages a ZIP as a user draft file; the
    // core add_moduleinfo() path saves and parses it as a normal activity.
    $draftid = file_get_unused_draft_itemid();
    get_file_storage()->create_file_from_pathname([
        'contextid' => context_user::instance($USER->id)->id,
        'component' => 'user',
        'filearea' => 'draft',
        'itemid' => $draftid,
        'filepath' => '/',
        'filename' => basename($package),
    ], $package);
    [$module] = can_add_moduleinfo($course, 'scorm', 0);
    $info = get_config('scorm');
    $info->modulename = 'scorm';
    $info->module = $module->id;
    $info->section = 0;
    $info->visible = 1;
    $info->cmidnumber = '';
    $info->name = 'Synthetic SCORM 1.2 completion probe';
    $info->intro = 'Synthetic test content only; no training credit.';
    $info->introformat = FORMAT_HTML;
    $info->scormtype = SCORM_TYPE_LOCAL;
    $info->packagefile = $draftid;
    $info->width = $info->framewidth;
    $info->height = $info->frameheight;
    $info->completion = COMPLETION_TRACKING_AUTOMATIC;
    $info->completionview = 0;
    $info->completionstatusrequired = 4; // Moodle's "completed" status bit.
    $info->completionscorerequired = null;
    $info->completionstatusallscos = 0;
    $created = add_moduleinfo($info, $course);
    $cm = get_coursemodule_from_id('scorm', $created->coursemodule, $course->id, false, MUST_EXIST);
}
$scorm = $DB->get_record('scorm', ['id' => $cm->instance], '*', MUST_EXIST);
if (strtoupper((string) $scorm->version) !== 'SCORM_1.2') {
    throw new RuntimeException('Moodle did not parse the ZIP as SCORM 1.2: ' . $scorm->version);
}
$sco = $DB->get_record('scorm_scoes', ['scorm' => $scorm->id, 'scormtype' => 'sco'], '*', MUST_EXIST);
if (!completion_criteria_activity::fetch(['course' => $course->id, 'moduleinstance' => $cm->id])) {
    $criterion = new completion_criteria_activity();
    $data = (object) ['id' => $course->id, 'criteria_activity' => [$cm->id => 1]];
    $criterion->update_config($data);
}

$username = 'synthetic.scorm.learner';
$learner = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id]);
if (!$learner) {
    $userid = \core\user::create_user((object) [
        'auth' => 'manual',
        'username' => $username,
        'firstname' => 'Synthetic',
        'lastname' => 'SCORM Learner',
        'email' => 'scorm.learner@example.invalid',
        'confirmed' => 1,
        'mnethostid' => $CFG->mnet_localhost_id,
        'password' => $password,
    ]);
    $learner = core_user::get_user($userid, '*', MUST_EXIST);
}

$manual = enrol_get_plugin('manual');
if (!$manual) {
    throw new RuntimeException('Manual enrolment plugin is unavailable');
}
$instance = null;
foreach (enrol_get_instances($course->id, true) as $candidate) {
    if ($candidate->enrol === 'manual') {
        $instance = $candidate;
        break;
    }
}
if (!$instance) {
    $instanceid = $manual->add_instance($course);
    $instance = $DB->get_record('enrol', ['id' => $instanceid], '*', MUST_EXIST);
}
if (!is_enrolled(context_course::instance($course->id), $learner->id)) {
    $roleid = (int) $DB->get_field('role', 'id', ['shortname' => 'student'], MUST_EXIST);
    $manual->enrol_user($instance, $learner->id, $roleid);
}
if (!is_enrolled(context_course::instance($course->id), $learner->id)) {
    throw new RuntimeException('Synthetic SCORM learner was not enrolled');
}

$manager = new webservice();
$service = $manager->get_external_service_by_shortname('hse_synthetic_pilot_probe', MUST_EXIST);
$existing = array_map(static fn($function) => $function->name,
    $manager->get_external_functions([$service->id]));
foreach ([
    'mod_scorm_get_scorm_attempt_count',
    'mod_scorm_get_scorm_sco_tracks',
    'core_completion_get_activities_completion_status',
] as $function) {
    if (!in_array($function, $existing, true)) {
        $manager->add_external_function_to_service($function, $service->id);
    }
}

fwrite(STDOUT, json_encode([
    'courseid' => (int) $course->id,
    'cmid' => (int) $cm->id,
    'scormid' => (int) $scorm->id,
    'scoid' => (int) $sco->id,
    'userid' => (int) $learner->id,
    'username' => $username,
    'packageSha256' => hash_file('sha256', $package),
], JSON_THROW_ON_ERROR) . PHP_EOL);
