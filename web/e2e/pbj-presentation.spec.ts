import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pbjSlides } from '../../admin-app/lib/lms/pbj-presentation';

const reactPreview = process.env.REACT_PREVIEW_URL || 'http://127.0.0.1:5189';
const viewports = [
  { name: 'annotated desktop', width: 1198, height: 865 },
  { name: 'wide desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small phone', width: 320, height: 568 },
  { name: 'short phone', width: 390, height: 568 },
  { name: 'landscape phone', width: 844, height: 390 },
  { name: 'short desktop', width: 1280, height: 600 }
] as const;

async function openPresentation(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${reactPreview}/training/pb-and-j`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('[data-pbj-slide]')).toHaveAttribute('data-slide-index', '0');
}

async function expectSlide(page: Page, index: number) {
  const slide = page.locator('[data-pbj-slide]');
  await expect(slide).toHaveAttribute('data-slide-index', String(index));
  await expect(slide).toHaveAttribute('data-slide-id', pbjSlides[index].id);
  await expect(slide).toHaveAttribute('aria-roledescription', 'slide');
  await expect(slide.getByRole('heading', { level: 1, name: pbjSlides[index].title, exact: true, includeHidden: true })).toBeVisible();
  if (pbjSlides[index].layout !== 'template') await expect(slide.getByText(pbjSlides[index].lead, { exact: true })).toBeVisible();
  const content = pbjSlides[index];
  for (const point of ('points' in content ? content.points : undefined) ?? []) {
    await expect(slide.getByRole('heading', { name: point.title, exact: true, includeHidden: true })).toBeVisible();
    await expect(slide.getByText(point.body, { exact: true })).toBeVisible();
  }
}

async function expectContainedStage(page: Page) {
  const fitted = page.locator('.training-fitted-panel');
  for (const panel of await fitted.all()) await expect(panel).toHaveAttribute('data-fit-ready', 'true');
  // Measurement is asynchronous after a resize, topic change, or caption toggle.
  // Poll the actual geometric contract, never accept scrollable or clipped copy.
  await expect.poll(async () => page.evaluate(() => {
    const failures: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 1) failures.push('document width');
    if (root.scrollHeight > window.innerHeight + 1) failures.push('document height');
    const isHidden = (element: Element) => {
      const style = getComputedStyle(element);
      return Boolean(element.closest('[aria-hidden="true"], [hidden], .sr-only, .training-sr-only')) ||
        style.display === 'none' || style.visibility === 'hidden' || !element.getClientRects().length;
    };
    const slide = document.querySelector<HTMLElement>('[data-pbj-slide]');
    const template = document.querySelector<HTMLElement>('.training-template');
    const copy = document.querySelector<HTMLElement>('.pbj-slide-copy');
    const body = document.querySelector<HTMLElement>('.pbj-slide-body');
    const content = template ?? copy;
    for (const selector of ['.pbj-presentation', '.pbj-presentation main', '[data-pbj-slide]', template ? '.training-template' : '.pbj-slide-copy']) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) { failures.push(`missing ${selector}`); continue; }
      if (element.scrollWidth > element.clientWidth + 1) failures.push(`${selector} width: ${element.scrollWidth} > ${element.clientWidth}`);
      if (element.scrollHeight > element.clientHeight + 1) failures.push(`${selector} height: ${element.scrollHeight} > ${element.clientHeight}`);
      const rect = element.getBoundingClientRect();
      if (rect.top < -1 || rect.left < -1 || rect.bottom > window.innerHeight + 1 || rect.right > window.innerWidth + 1) failures.push(`${selector} outside viewport`);
    }
    if (failures.some((failure) => failure.includes('width:'))) {
      for (const element of document.querySelectorAll<HTMLElement>('.pbj-deck-heading, .pbj-deck-heading > *')) {
        if (isHidden(element)) continue;
        const bounds = element.getBoundingClientRect();
        failures.push(`header geometry ${element.className}: left ${bounds.left}, width ${bounds.width}, scroll ${element.scrollWidth}`);
      }
    }
    if (!content || !slide) return [...failures, 'missing slide content'];
    const contentRect = content.getBoundingClientRect();
    if (template) {
      const top = document.querySelector('.pbj-slide-topline')!.getBoundingClientRect();
      const bottom = document.querySelector('.pbj-slide-bottomline')!.getBoundingClientRect();
      if (contentRect.top < top.bottom - 1 || contentRect.bottom > bottom.top + 1) failures.push('content overlaps slide header or footer');
      for (const element of template.querySelectorAll<HTMLElement>('*')) {
        if (isHidden(element) || !(element instanceof HTMLElement) || ['SELECT', 'OPTION', 'INPUT'].includes(element.tagName)) continue;
        if (element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1) failures.push(`${element.className || element.tagName} requires vertical scrolling`);
        // Path arrows intentionally cross the gap between adjacent topic buttons.
        // They do not create a scrollable area; the surrounding menu, text, and
        // complete slide remain subject to the strict containment checks.
        const after = getComputedStyle(element, '::after');
        const decorativeConnector = element.matches('.training-topic-buttons button[data-topic-kind="primary"]') &&
          getComputedStyle(element).overflowX === 'visible' && after.position === 'absolute' &&
          after.pointerEvents === 'none' && !['none', 'normal'].includes(after.content);
        if (!decorativeConnector && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1) failures.push(`${element.className || element.tagName} requires horizontal scrolling`);
      }
    } else if (body) {
      const bodyRect = body.getBoundingClientRect();
      if (contentRect.top < bodyRect.top - 1 || contentRect.bottom > bodyRect.bottom + 1) failures.push('instructional copy overlaps slide header or footer');
    }
    // Legacy headlines can extend beyond their line box without clipping; keep
    // their actual glyphs inside the slide body, clear of the header and footer.
    const textBounds = template ? contentRect : (body ?? slide).getBoundingClientRect();
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || isHidden(parent) || parent.closest('select')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        if (rect.top < textBounds.top - 1 || rect.bottom > textBounds.bottom + 1 || rect.left < textBounds.left - 1 || rect.right > textBounds.right + 1) failures.push(`text outside content: ${node.textContent.trim().slice(0, 70)}`);
        let ancestor: HTMLElement | null = parent;
        while (ancestor && ancestor !== content) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) failures.push(`text clipped vertically: ${node.textContent.trim().slice(0, 70)}`);
          ancestor = ancestor.parentElement;
        }
      }
    }
    for (const control of content.querySelectorAll<HTMLElement>('button, a, input, select')) {
      if (isHidden(control)) continue;
      const rect = control.getBoundingClientRect();
      if (rect.top < contentRect.top - 1 || rect.bottom > contentRect.bottom + 1 || rect.left < contentRect.left - 1 || rect.right > contentRect.right + 1) failures.push(`control outside content: ${control.textContent?.trim().slice(0, 50)}`);
    }
    return [...new Set(failures)];
  }), { timeout: 5_000 }).toEqual([]);
  await expect(page.getByRole('button', { name: 'Previous slide', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeInViewport({ ratio: 1 });
}

async function readDetailPages(page: Page) {
  const stage = page.locator('[data-pbj-slide]');
  const parts: string[] = [];
  const links: { label: string; href: string | null }[] = [];
  const fitted = stage.locator('.training-fitted-panel');
  const panels = await fitted.count() ? await fitted.all() : [stage];
  for (const panel of panels) {
    const previous = panel.getByRole('button', { name: 'Previous detail page', exact: true });
    for (let count = 0; count < 100 && await previous.isVisible() && await previous.isEnabled(); count++) await previous.click();
    for (let count = 0; count < 100; count++) {
      await expectContainedStage(page);
      const copy = panel.locator('.training-panel-page');
      parts.push(await (await copy.count() ? copy : panel).innerText());
      links.push(...await panel.getByRole('link').evaluateAll((elements) => elements.map((element) => ({ label: element.textContent ?? '', href: element.getAttribute('href') }))));
      const next = panel.getByRole('button', { name: 'Next detail page', exact: true });
      if (!(await next.isVisible()) || !(await next.isEnabled())) break;
      if (count === 99) throw new Error('Detail pagination did not terminate');
      await next.click();
    }
  }
  return { text: parts.join(' ').replace(/\s+/g, ' '), links };
}

async function readAllTopics(page: Page) {
  const stage = page.locator('[data-pbj-slide]');
  const explorer = stage.locator('.training-explorer');
  if (!(await explorer.count())) return readDetailPages(page);
  const select = explorer.getByRole('combobox', { name: 'Explore topic', exact: true, includeHidden: true });
  const parts: string[] = [];
  const links: { label: string; href: string | null }[] = [];
  const topics = await select.locator('option').evaluateAll((options) => options.map((option) => ({ value: option.getAttribute('value')!, label: option.textContent!.trim().replace(/^\d+ · /, '') })));
  for (const topic of topics) {
    if (await select.isVisible()) await select.selectOption(topic.value);
    else {
      const trigger = explorer.getByRole('button', { name: topic.label, exact: true });
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-pressed', 'true');
    }
    const content = await readDetailPages(page);
    parts.push(topic.label, content.text);
    links.push(...content.links);
  }
  return { text: parts.join(' '), links };
}

async function goToSlide(page: Page, index: number) {
  await page.getByRole('button', { name: 'Browse slides', exact: true }).click();
  const browser = page.getByRole('dialog', { name: 'Slide browser', exact: true });
  await browser.getByRole('button').filter({ hasText: pbjSlides[index].title }).click();
  await expect(browser).toBeHidden();
  await expectSlide(page, index);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => ({
    rule: violation.id,
    nodes: violation.nodes.map((node) => ({ selector: node.target, reason: node.failureSummary }))
  }))).toEqual([]);
}

async function expectTouchTargets(page: Page) {
  const undersized = await page.locator('.pbj-presentation').evaluate((root) =>
    [...root.querySelectorAll('button')].flatMap((button) => {
      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(button).visibility === 'hidden') return [];
      return rect.width < 47.5 || rect.height < 47.5
        ? [{ name: button.getAttribute('aria-label') || button.textContent?.trim(), width: rect.width, height: rect.height }]
        : [];
    })
  );
  expect(undersized).toEqual([]);
}

async function traverseDeck(page: Page, touch = false) {
  const captions = page.getByRole('button', { name: 'Captions', exact: true });
  for (let index = 0; index < pbjSlides.length; index++) {
    await test.step(`Slide ${index + 1}: ${pbjSlides[index].title}`, async () => {
      await expectSlide(page, index);
      for (const visible of [false, true]) {
        if ((await captions.getAttribute('aria-pressed')) !== String(visible)) {
          if (touch) await captions.tap();
          else await captions.click();
        }
        await expect(captions).toHaveAttribute('aria-pressed', String(visible));
        if (visible) {
          await expect(page.locator('.pbj-captions')).toBeVisible();
          await expect(page.locator('.pbj-captions')).toBeInViewport({ ratio: 1 });
        } else {
          await expect(page.locator('.pbj-captions')).toBeHidden();
        }
        await readAllTopics(page);
        if (touch) await expectTouchTargets(page);
      }
      if (index < pbjSlides.length - 1) {
        const next = page.getByRole('button', { name: 'Next slide', exact: true });
        if (touch) await next.tap();
        else await next.click();
      }
    });
  }
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled();
}

for (const viewport of viewports) {
  test(`every PBJ slide remains readable and contained in the ${viewport.name} stage`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    await traverseDeck(page);
  });
}

test.describe('PBJ touch presentation', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const viewport of [{ width: 390, height: 568 }, { width: 320, height: 568 }]) {
    test(`all slides stay accessible with 48px touch controls at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await openPresentation(page);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      await traverseDeck(page, true);
    });
  }
});

