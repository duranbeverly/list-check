import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import Papa from 'papaparse';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

// Show the sample counts and review details.
test('reports the sample list results', async ({ page }) => {
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();

  await expect(page.locator('#summary')).toContainText('5 people are ready to import.');
  await expect(page.locator('#summary')).toContainText('8 need a quick look');
  await expect(page.locator('#summary')).toContainText('3 opted out');
  await expect(page.locator('#review-list li')).toHaveCount(8);
  await expect(page.locator('#review-list li').first()).toContainText('Row 2 · Maria Lopez: same email as row 9');
});

// Download the ready group with its original and added columns.
test('downloads five ready members with why as the last column', async ({ page }) => {
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  await expect(page.getByRole('button', { name: 'Download ready list (to import)' })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (to import)' }).click();
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

// Allow an organizer to select a corrected file with the same name.
test('rechecks the same file name and updates the report', async ({ page }) => {
  const input = page.locator('#file-input');
  const readyCsv = 'first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,No';
  const optedOutCsv = 'first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,Yes';

  await input.setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(readyCsv),
  });
  await expect(page.locator('#summary')).toContainText('1 person is ready to import.');
  await expect(input).toHaveValue('');

  await input.setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(optedOutCsv),
  });
  await expect(page.locator('#summary')).toContainText('Everyone on this list has opted out.');
  await expect(page.locator('#summary')).toContainText('1 opted out');
});

// Explain when a file has no way to contact its members.
test('shows a friendly message when phone and email columns are missing', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'missing-contact.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,last_name\nAlex,Member'),
  });

  await expect(page.locator('#summary')).toContainText('No phone or email column was found');
});

// Keep downloads unavailable until a file has been checked.
test('disables downloads before a file is checked', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Download ready list (to import)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download people to review (to fix)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download opt-outs (to keep out)' })).toBeDisabled();
});

// Keep keyboard focus visible and the buttons in a useful order.
test('supports keyboard navigation with a visible focus outline', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.locator('#file-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Try it with a sample list' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toContainText('5 people are ready to import.');

  const readyButton = page.getByRole('button', { name: 'Download ready list (to import)' });
  await page.keyboard.press('Tab');
  await expect(readyButton).toBeFocused();
  expect(await readyButton.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('solid');

  const readyDownload = page.waitForEvent('download');
  await page.keyboard.press('Space');
  await readyDownload;
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Download people to review (to fix)' })).toBeFocused();
  const reviewDownload = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await reviewDownload;
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Download opt-outs (to keep out)' })).toBeFocused();
  const optedOutDownload = page.waitForEvent('download');
  await page.keyboard.press('Space');
  await optedOutDownload;
});

// Keep text and controls usable at phone width and 200% zoom.
test('fits a phone-width screen at 200% zoom with large tap targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  await expect(page.locator('#summary')).toContainText('5 people are ready to import.');

  const tapTargetHeights = await page.locator('#file-input, #app > button').evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(tapTargetHeights.every((height) => height >= 44)).toBe(true);

  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%';
  });
  const pageWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidths.scroll).toBeLessThanOrEqual(pageWidths.client);
});

// Catch accessibility issues in the rendered report.
test('has no axe accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Try it with a sample list' }).click();
  await expect(page.locator('#summary')).toContainText('5 people are ready to import.');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// Ignore a sample request if a newer file is checked first.
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
  await expect(page.locator('#summary')).toContainText('1 person is ready to import.');

  const sampleResponse = page.waitForResponse((response) => response.url().includes('sample-members.csv'));
  releaseSample();
  await sampleResponse;
  await expect(page.locator('#summary')).toContainText('1 person is ready to import.');
});
