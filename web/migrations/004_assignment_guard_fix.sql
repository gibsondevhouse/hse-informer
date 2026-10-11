-- PostgreSQL computes stored generated columns after BEFORE triggers; compare their source columns.
CREATE OR REPLACE FUNCTION protect_assignment_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'assignment decisions cannot be deleted'; END IF;
  IF (NEW.tenant_id, NEW.person_id, NEW.site_id, NEW.requirement_id,
      NEW.requirement_version_id, NEW.course_version_id, NEW.site_addendum_version_id,
      NEW.reason, NEW.trigger_kind, NEW.trigger_ref,
      NEW.supersedes_assignment_id, NEW.assigned_at, NEW.created_by)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.person_id, OLD.site_id, OLD.requirement_id,
      OLD.requirement_version_id, OLD.course_version_id, OLD.site_addendum_version_id,
      OLD.reason, OLD.trigger_kind, OLD.trigger_ref,
      OLD.supersedes_assignment_id, OLD.assigned_at, OLD.created_by) THEN
    RAISE EXCEPTION 'assignment identity and pinned versions cannot be changed; create a new assignment';
  END IF;
  RETURN NEW;
END;
$$;