test('PBJ presentation supports keyboard navigation, direct slide selection, and transcript focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPresentation(page);
  await expect(page.getByRole('button', { name: 'Previous slide', exact: true })).toBeDisabled();
  await page.locator('.pbj-presentation main').focus();
  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 1);
  await page.keyboard.press('ArrowLeft');
  await expectSlide(page, 0);
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();

  const transcriptTrigger = page.getByRole('button', { name: 'Transcript', exact: true });
  await transcriptTrigger.click();
  const transcript = page.getByRole('dialog', { name: 'Transcript', exact: true });
  await expect(transcript).toBeVisible();
  await expect(transcript.getByText(pbjSlides[1].title, { exact: true })).toBeVisible();
  await expect.poll(() => transcript.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 1);
  await page.setViewportSize({ width: 390, height: 568 });
  const transcriptCopy = transcript.locator('.pbj-transcript-copy');
  await expect.poll(() => transcriptCopy.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
  await transcriptCopy.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await transcriptCopy.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await transcript.getByRole('button', { name: 'Next transcript slide', exact: true }).click();
  await expectSlide(page, 2);
  await expect(transcript.getByText(pbjSlides[2].title, { exact: true })).toBeVisible();
  await expect.poll(() => transcriptCopy.evaluate((element) => element.scrollTop)).toBe(0);
  await transcript.getByRole('button', { name: 'Previous transcript slide', exact: true }).click();
  await expectSlide(page, 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await transcript.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => transcript.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(transcript).toBeHidden();
  await expect(transcriptTrigger).toBeFocused();

  const browserTrigger = page.getByRole('button', { name: 'Browse slides', exact: true });
  await browserTrigger.click();
  const browser = page.getByRole('dialog', { name: 'Slide browser', exact: true });
  await expect(browser).toBeVisible();
  await browser.getByRole('button').filter({ hasText: pbjSlides[pbjSlides.length - 1].title }).click();
  await expect(browser).toBeHidden();
  await expectSlide(page, pbjSlides.length - 1);
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await expectSlide(page, pbjSlides.length - 2);
});

