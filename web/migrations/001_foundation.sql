CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, slug)
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  state_code text NOT NULL,
  time_zone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, code)
);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  hse_id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text,
  person_type text NOT NULL CHECK (person_type IN ('employee','contractor','temporary')),
  job_title text,
  department text,
  active boolean NOT NULL DEFAULT true,
  synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, hse_id)
);

CREATE TABLE person_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('oidc','moodle','hsi','other')),
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  UNIQUE (tenant_id, source, external_id), UNIQUE (tenant_id, person_id, source)
);

CREATE TABLE principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  oidc_issuer text NOT NULL,
  oidc_subject text NOT NULL,
  person_id uuid,
  role text NOT NULL CHECK (role IN ('tenant_admin','site_admin','hse_reviewer','evaluator','learner','auditor')),
  active boolean NOT NULL DEFAULT true,
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, oidc_issuer, oidc_subject)
);

CREATE TABLE principal_site_access (
  tenant_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  site_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, site_id),
  FOREIGN KEY (tenant_id, principal_id) REFERENCES principals(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id)
);

CREATE TABLE person_site_memberships (
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  site_id uuid NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  PRIMARY KEY (tenant_id, person_id, site_id, effective_at),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id)
);

CREATE TABLE requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  title text NOT NULL,
  active_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, code)
);

CREATE TABLE requirement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  version text NOT NULL,
  legal_status text NOT NULL CHECK (legal_status IN ('federal_regulatory','state_specific','permit_specific','employer_program','consensus_standard','recommended_practice','general_awareness')),
  authority text NOT NULL,
  audience text NOT NULL,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  recurrence jsonb NOT NULL DEFAULT '{"kind":"event_only"}'::jsonb,
  retraining_triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  site_overlay_requirement text NOT NULL,
  authorization_prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'unapproved' CHECK (review_status IN ('unapproved','approved','retired')),
  reviewed_by text,
  reviewed_at timestamptz,
  effective_at timestamptz,
  content_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, requirement_id, version),
  CHECK ((review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR review_status <> 'approved')
);

ALTER TABLE requirements ADD CONSTRAINT requirements_active_version_fk
  FOREIGN KEY (tenant_id, active_version_id) REFERENCES requirement_versions(tenant_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  requirement_version_id uuid NOT NULL,
  deephow_content_id text NOT NULL,
  deephow_version text NOT NULL,
  package_sha256 text NOT NULL CHECK (package_sha256 ~ '^[a-f0-9]{64}$'),
  export_format text NOT NULL CHECK (export_format IN ('scorm_1_2','scorm_2004','xapi','cmi5','lti','video','url','unknown')),
  moodle_course_id bigint,
  moodle_activity_id bigint,
  moodle_scorm_id bigint,
  review_status text NOT NULL DEFAULT 'unapproved' CHECK (review_status IN ('unapproved','approved','retired')),
  reviewed_by text,
  reviewed_at timestamptz,
  effective_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, requirement_version_id) REFERENCES requirement_versions(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, deephow_content_id, deephow_version),
  CHECK (moodle_course_id IS NULL OR moodle_course_id > 0),
  CHECK ((review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
    AND moodle_course_id IS NOT NULL) OR review_status <> 'approved')
);

CREATE TABLE site_addendum_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  content_uri text NOT NULL,
  review_status text NOT NULL DEFAULT 'unapproved' CHECK (review_status IN ('unapproved','approved','retired')),
  reviewed_by text,
  reviewed_at timestamptz,
  effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, site_id, requirement_id, version),
  CHECK ((review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR review_status <> 'approved')
);

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  site_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  requirement_version_id uuid NOT NULL,
  course_version_id uuid,
  site_addendum_version_id uuid,
  reason text NOT NULL,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('manual','applicability','recurrence','event')),
  trigger_ref text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  closed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_version_id) REFERENCES requirement_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, course_version_id) REFERENCES course_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, site_addendum_version_id) REFERENCES site_addendum_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id),
  CHECK (closed_at IS NULL OR closed_at >= assigned_at)
);
CREATE UNIQUE INDEX assignments_one_open ON assignments (tenant_id, person_id, site_id, requirement_id)
  WHERE closed_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX assignments_tenant_due ON assignments (tenant_id, due_at) WHERE closed_at IS NULL;

CREATE TABLE moodle_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  moodle_user_id bigint NOT NULL,
  moodle_course_id bigint NOT NULL,
  enrolled_at timestamptz NOT NULL,
  last_verified_at timestamptz,
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, assignment_id)
);

CREATE TABLE knowledge_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  course_version_id uuid NOT NULL,
  moodle_course_id bigint NOT NULL,
  moodle_user_id bigint NOT NULL,
  moodle_timecompleted timestamptz NOT NULL,
  score numeric,
  attempts integer CHECK (attempts IS NULL OR attempts >= 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  delivery_method text NOT NULL,
  language_code text,
  source_payload jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  FOREIGN KEY (tenant_id, course_version_id) REFERENCES course_versions(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, assignment_id, moodle_timecompleted)
);

