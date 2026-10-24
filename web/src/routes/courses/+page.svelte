<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import '../workspace.css';
  let { data }: { data: PageData } = $props();
  let notice = $state('');
  let problem = $state('');
  let saving = $state(false);
  let interactive = $state(false);
  onMount(() => { interactive = true; });
  let creating = $state(false);
  let verifying = $state<string | null>(null);
  let verificationNote = $state('');
  let requirementId = $state('');
  let code = $state('');
  let title = $state('');
  let version = $state('1.0');
  let sourceContentId = $state('');
  let packageSha256 = $state('');
  let moodleCourseId = $state('');
  let moodleActivityId = $state('');
  let moodleScormId = $state('');
  let moodleQuizId = $state('');
  let assessmentKind = $state<'none' | 'scorm' | 'quiz'>('none');
  let practiceOnly = $state(false);
  let exportFormat = $state('scorm_1_2');
  let language = $state('en-US');
  let authority = $state('Employer-authored content; HSE review pending');
  let audience = $state('Assigned workers');
  const manages = $derived(['tenant_admin', 'hse_reviewer'].includes(data.actor.role));
  const date = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));

  async function save(url: string, method: string, value: unknown) {
    saving = true; problem = ''; notice = '';
    try {
      const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Unable to save course');
      await invalidateAll();
      return true;
    } catch (cause) { problem = cause instanceof Error ? cause.message : 'Unable to save course'; return false; }
    finally { saving = false; }
  }
  async function create(event: SubmitEvent) {
    event.preventDefault();
    const done = await save('/api/courses', 'POST', {
      ...(requirementId ? { requirementId } : {}), code, title, version, sourceContentId,
      packageSha256, moodleCourseId: Number(moodleCourseId),
      moodleActivityId: assessmentKind !== 'none' && moodleActivityId ? Number(moodleActivityId) : null,
      moodleScormId: assessmentKind === 'scorm' && moodleScormId ? Number(moodleScormId) : null,
      moodleQuizId: assessmentKind === 'quiz' && moodleQuizId ? Number(moodleQuizId) : null,
      practiceOnly, exportFormat, language, authority, audience
    });
    if (done) { creating = false; notice = 'Draft course mapping saved. Verify completion behavior before publishing.'; }
  }
  async function change(id: string, action: string) {
    const done = await save(`/api/courses/${id}`, 'PATCH', { action, ...(action === 'verify' ? { note: verificationNote } : {}) });
    if (done) { verifying = null; verificationNote = ''; notice = action === 'retire' ? 'Course retired. Existing records are preserved.' : 'Course review saved.'; }
  }
</script>