test('PBJ presentation dialogs and dense slide meet automated WCAG checks', async ({ page }) => {
  await page.setViewportSize({ width: 1089, height: 865 });
  await openPresentation(page);
  await expectAccessible(page);
  const denseIndex = pbjSlides.reduce((best, slide, index) => JSON.stringify(slide).length > JSON.stringify(pbjSlides[best]).length ? index : best, 0);
  await page.getByRole('button', { name: 'Browse slides', exact: true }).click();
  await page.getByRole('dialog', { name: 'Slide browser', exact: true })
    .getByRole('button').filter({ hasText: pbjSlides[denseIndex].title }).click();
  await expectSlide(page, denseIndex);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Transcript', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Transcript', exact: true })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  const outlineTrigger = page.getByRole('button', { name: 'Course outline', exact: true });
  await outlineTrigger.click();
  const outline = page.getByRole('dialog', { name: 'Course outline', exact: true });
  await expect(outline).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(outline).toBeHidden();
  await expect(outlineTrigger).toBeFocused();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
  test(`every Overview topic exposes its complete authored content without scrolling at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    for (const [index, slide] of pbjSlides.entries()) {
      if (slide.chapter !== 'Overview' || slide.layout !== 'template' || slide.template === 'practice') continue;
      await test.step(slide.template, async () => {
        await goToSlide(page, index);
        const stage = page.locator('[data-pbj-slide]');
        await expect(stage).toHaveAttribute('data-template', slide.template);
        const content = await readAllTopics(page);
        const expected: string[] = [];
        if (slide.takeaway) expected.push(slide.takeaway);
        if (slide.template === 'introduction') expected.push(...Object.values(slide.content));
        if (slide.template === 'objectives') for (const group of slide.content.groups) expected.push(group.title, ...group.items);
        if (slide.template === 'roadmap') for (const chapter of slide.content.chapters) expected.push(chapter.title, chapter.description);
        if (slide.template === 'diagram') expected.push(slide.content.description, slide.content.caption ?? '', ...slide.content.nodes.flatMap((node) => [node.title, node.text]));
        if (slide.template === 'table') expected.push(slide.content.caption ?? '', ...slide.content.columns, ...slide.content.rows.flat());
        if (slide.template === 'procedure') {
          for (const step of slide.content.steps) expected.push(step.title, step.text, step.caution ?? '', step.verification ?? '');
          if (slide.content.callout) expected.push(slide.content.callout.title ?? '', slide.content.callout.text);
        }
        if (slide.template === 'summary') {
          expected.push(...slide.content.standard.flatMap((item) => [item.title, item.text]), ...slide.content.takeaways);
          for (const reference of [...slide.content.references, ...(slide.content.jobAid ? [slide.content.jobAid] : [])]) {
            expect(content.links.some((link) => link.label.includes(reference.label) && link.href === reference.href), `unreachable reference ${reference.label}`).toBe(true);
          }
        }
        for (const text of expected.filter(Boolean)) expect(content.text, `unreachable authored content: ${text}`).toContain(text.replace(/\s+/g, ' '));
        await expectAccessible(page);
      });
    }
  });
}

test('instructional templates provide varied layouts on desktop and phone', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  for (const viewport of [{ name: 'desktop', width: 1198, height: 865 }, { name: 'phone', width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await openPresentation(page);
    for (const template of ['introduction', 'objectives', 'diagram', 'procedure', 'summary'] as const) {
      const index = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === template);
      await goToSlide(page, index);
      await expectContainedStage(page);
      const stage = page.locator('[data-pbj-slide]');
      const explorer = stage.locator('.training-explorer');
      const layouts = { introduction: 'briefing', objectives: 'outcomes', diagram: 'pathway', procedure: 'sequence', summary: 'recap' };
      await expect(explorer).toHaveAttribute('data-explorer-layout', layouts[template]);
      if (viewport.name === 'desktop') {
        const primary = explorer.locator('.training-topic-buttons button[data-topic-kind="primary"]');
        await expect(primary).toHaveCount(3);
        for (const button of await primary.all()) await expect(button).toBeVisible();
        const rectangles = await primary.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()));
        const panel = await stage.locator('.training-panel-page').boundingBox();
        const menu = await stage.locator('.training-topic-menu').boundingBox();
        if (!panel || !menu) throw new Error('Missing visible template composition');
        if (template === 'introduction') {
          // Entry tiles occupy two columns beside the briefing reader.
          expect(Math.abs(rectangles[0].top - rectangles[1].top)).toBeLessThanOrEqual(1);
          expect(rectangles[1].left).toBeGreaterThan(rectangles[0].right);
          expect(rectangles[2].top).toBeGreaterThan(rectangles[0].bottom);
          expect(panel.x).toBeGreaterThan(menu.x + menu.width);
        } else if (template === 'summary') {
          // The recap reverses the composition and puts its resource rail on the right.
          expect(menu.x).toBeGreaterThan(panel.x + panel.width);
          expect(rectangles[1].top).toBeGreaterThan(rectangles[0].bottom);
          expect(rectangles[2].top).toBeGreaterThan(rectangles[1].bottom);
        } else {
          // Outcome cards, transfer stages, and procedure checkpoints run left to right.
          for (let position = 1; position < rectangles.length; position++) {
            expect(Math.abs(rectangles[position].top - rectangles[0].top)).toBeLessThanOrEqual(1);
            expect(rectangles[position].left).toBeGreaterThan(rectangles[position - 1].right);
          }
          expect(panel.y).toBeGreaterThan(Math.max(...rectangles.map((rectangle) => rectangle.bottom)));
        }
        if (template === 'diagram' || template === 'procedure') {
          // Real connectors join adjacent primary stages; these are not an unordered card list.
          for (const button of (await primary.all()).slice(0, -1)) {
            const connector = await button.evaluate((element) => {
              const style = getComputedStyle(element, '::after');
              return { content: style.content, width: parseFloat(style.width), height: parseFloat(style.height) };
            });
            expect(connector.content).not.toBe('none');
            expect(connector.width).toBeGreaterThan(0);
            expect(connector.height).toBeGreaterThan(0);
          }
        }
        if (template === 'procedure') {
          for (const [position, button] of (await primary.all()).entries()) {
            await expect(button.locator('.training-topic-number')).toBeVisible();
            await expect(button.locator('.training-topic-number')).toHaveText(String(position + 1).padStart(2, '0'));
          }
        }
        if (template === 'diagram') {
          const pathway = stage.getByRole('group', { name: 'Ordered transfer pathway and supporting detail', exact: true });
          await expect(pathway).toBeVisible();
          const slide = pbjSlides[index];
          if (slide.layout !== 'template' || slide.template !== 'diagram') throw new Error('Missing pathway');
          for (const [position, node] of slide.content.nodes.entries()) await expect(primary.nth(position)).toHaveAccessibleName(node.title);
        }
      } else {
        await expect(explorer.getByRole('combobox', { name: 'Explore topic', exact: true })).toBeVisible();
      }
      await page.mouse.move(0, 0);
      await page.screenshot({ path: testInfo.outputPath(`${template}-${viewport.name}.png`) });
      if (viewport.name === 'desktop' && (template === 'diagram' || template === 'procedure')) {
        const captions = page.getByRole('button', { name: 'Captions', exact: true });
        await captions.click();
        await expect(captions).toHaveAttribute('aria-pressed', 'true');
        await readAllTopics(page);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: testInfo.outputPath(`${template}-desktop-captions.png`) });
        await captions.click();
      }
    }
  }
});

test('exploration controls keep keyboard interaction on the current slide', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1198, height: 865 });
  await openPresentation(page);
  const tableIndex = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === 'table');
  await goToSlide(page, tableIndex);
  const stage = page.locator('[data-pbj-slide]');
  const topics = stage.locator('.training-topic-buttons').getByRole('button');
  await topics.nth(1).click();
  await expect(topics.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(stage).toHaveAttribute('data-slide-index', String(tableIndex));
  await expect(topics.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expectContainedStage(page);
  await page.screenshot({ path: testInfo.outputPath('no-scroll-controls-desktop.png') });
  await page.setViewportSize({ width: 320, height: 568 });
  const selector = stage.getByRole('combobox', { name: 'Explore topic', exact: true });
  await selector.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(stage).toHaveAttribute('data-slide-index', String(tableIndex));
  await expect(selector).toBeFocused();
  await expectContainedStage(page);
  await page.screenshot({ path: testInfo.outputPath('no-scroll-controls-phone.png') });
  await readDetailPages(page);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await readAllTopics(page);
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expectContainedStage(page);
});

test('roadmap links reach the authored chapter destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPresentation(page);
  const roadmapIndex = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === 'roadmap');
  const roadmap = pbjSlides[roadmapIndex];
  if (roadmap.layout !== 'template' || roadmap.template !== 'roadmap') throw new Error('Missing roadmap');
  for (const chapter of roadmap.content.chapters) {
    await goToSlide(page, roadmapIndex);
    const explorer = page.locator('.training-explorer');
    const topicSelect = explorer.getByRole('combobox', { name: 'Explore topic', exact: true, includeHidden: true });
    if (await topicSelect.isVisible()) {
      await topicSelect.selectOption({ label: `${String(roadmap.content.chapters.indexOf(chapter) + 1).padStart(2, '0')} · ${chapter.title}` });
    } else {
      await explorer.getByRole('button', { name: chapter.title, exact: true }).click();
    }
    await page.locator('.training-template').getByRole('button', { name: `Open ${chapter.title} chapter`, exact: true }).click();
    await expectSlide(page, pbjSlides.findIndex((slide) => slide.id === chapter.targetSlideId));
    await expectContainedStage(page);
  }
});

test('practice explains every response after submission, supports retry, and persists for this session', async ({ page }) => {
  await page.setViewportSize({ width: 1198, height: 865 });
  await openPresentation(page);
  const practiceIndex = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === 'practice');
  const practice = pbjSlides[practiceIndex];
  if (practice.layout !== 'template' || practice.template !== 'practice') throw new Error('Missing practice');
  await goToSlide(page, practiceIndex);
  const stage = page.locator('[data-pbj-slide]');
  const submit = stage.getByRole('button', { name: 'Check answer', exact: true });
  const feedback = stage.getByRole('status');
  const scenario = await readDetailPages(page);
  expect(scenario.text).toContain(practice.content.situation);
  expect(scenario.text).toContain(practice.content.prompt);
  await stage.getByRole('button', { name: 'Choose answer', exact: true }).click();
  await expect(submit).toBeDisabled();
  for (const option of practice.content.options) {
    await test.step(option.id, async () => {
      const radio = stage.getByRole('radio', { name: `Answer ${String.fromCharCode(65 + practice.content.options.indexOf(option))}: ${option.text}`, exact: true });
      await radio.check();
      await expect(radio).toBeChecked();
      await expect(stage).toHaveAttribute('data-slide-id', practice.id);
      await expect(feedback).toHaveCount(0);
      expect((await readDetailPages(page)).text).toContain(option.text);
      await expect(submit).toBeEnabled();
      await page.getByRole('button', { name: 'Next slide', exact: true }).click();
      await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
      await expect(radio).toBeChecked();
      await expect(feedback).toHaveCount(0);
      await submit.click();
      await expect(feedback).toBeFocused();
      expect((await readDetailPages(page)).text).toContain(option.outcome);
      await expect(stage).toHaveAttribute('data-slide-id', practice.id);
      await expectAccessible(page);
      await page.getByRole('button', { name: 'Next slide', exact: true }).click();
      await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
      expect((await readDetailPages(page)).text).toContain(option.outcome);
      await stage.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(feedback).toHaveCount(0);
      await expect(stage.getByRole('radio', { checked: true })).toHaveCount(0);
      await expect(submit).toBeDisabled();
    });
  }
  await stage.getByRole('radio').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(stage).toHaveAttribute('data-slide-id', practice.id);
  await expect(stage.getByRole('radio', { checked: true })).toHaveCount(1);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await goToSlide(page, practiceIndex);
  await stage.getByRole('button', { name: 'Choose answer', exact: true }).click();
  await expect(stage.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(feedback).toHaveCount(0);
});

for (const viewport of [{ width: 1198, height: 865 }, { width: 1280, height: 600 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`practice scenario, every choice, and all feedback fit without scrolling at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    const practiceIndex = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === 'practice');
    const practice = pbjSlides[practiceIndex];
    if (practice.layout !== 'template' || practice.template !== 'practice') throw new Error('Missing practice');
    await goToSlide(page, practiceIndex);
    const stage = page.locator('[data-pbj-slide]');
    const captions = page.getByRole('button', { name: 'Captions', exact: true });
    for (const shown of [false, true]) {
      if (await stage.locator('[data-practice-phase="answer"]').count()) {
        await page.getByRole('button', { name: 'Next slide', exact: true }).click();
        await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
      }
      if ((await captions.getAttribute('aria-pressed')) !== String(shown)) await captions.click();
      if (await stage.getByRole('button', { name: 'Scenario', exact: true }).isVisible()) await stage.getByRole('button', { name: 'Scenario', exact: true }).click();
      const situation = await readDetailPages(page);
      expect(situation.text).toContain(practice.content.situation);
      expect(situation.text).toContain(practice.content.prompt);
      await stage.getByRole('button', { name: /^(Choose answer|Review answers)$/ }).click();
      await readDetailPages(page);
      for (const option of practice.content.options) {
        await stage.getByRole('radio', { name: `Answer ${String.fromCharCode(65 + practice.content.options.indexOf(option))}: ${option.text}`, exact: true }).check();
        expect((await readDetailPages(page)).text).toContain(option.text);
        await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
        await expect(stage.getByRole('status')).toBeFocused();
        expect((await readDetailPages(page)).text).toContain(option.outcome);
        await stage.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(stage.getByRole('radio').first()).toBeFocused();
        await expectContainedStage(page);
      }
    }
  });
}

