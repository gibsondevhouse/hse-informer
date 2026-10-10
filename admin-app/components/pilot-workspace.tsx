'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, BookOpen, Building2, CalendarDays, CheckCircle2,
  ClipboardCheck, ClipboardList, Clock3, FileClock, Plus, RefreshCw,
  Search, ShieldCheck, Users, X,
} from 'lucide-react';
import { queueRows, type QualificationSnapshot } from '@/lib/qualification';
import { pbjCourse } from '@/lib/lms/pbj-course';
import './pilot-workspace.css';

type Role = 'admin' | 'site_manager' | 'evaluator' | 'auditor';
type Site = { id: string; name: string; code: string; location: string; active: number };
type Worker = { id: string; name: string; email: string; site_id: string; group_name: string; active: number };
type Release = { course_id: string; version: string; title: string; launch_path: string; approved_at: string | null; deliverable: number };
type Assignment = {
  id: string; worker_id: string; site_id: string; course_id: string; course_version: string;
  assigned_at: string; due_date: string; status: 'Not started' | 'In progress' | 'Knowledge Complete' | 'Cancelled';
  reason: string; cadence: string; delivery_state: 'pending' | 'configuration_required' | 'sent' | 'failed';
  delivered_at: string | null; completed_at: string | null; cancelled_at: string | null;
  recurrence_months: number | null; next_due_at: string | null;
};
type Audit = {
  id: string; entity_type: string; entity_id: string; action: string; actor_email: string;
  site_id: string | null; reason: string | null; before_json: string | null;
  after_json: string | null; created_at: string;
};
type Bootstrap = {
  actor: { sub: string; email: string; role: Role; siteIds: string[] };
  asOf: string; sites: Site[]; workers: Worker[]; assignments: Assignment[]; releases: Release[];
};
type AssignmentDetail = { assignment: Assignment; progress: { state_json: string; revision: number; updated_at: string } | null; audit: Audit[]; asOf: string };
type WorkerDetail = { worker: Worker; assignments: Assignment[]; audit: Audit[]; asOf: string };
type View = 'overview' | 'assignments' | 'people' | 'sites' | 'courses' | 'audit';
type Worklist = 'all' | 'overdue' | 'due_soon' | 'failed_delivery' | 'open' | 'complete';
type AssignmentAction = 'change_due_date' | 'cancel' | 'reassign';