<svelte:head><title>Courses · HSE Informer</title></svelte:head>
<a href="#course-content" class="skip-link">Skip to courses</a>
<div class="course-shell">
  <main id="course-content">
    <div class="heading"><div><p class="eyebrow">{data.actor.tenantName} · TRAINING ADMINISTRATION</p><h1>Courses</h1><p>Publish reviewed course versions delivered through Moodle.</p></div>
      {#if manages}<button class="primary" disabled={!interactive || saving} aria-expanded={creating} aria-controls="new-course-panel" onclick={() => creating = !creating}>{creating ? 'Close form' : 'Add course version'}</button>{/if}
    </div>
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    {#if creating}
      <section id="new-course-panel" class="panel" aria-labelledby="new-course-title">
        <h2 id="new-course-title">Add a Moodle course version</h2>
        <p>Upload or author the course in Moodle first. Each version needs its own immutable package checksum and mapping. Learning, assessments, attempts, and resume progress stay in Moodle.</p>
        <form onsubmit={create} class="course-form">
          <label>Training requirement<select bind:value={requirementId}><option value="">Create a new general awareness requirement</option>{#each data.requirements as requirement}<option value={requirement.id}>{requirement.code} · {requirement.title}</option>{/each}</select></label>
          <div class="fields"><label>Program code<input required maxlength="80" bind:value={code} /></label><label>Course title<input required maxlength="250" bind:value={title} /></label></div>
          <div class="fields"><label>Source content ID<input required bind:value={sourceContentId} placeholder="e.g. PBJ-101" /></label><label>Source version<input required bind:value={version} /></label><label>Language<input required bind:value={language} /></label></div>
          <label>Package SHA-256<input required pattern={'[a-f0-9]{64}'} minlength="64" maxlength="64" bind:value={packageSha256} aria-describedby="checksum-help" /></label>
          <small id="checksum-help">Checksum of the reviewed package or content archive. A changed package requires a new version.</small>
          <div class="fields"><label>Moodle course ID<input required type="number" min="1" step="1" bind:value={moodleCourseId} /></label><label>Delivery format<select bind:value={exportFormat}><option value="scorm_1_2">SCORM 1.2</option><option value="lti">LTI</option><option value="url">Moodle lessons and quiz</option><option value="video">Video</option><option value="unknown">Other reviewed Moodle content</option></select></label></div>
          <label>Assessment mapping<select bind:value={assessmentKind}><option value="none">Course completion only</option><option value="scorm">SCORM activity</option><option value="quiz">Native Moodle quiz</option></select></label>
          {#if assessmentKind !== 'none'}
            <div class="fields"><label>Moodle activity module ID<input required type="number" min="1" step="1" bind:value={moodleActivityId} /></label>
              {#if assessmentKind === 'scorm'}<label>SCORM instance ID<input required type="number" min="1" step="1" bind:value={moodleScormId} /></label>
              {:else}<label>Moodle quiz instance ID<input required type="number" min="1" step="1" bind:value={moodleQuizId} /></label>{/if}
            </div>
            <small>Use the exact activity module and {assessmentKind === 'quiz' ? 'quiz' : 'SCORM'} instance IDs from the mapped Moodle course.</small>
          {/if}
          <label class="check"><input type="checkbox" bind:checked={practiceOnly} />Practice content only · no safety training or workplace authorization claim</label>
          {#if !requirementId && !practiceOnly}<label>Authority and scope<textarea required bind:value={authority}></textarea></label><label>Audience<input required bind:value={audience} /></label>{/if}
          <button class="primary" disabled={saving || !interactive} type="submit">{saving ? 'Saving…' : 'Save draft mapping'}</button>
        </form>
      </section>
    {/if}
    {#if data.courses.length === 0}<section class="panel empty"><h2>No course versions yet</h2><p>Add a Moodle mapping to begin reviewing and assigning training.</p></section>{/if}
    <div class="course-list">
      {#each data.courses as course}
        <article class="panel">
          <div class="course-top"><div><p class="eyebrow">{course.code} · VERSION {course.version}</p><h2>{course.title}</h2></div><span class:published={course.reviewStatus === 'approved'} class="badge">{course.reviewStatus === 'approved' ? 'Published' : course.reviewStatus === 'unapproved' ? 'Draft' : 'Retired'}</span></div>
          {#if course.practiceOnly}<p class="practice">Practice course · no safety training or workplace authorization claim</p>{/if}
          <dl><div><dt>Delivery</dt><dd>Moodle course {course.moodleCourseId ?? 'not mapped'} · {course.language}</dd></div><div><dt>Requirement review</dt><dd>{course.requirementReviewStatus === 'approved' ? 'Approved' : 'HSE review required'}</dd></div><div><dt>Completion verification</dt><dd>{course.completionVerified ? 'Verified' : 'Required before publication'}</dd></div>{#if course.reviewedBy}<div><dt>Published by</dt><dd>{course.reviewedBy}{course.reviewedAt ? ` · ${date(course.reviewedAt)}` : ''}</dd></div>{/if}</dl>
          <details><summary>Package and verification details</summary><p>Source: {course.sourceContentId} · {course.exportFormat}</p>
            {#if course.moodleQuizId}<p>Assessment: native Moodle quiz {course.moodleQuizId} · activity module {course.moodleActivityId}</p>
            {:else if course.moodleScormId}<p>Assessment: SCORM {course.moodleScormId} · activity module {course.moodleActivityId}</p>
            {:else}<p>Assessment mapping: course completion only</p>{/if}
            <p class="digest">SHA-256: {course.packageSha256}</p>{#if course.verificationNote}<p class="verification">{course.verificationNote}</p>{/if}</details>
          <div class="actions">
            {#if course.launchUrl}<a href={course.launchUrl} target="_blank" rel="noreferrer">Open in Moodle ↗</a>{/if}
            {#if manages && course.reviewStatus === 'unapproved'}
              {#if course.requirementReviewStatus === 'unapproved' && (data.actor.role === 'hse_reviewer' || course.practiceOnly)}<button disabled={saving || !interactive} onclick={() => change(course.id, 'approve-requirement')}>Approve requirement</button>{/if}
              <button disabled={saving || !interactive} aria-expanded={verifying === course.id} aria-controls={`verify-${course.id}`} onclick={() => { verifying = verifying === course.id ? null : course.id; }}>Verify Moodle completion</button>
              {#if data.actor.role === 'hse_reviewer' || course.practiceOnly}<button class="primary" disabled={saving || !interactive || !course.completionVerified || course.requirementReviewStatus !== 'approved'} onclick={() => change(course.id, 'approve')}>Publish version</button>{/if}
            {/if}
            {#if manages && course.reviewStatus === 'approved'}<button disabled={saving || !interactive} onclick={() => change(course.id, 'retire')}>Retire version</button>{/if}
          </div>
          {#if verifying === course.id}
            <form id={`verify-${course.id}`} class="verify-form" onsubmit={(event) => { event.preventDefault(); change(course.id, 'verify'); }}>
              <p>Test a learner's fail, retry, pass, attempt limit, resume, and completion synchronization in Moodle. The server also checks that the mapped course is visible and completion tracking is enabled.{course.moodleQuizId ? ' It confirms the quiz and activity belong to that course.' : ''}</p>
              <label>Verification evidence and configured criteria<textarea required minlength="15" maxlength="3000" bind:value={verificationNote} placeholder="Record tested criteria, pass mark, attempt limit, remediation, and test evidence location."></textarea></label>
              <button class="primary" type="submit" disabled={saving || !interactive}>Save verification</button>
            </form>
          {/if}
        </article>
      {/each}
    </div>
  </main>
</div>

<style>
  .course-shell { max-width: 1280px; margin: 0 auto; padding: 0 28px 60px; }
  main { padding-top: 36px; } .heading,.course-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  h1 { font-size: 32px; margin: 7px 0; letter-spacing: -.035em; } h2 { font-size: 21px; margin: 5px 0 14px; } p { margin: 10px 0; } .eyebrow { margin: 0; }
  .heading>div>p:last-child,.panel>p,dt,small { color: var(--hse-color-muted); } .course-list { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,440px),1fr)); gap: 20px; margin-top: 25px; }
  .panel { padding: 25px; background: var(--hse-color-surface); border: 1px solid var(--hse-color-border); border-radius: var(--hse-radius-control); min-width: 0; }
  .heading+.panel,.notice,.problem { margin-top: 22px; } .badge { white-space: nowrap; background: var(--hse-color-surface-subtle); border: 1px solid var(--hse-color-border); padding: 4px 10px; border-radius: 99px; font-size: 12px; } .published { background: var(--hse-color-brand-subtle); color: var(--hse-color-brand); }
  dl { display: grid; gap: 12px; margin: 20px 0; } dl>div { display: flex; justify-content: space-between; gap: 20px; } dd { margin: 0; text-align: right; } dt { flex-shrink: 0; }
  .course-form,.verify-form { display: grid; gap: 17px; } .fields { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 17px; } label { display: grid; gap: 7px; font-weight: 600; } input,select,textarea { width: 100%; min-height: 42px; padding: 9px 10px; border: 1px solid var(--hse-color-border); border-radius: var(--hse-radius-control); background: var(--hse-color-surface); color: var(--hse-color-ink); font: inherit; } textarea { min-height: 100px; resize: vertical; } .check { display: flex; align-items: center; } .check input { width: 18px; min-height: 18px; }
  button { min-height: 40px; border-radius: var(--hse-radius-control); border: 1px solid var(--hse-color-border); background: var(--hse-color-surface); padding: 8px 13px; color: var(--hse-color-brand); font-weight: 600; } button.primary { color: white; border-color: var(--hse-color-brand); background: var(--hse-color-brand); } button:disabled { opacity: .55; } .course-form>button { justify-self: start; } .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 20px; } .actions>a { margin-right: auto; } .digest { overflow-wrap: anywhere; font-size: 12px; } .verification { white-space: pre-wrap; } details { padding-top: 12px; border-top: 1px solid var(--hse-color-divider); } summary { cursor: pointer; color: var(--hse-color-brand); } .practice { padding: 9px 12px; background: var(--hse-color-surface-subtle); } .verify-form { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--hse-color-divider); } .notice { padding: 13px; background: var(--hse-color-brand-subtle); } .problem { padding: 13px; background: #fff0ed; color: #992b18; }
  @media(max-width:760px) { .course-shell { padding: 0 17px 40px; } .heading { align-items: stretch; flex-direction: column; } .heading>button { align-self: start; } .panel { padding: 19px; } dl>div { display: grid; gap: 4px; } dd { text-align: left; } }
</style>
