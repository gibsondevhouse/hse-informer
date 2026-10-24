<?php
namespace local_hse_evidence\external;
defined('MOODLE_INTERNAL') || die();

/** @covers \local_hse_evidence\external\get_completion */
final class get_completion_test extends \advanced_testcase {
    public function test_reads_canonical_record_without_changing_it(): void {
        global $CFG, $DB;
        $this->resetAfterTest();
        $this->setAdminUser();
        set_config('enablecompletion', 1);
        require_once($CFG->dirroot . '/completion/completion_completion.php');
        $course = $this->getDataGenerator()->create_course(['enablecompletion' => 1]);
        $user = $this->getDataGenerator()->create_user();
        $this->getDataGenerator()->enrol_user($user->id, $course->id, 'student');
        $completion = new \completion_completion(['course' => $course->id, 'userid' => $user->id]);
        $completion->mark_complete(time() - 60);
        $before = $DB->get_record('course_completions', ['course' => $course->id, 'userid' => $user->id]);
        $result = get_completion::execute($course->id, $user->id);
        $this->assertTrue($result['completed']);
        $this->assertSame((int) $before->timecompleted, $result['timecompleted']);
        $this->assertSame((int) $before->id, $result['completionid']);
        $this->assertEquals($before, $DB->get_record('course_completions', ['id' => $before->id]));
    }

    public function test_incomplete_user_stays_incomplete(): void {
        $this->resetAfterTest();
        $this->setAdminUser();
        set_config('enablecompletion', 1);
        $course = $this->getDataGenerator()->create_course(['enablecompletion' => 1]);
        $user = $this->getDataGenerator()->create_user();
        $this->getDataGenerator()->enrol_user($user->id, $course->id, 'student');
        $result = get_completion::execute($course->id, $user->id);
        $this->assertFalse($result['completed']);
        $this->assertSame(0, $result['timecompleted']);
        $this->assertSame(0, $result['completionid']);
    }

    public function test_learner_cannot_use_service_to_read_another_learner(): void {
        $this->resetAfterTest();
        set_config('enablecompletion', 1);
        $course = $this->getDataGenerator()->create_course(['enablecompletion' => 1]);
        $reader = $this->getDataGenerator()->create_user();
        $other = $this->getDataGenerator()->create_user();
        $this->getDataGenerator()->enrol_user($reader->id, $course->id, 'student');
        $this->getDataGenerator()->enrol_user($other->id, $course->id, 'student');
        $this->setUser($reader);
        $this->expectException(\required_capability_exception::class);
        get_completion::execute($course->id, $other->id);
    }
}
