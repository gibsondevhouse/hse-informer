import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5192';
export default defineConfig({
  testDir: './e2e', testMatch: 'beta-learning.spec.ts', workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'],
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5192 --strictPort', url: `${baseURL}/api/health`,
    reuseExistingServer: false, timeout: 60_000, env: {
      DEV_AUTH: '', APP_ORIGIN: baseURL, OIDC_ISSUER: 'https://identity.beta.test/realms/test',
      OIDC_CLIENT_ID: 'beta-http-tests', OIDC_CLIENT_SECRET: 'isolated-test-only',
      SESSION_SECRET: 'isolated-beta-http-session-secret-at-least-32-bytes',
      MOODLE_CONNECTIONS_JSON: JSON.stringify({ '8da16f24-496e-42cb-aeb2-dc922dfba112': {
        instanceId: '37b4d73b-eddd-4ba0-94d3-38a8d938ee21', baseUrl: 'https://moodle.beta.test', token: 'isolated-test-only'
      } })
    } }
});
