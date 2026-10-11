-- Site owners explicitly configure applicability. The app does not infer a legal duty
-- from the course catalog or from a worker's job title.
CREATE TABLE IF NOT EXISTS site_role_requirements (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  group_name TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  local_instruction_required INTEGER NOT NULL DEFAULT 0 CHECK (local_instruction_required IN (0, 1)),
  prerequisite_required INTEGER NOT NULL DEFAULT 0 CHECK (prerequisite_required IN (0, 1)),
  practical_evaluation_required INTEGER NOT NULL DEFAULT 0 CHECK (practical_evaluation_required IN (0, 1)),
  authorization_required INTEGER NOT NULL DEFAULT 0 CHECK (authorization_required IN (0, 1)),
  updated_at TEXT NOT NULL,
  UNIQUE (site_id, group_name, course_id),
  FOREIGN KEY (course_id, course_version) REFERENCES course_releases(course_id, version)
);
CREATE INDEX IF NOT EXISTS site_role_requirements_scope ON site_role_requirements(site_id, group_name);

-- Every correction is appended. The latest event for each worker/site/course/step
-- defines current state; older evidence remains available to auditors.
CREATE TABLE IF NOT EXISTS qualification_events (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  course_id TEXT NOT NULL,
  assignment_id TEXT REFERENCES assignments(id),
  course_version TEXT NOT NULL,
  step TEXT NOT NULL CHECK (step IN ('local_instruction', 'prerequisite', 'practical_evaluation', 'authorization')),
  outcome TEXT NOT NULL CHECK (outcome IN ('satisfied', 'not_satisfied', 'revoked')),
  evidence_ref TEXT NOT NULL DEFAULT '',
  reference_version TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  scope TEXT NOT NULL DEFAULT '',
  restrictions TEXT NOT NULL DEFAULT '',
  actor_sub TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  supersedes_id TEXT REFERENCES qualification_events(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qualification_events_current ON qualification_events(worker_id, site_id, course_id, step, created_at DESC);
CREATE INDEX IF NOT EXISTS qualification_events_scope ON qualification_events(site_id, created_at DESC);
