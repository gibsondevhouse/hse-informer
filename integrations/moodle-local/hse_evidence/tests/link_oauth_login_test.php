<?php
namespace local_hse_evidence\external;
defined('MOODLE_INTERNAL') || die();

/** @covers \local_hse_evidence\external\link_oauth_login */
final class link_oauth_login_test extends \advanced_testcase {
    private const HSEID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    private const SUBJECT = '11111111-1111-4111-8111-111111111111';
    private const EMAIL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@tenant.login.invalid';
    private const ISSUERURL = 'https://identity.example.test/realms/hse';

    private function fixture(): array {
        $this->resetAfterTest();
        $this->setAdminUser();
        set_config('auth', 'oauth2');
        set_config('field_lock_idnumber', 'locked', 'auth_oauth2');
        set_config('field_lock_email', 'locked', 'auth_oauth2');
        $issuer = new \core\oauth2\issuer(0, (object) [
            'name' => 'HSE test identity', 'baseurl' => self::ISSUERURL,
            'clientid' => 'hse-test', 'clientsecret' => 'synthetic-test-secret',
            'enabled' => true, 'showonloginpage' => \core\oauth2\issuer::LOGINONLY,
            'requireconfirmation' => true,
        ]);
        $issuer->create();
        (new \core\oauth2\endpoint(0, (object) [
            'issuerid' => $issuer->get('id'), 'name' => 'userinfo_endpoint',
            'url' => self::ISSUERURL . '/protocol/openid-connect/userinfo',
        ]))->create();
        foreach (['username' => 'sub', 'email' => 'email'] as $internal => $external) {
            (new \core\oauth2\user_field_mapping(0, (object) [
                'issuerid' => $issuer->get('id'), 'internalfield' => $internal, 'externalfield' => $external,
            ]))->create();
        }
        set_config('oauthissuerid', $issuer->get('id'), 'local_hse_evidence');
        set_config('oauthissuerurl', self::ISSUERURL, 'local_hse_evidence');
        $target = $this->getDataGenerator()->create_user([
            'auth' => 'oauth2', 'idnumber' => self::HSEID, 'email' => self::EMAIL,
            'confirmed' => 1, 'suspended' => 0,
        ]);
        return [$issuer, $target];
    }

    private function request(\core\oauth2\issuer $issuer, \stdClass $target, array $changes = []): array {
        $params = array_replace([
            'userid' => (int) $target->id, 'hseid' => self::HSEID, 'subject' => self::SUBJECT,
            'identityemail' => self::EMAIL, 'issuerid' => (int) $issuer->get('id'), 'issuerurl' => self::ISSUERURL,
        ], $changes);
        return link_oauth_login::execute(...$params);
    }

    private function assert_rejected(\core\oauth2\issuer $issuer, \stdClass $target,
        array $changes = [], string $errorcode = 'oauthbridgeconflict'): void {
        try {
            $this->request($issuer, $target, $changes);
            $this->fail('Unsafe identity link was accepted');
        } catch (\moodle_exception $error) {
            $this->assertSame($errorcode, $error->errorcode);
        }
    }

    private function existing_link(\core\oauth2\issuer $issuer, \stdClass $target,
        array $changes = []): \auth_oauth2\linked_login {
        // A supported persistent fixture also permits testing stale/pending
        // records. The production bridge only creates through auth_oauth2 API.
        $link = new \auth_oauth2\linked_login(0, (object) array_replace([
            'issuerid' => $issuer->get('id'), 'userid' => $target->id, 'username' => self::SUBJECT,
            'email' => self::EMAIL, 'confirmtoken' => '', 'confirmtokenexpires' => 0,
        ], $changes));
        return $link->create();
    }

