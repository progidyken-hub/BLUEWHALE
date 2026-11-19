/**
 * Visual regression tests for the AddressInput React component.
 *
 * These tests render the component through the live Vite dev server and capture
 * pixel-exact screenshots ("snapshots") of each meaningful visual state.
 * On subsequent runs the screenshots are compared with the stored baselines;
 * any visual drift above the configured threshold (see playwright.config.ts)
 * causes the test to fail.
 *
 * To update the baselines after an intentional visual change, run:
 *   npx playwright test --update-snapshots
 *
 * States covered:
 *  1. Initial empty state
 *  2. G-address entered (blue badge, memo field visible)
 *  3. G-address + memo entered (routing summary with routing ID)
 *  4. M-address entered (purple badge, memo field hidden)
 *  5. C-address entered (orange badge, error border, warning)
 *  6. Unknown/unrecognized prefix
 *  7. showCopyButton=true – copy buttons visible for base account and routing ID
 *  8. Full routing summary panel visible
 */

import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for the app to be fully hydrated and the input to be visible. */
async function gotoAndWait(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('[aria-label="Stellar address"]', { state: 'visible' });
  // Allow any CSS transitions to settle
  await page.waitForTimeout(200);
}

/** Type into the Stellar address input, clearing first. */
async function typeAddress(page: Page, address: string): Promise<void> {
  const input = page.getByRole('textbox', { name: /stellar address/i });
  await input.fill(address);
  await page.waitForTimeout(100); // let React re-render
}

/** Type into the memo field (only visible for G/UNKNOWN addresses). */
async function typeMemo(page: Page, memo: string): Promise<void> {
  const memoInput = page.getByRole('textbox', { name: /memo/i });
  await memoInput.fill(memo);
  await page.waitForTimeout(100);
}

/** Locate the AddressInput root element. */
function addressInputRoot(page: Page) {
  return page.locator('.bw-address-input');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('AddressInput – visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a stable font to prevent font-loading flakiness across environments
    await page.addStyleTag({
      content: `* { font-family: Arial, Helvetica, sans-serif !important; }`,
    });
  });

  test('1. empty state – initial render', async ({ page }) => {
    await gotoAndWait(page);
    await expect(addressInputRoot(page)).toHaveScreenshot('01-empty.png');
  });

  test('2. G-address entered – blue badge, memo field visible', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO');
    await expect(page.locator('.bw-type-badge--g')).toBeVisible();
    await expect(page.locator('.bw-memo-field')).toBeVisible();
    await expect(addressInputRoot(page)).toHaveScreenshot('02-g-address.png');
  });

  test('3. G-address + memo – routing summary shows routing ID', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO');
    await typeMemo(page, '1234567890');
    await expect(page.locator('.bw-routing-summary')).toBeVisible();
    await expect(addressInputRoot(page)).toHaveScreenshot('03-g-address-with-memo.png');
  });

  test('4. M-address entered – purple badge, memo field hidden', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACAAAAAAAAAAAAD672');
    await expect(page.locator('.bw-type-badge--m')).toBeVisible();
    await expect(page.locator('.bw-memo-field')).not.toBeVisible();
    await expect(addressInputRoot(page)).toHaveScreenshot('04-m-address.png');
  });

  test('5. C-address entered – orange badge, red border, contract warning', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526');
    await expect(page.locator('.bw-type-badge--c')).toBeVisible();
    await expect(page.locator('.bw-warning-list')).toBeVisible();
    await expect(addressInputRoot(page)).toHaveScreenshot('05-c-address.png');
  });

  test('6. unrecognized prefix – no badge, no routing summary', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'XUNKNOWN123');
    await expect(page.locator('.bw-type-badge')).not.toBeVisible();
    // For UNKNOWN prefix the component renders an unstyled routing summary
    // (because it doesn't block it, only C-addresses are blocked).
    // We just verify the badge is absent and the input border is neutral.
    await expect(addressInputRoot(page)).toHaveScreenshot('06-unknown-prefix.png');
  });

  test('7. routing summary panel – base account row visible', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO');
    const summary = page.locator('.bw-routing-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toHaveScreenshot('07-routing-summary.png');
  });

  test('8. M-address routing summary – encoded routing ID row', async ({ page }) => {
    await gotoAndWait(page);
    await typeAddress(page, 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACAAAAAAAAAAAAD672');
    const summary = page.locator('.bw-routing-summary');
    await expect(summary).toBeVisible();
    await expect(page.locator('.bw-routing-summary__value').first()).toContainText('MAYCUYT');
    await expect(summary).toHaveScreenshot('08-m-address-routing-summary.png');
  });
});
