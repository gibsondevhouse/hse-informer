-- Reviewed, append-only applicability inputs. A changed job, task, or exposure
-- is a new version; historical decisions retain the exact version they used.
CREATE TABLE person_training_context_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  site_id uuid NOT NULL,
  context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object'),
  effective_at timestamptz NOT NULL,
  source_reference text NOT NULL,
  reviewed_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, reviewed_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, person_id, site_id, effective_at)
);
CREATE INDEX person_training_context_latest ON person_training_context_versions
  (tenant_id, person_id, site_id, effective_at DESC, recorded_at DESC);
CREATE TRIGGER person_training_context_versions_immutable
  BEFORE UPDATE OR DELETE ON person_training_context_versions
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();

-- A source key is stable for retries. The event pins the requirement version
-- that was active when the qualified reviewer recorded the change.
CREATE TABLE training_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  source_key text NOT NULL,
  requirement_id uuid NOT NULL,
  requirement_version_id uuid NOT NULL,
  site_id uuid NOT NULL,
  event_kind text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scope) = 'object'),
  reason text NOT NULL,
  source_reference text NOT NULL,
  occurred_at timestamptz NOT NULL,
  effective_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_version_id) REFERENCES requirement_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, source_key)
);
CREATE INDEX training_change_events_site ON training_change_events
  (tenant_id, site_id, effective_at);
CREATE TRIGGER training_change_events_immutable
  BEFORE UPDATE OR DELETE ON training_change_events
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();

-- Operational cursor, separate from the immutable source event. A failed
-- transaction leaves no completed run so the scheduler can retry it.
CREATE TABLE training_change_event_runs (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  processed_at timestamptz NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES training_change_events(tenant_id, id)
);

CREATE TABLE training_change_event_failures (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  error_message text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1,
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES training_change_events(tenant_id, id)
);

-- Every evaluated person has an immutable decision, including exclusion or
-- needs-review outcomes. A new context version may supersede a prior review
-- outcome for the same trigger without erasing its original input snapshot.
CREATE TABLE reassignment_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  site_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  requirement_version_id uuid NOT NULL,
  context_version_id uuid,
  event_id uuid,
  source_assignment_id uuid,
  assignment_id uuid,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('event','recurrence')),
  trigger_id text NOT NULL,
  basis_key text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('required','not_required','needs_review')),
  reason text NOT NULL,
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_version_id) REFERENCES requirement_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, context_version_id) REFERENCES person_training_context_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES training_change_events(tenant_id, id),
  FOREIGN KEY (tenant_id, source_assignment_id) REFERENCES assignments(tenant_id, id),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, person_id, requirement_version_id, trigger_kind, trigger_id, basis_key),
  CHECK ((decision = 'required') = (assignment_id IS NOT NULL)),
  CHECK ((trigger_kind = 'event' AND event_id IS NOT NULL AND source_assignment_id IS NULL)
      OR (trigger_kind = 'recurrence' AND source_assignment_id IS NOT NULL AND event_id IS NULL))
);
CREATE INDEX reassignment_decisions_trigger ON reassignment_decisions
  (tenant_id, trigger_kind, trigger_id);
CREATE TRIGGER reassignment_decisions_immutable
  BEFORE UPDATE OR DELETE ON reassignment_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();

-- Exactly one current assignment per person, site, and requirement. Different
-- triggers create linked replacements, never parallel current authorizations.
CREATE UNIQUE INDEX assignments_one_current_scope ON assignments
  (tenant_id, person_id, site_id, requirement_id)
  WHERE closed_at IS NULL AND cancelled_at IS NULL;
