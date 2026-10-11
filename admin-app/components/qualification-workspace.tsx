'use client';

import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, ClipboardCheck, Download, RefreshCw,
  Search, ShieldCheck, Users, Building2,
} from 'lucide-react';
import { courses } from '@/lib/training';
import {
  latestEvents, qualificationReadiness, queueLabels, queueRows,
  type QualificationQueue, type QualificationSnapshot,
  type QualificationStep, type QualificationOutcome,
  type QualificationWorker, type SiteRoleRequirement,
} from '@/lib/qualification';
import './qualification-workspace.css';

type LoadedSnapshot = QualificationSnapshot & {
  role: 'admin' | 'site_manager' | 'evaluator' | 'auditor';
};
type AuditEntry = {
  id: string; entity_type: string; action: string; actor_email: string;
  reason: string | null; created_at: string;
};
type RuleForm = {
  siteId: string; groupName: string; courseId: string; courseVersion: string;
  localInstructionRequired: boolean; prerequisiteRequired: boolean;
  practicalEvaluationRequired: boolean; authorizationRequired: boolean;
  expectedUpdatedAt: string; reason: string;
};

const stepLabels: Record<QualificationStep, string> = {
  local_instruction: 'Site instruction',
  prerequisite: 'External prerequisite',
  practical_evaluation: 'Practical evaluation',
  authorization: 'Employer authorization',
};

const defaultRule = (siteId: string): RuleForm => ({
  siteId, groupName: '', courseId: '', courseVersion: '',
  localInstructionRequired: false, prerequisiteRequired: false,
  practicalEvaluationRequired: false, authorizationRequired: false,
  expectedUpdatedAt: '', reason: '',
});

function format(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
    .toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      ...(value.length === 10 ? {} : { hour: 'numeric', minute: '2-digit' }),
      timeZone: 'UTC',
    });
}

function courseName(courseId: string) {
  return courses.find((course) => course.id === courseId)?.name ?? courseId;
}

function requestError(value: unknown, fallback: string) {
  return value && typeof value === 'object' && 'error' in value &&
    typeof value.error === 'string' ? value.error : fallback;
}

