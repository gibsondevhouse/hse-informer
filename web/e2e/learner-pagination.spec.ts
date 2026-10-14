import { expect, test } from '@playwright/test';

test('draft learner pages fit the reading area and keep every intro block in order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 620 });
  await page.goto('/preview/respiratory-protection');
  const reading = page.locator('.reading-area');
  await expect(reading).toHaveAttribute('aria-busy', 'false');
  const measuredWidth = await page.locator('.lesson-measure').evaluate((element) => element.getBoundingClientRect().width);
  const readingWidth = await reading.evaluate((element) => element.clientWidth);
  expect(Math.abs(measuredWidth - readingWidth)).toBeLessThanOrEqual(1);
  const position = page.getByRole('navigation', { name: 'Lesson navigation' }).locator('span').first();
  await expect(position).toContainText(/1 \/ [2-9]/);
  const total = Number((await position.textContent())?.match(/\d+ \/ (\d+)/)?.[1]);
  expect(total).toBeGreaterThan(1);
  const seen: number[] = [];
  for (let index = 0; index < total; index++) {
    await expect(position).toContainText(`${index + 1} / ${total}`);
    seen.push(...(await page.locator('.page-content .content-block').evaluateAll((nodes) => nodes.map((node) => Number((node as HTMLElement).dataset.source)))));
    const overflow = await reading.evaluate((element) => element.scrollHeight - element.clientHeight);
    expect(overflow).toBeLessThanOrEqual(2);
    if (index < total - 1) {
      await page.getByRole('button', { name: 'Next →' }).click();
    }
  }
  expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  await page.getByRole('button', { name: 'Start lesson 1 →' }).click();
  await expect(reading).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.lesson-position')).toContainText('Lesson 01 · Section 1 of 5');
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.locator('.lesson-position')).toContainText('Course introduction');
});

test('short viewports split long copy without reducing its font size', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 340 });
  await page.goto('/preview/respiratory-protection');
  await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
  const measured = page.locator('.lesson-measure .content-block');
  await expect.poll(async () => measured.count()).toBeGreaterThan(8);
  const titleFontSize = await page.locator('.page-content h1').evaluate((element) => getComputedStyle(element).fontSize);
  expect(Number.parseFloat(titleFontSize)).toBeGreaterThanOrEqual(23);
  const noteText = (await page.locator('.lesson-measure .note p').allTextContents()).join(' ').replace(/\s+/g, ' ');
  expect(noteText).toBe('Only the opening lesson is available here. Full instruction, demonstrations, narration, and assessment will be developed and reviewed before release.');
});
