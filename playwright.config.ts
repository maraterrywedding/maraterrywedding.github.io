import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real dev server and the mock RSVP backend,
 * rather than a route stub. The mock implements the awkward parts of the Apps
 * Script contract on purpose — notably that a `text/plain` POST body is
 * required, since anything else triggers a CORS preflight that Apps Script
 * cannot answer. Stubbing would hide exactly that class of mistake.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command: 'npm run dev -- --port 4321',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev:api',
      url: 'http://localhost:8788/?action=status',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
