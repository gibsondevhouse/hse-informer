-- An optional exact assessment identity accompanies the pinned Moodle course.
-- Course-only and existing SCORM mappings remain valid; a native Quiz cannot
-- borrow attempts from another activity or coexist with a SCORM observation.
ALTER TABLE course_versions
  ADD COLUMN moodle_quiz_id bigint CHECK (moodle_quiz_id > 0),
  ADD CONSTRAINT course_versions_quiz_mapping CHECK (
    moodle_quiz_id IS NULL OR
    (moodle_activity_id IS NOT NULL AND moodle_activity_id > 0 AND moodle_scorm_id IS NULL));

-- JSON comparison freezes new columns automatically once a version is reviewed.
-- Permit selecting the assessment only while the version is still unapproved.
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
      'moodle_activity_id','moodle_scorm_id','moodle_quiz_id','effective_at','retired_at',
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
