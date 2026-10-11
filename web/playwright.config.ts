import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5188';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5188 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DEV_AUTH: 'synthetic', APP_ORIGIN: baseURL }
  }
});
