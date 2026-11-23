import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import Papa from 'papaparse';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('aligns the header, hero, trust line, and example result', async ({ page }) => {
  const header = await page.locator('.site-header').boundingBox();
  const card = await page.locator('#choose-card').boundingBox();
  expect(header).not.toBeNull();
  expect(card).not.toBeNull();
  expect(Math.abs(header!.x - card!.x)).toBeLessThanOrEqual(1);

  await expect(page.getByRole('heading', { name: 'Make a member list safe to text' })).toBeVisible();
  await expect(page.locator('.benefits li')).toHaveCount(3);
  await expect(page.locator('#privacy-note')).toHaveText(
    'Runs on your computer. Nothing is uploaded.',
  );
  await expect(page.locator('.privacy-note')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Example result' })).toBeVisible();
  await expect(page.locator('.example-label')).toHaveText('Example');
  await expect(page.locator('.example-tile')).toHaveCount(3);
  await expect(page.locator('.example-tile').nth(0)).toContainText('5');
  await expect(page.locator('.example-tile').nth(1)).toContainText('8');
  await expect(page.locator('.example-tile').nth(2)).toContainText('3');
  await expect(page.getByRole('link', { name: 'View the code on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/duranbeverly/list-check',
  );
  await expect(page.getByRole('link', { name: 'How it works' })).toHaveAttribute(
    'href',
    'https://github.com/duranbeverly/list-check#how-it-works',
  );
  await expect(page.getByRole('link', { name: 'Read how your data stays local' })).toHaveAttribute(
    'href',
    'https://github.com/duranbeverly/list-check#privacy',
  );
  const footerLinkHeights = await page.locator('.site-footer a').evaluateAll((links) =>
    links.map((link) => link.getBoundingClientRect().height),
  );
  expect(footerLinkHeights.every((height) => height >= 40)).toBe(true);
});

test('shows the sample report and review table', async ({ page }) => {
  await expect(page.locator('#results-card')).toBeHidden();
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();

  await expect(page.getByRole('heading', { name: 'Step 2 · Your results' })).toBeVisible();
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );
  await expect(page.locator('#summary')).toHaveClass(/visually-hidden/);
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

test('Check another file returns focus to Step 1', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await page.getByRole('link', { name: 'Check another file' }).click();

  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#hero-title')).toBeFocused();
  const uploadBox = await page.locator('#upload-zone').boundingBox();
  expect(uploadBox).not.toBeNull();
  expect(uploadBox!.y).toBeGreaterThanOrEqual(0);
  expect(uploadBox!.y).toBeLessThan(await page.evaluate(() => innerHeight));
});

test('logo returns to Step 1 without reloading and does not reset there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let mainFrameNavigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1;
  });
  const startingUrl = page.url();

  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#ready-count')).toHaveText('5');
  await page.locator('#wordmark').click();

  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#hero-title')).toBeFocused();
  await expect(page.locator('#file-status')).toHaveText(
    'Started over. Choose a file to check.',
  );
  await expect(page.locator('#file-input')).toHaveValue('');

  await page.locator('#wordmark').click();

  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#file-status')).toHaveText(
    'Started over. Choose a file to check.',
  );
  expect(page.url()).toBe(startingUrl);
  expect(mainFrameNavigations).toBe(0);
});

test('downloads five ready members with why as the last column', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
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

test('highlights a drag and processes a dropped CSV through the file handler', async ({ page }) => {
  const uploadZone = page.locator('#upload-zone');
  await uploadZone.dispatchEvent('dragenter');
  await expect(page.locator('#drop-instruction')).toBeVisible();
  await expect(uploadZone).toHaveClass(/is-drag-over/);

  await uploadZone.evaluate((zone) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(
      ['first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,No'],
      'dropped.csv',
      { type: 'text/csv' },
    ));
    zone.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  });

  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );
  await expect(page.locator('#drop-instruction')).toBeHidden();
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
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );
  await expect(input).toHaveValue('');

  await input.setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(optedOutCsv),
  });
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
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
    'No phone or email column found. Add one, then try again.',
  );
  await expect(page.locator('#file-status')).toBeFocused();
  await expect(page.locator('#file-status-icon')).toBeVisible();
  await expect(page.locator('#selected-file')).toHaveText('Selected file: missing-contact.csv');
  await expect(page.getByRole('button', { name: 'Choose a different file' })).toBeVisible();
  await expect(page.locator('#results-card')).toBeHidden();
});

test('accepts a two-column CSV ending in a newline', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'two-columns.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('phone,city\n571-555-0101,Reston\n'),
  });

  await expect(page.locator('#file-status')).toBeHidden();
  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );
});

test('explains an empty file with a helpful next step', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'empty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(''),
  });

  await expect(page.locator('#file-status')).toHaveText(
    'This file is empty. Choose a file with a header row and people.',
  );
  await expect(page.locator('#file-status')).toBeFocused();
});

test('explains a header-only list and the next step', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'no-people.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('email,phone\n'),
  });

  await expect(page.locator('#summary')).toHaveText(
    'We found the column names but no people yet.',
  );
  await expect(page.locator('#review-empty')).toHaveText(
    'We found the column names but no people yet.',
  );
  await expect(page.locator('#next-step')).toHaveText(
    'Add people below the column names, then check the file again.',
  );
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
  await expect(page.getByRole('button', { name: 'No file handy? Try a sample list' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );

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
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );

  const buttonHeights = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(buttonHeights.every((height) => height >= 44)).toBe(true);
  await expect(page.locator('#review-table td[data-label="Row"]').first()).toHaveCSS(
    'display',
    'flex',
  );
  await expect(page.locator('#review-table td[data-label="Name"]').first()).toHaveCSS(
    'grid-column-start',
    '2',
  );
  const tilePositions = await page.locator('.stat-tile').evaluateAll((tiles) =>
    tiles.map((tile) => tile.getBoundingClientRect().y),
  );
  expect(new Set(tilePositions).size).toBe(1);

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
  const chooserResults = await new AxeBuilder({ page }).analyze();
  expect(chooserResults.violations).toEqual([]);

  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );

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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await sampleRequested;
  await expect(page.locator('#file-status')).toHaveText('Loading the sample list…');
  await expect(page.locator('#loading-spinner')).toBeVisible();
  expect(
    await page.locator('#loading-spinner').evaluate((spinner) => getComputedStyle(spinner).animationName),
  ).toBe('none');

  await page.locator('#file-input').setInputFiles({
    name: 'newer.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,last_name,email,phone,opt_out\nAlex,Member,alex@example.com,571-555-0101,No'),
  });
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );

  const sampleResponse = page.waitForResponse((response) => response.url().includes('sample-members.csv'));
  releaseSample();
  await sampleResponse;
  await expect(page.locator('#summary')).toHaveText(
    'List checked. See the counts and next steps below.',
  );
  await expect(page.locator('#checked-file-name')).toHaveText('newer.csv');
});