test('phone practice keeps keyboard focus inside each non-scrolling phase', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openPresentation(page);
  const practiceIndex = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === 'practice');
  await goToSlide(page, practiceIndex);
  const stage = page.locator('[data-pbj-slide]');
  await stage.getByRole('button', { name: 'Choose answer', exact: true }).click();
  const firstOption = stage.getByRole('radio').first();
  await expect(firstOption).toBeFocused();
  await page.keyboard.press('Space');
  await expect(firstOption).toBeChecked();
  await stage.getByRole('button', { name: 'Check answer', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(stage.getByRole('status')).toBeFocused();
  await expect(stage.locator('.training-panel-page').getByRole('heading', { name: 'Reconsider this response', exact: true })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('ArrowRight');
  await expect(stage).toHaveAttribute('data-slide-index', String(practiceIndex));
  await readDetailPages(page);
  await stage.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(firstOption).toBeFocused();
  await expect(stage.getByRole('radio', { checked: true })).toHaveCount(0);
  await expectContainedStage(page);
});

test('slide details omit empty sections and return focus from the desktop panel', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPresentation(page);
  for (const [index, slide] of pbjSlides.entries()) {
    if (!slide.details) continue;
    await goToSlide(page, index);
    const trigger = page.getByRole('button', { name: 'Slide details', exact: true });
    await trigger.click();
    const details = page.getByRole('complementary', { name: 'Slide details', exact: true });
    await expect(details).toBeVisible();
    for (const [key, title] of [['explanation', 'Explanation'], ['terms', 'Terms'], ['sources', 'Sources']] as const) {
      await expect(details.getByRole('heading', { name: title, exact: true })).toHaveCount(slide.details[key]?.length ? 1 : 0);
    }
    for (const source of slide.details.sources ?? []) {
      await expect(details.getByRole('link', { name: source.label })).toHaveAttribute('href', source.href);
    }
    const reading = details.getByRole('region', { name: 'Supporting details', exact: true });
    await reading.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-pbj-slide]')).toHaveAttribute('data-slide-id', slide.id);
    await expectContainedStage(page);
    if (slide.layout === 'template' && slide.template === 'diagram') {
      await page.screenshot({ path: testInfo.outputPath('overview-diagram-details.png') });
      await expect.poll(() => reading.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
      await page.keyboard.press('PageDown');
      await expect.poll(() => reading.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.locator('[data-pbj-slide]')).toHaveAttribute('data-slide-id', slide.id);
    }
    await details.getByRole('button', { name: /Close/ }).click();
    await expect(details).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  await goToSlide(page, pbjSlides.findIndex((slide) => slide.layout !== 'template'));
  await expect(page.getByRole('button', { name: 'Slide details', exact: true })).toBeHidden();
});

test('slide details remain accessible in a phone dialog and fullscreen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await openPresentation(page);
  const detailIndex = pbjSlides.findIndex((slide) => slide.details?.terms?.length && slide.details?.sources?.length);
  await goToSlide(page, detailIndex);
  const trigger = page.getByRole('button', { name: 'Slide details', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Slide details', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  const detailCopy = dialog.locator('.pbj-dialog-scroll');
  await expect.poll(() => detailCopy.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
  await detailCopy.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.getByRole('link').last()).toBeInViewport({ ratio: 1 });
  await expectAccessible(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-pbj-slide]')).toHaveAttribute('data-slide-index', String(detailIndex));
  await dialog.getByRole('button', { name: /Close/ }).focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await trigger.click();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => document.fullscreenElement?.contains(element))).toBe(true);
  await dialog.getByRole('button', { name: /Close/ }).click();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
});

