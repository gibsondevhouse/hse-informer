-- Moodle delivers beta courses. Manual records carry their own provenance;
-- they do not invent Moodle users, attempts, or completion timestamps.
ALTER TABLE course_versions
  ADD COLUMN content_source text NOT NULL DEFAULT 'deephow' CHECK (content_source IN ('in_house','deephow','other')),
  ADD COLUMN content_id text,
  ADD COLUMN content_version text,
  ADD COLUMN title text,
  ADD COLUMN language_code text NOT NULL DEFAULT 'en-US',
  ADD COLUMN practice_only boolean NOT NULL DEFAULT false,
  ALTER COLUMN deephow_content_id DROP NOT NULL,
  ALTER COLUMN deephow_version DROP NOT NULL;
ALTER TABLE course_versions DISABLE TRIGGER course_versions_guard;
UPDATE course_versions SET content_id = deephow_content_id, content_version = deephow_version;
ALTER TABLE course_versions ENABLE TRIGGER course_versions_guard;
ALTER TABLE course_versions ALTER COLUMN content_source SET DEFAULT 'in_house';
CREATE UNIQUE INDEX course_versions_content_identity ON course_versions
  (tenant_id, content_source, content_id, content_version) WHERE content_id IS NOT NULL;

-- Retirement is a narrow lifecycle transition; reviewed content stays frozen.
CREATE OR REPLACE FUNCTION protect_version_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permitted text[];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'version records cannot be deleted'; END IF;
  IF OLD.review_status <> 'unapproved' THEN
    IF TG_TABLE_NAME = 'course_versions' AND OLD.review_status = 'approved' AND NEW.review_status = 'retired'
      AND (to_jsonb(NEW)->>'retired_at') IS NOT NULL
      AND (to_jsonb(NEW) - ARRAY['review_status','retired_at']) = (to_jsonb(OLD) - ARRAY['review_status','retired_at'])
    THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'reviewed versions cannot be changed; create a new version';
  END IF;
  IF TG_TABLE_NAME = 'course_versions' THEN
    permitted := ARRAY['review_status','reviewed_by','reviewed_at','moodle_course_id',
      'moodle_activity_id','moodle_scorm_id','effective_at','retired_at',
      'completion_criteria_verified','completion_verification_note'];
  ELSE
    permitted := ARRAY['review_status','reviewed_by','reviewed_at','effective_at'];
  END IF;
  IF (to_jsonb(NEW) - permitted) <> (to_jsonb(OLD) - permitted) THEN
    RAISE EXCEPTION 'version content cannot be changed; create a new version';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE knowledge_evidence
  ADD COLUMN delivery_source text NOT NULL DEFAULT 'moodle' CHECK (delivery_source IN ('moodle','manual')),
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN source_attempt_id text,
  ADD COLUMN completion_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ALTER COLUMN moodle_course_id DROP NOT NULL,
  ALTER COLUMN moodle_user_id DROP NOT NULL,
  ALTER COLUMN moodle_timecompleted DROP NOT NULL,
  ALTER COLUMN assignment_id DROP NOT NULL;
ALTER TABLE knowledge_evidence DISABLE TRIGGER knowledge_evidence_immutable;
UPDATE knowledge_evidence SET completed_at = moodle_timecompleted;
UPDATE knowledge_evidence k SET completion_snapshot = jsonb_build_object(
  'person', jsonb_build_object('id', p.id, 'displayName', p.display_name, 'hseId', p.hse_id),
  'site', jsonb_build_object('id', s.id, 'name', s.name),
  'course', jsonb_build_object('id', cv.id, 'title', COALESCE(cv.title, r.title),
    'version', COALESCE(cv.content_version, cv.deephow_version, rv.version),
    'language', cv.language_code, 'packageSha256', cv.package_sha256, 'practiceOnly', cv.practice_only),
  'snapshotBasis', 'current profile at source-neutral migration')
  FROM assignments a JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
  JOIN sites s ON s.tenant_id = a.tenant_id AND s.id = a.site_id
  JOIN requirements r ON r.tenant_id = a.tenant_id AND r.id = a.requirement_id
  JOIN requirement_versions rv ON rv.tenant_id = a.tenant_id AND rv.id = a.requirement_version_id
  JOIN course_versions cv ON cv.tenant_id = a.tenant_id AND cv.id = a.course_version_id
  WHERE k.tenant_id = a.tenant_id AND k.assignment_id = a.id;
ALTER TABLE knowledge_evidence ENABLE TRIGGER knowledge_evidence_immutable;
ALTER TABLE knowledge_evidence ALTER COLUMN completed_at SET NOT NULL;
ALTER TABLE knowledge_evidence ADD CONSTRAINT knowledge_source_fields CHECK (
  delivery_source = 'manual' OR
  (assignment_id IS NOT NULL AND moodle_course_id IS NOT NULL AND moodle_user_id IS NOT NULL AND moodle_timecompleted IS NOT NULL));
CREATE UNIQUE INDEX knowledge_evidence_source_attempt ON knowledge_evidence (tenant_id, delivery_source, source_attempt_id)
  WHERE source_attempt_id IS NOT NULL;
CREATE OR REPLACE FUNCTION source_neutral_completion_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.completed_at := COALESCE(NEW.completed_at, NEW.moodle_timecompleted);
  IF NEW.delivery_source = 'moodle' AND NEW.completed_at IS DISTINCT FROM NEW.moodle_timecompleted THEN
    RAISE EXCEPTION 'Moodle completion timestamps must match their source';
  END IF;
  IF NEW.delivery_source = 'moodle' AND NEW.completion_snapshot = '{}'::jsonb THEN
    SELECT jsonb_build_object(
      'person', jsonb_build_object('id', p.id, 'displayName', p.display_name, 'hseId', p.hse_id),
      'site', jsonb_build_object('id', s.id, 'name', s.name),
      'course', jsonb_build_object('id', cv.id, 'title', COALESCE(cv.title, r.title),
        'version', COALESCE(cv.content_version, cv.deephow_version, rv.version),
        'language', cv.language_code, 'packageSha256', cv.package_sha256, 'practiceOnly', cv.practice_only),
      'assignment', jsonb_build_object('id', a.id, 'reason', a.reason, 'assignedAt', a.assigned_at, 'dueAt', a.due_at),
      'source', jsonb_build_object('courseId', NEW.moodle_course_id, 'userId', NEW.moodle_user_id,
        'completedAt', NEW.completed_at)) INTO NEW.completion_snapshot
      FROM assignments a JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
      JOIN sites s ON s.tenant_id = a.tenant_id AND s.id = a.site_id
      JOIN requirements r ON r.tenant_id = a.tenant_id AND r.id = a.requirement_id
      JOIN requirement_versions rv ON rv.tenant_id = a.tenant_id AND rv.id = a.requirement_version_id
      JOIN course_versions cv ON cv.tenant_id = a.tenant_id AND cv.id = NEW.course_version_id
      WHERE a.tenant_id = NEW.tenant_id AND a.id = NEW.assignment_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER knowledge_evidence_completion_time BEFORE INSERT ON knowledge_evidence
  FOR EACH ROW EXECUTE FUNCTION source_neutral_completion_time();
