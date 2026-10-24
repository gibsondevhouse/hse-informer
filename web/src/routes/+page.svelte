<script lang="ts">
  import { onMount } from 'svelte';
  import { courseOutlines } from '../lib/preview/courses';
  import { endOfSiteDay, localDate } from '../lib/site-date';
  import { focusDialog } from '../lib/ui/focus-dialog';
  import StatusBadge from '../lib/ui/StatusBadge.svelte';
  import NavigationIcon from '../lib/ui/NavigationIcon.svelte';
  import './workspace.css';

  type Ref = { id: string; name?: string; displayName?: string; title?: string };
  type Site = { id: string; code: string; name: string; stateCode: string; timeZone: string | null };
  type Person = { id: string; displayName: string; jobTitle: string; department: string; siteIds: string[] };
  type Requirement = { id: string; code: string; title: string; version: string; reviewStatus: string; legalStatus: string; recurrence: { kind?: string; intervalDays?: number } | null };
  type AssignmentCourse = { id: string; requirementId: string; title: string; version: string; moodleCourseId: number };
  type Assignment = { id: string; person: Ref; site: Ref; requirement: Ref; reason: string; dueAt: string; state: string; knowledgeComplete: boolean; authorized: boolean; authorizationDecision: 'authorized' | 'restricted' | 'revoked' | null; authorizationRestrictions: string | null; deliveryState: string; launchUrl: string | null; dueSoon: boolean; progress: { status: 'not_started' | 'in_progress' | 'unknown'; observedAt: string | null } };
  type Summary = {
    asOf: string;
    counts: { total: number; notStarted: number; progressUnknown: number; inProgress: number; knowledgeComplete: number; overdue: number; authorized: number };
    courses: { requirementId: string; title: string; total: number; knowledgeComplete: number; overdue: number }[];
    sites: { siteId: string; name: string; total: number; overdue: number; authorized: number }[];
  };
  type IntegrationHealth = { asOf: string; jobs: { failed: number; aged: number; pending: number; stalled: number }; unresolvedDrifts: Record<string, number>; reassignmentFailures: number };
  type View = 'overview' | 'programs' | 'assignments' | 'sites';
  type Bucket = 'all' | 'not_started' | 'progress_unknown' | 'in_progress' | 'knowledge_complete' | 'overdue' | 'needs_review' | 'closed' | 'authorized' | 'due_soon' | 'open_knowledge';
  type Sort = 'person' | 'site' | 'course' | 'reason' | 'status' | 'due';
  const labels: Record<string, string> = { not_started: 'Not started', progress_unknown: 'Progress not confirmed', in_progress: 'In progress', knowledge_complete: 'Knowledge complete', overdue: 'Overdue', needs_review: 'Needs review', closed: 'Closed', authorized: 'Active authorization', due_soon: 'Due within 7 days', open_knowledge: 'Open knowledge steps' };
  const humanLabel = (value: string) => value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/^./, (first) => first.toUpperCase());
  const reviewLabel = (value: string) => value === 'approved' ? 'Approved' : value === 'unapproved' ? 'Unapproved' : humanLabel(value);
  const deliveryLabel = (value: string) => value === 'draft' ? 'Draft · not released' : value === 'queued' ? 'Pending enrollment' : value === 'enrolled' ? 'Enrolled' : humanLabel(value);
  const reasons = ['Onboarding', 'Company recurring policy', 'Required recurring training', 'Change in work or hazards', 'Knowledge or performance gap'];
  const navigation: { key: View; label: string }[] = [
    { key: 'overview', label: 'Overview' }, { key: 'programs', label: 'Programs' },
    { key: 'assignments', label: 'Assignments' }, { key: 'sites', label: 'Sites' }
  ];

  let loading = $state(true);
  let error = $state('');
  let actionError = $state('');
  let notice = $state('');
  let actor = $state<{ displayName: string; role: string } | null>(null);
  let tenant = $state<{ name: string; synthetic: boolean } | null>(null);
  let sites = $state<Site[]>([]);
  let people = $state<Person[]>([]);
  let requirements = $state<Requirement[]>([]);
  let assignments = $state<Assignment[]>([]);
  let assignmentCourses = $state<AssignmentCourse[]>([]);
  let summary = $state<Summary | null>(null);
  let integrationHealth = $state<IntegrationHealth | null>(null);
  let view = $state<View>('overview');
  let siteFilter = $state('all');
  let courseFilter = $state('all');
  let bucket = $state<Bucket>('all');
  let query = $state('');
  let programQuery = $state('');
  let programStatus = $state('all');
  let programProgress = $state<'all' | 'overdue' | 'open_knowledge'>('all');
  let sort = $state<Sort>('due');
  let direction = $state<'asc' | 'desc'>('asc');
  let page = $state(1);
  let breakdown = $state(false);
  let detail = $state<Requirement | null>(null);
  let personDetail = $state<Person | null>(null);
  let assignOpen = $state(false);
  let edit = $state<Assignment | null>(null);
  let editDue = $state('');
  let deadlineReason = $state('');
  let cancelReason = $state('');
  let formSites = $state<string[]>([]);
  let formRequirement = $state('');
  let formCourseVersion = $state('');
  let formDue = $state('');
  let formReason = $state(reasons[0]);
  let formJob = $state('all');
  let selectedPeople = $state<string[]>([]);
  let saving = $state(false);
  let reviewAssignment = $state(false);

  const name = (ref: Ref) => ref?.displayName || ref?.title || ref?.name || ref?.id || 'Unknown';
  const outlineFor = (code: string) => courseOutlines[code as keyof typeof courseOutlines];
  const legalLabel = (item: Requirement) => {
    const label = item.legalStatus ? item.legalStatus.replaceAll('_', ' ') : 'legal status pending';
    return item.reviewStatus === 'approved' ? label : `Draft classification: ${label}`;
  };
  const recurrenceLabel = (value: Requirement['recurrence']) => !value?.kind ? 'Pending HSE review'
    : value.kind === 'annual' ? 'Annual'
    : value.kind === 'event_only' ? 'Event driven'
    : value.kind === 'interval' && value.intervalDays ? `Every ${value.intervalDays} days`
    : 'Rule details pending';
  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
  };
  const calendarDate = (value: string) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric'
  }).format(new Date(value + 'T12:00:00Z'));
  const siteZone = (siteId: string) => sites.find((item) => item.id === siteId)?.timeZone || null;
  const dueInstant = (localDay: string, siteId: string) => {
    const zone = siteZone(siteId);
    if (!zone) throw new Error('Confirm this site’s time zone before setting a deadline.');
    return endOfSiteDay(localDay, zone);
  };
  const siteDate = (value: string, siteId: string) => {
    const zone = siteZone(siteId);
    if (!zone) return 'Time zone pending';
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? '—' : new Intl.DateTimeFormat('en-US', {
      timeZone: zone, month: 'short', day: 'numeric', year: 'numeric'
    }).format(parsed);
  };
  const inputDate = (value: string, siteId: string) => {
    const zone = siteZone(siteId);
    return zone && !Number.isNaN(new Date(value).valueOf()) ? localDate(value, zone) : '';
  };
  const status = (row: Assignment) => row.state;
  const hasOpenKnowledge = (row: Assignment) => status(row) !== 'closed' && !row.knowledgeComplete;
  const isDueSoon = (row: Assignment) => row.dueSoon;
  const authorizationLabel = (row: Assignment) => row.authorizationDecision === 'restricted' ? 'Restricted authorization' : 'Authorized';
  const statusLabel = (row: Assignment) => row.authorized && row.authorizationDecision === 'restricted' && status(row) === 'authorized'
    ? authorizationLabel(row) : labels[status(row)] || humanLabel(row.state);
  const percent = (part: number, whole: number) => whole ? Math.round(100 * part / whole) : 0;
  let approved = $derived(requirements.filter((item) => item.reviewStatus === 'approved'));
  let assignable = $derived(approved.filter((item) => assignmentCourses.some((course) => course.requirementId === item.id)));
  let selectedCourse = $derived(assignmentCourses.find((course) => course.id === formCourseVersion && course.requirementId === formRequirement));
  let canManage = $derived(actor?.role === 'tenant_admin' || actor?.role === 'site_admin');
  let canMonitor = $derived(actor?.role === 'tenant_admin' || actor?.role === 'hse_reviewer' || actor?.role === 'auditor');
  let sitePeople = $derived(people.filter((item) => item.siteIds.some((id) => formSites.includes(id))));
  let jobOptions = $derived([...new Set(sitePeople.map((item) => item.jobTitle).filter(Boolean))].sort());
  let availablePeople = $derived(sitePeople.filter((item) => formJob === 'all' || item.jobTitle === formJob));
  let recipientPairs = $derived(selectedPeople.flatMap((personId) => {
    const person = people.find((item) => item.id === personId);
    return formSites.filter((siteId) => person?.siteIds.includes(siteId)).map((siteId) => ({ personId, siteId }));
  }));
  let possibleDuplicatePairs = $derived(recipientPairs.filter(({ personId, siteId }) => assignments.some((row) =>
    row.person.id === personId && row.site.id === siteId && row.requirement.id === formRequirement && status(row) !== 'closed')));
  let scoped = $derived(assignments.filter((item) => siteFilter === 'all' || item.site.id === siteFilter));
  let visibleRequirements = $derived(requirements.filter((item) =>
    (programStatus === 'all' || item.reviewStatus === programStatus)
    && (!programQuery.trim() || [item.title, item.code].join(' ').toLowerCase().includes(programQuery.trim().toLowerCase()))
    && (programProgress === 'all' || scoped.some((row) => row.requirement.id === item.id
      && (programProgress === 'overdue' ? status(row) === 'overdue' : hasOpenKnowledge(row))))));
  let assignedPeople = $derived(new Set(scoped.map((item) => item.person.id)).size);
  let incompletePeople = $derived(new Set(scoped.filter((item) => !item.knowledgeComplete && status(item) !== 'closed').map((item) => item.person.id)).size);
  let dueSoon = $derived(scoped.filter(isDueSoon).length);
  let counts = $derived({
    total: scoped.length,
    not_started: scoped.filter((item) => status(item) === 'not_started').length,
    progress_unknown: scoped.filter((item) => status(item) === 'progress_unknown').length,
    in_progress: scoped.filter((item) => status(item) === 'in_progress').length,
    knowledge_complete: scoped.filter((item) => item.knowledgeComplete).length,
    overdue: scoped.filter((item) => status(item) === 'overdue').length,
    authorized: scoped.filter((item) => item.authorized).length
  });
  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return assignments
      .filter((item) => (siteFilter === 'all' || item.site.id === siteFilter)
        && (courseFilter === 'all' || item.requirement.id === courseFilter)
        && (bucket === 'all' || (bucket === 'authorized' ? item.authorized
          : bucket === 'knowledge_complete' ? item.knowledgeComplete
            : bucket === 'due_soon' ? isDueSoon(item)
              : bucket === 'open_knowledge' ? hasOpenKnowledge(item) : status(item) === bucket))
        && (!q || [name(item.person), name(item.site), name(item.requirement), item.reason].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => {
        const key = (item: Assignment) => sort === 'person' ? name(item.person) : sort === 'site' ? name(item.site)
          : sort === 'course' ? name(item.requirement) : sort === 'reason' ? item.reason
            : sort === 'status' ? labels[status(item)] : item.dueAt;
        return key(a).localeCompare(key(b), undefined, { numeric: true }) * (direction === 'asc' ? 1 : -1);
      });
  });
  let visible = $derived(filtered.slice((page - 1) * 20, page * 20));
  let pageCount = $derived(Math.max(1, Math.ceil(filtered.length / 20)));
  function courseStats(requirementId: string) {
    const rows = scoped.filter((item) => item.requirement.id === requirementId);
    return { total: rows.length, assignedPeople: new Set(rows.map((item) => item.person.id)).size,
      knowledgeComplete: rows.filter((item) => item.knowledgeComplete).length,
      overdue: rows.filter((item) => status(item) === 'overdue').length,
      dueSoon: rows.filter(isDueSoon).length };
  }

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || (response.status === 401 ? 'Please sign in.' : 'Request failed (' + response.status + ').'));
    }
    return await response.json() as T;
  }
  async function load() {
    loading = true; error = '';
    try {
      const [me, s, p, r, a, sum] = await Promise.all([
        request<{ actor: { displayName: string; role: string }; tenant: { name: string; synthetic: boolean } }>('/api/me'),
        request<{ items: Site[] }>('/api/sites'), request<{ items: Person[] }>('/api/people'),
        request<{ items: Requirement[] }>('/api/requirements'), request<{ items: Assignment[] }>('/api/assignments'),
        request<Summary>('/api/summary')
      ]);
      actor = me.actor; tenant = me.tenant; sites = s.items; people = p.items;
      requirements = r.items; assignments = a.items; summary = sum;
      assignmentCourses = ['tenant_admin','site_admin'].includes(me.actor.role)
        ? (await request<{ items: AssignmentCourse[] }>('/api/assignments/options')).items : [];
      integrationHealth = canMonitor ? await request<IntegrationHealth>('/api/integration-health').catch(() => null) : null;
      formSites = sites.map((site) => site.id);
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Unable to load the workspace.'; }
    finally { loading = false; }
  }
  async function refresh() {
    const [a, sum] = await Promise.all([request<{ items: Assignment[] }>('/api/assignments'), request<Summary>('/api/summary')]);
    assignments = a.items; summary = sum;
    if (canMonitor) integrationHealth = await request<IntegrationHealth>('/api/integration-health').catch(() => null);
  }
  function navigate(next: View) {
    view = next; page = 1; breakdown = false; actionError = '';
    query = ''; bucket = 'all'; courseFilter = 'all';
    programQuery = ''; programStatus = 'all'; programProgress = 'all';
  }
  function showAssignments(next: Bucket = 'all', course = 'all') {
    navigate('assignments'); bucket = next; courseFilter = course;
  }
  function showBreakdown() {
    showAssignments();
    breakdown = true;
  }
  function sortBy(next: Sort) {
    if (sort === next) direction = direction === 'asc' ? 'desc' : 'asc';
    else { sort = next; direction = 'asc'; }
    page = 1;
  }
  function openAssign(requirementId = '') {
    formSites = siteFilter === 'all' ? sites.map((site) => site.id) : [siteFilter];
    formRequirement = requirementId || assignable[0]?.id || '';
    formCourseVersion = assignmentCourses.find((course) => course.requirementId === formRequirement)?.id || '';
    formDue = ''; formReason = reasons[0]; formJob = 'all'; selectedPeople = []; actionError = ''; reviewAssignment = false; assignOpen = true;
  }
  function togglePerson(id: string) {
    selectedPeople = selectedPeople.includes(id) ? selectedPeople.filter((item) => item !== id) : [...selectedPeople, id];
  }
  function reviewRecipients() {
    if (!formSites.length || !formRequirement || !selectedCourse || !formDue || !recipientPairs.length) {
      actionError = 'Choose sites, a published course version, a deadline, and recipients.';
      return;
    }
    actionError = '';
    reviewAssignment = true;
  }
  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (edit) edit = null;
    else if (assignOpen) assignOpen = false;
    else if (personDetail) personDetail = null;
    else detail = null;
  }
  async function createAssignment() {
    if (!formSites.length || !formRequirement || !selectedCourse || !formDue || !recipientPairs.length) {
      actionError = 'Choose sites, a published course version, a deadline, and recipients.'; return;
    }
    saving = true; actionError = '';
    try {
      const result = await request<{ created: { id: string; personId: string; siteId: string }[]; skipped: { personId: string; siteId: string }[] }>('/api/assignments/bulk', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipients: recipientPairs, requirementId: formRequirement, courseVersionId: selectedCourse.id,
          dueDate: formDue, reason: formReason })
      });
      await refresh(); assignOpen = false; showAssignments();
      notice = result.created.length + ' assignment(s) created; ' + result.skipped.length + ' duplicate open assignment(s) skipped.';
    } catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to create assignments.'; }
    finally { saving = false; }
  }
  async function saveDeadline() {
    if (!edit || !editDue || deadlineReason.trim().length < 3) return;
    saving = true; actionError = '';
    try {
      await request('/api/assignments/' + encodeURIComponent(edit.id), {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dueAt: dueInstant(editDue, edit.site.id), reason: deadlineReason })
      });
      await refresh(); edit = null; notice = 'Deadline updated.';
    } catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to update deadline.'; }
    finally { saving = false; }
  }
  async function cancelCurrentAssignment() {
    if (!edit || cancelReason.trim().length < 3) return;
    saving = true; actionError = '';
    try {
      await request('/api/assignments/' + encodeURIComponent(edit.id), {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      });
      await refresh(); edit = null; notice = 'Assignment cancelled. Its progress and evidence remain in history. You can create a new assignment when needed.';
    } catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to cancel assignment.'; }
    finally { saving = false; }
  }
  onMount(() => {
    void load();
    const sync = () => {
      if (!document.hidden && !loading && !saving) void refresh().catch(() => { notice = 'Live refresh paused. Reload to retry.'; });
    };
    const timer = window.setInterval(sync, 15000);
    window.addEventListener('focus', sync);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', sync); };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>HSE Informer · Training workspace</title>
  <meta name="description" content="Manage training assignments, evidence, and workplace authorization." />
</svelte:head>

{#if loading}
  <div class="center-state" role="status"><span class="mark">H</span><h1>Loading workspace</h1></div>
{:else if error}
  <div class="center-state"><span class="mark">H</span><h1>Workspace unavailable</h1><p>{error}</p><div class="center-actions"><button onclick={() => void load()}>Try again</button><a href="/auth/login">Sign in</a></div></div>
{:else}
  <div class="shell" inert={detail || personDetail || assignOpen || edit ? true : undefined}>
    <a class="skip-link" href="#workspace-main">Skip to main content</a>
    <aside class="sidebar">
      <div class="brand"><span class="mark">H</span><div><strong>HSE Informer</strong><small>Training management</small></div></div>
      <div class="tenant-card"><span class="eyebrow">WORKSPACE</span><strong>{tenant?.name}</strong><small>{tenant?.synthetic ? 'Synthetic data · no production evidence' : 'Training operations'}</small></div>
      <nav aria-label="Workspace"><span class="nav-heading">MANAGE</span>{#each navigation as item}<button class:active={view === item.key} aria-current={view === item.key ? 'page' : undefined} onclick={() => navigate(item.key)}><span><NavigationIcon name={item.key} /></span>{item.label}</button>{/each}<a href="/people">People & profiles</a><a href="/courses">Course management</a><a href="/records">Completion records</a>{#if actor?.role === 'learner'}<a href="/learn">My training</a>{/if}</nav>
      <div class="sidebar-bottom"><span class="avatar">{actor?.displayName?.slice(0, 1) || 'H'}</span><div><strong>{actor?.displayName}</strong><small>{actor?.role}</small></div>{#if !tenant?.synthetic}<form method="POST" action="/auth/logout"><button aria-label="Sign out">Sign out</button></form>{/if}</div>
    </aside>
    <main id="workspace-main">
      <header class="topbar"><div>HSE Informer <span>/</span> {navigation.find((item) => item.key === view)?.label}</div><span class="mode-pill">{tenant?.synthetic ? 'Synthetic workspace' : 'Beta test workspace'}</span></header>
      <div class="content">
        <div class="page-heading"><div><p class="eyebrow">TRAINING OPERATIONS</p><h1>{navigation.find((item) => item.key === view)?.label}</h1><p>{view === 'overview' ? 'Knowledge progress and the work still needed for authorization.' : view === 'assignments' ? 'See why training was assigned, when it is due, and what was completed.' : view === 'programs' ? 'Requirement status and course delivery readiness.' : 'Training across locations.'}</p></div>{#if view !== 'sites' && canManage}<button class="primary" disabled={!assignable.length} onclick={() => openAssign()}>+ New assignment</button>{/if}</div>
        {#if tenant?.synthetic}<div class="banner"><strong>Synthetic rehearsal data</strong><span>Draft requirements are not released courses, qualifications, or workplace authorizations.</span></div>{/if}
        {#if notice}<div class="notice" role="status">{notice}<button aria-label="Dismiss message" onclick={() => notice = ''}>×</button></div>{/if}
        {#if view === 'overview' || view === 'assignments'}
          <div class="filters"><label>Site <select bind:value={siteFilter} onchange={() => page = 1}><option value="all">All sites</option>{#each sites as site}<option value={site.id}>{site.name}</option>{/each}</select></label><span>As of {date(summary?.asOf || new Date().toISOString())}</span></div>
          <div class="stats">
            <button onclick={() => showAssignments()}><span>Assigned learners</span><strong>{assignedPeople}</strong><small>{counts.total} assignment records</small></button>
            <button onclick={showBreakdown}><span>Knowledge completion</span><strong>{percent(counts.knowledge_complete, counts.total)}%</strong><small>{counts.knowledge_complete} of {counts.total} assignments · view breakdown</small></button>
            <button onclick={() => showAssignments('open_knowledge')}><span>People with incomplete training</span><strong>{incompletePeople}</strong><small>At least one open knowledge step</small></button>
            <button class="warning" onclick={() => showAssignments('overdue')}><span>Overdue</span><strong>{counts.overdue}</strong><small>Requires follow-up</small></button>
            <button onclick={() => showAssignments('due_soon')}><span>Due within 7 days</span><strong>{dueSoon}</strong><small>Calendar dates in each site's time zone</small></button>
            <button onclick={() => showAssignments('progress_unknown')}><span>Progress not confirmed</span><strong>{counts.progress_unknown}</strong><small>Moodle has not confirmed learning activity</small></button>
            <button onclick={() => showAssignments('authorized')}><span>Active authorization</span><strong>{counts.authorized}</strong><small>Full or restricted decision</small></button>
          </div>
        {/if}
        {#if view === 'overview'}
          {#if canMonitor}<section class="integration-health" aria-label="Integration monitoring"><div><span class="eyebrow">INTEGRATION MONITORING</span><h2>Delivery and reconciliation</h2><p>{tenant?.synthetic ? 'Synthetic records are never sent to Moodle. Live integration checks remain pending.' : integrationHealth ? 'Review failed jobs, reassignment failures, and unresolved drift before relying on delivery status.' : 'Monitoring data is unavailable; check the integration job and database.'}</p></div>{#if integrationHealth}<div class="integration-counts"><span><strong>{integrationHealth.jobs.failed}</strong> failed jobs</span><span><strong>{integrationHealth.jobs.aged}</strong> aged jobs</span><span><strong>{integrationHealth.jobs.stalled}</strong> stalled jobs</span><span><strong>{integrationHealth.reassignmentFailures}</strong> reassignment failures</span><span><strong>{Object.values(integrationHealth.unresolvedDrifts).reduce((total, value) => total + value, 0)}</strong> unresolved drifts</span></div>{/if}</section>{/if}
          <div class="section-head"><div><h2>Programs at a glance</h2><p>Course completion alone does not qualify a worker.</p></div><button class="text-button" onclick={() => navigate('programs')}>View all programs →</button></div>
          <div class="program-list">{#each requirements as item}{@const course = courseStats(item.id)}<button class="program-row" onclick={() => detail = item}><span class="monogram">{item.code.slice(0, 2)}</span><span class="row-main"><strong>{item.title}</strong><small>{item.reviewStatus === 'approved' ? 'Approved requirement' : 'Draft · approval pending'}</small></span><span class="row-progress"><span>{course?.knowledgeComplete || 0} / {course?.total || 0} knowledge complete</span><i><b style={'width:' + percent(course?.knowledgeComplete || 0, course?.total || 0) + '%'}></b></i></span><span aria-hidden="true">→</span></button>{/each}</div>
          <div class="info-grid"><div><span class="eyebrow">RECORD BOUNDARY</span><h3>Completion records stay traceable.</h3><p>Verified Moodle results and manual entries retain their source and change history. Completion does not grant workplace authorization.</p></div><div><span class="eyebrow">NEXT GATE</span><h3>Beta setup pending.</h3><p>Company IT hosting, approved Moodle courses, and the participant test run remain before beta release.</p></div></div>
        {/if}
        {#if view === 'assignments'}
          <div class="section-head"><div><h2>Assignment records</h2><p>{filtered.length} matching records</p></div><button class="text-button" onclick={() => breakdown = !breakdown}>{breakdown ? 'View records' : 'View status breakdown'}</button></div>
          {#if breakdown}
            <p class="overlap-note">Knowledge completion and authorization are independent milestones. A learner can also be overdue while site or practical evidence remains incomplete, so these percentages may overlap.</p>
            <div class="breakdown">{#each (['not_started', 'progress_unknown', 'in_progress', 'knowledge_complete', 'overdue', 'authorized'] as const) as key}<button onclick={() => showAssignments(key)}><span class="ring" style={'--fill:' + percent(counts[key], counts.total) + '%'}><strong>{percent(counts[key], counts.total)}%</strong></span><b>{labels[key]}</b><small>{counts[key]} assignment{counts[key] === 1 ? '' : 's'}</small></button>{/each}</div>
          {:else}
            <div class="toolbar"><label>Search<input type="search" placeholder="Learner, course, or reason" bind:value={query} oninput={() => page = 1} /></label><label>Status<select bind:value={bucket} onchange={() => page = 1}><option value="all">All statuses</option>{#each Object.entries(labels) as [key, label]}<option value={key}>{label}</option>{/each}</select></label><label>Program<select bind:value={courseFilter} onchange={() => page = 1}><option value="all">All programs</option>{#each requirements as item}<option value={item.id}>{item.title}</option>{/each}</select></label></div>
            <div class="table-wrap"><table><colgroup><col class="col-learner" /><col class="col-site" /><col class="col-program" /><col class="col-reason" /><col class="col-status" /><col class="col-due" /><col class="col-actions" /></colgroup><thead><tr><th aria-sort={sort === 'person' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button aria-label={'Sort by learner, ' + (sort === 'person' && direction === 'asc' ? 'descending' : 'ascending')} onclick={() => sortBy('person')}>Learner {sort === 'person' ? direction === 'asc' ? '↑' : '↓' : ''}</button></th><th aria-sort={sort === 'site' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button aria-label={'Sort by site, ' + (sort === 'site' && direction === 'asc' ? 'descending' : 'ascending')} onclick={() => sortBy('site')}>Site {sort === 'site' ? direction === 'asc' ? '↑' : '↓' : ''}</button></th><th aria-sort={sort === 'course' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button aria-label={'Sort by program, ' + (sort === 'course' && direction === 'asc' ? 'descending' : 'ascending')} onclick={() => sortBy('course')}>Program {sort === 'course' ? direction === 'asc' ? '↑' : '↓' : ''}</button></th><th aria-sort={sort === 'reason' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button aria-label={'Sort by reason, ' + (sort === 'reason' && direction === 'asc' ? 'descending' : 'ascending')} onclick={() => sortBy('reason')}>Reason {sort === 'reason' ? direction === 'asc' ? '↑' : '↓' : ''}</button></th><th aria-sort={sort === 'status' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button aria-label={'Sort by training status, ' + (sort === 'status' && direction === 'asc' ? 'descending' : 'ascending')} onclick={() => sortBy('status')}>Training status {sort === 'status' ? direction === 'asc' ? '↑' : '↓' : ''}</button></th><th aria-sort={sort === 'due' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button aria-label={'Sort by due date, ' + (sort === 'due' && direction === 'asc' ? 'descending' : 'ascending')} onclick={() => sortBy('due')}>Due {sort === 'due' ? direction === 'asc' ? '↑' : '↓' : ''}</button></th><th>Actions</th></tr></thead><tbody>{#each visible as item (item.id)}<tr><td><button class="learner-link" onclick={() => personDetail = people.find((person) => person.id === item.person.id) || null}>{name(item.person)}</button></td><td>{name(item.site)}</td><td>{name(item.requirement)}</td><td>{item.reason}</td><td><StatusBadge state={item.authorized && item.authorizationDecision === 'restricted' ? 'restricted' : status(item)} label={statusLabel(item)} />{#if item.knowledgeComplete && status(item) !== 'knowledge_complete'}<StatusBadge state="knowledge_complete" label="Knowledge complete" additionalClass="authorization-badge" />{/if}{#if item.authorized && status(item) !== 'authorized'}<StatusBadge state={item.authorizationDecision === 'restricted' ? 'restricted' : 'authorized'} label={authorizationLabel(item)} additionalClass="authorization-badge" />{/if}{#if item.authorized && item.authorizationRestrictions}<small class="delivery">Restrictions: {item.authorizationRestrictions}</small>{/if}{#if item.deliveryState !== 'enrolled'}<small class="delivery">Delivery: {deliveryLabel(item.deliveryState)}</small>{/if}</td><td>{siteDate(item.dueAt, item.site.id)}{#if item.dueSoon}<small class="delivery">Due soon</small>{/if}</td><td>{#if canManage}<button class="link-button" onclick={() => { edit = item; editDue = inputDate(item.dueAt, item.site.id); cancelReason = ''; deadlineReason = ''; actionError = ''; }}>Edit due</button>{/if}{#if item.launchUrl}<a href={item.launchUrl} target="_blank" rel="noopener noreferrer">Launch ↗</a>{/if}</td></tr>{:else}<tr><td class="empty" colspan="7">No assignments match these filters.</td></tr>{/each}</tbody></table></div>
            <div class="pagination"><span>Showing {filtered.length ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, filtered.length)} of {filtered.length}</span><div><button disabled={page <= 1} onclick={() => page--}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onclick={() => page++}>Next</button></div></div>
          {/if}
        {/if}
        {#if view === 'programs'}
          <div class="section-head"><div><h2>Requirement library</h2><p>Draft syllabi remain unapproved until HSE review.</p></div></div>
          <div class="toolbar"><label>Search programs<input type="search" placeholder="Title or code" bind:value={programQuery} /></label><label>Review status<select bind:value={programStatus}><option value="all">All statuses</option><option value="approved">Approved</option><option value="unapproved">Unapproved</option></select></label><label>Assignment progress<select bind:value={programProgress}><option value="all">All programs</option><option value="overdue">Has overdue assignments</option><option value="open_knowledge">Has open knowledge steps</option></select></label><label>Site<select bind:value={siteFilter}><option value="all">All sites</option>{#each sites as site}<option value={site.id}>{site.name}</option>{/each}</select></label></div>
          <div class="course-grid">{#each visibleRequirements as item}{@const course = courseStats(item.id)}<button class="course-card" onclick={() => detail = item}><span class="monogram">{item.code.slice(0, 2)}</span><strong>{item.title}</strong><small>{item.code} · Version {item.version}</small><StatusBadge kind="review" state={item.reviewStatus} label={reviewLabel(item.reviewStatus)} /><span class="course-metrics">{course.assignedPeople} learners · {percent(course.knowledgeComplete, course.total)}% knowledge complete · {course.overdue} overdue · {course.dueSoon} due soon</span><span class="card-bottom">{legalLabel(item)} <b>Details →</b></span></button>{:else}<p class="empty-card">No programs match these filters.</p>{/each}</div>
        {/if}
        {#if view === 'sites'}
          <div class="section-head"><div><h2>Locations</h2><p>Site cohorts remain within the company’s Moodle instance.</p></div></div>
          <div class="site-grid">{#each sites as site}{@const row = summary?.sites.find((item) => item.siteId === site.id)}<button class="site-card" onclick={() => { siteFilter = site.id; showAssignments(); }}><span class="monogram">{site.code.slice(0, 2)}</span><strong>{site.name}</strong><small>{site.stateCode}</small><span class="site-metrics"><span><b>{row?.total || 0}</b> assignments</span><span><b>{row?.overdue || 0}</b> overdue</span><span><b>{row?.authorized || 0}</b> authorized</span></span><span class="site-link">View assignments →</span></button>{/each}</div>
        {/if}
      </div>
    </main>
  </div>
  {#if detail}
    {@const outline = outlineFor(detail.code)}
    <div class="scrim"><div class="drawer" role="dialog" aria-modal="true" aria-label={detail.title} tabindex="-1" use:focusDialog>
      <button class="close" aria-label="Close program details" onclick={() => detail = null}>×</button>
      <span class="eyebrow">PROGRAM DETAILS</span><h2>{detail.title}</h2><p class="muted">{detail.code} · Version {detail.version}</p>
      <div class="detail-row"><strong>Review status</strong><StatusBadge kind="review" state={detail.reviewStatus} label={reviewLabel(detail.reviewStatus)} /></div>
      <div class="detail-row"><strong>Legal status</strong><span>{legalLabel(detail)}</span></div>
      <div class="detail-row"><strong>Recurrence</strong><span>{recurrenceLabel(detail.recurrence)}</span></div>
      {#if outline}
        <div class="syllabus"><span class="eyebrow">DRAFT SYLLABUS REFERENCE</span><p>{outline.purpose}</p><h3>{outline.lessons.length} lesson titles</h3><ol>{#each outline.lessons as lesson}<li>{lesson}</li>{/each}</ol><h3>Site instruction topics</h3><ul>{#each outline.localInstruction as topic}<li>{topic}</li>{/each}</ul></div>
      {/if}
      <p class="form-alert">These outlines are unapproved reference material. Review the course content and verify its Moodle mapping before publication.</p>
      {#if detail.code === 'respiratory-protection' && (actor?.role === 'tenant_admin' || actor?.role === 'hse_reviewer')}<a class="preview-link" href="/preview/respiratory-protection" target="_blank" rel="noopener noreferrer">Preview draft opening lesson ↗</a>{/if}
      {#if canManage}<button class="primary" disabled={detail.reviewStatus !== 'approved'} onclick={() => { const id = detail?.id || ''; detail = null; openAssign(id); }}>Assign approved program</button>{/if}
    </div></div>
  {/if}
  {#if personDetail}
    <div class="scrim"><div class="drawer" role="dialog" aria-modal="true" aria-label={'Learner record for ' + personDetail.displayName} tabindex="-1" use:focusDialog>
      <button class="close" aria-label="Close learner record" onclick={() => personDetail = null}>×</button>
      <span class="eyebrow">LEARNER RECORD</span><h2>{personDetail.displayName}</h2>
      <p class="muted">{personDetail.department} · {personDetail.jobTitle}</p>
      <div class="detail-row"><strong>Sites</strong><span>{personDetail.siteIds.map((id) => sites.find((site) => site.id === id)?.name || id).join(', ')}</span></div>
      <div class="detail-row"><strong>Assignments</strong><span>{assignments.filter((item) => item.person.id === personDetail?.id).length}</span></div>
      <h3>Training record</h3>
      <ul class="record-list">{#each assignments.filter((item) => item.person.id === personDetail?.id) as row}<li><strong>{name(row.requirement)}</strong><span>{statusLabel(row)}{row.authorized && status(row) !== 'authorized' ? ' · ' + authorizationLabel(row) : ''}{row.authorized && row.authorizationRestrictions ? ' · Restrictions: ' + row.authorizationRestrictions : ''}</span><small>Due {siteDate(row.dueAt, row.site.id)}</small></li>{:else}<li>No assignments recorded.</li>{/each}</ul>
      <p class="muted">Knowledge completion, site training, practical evaluation, and authorization require separate evidence.</p>
    </div></div>
  {/if}
  {#if assignOpen}
    <div class="scrim">
      <div class="modal" role="dialog" aria-modal="true" aria-label="New assignment" tabindex="-1" use:focusDialog>
        <button class="close" aria-label="Close assignment form" onclick={() => assignOpen = false}>×</button>
        <span class="eyebrow">NEW ASSIGNMENT</span>
        <h2>{reviewAssignment ? 'Review recipients' : 'Assign training'}</h2>
        <p class="muted">{reviewAssignment ? 'Confirm the requirement, site, due date, and people before creating records.' : 'Choose an approved program and an explicit audience.'}</p>
        {#if !assignable.length}
          <p class="form-alert">No published courses are available in approved programs. Publish a verified course version before assigning it.</p>
        {:else if reviewAssignment}
          <dl class="review-list">
            <div><dt>Program</dt><dd>{approved.find((item) => item.id === formRequirement)?.title}</dd></div>
            <div><dt>Course version</dt><dd>{selectedCourse?.title} · {selectedCourse?.version}</dd></div>
            <div><dt>Moodle course</dt><dd>{selectedCourse?.moodleCourseId}</dd></div>
            <div><dt>Sites</dt><dd>{sites.filter((item) => formSites.includes(item.id)).map((item) => item.name).join(', ')}</dd></div>
            <div><dt>Audience</dt><dd>{selectedPeople.length} selected learner{selectedPeople.length === 1 ? '' : 's'} · {recipientPairs.length} site assignment{recipientPairs.length === 1 ? '' : 's'}{formJob === 'all' ? '' : ' · ' + formJob}</dd></div>
            <div><dt>Reason</dt><dd>{formReason}</dd></div>
            <div><dt>Due date</dt><dd>{calendarDate(formDue)}</dd></div>
            <div><dt>Planned recurrence</dt><dd>{recurrenceLabel(approved.find((item) => item.id === formRequirement)?.recurrence || null)}</dd></div>
          </dl>
          <div class="recipient-review"><strong>Selected people and sites</strong><ul>{#each recipientPairs as pair}<li>{people.find((item) => item.id === pair.personId)?.displayName || pair.personId} · {sites.find((item) => item.id === pair.siteId)?.name || pair.siteId}{possibleDuplicatePairs.some((item) => item.personId === pair.personId && item.siteId === pair.siteId) ? ' · existing open assignment' : ''}</li>{/each}</ul></div>
          {#if possibleDuplicatePairs.length}<p class="form-alert">{possibleDuplicatePairs.length} selected site assignment{possibleDuplicatePairs.length === 1 ? ' has' : 's have'} an open record for this program. The server skips duplicate open assignments.</p>{/if}
          <p class="muted">Recurrence is requirement metadata. Creating this assignment does not schedule a new cycle by itself.</p>
          {#if actionError}<p class="form-alert" role="alert">{actionError}</p>{/if}
          <div class="modal-actions"><button onclick={() => reviewAssignment = false}>Back</button><button class="primary" disabled={saving} onclick={() => void createAssignment()}>{saving ? 'Saving…' : 'Create assignments'}</button></div>
        {:else}
          <div class="form-grid">
            <label>Program<select bind:value={formRequirement} onchange={(event) => formCourseVersion = assignmentCourses.find((course) => course.requirementId === event.currentTarget.value)?.id || ''}>{#each assignable as item}<option value={item.id}>{item.title}</option>{/each}</select></label>
            <label>Course version<select required bind:value={formCourseVersion}>{#each assignmentCourses.filter((course) => course.requirementId === formRequirement) as course}<option value={course.id}>{course.title} · {course.version} · Moodle {course.moodleCourseId}</option>{/each}</select></label>
            <fieldset class="site-selection"><legend>Sites</legend>{#each sites as site}<label><input type="checkbox" checked={formSites.includes(site.id)} onchange={() => { formSites = formSites.includes(site.id) ? formSites.filter((id) => id !== site.id) : [...formSites, site.id]; formJob = 'all'; selectedPeople = []; }} />{site.name}</label>{/each}</fieldset>
            <label>Job title<select bind:value={formJob} onchange={() => selectedPeople = []}><option value="all">All job titles</option>{#each jobOptions as job}<option value={job}>{job}</option>{/each}</select></label>
            <label>Reason<select bind:value={formReason}>{#each reasons as reason}<option value={reason}>{reason}</option>{/each}</select></label>
            <label>Due date<input type="date" bind:value={formDue} /></label>
          </div>
          <p class="muted"><strong>Planned recurrence:</strong> {recurrenceLabel(approved.find((item) => item.id === formRequirement)?.recurrence || null)}. The approved requirement controls future reassignment.</p>
          {#if possibleDuplicatePairs.length}<p class="form-alert">{possibleDuplicatePairs.length} site assignment{possibleDuplicatePairs.length === 1 ? ' has' : 's have'} an open record. The server checks again when saved.</p>{/if}
          <fieldset>
            <legend>Audience · {selectedPeople.length} people · {recipientPairs.length} site assignments</legend>
            <div class="select-actions"><button onclick={() => selectedPeople = availablePeople.map((person) => person.id)}>Select all at selected sites</button><button onclick={() => selectedPeople = []}>Clear</button></div>
            <div class="person-list">{#each availablePeople as person}<label><input type="checkbox" checked={selectedPeople.includes(person.id)} onchange={() => togglePerson(person.id)} /><span><strong>{person.displayName}</strong><small>{person.department} · {person.jobTitle} · {sites.filter((site) => formSites.includes(site.id) && person.siteIds.includes(site.id)).map((site) => site.name).join(', ')}</small></span></label>{:else}<p>No learners at selected sites.</p>{/each}</div>
          </fieldset>
          {#if actionError}<p class="form-alert" role="alert">{actionError}</p>{/if}
          <div class="modal-actions"><button onclick={() => assignOpen = false}>Cancel</button><button class="primary" onclick={reviewRecipients}>Review recipients</button></div>
        {/if}
      </div>
    </div>
  {/if}
  {#if edit}<div class="scrim"><div class="modal small-modal" role="dialog" aria-modal="true" aria-label="Edit assignment deadline" tabindex="-1" use:focusDialog><button class="close" aria-label="Close deadline editor" onclick={() => edit = null}>×</button><span class="eyebrow">ASSIGNMENT</span><h2>Edit deadline</h2><p class="muted">{name(edit.person)} · {name(edit.requirement)}</p><label>New due date<input type="date" bind:value={editDue} /></label><label>Reason for deadline change<input required minlength="3" maxlength="500" bind:value={deadlineReason} /></label>{#if actionError}<p class="form-alert" role="alert">{actionError}</p>{/if}<label>Reason to cancel this assignment<input bind:value={cancelReason} maxlength="500" placeholder="Required for cancellation" /></label><button disabled={saving || cancelReason.trim().length < 3} onclick={() => void cancelCurrentAssignment()}>Cancel assignment</button><div class="modal-actions"><button onclick={() => edit = null}>Cancel</button><button class="primary" disabled={saving || !editDue || deadlineReason.trim().length < 3} onclick={() => void saveDeadline()}>{saving ? 'Saving…' : 'Save deadline'}</button></div></div></div>{/if}
{/if}
