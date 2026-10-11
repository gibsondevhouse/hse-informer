import { expect, test } from '@playwright/test';

test('admin can inspect draft programs and filter site assignments', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Synthetic rehearsal data')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Integration monitoring' })).toContainText('Synthetic records are never sent to Moodle');
  await expect(page.getByRole('button', { name: /New assignment/ })).toBeDisabled();

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Programs' }).click();
  await expect(page.locator('.course-card')).toHaveCount(5);
  await page.getByRole('searchbox', { name: 'Search programs' }).fill('respiratory');
  await expect(page.locator('.course-card')).toHaveCount(1);
  await page.locator('.course-card').click();
  const details = page.getByRole('dialog', { name: 'Respiratory Protection' });
  await expect(details).toContainText('Draft classification');
  await expect(details).toContainText('lesson titles');
  await expect(details.getByRole('button', { name: 'Assign approved program' })).toBeDisabled();
  await details.getByRole('button', { name: 'Close program details' }).click();

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Assignments' }).click();
  await page.getByRole('combobox', { name: 'Site' }).selectOption({ label: 'Tifton' });
  await expect(page.getByText('2 matching records')).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCount(2);
  await expect(page.locator('table tbody')).toContainText('Avery Example');
  await expect(page.locator('table tbody')).not.toContainText('Jordan Example');
});

test('summary drilldowns, progress filters, and sorting act on the visible assignment set', async ({ page }) => {
  await page.goto('/');
  const completionCard = page.getByRole('button', { name: /Knowledge completion.*view breakdown/ });
  await completionCard.click();
  await expect(page.getByRole('heading', { name: 'Assignment records' })).toBeVisible();
  await expect(page.locator('.breakdown .ring')).toHaveCount(5);
  await page.getByRole('button', { name: 'View records' }).click();

  const learnerHeader = page.locator('thead th').first();
  await learnerHeader.getByRole('button', { name: 'Sort by learner, ascending' }).click();
  await expect(learnerHeader).toHaveAttribute('aria-sort', 'ascending');
  const ascending = await page.locator('tbody .learner-link').allTextContents();
  expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  await learnerHeader.getByRole('button', { name: 'Sort by learner, descending' }).click();
  await expect(learnerHeader).toHaveAttribute('aria-sort', 'descending');
  expect(await page.locator('tbody .learner-link').allTextContents()).toEqual([...ascending].reverse());
  await page.getByRole('searchbox', { name: 'Search' }).fill('Avery');

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Programs' }).click();
  await page.getByRole('combobox', { name: 'Assignment progress' }).selectOption('overdue');
  await expect(page.locator('.course-card')).toHaveCount(1);
  await expect(page.locator('.course-card')).toContainText('Respiratory Protection');
  await page.getByRole('combobox', { name: 'Assignment progress' }).selectOption('open_knowledge');
  await expect(page.locator('.course-card')).toHaveCount(4);

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
  const dueCard = page.getByRole('button', { name: /Due in the next 30 days/ });
  const dueCount = Number(await dueCard.locator('strong').textContent());
  expect(dueCount).toBeGreaterThan(0);
  await dueCard.click();
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('due_soon');
  await expect(page.locator('tbody .learner-link')).toHaveCount(dueCount);
});

test('deadline edits persist in PostgreSQL across browser contexts', async ({ browser, page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Assignments' }).click();
  await page.getByRole('combobox', { name: 'Site' }).selectOption({ label: 'Tifton' });
  const row = page.getByRole('row', { name: /Avery Example Tifton Respiratory Protection/ });
  await row.getByRole('button', { name: 'Edit due' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit assignment deadline' });
  const original = await editor.getByLabel('New due date').inputValue();
  const changed = original === '2028-06-15' ? '2028-06-16' : '2028-06-15';
  try {
    await editor.getByLabel('New due date').fill(changed);
    await editor.getByRole('button', { name: 'Save deadline' }).click();
    await expect(page.getByRole('status')).toContainText('Deadline updated');

    const other = await browser.newContext();
    try {
      const secondPage = await other.newPage();
      await secondPage.goto('/');
      await secondPage.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Assignments' }).click();
      await secondPage.getByRole('combobox', { name: 'Site' }).selectOption({ label: 'Tifton' });
      await secondPage.getByRole('row', { name: /Avery Example Tifton Respiratory Protection/ }).getByRole('button', { name: 'Edit due' }).click();
      await expect(secondPage.getByRole('dialog', { name: 'Edit assignment deadline' }).getByLabel('New due date')).toHaveValue(changed);
    } finally {
      await other.close();
    }
  } finally {
    await row.getByRole('button', { name: 'Edit due' }).click();
    await page.getByRole('dialog', { name: 'Edit assignment deadline' }).getByLabel('New due date').fill(original);
    await page.getByRole('dialog', { name: 'Edit assignment deadline' }).getByRole('button', { name: 'Save deadline' }).click();
  }
});

test('draft lesson navigation and practice do not change assignments', async ({ page, request }) => {
  const before = await (await request.get('/api/assignments')).json();
  await page.goto('/preview/respiratory-protection');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Preview activity does not affect training records.')).toBeVisible();
  await page.getByRole('button', { name: /Start lesson 1/ }).click();
  for (let section = 1; section < 4; section++) {
    await expect(page.getByText(`Lesson 01 · Section ${section} of 5`)).toBeVisible();
    await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const next = page.getByRole('button', { name: /^Next →$/ });
      if (!(await next.isVisible())) break;
      await next.click();
      await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
    }
    await page.getByRole('button', { name: /Continue →/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'The exhaust stops during bag charging.' })).toBeVisible();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
  const practiceNote = page.locator('.page-content').getByText('Practice only. This response is not recorded as a training assessment.');
  for (let pageNumber = 0; pageNumber < 8 && !(await practiceNote.isVisible()); pageNumber++) {
    await page.getByRole('button', { name: /^Next →$/ }).click();
    await expect(page.locator('.reading-area')).toHaveAttribute('aria-busy', 'false');
  }
  await expect(practiceNote).toBeVisible();
  const after = await (await request.get('/api/assignments')).json();
  expect(after).toEqual(before);
});
