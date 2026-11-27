import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Run each test file serially to avoid port conflicts with the dev server.
  fullyParallel: false,
  // Fail fast in CI.
  forbidOnly: !!process.env.CI,
  // No retries – visual diffs should be deterministic.
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    // Disable animations so screenshots are stable.
    reducedMotion: 'reduce',
    // Keep screenshots small for fast diffing.
    viewport: { width: 480, height: 600 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Vite dev server before running tests.
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
