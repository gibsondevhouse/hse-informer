-- Gate B completion criteria may be verified while a course version is still
-- a draft. Once reviewed, the version and its verification record are frozen.
CREATE OR REPLACE FUNCTION protect_version_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permitted text[];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'version records cannot be deleted'; END IF;
  IF OLD.review_status <> 'unapproved' THEN
    RAISE EXCEPTION 'reviewed versions cannot be changed; create a new version';
  END IF;
  IF TG_TABLE_NAME = 'course_versions' THEN
    permitted := ARRAY['review_status','reviewed_by','reviewed_at','moodle_course_id',
      'moodle_activity_id','moodle_scorm_id','effective_at',
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
