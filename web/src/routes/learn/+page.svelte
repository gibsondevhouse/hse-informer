<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let filter = $state('open');
  let interactive = $state(false);
  onMount(() => {
    interactive = true;
    const refresh = () => { if (!document.hidden) void invalidateAll(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  });
  const visible = $derived(data.assignments.filter(a => filter === 'all' || (filter === 'completed' ? a.knowledgeComplete : !a.knowledgeComplete)));
  const date = (value: string, zone = 'UTC') => {
    try { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: zone }).format(new Date(value)); }
    catch { return 'Time zone pending'; }
  };
  const dueDate = (value: string, zone?: string | null) => zone ? date(value, zone) : 'Time zone pending';
  const labels: Record<string, string> = { not_started:'Not started', progress_unknown:'Progress not confirmed', in_progress:'In progress', knowledge_complete:'Knowledge complete', overdue:'Overdue', needs_review:'Needs review', closed:'Closed' };
</script>
<svelte:head><title>My training · HSE Informer</title></svelte:head>
<main class="learning-page">
  <header><p class="eyebrow">LEARNER WORKSPACE</p><h1>My training</h1><p>Welcome, {data.actor.displayName}. Take your assigned courses and follow your learning history.</p></header>
  <aside class="beta-note">Beta test records · Course completion records knowledge gained. It does not grant workplace authorization.</aside>
  <section aria-labelledby="assigned-heading">
    <div class="section-head"><h2 id="assigned-heading">Assigned training</h2><label>Show <select bind:value={filter} disabled={!interactive}><option value="open">To complete</option><option value="completed">Completed</option><option value="all">All training</option></select></label></div>
    <p class="due">Due dates use the site's time zone. Due soon means today through seven calendar days ahead. Moodle progress is checked during synchronization.</p>
    <div class="course-grid">{#each visible as assignment (assignment.id)}
      <article><p class="eyebrow">{assignment.site.name}</p><h3>{assignment.requirement.title}</h3><span class:overdue={assignment.state === 'overdue'} class="status">{labels[assignment.state] || assignment.state}</span>{#if assignment.dueSoon}<span class="status">Due soon</span>{/if}<p>{assignment.reason}</p><p class="due">Due {dueDate(assignment.dueAt, data.siteZones[assignment.site.id])}</p>
        {#if !assignment.knowledgeComplete && assignment.progress.observedAt}
          <p class="due">Moodle progress checked {date(assignment.progress.observedAt, data.siteZones[assignment.site.id] || 'UTC')}.
            {#if assignment.progress.status === 'unknown'}No start could be confirmed from the available Moodle activity.{:else if assignment.progress.activitiesWithProgress !== null}{assignment.progress.activitiesWithProgress} of {assignment.progress.trackedActivities} tracked activities have recorded progress.{/if}
          </p>
        {/if}
        {#if assignment.launchUrl}<a class="primary" href={assignment.launchUrl}>Open course in Moodle ↗</a>{:else}<p class="pending">Enrollment is being prepared. Contact your administrator if this persists.</p>{/if}
      </article>
    {:else}<p class="empty">{filter === 'open' ? 'You have no outstanding training.' : 'No training matches this view.'}</p>{/each}</div>
  </section>
  <section aria-labelledby="history-heading"><h2 id="history-heading">Completion history</h2><p>Verified Moodle completions and any clearly labeled administrative records. <a href="/records">View record details</a></p>
    <div class="table-scroll"><table><thead><tr><th>Course</th><th>Version</th><th>Completed</th><th>Score</th><th>Source</th></tr></thead><tbody>{#each data.history.items as record (record.id)}<tr><td>{record.courseTitle}</td><td>{record.courseVersion}</td><td>{date(record.completedAt)}</td><td>{record.score === null ? '—' : record.score}</td><td>{record.source === 'moodle' ? 'Moodle' : 'Manual entry'}</td></tr>{:else}<tr><td colspan="5">No completion records yet. Moodle results appear after synchronization.</td></tr>{/each}</tbody></table></div>
  </section>
</main>
<style>
  :global(body){margin:0;background:#f5f7fa;color:#172b3a;font-family:Arial,sans-serif} .learning-page{max-width:1120px;margin:auto;padding:40px 24px 80px} h1{font-size:36px;letter-spacing:-1px;margin:8px 0 12px} h2{font-size:23px;margin:0} header p{color:#536474;line-height:1.7}.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.5px;color:#607381}.beta-note{padding:16px 20px;background:#e6edf5;border-left:3px solid #426c91;font-size:14px;margin:26px 0 36px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px} select{padding:10px;margin-left:8px;border:1px solid #b9c6d0;border-radius:5px;background:white;font:inherit}.course-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{padding:24px;background:white;border:1px solid #d9e1e7;border-radius:10px}h3{font-size:21px;margin:8px 0 16px}article p{line-height:1.6}.status{font-size:12px;padding:5px 9px;background:#e9eff5;border-radius:20px}.overdue{background:#fce8e5;color:#933028}.primary{display:inline-block;text-decoration:none;background:#174569;color:white;padding:12px 16px;border-radius:6px;font-weight:600}.due,.pending{font-size:13px;color:#5b6c7a}.empty{padding:30px;background:white;border:1px dashed #bccbd5;border-radius:8px}section+section{margin-top:44px}.table-scroll{overflow:auto;background:white;border:1px solid #d9e1e7;border-radius:8px}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:15px 18px;border-bottom:1px solid #e2e8ed}th{font-size:12px;color:#536474;background:#edf2f6}a{color:#174569}:global(a:focus-visible),select:focus-visible{outline:3px solid #578dbe;outline-offset:3px}@media(max-width:520px){.learning-page{padding:24px 16px}.section-head{align-items:flex-start;flex-direction:column}h1{font-size:30px}}
</style>
