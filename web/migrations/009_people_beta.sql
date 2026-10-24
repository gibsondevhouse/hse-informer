ALTER TABLE people ADD COLUMN employee_number text;
ALTER TABLE people ADD COLUMN phone text;
ALTER TABLE people ADD COLUMN language text NOT NULL DEFAULT 'en';
ALTER TABLE people ADD COLUMN start_date date;
ALTER TABLE people ADD COLUMN supervisor_reference text;
ALTER TABLE people ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX people_employee_number ON people(tenant_id, lower(employee_number))
  WHERE employee_number IS NOT NULL;
CREATE UNIQUE INDEX people_one_oidc_account ON principals(tenant_id, person_id, oidc_issuer)
  WHERE person_id IS NOT NULL;

-- Operational invitation state contains no temporary password or invitation code.
CREATE TABLE person_account_invitations (
  tenant_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  delivery text NOT NULL CHECK (delivery IN ('email','printed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_id),
  FOREIGN KEY (tenant_id, principal_id) REFERENCES principals(tenant_id, id)
);

-- An administrative context change must be reviewed before it can be used as
-- approved applicability evidence. It never rewrites an existing review.
CREATE TABLE person_context_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  actor_principal_id uuid NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, actor_principal_id) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id)
);
CREATE TRIGGER person_context_changes_immutable BEFORE UPDATE OR DELETE ON person_context_changes
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
