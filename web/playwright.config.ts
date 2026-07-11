import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

// Acceptance viewports from the frontend design handoff.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
