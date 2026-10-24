-- Login identifiers are distinct from worker contact details. A technical
-- identifier is deliberately non-deliverable and must never receive mail.
ALTER TABLE people ADD COLUMN identity_email text;
ALTER TABLE people ADD COLUMN identity_email_technical boolean NOT NULL DEFAULT false;
UPDATE people SET identity_email = COALESCE(NULLIF(btrim(email), ''), id::text || '@' || tenant_id::text || '.login.invalid'),
  identity_email_technical = NULLIF(btrim(email), '') IS NULL;
ALTER TABLE people ALTER COLUMN identity_email SET NOT NULL;
ALTER TABLE people ADD CONSTRAINT people_technical_identity_email CHECK (
  NOT identity_email_technical OR identity_email = id::text || '@' || tenant_id::text || '.login.invalid'
);

CREATE OR REPLACE FUNCTION assign_person_identity_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.identity_email IS DISTINCT FROM NEW.identity_email
      OR OLD.identity_email_technical IS DISTINCT FROM NEW.identity_email_technical) THEN
    RAISE EXCEPTION 'login identity is stable; account identity changes require an explicit migration';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.identity_email IS NULL THEN
    NEW.identity_email := COALESCE(NULLIF(btrim(NEW.email), ''), NEW.id::text || '@' || NEW.tenant_id::text || '.login.invalid');
    NEW.identity_email_technical := NULLIF(btrim(NEW.email), '') IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER people_identity_email BEFORE INSERT OR UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION assign_person_identity_email();
