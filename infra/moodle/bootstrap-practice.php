<?php
// Disposable Moodle 5.3 practice fixture. Configuration uses supported APIs;
// browser learners alone create views, attempts, grades, and completion evidence.
define('CLI_SCRIPT', true);
ob_start();
require_once('/var/www/moodle/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->libdir . '/resourcelib.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/completion/criteria/completion_criteria_activity.php');
require_once($CFG->dirroot . '/completion/completion_aggregation.php');
require_once($CFG->libdir . '/questionlib.php');
require_once($CFG->dirroot . '/question/format.php');
require_once($CFG->dirroot . '/question/format/gift/format.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/webservice/lib.php');
require_once($CFG->libdir . '/enrollib.php');

$stage = 'fixture guard';
set_exception_handler(static function (Throwable $error) use (&$stage): void {
    while (ob_get_level()) { ob_end_clean(); }
    $message = $error->getMessage();
    foreach ([getenv('PRACTICE_LEARNER_PASSWORD'), getenv('MOODLE_ADMIN_PASSWORD')] as $secret) {
        if (is_string($secret) && $secret !== '') { $message = str_replace($secret, '[redacted]', $message); }
    }
    fwrite(STDERR, sprintf("Practice fixture failed during %s: %s: %s at %s:%d\n",
        $stage, get_class($error), $message, basename($error->getFile()), $error->getLine()));
    exit(1);
});

global $DB, $PAGE, $USER;
if ($CFG->wwwroot !== 'http://localhost:8081' || getenv('HSE_PRACTICE_FIXTURE') !== '1') {
    throw new RuntimeException('Only the explicitly enabled disposable company A fixture may install practice content');
}
$password = getenv('PRACTICE_LEARNER_PASSWORD');
if (!is_string($password) || strlen($password) < 12) {
    throw new RuntimeException('A fixture-only PRACTICE_LEARNER_PASSWORD of at least 12 characters is required');
}
$USER = get_admin();
$root = '/opt/hse/beta-practice/1.0.0';
$stage = 'source digest validation';
$manifest = json_decode(file_get_contents($root . '/manifest.json'), false, 512, JSON_THROW_ON_ERROR);
if ($manifest->contentVersion !== '1.0.0' || $manifest->contentSource !== 'in_house' || !$manifest->practiceOnly
        || $manifest->delivery !== 'moodle_native_pages_and_quiz' || $manifest->review->status !== 'pending'
        || $manifest->installedMoodleCourseId !== null || $manifest->reviewedMoodleExportSha256 !== null
        || $manifest->assessment->questionCount !== 10 || $manifest->assessment->maximumGrade !== 100
        || $manifest->assessment->gradeToPass !== 80 || $manifest->assessment->attemptsAllowed !== 3
        || $manifest->assessment->engine !== 'moodle_quiz' || $manifest->assessment->timeLimitSeconds !== 0
        || $manifest->assessment->gradingMethod !== 'highest' || !$manifest->assessment->completionRequiresPassingGrade) {
    throw new RuntimeException('The prepared practice manifest or assessment policy is not the expected unapproved source');
}
$expectedpaths = ['README.md', 'lessons/01-find-your-training.html', 'lessons/02-learn-and-resume.html',
    'lessons/03-profiles-and-records.html', 'questions.gift'];
if (array_map(static fn($f) => $f->path, $manifest->files) !== $expectedpaths) {
    throw new RuntimeException('The practice source file inventory is unexpected');
}
$hash = hash_init('sha256');
foreach ($manifest->files as $file) {
    $path = $root . '/' . $file->path;
    if (!is_readable($path) || filesize($path) !== $file->bytes || hash_file('sha256', $path) !== $file->sha256) {
        throw new RuntimeException('Practice source file does not match its manifest: ' . $file->path);
    }
    hash_update($hash, $file->path . "\0" . $file->sha256 . "\n");
}
$digest = hash_final($hash);
if (!hash_equals($manifest->sourceSha256, $digest)) { throw new RuntimeException('Practice aggregate source digest differs'); }
$giftpath = $root . '/questions.gift';
preg_match_all('/^::([^\r\n:]+)::/m', file_get_contents($giftpath), $matches);
$expectednames = $matches[1];
if (count($expectednames) !== 10 || count(array_unique($expectednames)) !== 10) {
    throw new RuntimeException('The GIFT source must contain exactly ten unique named questions');
}
sort($expectednames, SORT_STRING);

$stage = 'synthetic course';
set_config('enablecompletion', 1);
$shortname = 'HSE-BETA-PRACTICE-SYNTHETIC-1.0.0';
$course = $DB->get_record('course', ['shortname' => $shortname]);
if (!$course) {
    $course = create_course((object) [
        'category' => core_course_category::get_default()->id,
        'fullname' => 'SYNTHETIC beta practice 1.0.0 - not approved; no training credit',
        'shortname' => $shortname, 'idnumber' => 'HSE-PRACTICE-CI:' . $digest,
        'summary' => 'Disposable CI practice material only. Not approved HSE content and not workplace authorization.',
        'summaryformat' => FORMAT_HTML, 'format' => 'topics', 'newsitems' => 0,
        'enablecompletion' => 1, 'visible' => 1,
    ]);
}
if ($course->idnumber !== 'HSE-PRACTICE-CI:' . $digest || (int) $course->enablecompletion !== 1
        || (int) $course->visible !== 1 || !str_starts_with($course->fullname, 'SYNTHETIC beta practice')) {
    throw new RuntimeException('An existing course differs from the immutable synthetic fixture');
}
$PAGE->set_context(context_course::instance($course->id));
$PAGE->set_url(new moodle_url('/course/view.php', ['id' => $course->id]));

/** Resolve only a uniquely identified fixture activity; never adopt a name-only match. */
function practice_module(stdClass $course, string $type, string $idnumber): ?stdClass {
    global $DB;
    $matches = $DB->get_records('course_modules', ['course' => $course->id, 'idnumber' => $idnumber]);
    if (count($matches) > 1) { throw new RuntimeException('Duplicate fixture activity identifier'); }
    if (!$matches) { return null; }
    return get_coursemodule_from_id($type, reset($matches)->id, $course->id, false, MUST_EXIST);
}

/** Match the normal course-module creation path without invoking test generators. */
function practice_module_info(stdClass $course, string $type, string $name, string $idnumber): stdClass {
    [$module] = can_add_moduleinfo($course, $type, 0);
    return (object) ['modulename' => $type, 'module' => $module->id, 'section' => 0,
        'visible' => 1, 'visibleoncoursepage' => 1, 'cmidnumber' => $idnumber, 'name' => $name,
        'intro' => 'SYNTHETIC beta practice only; not approved and no training credit.', 'introformat' => FORMAT_HTML,
        'completion' => COMPLETION_TRACKING_AUTOMATIC, 'completionexpected' => 0];
}

/** Diagnostics contain identifiers, digests and policy values, never lesson text or answers. */
function practice_mismatch(string $message, array $metadata): void {
    throw new RuntimeException($message . ': ' . json_encode($metadata, JSON_THROW_ON_ERROR));
}

$stage = 'three native Pages';
$pagetitles = ['Find your assigned training', 'Learn and resume', 'Your profile and completion history'];
$pagecmids = [];
foreach ($pagetitles as $index => $title) {
    $content = file_get_contents($root . '/' . $expectedpaths[$index + 1]);
    $idnumber = 'hse-practice-1.0.0-page-' . ($index + 1);
    $cm = practice_module($course, 'page', $idnumber);
    if (!$cm) {
        $info = practice_module_info($course, 'page', $title, $idnumber);
        // With no moodleform passed to add_moduleinfo(), page_add_instance()
        // consumes these stored fields directly. The page[text/format/itemid]
        // editor array is used only when its $mform argument is non-null.
        $info->content = $content;
        $info->contentformat = (int) FORMAT_HTML;
        $info->revision = 1; // Normal mod_page_mod_form creation default.
        $info->legacyfiles = RESOURCELIB_LEGACYFILES_NO;
        $info->display = RESOURCELIB_DISPLAY_AUTO;
        $info->printintro = 0;
        $info->printlastmodified = 0;
        $info->completionview = 1;
        $info->completionusegrade = 0;
        $info->completionpassgrade = 0;
        $info->completiongradeitemnumber = null;
        $created = add_moduleinfo($info, $course);
        $cm = get_coursemodule_from_id('page', $created->coursemodule, $course->id, false, MUST_EXIST);
    }
    $page = $DB->get_record('page', ['id' => $cm->instance], '*', MUST_EXIST);
    $displayoptions = unserialize_array($page->displayoptions);
    // FORMAT_HTML is the string '1' in Moodle 5.3, whereas DB values are
    // compared numerically. Do not use a strict int-to-string comparison.
    // The direct API does not trim content: preserve the manifest-verified
    // source byte for byte, including its final newline.
    if ($page->name !== $title || $page->content !== $content || (int) $page->contentformat !== (int) FORMAT_HTML
            || (int) $page->revision !== 1 || (int) $page->legacyfiles !== (int) RESOURCELIB_LEGACYFILES_NO
            || (int) $page->display !== (int) RESOURCELIB_DISPLAY_AUTO
            || !isset($displayoptions['printintro'], $displayoptions['printlastmodified'])
            || (int) $displayoptions['printintro'] !== 0 || (int) $displayoptions['printlastmodified'] !== 0
            || (int) $cm->completion !== (int) COMPLETION_TRACKING_AUTOMATIC || (int) $cm->completionview !== 1
            || $cm->completiongradeitemnumber !== null || (int) $cm->completionpassgrade !== 0) {
        practice_mismatch('An existing Page differs from the prepared practice source or completion policy', [
            'pageNumber' => $index + 1, 'pageId' => (int) $page->id, 'moduleId' => (int) $cm->id,
            'nameMatches' => $page->name === $title, 'contentMatches' => $page->content === $content,
            'sourceSha256' => hash('sha256', $content), 'storedSha256' => hash('sha256', (string) $page->content),
            'sourceTrimmedSha256' => hash('sha256', trim($content)),
            'storedTrimmedSha256' => hash('sha256', trim((string) $page->content)),
            'sourceBytes' => strlen($content), 'storedBytes' => strlen((string) $page->content),
            'contentFormat' => (int) $page->contentformat, 'expectedContentFormat' => (int) FORMAT_HTML,
            'revision' => (int) $page->revision, 'legacyFiles' => (int) $page->legacyfiles,
            'display' => (int) $page->display, 'printIntro' => $displayoptions['printintro'] ?? null,
            'printLastModified' => $displayoptions['printlastmodified'] ?? null,
            'completion' => (int) $cm->completion, 'completionView' => (int) $cm->completionview,
            'completionGradeItemNumber' => $cm->completiongradeitemnumber,
            'completionPassGrade' => (int) $cm->completionpassgrade,
        ]);
    }
    $pagecmids[] = (int) $cm->id;
}

$stage = 'Moodle 5.3 question bank';
$bankname = 'SYNTHETIC HSE beta practice question bank 1.0.0';
$banks = $DB->get_records('qbank', ['course' => $course->id, 'name' => $bankname]);
if (count($banks) > 1) { throw new RuntimeException('Duplicate fixture question bank'); }
if ($banks) {
    $bankcm = get_coursemodule_from_instance('qbank', reset($banks)->id, $course->id, false, MUST_EXIST);
} else {
    $bankcm = \core_question\local\bank\question_bank_helper::create_default_open_instance($course, $bankname);
}
$bankcm = get_coursemodule_from_id('qbank', $bankcm->id, $course->id, false, MUST_EXIST);
if ((int) $bankcm->visible !== 0 || (int) $bankcm->visibleoncoursepage !== 0) {
    throw new RuntimeException('The operator question bank must remain hidden from the learner course page');
}
$bankcontext = context_module::instance($bankcm->id);
$category = $DB->get_record('question_categories', ['contextid' => $bankcontext->id, 'idnumber' => 'hse-beta-practice-1.0.0']);
if (!$category) {
    $top = question_get_top_category($bankcontext->id, true);
    $manager = new \core_question\category_manager();
    $categoryid = $manager->add_category($top->id . ',' . $bankcontext->id, 'HSE beta practice 1.0.0',
        'SYNTHETIC prepared practice questions; not approved.', FORMAT_HTML, 'hse-beta-practice-1.0.0');
    $category = $DB->get_record('question_categories', ['id' => $categoryid], '*', MUST_EXIST);
}
$questionquery = 'SELECT q.id,q.name,q.qtype,q.defaultmark,qv.version,qv.status,qbe.id AS entryid FROM {question} q
    JOIN {question_versions} qv ON qv.questionid=q.id
    JOIN {question_bank_entries} qbe ON qbe.id=qv.questionbankentryid
    WHERE qbe.questioncategoryid=? ORDER BY q.name';
$questions = $DB->get_records_sql($questionquery, [$category->id]);
if (!$questions) {
    $stage = 'GIFT import';
    require_capability('moodle/question:add', $bankcontext);
    $format = new qformat_gift();
    $format->displayerrors = false;
    $format->setCategory($category);
    $format->setContexts([$bankcontext]);
    $format->setCourse($course);
    $format->setFilename($giftpath);
    $format->setRealfilename('questions.gift');
    $format->setMatchgrades('error');
    $format->setCatfromfile(false);
    $format->setContextfromfile(false);
    $format->setStoponerror(true);
    $format->set_display_progress(false);
    $transaction = $DB->start_delegated_transaction();
    try {
        if (!$format->importpreprocess() || !$format->importprocess() || !$format->importpostprocess()
                || $format->importerrors || count($format->questionids) !== 10) {
            throw new RuntimeException('The ten-question GIFT import was not completed');
        }
        $transaction->allow_commit();
    } catch (Throwable $error) { $transaction->rollback($error); }
    $questions = $DB->get_records_sql($questionquery, [$category->id]);
}
if (array_map(static fn($q) => $q->name, array_values($questions)) !== $expectednames) {
    throw new RuntimeException('The dedicated question category does not contain exactly the ten source questions');
}
foreach ($questions as $question) {
    if ($question->qtype !== 'multichoice' || (int) $question->version !== 1 || (float) $question->defaultmark !== 1.0
            || $question->status !== \core_question\local\bank\question_version_status::QUESTION_STATUS_READY) {
        throw new RuntimeException('A practice question differs from its initial ready import');
    }
}

$stage = 'native graded Quiz';
$quizcm = practice_module($course, 'quiz', 'hse-practice-1.0.0-quiz');
if (!$quizcm) {
    $info = practice_module_info($course, 'quiz', 'Practice check', 'hse-practice-1.0.0-quiz');
    $defaults = ['timeopen' => 0, 'timeclose' => 0, 'duedate' => 0, 'timelimit' => 0,
        'preferredbehaviour' => 'deferredfeedback', 'attempts' => 3, 'attemptonlast' => 0,
        'grademethod' => QUIZ_GRADEHIGHEST, 'decimalpoints' => 2, 'questiondecimalpoints' => -1,
        'questionsperpage' => 2, 'shuffleanswers' => 1, 'sumgrades' => 0, 'grade' => 100, 'gradepass' => 80,
        'overduehandling' => 'autosubmit', 'graceperiod' => 86400, 'quizpassword' => '', 'subnet' => '',
        'browsersecurity' => '', 'delay1' => 0, 'delay2' => 0, 'showuserpicture' => 0, 'showblocks' => 0,
        'navmethod' => QUIZ_NAVMETHOD_FREE, 'completionview' => 0, 'completionusegrade' => 1,
        'completiongradeitemnumber' => 0, 'completionpassgrade' => 1, 'completionattemptsexhausted' => 0,
        'completionminattemptsenabled' => 0, 'completionminattempts' => 0, 'completionunlocked' => 1];
    foreach ($defaults as $key => $value) { $info->$key = $value; }
    foreach (['attempt', 'correctness', 'maxmarks', 'marks', 'specificfeedback', 'generalfeedback', 'rightanswer', 'overallfeedback'] as $field) {
        foreach (['immediately', 'open', 'closed'] as $when) { $info->{$field . $when} = 1; }
        $info->{$field . 'during'} = in_array($field, ['attempt', 'maxmarks'], true) ? 1 : 0;
    }
    $created = add_moduleinfo($info, $course);
    $quizcm = get_coursemodule_from_id('quiz', $created->coursemodule, $course->id, false, MUST_EXIST);
}
$quiz = $DB->get_record('quiz', ['id' => $quizcm->instance], '*', MUST_EXIST);
$quiz->cmid = $quizcm->id;
if ((int) $quiz->attempts !== 3 || (int) $quiz->grademethod !== (int) QUIZ_GRADEHIGHEST || (float) $quiz->grade !== 100.0
        || $quiz->preferredbehaviour !== 'deferredfeedback' || (int) $quiz->timelimit !== 0
        || (int) $quiz->questionsperpage !== 2 || (int) $quiz->shuffleanswers !== 1
        || (int) $quizcm->completion !== COMPLETION_TRACKING_AUTOMATIC || (int) $quizcm->completionpassgrade !== 1
        || (int) $quizcm->completiongradeitemnumber !== 0 || (int) $quiz->completionattemptsexhausted !== 0) {
    throw new RuntimeException('Existing Quiz differs from the required grading or pass-completion policy');
}
$slots = $DB->get_records('quiz_slots', ['quizid' => $quiz->id], 'slot');
if (count($slots) > 10) { throw new RuntimeException('Existing Quiz contains more than ten questions'); }
$entries = array_map(static fn($q) => (int) $q->entryid, array_values($questions));
$references = $DB->get_fieldset_sql('SELECT qr.questionbankentryid FROM {quiz_slots} qs
    JOIN {question_references} qr ON qr.itemid=qs.id AND qr.component=? AND qr.questionarea=? AND qr.usingcontextid=?
    WHERE qs.quizid=?', ['mod_quiz', 'slot', context_module::instance($quizcm->id)->id, $quiz->id]);
if (count($references) !== count($slots)) { throw new RuntimeException('Existing Quiz contains an unexpected question reference'); }
foreach ($references as $entryid) {
    if (!in_array((int) $entryid, $entries, true)) {
        throw new RuntimeException('Refusing to alter an existing Quiz with a different question set');
    }
}
if (count($slots) < 10 && quiz_has_attempts($quiz->id)) {
    throw new RuntimeException('Refusing to change questions after a fixture attempt exists');
}
$changed = false;
foreach ($questions as $question) {
    if (quiz_add_quiz_question((int) $question->id, $quiz, 0, 1.0) !== false) { $changed = true; }
}
if ($changed) {
    $settings = \mod_quiz\quiz_settings::create((int) $quiz->id);
    $settings->get_grade_calculator()->recompute_quiz_sumgrades();
    quiz_grade_item_update($settings->get_quiz()); // Grade-item configuration only, no user grade input.
}
$slots = $DB->get_records_sql('SELECT qs.id,qs.slot,qs.page,qs.maxmark,qbe.questioncategoryid FROM {quiz_slots} qs
    JOIN {question_references} qr ON qr.itemid=qs.id AND qr.component=? AND qr.questionarea=?
    JOIN {question_bank_entries} qbe ON qbe.id=qr.questionbankentryid
    WHERE qs.quizid=? ORDER BY qs.slot', ['mod_quiz', 'slot', $quiz->id]);
if (count($slots) !== 10) { throw new RuntimeException('Quiz must contain exactly ten fixed questions'); }
foreach ($slots as $slot) {
    if ((int) $slot->questioncategoryid !== (int) $category->id || (float) $slot->maxmark !== 1.0
            || (int) $slot->page !== (int) ceil($slot->slot / 2)) {
        throw new RuntimeException('Quiz question identity, weight, or pagination differs');
    }
}
$gradeitem = grade_item::fetch(['itemtype' => 'mod', 'itemmodule' => 'quiz', 'iteminstance' => $quiz->id, 'itemnumber' => 0]);
if (!$gradeitem || (float) $gradeitem->gradepass !== 80.0 || (float) $gradeitem->grademax !== 100.0
        || (float) $DB->get_field('quiz', 'sumgrades', ['id' => $quiz->id]) !== 10.0) {
    throw new RuntimeException('Server grading configuration was not confirmed');
}

$stage = 'all-activity course completion';
$required = array_merge($pagecmids, [(int) $quizcm->id]);
$existing = $DB->get_records('course_completion_criteria', ['course' => $course->id]);
foreach ($existing as $criterion) {
    if ((int) $criterion->criteriatype !== COMPLETION_CRITERIA_TYPE_ACTIVITY || !in_array((int) $criterion->moduleinstance, $required, true)) {
        throw new RuntimeException('Unexpected course completion criterion');
    }
}
foreach ($required as $cmid) {
    if (!completion_criteria_activity::fetch(['course' => $course->id, 'moduleinstance' => $cmid])) {
        $criterion = new completion_criteria_activity();
        $data = (object) ['id' => $course->id, 'criteria_activity' => [$cmid => 1]];
        $criterion->update_config($data);
    }
}
if ($DB->count_records('course_completion_criteria', ['course' => $course->id]) !== 4) {
    throw new RuntimeException('Course completion must require exactly three Page views and the passed Quiz');
}
foreach ([null, COMPLETION_CRITERIA_TYPE_ACTIVITY] as $type) {
    $aggregation = completion_aggregation::fetch(['course' => $course->id, 'criteriatype' => $type]);
    if ($aggregation && (int) $aggregation->method !== COMPLETION_AGGREGATION_ALL) {
        throw new RuntimeException('Existing completion aggregation must require every activity');
    }
    if (!$aggregation) {
        $aggregation = new completion_aggregation(['course' => $course->id, 'criteriatype' => $type]);
        $aggregation->setMethod(COMPLETION_AGGREGATION_ALL);
        $aggregation->save();
    }
}

$stage = 'dedicated manual learner and enrolment';
$username = 'synthetic.practice.learner';
$learner = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id]);
if (!$learner) {
    $userid = \core\user::create_user((object) ['auth' => 'manual', 'username' => $username,
        'firstname' => 'Synthetic', 'lastname' => 'Practice learner', 'email' => 'practice.learner@example.invalid',
        'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id, 'password' => $password, 'emailstop' => 1]);
    $learner = core_user::get_user($userid, '*', MUST_EXIST);
}
if ($learner->auth !== 'manual' || $learner->deleted || $learner->suspended || !$learner->confirmed || is_siteadmin($learner)
        || has_capability('mod/quiz:manage', context_course::instance($course->id), $learner)
        || has_capability('moodle/course:update', context_course::instance($course->id), $learner)) {
    throw new RuntimeException('Existing fixture learner is not a normal active manual-auth account');
}
$manual = enrol_get_plugin('manual');
if (!$manual) { throw new RuntimeException('Manual enrolment is unavailable'); }
$instance = null;
foreach (enrol_get_instances($course->id, false) as $candidate) {
    if ($candidate->enrol === 'manual') { $instance = $candidate; }
    else { enrol_get_plugin($candidate->enrol)->update_status($candidate, ENROL_INSTANCE_DISABLED); }
}
if (!$instance) {
    $instanceid = $manual->add_instance($course);
    $instance = $DB->get_record('enrol', ['id' => $instanceid], '*', MUST_EXIST);
}
if ((int) $instance->status !== ENROL_INSTANCE_ENABLED) { throw new RuntimeException('Manual fixture enrolment is disabled'); }
$roleid = (int) $DB->get_field('role', 'id', ['shortname' => 'student'], MUST_EXIST);
if (!is_enrolled(context_course::instance($course->id), $learner->id, '', true)) {
    $manual->enrol_user($instance, $learner->id, $roleid);
}
if (!is_enrolled(context_course::instance($course->id), $learner->id, '', true)) {
    throw new RuntimeException('Practice learner was not enrolled');
}

$stage = 'read-only probe functions';
$manager = new webservice();
$service = $manager->get_external_service_by_shortname('hse_synthetic_pilot_probe', MUST_EXIST);
$functions = array_map(static fn($function) => $function->name, $manager->get_external_functions([$service->id]));
foreach (['core_completion_get_activities_completion_status', 'mod_quiz_get_user_quiz_attempts',
    'mod_quiz_get_user_best_grade', 'mod_quiz_get_quizzes_by_courses'] as $function) {
    if (!in_array($function, $functions, true)) { $manager->add_external_function_to_service($function, $service->id); }
}
while (ob_get_level()) { ob_end_clean(); }
fwrite(STDOUT, json_encode(['courseid' => (int) $course->id, 'pagecmids' => $pagecmids,
    'quizid' => (int) $quiz->id, 'quizcmid' => (int) $quizcm->id, 'userid' => (int) $learner->id,
    'username' => $username, 'courseShortname' => $shortname, 'sourceDigest' => $digest,
    'questionsperpage' => 2], JSON_THROW_ON_ERROR) . PHP_EOL);
