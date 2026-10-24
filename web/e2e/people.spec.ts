import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('admin creates and edits a stable profile, then deactivates it without deleting it',async({page})=>{
  const suffix=Date.now().toString(),name=`Profile Browser ${suffix}`;
  await page.goto('/people');await page.getByRole('button',{name:'Add person',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Employee number',{exact:true}).fill(`BROWSER-${suffix}`);
  await page.getByLabel('Phone',{exact:true}).fill('555-0105');await page.getByLabel('Tifton',{exact:true}).check();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByLabel('Reason for change',{exact:true}).fill('Create browser verification worker');await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Profile saved'})).toBeVisible();
  const identity=await page.locator('.identity').filter({hasText:'Stable person ID:'}).textContent();expect(identity).toMatch(/Stable person ID: [a-f0-9-]{36}/);
  await expect(page.getByRole('heading',{name:'Account access',exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByLabel('Department',{exact:true}).fill('Maintenance');await page.getByLabel('Reason for change',{exact:true}).fill('Update worker department');await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Training context review',exact:true})).toBeVisible();await expect(page.locator('.identity').filter({hasText:'Stable person ID:'})).toHaveText(identity!);
  await page.getByLabel('Active profile',{exact:true}).uncheck();await page.getByLabel('Reason for change',{exact:true}).fill('Worker completed the beta pilot');await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Profile saved'})).toBeVisible();await expect(page.getByLabel('Active profile',{exact:true})).not.toBeChecked();
  await expect(page.getByText('Moodle account synchronization: pending.',{exact:false})).toBeVisible();
  await page.reload();await page.getByLabel('Include inactive people',{exact:true}).check();await page.getByRole('button',{name:new RegExp(name)}).click();
  await expect(page.getByLabel('Department',{exact:true})).toHaveValue('Maintenance');await expect(page.locator('.identity').filter({hasText:'Stable person ID:'})).toHaveText(identity!);await expect(page.getByRole('heading',{name:'Assignments and completion history'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
});

test('roster UI requires a dry run, reports rejected rows and remains accessible on mobile',async({page})=>{
  await page.goto('/people');await page.getByRole('button',{name:'Import roster',exact:true}).click();
  await page.getByLabel('CSV contents',{exact:true}).fill(`employeeNumber,displayName,siteCode\nDRY-${Date.now()},Dry Run Worker,tifton\nBAD-${Date.now()},Rejected Worker,unknown-site`);
  await expect(page.getByRole('button',{name:'Import reviewed rows',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Run dry run',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'1 new · 0 changed · 0 unchanged · 1 rejected'})).toBeVisible();await expect(page.getByRole('button',{name:'Import reviewed rows',exact:true})).toBeDisabled();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(accessibility.violations).toEqual([]);
});
