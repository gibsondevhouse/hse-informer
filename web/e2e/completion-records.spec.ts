import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('administrator records, corrects, voids, and exports preserved completion history', async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, 'Requires a migrated synthetic database');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const reference = `Synthetic UI certificate ${randomUUID()}`;
  let fixture: { tenant_id: string; person_id: string; site_id: string; version_id: string };
  let courseId: string;
  try {
    const subject = await pool.query(`SELECT t.id AS tenant_id, p.id AS person_id, m.site_id,
      rv.id AS version_id FROM tenants t JOIN principals pr ON pr.tenant_id=t.id
      JOIN people p ON p.tenant_id=t.id JOIN person_site_memberships m ON m.tenant_id=p.tenant_id
        AND m.person_id=p.id AND m.ended_at IS NULL
      JOIN requirement_versions rv ON rv.tenant_id=t.id
      WHERE t.synthetic AND p.active AND pr.oidc_issuer='synthetic-dev'
        AND pr.oidc_subject='synthetic-dev-admin' ORDER BY p.display_name LIMIT 1`);
    expect(subject.rowCount).toBe(1);
    fixture = subject.rows[0];
    const course = await pool.query(`INSERT INTO course_versions
      (tenant_id,requirement_version_id,content_id,content_version,title,package_sha256,export_format)
      VALUES ($1,$2,$3,'UI-fixture-1','Synthetic completion UI course',repeat('c',64),'scorm_1_2') RETURNING id`,
    [fixture.tenant_id, fixture.version_id, randomUUID()]);
    courseId = course.rows[0].id;
  } finally { await pool.end(); }

  await page.goto('/records');
  await page.getByRole('button', { name: 'Record manual completion', exact: true }).click();
  const editor = page.locator('.record-editor');
  await editor.getByRole('combobox', { name: 'Site', exact: true }).selectOption(fixture.site_id);
  await editor.getByRole('combobox', { name: 'Person', exact: true }).selectOption(fixture.person_id);
  await editor.getByRole('combobox', { name: 'Exact course version', exact: true }).selectOption(courseId);
  await editor.getByLabel('Original completion date and time').fill('2020-04-12T10:30');
  await editor.getByLabel('Original source / reference').fill(reference);
  await editor.getByLabel('Reason for recording').fill('Synthetic UI verification only');
  await editor.getByRole('button', { name: 'Save manual completion' }).click();
  await expect(page.getByRole('status')).toContainText('Manual completion recorded');
  await expect(page.locator('.record-details')).toContainText('Transcript only');
  await page.getByRole('button', { name: 'Correct record', exact: true }).click();
  await editor.getByLabel('Original completion date and time').fill('2020-04-13T10:30');
  await editor.getByLabel('Reason for recording').fill('Synthetic corrected date verified');
  await editor.getByLabel('Reason for correcting').fill('Synthetic original date was wrong');
  await editor.getByRole('button', { name: 'Record correction' }).click();
  await expect(page.getByRole('status')).toContainText('Correction recorded');
  await expect(page.getByRole('heading', { name: 'Record history' }).locator('..').locator('ol li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Void record', exact: true }).click();
  await page.getByLabel('Reason for voiding').fill('Synthetic source withdrawn');
  await page.getByRole('button', { name: 'Confirm void' }).click();
  await expect(page.getByRole('status')).toContainText('Completion voided');

  await page.getByLabel('Search', { exact: true }).fill(reference);
  await page.getByRole('combobox', { name: 'State', exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('table tbody tr')).toHaveCount(2);
  await expect(page.locator('table tbody')).toContainText('superseded');
  await expect(page.locator('table tbody')).toContainText('voided');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export filtered CSV' }).click();
  const path = await (await download).path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, 'utf8');
  expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3);
  expect(csv).toContain('"superseded"');
  expect(csv).toContain('"voided"');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});