    public function test_supported_link_is_exact_idempotent_and_preserves_user_and_learning_evidence(): void {
        global $CFG, $DB;
        [$issuer, $target] = $this->fixture();
        set_config('enablecompletion', 1);
        require_once($CFG->dirroot . '/completion/completion_completion.php');
        $course = $this->getDataGenerator()->create_course(['enablecompletion' => 1]);
        $this->getDataGenerator()->enrol_user($target->id, $course->id, 'student');
        (new \completion_completion(['course' => $course->id, 'userid' => $target->id]))->mark_complete(time() - 60);
        $userbefore = $DB->get_record('user', ['id' => $target->id]);
        $evidencebefore = $DB->get_record('course_completions', ['course' => $course->id, 'userid' => $target->id]);
        $expected = ['userid' => (int) $target->id, 'issuerid' => (int) $issuer->get('id'), 'linked' => true];
        $sink = $this->redirectEmails();
        $this->assertSame($expected, $this->request($issuer, $target));
        $link = \auth_oauth2\api::match_username_to_user(self::SUBJECT, $issuer);
        $this->assertSame((int) $target->id, (int) $link->get('userid'));
        $this->assertSame('', $link->get('confirmtoken'));
        $this->assertSame(0, (int) $link->get('confirmtokenexpires'));
        $this->assertSame(self::EMAIL, $link->get('email'));
        $this->assertSame($expected, $this->request($issuer, $target));
        $this->assertSame(1, \auth_oauth2\linked_login::count_records(['userid' => $target->id]));
        $this->assertEquals($userbefore, $DB->get_record('user', ['id' => $target->id]));
        $this->assertEquals($evidencebefore, $DB->get_record('course_completions', ['id' => $evidencebefore->id]));
        $this->assertSame(0, $sink->count());
        $sink->close();
    }

    public function test_dedicated_role_can_link_without_site_or_user_admin_capabilities(): void {
        [$issuer, $target] = $this->fixture();
        $caller = $this->getDataGenerator()->create_user();
        $role = $this->getDataGenerator()->create_role();
        $context = \context_system::instance();
        foreach (['local/hse_evidence:linkoauth', 'auth/oauth2:managelinkedlogins'] as $capability) {
            assign_capability($capability, CAP_ALLOW, $role, $context->id);
        }
        role_assign($role, $caller->id, $context->id);
        $this->setUser($caller);
        $this->assertFalse(has_capability('moodle/site:config', $context));
        $this->assertFalse(has_capability('moodle/user:update', $context));
        $this->assertTrue($this->request($issuer, $target)['linked']);
    }

    public function test_ordinary_caller_cannot_link(): void {
        [$issuer, $target] = $this->fixture();
        $this->setUser($this->getDataGenerator()->create_user());
        $this->expectException(\required_capability_exception::class);
        $this->request($issuer, $target);
    }

    public function test_custom_capability_does_not_bypass_normal_oauth_permission(): void {
        [$issuer, $target] = $this->fixture();
        $caller = $this->getDataGenerator()->create_user();
        $role = $this->getDataGenerator()->create_role();
        $context = \context_system::instance();
        assign_capability('local/hse_evidence:linkoauth', CAP_ALLOW, $role, $context->id);
        assign_capability('auth/oauth2:managelinkedlogins', CAP_PROHIBIT, $role, $context->id);
        role_assign($role, $caller->id, $context->id);
        $this->setUser($caller);
        $this->expectException(\required_capability_exception::class);
        $this->request($issuer, $target);
    }

