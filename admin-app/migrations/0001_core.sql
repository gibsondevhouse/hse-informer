-- Apply with wrangler d1 migrations apply after provisioning the DB binding.
-- No sample people, grants, or course releases are inserted into live records.
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'site_manager', 'evaluator', 'auditor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS user_sites (
  user_sub TEXT NOT NULL REFERENCES users(sub),
  site_id TEXT NOT NULL REFERENCES sites(id),
  PRIMARY KEY (user_sub, site_id)
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  site_id TEXT NOT NULL REFERENCES sites(id),
  group_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workers_site ON workers(site_id, active);

CREATE TABLE IF NOT EXISTS course_releases (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  launch_path TEXT NOT NULL,
  approved_at TEXT,
  deliverable INTEGER NOT NULL DEFAULT 0 CHECK (deliverable IN (0, 1)),
  PRIMARY KEY (course_id, version)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Not started', 'In progress', 'Knowledge Complete', 'Cancelled')),
  reason TEXT NOT NULL,
  cadence TEXT NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_state IN ('pending', 'configuration_required', 'sent', 'failed')),
  delivered_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  recurrence_months INTEGER,
  next_due_at TEXT,
  last_admin_action_id TEXT,
  FOREIGN KEY (course_id, course_version) REFERENCES course_releases(course_id, version)
);
CREATE INDEX IF NOT EXISTS assignments_worker ON assignments(worker_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS assignments_site_due ON assignments(site_id, due_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_open ON assignments(worker_id, course_id)
  WHERE status IN ('Not started', 'In progress');

CREATE TABLE IF NOT EXISTS assignment_progress (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id),
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  last_action_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_outbox (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  kind TEXT NOT NULL CHECK (kind IN ('assignment', 'reminder')),
  scheduled_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'configuration_required', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claim_token TEXT,
  claim_until TEXT,
  last_error TEXT,
  sent_at TEXT,
  UNIQUE(assignment_id, kind, scheduled_at)
);
CREATE INDEX IF NOT EXISTS assignment_outbox_ready ON assignment_outbox(state, scheduled_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_sub TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  site_id TEXT,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_entity ON audit_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS audit_site_time ON audit_events(site_id, created_at DESC);
