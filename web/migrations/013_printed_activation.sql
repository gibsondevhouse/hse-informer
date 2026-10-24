ALTER TABLE people ADD COLUMN account_access_locked boolean NOT NULL DEFAULT false;
ALTER TABLE person_account_invitations ADD COLUMN activation_code_sha256 text
  CHECK (activation_code_sha256 IS NULL OR activation_code_sha256 ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX person_activation_code ON person_account_invitations(activation_code_sha256)
  WHERE activation_code_sha256 IS NOT NULL;

-- Legacy printed passwords have no provider-enforced expiry. Revoke that access
-- and require an administrator to issue a fresh one-time activation code.
UPDATE people pe SET account_access_locked=true FROM principals p
  JOIN person_account_invitations i ON i.tenant_id=p.tenant_id AND i.principal_id=p.id
  WHERE pe.tenant_id=p.tenant_id AND pe.id=p.person_id AND i.delivery='printed';
UPDATE principals p SET active=false FROM person_account_invitations i
  WHERE i.tenant_id=p.tenant_id AND i.principal_id=p.id AND i.delivery='printed';
INSERT INTO integration_outbox (tenant_id,kind,aggregate_id)
  SELECT tenant_id,'moodle_user_state',id FROM people WHERE account_access_locked
  ON CONFLICT (tenant_id,kind,aggregate_id) DO UPDATE SET state='pending',next_attempt_at=now(),completed_at=NULL;
