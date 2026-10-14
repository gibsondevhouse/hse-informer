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
 * Strict CSV validation and row-by-row dry-run assessment.
 *
 * @package    local_hsi_import
 * @copyright  2026 HSE Informer
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_hsi_import;

defined('MOODLE_INTERNAL') || die();

/**
 * Pure validation. The probe callback may inspect Moodle but must not write.
 */
final class dry_run_validator {
    /** Exact normalized HSI contract. */
    public const HSI_COLUMNS = [
        'hsi_record_id', 'tenant_id', 'site_id', 'person_id', 'course_id', 'completed_at', 'expires_at',
        'original_completed_raw', 'original_expires_raw', 'original_timezone',
    ];

    /** Explicit, manually reviewed Moodle ID mapping contract. */
    public const MAPPING_COLUMNS = [
        'tenant_id', 'site_id', 'person_id', 'moodle_user_id', 'course_id', 'moodle_course_id',
    ];

    /** Bound memory use in this prototype. Larger migrations need a streaming implementation. */
    private const MAX_ROWS = 50000;

    /**
     * Parse a file with an exact header and exact width for every nonblank row.
     *
     * @param string $path Absolute or relative file path.
     * @param array $columns Required ordered header.
     * @return array Parsed rows, each including a _row_number for diagnostics.
     */
    public static function read_csv(string $path, array $columns): array {
        if (!is_file($path) || !is_readable($path)) {
            throw new \InvalidArgumentException('CSV is not a readable regular file: ' . $path);
        }
        $file = fopen($path, 'rb');
        if ($file === false) {
            throw new \InvalidArgumentException('Could not open CSV: ' . $path);
        }
        try {
            $header = fgetcsv($file, 0, ',', '"', '');
            if ($header !== $columns) {
                throw new \InvalidArgumentException('CSV header must exactly match: ' . implode(',', $columns));
            }
            $rows = [];
            $number = 1;
            while (($cells = fgetcsv($file, 0, ',', '"', '')) !== false) {
                ++$number;
                if ($cells === [null]) {
                    throw new \InvalidArgumentException('Blank CSV row ' . $number . ' is not permitted');
                }
                if (count($cells) !== count($columns)) {
                    throw new \InvalidArgumentException('CSV row ' . $number . ' has the wrong column count');
                }
                if (count($rows) >= self::MAX_ROWS) {
                    throw new \InvalidArgumentException('CSV exceeds the 50000-row prototype limit');
                }
                $row = array_combine($columns, $cells);
                $row['_row_number'] = $number;
                $rows[] = $row;
            }
            if (!$rows) {
                throw new \InvalidArgumentException('CSV contains no data rows');
            }
            return $rows;
        } finally {
            fclose($file);
        }
    }