export default function QualificationWorkspace() {
  const [snapshot, setSnapshot] = useState<LoadedSnapshot | null>(null);
  const [site, setSite] = useState('all');
  const [queue, setQueue] = useState<QualificationQueue>('all');
  const [workerId, setWorkerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [urlReady, setUrlReady] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleForm>(defaultRule(''));
  const [savingRule, setSavingRule] = useState(false);
  const [step, setStep] = useState<QualificationStep>('local_instruction');
  const [outcome, setOutcome] = useState<QualificationOutcome>('satisfied');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [referenceVersion, setReferenceVersion] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scope, setScope] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [reason, setReason] = useState('');
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyError, setHistoryError] = useState('');
  const ruleDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ruleDialog.current;
    if (!dialog) return;
    if (ruleOpen && !dialog.open) dialog.showModal();
    if (!ruleOpen && dialog.open) dialog.close();
  }, [ruleOpen]);

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      const nextQueue = params.get('queue');
      setSite(params.get('site') || 'all');
      setQueue(nextQueue && nextQueue in queueLabels ? nextQueue as QualificationQueue : 'all');
      setWorkerId(params.get('worker') || '');
      setCourseId(params.get('course') || '');
      setUrlReady(true);
    });
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries({ site, queue, worker: workerId, course: courseId })) {
      if (value && value !== 'all') params.set(key, value);
      else params.delete(key);
    }
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, [site, queue, workerId, courseId, urlReady]);

  useEffect(() => {
    if (!urlReady) return;
    const controller = new AbortController();
    fetch(`/api/qualifications?site=${encodeURIComponent(site)}`, {
      signal: controller.signal, cache: 'no-store',
    }).then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(requestError(data, 'Could not load qualification records.'));
      return data as LoadedSnapshot;
    }).then((data) => {
      setSnapshot(data);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load qualification records.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [site, refreshKey, urlReady]);

  useEffect(() => {
    if (!urlReady || !workerId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setHistoryError(''); });
    fetch(`/api/qualifications/history?worker=${encodeURIComponent(workerId)}`, {
      signal: controller.signal, cache: 'no-store',
    }).then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(requestError(data, 'Could not load worker history.'));
      return data as { audit: AuditEntry[] };
    }).then((data) => setHistory(data.audit))
      .catch(() => { if (!controller.signal.aborted) { setHistory([]); setHistoryError('Audit history could not be loaded. Refresh and try again.'); } });
    return () => controller.abort();
  }, [workerId, refreshKey, urlReady]);

  const workers = snapshot?.workers ?? [];
  const requirements = snapshot?.requirements ?? [];
  const selectedWorker = workers.find((person) => person.id === workerId);
  const workerRequirements = selectedWorker
    ? requirements.filter((item) =>
      item.siteId === selectedWorker.siteId && item.groupName === selectedWorker.groupName,
    ) : [];
  const selectedRequirement = workerRequirements.find((item) => item.courseId === courseId)
    ?? workerRequirements[0];
  const current = useMemo(() => latestEvents(snapshot?.events ?? []), [snapshot]);
  const readiness = selectedWorker && selectedRequirement && snapshot
    ? qualificationReadiness(
      selectedWorker, selectedRequirement, snapshot.assignments, snapshot.events,
      snapshot.asOf.slice(0, 10),
    ) : null;
  const currentStep = selectedWorker && selectedRequirement
    ? current.get(`${selectedWorker.id}:${selectedWorker.siteId}:${selectedRequirement.courseId}:${step}`)
    : undefined;
  const visibleWorkers = workers.filter((person) =>
    `${person.name} ${person.email} ${person.groupName}`.toLowerCase().includes(search.toLowerCase()),
  );
  const queues = useMemo(() => {
    if (!snapshot) return null;
    return Object.fromEntries(
      (Object.keys(queueLabels) as QualificationQueue[]).map((key) => [key, queueRows(snapshot, key)]),
    ) as Record<QualificationQueue, ReturnType<typeof queueRows>>;
  }, [snapshot]);
  const rows = queues?.[queue] ?? [];
  const canManage = snapshot?.role === 'admin' || snapshot?.role === 'site_manager';
  const canEvaluate = canManage || snapshot?.role === 'evaluator';
  const canExport = snapshot?.role !== 'evaluator';
  const groups = [...new Set(workers.map((person) => person.groupName))].sort();
  const hseReleases = snapshot?.releases.filter((release) =>
    courses.some((course) => course.id === release.courseId),
  ) ?? [];

  function selectWorker(person: QualificationWorker, requirement?: SiteRoleRequirement) {
    setWorkerId(person.id);
    setCourseId(requirement?.courseId ?? '');
    setHistory([]);
    setHistoryError('');
    setNotice('');
  }

  function editRule(item?: SiteRoleRequirement) {
    setRuleForm(item ? {
      ...item, expectedUpdatedAt: item.updatedAt, reason: '',
    } : defaultRule(site === 'all' ? snapshot?.sites[0]?.id ?? '' : site));
    setRuleOpen(true);
    setNotice('');
  }

  async function submitRule(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingRule(true);
    setError('');
    try {
      const response = await fetch('/api/qualifications/requirements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(requestError(data, 'Could not save requirement.'));
      setRuleOpen(false);
      setNotice('Site and role requirement saved with an audit entry.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save requirement.');
    } finally { setSavingRule(false); }
  }

  async function submitEvidence(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorker || !selectedRequirement) return;
    setSavingEvidence(true);
    setError('');
    try {
      const response = await fetch('/api/qualifications/evidence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: selectedWorker.id, siteId: selectedWorker.siteId,
          courseId: selectedRequirement.courseId, step, outcome, evidenceRef,
          referenceVersion, expiresAt: expiresAt || null, scope, restrictions,
          reason, expectedEventId: currentStep?.id ?? null,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(requestError(data, 'Could not record evidence.'));
      setNotice(`${stepLabels[step]} record added to ${selectedWorker.name}'s history.`);
      setEvidenceRef(''); setReferenceVersion(''); setExpiresAt('');
      setScope(''); setRestrictions(''); setReason('');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record evidence.');
    } finally { setSavingEvidence(false); }
  }

  return (
    <div className="qualification-shell">
      <a className="skip-link" href="#qualification-main">Skip to content</a>
      <header className="qualification-topbar">
        <Link href="/" className="qualification-brand"><ShieldCheck size={24} /> HSE <strong>Informer</strong></Link>
        <Link href="/" className="qualification-back"><ArrowLeft size={16} /> Admin workspace</Link>
      </header>
      <main id="qualification-main" className="qualification-main">
        <div className="qualification-heading">
          <div>
            <span className="qualification-eyebrow">PEOPLE &amp; QUALIFICATIONS</span>
            <h1>Worker readiness and evidence</h1>
            <p>Track knowledge, local instruction, prerequisites, practical evaluation, and employer authorization separately.</p>
          </div>
          <div className="qualification-heading-actions">
            <label htmlFor="qualification-site">Site scope</label>
            <select id="qualification-site" value={site} onChange={(event) => { setLoading(true); setError(''); setSite(event.target.value); setWorkerId(''); setCourseId(''); setHistory([]); }}>
              <option value="all">All permitted sites</option>
              {snapshot?.sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="button" className="qualification-icon-button" onClick={() => { setLoading(true); setError(''); setRefreshKey((value) => value + 1); }} aria-label="Refresh records" title="Refresh records"><RefreshCw size={17} /></button>
            {snapshot && canExport && <a className="qualification-export" href={`/api/reports/evidence?site=${encodeURIComponent(site)}${workerId ? `&worker=${encodeURIComponent(workerId)}` : ''}`}><Download size={16} /> Export evidence</a>}
          </div>
        </div>
        <output className="qualification-asof">{loading ? 'Loading current records…' : snapshot ? `Data as of ${format(snapshot.asOf)} UTC · ${snapshot.sites.length} site${snapshot.sites.length === 1 ? '' : 's'} in scope` : 'Live records unavailable'}</output>
        {error && <div className="qualification-alert" role="alert">{error}</div>}
        {notice && <output className="qualification-success">{notice}</output>}
        {!snapshot && !loading && <section className="qualification-empty"><h2>Qualification records are unavailable</h2><p>{error || 'The shared database and administrator identity must be configured before this workspace can be used.'}</p></section>}
        {snapshot && <>
          <section aria-labelledby="attention-title">
            <div className="qualification-section-heading"><h2 id="attention-title">Needs attention</h2><span>Counts are worker–course obligations</span></div>
            <div className="qualification-metrics">
              {(['unassigned', 'overdue', 'site_instruction', 'evaluation', 'expiring', 'failed_delivery'] as QualificationQueue[]).map((key) => (
                <button type="button" key={key} className={`qualification-metric ${queue === key ? 'selected' : ''}`} onClick={() => setQueue(key)} aria-pressed={queue === key}>
                  <span>{queueLabels[key]}</span><strong>{queues?.[key].length ?? 0}</strong><small>View records <ArrowRight size={13} /></small>
                </button>
              ))}
            </div>
          </section>
          <div className="qualification-columns">
            <section className="qualification-panel" aria-labelledby="worklist-title">
              <div className="qualification-panel-heading"><div><span className="qualification-icon"><ClipboardCheck size={18} /></span><h2 id="worklist-title">{queueLabels[queue]}</h2></div><button type="button" onClick={() => setQueue('all')}>Show all</button></div>
              <p className="qualification-panel-subtitle">{rows.length} record{rows.length === 1 ? '' : 's'} · {site === 'all' ? 'All permitted sites' : snapshot.sites.find((item) => item.id === site)?.name}</p>
              <div className="qualification-table-scroll"><table><thead><tr><th scope="col">Worker</th><th scope="col">Site / role</th><th scope="col">Course</th><th scope="col">Next step</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>
                {rows.map((row) => <tr key={`${row.worker.id}-${row.requirement.id}`}><td><strong>{row.worker.name}</strong></td><td>{snapshot.sites.find((item) => item.id === row.worker.siteId)?.name}<small>{row.worker.groupName}</small></td><td>{courseName(row.requirement.courseId)}</td><td>{row.flags.failed_delivery ? 'Delivery needs attention' : row.flags.overdue ? 'Overdue knowledge work' : row.flags.unassigned ? 'Needs assignment' : row.readiness.authorized ? 'Authorized' : row.readiness.missing[0] ?? (row.requirement.authorizationRequired ? 'Employer authorization' : 'Evidence current')}</td><td><button type="button" onClick={() => selectWorker(row.worker, row.requirement)}>Review</button></td></tr>)}
              </tbody></table>{rows.length === 0 && <p className="qualification-table-empty">No records match this worklist. Check another queue or review site requirements.</p>}</div>
            </section>
            <section className="qualification-panel" aria-labelledby="people-title">
              <div className="qualification-panel-heading"><div><span className="qualification-icon"><Users size={18} /></span><h2 id="people-title">Worker roster</h2></div><span>{workers.length} workers</span></div>
              <label className="qualification-search"><Search size={17} /><span className="sr-only">Search workers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or role" /></label>
              <div className="qualification-roster">{visibleWorkers.map((person) => <button type="button" key={person.id} className={workerId === person.id ? 'selected' : ''} onClick={() => selectWorker(person)}><span><strong>{person.name}</strong><small>{person.groupName} · {snapshot.sites.find((item) => item.id === person.siteId)?.name}</small></span><span className={person.active ? 'qualification-active' : 'qualification-inactive'}>{person.active ? 'Active' : 'Inactive'}</span></button>)}{visibleWorkers.length === 0 && <p className="qualification-table-empty">No workers match this search.</p>}</div>
            </section>
          </div>
          <section className="qualification-panel qualification-sites" aria-labelledby="sites-title">
            <div className="qualification-panel-heading"><div><span className="qualification-icon"><Building2 size={18} /></span><h2 id="sites-title">Site profiles and role requirements</h2></div>{canManage && <button type="button" disabled={!hseReleases.length} onClick={() => editRule()}>Add requirement</button>}</div>
            {canManage && hseReleases.length === 0 && <p className="qualification-panel-subtitle">An approved, deliverable HSE course version is required before a site rule can be configured.</p>}
            <div className="qualification-site-grid">{snapshot.sites.map((item) => <article key={item.id}><h3>{item.name}</h3><p>{item.location} · {item.code}</p><small>{workers.filter((person) => person.siteId === item.id).length} workers · {requirements.filter((rule) => rule.siteId === item.id).length} role requirements</small><button type="button" onClick={() => { setLoading(true); setError(''); setSite(item.id); setQueue('all'); setWorkerId(''); setHistory([]); }}>View site <ArrowRight size={14} /></button></article>)}</div>
            <div className="qualification-rule-list">{requirements.map((item) => <div key={item.id}><span><strong>{item.groupName}</strong> · {courseName(item.courseId)} · version {item.courseVersion}<small>{[
              item.localInstructionRequired && 'Site instruction', item.prerequisiteRequired && 'Prerequisite',
              item.practicalEvaluationRequired && 'Practical evaluation', item.authorizationRequired && 'Authorization',
            ].filter(Boolean).join(' · ') || 'Knowledge only'}</small></span>{canManage && <button type="button" onClick={() => editRule(item)}>Edit requirement</button>}</div>)}{requirements.length === 0 && <p>No role requirements are configured in this scope. Configure applicability before using readiness counts.</p>}</div>
          </section>
          {selectedWorker && <section className="qualification-panel qualification-detail" aria-labelledby="worker-detail-title">
            <div className="qualification-panel-heading"><div><span className="qualification-icon"><Users size={18} /></span><h2 id="worker-detail-title">{selectedWorker.name}</h2></div><button type="button" onClick={() => { setWorkerId(''); setCourseId(''); }}>Close</button></div>
            <p className="qualification-panel-subtitle">{selectedWorker.email} · {selectedWorker.groupName} · {snapshot.sites.find((item) => item.id === selectedWorker.siteId)?.name}</p>
            {workerRequirements.length === 0 ? <p className="qualification-table-empty">No site and role requirements are configured for this worker. Their assignment history remains below.</p> : <>
              <fieldset className="qualification-course-tabs" aria-label="Required courses">{workerRequirements.map((item) => <button type="button" key={item.id} aria-pressed={selectedRequirement?.id === item.id} className={selectedRequirement?.id === item.id ? 'selected' : ''} onClick={() => setCourseId(item.courseId)}>{courseName(item.courseId)}</button>)}</fieldset>
              {selectedRequirement && readiness && <div className="qualification-readiness"><h3>{courseName(selectedRequirement.courseId)} · version {selectedRequirement.courseVersion}</h3><span className={readiness.authorized ? 'ready' : 'blocked'}>{readiness.authorized ? 'Authorized for recorded scope' : `Blocked · ${readiness.missing.join(', ') || 'Employer authorization pending'}`}</span><div className="qualification-step-grid">{(['local_instruction', 'prerequisite', 'practical_evaluation', 'authorization'] as QualificationStep[]).map((item) => { const latest = current.get(`${selectedWorker.id}:${selectedWorker.siteId}:${selectedRequirement.courseId}:${item}`); const required = item === 'local_instruction' ? selectedRequirement.localInstructionRequired : item === 'prerequisite' ? selectedRequirement.prerequisiteRequired : item === 'practical_evaluation' ? selectedRequirement.practicalEvaluationRequired : selectedRequirement.authorizationRequired; return <div key={item}><strong>{stepLabels[item]}</strong><small>{required ? (latest ? `${latest.outcome.replace('_', ' ')} · ${format(latest.createdAt)}` : 'Required · no evidence') : 'Not required by this site rule'}</small>{latest?.expiresAt && <small>Expires {format(latest.expiresAt)}</small>}</div>; })}</div></div>}
            </>}
            {selectedRequirement && canEvaluate && <form className="qualification-evidence-form" onSubmit={submitEvidence}><h3>Record qualification evidence</h3><p>Use a record ID or approved document reference. Do not enter medical questionnaire responses or sensitive clinical details. External prerequisites keep their own reference version and expiry when the course version changes.</p><div className="qualification-form-grid"><label>Step<select value={step} onChange={(event) => setStep(event.target.value as QualificationStep)}>{(Object.keys(stepLabels) as QualificationStep[]).filter((item) => item !== 'authorization' || canManage).map((item) => <option value={item} key={item}>{stepLabels[item]}</option>)}</select></label><label>Result<select value={outcome} onChange={(event) => setOutcome(event.target.value as QualificationOutcome)}><option value="satisfied">Satisfied</option><option value="not_satisfied">Not satisfied</option><option value="revoked">Revoked</option></select></label><label>Evidence reference<input required={outcome === 'satisfied'} maxLength={500} value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} placeholder="Record ID or document reference" /></label><label>Procedure / reference version<input maxLength={120} value={referenceVersion} onChange={(event) => setReferenceVersion(event.target.value)} placeholder="Optional version" /></label><label>Expires on<input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>{step === 'authorization' && <><label>Authorized task / equipment scope<input required={outcome === 'satisfied'} maxLength={500} value={scope} onChange={(event) => setScope(event.target.value)} /></label><label>Restrictions<input maxLength={500} value={restrictions} onChange={(event) => setRestrictions(event.target.value)} /></label></>}</div><label>Reason for this record or correction<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What was verified or changed?" /></label>{step === 'authorization' && outcome === 'satisfied' && readiness?.missing.length ? <p className="qualification-form-warning">Authorization is blocked until {readiness.missing.join(', ')} is complete.</p> : null}<button type="submit" disabled={savingEvidence || (step === 'authorization' && outcome === 'satisfied' && !!readiness?.missing.length)}>{savingEvidence ? 'Recording…' : currentStep ? 'Record correction' : 'Record evidence'}</button></form>}
            <div className="qualification-history"><h3>Worker history</h3>{historyError && <p className="qualification-alert" role="alert">{historyError}</p>}<div className="qualification-table-scroll"><table><thead><tr><th scope="col">When</th><th scope="col">Record</th><th scope="col">Course / version</th><th scope="col">Result or reason</th></tr></thead><tbody>{snapshot.assignments.filter((item) => item.workerId === selectedWorker.id).map((item) => <tr key={item.id}><td>{format(item.assignedAt)}</td><td>Assignment</td><td>{courseName(item.courseId)}<small>{item.courseVersion}</small></td><td>{item.status}<small>{item.reason}</small></td></tr>)}{snapshot.events.filter((item) => item.workerId === selectedWorker.id).map((item) => <tr key={item.id}><td>{format(item.createdAt)}</td><td>{stepLabels[item.step]}{item.supersedesId ? ' correction' : ''}</td><td>{courseName(item.courseId)}<small>{item.courseVersion || 'Before course completion'}</small></td><td>{item.outcome}<small>{item.reason} · {item.actorEmail}</small></td></tr>)}{history.map((item) => <tr key={item.id}><td>{format(item.created_at)}</td><td>Audit · {item.entity_type}</td><td>{item.action}</td><td>{item.reason || 'System recorded change'}<small>{item.actor_email}</small></td></tr>)}</tbody></table></div></div>
          </section>}
          {canManage && <dialog ref={ruleDialog} className="qualification-modal" aria-labelledby="rule-title" onClose={() => setRuleOpen(false)}><div className="qualification-panel-heading"><h2 id="rule-title">{ruleForm.expectedUpdatedAt ? 'Edit' : 'Add'} site and role requirement</h2><button type="button" onClick={() => setRuleOpen(false)} aria-label="Close requirement form">Close</button></div><p>Choose which steps the employer requires for this role at this site. This configuration is audited.</p><form onSubmit={submitRule}><label>Site<select required value={ruleForm.siteId} disabled={!!ruleForm.expectedUpdatedAt} onChange={(event) => setRuleForm({ ...ruleForm, siteId: event.target.value })}><option value="">Choose site</option>{snapshot.sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Worker role<select required value={ruleForm.groupName} disabled={!!ruleForm.expectedUpdatedAt} onChange={(event) => setRuleForm({ ...ruleForm, groupName: event.target.value })}><option value="">Choose role</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label><label>Course<select required value={ruleForm.courseId} disabled={!!ruleForm.expectedUpdatedAt} onChange={(event) => setRuleForm({ ...ruleForm, courseId: event.target.value, courseVersion: '' })}><option value="">Choose approved course</option>{courses.filter((course) => hseReleases.some((release) => release.courseId === course.id)).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label>Approved version<select required value={ruleForm.courseVersion} onChange={(event) => setRuleForm({ ...ruleForm, courseVersion: event.target.value })}><option value="">Choose version</option>{hseReleases.filter((release) => release.courseId === ruleForm.courseId).map((release) => <option key={release.version} value={release.version}>{release.version}</option>)}</select></label><fieldset><legend>Required steps</legend>{([['localInstructionRequired', 'Site instruction'], ['prerequisiteRequired', 'External prerequisite'], ['practicalEvaluationRequired', 'Practical evaluation'], ['authorizationRequired', 'Employer authorization']] as const).map(([key, label]) => <label key={key} className="qualification-check"><input type="checkbox" checked={ruleForm[key]} onChange={(event) => setRuleForm({ ...ruleForm, [key]: event.target.checked })} />{label}</label>)}</fieldset><label>Configuration reason<textarea required maxLength={500} value={ruleForm.reason} onChange={(event) => setRuleForm({ ...ruleForm, reason: event.target.value })} placeholder="Who approved this applicability and why?" /></label><div className="qualification-modal-actions"><button type="button" onClick={() => setRuleOpen(false)}>Cancel</button><button type="submit" disabled={savingRule}>{savingRule ? 'Saving…' : 'Save requirement'}</button></div></form></dialog>}
        </>}
      </main>
    </div>
  );
}
