import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5188';
const reactPreviewURL = process.env.REACT_PREVIEW_URL || 'http://127.0.0.1:5189';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure', colorScheme: 'light' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5188 --strictPort',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { DEV_AUTH: 'synthetic', APP_ORIGIN: baseURL }
    },
    ...(!process.env.REACT_PREVIEW_URL ? [{
      command: 'npm run dev --prefix ../admin-app -- --host 127.0.0.1 --port 5189 --strictPort',
      url: reactPreviewURL,
      reuseExistingServer: false,
      timeout: 60_000
    }] : [])
  ]
});
