<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  import type { CompletionRecord } from '../../lib/server/records';
  import '../workspace.css';

  let { data }: { data: PageData } = $props();
  let interactive = $state(false);
  onMount(() => { interactive = true; });
  const canManage = $derived(['tenant_admin','site_admin'].includes(data.actor.role));
  const records = $derived(data.records);
  const peopleFilter = $derived(data.filterOptions.people);
  const sitesFilter = $derived(data.filterOptions.sites);
  const coursesFilter = $derived(data.filterOptions.courses);
  let message = $state('');
  let actionError = $state('');
  let busy = $state(false);
  let formOpen = $state(false);
  let correcting = $state<string | null>(null);
  let selected = $state<{ item: CompletionRecord; history: CompletionRecord[]; events: {
    id: string; kind: string; reason: string; recordedBy: string; recordedAt: string }[];
    assessmentSources: { recordId: string; attemptCount: number | null; sourcePayload: unknown }[] } | null>(null);
  let loadingDetail = $state(false);
  let personId = $state('');
  let siteId = $state('');
  let courseVersionId = $state('');
  let completedAt = $state('');
  let sourceReference = $state('');
  let reason = $state('');
  let satisfyAssignment = $state(false);
  let assignmentId = $state('');
  let amendmentReason = $state('');
  let voidReason = $state('');
  let voidOpen = $state(false);
  let people = $state<{ id: string; displayName: string; siteIds: string[] }[]>([]);
  let sites = $state<{ id: string; name: string }[]>([]);
  let courses = $state<{ id: string; title: string; version: string; reviewStatus: string }[]>([]);
  let assignments = $state<{ id: string; person: { id: string }; site: { id: string };
    requirement: { title: string }; dueAt: string; courseVersionId?: string; state: string }[]>([]);
  const eligiblePeople = $derived(people.filter((person) => !siteId || person.siteIds.includes(siteId)));
  const eligibleAssignments = $derived(assignments.filter((item) => item.person.id === personId
    && item.site.id === siteId && item.state !== 'closed'
    && (!item.courseVersionId || item.courseVersionId === courseVersionId)));
  const date = (value: string) => new Date(value).toLocaleString();
  const localInstant = (value: string) => {
    const instant = new Date(value);
    return new Date(instant.valueOf() - instant.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, init);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'The request failed. Try again.');
    return body;
  }
  const exportHref = $derived(`/api/completions/export?${new URLSearchParams(Object.entries(records.filters)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))}`);
  function countHref(state: string) {
    const params = new URLSearchParams(Object.entries(records.filters)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    params.set('state', state);
    return `/records?${params}`;
  }
  async function openForm(item?: CompletionRecord) {
    actionError = '';
    busy = true;
    try {
      const [p, s, c, a] = await Promise.all([
        request<{ items: typeof people }>('/api/people'), request<{ items: typeof sites }>('/api/sites'),
        request<{ items: typeof courses }>('/api/completions/options'), request<{ items: typeof assignments }>('/api/assignments')
      ]);
      people = p.items; sites = s.items; courses = c.items; assignments = a.items;
      correcting = item?.id ?? null;
      personId = item?.personId ?? ''; siteId = item?.siteId ?? ''; courseVersionId = item?.courseVersionId ?? '';
      completedAt = item ? localInstant(item.completedAt) : ''; sourceReference = item?.sourceReference ?? '';
      reason = ''; amendmentReason = ''; satisfyAssignment = false; assignmentId = '';
      if (item && !people.some((p) => p.id === item.personId)) people = [...people,
        { id: item.personId, displayName: item.personName, siteIds: [item.siteId] }];
      formOpen = true; voidOpen = false;
      requestAnimationFrame(() => document.getElementById('completion-form-heading')?.focus());
    } catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to open the form.'; }
    finally { busy = false; }
  }
  async function inspect(id: string) {
    loadingDetail = true; actionError = ''; voidOpen = false;
    try { selected = await request(`/api/completions/${id}`); }
    catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to open the record.'; }
    finally { loadingDetail = false; }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault(); busy = true; actionError = '';
    try {
      const replacement = { personId, siteId, courseVersionId, completedAt: new Date(completedAt).toISOString(),
        sourceReference, reason, satisfyAssignment, assignmentId: satisfyAssignment ? assignmentId : null };
      const result = await request<{ id: string; replacementId?: string }>(
        correcting ? `/api/completions/${correcting}` : '/api/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(correcting ? { kind: 'corrected', reason: amendmentReason, replacement } : replacement)
        });
      formOpen = false;
      message = correcting ? 'Correction recorded. The original remains in history.' : 'Manual completion recorded.';
      await invalidateAll();
      await inspect(result.replacementId ?? result.id);
    } catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to save the record.'; }
    finally { busy = false; }
  }
  async function voidRecord(event: SubmitEvent) {
    event.preventDefault(); if (!selected) return;
    busy = true; actionError = '';
    try {
      await request(`/api/completions/${selected.item.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'voided', reason: voidReason }) });
      message = 'Completion voided. Assignment status now uses the remaining effective evidence.';
      voidOpen = false; voidReason = ''; await invalidateAll(); await inspect(selected.item.id);
    } catch (cause) { actionError = cause instanceof Error ? cause.message : 'Unable to void the record.'; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Completion records · HSE Informer</title></svelte:head>
<a class="skip-link" href="#records-main">Skip to completion records</a>
<main id="records-main" class="records-content">
  <div class="page-heading"><div><p class="eyebrow">{data.actor.tenantName}</p><h1>{data.actor.role === 'learner' ? 'My transcript' : 'Completion records'}</h1><p>Inspect training evidence and its preserved history.</p></div>
    {#if canManage}<button class="primary" disabled={busy || !interactive} onclick={() => openForm()}>Record manual completion</button>{/if}
  </div>
  {#if message}<p class="notice" role="status">{message}</p>{/if}
  {#if actionError}<p class="banner" role="alert">{actionError}</p>{/if}
  <p class="scope-line">Beta test records · {records.scope} · As of {date(records.asOf)} · Completion records do not grant workplace authorization.</p>
  <form class="record-filters" method="GET">
    <label>Search<input name="search" value={records.filters.search ?? ''} placeholder="Person, course, version, reference" /></label>
    <label>Person<select name="personId" value={records.filters.personId ?? ''}><option value="">All people in scope</option>{#each peopleFilter as [id, name]}<option value={id}>{name}</option>{/each}</select></label>
    <label>Site<select name="siteId" value={records.filters.siteId ?? ''}><option value="">All sites in scope</option>{#each sitesFilter as [id, name]}<option value={id}>{name}</option>{/each}</select></label>
    <label>Course version<select name="courseVersionId" value={records.filters.courseVersionId ?? ''}><option value="">All versions</option>{#each coursesFilter as [id, title]}<option value={id}>{title}</option>{/each}</select></label>
    <label>Source<select name="source" value={records.filters.source ?? ''}><option value="">All sources</option><option value="manual">Manual</option><option value="moodle">Moodle</option></select></label>
    <label>State<select name="state" value={records.filters.state}><option value="effective">Effective</option><option value="all">All records and history</option><option value="superseded">Superseded</option><option value="voided">Voided</option></select></label>
    <label>Completed from (UTC)<input type="date" name="from" value={records.filters.from ?? ''} /></label>
    <label>Completed through (UTC)<input type="date" name="through" value={records.filters.through ?? ''} /></label>
    <button class="primary" type="submit">Apply filters</button><a href="/records">Clear filters</a>
  </form>
  <div class="record-results"><p>{records.total} matching {records.total === 1 ? 'record' : 'records'} · <a href={countHref('effective')}>Effective</a> · <a href={countHref('superseded')}>Superseded</a> · <a href={countHref('voided')}>Voided</a></p><a href={exportHref}>Export filtered CSV</a></div>
  <div class="table-wrap"><table><caption class="sr-only">Completion records matching the selected filters</caption><thead><tr><th scope="col">Person / site</th><th scope="col">Course / version</th><th scope="col">Completed</th><th scope="col">Score</th><th scope="col">Source / state</th><th scope="col">Action</th></tr></thead><tbody>
    {#each records.items as item}<tr><td><strong>{item.personName}</strong><small>{item.siteName}</small></td><td>{item.courseTitle}<small>{item.courseVersion}</small></td><td>{date(item.completedAt)}</td><td>{item.score === null ? 'Not recorded' : `${item.score}%`}</td><td>{item.source === 'manual' ? 'Manual' : 'Moodle'}<small>{item.state}</small></td><td><button class="text-button" disabled={!interactive} onclick={() => inspect(item.id)}>Inspect record</button></td></tr>
    {:else}<tr><td colspan="6">No completion records match these filters. Adjust the filters or record a manual completion.</td></tr>{/each}
  </tbody></table></div>
  {#if loadingDetail}<p role="status">Opening completion record…</p>{/if}
  {#if selected}
    <section class="record-panel" aria-labelledby="record-detail-heading"><div class="section-head"><h2 id="record-detail-heading">{selected.item.personName} · {selected.item.courseTitle}</h2><button class="text-button" onclick={() => selected = null}>Close record</button></div>
      <dl class="record-details"><div><dt>Record ID</dt><dd>{selected.item.id}</dd></div><div><dt>Course version</dt><dd>{selected.item.courseVersion}</dd></div><div><dt>Original completion</dt><dd>{date(selected.item.completedAt)}</dd></div><div><dt>Source / state</dt><dd>{selected.item.source} · {selected.item.state}</dd></div><div><dt>Score / attempts</dt><dd>{selected.item.score ?? 'No recorded score'} / {selected.item.attempts ?? 'No recorded attempt count'}</dd></div><div><dt>Recorded</dt><dd>{date(selected.item.recordedAt)}{#if selected.item.recordedByName} by {selected.item.recordedByName}{/if}</dd></div><div><dt>Source reference</dt><dd>{selected.item.sourceReference ?? 'Recorded assessment evidence'}</dd></div><div><dt>Assignment decision</dt><dd>{selected.item.assignmentId ? `Linked to assignment ${selected.item.assignmentId}` : 'Transcript only; does not satisfy an assignment'}</dd></div>{#if selected.item.reason}<div><dt>Reason</dt><dd>{selected.item.reason}</dd></div>{/if}</dl>
      {#if canManage && selected.item.state === 'effective'}<div class="record-actions"><button class="primary" disabled={busy} onclick={() => selected && openForm(selected.item)}>Correct record</button><button class="secondary" disabled={busy} onclick={() => { voidOpen = !voidOpen; voidReason = ''; }}>Void record</button></div>{/if}
      {#if voidOpen}<form onsubmit={voidRecord} class="record-amend-form"><h3>Void this completion</h3><p>The evidence and its attempts remain in history. This record will no longer satisfy an assignment.</p><label>Reason for voiding<textarea required minlength="3" maxlength="2000" bind:value={voidReason}></textarea></label><button class="primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Confirm void'}</button></form>{/if}
      <h3>Record history</h3><ol>{#each selected.history as item}<li><button class="text-button" onclick={() => inspect(item.id)}>{item.source} · {item.state} · completed {date(item.completedAt)}</button>{#if item.reason}<p>{item.reason}</p>{/if}</li>{/each}</ol>
      {#each selected.events as event}<p><strong>{event.kind}</strong> on {date(event.recordedAt)} by {event.recordedBy}: {event.reason}</p>{/each}
      {#if selected.assessmentSources.length}<details><summary>Moodle assessment and attempt evidence</summary><p>Original Moodle evidence is preserved separately from manual corrections. Attempt details shown here are the facts supplied by Moodle.</p>{#each selected.assessmentSources as source}<h4>Record {source.recordId} · {source.attemptCount ?? 'No reported'} attempts</h4><pre>{JSON.stringify(source.sourcePayload, null, 2)}</pre>{/each}</details>{/if}
      <details><summary>Preserved evidence snapshot</summary><pre>{JSON.stringify(selected.item.snapshot, null, 2)}</pre></details>
    </section>
  {/if}
  {#if formOpen}
    <section class="record-panel" aria-labelledby="completion-form-heading"><div class="section-head"><h2 id="completion-form-heading" tabindex="-1">{correcting ? 'Correct completion with a manual replacement' : 'Record manual completion'}</h2><button class="text-button" onclick={() => formOpen = false}>Cancel</button></div>
      <p>Manual records preserve the original completion date and reference. They contain no assessment attempt or passing score.</p>
      <form onsubmit={save} class="record-editor">
        <label>Site<select required bind:value={siteId} disabled={Boolean(correcting)} onchange={() => { personId = ''; assignmentId = ''; }}><option value="">Choose site</option>{#each sites as site}<option value={site.id}>{site.name}</option>{/each}</select></label>
        <label>Person<select required bind:value={personId} disabled={Boolean(correcting)} onchange={() => assignmentId = ''}><option value="">Choose person</option>{#each eligiblePeople as person}<option value={person.id}>{person.displayName}</option>{/each}</select></label>
        <label>Exact course version<select required bind:value={courseVersionId} onchange={() => assignmentId = ''}><option value="">Choose course version</option>{#each courses as course}<option value={course.id}>{course.title} · {course.version} ({course.reviewStatus})</option>{/each}</select></label>
        <label>Original completion date and time (your local time)<input required type="datetime-local" bind:value={completedAt} /></label>
        <label class="wide">Original source / reference<input required maxlength="1000" bind:value={sourceReference} placeholder="Certificate, instructor record, or original evidence reference" /></label>
        <label class="wide">Reason for recording<textarea required minlength="3" maxlength="2000" bind:value={reason}></textarea></label>
        {#if correcting}<label class="wide">Reason for correcting the previous record<textarea required minlength="3" maxlength="2000" bind:value={amendmentReason}></textarea></label>{/if}
        <label class="check-label wide"><input type="checkbox" bind:checked={satisfyAssignment} onchange={() => assignmentId = ''} />I decide that this evidence satisfies a matching assignment</label>
        {#if satisfyAssignment}<label class="wide">Matching assignment<select required bind:value={assignmentId}><option value="">Choose assignment</option>{#each eligibleAssignments as item}<option value={item.id}>{item.requirement.title} · due {date(item.dueAt)} · {item.id}</option>{/each}</select><span class="help">The server verifies the exact person, site, and course version before linking. No matching open assignment means this record can only be added to the transcript.</span></label>{:else}<p class="wide">This record will appear in the transcript and will not satisfy an assignment.</p>{/if}
        <button class="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : correcting ? 'Record correction' : 'Save manual completion'}</button>
      </form>
    </section>
  {/if}
</main>

<style>
  .records-content { max-width:1400px; margin:auto; padding:32px 28px 80px; }
  .scope-line,.help { color:var(--hse-color-muted); font-size:var(--hse-text-xs); }
  .record-filters,.record-editor { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; align-items:end; margin-bottom:24px; }
  .record-filters input,.record-filters select,.record-editor input,.record-editor select { width:100%; min-width:0; }
  .record-results,.record-actions { display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px; align-items:center; margin:16px 0; }
  td small { display:block; color:var(--hse-color-muted); margin-top:4px; overflow-wrap:anywhere; }
  .record-panel { min-width:0; overflow-wrap:anywhere; margin-top:24px; border:1px solid var(--hse-color-border); border-radius:var(--hse-radius-card); background:var(--hse-color-surface); padding:24px; }
  .record-panel .text-button { white-space:normal; text-align:left; }
  .record-details { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
  dt { color:var(--hse-color-muted); } dd { margin:4px 0 0; overflow-wrap:anywhere; }
  .record-actions { justify-content:flex-start; }
  .secondary { min-height:44px; border:1px solid var(--hse-color-control-border); border-radius:var(--hse-radius-control); background:var(--hse-color-surface); color:var(--hse-color-brand); padding:8px 16px; }
  .record-editor { grid-template-columns:repeat(2,minmax(0,1fr)); }
  textarea { font:inherit; color:inherit; min-height:90px; padding:10px; border:1px solid var(--hse-color-control-border); border-radius:var(--hse-radius-control); resize:vertical; }
  .wide { grid-column:1/-1; }
  .check-label { display:flex; align-items:center; gap:10px; }
  .check-label input { width:24px; height:24px; }
  pre { max-width:100%; overflow:auto; background:var(--hse-color-surface-subtle); padding:16px; border-radius:var(--hse-radius-control); }
  .record-amend-form { display:grid; gap:16px; margin:24px 0; }
  @media(max-width:900px) { .record-filters { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media(max-width:550px) { .records-content { padding:24px 16px 60px; } .page-heading { flex-direction:column; align-items:flex-start; } .record-filters,.record-editor,.record-details { grid-template-columns:minmax(0,1fr); } .record-panel { padding:16px; } }
</style>
