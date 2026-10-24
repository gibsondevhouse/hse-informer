<?php
namespace local_hse_evidence\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

defined('MOODLE_INTERNAL') || die();

/** Read-only bridge for Moodle's canonical course-completion record. */
class get_completion extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Exact mapped course ID'),
            'userid' => new external_value(PARAM_INT, 'Exact mapped user ID'),
        ]);
    }

    public static function execute(int $courseid, int $userid): array {
        global $CFG;
        require_once($CFG->libdir . '/completionlib.php');
        require_once($CFG->dirroot . '/completion/completion_completion.php');
        require_once($CFG->libdir . '/gradelib.php');
        require_once($CFG->libdir . '/grouplib.php');
        $params = self::validate_parameters(self::execute_parameters(), compact('courseid', 'userid'));
        $course = get_course($params['courseid']);
        $context = \context_course::instance($course->id);
        self::validate_context($context);
        // A dedicated service account needs these capabilities in this course.
        // Learners cannot use this service to read another person's evidence.
        require_capability('report/completion:view', $context);
        require_capability('moodle/grade:viewall', $context);
        $user = \core_user::get_user($params['userid'], '*', MUST_EXIST);
        \core_user::require_active_user($user);
        if (!is_enrolled($context, $user, '', true) || !groups_user_groups_visible($course, $user->id)) {
            throw new \moodle_exception('accessdenied', 'admin');
        }
        $info = new \completion_info($course);
        if (!$info->is_enabled() || !$info->is_tracked_user($user->id)) {
            throw new \moodle_exception('completionnotenabled', 'completion');
        }
        // The fetch API reads course_completions.timecompleted. Criterion and
        // activity timestamps are deliberately not substituted for this value.
        $completion = \completion_completion::fetch(['course' => $course->id, 'userid' => $user->id]);
        $completed = !empty($completion->timecompleted);
        $score = null;
        if ($completed) {
            $item = \grade_item::fetch(['courseid' => $course->id, 'itemtype' => 'course']);
            if ($item && (int) $item->gradetype === GRADE_TYPE_VALUE && $item->grademax > $item->grademin) {
                $grade = \grade_grade::fetch(['itemid' => $item->id, 'userid' => $user->id]);
                if ($grade && $grade->finalgrade !== null) {
                    $score = round(100 * ($grade->finalgrade - $item->grademin) / ($item->grademax - $item->grademin), 3);
                }
            }
        }
        return [
            'courseid' => (int) $course->id, 'userid' => (int) $user->id,
            'completed' => (bool) $completed,
            'completionid' => $completed ? (int) $completion->id : 0,
            'timecompleted' => $completed ? (int) $completion->timecompleted : 0,
            'score' => $score,
        ];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'courseid' => new external_value(PARAM_INT, 'Mapped course ID'),
            'userid' => new external_value(PARAM_INT, 'Mapped user ID'),
            'completed' => new external_value(PARAM_BOOL, 'Canonical course completion exists'),
            'completionid' => new external_value(PARAM_INT, 'Canonical completion record ID, or zero'),
            'timecompleted' => new external_value(PARAM_INT, 'Canonical completion time, or zero'),
            'score' => new external_value(PARAM_FLOAT, 'Numeric course grade normalized to percent, otherwise null', VALUE_REQUIRED, null, NULL_ALLOWED),
        ]);
    }
}
