import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for visual regression tests.
 *
 * Tests run against the Vite dev server started automatically by this config.
 * Snapshots are stored under tests/visual/__snapshots__/ and committed to source
 * control so CI can diff against them on every PR.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Maximum time one test can run */
  timeout: 30_000,
  /* Expect timeout for assertions */
  expect: {
    timeout: 5_000,
    /**
     * Visual comparison threshold.
     * 0.2 allows minor sub-pixel differences between render environments
     * (CI vs. local) without producing false positives.
     */
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
  /* Fail fast on CI */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
    /* Consistent viewport across environments */
    viewport: { width: 1280, height: 720 },
    /* Disable animations to get deterministic screenshots */
    reducedMotion: 'reduce',
    colorScheme: 'light',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start Vite dev server before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