test('PBJ viewing controls do not write stored progress or call training services', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const observed = window as Window & { pbjStorageWrites: string[] };
    observed.pbjStorageWrites = [];
    for (const method of ['setItem', 'removeItem', 'clear'] as const) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args: string[]) {
        // Vinext clears its own development navigation markers on startup.
        const runtimeCleanup = method === 'removeItem' && ['__vinext_rsc_initial_reload__', '__vinext_hard_navigation_target__'].includes(args[0]);
        if (!runtimeCleanup) observed.pbjStorageWrites.push(`${method}:${args[0] ?? ''}`);
        return Reflect.apply(original, this, args);
      };
    }
  });
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${request.url()}`);
  });
  await openPresentation(page);
  const captions = page.getByRole('button', { name: 'Captions', exact: true });
  const initialCaptions = await captions.getAttribute('aria-pressed');
  await captions.click();
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  const practiceIndex = pbjSlides.findIndex((slide) => slide.layout === 'template' && slide.template === 'practice');
  await goToSlide(page, practiceIndex);
  await page.locator('[data-pbj-slide]').getByRole('button', { name: 'Choose answer', exact: true }).click();
  await page.locator('[data-pbj-slide]').getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await goToSlide(page, 8);
  await page.locator('.training-activity').getByRole('combobox').selectOption('fruit');
  await goToSlide(page, 15);
  await page.locator('.training-activity').getByRole('button', { name: 'Safe', exact: true }).click();
  await goToSlide(page, 12);
  await page.locator('.training-activity').getByRole('button', { name: 'Choose answer', exact: true }).click();
  await page.locator('.training-activity').getByRole('radio').first().check();
  await page.locator('.training-activity').getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByRole('button', { name: 'Slide details', exact: true }).click();
  await page.getByRole('complementary', { name: 'Slide details', exact: true }).getByRole('button', { name: /Close/ }).click();
  const settingsTrigger = page.getByRole('button', { name: 'Presentation settings', exact: true });
  await settingsTrigger.click();
  const settings = page.getByRole('dialog', { name: 'Presentation settings', exact: true });
  await expect(settings).toBeVisible();
  await settings.getByRole('checkbox', { name: /Reduce motion/ }).check();
  await expect(page.locator('.pbj-presentation')).toHaveAttribute('data-motion', 'reduced');
  await settings.getByRole('checkbox', { name: /Letter shortcuts/ }).uncheck();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(settingsTrigger).toBeFocused();
  const captionsBeforeShortcuts = await captions.getAttribute('aria-pressed');
  await page.keyboard.press('c');
  await expect(captions).toHaveAttribute('aria-pressed', captionsBeforeShortcuts!);
  await page.keyboard.press('t');
  await expect(page.getByRole('dialog', { name: 'Transcript', exact: true })).toBeHidden();
  await settingsTrigger.click();
  await settings.getByRole('checkbox', { name: /Letter shortcuts/ }).check();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await page.keyboard.press('c');
  await expect(captions).toHaveAttribute('aria-pressed', String(captionsBeforeShortcuts === 'false'));
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole('button', { name: 'Transcript', exact: true }).click();
  const fullscreenTranscript = page.getByRole('dialog', { name: 'Transcript', exact: true });
  await expect(fullscreenTranscript).toBeVisible();
  expect(await fullscreenTranscript.evaluate((element) => document.fullscreenElement?.contains(element))).toBe(true);
  await fullscreenTranscript.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  expect(apiRequests).toEqual([]);
  expect(await page.evaluate(() => (window as Window & { pbjStorageWrites: string[] }).pbjStorageWrites)).toEqual([]);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expectSlide(page, 0);
  await expect(captions).toHaveAttribute('aria-pressed', initialCaptions!);
  expect(apiRequests).toEqual([]);
  expect(await page.evaluate(() => (window as Window & { pbjStorageWrites: string[] }).pbjStorageWrites)).toEqual([]);
});

for (const viewport of [viewports[0], viewports[3], viewports[4], viewports[6], viewports[7]]) {
  test(`interactive chapters expose every visual, item, decision and feedback without scrolling: ${viewport.name}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    await page.getByRole('button', { name: 'Captions', exact: true }).click();
    for (let index = 8; index < 19; index++) {
      const slide = pbjSlides[index];
      if (slide.layout !== 'template' || !('activityId' in slide.content)) throw new Error('Missing interactive slide');
      await test.step(slide.id, async () => {
        await goToSlide(page, index);
        const stage = page.locator('[data-pbj-slide]');
        const activity = stage.locator('.training-activity');
        await expectContainedStage(page);
        if (viewport.name === 'annotated desktop') await page.screenshot({ path: testInfo.outputPath(`${slide.id}-initial.png`) });
        const content = slide.content;
        const items = 'targets' in content ? content.targets : 'items' in content ? content.items : 'steps' in content ? content.steps : 'stages' in content ? content.stages ?? [] : [];
        for (const item of items) {
          const select = activity.getByRole('combobox');
          await select.selectOption(item.id);
          if (slide.template === 'visual-exploration') {
            const visualButton = activity.getByRole('button', { name: 'View visual', exact: true });
            if (await visualButton.isVisible()) await visualButton.click();
            await activity.getByRole('button', { name: `Explore ${item.label}`, exact: true }).click();
            await expect(select).toHaveValue(item.id);
          }
          const detail = activity.getByRole('button', { name: 'Read detail', exact: true });
          if (await detail.isVisible()) await detail.click();
          const read = await readDetailPages(page);
          expect(read.text).toContain(item.text);
          if (item.check) expect(read.text).toContain(item.check);
          if (item.visual) expect(read.text).toContain(item.visual.description);
          if ('visual' in content) expect(read.text).toContain(content.visual.description);
          if (slide.template === 'classification') {
            await expect(activity.getByRole('status')).toHaveCount(0);
            // Deliberately choose the opposite category to exercise explanatory corrections.
            const classified = slide.content.items.find((i) => i.id === item.id)!;
            const opposite = slide.content.categories.find((c) => c.id !== classified.category)!;
            await activity.getByRole('button', { name: opposite.label, exact: true }).click();
          }
        }
        if (slide.template === 'classification') {
          await activity.getByRole('button', { name: 'Check all', exact: true }).click();
          await expect(activity.locator('.activity-toolbar')).toBeFocused();
          for (const item of slide.content.items) {
            await activity.getByRole('combobox').selectOption(item.id);
            expect((await readDetailPages(page)).text).toContain(item.explanation);
          }
          await page.getByRole('button', { name: 'Next slide', exact: true }).click();
          await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
          await expect(activity.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
          await activity.getByRole('button', { name: 'Try again', exact: true }).click();
          await expect(activity.getByRole('button', { name: 'Check all', exact: true })).toBeDisabled();
          for (const item of slide.content.items) {
            await activity.getByRole('combobox').selectOption(item.id);
            await activity.getByRole('button', { name: slide.content.categories.find((c) => c.id === item.category)!.label, exact: true }).click();
          }
          await activity.getByRole('button', { name: 'Check all', exact: true }).click();
          expect((await readDetailPages(page)).text).toContain('You identified it');
        }
        if ('decision' in content && content.decision) {
          if (slide.template === 'comparison-activity') await activity.getByRole('button', { name: 'Make a choice', exact: true }).click();
          expect((await readDetailPages(page)).text).toContain(content.decision.situation);
          await activity.getByRole('button', { name: 'Choose answer', exact: true }).click();
          for (const [i, option] of content.decision.options.entries()) {
            await activity.getByRole('radio').nth(i).check();
            await expect(activity.locator('.training-practice-flow-feedback')).toHaveCount(0);
            expect((await readDetailPages(page)).text).toContain(option.text);
            await activity.getByRole('button', { name: 'Check answer', exact: true }).click();
            await expect(activity.getByRole('status')).toBeFocused();
            expect((await readDetailPages(page)).text).toContain(option.outcome);
            await page.getByRole('button', { name: 'Next slide', exact: true }).click();
            await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
            expect((await readDetailPages(page)).text).toContain(option.outcome);
            await activity.getByRole('button', { name: 'Try again', exact: true }).click();
            await expect(activity.getByRole('radio').first()).toBeFocused();
          }
        }
        await expectAccessible(page);
        if (viewport.name === 'annotated desktop') await page.screenshot({ path: testInfo.outputPath(`${slide.id}.png`) });
      });
    }
  });
}