    public function test_target_and_immutable_metadata_must_match_exactly(): void {
        [$issuer, $target] = $this->fixture();
        foreach ([['hseid' => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
            ['identityemail' => 'other@tenant.login.invalid']] as $changes) {
            $this->assert_rejected($issuer, $target, $changes, 'oauthbridgetarget');
        }
        $this->assertSame(0, \auth_oauth2\linked_login::count_records());
    }

    public function test_non_oauth_inactive_and_unconfirmed_accounts_are_rejected(): void {
        [$issuer, $target] = $this->fixture();
        foreach ([['auth' => 'manual'], ['suspended' => 1], ['confirmed' => 0], ['deleted' => 1]] as $changes) {
            \core\user::update_user((object) array_merge(['id' => $target->id], $changes), false);
            $this->assert_rejected($issuer, $target, [], 'oauthbridgetarget');
            \core\user::update_user((object) ['id' => $target->id, 'auth' => 'oauth2',
                'suspended' => 0, 'confirmed' => 1, 'deleted' => 0], false);
        }
    }

    public function test_privileged_target_is_protected(): void {
        [$issuer, $target] = $this->fixture();
        $role = $this->getDataGenerator()->create_role();
        $context = \context_system::instance();
        assign_capability('moodle/user:update', CAP_ALLOW, $role, $context->id);
        role_assign($role, $target->id, $context->id);
        $this->assert_rejected($issuer, $target, [], 'oauthbridgetarget');
    }

    public function test_duplicate_live_hse_identity_or_email_is_rejected(): void {
        [$issuer, $target] = $this->fixture();
        $duplicate = $this->getDataGenerator()->create_user(['idnumber' => self::HSEID]);
        $this->assert_rejected($issuer, $target, [], 'oauthbridgetarget');
        \core\user::update_user((object) ['id' => $duplicate->id, 'idnumber' => '', 'email' => self::EMAIL], false);
        $this->assert_rejected($issuer, $target, [], 'oauthbridgetarget');
    }

    public function test_unconfigured_or_wrong_issuer_cannot_be_selected_by_caller(): void {
        [$issuer, $target] = $this->fixture();
        $this->assert_rejected($issuer, $target, ['issuerid' => $issuer->get('id') + 1], 'oauthbridgeconfiguration');
        $this->assert_rejected($issuer, $target, ['issuerurl' => self::ISSUERURL . '/'], 'oauthbridgeconfiguration');
        set_config('oauthissuerid', 0, 'local_hse_evidence');
        $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
    }

    public function test_confirmation_disabled_or_unavailable_issuer_is_rejected(): void {
        [$issuer, $target] = $this->fixture();
        foreach ([['requireconfirmation', false], ['enabled', false],
            ['showonloginpage', \core\oauth2\issuer::SERVICEONLY], ['baseurl', self::ISSUERURL . '/other']] as [$key, $value]) {
            $old = $issuer->get($key);
            $issuer->set($key, $value)->update();
            $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
            $issuer->set($key, $old)->update();
        }
        set_config('auth', '');
        $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
    }

    public function test_email_username_fallback_and_idnumber_mapping_are_rejected(): void {
        [$issuer, $target] = $this->fixture();
        $mapping = \core\oauth2\user_field_mapping::get_record([
            'issuerid' => $issuer->get('id'), 'internalfield' => 'username',
        ]);
        $mapping->set('externalfield', 'email')->update();
        $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
        $mapping->delete();
        $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
        (new \core\oauth2\user_field_mapping(0, (object) [
            'issuerid' => $issuer->get('id'), 'internalfield' => 'username', 'externalfield' => 'sub',
        ]))->create();
        (new \core\oauth2\user_field_mapping(0, (object) [
            'issuerid' => $issuer->get('id'), 'internalfield' => 'idnumber', 'externalfield' => 'sub',
        ]))->create();
        $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
    }

    public function test_immutable_field_locks_are_required(): void {
        [$issuer, $target] = $this->fixture();
        foreach (['field_lock_idnumber', 'field_lock_email'] as $field) {
            set_config($field, 'unlocked', 'auth_oauth2');
            $this->assert_rejected($issuer, $target, [], 'oauthbridgeconfiguration');
            set_config($field, 'locked', 'auth_oauth2');
        }
    }

    public function test_subject_linked_to_another_user_is_never_adopted(): void {
        [$issuer, $target] = $this->fixture();
        $other = $this->getDataGenerator()->create_user();
        $this->existing_link($issuer, $other);
        $this->assert_rejected($issuer, $target);
        $this->assertSame(0, \auth_oauth2\linked_login::count_records(['userid' => $target->id]));
    }

    public function test_target_linked_to_another_subject_or_issuer_is_never_rebound(): void {
        [$issuer, $target] = $this->fixture();
        $link = $this->existing_link($issuer, $target, ['username' => 'different-subject']);
        $this->assert_rejected($issuer, $target);
        $link->delete();
        $foreign = new \core\oauth2\issuer(0, (object) ['name' => 'Other identity provider']);
        $foreign->create();
        $this->existing_link($foreign, $target);
        $this->assert_rejected($issuer, $target);
    }

    public function test_pending_expired_and_email_mismatched_links_are_not_confirmed_or_repaired(): void {
        [$issuer, $target] = $this->fixture();
        foreach ([['confirmtoken' => 'pending', 'confirmtokenexpires' => time() + 300],
            ['confirmtoken' => 'expired', 'confirmtokenexpires' => time() - 300],
            ['confirmtokenexpires' => time() - 300], ['email' => 'other@example.invalid']] as $changes) {
            $link = $this->existing_link($issuer, $target, $changes);
            $before = $link->to_record();
            $this->assert_rejected($issuer, $target);
            $after = new \auth_oauth2\linked_login($link->get('id'));
            $this->assertEquals($before, $after->to_record());
            $link->delete();
        }
    }

    public function test_subject_that_moodle_would_change_is_rejected(): void {
        [$issuer, $target] = $this->fixture();
        foreach (['CaseSensitiveSubject', ' padded', 'subject with spaces', str_repeat('x', 256)] as $subject) {
            $this->assert_rejected($issuer, $target, ['subject' => $subject], 'invalidparameter');
        }
    }
}
