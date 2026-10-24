-- Latest source observations are mutable. Completion evidence remains append-only.
CREATE TABLE moodle_learning_progress (
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  course_version_id uuid NOT NULL,
  instance_key text NOT NULL CHECK (length(instance_key) > 0),
  moodle_course_id bigint NOT NULL CHECK (moodle_course_id > 0),
  moodle_user_id bigint NOT NULL CHECK (moodle_user_id > 0),
  started boolean,
  course_last_access_at timestamptz,
  activities_with_progress integer NOT NULL CHECK (activities_with_progress >= 0),
  tracked_activities integer NOT NULL CHECK (tracked_activities >= activities_with_progress),
  started_attempts integer CHECK (started_attempts >= 0),
  read_started_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL CHECK (observed_at >= read_started_at),
  source_observation jsonb NOT NULL,
  PRIMARY KEY (tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES assignments(tenant_id, id),
  FOREIGN KEY (tenant_id, course_version_id) REFERENCES course_versions(tenant_id, id)
);
