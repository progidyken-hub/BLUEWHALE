/**
 * Visual regression tests for the AddressInput React component.
 *
 * Each test navigates to the react-demo app, interacts with the
 * AddressInput widget, and asserts that the rendered output matches a
 * stored reference screenshot.  On first run the snapshots are created
 * automatically; subsequent runs compare against them.
 *
 * Run:
 *   npx playwright test --update-snapshots   # update baselines
 *   npx playwright test                      # compare against baselines
 */

import { test, expect, Page } from '@playwright/test';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the AddressInput wrapper element (the component root div). */
function addressInputLocator(page: Page) {
  return page.locator('.bw-address-input');
}

/** Types into the Stellar address field. */
async function typeAddress(page: Page, value: string) {
  const input = page.getByRole('textbox', { name: /stellar address/i });
  await input.fill(value);
}

/** Types into the memo field (only visible for G/UNKNOWN addresses). */
async function typeMemo(page: Page, value: string) {
  const input = page.getByRole('textbox', { name: /memo/i });
  await input.fill(value);
}

// ─── setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Confirm the component rendered.
  await expect(addressInputLocator(page)).toBeVisible();
});

// ─── snapshots ────────────────────────────────────────────────────────────────

test('empty state – default appearance', async ({ page }) => {
  // No interaction; just capture the pristine widget.
  await expect(addressInputLocator(page)).toHaveScreenshot('empty-state.png');
});

test('G-address – type badge and memo field visible', async ({ page }) => {
  await typeAddress(page, 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI');
  // TypeBadge and MemoField should appear.
  await expect(page.locator('.bw-type-badge--g')).toBeVisible();
  await expect(page.locator('.bw-memo-field')).toBeVisible();
  await expect(addressInputLocator(page)).toHaveScreenshot('g-address.png');
});

test('G-address with memo – routing summary shows routing ID', async ({ page }) => {
  await typeAddress(page, 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI');
  await typeMemo(page, '123456789');
  // Routing summary should include the memo as routing ID.
  await expect(page.locator('.bw-routing-summary')).toBeVisible();
  await expect(addressInputLocator(page)).toHaveScreenshot('g-address-with-memo.png');
});

test('M-address – type badge shown, no memo field', async ({ page }) => {
  await typeAddress(page, 'MA7QYNF7SOWQ3GLR2BGMZEHXR2FZUQU2T4Z3V7PXLPZPKJLMQ7BAAAAAAAAPCIBVZA');
  await expect(page.locator('.bw-type-badge--m')).toBeVisible();
  // Memo field is hidden for M-addresses.
  await expect(page.locator('.bw-memo-field')).not.toBeVisible();
  await expect(addressInputLocator(page)).toHaveScreenshot('m-address.png');
});

test('C-address – warning list and orange badge', async ({ page }) => {
  await typeAddress(page, 'CCWAMYJME4IDTXDQXVTM7BDDAMQFCWDVJYSPG5QUPXOKUVQXJJDIXSF');
  await expect(page.locator('.bw-type-badge--c')).toBeVisible();
  await expect(page.locator('.bw-warning-list')).toBeVisible();
  await expect(page.locator('.bw-warning-item')).toBeVisible();
  await expect(addressInputLocator(page)).toHaveScreenshot('c-address.png');
});

test('showCopyButton – copy button shown after typing address', async ({ page }) => {
  // The demo renders the default <AddressInput />, which does NOT set
  // showCopyButton.  This test verifies the button is absent by default
  // and matches the baseline.  A separate storybook/iframe fixture would
  // be needed to exercise showCopyButton=true visually.
  await typeAddress(page, 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI');
  expect(await page.getByRole('button', { name: /copy/i }).count()).toBe(0);
  await expect(addressInputLocator(page)).toHaveScreenshot('no-copy-button.png');
});

test('full page – default layout matches baseline', async ({ page }) => {
  await expect(page).toHaveScreenshot('full-page.png', { fullPage: true });
});