CREATE TABLE site_training_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  site_addendum_version_id uuid NOT NULL,
  completed_at timestamptz NOT NULL,
  attested_by uuid NOT NULL,
  evidence_uri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  FOREIGN KEY (tenant_id, site_addendum_version_id) REFERENCES site_addendum_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, attested_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE evaluator_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  evaluator_principal_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  site_id uuid,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  evidence_uri text NOT NULL,
  recorded_by uuid NOT NULL,
  FOREIGN KEY (tenant_id, evaluator_principal_id) REFERENCES principals(tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES principals(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  UNIQUE (tenant_id, id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE practical_checklist_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  site_id uuid,
  version text NOT NULL,
  checklist jsonb NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  review_status text NOT NULL DEFAULT 'unapproved' CHECK (review_status IN ('unapproved','approved','retired')),
  reviewed_by text,
  reviewed_at timestamptz,
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, requirement_id, site_id, version),
  CHECK ((review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR review_status <> 'approved')
);

CREATE TABLE practical_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  checklist_version_id uuid NOT NULL,
  evaluator_qualification_id uuid NOT NULL,
  evaluator_principal_id uuid NOT NULL,
  evaluated_at timestamptz NOT NULL,
  passed boolean NOT NULL,
  results jsonb NOT NULL,
  restrictions text,
  evaluator_attested_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  FOREIGN KEY (tenant_id, checklist_version_id) REFERENCES practical_checklist_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, evaluator_qualification_id) REFERENCES evaluator_qualifications(tenant_id, id),
  FOREIGN KEY (tenant_id, evaluator_principal_id) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('site_training','practical_evaluation')),
  target_id uuid NOT NULL,
  record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  attested_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, principal_id) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, target_kind, target_id, person_id)
);

CREATE TABLE clearance_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('medical','fit_test','other')),
  cleared boolean NOT NULL,
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE external_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  provider text NOT NULL,
  credential_id text,
  verified_at timestamptz NOT NULL,
  expires_at timestamptz,
  verified_by uuid NOT NULL,
  evidence_uri text NOT NULL,
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  FOREIGN KEY (tenant_id, verified_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('authorized','restricted','revoked')),
  restrictions text,
  decided_at timestamptz NOT NULL,
  expires_at timestamptz,
  decided_by uuid NOT NULL,
  prerequisite_evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES principals(tenant_id, id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  kind text NOT NULL CHECK (kind IN ('moodle_enrol','moodle_reconcile')),
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','done','failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, kind, aggregate_id)
);
CREATE INDEX integration_outbox_ready ON integration_outbox (next_attempt_at) WHERE state IN ('pending','failed');

CREATE TABLE integration_drifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  assignment_id uuid,
  kind text NOT NULL,
  details jsonb NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  UNIQUE (tenant_id, id)
);
CREATE UNIQUE INDEX integration_drifts_open ON integration_drifts (tenant_id, assignment_id, kind)
  WHERE resolved_at IS NULL;

CREATE TABLE historical_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  hsi_record_id text NOT NULL,
  person_id uuid NOT NULL,
  site_id uuid,
  requirement_id uuid,
  source_course_id text NOT NULL,
  original_completed_raw text NOT NULL,
  original_expires_raw text,
  original_timezone text,
  original_completed_at timestamptz NOT NULL,
  original_expires_at timestamptz,
  export_sha256 text NOT NULL CHECK (export_sha256 ~ '^[a-f0-9]{64}$'),
  import_batch text NOT NULL,
  operator_id text NOT NULL,
  moodle_course_id bigint,
  moodle_user_id bigint,
  moodle_timecompleted timestamptz,
  moodle_completion_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id),
  FOREIGN KEY (tenant_id, requirement_id) REFERENCES requirements(tenant_id, id),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, hsi_record_id)
);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  actor_principal_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  before_value jsonb,
  after_value jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, actor_principal_id) REFERENCES principals(tenant_id, id)
);

CREATE OR REPLACE FUNCTION reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'immutable evidence cannot be updated or deleted';
END;
$$;

DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'knowledge_evidence','site_training_evidence','employee_attestations','evaluator_qualifications',
    'practical_evaluations','clearance_statuses',
    'external_credentials','authorizations','historical_provenance','audit_log'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation()', name, name);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION protect_version_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permitted text[];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'version records cannot be deleted'; END IF;
  IF OLD.review_status <> 'unapproved' THEN
    RAISE EXCEPTION 'reviewed versions cannot be changed; create a new version';
  END IF;
  IF TG_TABLE_NAME = 'course_versions' THEN
    permitted := ARRAY['review_status','reviewed_by','reviewed_at','moodle_course_id','moodle_activity_id','moodle_scorm_id','effective_at'];
  ELSE
    permitted := ARRAY['review_status','reviewed_by','reviewed_at','effective_at'];
  END IF;
  IF (to_jsonb(NEW) - permitted) <> (to_jsonb(OLD) - permitted) THEN
    RAISE EXCEPTION 'version content cannot be changed; create a new version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER requirement_versions_guard BEFORE UPDATE OR DELETE ON requirement_versions
  FOR EACH ROW EXECUTE FUNCTION protect_version_content();
CREATE TRIGGER course_versions_guard BEFORE UPDATE OR DELETE ON course_versions
  FOR EACH ROW EXECUTE FUNCTION protect_version_content();
CREATE TRIGGER site_addendum_versions_guard BEFORE UPDATE OR DELETE ON site_addendum_versions
  FOR EACH ROW EXECUTE FUNCTION protect_version_content();
CREATE TRIGGER practical_checklist_versions_guard BEFORE UPDATE OR DELETE ON practical_checklist_versions
  FOR EACH ROW EXECUTE FUNCTION protect_version_content();
