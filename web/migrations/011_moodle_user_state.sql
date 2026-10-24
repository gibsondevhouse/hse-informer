ALTER TABLE integration_outbox DROP CONSTRAINT integration_outbox_kind_check;
ALTER TABLE integration_outbox ADD CONSTRAINT integration_outbox_kind_check
  CHECK (kind IN ('moodle_enrol','moodle_reconcile','moodle_user_state'));
