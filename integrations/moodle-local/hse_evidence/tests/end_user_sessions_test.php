<?php
namespace local_hse_evidence\external;
defined('MOODLE_INTERNAL') || die();

/** @covers \local_hse_evidence\external\end_user_sessions */
final class end_user_sessions_test extends \advanced_testcase {
    public function test_ends_target_sessions_and_preserves_another_user(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();
        $target = $this->getDataGenerator()->create_user();
        $other = $this->getDataGenerator()->create_user();
        foreach ([$target, $target, $other] as $user) {
            // Test fixtures only. Production code uses the supported session
            // manager and never modifies Moodle's session tables directly.
            $DB->insert_record('sessions', (object) [
                'state' => 0, 'sid' => random_string(32), 'userid' => $user->id,
                'timecreated' => time(), 'timemodified' => time(),
                'firstip' => '127.0.0.1', 'lastip' => '127.0.0.1',
            ]);
        }
        $this->assertSame(['userid' => (int) $target->id, 'ended' => true], end_user_sessions::execute($target->id));
        $this->assertSame(0, $DB->count_records('sessions', ['userid' => $target->id]));
        $this->assertSame(1, $DB->count_records('sessions', ['userid' => $other->id]));
    }

    public function test_learner_without_explicit_capability_cannot_end_sessions(): void {
        $this->resetAfterTest();
        $caller = $this->getDataGenerator()->create_user();
        $target = $this->getDataGenerator()->create_user();
        $this->setUser($caller);
        $this->expectException(\required_capability_exception::class);
        end_user_sessions::execute($target->id);
    }

    public function test_privileged_target_is_protected(): void {
        $this->resetAfterTest();
        $this->setAdminUser();
        $target = $this->getDataGenerator()->create_user();
        $role = $this->getDataGenerator()->create_role();
        $context = \context_system::instance();
        assign_capability('moodle/user:update', CAP_ALLOW, $role, $context->id);
        role_assign($role, $target->id, $context->id);
        $this->expectException(\moodle_exception::class);
        end_user_sessions::execute($target->id);
    }

    public function test_service_account_cannot_end_its_own_sessions(): void {
        global $USER;
        $this->resetAfterTest();
        $this->setAdminUser();
        $this->expectException(\moodle_exception::class);
        end_user_sessions::execute($USER->id);
    }
}
