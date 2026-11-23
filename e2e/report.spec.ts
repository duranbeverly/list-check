import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import Papa from 'papaparse';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('shows the sample report and review table', async ({ page }) => {
  await expect(page.locator('#results-card')).toBeHidden();
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();

  await expect(page.locator('#summary')).toHaveText('5 people are ready to import.');
  await expect(page.locator('#ready-count')).toHaveText('5');
  await expect(page.locator('#review-count')).toHaveText('8');
  await expect(page.locator('#opted-out-count')).toHaveText('3');
  await expect(page.locator('#review-table-body tr')).toHaveCount(8);
  await expect(page.locator('#review-table-body tr').first()).toContainText('Row 2');
  await expect(page.locator('#review-table-body tr').first()).toContainText('Maria Lopez');
  await expect(page.locator('#review-table-body tr').first()).toContainText(
    'Same email as row 9. Keep one.',
  );
  await expect(page.locator('#download-ready')).toHaveClass(/button-primary/);
  await expect(page.locator('#download-review')).toHaveClass(/button-secondary/);
  await expect(page.locator('#download-opted-out')).toHaveClass(/button-secondary/);
  await expect(page.locator('.button-primary:visible')).toHaveCount(1);
});

test('downloads five ready members with why as the last column', async ({ page }) => {
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  const readyButton = page.getByRole('button', { name: 'Download ready list (5)' });
  await expect(readyButton).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await readyButton.click();
  const download = await downloadPromise;
  const path = await download.path();

  expect(download.suggestedFilename()).toBe('sample-members-ready.csv');
  if (!path) {
    throw new Error('The ready-list download did not produce a file');
  }

  const csv = await readFile(path, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
  expect(parsed.data).toHaveLength(5);
  expect(parsed.meta.fields?.at(-1)).toBe('why');
});

test('rechecks the same file name and updates the report', async ({ page }) => {
  const input = page.locator('#file-input');
  const readyCsv = 'first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,No';
  const optedOutCsv = 'first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,Yes';

  await input.setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(readyCsv),
  });
  await expect(page.locator('#summary')).toHaveText('Everyone looks ready to import.');
  await expect(input).toHaveValue('');

  await input.setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(optedOutCsv),
  });
  await expect(page.locator('#summary')).toHaveText(
    'Everyone on this list has opted out. No one is ready to import.',
  );
  await expect(page.locator('#opted-out-count')).toHaveText('1');
  await expect(page.locator('#review-table')).toBeHidden();
});

test('shows a friendly message when phone and email columns are missing', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'missing-contact.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,last_name\nAlex,Member'),
  });

  await expect(page.locator('#file-status')).toHaveText(
    'Could not find a phone or email column. Add one and try again.',
  );
  await expect(page.locator('#results-card')).toBeHidden();
});

test('keeps results and downloads hidden before a file is checked', async ({ page }) => {
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#download-ready')).toBeHidden();
  await expect(page.locator('#download-review')).toBeHidden();
  await expect(page.locator('#download-opted-out')).toBeHidden();
  await expect(page.locator('.upload-action')).toBeVisible();
});

test('supports keyboard navigation with a visible focus outline', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.locator('.wordmark')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#file-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Try it with a sample list' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toHaveText('5 people are ready to import.');

  const readyButton = page.getByRole('button', { name: 'Download ready list (5)' });
  await page.keyboard.press('Tab');
  await expect(readyButton).toBeFocused();
  expect(await readyButton.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('solid');

  const readyDownload = page.waitForEvent('download');
  await page.keyboard.press('Space');
  await readyDownload;

  await page.keyboard.press('Tab');
  const reviewButton = page.getByRole('button', { name: 'Download to review (8)' });
  await expect(reviewButton).toBeFocused();
  const reviewDownload = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await reviewDownload;

  await page.keyboard.press('Tab');
  const optedOutButton = page.getByRole('button', { name: 'Download opt-outs (3)' });
  await expect(optedOutButton).toBeFocused();
  const optedOutDownload = page.waitForEvent('download');
  await page.keyboard.press('Space');
  await optedOutDownload;
});

test('fits a phone-width screen at 200% zoom and supports dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  await expect(page.locator('#summary')).toHaveText('5 people are ready to import.');

  const buttonHeights = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(buttonHeights.every((height) => height >= 44)).toBe(true);
  await expect(page.locator('#review-table td[data-label="Row"]').first()).toHaveCSS('display', 'grid');

  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%';
  });
  const pageWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidths.scroll).toBeLessThanOrEqual(pageWidths.client);

  await page.emulateMedia({ colorScheme: 'dark' });
  const [pageBackground, cardBackground] = await page.evaluate(() => [
    getComputedStyle(document.documentElement).backgroundColor,
    getComputedStyle(document.querySelector('.card')!).backgroundColor,
  ]);
  expect(pageBackground).not.toBe(cardBackground);
});

test('has no axe accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  await expect(page.locator('#summary')).toHaveText('5 people are ready to import.');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('keeps the newer report when a sample request finishes late', async ({ page }) => {
  let releaseSample: () => void = () => {};
  let markSampleRequested: () => void = () => {};
  const sampleGate = new Promise<void>((resolve) => {
    releaseSample = resolve;
  });
  const sampleRequested = new Promise<void>((resolve) => {
    markSampleRequested = resolve;
  });

  await page.route('**/sample-members.csv', async (route) => {
    markSampleRequested();
    await sampleGate;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  await sampleRequested;

  await page.locator('#file-input').setInputFiles({
    name: 'newer.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,No'),
  });
  await expect(page.locator('#summary')).toHaveText('Everyone looks ready to import.');

  const sampleResponse = page.waitForResponse((response) => response.url().includes('sample-members.csv'));
  releaseSample();
  await sampleResponse;
  await expect(page.locator('#summary')).toHaveText('Everyone looks ready to import.');
  await expect(page.locator('#checked-file-name')).toHaveText('newer.csv');
});
