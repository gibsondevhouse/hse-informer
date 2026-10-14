import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pbjSlides } from '../../admin-app/lib/lms/pbj-presentation';

const reactPreview = process.env.REACT_PREVIEW_URL || 'http://127.0.0.1:5189';
const viewports = [
  { name: 'annotated desktop', width: 1089, height: 865 },
  { name: 'wide desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small phone', width: 320, height: 844 },
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
  await expect(slide.getByText(pbjSlides[index].lead, { exact: true })).toBeVisible();
  for (const point of pbjSlides[index].points ?? []) {
    await expect(slide.getByRole('heading', { name: point.title, exact: true, includeHidden: true })).toBeVisible();
    await expect(slide.getByText(point.body, { exact: true })).toBeVisible();
  }
}

async function expectContainedStage(page: Page) {
  const overflow = await page.evaluate(() => {
    const failures: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 1) failures.push('document width');
    if (root.scrollHeight > window.innerHeight + 1) failures.push('document height');
    for (const selector of ['.pbj-presentation', '.pbj-presentation main', '[data-pbj-slide]', '.pbj-slide-copy']) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        failures.push(`missing ${selector}`);
        continue;
      }
      if (element.scrollWidth > element.clientWidth + 1) failures.push(`${selector} width: ${element.scrollWidth} > ${element.clientWidth}`);
      if (element.scrollHeight > element.clientHeight + 1) failures.push(`${selector} height: ${element.scrollHeight} > ${element.clientHeight}`);
      const rect = element.getBoundingClientRect();
      if (rect.top < -1 || rect.left < -1 || rect.bottom > window.innerHeight + 1 || rect.right > window.innerWidth + 1) {
        failures.push(`${selector} outside viewport`);
      }
    }
    const copy = document.querySelector<HTMLElement>('.pbj-slide-copy');
    const slide = document.querySelector<HTMLElement>('[data-pbj-slide]');
    const body = document.querySelector<HTMLElement>('.pbj-slide-body');
    if (copy && body) {
      const copyRect = copy.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      if (copyRect.top < bodyRect.top - 1 || copyRect.bottom > bodyRect.bottom + 1) failures.push('instructional copy overlaps slide header or footer');
    }
    if (copy && slide) {
      const stageRect = slide.getBoundingClientRect();
      const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim() || node.parentElement?.closest('[aria-hidden="true"], .sr-only')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.top < stageRect.top - 1 || rect.bottom > stageRect.bottom + 1 || rect.left < stageRect.left - 1 || rect.right > stageRect.right + 1) {
            failures.push(`text outside slide: ${node.textContent.trim().slice(0, 70)}`);
          }
        }
      }
    }
    return failures;
  });
  expect(overflow).toEqual([]);
  await expect(page.getByRole('button', { name: 'Previous slide', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeInViewport({ ratio: 1 });
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
        await expectContainedStage(page);
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
  test(`every PBJ slide fits the ${viewport.name} stage with captions hidden and shown`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await openPresentation(page);
    await traverseDeck(page);
  });
}

test.describe('PBJ touch presentation', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const viewport of [{ width: 390, height: 568 }, { width: 320, height: 568 }]) {
    test(`all slides fit with 48px touch controls at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
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