    /**
     * Assess every normalized source record against mappings and a read-only Moodle probe.
     *
     * @param array $records Rows from the normalized HSI CSV.
     * @param array $mappings Rows from the Moodle mapping CSV.
     * @param string $tenantid Expected HSE tenant ID for this one-company Moodle instance.
     * @param callable $probe Callback with (moodle_user_id, moodle_course_id, completion_epoch).
     * @return array Report with source-row dispositions and mapping issues.
     */
    public static function assess(array $records, array $mappings, string $tenantid, callable $probe): array {
        if (!self::valid_id($tenantid)) {
            throw new \InvalidArgumentException('Expected tenant ID is invalid');
        }
        $mappingissues = [];
        $mappingindex = [];
        $mappinguse = [];
        $moodleusers = [];
        $moodlecourses = [];
        $moodletargets = [];
        foreach ($mappings as $mapping) {
            $number = $mapping['_row_number'] ?? null;
            $problems = [];
            foreach (['tenant_id', 'site_id', 'person_id', 'course_id'] as $column) {
                if (!self::valid_id($mapping[$column] ?? '')) {
                    $problems[] = 'invalid_' . $column;
                }
            }
            foreach (['moodle_user_id', 'moodle_course_id'] as $column) {
                if (!self::positive_id($mapping[$column] ?? '')) {
                    $problems[] = 'invalid_' . $column;
                }
            }
            if (($mapping['tenant_id'] ?? '') !== $tenantid) {
                $problems[] = 'wrong_tenant';
            }
            $key = self::key($mapping);
            if (isset($mappingindex[$key])) {
                $problems[] = 'duplicate_mapping_key';
            }
            $moodleuserid = (string) ($mapping['moodle_user_id'] ?? '');
            $moodlecourseid = (string) ($mapping['moodle_course_id'] ?? '');
            $personid = (string) ($mapping['person_id'] ?? '');
            $courseid = (string) ($mapping['course_id'] ?? '');
            $targetkey = $moodleuserid . "\x1f" . $moodlecourseid;
            if (isset($moodleusers[$moodleuserid]) && $moodleusers[$moodleuserid] !== $personid) {
                $problems[] = 'conflicting_moodle_user_identity';
            }
            if (isset($moodlecourses[$moodlecourseid]) && $moodlecourses[$moodlecourseid] !== $courseid) {
                $problems[] = 'conflicting_moodle_course_identity';
            }
            if (isset($moodletargets[$targetkey]) && $moodletargets[$targetkey] !== $key) {
                $problems[] = 'duplicate_moodle_target';
            }
            if ($problems) {
                $mappingissues[] = ['row_number' => $number, 'problems' => $problems];
                continue;
            }
            $mappingindex[$key] = $mapping;
            $mappinguse[$key] = false;
            $moodleusers[$moodleuserid] = $personid;
            $moodlecourses[$moodlecourseid] = $courseid;
            $moodletargets[$targetkey] = $key;
        }

        // Ambiguous or malformed mappings block all Moodle probes; no subset is silently accepted.
        $mappingblocked = !empty($mappingissues);
        $seenrecords = [];
        $results = [];
        $counts = [];
        foreach ($records as $record) {
            $problems = [];
            foreach (['hsi_record_id', 'tenant_id', 'site_id', 'person_id', 'course_id'] as $column) {
                if (!self::valid_id($record[$column] ?? '')) {
                    $problems[] = 'invalid_' . $column;
                }
            }
            if (($record['tenant_id'] ?? '') !== $tenantid) {
                $problems[] = 'wrong_tenant';
            }
            $completed = self::timestamp($record['completed_at'] ?? '');
            if ($completed === null) {
                $problems[] = 'invalid_completed_at';
            }
            $originalcompleted = $record['original_completed_raw'] ?? '';
            if (!self::valid_raw_date($originalcompleted, true)) {
                $problems[] = 'invalid_original_completed_raw';
            }
            $originaltimezone = $record['original_timezone'] ?? '';
            if (!is_string($originaltimezone) || strlen($originaltimezone) > 128 ||
                    preg_match('/[\x00-\x1f\x7f]/', $originaltimezone)) {
                $problems[] = 'invalid_original_timezone';
            }
            $rawcompletedepoch = self::timestamp($originalcompleted);
            if ($rawcompletedepoch !== null && $completed !== null && $rawcompletedepoch !== $completed) {
                $problems[] = 'original_completed_mismatch';
            }
            $expires = null;
            if (($record['expires_at'] ?? '') !== '') {
                $expires = self::timestamp($record['expires_at']);
                if ($expires === null) {
                    $problems[] = 'invalid_expires_at';
                } else if ($completed !== null && $expires < $completed) {
                    $problems[] = 'expires_before_completion';
                }
            }
            $originalexpires = $record['original_expires_raw'] ?? '';
            if (!self::valid_raw_date($originalexpires, false)) {
                $problems[] = 'invalid_original_expires_raw';
            }
            $rawexpiresepoch = self::timestamp($originalexpires);
            if ($originalexpires !== '' && ($record['expires_at'] ?? '') === '') {
                $problems[] = 'original_expires_without_normalized_expiry';
            }
            if ($rawexpiresepoch !== null && $expires !== null && $rawexpiresepoch !== $expires) {
                $problems[] = 'original_expires_mismatch';
            }
            $recordid = $record['hsi_record_id'] ?? '';
            if (isset($seenrecords[$recordid])) {
                $problems[] = 'duplicate_hsi_record_id';
            }
            $seenrecords[$recordid] = true;

            $status = 'invalid_source';
            $detail = null;
            if (!$problems) {
                if ($mappingblocked) {
                    $status = 'blocked_mapping_file';
                } else {
                    $key = self::key($record);
                    if (!isset($mappingindex[$key])) {
                        $status = 'unmapped';
                    } else {
                        $mapping = $mappingindex[$key];
                        $mappinguse[$key] = true;
                        $probeoutcome = $probe(
                            (int) $mapping['moodle_user_id'],
                            (int) $mapping['moodle_course_id'],
                            $completed
                        );
                        if (!is_array($probeoutcome) || !isset($probeoutcome['status']) ||
                                !in_array($probeoutcome['status'], [
                                    'ready_for_review', 'already_matching', 'completion_conflict',
                                    'missing_user', 'deleted_user', 'suspended_user', 'privileged_user', 'missing_course',
                                    'completion_disabled', 'duplicate_moodle_completion',
                                ], true)) {
                            throw new \UnexpectedValueException('Moodle probe returned an unknown disposition');
                        }
                        $status = $probeoutcome['status'];
                        $detail = $probeoutcome['detail'] ?? null;
                    }
                }
            }
            $counts[$status] = ($counts[$status] ?? 0) + 1;
            $results[] = [
                'row_number' => $record['_row_number'] ?? null,
                'hsi_record_id' => $recordid,
                'tenant_id' => $record['tenant_id'] ?? '',
                'site_id' => $record['site_id'] ?? '',
                'person_id' => $record['person_id'] ?? '',
                'course_id' => $record['course_id'] ?? '',
                'completed_at' => $record['completed_at'] ?? '',
                'expires_at' => $record['expires_at'] ?? '',
                'original_completed_raw' => $originalcompleted,
                'original_expires_raw' => $originalexpires,
                'original_timezone' => $originaltimezone,
                'raw_date_check' => [
                    'completed' => $rawcompletedepoch === null ? 'manual_review_required' :
                        ($completed === $rawcompletedepoch ? 'same_epoch' : 'mismatch'),
                    'expires' => $originalexpires === '' ? 'not_supplied' :
                        ($rawexpiresepoch === null ? 'manual_review_required' :
                            ($expires === $rawexpiresepoch ? 'same_epoch' : 'mismatch')),
                    'source_archive' => 'not_verified',
                ],
                'status' => $status,
                'problems' => $problems,
                'mapping' => isset($mapping) && $status !== 'invalid_source' && $status !== 'unmapped' &&
                    $status !== 'blocked_mapping_file' ? [
                        'moodle_user_id' => (int) $mapping['moodle_user_id'],
                        'moodle_course_id' => (int) $mapping['moodle_course_id'],
                    ] : null,
                'moodle_detail' => $detail,
            ];
            unset($mapping);
        }
        $unusedmappings = [];
        foreach ($mappinguse as $key => $used) {
            if (!$used) {
                $mapping = $mappingindex[$key];
                $unusedmappings[] = [
                    'row_number' => $mapping['_row_number'] ?? null,
                    'tenant_id' => $mapping['tenant_id'],
                    'site_id' => $mapping['site_id'],
                    'person_id' => $mapping['person_id'],
                    'course_id' => $mapping['course_id'],
                ];
            }
        }
        return [
            'source_row_count' => count($records),
            'mapping_row_count' => count($mappings),
            'status_counts' => $counts,
            'mapping_issues' => $mappingissues,
            'unused_mappings' => $unusedmappings,
            'rows' => $results,
            'clean_dry_run' => !$mappingissues && !$unusedmappings &&
                count($results) === (($counts['ready_for_review'] ?? 0) + ($counts['already_matching'] ?? 0)),
        ];
    }

