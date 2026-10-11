import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('core migration creates durable record tables and prevents duplicate open assignments', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../migrations/0001_core.sql', import.meta.url), 'utf8'));
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  for (const name of ['sites', 'users', 'user_sites', 'workers', 'course_releases', 'assignments', 'assignment_progress', 'assignment_outbox', 'audit_events']) {
    assert.ok(names.includes(name), name);
  }
  db.prepare('INSERT INTO sites (id,name,code,location) VALUES (?,?,?,?)').run('north', 'North Plant', 'NP', 'Greensboro');
  db.prepare('INSERT INTO workers (id,name,email,site_id,group_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run('worker-1', 'A Worker', 'worker@example.com', 'north', 'Production', '2026-10-07T00:00:00Z', '2026-10-07T00:00:00Z');
  db.prepare('INSERT INTO course_releases (course_id,version,title,launch_path,approved_at,deliverable) VALUES (?,?,?,?,?,?)')
    .run('pbj-101', '1.0.0', 'Practice', '/training/pb-and-j', '2026-10-07T00:00:00Z', 1);
  const insert = db.prepare(`INSERT INTO assignments
    (id,worker_id,site_id,course_id,course_version,assigned_at,due_date,status,reason,cadence)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insert.run('a1', 'worker-1', 'north', 'pbj-101', '1.0.0', '2026-10-07T00:00:00Z', '2026-11-01', 'Not started', 'Initial', 'None');
  assert.throws(() => insert.run('a2', 'worker-1', 'north', 'pbj-101', '1.0.0', '2026-10-07T00:00:00Z', '2026-11-01', 'In progress', 'Initial', 'None'));
  db.prepare("UPDATE assignments SET status = 'Knowledge Complete' WHERE id = 'a1'").run();
  insert.run('a2', 'worker-1', 'north', 'pbj-101', '1.0.0', '2026-10-07T00:00:00Z', '2026-11-01', 'Not started', 'Renewal', 'Annual');
  assert.equal(db.prepare('SELECT count(*) AS count FROM assignments').get().count, 2);
  const guardedEdit = db.prepare(`UPDATE assignments SET due_date=?,last_admin_action_id=?
    WHERE id=? AND worker_id=? AND status=? AND due_date=? AND last_admin_action_id IS ?`);
  assert.equal(guardedEdit.run('2026-11-02', 'action-1', 'a2', 'worker-1', 'Not started', '2026-11-01', null).changes, 1);
  assert.equal(guardedEdit.run('2026-11-03', 'action-2', 'a2', 'worker-1', 'Not started', '2026-11-01', null).changes, 0);
  db.prepare(`INSERT INTO assignment_outbox (id,assignment_id,kind,scheduled_at,state)
    VALUES (?,?,?,?,?)`).run('outbox-a2', 'a2', 'assignment', '2026-10-07T00:00:00Z', 'pending');
  const claim = db.prepare(`UPDATE assignment_outbox SET state='processing',claim_token=?,claim_until=?
    WHERE id=? AND attempts<3 AND state IN ('pending','failed')`);
  assert.equal(claim.run('claim-1', '2026-10-07T00:05:00Z', 'outbox-a2').changes, 1);
  assert.equal(claim.run('claim-2', '2026-10-07T00:05:00Z', 'outbox-a2').changes, 0);
  db.close();
});
