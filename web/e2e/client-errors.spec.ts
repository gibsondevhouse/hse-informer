import { expect, test } from '@playwright/test';

test('a browser failure reports fixed metadata without error text, cookies or referrer', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'private-test-cookie', value: 'must-stay-in-browser', url: baseURL! }]);
  await page.goto('/people');
  // Opening the profile form proves that the client has hydrated and its init
  // hook is active; an SSR heading alone would not establish that boundary.
  await page.getByRole('button', { name: 'Add person', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
  const delivered = page.waitForResponse(response => new URL(response.url()).pathname === '/api/client-errors');
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {
    message: 'private worker@example.test and password=must-not-be-reported',
    error: new Error('private stack and identity')
  })));
  const response = await delivered;
  expect(response.status()).toBe(204);
  expect(response.request().postDataJSON()).toEqual({ route: '/people', errorCode: 'unhandled_error', status: 500 });
  const headers = await response.request().allHeaders();
  expect(headers.cookie).toBeUndefined(); expect(headers.referer).toBeUndefined();
  expect(response.headers()['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.headers()['cache-control']).toContain('no-store');
});