test('interactive keyboard controls, source panels, fullscreen and session reset work together', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPresentation(page);
  await goToSlide(page, 11);
  const activity = page.locator('.training-activity');
  const select = activity.getByRole('combobox');
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pbj-slide]')).toHaveAttribute('data-slide-id', 'read-labels');
  await select.selectOption('storage');
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await expect(select).toHaveValue('storage');
  const details = page.getByRole('button', { name: 'Slide details', exact: true });
  await details.click();
  const panel = page.getByRole('complementary', { name: 'Slide details', exact: true });
  await expect(panel.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
  await expect(panel.getByRole('link')).toHaveCount(1);
  await expectContainedStage(page);
  await panel.getByRole('button', { name: /Close/ }).click();
  await expect(details).toBeFocused();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expectContainedStage(page);
  await activity.getByRole('button', { name: 'Explore Ingredients', exact: true }).click();
  await expectContainedStage(page);
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await page.reload();
  await goToSlide(page, 11);
  await expect(select).toHaveValue('ingredients');
});

for (const viewport of viewports.filter((item) => ['annotated desktop', 'small phone', 'landscape phone', 'short desktop'].includes(item.name))) {
  test(`text-led chapters reveal every explanation without scrolling: ${viewport.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    await page.getByRole('button', { name: 'Captions', exact: true }).click();
    for (let index = 19; index < 31; index++) {
      await goToSlide(page, index);
      const slide = pbjSlides[index];
      if (slide.layout !== 'template' || !('sections' in slide.content)) throw new Error('Expected text slide');
      const stage = page.locator('[data-pbj-slide]');
      for (const section of slide.content.sections) {
        const select = stage.getByRole('combobox', { name: 'Slide section', exact: true });
        if (await select.isVisible()) await select.selectOption(section.id);
        const content = await readDetailPages(page);
        expect(content.text).toContain(section.text);
        if (!section.more?.length) continue;
        const trigger = stage.getByRole('button', { name: `See more: ${section.title}`, exact: true });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const back = stage.getByRole('button', { name: 'Back to slide', exact: true });
        await expect(back).toBeFocused();
        const expanded = await readDetailPages(page);
        for (const detail of section.more) expect(expanded.text).toContain(detail.text);
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await expectContainedStage(page);
      }
      await expectAccessible(page);
    }
    if (viewport.name === 'annotated desktop') {
      await goToSlide(page, 19);
      await page.screenshot({ path: test.info().outputPath('pbj-text-brief.png') });
      await goToSlide(page, 26);
      await page.screenshot({ path: test.info().outputPath('pbj-text-focus.png') });
    }
  });
}

test('text reveals survive resize, captions and fullscreen with working back controls', async ({ page }) => {
  await page.setViewportSize({ width: 1198, height: 865 });
  await openPresentation(page);
  await goToSlide(page, 20);
  await page.getByRole('button', { name: 'See more: Sanitize', exact: true }).click();
  await page.getByRole('button', { name: 'Captions', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 568 });
  const content = await readDetailPages(page);
  expect(content.text).toContain('concentration and contact time');
  await page.getByRole('button', { name: 'Back to slide', exact: true }).click();
  // Restore the selected section even if a desktop reveal becomes compact.
  await expect(page.getByRole('button', { name: 'See more: Sanitize', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await readDetailPages(page);
  await page.getByRole('button', { name: 'See more: Sanitize', exact: true }).click();
  await readDetailPages(page);
  await page.getByRole('button', { name: 'Back to slide', exact: true }).click();
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expectContainedStage(page);
});

for (const viewport of [viewports[0], viewports[4], viewports[6], viewports[7]]) {
  test(`quality pilot teaches inspection, comparisons and consequences: ${viewport.name}`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    await page.getByRole('button', { name: 'Captions', exact: true }).click();
    const stage = page.locator('[data-pbj-slide]');
    await goToSlide(page, 31);
    const inspection = pbjSlides[31];
    if (inspection.layout !== 'template' || inspection.template !== 'inspection') throw new Error('Missing inspection');
    await expect(stage.locator('.evidence-pin')).toHaveCount(0);
    await expectContainedStage(page);
    if (viewport.name === 'annotated desktop') await page.screenshot({ path: testInfo.outputPath('quality-inspection.png') });
    await stage.getByRole('button', { name: 'Text version', exact: true }).click();
    await expect(stage.locator('.evidence-body')).toBeFocused();
    expect((await readDetailPages(page)).text).toContain(inspection.content.visual.description);
    await stage.getByRole('button', { name: 'Choose findings', exact: true }).click();
    await readDetailPages(page);
    await stage.getByRole('button', { name: 'Choose answer', exact: true }).click();
    for (const [index, option] of inspection.content.decision.options.entries()) {
      await stage.getByRole('radio').nth(index).check();
      await expect(stage.locator('.training-practice-flow-feedback')).toHaveCount(0);
      await expect(stage.locator('.evidence-pin')).toHaveCount(0);
      await readDetailPages(page);
      await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
      expect((await readDetailPages(page)).text).toContain(option.outcome);
      await stage.getByRole('button', { name: 'Annotated scene', exact: true }).click();
      await expect(stage.locator('.evidence-pin')).toHaveCount(3);
      await expectContainedStage(page);
      for (const annotation of inspection.content.annotations) {
        await stage.getByRole('button', { name: `Review ${annotation.label}`, exact: true }).click();
        expect((await readDetailPages(page)).text).toContain(annotation.text);
        await stage.getByRole('button', { name: 'View scene', exact: true }).click();
      }
      await stage.getByRole('button', { name: 'Review answer', exact: true }).click();
      await stage.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(stage.getByRole('radio').first()).toBeFocused();
    }
    await expectAccessible(page);
    for (const slideIndex of [32, 36]) {
      await goToSlide(page, slideIndex);
      const slide = pbjSlides[slideIndex];
      if (slide.layout !== 'template' || slide.template !== 'before-after') throw new Error('Missing comparison');
      for (const pair of slide.content.pairs) {
        await stage.getByRole('combobox', { name: 'Compare example', exact: true }).selectOption(pair.id);
        await expectContainedStage(page);
        if (await stage.getByRole('button', { name: 'Show after', exact: true }).isVisible()) {
          await stage.getByRole('button', { name: 'Show after', exact: true }).click();
          await expect(stage.locator('[data-side="after"]')).toBeVisible();
          await expectContainedStage(page);
          await stage.getByRole('button', { name: 'Show before', exact: true }).click();
        }
        if (viewport.name === 'annotated desktop') await page.screenshot({ path: testInfo.outputPath(`${slide.id}-${pair.id}.png`) });
        await stage.getByRole('button', { name: 'Explain change', exact: true }).click();
        const text = (await readDetailPages(page)).text;
        for (const expected of [pair.explanation, pair.check, pair.before.description, pair.after.description]) expect(text).toContain(expected);
        await stage.getByRole('button', { name: 'View comparison', exact: true }).click();
      }
      await expectAccessible(page);
    }
    await goToSlide(page, 34);
    const branching = pbjSlides[34];
    if (branching.layout !== 'template' || branching.template !== 'branching-case') throw new Error('Missing case');
    const caseRoot = stage.locator('[data-evidence="branching-case"]');
    for (const route of [['check', 'prompt'], ['assume', 'remake', 'unchanged'], ['assume', 'transfer']]) {
      await stage.getByRole('button', { name: 'Restart case', exact: true }).click();
      let nodeId = branching.content.startNodeId;
      for (const optionId of route) {
        const node = branching.content.nodes.find((item) => item.id === nodeId)!;
        if (node.kind !== 'decision') throw new Error('Expected decision');
        const option = node.options.find((item) => item.id === optionId)!;
        await expect(caseRoot).toHaveAttribute('data-node-id', node.id);
        expect((await readDetailPages(page)).text).toContain(node.situation);
        await stage.getByRole('button', { name: 'Choose answer', exact: true }).click();
        await stage.getByRole('radio').nth(node.options.indexOf(option)).check();
        await expect(caseRoot).toHaveAttribute('data-node-id', node.id);
        await expect(stage.getByRole('button', { name: 'Continue case', exact: true })).toHaveCount(0);
        await readDetailPages(page);
        await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
        expect((await readDetailPages(page)).text).toContain(option.outcome);
        await page.getByRole('button', { name: 'Next slide', exact: true }).click();
        await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
        expect((await readDetailPages(page)).text).toContain(option.outcome);
        await stage.getByRole('button', { name: 'Continue case', exact: true }).click();
        await expect(stage.locator('.evidence-body')).toBeFocused();
        nodeId = option.nextNodeId;
      }
      const outcome = branching.content.nodes.find((item) => item.id === nodeId)!;
      if (outcome.kind !== 'outcome') throw new Error('Expected case ending');
      const debrief = await readDetailPages(page);
      expect(debrief.text).toContain(outcome.text);
      await expectAccessible(page);
    }
    for (const index of [33,35,37]) { await goToSlide(page,index); await readDetailPages(page); await expectAccessible(page); }
  });
}

test('quality activities retain choices through fullscreen and navigation, and restart cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 1198, height: 865 });
  await openPresentation(page);
  await goToSlide(page, 34);
  const stage = page.locator('[data-pbj-slide]');
  const choose = stage.getByRole('button', { name: 'Choose answer', exact: true });
  await choose.focus();
  await page.keyboard.press('Enter');
  await expect(stage.getByRole('radio').first()).toBeFocused();
  await page.keyboard.press('Space');
  await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(stage.locator('.training-practice-flow-feedback')).toBeFocused();
  await stage.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(stage.getByRole('radio', { checked: true })).toHaveCount(0);
  await stage.getByRole('radio').last().check();
  await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
  await stage.getByRole('button', { name: 'Restart case', exact: true }).click();
  await expect(choose).toBeVisible();
  await expect(stage.locator('.evidence-body')).toBeFocused();
  await choose.click();
  await stage.getByRole('radio').first().check();
  await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await readDetailPages(page);
  await stage.getByRole('button', { name: 'Continue case', exact: true }).click();
  await expect(stage.locator('[data-node-id]')).toHaveAttribute('data-node-id','timing');
  await readDetailPages(page);
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await readDetailPages(page);
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await expect(stage.locator('[data-node-id]')).toHaveAttribute('data-node-id','timing');
  await page.reload();
  await goToSlide(page,34);
  await expect(stage.locator('[data-node-id]')).toHaveAttribute('data-node-id','substitute');
  await expect(choose).toBeVisible();
  await goToSlide(page,31);
  await stage.getByRole('button', { name: 'Choose findings', exact: true }).click();
  await choose.click();
  await stage.getByRole('radio').first().check();
  await stage.getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await expect(stage.locator('.training-practice-flow-feedback')).toBeVisible();
  await stage.getByRole('button', { name: 'Try again', exact: true }).click();
  await stage.getByRole('button', { name: 'Inspect scene', exact: true }).click();
  await expect(stage.locator('.evidence-pin')).toHaveCount(0);
  await expectContainedStage(page);
});
