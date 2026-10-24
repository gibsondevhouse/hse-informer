ALTER TABLE principals ADD COLUMN session_version integer NOT NULL DEFAULT 0 CHECK (session_version >= 0);
ALTER TABLE principals ADD COLUMN auth_valid_after timestamptz NOT NULL DEFAULT now();

-- Re-enabling an account never revives a previously signed application cookie
-- or an identity token minted before its latest access change. An explicit
-- increment requests revocation even when the role and active state stay equal.
CREATE OR REPLACE FUNCTION revoke_changed_principal_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active
      OR NEW.session_version IS DISTINCT FROM OLD.session_version
      OR NEW.auth_valid_after IS DISTINCT FROM OLD.auth_valid_after THEN
    NEW.session_version := OLD.session_version + 1;
    NEW.auth_valid_after := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER principals_revoke_sessions BEFORE UPDATE ON principals
  FOR EACH ROW EXECUTE FUNCTION revoke_changed_principal_sessions();
