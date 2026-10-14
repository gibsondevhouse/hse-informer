-- A cohort ID is meaningful only within its specific Moodle instance.
ALTER TABLE site_moodle_cohorts ADD COLUMN instance_key text NOT NULL DEFAULT '';