    /** Validate one external identifier without normalization or trimming. */
    private static function valid_id($value): bool {
        return is_string($value) && preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/D', $value) === 1;
    }

    /** Moodle IDs are positive integers in the CSV, never arbitrary strings. */
    private static function positive_id($value): bool {
        if (!is_string($value) || !ctype_digit($value)) {
            return false;
        }
        $parsed = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        return $parsed !== false && (string) $parsed === $value;
    }

    /** Preserve raw source text exactly, while rejecting empty required values and control characters. */
    private static function valid_raw_date($value, bool $required): bool {
        return is_string($value) && (!$required || trim($value) !== '') && strlen($value) <= 512 &&
            preg_match('/[\x00-\x1f\x7f]/', $value) !== 1;
    }

    /** Parse timezone-aware ISO 8601 to an exact second. */
    private static function timestamp($value): ?int {
        if (!is_string($value) ||
                preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/D', $value) !== 1) {
            return null;
        }
        if (preg_match('/[+-](\d{2}):(\d{2})$/D', $value, $offset) &&
                ((int) $offset[1] > 23 || (int) $offset[2] > 59)) {
            return null;
        }
        $parseable = str_ends_with($value, 'Z') ? substr($value, 0, -1) . '+00:00' : $value;
        $datetime = \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:sP', $parseable);
        $errors = \DateTimeImmutable::getLastErrors();
        if ($datetime === false || ($errors !== false && ($errors['warning_count'] || $errors['error_count']))) {
            return null;
        }
        return $datetime->getTimestamp();
    }

    /** Collision-free compound key because valid IDs cannot contain a unit separator. */
    private static function key(array $row): string {
        return implode("\x1f", [
            $row['tenant_id'] ?? '', $row['site_id'] ?? '', $row['person_id'] ?? '', $row['course_id'] ?? '',
        ]);
    }
}
