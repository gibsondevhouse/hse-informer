<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { previewCourses, previewSteps, respiratoryCourse, scenarioOptions } from '../../../lib/preview/courses';
  import { draftLesson, draftReferences } from '../../../lib/preview/lesson';
  import { paginatePageParts, refinePageBlocks, splitPageBlock, type PageBlock, type PagePart } from '../../../lib/preview/pagination';
  import './preview.css';

  const themeKey = 'hse-learner-theme';
  let step = $state(0);
  let completed = $state<number[]>([]);
  let answer = $state('');
  let checked = $state(false);
  let finished = $state(false);
  let expanded = $state(false);
  let drawerOpen = $state(false);
  let dark = $state(false);
  let readingArea: HTMLElement;
  let measure: HTMLElement;
  let visiblePage: HTMLElement;
  let referencesDialog: HTMLDialogElement;
  let depths = $state<Record<number, number>>({});
  let pages = $state<number[][]>([[0]]);
  let layoutReady = $state(false);
  let anchor = $state({ source: 0, part: 0 });
  let available = $derived(Math.min(Math.max(0, ...completed) + 1, 5));
  let correct = $derived(checked && answer === 'stop');
  let blocks = $derived.by((): PageBlock[] => {
    if (step !== 4) {
      const content: PageBlock[] = [...(draftLesson[step] ?? [])];
      if (step === 5 && finished) content.push({ kind: 'success', text: 'Draft preview finished. This is a device-only preview marker. No Moodle completion, assignment, evidence, or authorization was created.' });
      return content;
    }
    if (checked) return [
      { kind: 'title', text: correct ? 'That is the protective decision.' : 'Consider the changed conditions.' },
      { kind: correct ? 'success' : 'warning', text: scenarioOptions.find((option) => option.id === answer)?.feedback ?? '' },
      { kind: 'text', text: correct ? 'Continue to the opening lesson recap.' : 'Choose another response, then check your answer again.' },
      { kind: 'context', text: 'Practice only. This response is not recorded as a training assessment.' }
    ];
    return [
      { kind: 'title', text: 'The exhaust stops during bag charging.' },
      { kind: 'lead', text: 'You are adding powder to a mixer. Local exhaust ventilation stops, and a dust cloud escapes. A moment later, the cloud is less visible. You feel fine.' },
      { kind: 'text', title: 'What should you do next?', text: '' },
      ...scenarioOptions.map((option, optionIndex) => ({ kind: 'scenario-choice' as const, optionId: option.id, optionIndex, text: option.text })),
      { kind: 'check-answer', text: 'Check answer' },
      { kind: 'context', text: 'Practice only. This response is not recorded as a training assessment.' }
    ];
  });
  let parts = $derived(refinePageBlocks(blocks, depths));
  let pageIndex = $derived.by(() => {
    const exact = pages.findIndex((page) => page.some((index) => parts[index]?.source === anchor.source && parts[index]?.part === anchor.part));
    if (exact >= 0) return exact;
    return Math.max(0, pages.findIndex((page) => page.some((index) => parts[index]?.source === anchor.source)));
  });
  let page = $derived(pages[pageIndex] ?? [0]);
  let lastPage = $derived(pageIndex === pages.length - 1);

  $effect(() => {
    const currentParts = parts;
    const viewport = readingArea;
    const measured = measure;
    if (!viewport || !measured || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const recalculate = () => {
      const heights = Array.from(measured.children, (child) => child.getBoundingClientRect().height);
      if (!viewport.clientHeight || heights.length !== currentParts.length) return;
      const currentDepths = untrack(() => depths);
      const oversized = currentParts.filter((part, index) => heights[index] > viewport.clientHeight - 2 && splitPageBlock(part).length > 1 && (currentDepths[part.source] ?? 0) < 8);
      if (oversized.length) {
        const next = { ...currentDepths };
        for (const part of oversized) next[part.source] = (currentDepths[part.source] ?? 0) + 1;
        depths = next;
        return;
      }
      const next = paginatePageParts(currentParts, heights, viewport.clientHeight - 2);
      if (JSON.stringify(untrack(() => pages)) !== JSON.stringify(next)) pages = next;
      layoutReady = true;
    };
    const update = () => {
      layoutReady = false;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recalculate);
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    for (const child of measured.children) observer.observe(child);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  });

  onMount(() => {
    try { dark = localStorage.getItem(themeKey) === 'dark'; } catch { /* Device preference is optional. */ }
  });

  function themeToggle() {
    dark = !dark;
    try { localStorage.setItem(themeKey, dark ? 'dark' : 'light'); } catch { /* Display preference only. */ }
  }
  function focusReadingArea() {
    requestAnimationFrame(() => {
      readingArea?.scrollTo({ top: 0 });
      visiblePage?.focus({ preventScroll: true });
    });
  }
  function resetPages() {
    layoutReady = false;
    depths = {};
    pages = [[0]];
    anchor = { source: 0, part: 0 };
  }
  function changePage(target: number) {
    const part = parts[pages[target]?.[0]];
    if (!part) return;
    anchor = { source: part.source, part: part.part };
    focusReadingArea();
  }
  function move(target: number) {
    if (target !== 0 && target > available && !completed.includes(target)) return;
    step = target;
    resetPages();
    drawerOpen = false;
    if (target > 0) expanded = true;
    focusReadingArea();
  }
  function advance() {
    if (!layoutReady) return;
    if (!lastPage) { changePage(pageIndex + 1); return; }
    if (step === 4 && !correct) {
      if (checked) { checked = false; answer = ''; resetPages(); focusReadingArea(); }
      return;
    }
    if (step === 5) {
      if (finished) { move(1); return; }
      completed = [...new Set([...completed, 5])].sort((a, b) => a - b);
      finished = true;
      resetPages();
      focusReadingArea();
      return;
    }
    if (step > 0) completed = [...new Set([...completed, step])].sort((a, b) => a - b);
    step = Math.min(step + 1, 5);
    resetPages();
    expanded = true;
    focusReadingArea();
  }
  function goBack() { if (pageIndex > 0) changePage(pageIndex - 1); else if (step > 0) move(step - 1); }
  function chooseAnswer(value: string) { answer = value; checked = false; }
  function resume() { move(step === 0 ? available : step); }
  function checkAnswer() { checked = true; resetPages(); focusReadingArea(); }
</script>

{#snippet renderBlock(block: PagePart, measuring: boolean)}
  {#if block.kind === 'title'}<h1>{block.text}</h1>
  {:else if block.kind === 'lead'}<p class="lead">{block.text}</p>
  {:else if block.kind === 'context'}<p class="context">{block.text}</p>
  {:else if block.kind === 'objective'}<p class="objective"><span aria-hidden="true">✓</span>{block.text}</p>
  {:else if block.kind === 'example'}<section class="example"><h2>{block.title}</h2><p>{block.text}</p></section>
  {:else if block.kind === 'hazard'}<section class="hazard"><h2>{block.title}<small>{block.subtitle}</small></h2>{#if block.text}<p>{block.text}</p>{/if}{#if block.example}<p class="context"><strong>{block.title} at work:</strong> {block.example}</p>{/if}</section>
  {:else if block.kind === 'note'}<div class="note">{#if block.title}<strong>{block.title}</strong>{/if}<p>{block.text}</p></div>
  {:else if block.kind === 'warning'}<div class="warning">{#if block.title}<strong>{block.title}</strong>{/if}<p>{block.text}</p></div>
  {:else if block.kind === 'success'}<p class="success">{block.text}</p>
  {:else if block.kind === 'recap'}<p class="recap"><strong>{block.title}</strong> {block.text}</p>
  {:else if block.kind === 'scenario-choice'}<label class:chosen={answer === block.optionId} class="scenario-choice"><input type="radio" name="scenario-response" value={block.optionId} aria-label={scenarioOptions[block.optionIndex ?? 0].text} checked={answer === block.optionId} disabled={measuring} onchange={() => { if (!measuring && block.optionId) chooseAnswer(block.optionId); }} /><span><strong>{String.fromCharCode(65 + (block.optionIndex ?? 0))}.</strong> {block.text}</span></label>
  {:else if block.kind === 'check-answer'}<button class="primary-button check-answer" disabled={!answer || measuring} onclick={checkAnswer}>Check answer →</button>
  {:else}<section>{#if 'title' in block && block.title}<h2>{block.title}</h2>{/if}<p>{block.text}</p></section>{/if}
{/snippet}

<svelte:head>
  <title>Respiratory Protection · Draft training preview | HSE Informer</title>
  <meta name="description" content="Read-only draft Respiratory Protection lesson preview. No training or authorization record is created." />
</svelte:head>

<div class="preview-player" data-theme={dark ? 'dark' : 'light'}>
  <a class="skip-link" href="#lesson-content">Skip to lesson</a>
  <header class="preview-header">
    <a class="preview-brand" href="/" aria-label="HSE Informer admin home"><span aria-hidden="true">◈</span> HSE Informer</a>
    <span class="breadcrumb">Training <span aria-hidden="true">›</span> Respiratory Protection</span>
    <div class="header-actions">
      <button class="quiet-button theme-button" aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Use light theme' : 'Use dark theme'} onclick={themeToggle}>{dark ? '☀' : '☾'}</button>
      <a class="quiet-button return-link" href="/">← <span>Return to admin</span></a>
    </div>
  </header>
  <div class="preview-bar"><span><strong>Admin preview</strong><span class="draft-tag">Draft · Opening lesson</span></span><span>Preview activity does not affect training records.</span></div>
  <div class="preview-layout">
    {#if drawerOpen}<button class="drawer-backdrop" aria-label="Close course outline" onclick={() => drawerOpen = false}></button>{/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- Keep the independently scrollable outline keyboard-reachable. -->
    <aside class:drawer-open={drawerOpen} class="course-outline" aria-label="Course outline" tabindex="0">
      <div class="outline-heading"><h2>Respiratory Protection</h2><p>9 planned lessons</p><button class="mobile-close" aria-label="Close course outline" onclick={() => drawerOpen = false}>×</button></div>
      <button class:current={step === 0} class="outline-intro" aria-current={step === 0 ? 'step' : undefined} onclick={() => move(0)}>▤ <span>Course introduction</span></button>
      <ol class="lesson-outline">
        {#each respiratoryCourse.lessons as lesson, index}
          <li>
            {#if index === 0}
              <div class:current={step > 0} class="lesson-row">
                <div class="lesson-number-group"><span class="lesson-number">01</span><button class="expand-button" aria-label={expanded ? 'Collapse lesson 1 sections' : 'Expand lesson 1 sections'} aria-expanded={expanded} onclick={() => expanded = !expanded}>{expanded ? '⌃' : '⌄'}</button></div>
                <button class="lesson-link" onclick={resume}><span>{lesson}<small>{completed.length} of 5 sections completed in preview</small></span><span aria-hidden="true">▶</span></button>
              </div>
              {#if expanded}
                <ol class="section-outline">{#each previewSteps.slice(1) as title, sectionIndex}
                  {@const section = sectionIndex + 1}
                  <li><button class:current={step === section} aria-current={step === section ? 'step' : undefined} disabled={section > available && !completed.includes(section)} onclick={() => move(section)}><span class="step-symbol" aria-hidden="true">{completed.includes(section) ? '✓' : section > available ? '⌁' : '○'}</span><span>{title}<small>{completed.includes(section) ? 'Completed in preview' : step === section ? 'Current section' : section > available ? 'Complete the previous section' : 'Ready to start'}</small></span></button></li>
                {/each}</ol>
              {/if}
            {:else}
              <div class="lesson-row planned"><span class="lesson-number">{String(index + 1).padStart(2, '0')}</span><span>{lesson}<small>In development</small></span><span aria-label="Not yet available">⌁</span></div>
            {/if}
          </li>
        {/each}
      </ol>
      <p class="outline-boundary">Local instruction and employer authorization remain separate.</p>
      <details class="other-drafts"><summary>All five draft outlines · 48 lessons</summary>{#each previewCourses.slice(1) as course}<h3>{course.title}</h3><ol>{#each course.lessons as title}<li>{title}</li>{/each}</ol>{/each}<p>Reference syllabi only. No course is approved for delivery.</p></details>
    </aside>
    <main id="lesson-content" class="lesson-main" tabindex="-1">
      <div class="lesson-position"><button class="quiet-button outline-trigger" onclick={() => drawerOpen = true}>☰ <span>Outline</span></button><span>{step === 0 ? 'Course introduction' : `Lesson 01 · Section ${step} of 5`}</span><button class="quiet-button references-button" onclick={() => referencesDialog?.showModal()}>ⓘ <span>References</span></button></div>
      <article class="lesson-canvas" aria-label={previewSteps[step]}>
        <div class="lesson-stage">
          <div class="lesson-measure" bind:this={measure} aria-hidden="true" inert>
            {#each parts as part (part.source + ':' + part.part)}<div class="content-block">{@render renderBlock(part, true)}</div>{/each}
          </div>
          <div class="reading-area" bind:this={readingArea} aria-busy={!layoutReady}>
            <div class="page-content" bind:this={visiblePage} tabindex="-1" aria-label={`${previewSteps[step]}, page ${pageIndex + 1} of ${pages.length}`}>
              {#each page as index (index)}
                {#if parts[index]}<div class="content-block" data-source={parts[index].source} data-part={parts[index].part}>{@render renderBlock(parts[index], false)}</div>{/if}
              {/each}
            </div>
          </div>
        </div>
        <nav class="lesson-controls" aria-label="Lesson navigation"><button class="quiet-button" disabled={!layoutReady || (step === 0 && pageIndex === 0)} onclick={goBack}>← Back</button><span aria-live="polite">{pageIndex + 1} / {pages.length}<small>{previewSteps[step]}</small></span><button class="primary-button" disabled={!layoutReady || (lastPage && step === 4 && !checked)} onclick={advance}>{!lastPage ? 'Next' : step === 0 ? 'Start lesson 1' : step === 4 && checked && !correct ? 'Try again' : step === 5 ? finished ? 'Review lesson' : 'Finish preview' : 'Continue'} →</button></nav>
      </article>
    </main>
  </div>
  <dialog class="references-dialog" bind:this={referencesDialog}><form method="dialog"><button class="close-button" aria-label="Close references">×</button></form><h2>Draft lesson references</h2><p>These sources support the opening draft. Technical review, worker testing, and course approval are still pending.</p><ul>{#each draftReferences as source}<li><a href={source.href} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>{/each}</ul></dialog>
</div>
