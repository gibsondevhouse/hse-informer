-- Explicit site cohort and completion verification gates for each tenant's Moodle instance.
CREATE TABLE site_moodle_cohorts (
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  moodle_cohort_id bigint NOT NULL CHECK (moodle_cohort_id > 0),
  cohort_idnumber text,
  mapped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, site_id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  UNIQUE (tenant_id, moodle_cohort_id)
);

ALTER TABLE course_versions
  ADD COLUMN completion_criteria_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN completion_verification_note text,
  ADD CONSTRAINT course_completion_verification_note
    CHECK (NOT completion_criteria_verified OR completion_verification_note IS NOT NULL);

-- Keep historical and multiple alias IDs; one external ID may identify only one person per instance.
ALTER TABLE person_external_ids
  ADD COLUMN instance_key text NOT NULL DEFAULT '',
  ADD COLUMN superseded_at timestamptz;
ALTER TABLE person_external_ids
  DROP CONSTRAINT person_external_ids_tenant_id_source_external_id_key,
  DROP CONSTRAINT person_external_ids_tenant_id_person_id_source_key;
CREATE UNIQUE INDEX person_external_ids_active_external
  ON person_external_ids (tenant_id, source, instance_key, external_id)
  WHERE superseded_at IS NULL;

-- A changed requirement version or event is a new decision linked to its predecessor.
ALTER TABLE assignments
  ADD COLUMN trigger_id text GENERATED ALWAYS AS
    (COALESCE(trigger_ref, 'manual:' || site_id::text)) STORED,
  ADD COLUMN supersedes_assignment_id uuid,
  ADD CONSTRAINT assignments_supersedes_fk FOREIGN KEY (tenant_id, supersedes_assignment_id)
    REFERENCES assignments(tenant_id, id),
  ADD CONSTRAINT assignments_trigger_ref_required
    CHECK (trigger_kind = 'manual' OR NULLIF(btrim(trigger_ref), '') IS NOT NULL);
DROP INDEX assignments_one_open;
CREATE UNIQUE INDEX assignments_one_open ON assignments
  (tenant_id, person_id, requirement_version_id, trigger_id)
  WHERE closed_at IS NULL AND cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION protect_assignment_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'assignment decisions cannot be deleted'; END IF;
  IF (NEW.tenant_id, NEW.person_id, NEW.site_id, NEW.requirement_id,
      NEW.requirement_version_id, NEW.course_version_id, NEW.site_addendum_version_id,
      NEW.reason, NEW.trigger_kind, NEW.trigger_ref, NEW.trigger_id,
      NEW.supersedes_assignment_id, NEW.assigned_at, NEW.created_by)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.person_id, OLD.site_id, OLD.requirement_id,
      OLD.requirement_version_id, OLD.course_version_id, OLD.site_addendum_version_id,
      OLD.reason, OLD.trigger_kind, OLD.trigger_ref, OLD.trigger_id,
      OLD.supersedes_assignment_id, OLD.assigned_at, OLD.created_by) THEN
    RAISE EXCEPTION 'assignment identity and pinned versions cannot be changed; create a new assignment';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignments_identity_guard BEFORE UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION protect_assignment_identity();
