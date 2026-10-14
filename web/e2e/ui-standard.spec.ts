import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const reactPreview = process.env.REACT_PREVIEW_URL || 'http://127.0.0.1:5189';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 }
] as const;

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function expectNoAxeViolations(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) =>
    animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity
  ).length)).toBe(0);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(result.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ selector: node.target, reason: node.failureSummary }))
  }))).toEqual([]);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('workspaces load HSE tokens and the React admin uses the PBJ visual language', async ({ page }) => {
  const tokenNames = [
    '--hse-night-frame', '--hse-night-panel', '--hse-night-accent',
    '--hse-night-text', '--hse-night-font-sans', '--hse-control-compact',
    '--hse-control-default', '--hse-control-touch'
  ];
  const read = async () => page.evaluate((names) => {
    const root = getComputedStyle(document.documentElement);
    return {
      values: names.map((name) => root.getPropertyValue(name).trim()),
      bodyFont: getComputedStyle(document.body).fontFamily
    };
  }, tokenNames);
  await page.goto(reactPreview);
  await expect(page.getByRole('heading', { level: 1, name: 'Training programs' })).toBeVisible();
  const react = await read();
  const adminVisual = await page.locator('.admin-preview').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    font: getComputedStyle(element).fontFamily
  }));
  await page.goto(`${reactPreview}/training/pb-and-j`);
  const courseVisual = await page.locator('.lms-player').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    font: getComputedStyle(element).fontFamily
  }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  const svelte = await read();
  expect(react.values).toEqual(svelte.values);
  expect(react.values[0]).toBe('#0b0b0e');
  expect(adminVisual.background).toBe(courseVisual.background);
  expect(adminVisual.font).toContain('Inter Variable');
  expect(courseVisual.font).toContain('Inter Variable');
  expect(svelte.bodyFont).toContain('Source Sans 3');
});

test('PBJ course remains the React admin visual reference at desktop and phone widths', async ({ page }) => {
  for (const viewport of [viewports[0], viewports[2]]) {
    await page.setViewportSize(viewport);
    await page.goto(`${reactPreview}/training/pb-and-j`);
    await expect(page.getByRole('heading', { level: 1, name: 'Peanut Butter and Jelly Sandwich Preparation' })).toBeVisible();
    await ready(page);
    await expectNoPageOverflow(page);
    await expect(page).toHaveScreenshot(`react-pbj-${viewport.name}.png`, {
      animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
    });
  }
});

for (const viewport of viewports) {
  test(`React admin shell is stable at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(reactPreview);
    await expect(page.getByRole('heading', { level: 1, name: 'Training programs' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await ready(page);
    await expectNoPageOverflow(page);
    await expect(page).toHaveScreenshot(`react-admin-${viewport.name}.png`, {
      animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
    });
  });

  test(`Svelte admin shell is stable at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await ready(page);
    await expectNoPageOverflow(page);
    await expect(page).toHaveScreenshot(`svelte-admin-${viewport.name}.png`, {
      animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005,
      mask: [page.locator('.filters > span')], maskColor: '#f7f9fc'
    });
  });
}

test('assignment worklists and program dialogs keep their layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${reactPreview}/?view=assignments`);
  await expect(page.getByRole('heading', { level: 1, name: 'Assignments' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await ready(page);
  await expectNoPageOverflow(page);
  await page.getByRole('heading', { name: 'Assignment records' }).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveScreenshot('react-assignments-phone.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Assignments' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Assignments' })).toBeVisible();
  await ready(page);
  await expectNoPageOverflow(page);
  await page.getByRole('heading', { name: 'Assignment records' }).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveScreenshot('svelte-assignments-phone.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005,
    mask: [page.locator('.filters > span')], maskColor: '#f7f9fc'
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Programs' }).click();
  await page.locator('.course-card').filter({ hasText: 'Respiratory Protection' }).click();
  await expect(page.getByRole('dialog', { name: 'Respiratory Protection' })).toBeVisible();
  await ready(page);
  await expect(page).toHaveScreenshot('svelte-program-dialog-desktop.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot('svelte-program-dialog-phone.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(reactPreview);
  await expect(page.getByRole('heading', { level: 1, name: 'Training programs' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'View Respiratory Protection details' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await ready(page);
  await expect(page).toHaveScreenshot('react-program-dialog-desktop.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot('react-program-dialog-phone.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });
});

test('draft learner views retain readable framing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview/respiratory-protection');
  await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
  await ready(page);
  await expectNoPageOverflow(page);
  await expect(page).toHaveScreenshot('svelte-lesson-phone.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });

  await page.goto(`${reactPreview}/training/respiratory-protection`);
  await expect(page.getByRole('heading', { name: /Respiratory Protection/ }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await ready(page);
  await expectNoPageOverflow(page);
  await expect(page).toHaveScreenshot('react-lesson-phone.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005
  });
});

test('admin and learner surfaces meet automated WCAG A/AA checks', async ({ page }) => {
  await page.goto(reactPreview);
  await expect(page.getByRole('heading', { level: 1, name: 'Training programs' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'View Respiratory Protection details' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');
  await page.goto(`${reactPreview}/?view=assignments`);
  await expect(page.getByRole('heading', { level: 1, name: 'Assignments' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto(`${reactPreview}/learn`);
  await expect(page.getByRole('heading', { name: 'My training assignments' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto(`${reactPreview}/qualifications`);
  await expect(page.getByRole('heading', { name: 'Worker readiness and evidence' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto(`${reactPreview}/training/pb-and-j`);
  await expect(page.getByRole('heading', { level: 1, name: 'Peanut Butter and Jelly Sandwich Preparation' })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Programs' }).click();
  await expectNoAxeViolations(page);
  await page.locator('.course-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Assignments' }).click();
  await expectNoAxeViolations(page);
  await page.goto('/preview/respiratory-protection');
  await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
  await expectNoAxeViolations(page);
});

test('keyboard focus enters, stays inside, and returns from the Svelte dialog', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  const trigger = page.locator('.program-row').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close program details' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('React preview dialog returns keyboard focus to its program', async ({ page }) => {
  await page.goto(reactPreview);
  await expect(page.getByRole('heading', { level: 1, name: 'Training programs' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('button', { name: 'View Respiratory Protection details' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('focus returns to the program card after switching between dialogs', async ({ page }) => {
  await page.route('**/api/requirements', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.items[0].reviewStatus = 'approved'; // Browser-only UI fixture; server approval remains guarded.
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Programs' }).click();
  const trigger = page.locator('.course-card').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const details = page.getByRole('dialog');
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Assign approved program' }).click();
  const assignment = page.getByRole('dialog', { name: 'New assignment' });
  await expect(assignment).toBeVisible();
  await expect(assignment.getByRole('button', { name: 'Close assignment form' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(assignment).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('mobile navigation remains reachable without page overflow', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(reactPreview);
    await expect(page.getByRole('heading', { level: 1, name: 'Training programs' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    const sidebar = page.getByRole('dialog', { name: 'Sidebar' });
    await expect(sidebar).toBeVisible();
    for (const name of ['Training programs', 'Assignments', 'Sites', 'Course library']) {
      await expect(sidebar.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expectNoPageOverflow(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Workspace' });
    for (const name of ['Overview', 'Programs', 'Assignments', 'Sites']) {
      await expect(navigation.getByRole('button', { name })).toBeVisible();
    }
    await expectNoPageOverflow(page);
  }
});
