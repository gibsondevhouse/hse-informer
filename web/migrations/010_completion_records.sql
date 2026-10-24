-- Completion decisions are append-only. An amendment never edits its predecessor.
CREATE TABLE manual_completion_details (
  tenant_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  person_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_reference text NOT NULL CHECK (length(btrim(source_reference)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, evidence_id),
  FOREIGN KEY (tenant_id, evidence_id) REFERENCES knowledge_evidence(tenant_id, id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES principals(tenant_id, id)
);

CREATE TABLE completion_record_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  replacement_evidence_id uuid,
  kind text NOT NULL CHECK (kind IN ('corrected','voided')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, evidence_id) REFERENCES knowledge_evidence(tenant_id, id),
  FOREIGN KEY (tenant_id, replacement_evidence_id) REFERENCES knowledge_evidence(tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, evidence_id),
  UNIQUE (tenant_id, replacement_evidence_id),
  CHECK ((kind = 'corrected') = (replacement_evidence_id IS NOT NULL)),
  CHECK (replacement_evidence_id IS NULL OR replacement_evidence_id <> evidence_id)
);

CREATE TRIGGER manual_completion_details_immutable BEFORE UPDATE OR DELETE ON manual_completion_details
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
CREATE TRIGGER completion_record_events_immutable BEFORE UPDATE OR DELETE ON completion_record_events
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();

-- Assignment and authorization readers must use this view, not raw evidence.
CREATE VIEW effective_knowledge_evidence AS
  SELECT k.* FROM knowledge_evidence k WHERE NOT EXISTS (
    SELECT 1 FROM completion_record_events e
    WHERE e.tenant_id = k.tenant_id AND e.evidence_id = k.id
  );

CREATE INDEX manual_completion_subject ON manual_completion_details (tenant_id, person_id, site_id);
CREATE INDEX knowledge_completion_date ON knowledge_evidence (tenant_id, completed_at DESC);

ALTER TABLE knowledge_evidence ADD CONSTRAINT manual_evidence_has_no_assessment_fields CHECK (
  delivery_source <> 'manual' OR (score IS NULL AND attempts IS NULL AND duration_seconds IS NULL
    AND source_attempt_id IS NULL AND moodle_course_id IS NULL AND moodle_user_id IS NULL
    AND moodle_timecompleted IS NULL)
);

CREATE OR REPLACE FUNCTION validate_manual_completion_details() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence knowledge_evidence%ROWTYPE;
BEGIN
  SELECT * INTO STRICT evidence FROM knowledge_evidence WHERE tenant_id = NEW.tenant_id AND id = NEW.evidence_id;
  IF evidence.delivery_source <> 'manual' THEN
    RAISE EXCEPTION 'manual provenance requires a manual completion';
  END IF;
  IF evidence.assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM assignments a WHERE a.tenant_id = NEW.tenant_id AND a.id = evidence.assignment_id
      AND a.person_id = NEW.person_id AND a.site_id = NEW.site_id AND a.course_version_id = evidence.course_version_id
  ) THEN RAISE EXCEPTION 'manual assignment must match its person, site, and exact course version'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER manual_completion_details_guard BEFORE INSERT ON manual_completion_details
  FOR EACH ROW EXECUTE FUNCTION validate_manual_completion_details();

CREATE OR REPLACE FUNCTION require_manual_completion_details() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.delivery_source = 'manual' AND NOT EXISTS (
    SELECT 1 FROM manual_completion_details m WHERE m.tenant_id = NEW.tenant_id AND m.evidence_id = NEW.id
  ) THEN RAISE EXCEPTION 'manual completions require immutable provenance'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER manual_completion_provenance_required AFTER INSERT ON knowledge_evidence
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_manual_completion_details();
