-- A mistaken import must not turn a marked fictional person into a live
-- assignment, even when a caller bypasses the application service.
CREATE OR REPLACE FUNCTION reject_live_synthetic_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM people p JOIN tenants t ON t.id = p.tenant_id
    WHERE p.tenant_id = NEW.tenant_id AND p.id = NEW.person_id
      AND p.synthetic AND NOT t.synthetic) THEN
    RAISE EXCEPTION 'synthetic person cannot be assigned in a non-synthetic tenant';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignments_live_synthetic_boundary BEFORE INSERT ON assignments
  FOR EACH ROW EXECUTE FUNCTION reject_live_synthetic_assignment();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM assignments a
    JOIN tenants t ON t.id = a.tenant_id
    JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
    WHERE NOT t.synthetic AND p.synthetic) THEN
    RAISE EXCEPTION 'existing synthetic assignments in a non-synthetic tenant require review';
  END IF;
END;
$$;
