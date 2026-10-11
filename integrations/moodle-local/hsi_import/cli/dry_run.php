<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle. If not, see <http://www.gnu.org/licenses/>.

/**
 * Read-only HSI import rehearsal. No Moodle completion writes exist here.
 *
 * @package    local_hsi_import
 * @copyright  2026 HSE Informer
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);
require(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/clilib.php');

$usage = <<<'HELP'
Read-only HSI import rehearsal for a disposable Moodle 5.3 instance.

Options:
  --input=PATH             Normalized HSI CSV (not the raw HSI export)
  --mapping=PATH           Reviewed HSE-to-Moodle ID mapping CSV
  --source-archive=PATH    Untouched raw HSI export, hashed for provenance
  --tenant-id=ID           HSE tenant bound to this Moodle instance
  --instance-id=ID         Instance ID bound in Moodle config.php
  --ack-nonproduction      Confirm that this is a nonproduction rehearsal
  --help                   Show this help

The command emits one JSON report on stdout. Any unknown option, including
--apply, is an error. It never creates or changes Moodle completion records.
HELP;

// cli_get_params intentionally ignores arguments after "--"; this prototype forbids that escape hatch.
if (in_array('--', $_SERVER['argv'] ?? [], true)) {
    cli_error('Argument terminator -- is not accepted');
}

list($options, $unrecognised) = cli_get_params([
    'input' => null,
    'mapping' => null,
    'source-archive' => null,
    'tenant-id' => null,
    'instance-id' => null,
    'ack-nonproduction' => false,
    'help' => false,
]);

if ($unrecognised) {
    cli_error('Unrecognised options: ' . implode(' ', $unrecognised));
}
if ($options['help']) {
    cli_writeln($usage);
    exit(0);
}
foreach (['input', 'mapping', 'source-archive', 'tenant-id', 'instance-id'] as $required) {
    if (!is_string($options[$required]) || $options[$required] === '') {
        cli_error('Missing --' . $required . PHP_EOL . $usage);
    }
}
if ($options['ack-nonproduction'] !== true ||
        !isset($CFG->hse_hsi_dryrun_nonproduction) || $CFG->hse_hsi_dryrun_nonproduction !== true) {
    cli_error('Dry run requires --ack-nonproduction and a true config.php nonproduction flag');
}
if (!isset($CFG->hse_hsi_instance_tenant_id, $CFG->hse_hsi_instance_id) ||
        $CFG->hse_hsi_instance_tenant_id !== $options['tenant-id'] ||
        $CFG->hse_hsi_instance_id !== $options['instance-id']) {
    cli_error('Tenant and instance IDs must match their explicit config.php bindings');
}
if (!isset($CFG->release) || !str_starts_with($CFG->release, '5.3')) {
    cli_error('This prototype is limited to a separately pinned Moodle 5.3 installation');
}

$sourcepaths = [];
foreach (['input', 'mapping', 'source-archive'] as $name) {
    $sourcepaths[$name] = realpath($options[$name]);
    if ($sourcepaths[$name] === false || !is_file($sourcepaths[$name]) || !is_readable($sourcepaths[$name])) {
        cli_error('Missing or unreadable regular file for --' . $name);
    }
}
if (count(array_unique($sourcepaths)) !== 3) {
    cli_error('Input, mapping, and untouched source archive must be distinct files');
}

try {
    $records = \local_hsi_import\dry_run_validator::read_csv(
        $sourcepaths['input'], \local_hsi_import\dry_run_validator::HSI_COLUMNS);
    $mappings = \local_hsi_import\dry_run_validator::read_csv(
        $sourcepaths['mapping'], \local_hsi_import\dry_run_validator::MAPPING_COLUMNS);
    $archivehash = hash_file('sha256', $sourcepaths['source-archive']);
    $inputhash = hash_file('sha256', $sourcepaths['input']);
    $mappinghash = hash_file('sha256', $sourcepaths['mapping']);
    if ($archivehash === false || $inputhash === false || $mappinghash === false) {
        throw new RuntimeException('Unable to hash an input file');
    }

    // Reads Moodle identity, course, and course-completion records only.
    $probe = static function(int $userid, int $courseid, int $completedat) use ($DB): array {
        $user = $DB->get_record('user', ['id' => $userid], 'id,username,deleted,suspended');
        if (!$user) {
            return ['status' => 'missing_user'];
        }
        if ($user->deleted) {
            return ['status' => 'deleted_user'];
        }
        if ($user->suspended) {
            return ['status' => 'suspended_user'];
        }
        if ($user->username === 'guest' || is_siteadmin($userid)) {
            return ['status' => 'privileged_user'];
        }
        $course = $DB->get_record('course', ['id' => $courseid], 'id,enablecompletion');
        if (!$course) {
            return ['status' => 'missing_course'];
        }
        if (!$course->enablecompletion) {
            return ['status' => 'completion_disabled'];
        }
        $existing = $DB->get_records('course_completions',
            ['userid' => $userid, 'course' => $courseid], 'id ASC', 'id,timecompleted', 0, 2);
        if (count($existing) > 1) {
            return ['status' => 'duplicate_moodle_completion'];
        }
        if ($existing) {
            $completion = reset($existing);
            if (!empty($completion->timecompleted)) {
                $status = ((int) $completion->timecompleted === $completedat) ?
                    'already_matching' : 'completion_conflict';
                return [
                    'status' => $status,
                    'detail' => [
                        'moodle_completion_id' => (int) $completion->id,
                        'moodle_completed_at_epoch' => (int) $completion->timecompleted,
                    ],
                ];
            }
        }
        return ['status' => 'ready_for_review'];
    };

    $report = \local_hsi_import\dry_run_validator::assess($records, $mappings, $options['tenant-id'], $probe);
    $report = array_merge([
        'prototype' => true,
        'dry_run_only' => true,
        'writes_enabled' => false,
        'generated_at_utc' => gmdate('Y-m-d\TH:i:s\Z'),
        'moodle_release' => $CFG->release,
        'instance_id' => $options['instance-id'],
        'tenant_id' => $options['tenant-id'],
        'source_archive_sha256' => $archivehash,
        'normalized_sha256' => $inputhash,
        'mapping_sha256' => $mappinghash,
        'raw_fields_verified_against_archive' => false,
    ], $report);
    cli_writeln(json_encode($report, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    exit($report['clean_dry_run'] ? 0 : 2);
} catch (Throwable $error) {
    cli_error('Dry run failed closed: ' . $error->getMessage(), 2);
}