const worklistLabels: Record<Worklist, string> = {
  all: 'All assignments', overdue: 'Overdue', due_soon: 'Due in 30 days',
  failed_delivery: 'Delivery needs action', open: 'Open', complete: 'Knowledge complete',
};
const viewLabels: Record<View, string> = {
  overview: 'Overview', assignments: 'Assignments', people: 'People',
  sites: 'Sites', courses: 'Course releases', audit: 'Audit history',
};

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function todayFrom(asOf: string) { return asOf.slice(0, 10); }
function dueSoonEnd(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}
function isOpen(assignment: Assignment) {
  return assignment.status === 'Not started' || assignment.status === 'In progress';
}
function errorMessage(body: unknown, fallback: string) {
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error : fallback;
}
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(body, `Request failed (${response.status}).`));
  return body as T;
}
function jsonRequest(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function readLocation() {
  const query = new URLSearchParams(window.location.search);
  const requestedView = query.get('view');
  const requestedWorklist = query.get('worklist');
  return {
    view: requestedView && requestedView in viewLabels ? requestedView as View : 'overview' as View,
    site: query.get('site') || 'all',
    worklist: requestedWorklist && requestedWorklist in worklistLabels ? requestedWorklist as Worklist : 'all' as Worklist,
    search: query.get('q') || '',
  };
}

export default function PilotWorkspace() {
  const [snapshot, setSnapshot] = useState<Bootstrap | null>(null);
  const [qualification, setQualification] = useState<QualificationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<View>('overview');
  const [site, setSite] = useState('all');
  const [worklist, setWorklist] = useState<Worklist>('all');
  const [search, setSearch] = useState('');
  const [urlReady, setUrlReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showWorker, setShowWorker] = useState(false);
  const [showSite, setShowSite] = useState(false);
  const [siteDraft, setSiteDraft] = useState<Site | null>(null);
  const [releaseAction, setReleaseAction] = useState<{ action: 'approve' | 'revoke'; courseId: string; version: string; title: string } | null>(null);
  const [workerDraft, setWorkerDraft] = useState<Worker | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentDetail | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [workerDetail, setWorkerDetail] = useState<WorkerDetail | null>(null);
  const [action, setAction] = useState<AssignmentAction | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await requestJson<Bootstrap>('/api/admin/bootstrap');
      setSnapshot(result);
      setSite((current) => current === 'all' || result.sites.some((item) => item.id === current) ? current : 'all');
      setError('');
      const qualificationResult = await requestJson<QualificationSnapshot>('/api/qualifications').catch(() => null);
      setQualification(qualificationResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Live records could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    const restore = () => {
      const query = readLocation();
      setView(query.view); setSite(query.site); setWorklist(query.worklist); setSearch(query.search);
      setUrlReady(true);
    };
    const timer = window.setTimeout(restore, 0);
    window.addEventListener('popstate', restore);
    return () => { window.clearTimeout(timer); window.removeEventListener('popstate', restore); };
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    for (const key of ['view', 'site', 'worklist', 'q']) url.searchParams.delete(key);
    if (view !== 'overview') url.searchParams.set('view', view);
    if (site !== 'all' && view !== 'courses') url.searchParams.set('site', site);
    if (view === 'assignments' && worklist !== 'all') url.searchParams.set('worklist', worklist);
    if (search && (view === 'assignments' || view === 'people')) url.searchParams.set('q', search);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [urlReady, view, site, worklist, search]);
  useEffect(() => {
    if (!assignmentId) return;
    void requestJson<AssignmentDetail>(`/api/admin/assignments/${encodeURIComponent(assignmentId)}`)
      .then(setAssignmentDetail).catch((caught) => setNotice(caught instanceof Error ? caught.message : 'Assignment details could not load.'));
  }, [assignmentId]);
  useEffect(() => {
    if (!workerId) return;
    void requestJson<WorkerDetail>(`/api/admin/workers/${encodeURIComponent(workerId)}`)
      .then(setWorkerDetail).catch((caught) => setNotice(caught instanceof Error ? caught.message : 'Worker history could not load.'));
  }, [workerId]);
  useEffect(() => {
    if (view !== 'audit' || !snapshot) return;
    const timer = window.setTimeout(() => {
      setAuditLoading(true);
      const scope = site === 'all' ? '' : `?siteId=${encodeURIComponent(site)}`;
      void requestJson<{ events: Audit[] }>(`/api/admin/audit${scope}`)
        .then((result) => setAudit(result.events))
        .catch((caught) => setNotice(caught instanceof Error ? caught.message : 'Audit history could not load.'))
        .finally(() => setAuditLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [view, site, snapshot]);

  const visibleSites = useMemo(() => snapshot?.sites ?? [], [snapshot]);
  const scope = site === 'all' || !visibleSites.some((item) => item.id === site) ? 'all' : site;
  const scopedWorkers = (snapshot?.workers ?? []).filter((item) => scope === 'all' || item.site_id === scope);
  const scopedAssignments = (snapshot?.assignments ?? []).filter((item) => scope === 'all' || item.site_id === scope);
  const today = snapshot ? todayFrom(snapshot.asOf) : '';
  const soon = today ? dueSoonEnd(today) : '';
  const overdue = scopedAssignments.filter((item) => isOpen(item) && item.due_date < today);
  const dueSoon = scopedAssignments.filter((item) => isOpen(item) && item.due_date >= today && item.due_date <= soon);
  const failed = scopedAssignments.filter((item) => isOpen(item) &&
    (item.delivery_state === 'failed' || item.delivery_state === 'configuration_required'));
  const activeAssignments = scopedAssignments.filter((item) => item.status !== 'Cancelled');
  const complete = activeAssignments.filter((item) => item.status === 'Knowledge Complete').length;
  const completionPercent = activeAssignments.length ? Math.round(complete * 100 / activeAssignments.length) : 0;
  const canManage = snapshot?.actor.role === 'admin' || snapshot?.actor.role === 'site_manager';
  const canAddSite = snapshot?.actor.role === 'admin';
  const releaseByKey = new Map((snapshot?.releases ?? []).map((item) => [`${item.course_id}@${item.version}`, item]));
  const workerById = new Map((snapshot?.workers ?? []).map((item) => [item.id, item]));
  const siteById = new Map(visibleSites.map((item) => [item.id, item]));
  const courseTitle = (courseId: string, version: string) => releaseByKey.get(`${courseId}@${version}`)?.title ?? courseId;
  const matchingAssignments = scopedAssignments.filter((item) => {
    const worker = workerById.get(item.worker_id);
    const text = `${worker?.name ?? ''} ${courseTitle(item.course_id, item.course_version)} ${item.reason}`.toLowerCase();
    const matchesWorklist = worklist === 'all' ||
      (worklist === 'overdue' && overdue.some((row) => row.id === item.id)) ||
      (worklist === 'due_soon' && dueSoon.some((row) => row.id === item.id)) ||
      (worklist === 'failed_delivery' && failed.some((row) => row.id === item.id)) ||
      (worklist === 'open' && isOpen(item)) ||
      (worklist === 'complete' && item.status === 'Knowledge Complete');
    return matchesWorklist && text.includes(search.toLowerCase());
  });
  const matchingWorkers = scopedWorkers.filter((item) =>
    `${item.name} ${item.email} ${item.group_name}`.toLowerCase().includes(search.toLowerCase()));
  const queueSnapshot = qualification && scope !== 'all'
    ? { ...qualification, workers: qualification.workers.filter((item) => item.siteId === scope) }
    : qualification;
  const qualificationCounts = queueSnapshot ? {
    unassigned: queueRows(queueSnapshot, 'unassigned').length,
    evaluation: queueRows(queueSnapshot, 'evaluation').length,
    expiring: queueRows(queueSnapshot, 'expiring').length,
  } : null;

  function navigate(next: View, nextWorklist: Worklist = 'all') {
    setView(next); setWorklist(nextWorklist); setSearch(''); setMobileNav(false);
    if (next === 'courses') setSite('all');
  }
  async function mutate<T>(url: string, method: 'POST' | 'PATCH', body: unknown, success: (result: T) => string) {
    setSaving(true); setError('');
    try {
      const result = await requestJson<T>(url, jsonRequest(method, body));
      setNotice(success(result));
      await refresh();
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.');
      return null;
    } finally { setSaving(false); }
  }
  async function sendReminder() {
    if (!assignmentId) return;
    const result = await mutate<{ queued: boolean; reason?: string }>(
      `/api/admin/assignments/${encodeURIComponent(assignmentId)}`, 'PATCH',
      { operation: 'send_reminder' },
      (value) => value.queued ? 'Reminder queued. Delivery requires a configured provider and scheduled job.' : value.reason ?? 'Reminder was already queued today.',
    );
    if (result) setAssignmentDetail(await requestJson<AssignmentDetail>(`/api/admin/assignments/${encodeURIComponent(assignmentId)}`));
  }

  return <div className="pilot-shell">
    <a className="pilot-skip" href="#pilot-main">Skip to content</a>
    <aside className={`pilot-sidebar ${mobileNav ? 'open' : ''}`} aria-label="Admin navigation">
      <div className="pilot-brand"><span><ShieldCheck size={23} /></span><strong>HSE Informer<small>PILOT ADMIN</small></strong></div>
      <nav aria-label="Workspace">
        {([
          ['overview', ClipboardCheck], ['assignments', ClipboardList], ['people', Users],
          ['sites', Building2], ['courses', BookOpen], ['audit', FileClock],
        ] as const).map(([key, Icon]) =>
          <button key={key} type="button" className={view === key ? 'active' : ''}
            aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>
            <Icon size={18} /> {viewLabels[key]}
          </button>)}
        <Link href="/qualifications" onClick={() => setMobileNav(false)}><ShieldCheck size={18} /> Qualifications</Link>
      </nav>
      <div className="pilot-sidebar-foot"><span className="pilot-live-dot" /> Shared records<br /><small>{snapshot?.actor.email ?? 'Account required'}</small></div>
    </aside>
    <div className="pilot-body">
      <header className="pilot-topbar">
        <button type="button" className="pilot-menu" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close navigation' : 'Open navigation'}>{mobileNav ? <X size={20} /> : <span>☰</span>}</button>
        <span>Administration <span aria-hidden="true">/</span> <strong>{viewLabels[view]}</strong></span>
        <div className="pilot-top-actions">
          {view === 'courses' ? <span>Shared release catalog</span> : <><label htmlFor="pilot-scope">Site scope</label>
            <select id="pilot-scope" value={scope} onChange={(event) => setSite(event.target.value)} disabled={!snapshot}>
              <option value="all">All permitted sites</option>
              {visibleSites.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inactive)'}</option>)}
            </select></>}
          <button type="button" title="Refresh live records" aria-label="Refresh live records" onClick={() => void refresh()} disabled={loading}><RefreshCw size={17} /></button>
        </div>
      </header>
      <main id="pilot-main" className="pilot-main">
        <div className="pilot-heading">
          <div><span className="pilot-eyebrow">LIVE ADMINISTRATION</span><h1>{viewLabels[view]}</h1>
            <p>{view === 'overview' ? 'Your next training actions, backed by shared records.' :
              view === 'assignments' ? 'Deliver, monitor, and correct training assignments.' :
              view === 'people' ? 'Manage the worker roster and review individual history.' :
              view === 'sites' ? 'Review the locations within your access scope.' :
              view === 'courses' ? 'Only approved, deliverable versions can be assigned.' :
              'See who changed records, when, and why.'}</p></div>
          {canManage && (view === 'overview' || view === 'assignments') &&
            <button type="button" className="pilot-primary" onClick={() => setShowAssign(true)}><Plus size={17} /> New assignment</button>}
          {canManage && view === 'people' &&
            <button type="button" className="pilot-primary" onClick={() => { setWorkerDraft(null); setShowWorker(true); }}><Plus size={17} /> Add worker</button>}
          {canAddSite && view === 'sites' &&
            <button type="button" className="pilot-primary" onClick={() => { setSiteDraft(null); setShowSite(true); }}><Plus size={17} /> Add site</button>}
          {view === 'courses' && <button type="button" className="pilot-primary" onClick={() => navigate('assignments')}><ClipboardList size={17} /> View assignments</button>}
        </div>
        <div className="pilot-context"><span><span className="pilot-live-dot" /> {snapshot ? view === 'courses' ? 'Shared release catalog · All permitted sites' : `${scope === 'all' ? 'All permitted sites' : siteById.get(scope)?.name} · ${visibleSites.length} site${visibleSites.length === 1 ? '' : 's'} permitted` : 'Live service'}</span><span>{snapshot ? `As of ${formatDate(snapshot.asOf, true)} UTC` : 'Awaiting live records'}</span></div>
        {notice && <output className="pilot-notice">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16} /></button></output>}
        {error && <div className="pilot-error" role="alert"><AlertCircle size={18} /> {error}</div>}
        {!snapshot && <section className="pilot-panel pilot-state"><h2>{loading ? 'Loading live records…' : 'Live administration unavailable'}</h2><p>{loading ? 'Connecting to the shared workspace.' : 'Sign in through Cloudflare Access and confirm the database, account, and site grants are configured.'}</p><button type="button" onClick={() => void refresh()} disabled={loading}>Try again</button></section>}
        {snapshot && view === 'overview' && <>
          <div className="pilot-metrics">
            <button type="button" onClick={() => navigate('assignments', 'all')}><span>Active assignments <ClipboardList size={18} /></span><strong>{activeAssignments.length}</strong><small>{scopedWorkers.filter((item) => item.active).length} active workers in scope</small></button>
            <button type="button" onClick={() => navigate('assignments', 'complete')}><span>Knowledge completion <CheckCircle2 size={18} /></span><strong>{completionPercent}%</strong><small>{complete} of {activeAssignments.length} assignments complete</small></button>
            <button type="button" onClick={() => navigate('assignments', 'overdue')} disabled={overdue.length === 0}><span>Overdue <Clock3 size={18} /></span><strong>{overdue.length}</strong><small>Open assignments past due</small></button>
            <button type="button" onClick={() => navigate('assignments', 'due_soon')} disabled={dueSoon.length === 0}><span>Due in 30 days <CalendarDays size={18} /></span><strong>{dueSoon.length}</strong><small>Open assignments coming due</small></button>
          </div>
          <section className="pilot-panel"><div className="pilot-panel-heading"><div><h2>Needs attention</h2><p>Each count opens the matching records.</p></div></div>
            <div className="pilot-worklist-grid">
              <button type="button" onClick={() => navigate('assignments', 'failed_delivery')} disabled={failed.length === 0}><AlertCircle size={20} /><span><strong>{failed.length} deliveries need action</strong><small>Failed or provider not configured</small></span><ArrowRight size={16} /></button>
              <Link href={`/qualifications?queue=unassigned${scope === 'all' ? '' : `&site=${encodeURIComponent(scope)}`}`}><Users size={20} /><span><strong>{qualificationCounts?.unassigned ?? '—'} unassigned eligible</strong><small>Workers with configured requirements</small></span><ArrowRight size={16} /></Link>
              <Link href={`/qualifications?queue=evaluation${scope === 'all' ? '' : `&site=${encodeURIComponent(scope)}`}`}><ClipboardCheck size={20} /><span><strong>{qualificationCounts?.evaluation ?? '—'} pending evaluations</strong><small>Record practical evidence</small></span><ArrowRight size={16} /></Link>
              <Link href={`/qualifications?queue=expiring${scope === 'all' ? '' : `&site=${encodeURIComponent(scope)}`}`}><FileClock size={20} /><span><strong>{qualificationCounts?.expiring ?? '—'} expiring prerequisites</strong><small>Review the next 30 days</small></span><ArrowRight size={16} /></Link>
            </div>
            {!qualification && <p className="pilot-inline-note">Qualification counts are unavailable; open Qualifications to inspect that service.</p>}
          </section>
          <section className="pilot-panel"><div className="pilot-panel-heading"><div><h2>Recent assignments</h2><p>Current delivery and progress state</p></div><button type="button" className="pilot-text-action" onClick={() => navigate('assignments')}>All assignments <ArrowRight size={15} /></button></div>
            <AssignmentTable rows={scopedAssignments.slice(0, 8)} workerById={workerById} siteById={siteById} courseTitle={courseTitle} today={today} onOpen={setAssignmentId} />
          </section>
        </>}
        {snapshot && view === 'assignments' && <section className="pilot-panel">
          <div className="pilot-panel-heading"><div><h2>Assignment records <span>{matchingAssignments.length}</span></h2><p>{worklistLabels[worklist]} · {scope === 'all' ? 'All permitted sites' : siteById.get(scope)?.name}</p></div></div>
          <div className="pilot-toolbar"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search worker, course, or reason" aria-label="Search assignments" /></label>
            <select value={worklist} onChange={(event) => setWorklist(event.target.value as Worklist)} aria-label="Assignment worklist">{Object.entries(worklistLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            {(search || worklist !== 'all' || scope !== 'all') && <button type="button" onClick={() => { setSearch(''); setWorklist('all'); setSite('all'); }}>Clear filters</button>}</div>
          <AssignmentTable rows={matchingAssignments} workerById={workerById} siteById={siteById} courseTitle={courseTitle} today={today} onOpen={setAssignmentId} />
        </section>}
        {snapshot && view === 'people' && <section className="pilot-panel"><div className="pilot-panel-heading"><div><h2>Worker roster <span>{matchingWorkers.length}</span></h2><p>Only workers at your permitted sites appear here.</p></div></div>
          <div className="pilot-toolbar"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or role" aria-label="Search workers" /></label>{(search || scope !== 'all') && <button type="button" onClick={() => { setSearch(''); setSite('all'); }}>Clear filters</button>}</div>
          <div className="pilot-table-scroll"><table><thead><tr><th scope="col">Worker</th><th scope="col">Site / role</th><th scope="col">Assignments</th><th scope="col">State</th><th scope="col">Action</th></tr></thead><tbody>
            {matchingWorkers.map((worker) => <tr key={worker.id}><td><strong>{worker.name}</strong><small>{worker.email}</small></td><td>{siteById.get(worker.site_id)?.name}<small>{worker.group_name}</small></td><td>{scopedAssignments.filter((item) => item.worker_id === worker.id).length}</td><td>{worker.active ? 'Active' : 'Inactive'}</td><td><button type="button" className="pilot-text-action" onClick={() => setWorkerId(worker.id)}>View history <ArrowRight size={14} /></button></td></tr>)}
          </tbody></table>{matchingWorkers.length === 0 && <p className="pilot-empty">No workers match. Clear filters or add a worker.</p>}</div>
        </section>}
        {snapshot && view === 'sites' && <div className="pilot-sites">
          {visibleSites.filter((item) => scope === 'all' || item.id === scope).map((item) => {
            const workerCount = snapshot.workers.filter((worker) => worker.site_id === item.id && worker.active).length;
            const assignments = snapshot.assignments.filter((record) => record.site_id === item.id);
            const overdueCount = assignments.filter((record) => isOpen(record) && record.due_date < today).length;
            return <section className="pilot-panel pilot-site-card" key={item.id}><span className="pilot-site-code">{item.code}{item.active ? '' : ' · inactive'}</span><h2>{item.name}</h2><p>{item.location}</p><div><span><strong>{workerCount}</strong> active workers</span><span><strong>{assignments.length}</strong> assignments</span><span><strong>{overdueCount}</strong> overdue</span></div><footer><button type="button" onClick={() => { setSite(item.id); navigate('assignments'); }}>View assignments <ArrowRight size={15} /></button><Link href={`/qualifications?site=${encodeURIComponent(item.id)}`}>Site qualifications <ArrowRight size={15} /></Link>{canManage && <button type="button" onClick={() => { setSiteDraft(item); setShowSite(true); }}>Edit site</button>}</footer></section>;
          })}
          {visibleSites.length === 0 && <section className="pilot-panel pilot-state"><h2>No sites in scope</h2><p>Ask an organization administrator to provision a site or grant access.</p></section>}
        </div>}
        {snapshot && view === 'courses' && <section className="pilot-panel"><div className="pilot-panel-heading"><div><h2>Released course versions <span>{snapshot.releases.length}</span></h2><p>Assignments require approval, delivery readiness, and a course package in this build.</p></div></div>
          <div className="pilot-practice-note"><BookOpen size={19} /><span><strong>Practice package available: {pbjCourse.title}</strong><small>PBJ-101 is a fictional sandbox for validating delivery and completion. It is not HSE training or workplace authorization.</small></span>{canAddSite && <button type="button" onClick={() => setReleaseAction({ action: 'approve', courseId: pbjCourse.id, version: pbjCourse.version, title: pbjCourse.title })} disabled={snapshot.releases.some((item) => item.course_id === pbjCourse.id && item.version === pbjCourse.version && item.deliverable === 1)}>Approve practice</button>}</div>
          <div className="pilot-table-scroll"><table><thead><tr><th scope="col">Course</th><th scope="col">Version</th><th scope="col">Approval</th><th scope="col">Delivery</th><th scope="col">Action</th></tr></thead><tbody>{snapshot.releases.map((release) => <tr key={`${release.course_id}@${release.version}`}><td><strong>{release.title}</strong><small>{release.course_id === pbjCourse.id ? 'Practice only · not HSE training' : release.course_id}</small></td><td>{release.version}</td><td>{formatDate(release.approved_at)}</td><td>{release.deliverable ? 'Deliverable' : 'Not ready'}</td><td>{canAddSite ? release.deliverable ? <button type="button" className="pilot-text-action" onClick={() => setReleaseAction({ action: 'revoke', courseId: release.course_id, version: release.version, title: release.title })}>Revoke release</button> : <button type="button" className="pilot-text-action" onClick={() => setReleaseAction({ action: 'approve', courseId: release.course_id, version: release.version, title: release.title })}>Approve release</button> : '—'}</td></tr>)}</tbody></table>{snapshot.releases.length === 0 && <p className="pilot-empty">No approved releases yet. An organization administrator can approve the packaged practice course for workflow validation.</p>}</div>
        </section>}
        {snapshot && view === 'audit' && <section className="pilot-panel"><div className="pilot-panel-heading"><div><h2>Audit events <span>{audit.length}</span></h2><p>{scope === 'all' ? 'All permitted sites' : siteById.get(scope)?.name} · Latest 500 events</p></div></div>
          {auditLoading ? <p className="pilot-empty">Loading audit history…</p> : <div className="pilot-table-scroll"><table><thead><tr><th scope="col">When</th><th scope="col">Actor</th><th scope="col">Record / action</th><th scope="col">Reason</th><th scope="col">Changes</th></tr></thead><tbody>{audit.map((event) => <tr key={event.id}><td>{formatDate(event.created_at, true)}</td><td>{event.actor_email}</td><td>{event.entity_type} · {event.action}<small>{event.entity_id}</small></td><td>{event.reason ?? 'System event'}</td><td><AuditChange event={event} /></td></tr>)}</tbody></table>{audit.length === 0 && <p className="pilot-empty">No audit events in this scope.</p>}</div>}
        </section>}
      </main>
    </div>
    {snapshot && showAssign && <AssignDialog snapshot={snapshot} scope={scope} saving={saving} onClose={() => setShowAssign(false)}
      onSubmit={async (body) => {
        const result = await mutate<{ created: Assignment[]; skipped: { workerId: string; reason: string }[] }>('/api/admin/assignments', 'POST', body,
          (value) => `${value.created.length} assignment${value.created.length === 1 ? '' : 's'} created${value.skipped.length ? `; ${value.skipped.length} already open and skipped` : ''}. Delivery is queued.`);
        if (result) { setShowAssign(false); navigate('assignments'); }
      }} />}
    {snapshot && showWorker && <WorkerDialog snapshot={snapshot} draft={workerDraft} saving={saving} onClose={() => setShowWorker(false)}
      onSubmit={async (body) => {
        const result = await mutate<{ worker: Worker }>(workerDraft ? `/api/admin/workers/${encodeURIComponent(workerDraft.id)}` : '/api/admin/workers', workerDraft ? 'PATCH' : 'POST', body,
          () => workerDraft ? 'Worker record updated.' : 'Worker added to the roster.');
        if (result) setShowWorker(false);
      }} />}
    {snapshot && showSite && <SiteDialog draft={siteDraft} canDeactivate={canAddSite} saving={saving} onClose={() => setShowSite(false)} onSubmit={async (body) => {
      const result = await mutate<{ site: Site }>(siteDraft ? `/api/admin/sites/${encodeURIComponent(siteDraft.id)}` : '/api/admin/sites', siteDraft ? 'PATCH' : 'POST', body, () => siteDraft ? 'Site updated.' : 'Site added.');
      if (result) setShowSite(false);
    }} />}
    {releaseAction && <ReleaseDialog release={releaseAction} saving={saving} onClose={() => setReleaseAction(null)} onSubmit={async (reason) => {
      const result = await mutate<{ release: Release }>('/api/admin/releases', 'POST', { courseId: releaseAction.courseId, version: releaseAction.version, action: releaseAction.action, reason },
        () => releaseAction.action === 'approve' ? 'Release approved and audited.' : 'Release revoked and audited.');
      if (result) setReleaseAction(null);
    }} />}
    {snapshot && assignmentId && <DetailDialog title="Assignment details" onClose={() => { setAssignmentId(null); setAction(null); }}>
      {!assignmentDetail || assignmentDetail.assignment.id !== assignmentId ? <p>Loading assignment…</p> : <>
        <p className="pilot-detail-subtitle">{workerById.get(assignmentDetail.assignment.worker_id)?.name} · {courseTitle(assignmentDetail.assignment.course_id, assignmentDetail.assignment.course_version)}</p>
        <dl className="pilot-detail-grid">
          <div><dt>Course version</dt><dd>{assignmentDetail.assignment.course_version}</dd></div><div><dt>Status</dt><dd>{assignmentDetail.assignment.status}</dd></div>
          <div><dt>Due</dt><dd>{formatDate(assignmentDetail.assignment.due_date)}</dd></div><div><dt>Delivery</dt><dd>{assignmentDetail.assignment.delivery_state.replaceAll('_', ' ')}</dd></div>
          <div><dt>Assigned</dt><dd>{formatDate(assignmentDetail.assignment.assigned_at, true)}</dd></div><div><dt>Completed</dt><dd>{formatDate(assignmentDetail.assignment.completed_at, true)}</dd></div>
          <div><dt>Reason</dt><dd>{assignmentDetail.assignment.reason}</dd></div><div><dt>Cadence</dt><dd>{assignmentDetail.assignment.cadence}{assignmentDetail.assignment.recurrence_months ? ` · every ${assignmentDetail.assignment.recurrence_months} months` : ''}</dd></div>
        </dl>
        <p className="pilot-inline-note">Learner progress: {assignmentDetail.progress ? `revision ${assignmentDetail.progress.revision}, updated ${formatDate(assignmentDetail.progress.updated_at, true)}` : 'not started'}. Knowledge completion does not grant site authorization.</p>
        {assignmentDetail.assignment.delivery_state === 'configuration_required' && <p className="pilot-inline-note">Notification delivery requires a provider configuration and scheduled job. The learner can still access an authorized assignment directly.</p>}
        {canManage && isOpen(assignmentDetail.assignment) && <div className="pilot-detail-actions"><button type="button" onClick={() => setAction('change_due_date')}>Change due date</button><button type="button" onClick={() => setAction('reassign')}>Reassign</button><button type="button" onClick={() => void sendReminder()} disabled={saving}>Queue reminder</button><button type="button" className="danger" onClick={() => setAction('cancel')}>Cancel assignment</button></div>}
        {action && <ActionForm action={action} assignment={assignmentDetail.assignment} workers={snapshot.workers} sites={snapshot.sites} assignments={snapshot.assignments} today={today} saving={saving} onCancel={() => setAction(null)} onSubmit={async (body) => {
          const result = await mutate<{ assignment: Assignment; replacement?: Assignment }>(`/api/admin/assignments/${encodeURIComponent(assignmentId)}`, 'PATCH', { operation: action, ...body },
            (value) => action === 'reassign' ? `Assignment reassigned. Replacement record ${value.replacement?.id ?? ''} created.` : action === 'cancel' ? 'Assignment cancelled.' : 'Due date changed.');
          if (result) { setAction(null); setAssignmentId(null); setAssignmentDetail(null); }
        }} />}
        <h3>Record history</h3><div className="pilot-history">{assignmentDetail.audit.map((event) => <div key={event.id}><strong>{event.action.replaceAll('_', ' ')}</strong><span>{formatDate(event.created_at, true)} · {event.actor_email}</span><p>{event.reason ?? 'System recorded'}</p><AuditChange event={event} /></div>)}{assignmentDetail.audit.length === 0 && <p>No events recorded.</p>}</div>
      </>}
    </DetailDialog>}
    {snapshot && workerId && <DetailDialog title="Worker history" onClose={() => { setWorkerId(null); setWorkerDetail(null); }}>
      {!workerDetail || workerDetail.worker.id !== workerId ? <p>Loading worker history…</p> : <><p className="pilot-detail-subtitle">{workerDetail.worker.name} · {workerDetail.worker.email}</p><p>{siteById.get(workerDetail.worker.site_id)?.name} · {workerDetail.worker.group_name} · {workerDetail.worker.active ? 'Active' : 'Inactive'}</p>
        {canManage && <div className="pilot-detail-actions"><button type="button" onClick={() => { setWorkerDraft(workerDetail.worker); setWorkerId(null); setShowWorker(true); }}>Edit worker</button><Link href={`/qualifications?worker=${encodeURIComponent(workerDetail.worker.id)}`}>Qualification evidence <ArrowRight size={14} /></Link></div>}
        <h3>Assignments</h3><div className="pilot-history">{workerDetail.assignments.map((item) => <button type="button" key={item.id} onClick={() => { setWorkerId(null); setAssignmentId(item.id); }}><strong>{courseTitle(item.course_id, item.course_version)} · {item.course_version}</strong><span>{formatDate(item.assigned_at, true)} · {item.status}</span><p>{item.reason}</p></button>)}{workerDetail.assignments.length === 0 && <p>No assignment records.</p>}</div>
        <h3>Worker changes</h3><div className="pilot-history">{workerDetail.audit.map((item) => <div key={item.id}><strong>{item.action}</strong><span>{formatDate(item.created_at, true)} · {item.actor_email}</span><p>{item.reason ?? 'Record created'}</p></div>)}{workerDetail.audit.length === 0 && <p>No worker changes.</p>}</div>
      </>}
    </DetailDialog>}
  </div>;
}

function AssignmentTable({ rows, workerById, siteById, courseTitle, today, onOpen }: {
  rows: Assignment[]; workerById: Map<string, Worker>; siteById: Map<string, Site>;
  courseTitle: (id: string, version: string) => string; today: string; onOpen: (id: string) => void;
}) {
  return <><p className="pilot-scroll-hint">Swipe the table for progress, delivery, due date, and actions.</p><div className="pilot-table-scroll"><table><thead><tr><th scope="col">Worker / site</th><th scope="col">Course / reason</th><th scope="col">Progress</th><th scope="col">Delivery</th><th scope="col">Due</th><th scope="col">Action</th></tr></thead><tbody>
    {rows.map((item) => <tr key={item.id}><td><strong>{workerById.get(item.worker_id)?.name ?? 'Unknown worker'}</strong><small>{siteById.get(item.site_id)?.name ?? item.site_id}</small></td><td><strong>{courseTitle(item.course_id, item.course_version)}</strong><small>v{item.course_version} · {item.reason}</small></td><td><span className={`pilot-pill ${isOpen(item) && item.due_date < today ? 'warning' : ''}`}>{isOpen(item) && item.due_date < today ? 'Overdue' : item.status}</span></td><td>{item.delivery_state.replaceAll('_', ' ')}</td><td>{formatDate(item.due_date)}</td><td><button type="button" className="pilot-text-action" onClick={() => onOpen(item.id)}>View record <ArrowRight size={14} /></button></td></tr>)}
    </tbody></table>{rows.length === 0 && <p className="pilot-empty">No assignment records match this view.</p>}</div></>;
}

function DetailDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-label={title} className="pilot-modal pilot-detail" onCancel={onClose}><div className="pilot-modal-heading"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</dialog>;
}

function AuditChange({ event }: { event: Audit }) {
  if (!event.before_json && !event.after_json) return '—';
  return <details className="pilot-audit-change"><summary>View change</summary>{event.before_json && <><strong>Before</strong><pre>{event.before_json}</pre></>}{event.after_json && <><strong>After</strong><pre>{event.after_json}</pre></>}</details>;
}

function AssignDialog({ snapshot, scope, saving, onClose, onSubmit }: {
  snapshot: Bootstrap; scope: string; saving: boolean; onClose: () => void;
  onSubmit: (body: { workerIds: string[]; courseId: string; version: string; dueDate: string; reason: string; cadence: string; recurrenceMonths: number | null }) => Promise<void>;
}) {
  const ready = snapshot.releases.filter((item) => item.approved_at && item.deliverable);
  const [releaseKey, setReleaseKey] = useState(ready[0] ? `${ready[0].course_id}@${ready[0].version}` : '');
  const activeSites = snapshot.sites.filter((item) => item.active === 1);
  const [siteId, setSiteId] = useState(scope === 'all' || activeSites.some((item) => item.id === scope) ? scope : 'all');
  const [group, setGroup] = useState('all');
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [exceptionId, setExceptionId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [cadence, setCadence] = useState('One-time');
  const [recurrenceMonths, setRecurrenceMonths] = useState('12');
  const release = ready.find((item) => `${item.course_id}@${item.version}` === releaseKey);
  const groups = [...new Set(snapshot.workers.filter((item) => item.active && activeSites.some((site) => site.id === item.site_id)).map((item) => item.group_name))].sort();
  const eligibleForRelease = snapshot.workers.filter((item) => item.active && activeSites.some((site) => site.id === item.site_id) &&
    (!release || !snapshot.assignments.some((record) => record.worker_id === item.id && record.course_id === release.course_id && isOpen(record))));
  const eligible = eligibleForRelease.filter((item) =>
    (siteId === 'all' || item.site_id === siteId) &&
    (group === 'all' || item.group_name === group));
  const exceptions = eligibleForRelease.filter((item) =>
    !eligible.some((cohort) => cohort.id === item.id) && !workerIds.includes(item.id));
  const selected = workerIds.map((id) => eligibleForRelease.find((item) => item.id === id)).filter((item): item is Worker => !!item);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!release || workerIds.length === 0 || workerIds.length > 100) return;
    void onSubmit({ workerIds, courseId: release.course_id, version: release.version,
      dueDate, reason, cadence, recurrenceMonths: cadence === 'Recurring' ? Number(recurrenceMonths) : null });
  }
  return <DetailDialog title="New training assignment" onClose={onClose}><form className="pilot-form" onSubmit={submit}>
    {ready.length === 0 ? <p className="pilot-inline-note">No approved, deliverable course version is available. Release a recorded course package before assigning training.</p> : <>
      <label>Approved course version<select required value={releaseKey} onChange={(event) => { setReleaseKey(event.target.value); setWorkerIds([]); setExceptionId(''); }}>{ready.map((item) => <option key={`${item.course_id}@${item.version}`} value={`${item.course_id}@${item.version}`}>{item.title} · {item.version}{item.course_id === pbjCourse.id ? ' · practice only' : ''}</option>)}</select></label>
      {release?.course_id === pbjCourse.id && <p className="pilot-inline-note">This is a fictional practice course. Completing it is not HSE training or an employer authorization.</p>}
      <div className="pilot-form-row"><label>Site<select value={siteId} onChange={(event) => { setSiteId(event.target.value); setExceptionId(''); }}><option value="all">All active permitted sites</option>{activeSites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Role / group<select value={group} onChange={(event) => { setGroup(event.target.value); setExceptionId(''); }}><option value="all">All roles</option>{groups.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
      <fieldset className="pilot-picker-list"><legend>Cohort workers · {eligible.length}</legend><button type="button" onClick={() => setWorkerIds([...new Set([...workerIds, ...eligible.map((item) => item.id)])])}>Select all in cohort</button><button type="button" onClick={() => setWorkerIds([])}>Clear selection</button><div>{eligible.map((item) => <label key={item.id}><input type="checkbox" checked={workerIds.includes(item.id)} onChange={(event) => setWorkerIds(event.target.checked ? [...workerIds, item.id] : workerIds.filter((id) => id !== item.id))} /><span>{item.name}<small>{item.group_name} · {snapshot.sites.find((site) => site.id === item.site_id)?.name}</small></span></label>)}{eligible.length === 0 && <p>No eligible workers match, or each already has an open assignment for this course.</p>}</div></fieldset>
      <div className="pilot-exception"><label>Individual exception outside this cohort<select value={exceptionId} onChange={(event) => setExceptionId(event.target.value)}><option value="">Choose a worker</option>{exceptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.group_name} · {snapshot.sites.find((site) => site.id === item.site_id)?.name}</option>)}</select></label><button type="button" disabled={!exceptionId} onClick={() => { setWorkerIds([...workerIds, exceptionId]); setExceptionId(''); }}>Add individual</button></div>
      <div className="pilot-recipient-review"><h3>Recipient review · {selected.length}</h3><p>Only active workers at permitted sites without an open assignment for this course are shown.</p><ul>{selected.map((item) => <li key={item.id}><span>{item.name} · {item.group_name} · {snapshot.sites.find((site) => site.id === item.site_id)?.name}{eligible.some((cohort) => cohort.id === item.id) ? '' : ' · individual exception'}</span><button type="button" onClick={() => setWorkerIds(workerIds.filter((id) => id !== item.id))} aria-label={`Remove ${item.name}`}>Remove</button></li>)}</ul>{selected.length === 0 && <small>No recipients selected.</small>}</div>
      {workerIds.length > 100 && <p className="pilot-inline-note">Select at most 100 workers per assignment batch.</p>}
      <div className="pilot-form-row"><label>Due date<input type="date" required min={todayFrom(snapshot.asOf)} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Cadence<select value={cadence} onChange={(event) => setCadence(event.target.value)}><option>One-time</option><option>Recurring</option></select></label></div>
      {cadence === 'Recurring' && <label>Repeat after due date (months)<input type="number" min="1" max="120" required value={recurrenceMonths} onChange={(event) => setRecurrenceMonths(event.target.value)} /></label>}
      <label>Assignment reason<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this training assigned to these workers?" /></label>
      <p className="pilot-inline-note">Assignments enter the delivery queue. A scheduled job and notification provider must run for email delivery.</p>
    </>}
    <div className="pilot-form-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="pilot-primary" disabled={saving || !release || workerIds.length === 0 || workerIds.length > 100}>{saving ? 'Saving…' : `Create ${workerIds.length} assignment${workerIds.length === 1 ? '' : 's'}`}</button></div>
  </form></DetailDialog>;
}

function ActionForm({ action, assignment, workers, sites, assignments, today, saving, onCancel, onSubmit }: {
  action: AssignmentAction; assignment: Assignment; workers: Worker[]; sites: Site[]; assignments: Assignment[]; today: string; saving: boolean;
  onCancel: () => void; onSubmit: (body: { reason: string; dueDate?: string; workerId?: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState(assignment.due_date);
  const [workerId, setWorkerId] = useState('');
  const candidates = workers.filter((item) => item.active && sites.some((site) => site.id === item.site_id && site.active === 1) && item.id !== assignment.worker_id &&
    !assignments.some((record) => record.worker_id === item.id && record.course_id === assignment.course_id && isOpen(record)));
  return <form className="pilot-action-form" onSubmit={(event) => { event.preventDefault(); void onSubmit({ reason, ...(action === 'change_due_date' ? { dueDate } : {}), ...(action === 'reassign' ? { workerId } : {}) }); }}>
    <h3>{action === 'change_due_date' ? 'Change due date' : action === 'reassign' ? 'Reassign to a worker' : 'Cancel assignment'}</h3>
    {action === 'change_due_date' && <label>New due date<input type="date" required value={dueDate} min={today} onChange={(event) => setDueDate(event.target.value)} /></label>}
    {action === 'reassign' && <label>New worker<select required value={workerId} onChange={(event) => setWorkerId(event.target.value)}><option value="">Choose worker</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.group_name}</option>)}</select></label>}
    <label>Reason for change<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Document why this change is needed" /></label>
    <div className="pilot-form-actions"><button type="button" onClick={onCancel}>Back</button><button type="submit" className="pilot-primary" disabled={saving || (action === 'reassign' && !workerId)}>{saving ? 'Saving…' : 'Confirm change'}</button></div>
  </form>;
}

function WorkerDialog({ snapshot, draft, saving, onClose, onSubmit }: {
  snapshot: Bootstrap; draft: Worker | null; saving: boolean; onClose: () => void;
  onSubmit: (body: { name: string; email: string; siteId: string; group: string; active?: boolean; reason?: string }) => Promise<void>;
}) {
  const workerSites = snapshot.sites.filter((item) => item.active === 1 || item.id === draft?.site_id);
  const [name, setName] = useState(draft?.name ?? ''); const [email, setEmail] = useState(draft?.email ?? '');
  const [siteId, setSiteId] = useState(draft?.site_id ?? workerSites[0]?.id ?? '');
  const [group, setGroup] = useState(draft?.group_name ?? ''); const [active, setActive] = useState(draft?.active !== 0);
  const [reason, setReason] = useState('');
  return <DetailDialog title={draft ? 'Edit worker' : 'Add worker'} onClose={onClose}><form className="pilot-form" onSubmit={(event) => { event.preventDefault(); void onSubmit({ name, email, siteId, group, ...(draft ? { active, reason } : {}) }); }}>
    <label>Full name<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <div className="pilot-form-row"><label>Site<select required value={siteId} onChange={(event) => setSiteId(event.target.value)}>{workerSites.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inactive)'}</option>)}</select></label><label>Role / group<input required maxLength={200} value={group} onChange={(event) => setGroup(event.target.value)} /></label></div>
    {draft && <><label className="pilot-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active worker</label><label>Reason for change<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label></>}
    <div className="pilot-form-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="pilot-primary" disabled={saving || !siteId}>{saving ? 'Saving…' : draft ? 'Save worker' : 'Add worker'}</button></div>
  </form></DetailDialog>;
}

function SiteDialog({ draft, canDeactivate, saving, onClose, onSubmit }: {
  draft: Site | null; canDeactivate: boolean; saving: boolean; onClose: () => void;
  onSubmit: (body: { name: string; code: string; location: string; active?: boolean; reason?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(draft?.name ?? '');
  const [code, setCode] = useState(draft?.code ?? '');
  const [location, setLocation] = useState(draft?.location ?? '');
  const [active, setActive] = useState(draft?.active !== 0);
  const [reason, setReason] = useState('');
  return <DetailDialog title={draft ? 'Edit site profile' : 'Add site'} onClose={onClose}><form className="pilot-form" onSubmit={(event) => { event.preventDefault(); void onSubmit({ name, code, location, ...(draft ? { active, reason } : {}) }); }}>
    <label>Site name<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Site code<input required maxLength={20} value={code} onChange={(event) => setCode(event.target.value)} /></label>
    <label>Location<input required maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} /></label>
    {draft && <><label className="pilot-check"><input type="checkbox" checked={active} disabled={!canDeactivate} onChange={(event) => setActive(event.target.checked)} /> Active site</label><label>Reason for change<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label></>}
    <div className="pilot-form-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="pilot-primary" disabled={saving}>{saving ? 'Saving…' : draft ? 'Save site' : 'Add site'}</button></div>
  </form></DetailDialog>;
}

function ReleaseDialog({ release, saving, onClose, onSubmit }: {
  release: { action: 'approve' | 'revoke'; courseId: string; version: string; title: string };
  saving: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  return <DetailDialog title={`${release.action === 'approve' ? 'Approve' : 'Revoke'} course release`} onClose={onClose}>
    <p className="pilot-detail-subtitle">{release.title} · {release.version}</p>
    {release.courseId === pbjCourse.id && <p className="pilot-inline-note">This release is a fictional practice course only. It does not satisfy HSE training requirements.</p>}
    <form className="pilot-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(reason); }}>
      <label>Decision reason<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record the approval or revocation basis" /></label>
      <div className="pilot-form-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="pilot-primary" disabled={saving}>{saving ? 'Saving…' : release.action === 'approve' ? 'Approve release' : 'Revoke release'}</button></div>
    </form>
  </DetailDialog>;
}
