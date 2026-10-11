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
 * Tests for strict, read-only HSI dry-run validation.
 *
 * @package    local_hsi_import
 * @copyright  2026 HSE Informer
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_hsi_import;

defined('MOODLE_INTERNAL') || die();

/**
 * Validation tests; no Moodle core records are created or changed.
 *
 * @covers \local_hsi_import\dry_run_validator
 */
final class dry_run_validator_test extends \advanced_testcase {
    /** A valid mapped record reaches the read-only probe with the exact second. */
    public function test_valid_record_is_reported_for_review(): void {
        $record = $this->record();
        $mapping = $this->mapping();
        $report = dry_run_validator::assess([$record], [$mapping], 'tenant-a',
            function(int $userid, int $courseid, int $epoch): array {
                $this->assertSame(101, $userid);
                $this->assertSame(202, $courseid);
                $this->assertSame(1767225600, $epoch);
                return ['status' => 'ready_for_review'];
            });
        $this->assertTrue($report['clean_dry_run']);
        $this->assertSame(1, $report['source_row_count']);
        $this->assertSame('ready_for_review', $report['rows'][0]['status']);
        $this->assertSame('2026-01-01T00:00:00Z', $report['rows'][0]['completed_at']);
        $this->assertSame('same_epoch', $report['rows'][0]['raw_date_check']['completed']);
        $this->assertSame('not_verified', $report['rows'][0]['raw_date_check']['source_archive']);
    }

    /** A duplicate source record and a different tenant cannot silently pass. */
    public function test_duplicate_and_cross_tenant_rows_fail(): void {
        $first = $this->record();
        $second = $this->record();
        $second['_row_number'] = 3;
        $third = $this->record();
        $third['_row_number'] = 4;
        $third['hsi_record_id'] = 'hsi-2';
        $third['tenant_id'] = 'tenant-b';
        $called = 0;
        $report = dry_run_validator::assess([$first, $second, $third], [$this->mapping()], 'tenant-a',
            function() use (&$called): array {
                ++$called;
                return ['status' => 'ready_for_review'];
            });
        $this->assertFalse($report['clean_dry_run']);
        $this->assertSame(1, $called);
        $this->assertSame('invalid_source', $report['rows'][1]['status']);
        $this->assertContains('duplicate_hsi_record_id', $report['rows'][1]['problems']);
        $this->assertContains('wrong_tenant', $report['rows'][2]['problems']);
    }

    /** Any malformed mapping blocks the entire probe, including otherwise valid rows. */
    public function test_duplicate_mapping_blocks_all_probes(): void {
        $first = $this->mapping();
        $duplicate = $this->mapping();
        $duplicate['_row_number'] = 3;
        $report = dry_run_validator::assess([$this->record()], [$first, $duplicate], 'tenant-a',
            function(): array {
                $this->fail('Probe must not run with an ambiguous mapping file');
            });
        $this->assertFalse($report['clean_dry_run']);
        $this->assertSame('blocked_mapping_file', $report['rows'][0]['status']);
        $this->assertContains('duplicate_mapping_key', $report['mapping_issues'][0]['problems']);
    }

    /** One Moodle user cannot represent two different HSE people in the mapping. */
    public function test_conflicting_moodle_user_identity_blocks_all_probes(): void {
        $first = $this->mapping();
        $conflict = $this->mapping();
        $conflict['_row_number'] = 3;
        $conflict['person_id'] = 'person-2';
        $conflict['course_id'] = 'chemical-hygiene';
        $conflict['moodle_course_id'] = '203';
        $report = dry_run_validator::assess([$this->record()], [$first, $conflict], 'tenant-a',
            function(): array {
                $this->fail('Probe must not run with conflicting identity mappings');
            });
        $this->assertFalse($report['clean_dry_run']);
        $this->assertContains('conflicting_moodle_user_identity', $report['mapping_issues'][0]['problems']);
    }

    /** Invalid dates are rejected rather than normalized to a different date. */
    public function test_invalid_date_is_rejected(): void {
        $record = $this->record();
        $record['completed_at'] = '2026-02-31T00:00:00Z';
        $report = dry_run_validator::assess([$record], [$this->mapping()], 'tenant-a',
            function(): array {
                $this->fail('Probe must not run for an invalid date');
            });
        $this->assertSame('invalid_source', $report['rows'][0]['status']);
        $this->assertContains('invalid_completed_at', $report['rows'][0]['problems']);
    }

    /** Parseable original date text must represent the same instant as the normalized date. */
    public function test_parseable_raw_date_mismatch_is_rejected(): void {
        $record = $this->record();
        $record['original_completed_raw'] = '2026-01-02T00:00:00Z';
        $report = dry_run_validator::assess([$record], [$this->mapping()], 'tenant-a',
            function(): array {
                $this->fail('Probe must not run for a mismatched raw date');
            });
        $this->assertSame('invalid_source', $report['rows'][0]['status']);
        $this->assertContains('original_completed_mismatch', $report['rows'][0]['problems']);
    }

    /** A structurally different CSV header is rejected before any row processing. */
    public function test_csv_requires_exact_header(): void {
        $path = tempnam(sys_get_temp_dir(), 'hsi_dry_run_');
        if ($path === false) {
            $this->fail('Could not create temporary CSV');
        }
        try {
            file_put_contents($path, "hsi_record_id,tenant_id\nrow-1,tenant-a\n");
            $this->expectException(\InvalidArgumentException::class);
            dry_run_validator::read_csv($path, dry_run_validator::HSI_COLUMNS);
        } finally {
            unlink($path);
        }
    }

    /** Synthetic record for parser tests only; never a production completion. */
    private function record(): array {
        return [
            '_row_number' => 2,
            'hsi_record_id' => 'hsi-1',
            'tenant_id' => 'tenant-a',
            'site_id' => 'tifton',
            'person_id' => 'person-1',
            'course_id' => 'respiratory-protection',
            'completed_at' => '2026-01-01T00:00:00Z',
            'expires_at' => '',
            'original_completed_raw' => '2026-01-01T00:00:00Z',
            'original_expires_raw' => '',
            'original_timezone' => 'UTC',
        ];
    }

    /** Synthetic mapping for parser tests only. */
    private function mapping(): array {
        return [
            '_row_number' => 2,
            'tenant_id' => 'tenant-a',
            'site_id' => 'tifton',
            'person_id' => 'person-1',
            'moodle_user_id' => '101',
            'course_id' => 'respiratory-protection',
            'moodle_course_id' => '202',
        ];
    }
}
