import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.RECORDS_BASE_URL || 'http://127.0.0.1:5194';
export default defineConfig({
  testDir: './e2e', testMatch: ['completion-records.spec.ts'], workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
  webServer: process.env.RECORDS_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5194 --strictPort', url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { DEV_AUTH: 'synthetic', APP_ORIGIN: baseURL }
  }
});
