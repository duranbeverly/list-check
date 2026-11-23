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
    '5 ready, 8 to review, 3 opted out.',
  );
  await expect(page.locator('#summary')).toHaveAttribute('aria-live', 'polite');
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

test('checks a file without contacting another host or posting data', async ({ page }) => {
  const requests: Array<{ url: string; method: string }> = [];
  page.on('request', (request) => {
    requests.push({ url: request.url(), method: request.method() });
  });
  await page.reload();

  await page.locator('#file-input').setInputFiles({
    name: 'local-only.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,phone,opt_out\nAna,ana@example.com,571-555-0101,No'),
  });
  await expect(page.locator('#ready-count')).toHaveText('1');

  const pageOrigin = new URL(page.url()).origin;
  expect(requests.every(({ url }) => new URL(url).origin === pageOrigin)).toBe(true);
  expect(requests.every(({ method }) => method !== 'POST')).toBe(true);
});

test('blocks a ready list until the organizer confirms opt-out handling', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'missing-opt-outs.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,phone\nAna,ana@example.com,571-555-0101'),
  });

  await expect(page.locator('#opt-out-setup')).toBeVisible();
  await expect(page.locator('#opt-out-warning')).toHaveText(
    'We could not identify an opt-out column. Choose one below, or deliberately confirm that this list has no opt-out information.',
  );
  await expect(page.locator('#example-preview')).toBeHidden();
  await expect(page.locator('#opt-out-column')).toBeFocused();
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#download-ready')).toBeHidden();
  await expect(page.getByRole('button', { name: 'This list has no opt-outs' })).toBeDisabled();

  await page.getByRole('checkbox', {
    name: 'I checked: this list has no opt-out information.',
  }).check();
  await expect(page.getByRole('button', { name: 'This list has no opt-outs' })).toBeEnabled();
  await page.getByRole('button', { name: 'This list has no opt-outs' }).click();
  await expect(page.locator('#opt-out-setup')).toBeHidden();
  await expect(page.locator('#opt-out-note-text')).toHaveText(
    'You confirmed this list has no opt-out column.',
  );
  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Download ready list (1)' })).toBeVisible();
});

test('requires a deliberate column choice for a low-confidence opt-out guess', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'custom-opt-outs.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,custom_opt_out_flag\nAna,ana@example.com,571-555-0101,No',
    ),
  });

  await expect(page.locator('#opt-out-warning')).toContainText(
    'Possible opt-out column: custom_opt_out_flag',
  );
  await expect(page.locator('#opt-out-column')).toHaveValue('');
  await expect(page.locator('#opt-out-mode-controls')).toBeHidden();
  await expect(page.locator('#use-opt-out-column')).toBeDisabled();

  await page.locator('#opt-out-column').selectOption('custom_opt_out_flag');
  await expect(page.locator('#opt-out-mode-controls')).toBeVisible();
  await expect(page.locator('#use-opt-out-column')).toBeEnabled();
  await expect(page.locator('#results-card')).toBeHidden();

  await page.getByRole('button', { name: 'Use this column' }).click();
  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#opt-out-note-text')).toHaveText(
    'Using the custom_opt_out_flag column for opt-outs.',
  );
});

test('interprets Action Network subscription statuses safely', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'action-network.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,can2_phone,can2_sms_status\nAna,ana@example.com,571-555-0101,subscribed\nOmar,omar@example.com,571-555-0102,unsubscribed\nRae,rae@example.com,571-555-0103,pending',
    ),
  });

  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#review-count')).toHaveText('1');
  await expect(page.locator('#opted-out-count')).toHaveText('1');
  await expect(page.locator('#review-table-body')).toContainText(
    'Subscription status "pending" is unclear. Confirm permission before texting.',
  );
});

test('treats "Opted Out" in an sms_opt_out column as opted out', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'sms-opt-outs.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,sms_opt_out\nAna,ana@example.com,571-555-0101,Opted Out\nBea,bea@example.com,571-555-0102,No',
    ),
  });

  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#opted-out-count')).toHaveText('1');
});

test('keeps an extra-value row in review and processes the other rows', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'ragged.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,opt_out\nAna,ana@example.com,571-555-0101,No\nBea,bea@example.com,571-555-0102,No,unexpected',
    ),
  });

  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#review-count')).toHaveText('1');
  await expect(page.locator('#review-table-body')).toContainText(
    'This row has extra values. Check the columns.',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download to review (1)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('The review download did not produce a file');
  const downloadedCsv = await readFile(path, 'utf8');
  expect(downloadedCsv).toContain('Extra value 1');
  expect(downloadedCsv).toContain('unexpected');
});

test('accepts extensionless text/csv and rejects Excel files', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'members',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,opt_out\nAna,ana@example.com,571-555-0101,No',
    ),
  });
  await expect(page.locator('#ready-count')).toHaveText('1');

  await page.locator('#file-input').setInputFiles({
    name: 'members.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('not a csv'),
  });
  await expect(page.locator('#file-status')).toHaveText(
    'This looks like an Excel file. Save it as CSV and try again.',
  );
});

test('explains multiple phone numbers in one cell', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'multiple-phones.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,opt_out\nAna,ana@example.com,703-200-0027 / 703-200-0028,No',
    ),
  });

  await expect(page.locator('#review-table-body')).toContainText(
    'Two numbers in one cell. Keep one.',
  );
});

test('lets the browser Back button return from results to Step 1', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#results-card')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#choose-card')).toBeVisible();
});

test('clears the opt-out warning after a later file has a recognized column', async ({ page }) => {
  const input = page.locator('#file-input');
  await input.setInputFiles({
    name: 'unknown-opt-outs.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,phone\nAna,ana@example.com,571-555-0101'),
  });
  await expect(page.locator('#opt-out-warning')).not.toBeEmpty();

  await input.setInputFiles({
    name: 'known-opt-outs.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,opt_out\nBea,bea@example.com,571-555-0102,No',
    ),
  });
  await expect(page.locator('#opt-out-setup')).toBeHidden();
  await expect(page.locator('#opt-out-warning')).toBeEmpty();
});

test('allows changing the opt-out column from the results', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'change-opt-out.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,opt_out\nAna,ana@example.com,571-555-0101,No',
    ),
  });
  await page.getByRole('button', { name: 'Change' }).click();
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#opt-out-setup')).toBeVisible();
  await expect(page.locator('#opt-out-column')).toHaveValue('');
});

test('opts out everyone who shares a phone with someone who says STOP', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'shared-stop.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,last_name,phone,opt_out\nAna,Reyes,571-555-0101,No\nLuis,Reyes,571-555-0101,STOP',
    ),
  });

  await expect(page.locator('#ready-count')).toHaveText('0');
  await expect(page.locator('#review-count')).toHaveText('0');
  await expect(page.locator('#opted-out-count')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Download opt-outs (2)' })).toBeVisible();
});

test('Check another file returns focus to Step 1', async ({ page }) => {
  const uploadHeightBefore = (await page.locator('#upload-zone').boundingBox())!.height;
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await page.getByRole('link', { name: 'Check another file' }).click();

  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#hero-title')).toBeFocused();
  await expect(page.locator('#step-announcement')).toHaveText(
    'Started over. Choose a file to check.',
  );
  await expect(page.locator('#file-status')).toBeHidden();
  expect(await page.locator('#hero-title').evaluate((heading) => getComputedStyle(heading).outlineStyle))
    .toBe('none');
  const uploadHeightAfter = (await page.locator('#upload-zone').boundingBox())!.height;
  expect(uploadHeightAfter).toBe(uploadHeightBefore);
  const uploadBox = await page.locator('#upload-zone').boundingBox();
  expect(uploadBox).not.toBeNull();
  expect(uploadBox!.y).toBeGreaterThanOrEqual(0);
  expect(uploadBox!.y).toBeLessThan(await page.evaluate(() => innerHeight));
});

test('focuses and scrolls the results heading into view on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();

  const heading = page.locator('#results-title');
  await expect(heading).toBeFocused();
  expect(await heading.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  await page.waitForFunction(() => {
    const box = document.querySelector('#results-title')?.getBoundingClientRect();
    return box !== undefined && box.top >= 0 && box.bottom <= innerHeight;
  });
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
});

test('logo returns to Step 1 without reloading and does not reset there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    (window as Window & { noReload?: boolean }).noReload = true;
  });
  const startingUrl = page.url();

  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#ready-count')).toHaveText('5');
  await page.locator('#wordmark').click();

  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#hero-title')).toBeFocused();
  await expect(page.locator('#step-announcement')).toHaveText(
    'Started over. Choose a file to check.',
  );
  await expect(page.locator('#file-status')).toBeHidden();
  await expect(page.locator('#file-input')).toHaveValue('');

  await page.locator('#wordmark').click();

  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#step-announcement')).toHaveText(
    'Started over. Choose a file to check.',
  );
  expect(page.url()).toBe(startingUrl);
  expect(
    await page.evaluate(() => (window as Window & { noReload?: boolean }).noReload),
  ).toBe(true);
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
  expect(parsed.meta.fields).toEqual([
    'first_name',
    'last_name',
    'email',
    'phone',
    'opt_out',
    'phone_clean',
    'why',
  ]);
  expect(parsed.data.every(({ why }) => why === '')).toBe(true);
  expect(parsed.data.every(({ phone_clean }) => phone_clean.startsWith('+'))).toBe(true);
});

test('downloads review reasons exactly as shown in the table', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  const reason = await page.locator(
    '#review-table-body tr:first-child td[data-label="What to check"]',
  ).textContent();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download to review (8)' }).click();
  const download = await downloadPromise;
  const path = await download.path();

  if (!path) {
    throw new Error('The review-list download did not produce a file');
  }

  const csv = await readFile(path, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
  expect(parsed.data).toHaveLength(8);
  expect(parsed.meta.fields?.at(-1)).toBe('why');
  expect(parsed.data[0].why).toBe(reason);
});

test('downloads opt-outs with the expected contents', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download opt-outs (3)' }).click();
  const download = await downloadPromise;
  const path = await download.path();

  if (!path) {
    throw new Error('The opt-out download did not produce a file');
  }

  const csv = await readFile(path, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
  expect(parsed.data).toHaveLength(3);
  expect(parsed.meta.fields).toEqual([
    'first_name',
    'last_name',
    'email',
    'phone',
    'opt_out',
    'phone_clean',
    'why',
  ]);
  expect(parsed.data.every(({ why }) => why.length > 0)).toBe(true);
  expect(parsed.data.every(({ opt_out }) => ['Yes', 'STOP', 'do not text'].includes(opt_out)))
    .toBe(true);
});

test('re-downloading a ready file produces byte-identical CSV', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  const firstDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (5)' }).click();
  const firstDownload = await firstDownloadPromise;
  const firstPath = await firstDownload.path();
  if (!firstPath) {
    throw new Error('The first ready-list download did not produce a file');
  }
  const firstFile = await readFile(firstPath);

  await page.locator('#file-input').setInputFiles({
    name: firstDownload.suggestedFilename(),
    mimeType: 'text/csv',
    buffer: firstFile,
  });
  await expect(page.locator('#ready-count')).toHaveText('5');

  const secondDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (5)' }).click();
  const secondDownload = await secondDownloadPromise;
  const secondPath = await secondDownload.path();
  if (!secondPath) {
    throw new Error('The second ready-list download did not produce a file');
  }

  expect(await readFile(secondPath)).toEqual(firstFile);
});

test('preserves accented names and the UTF-8 BOM through download and re-upload', async ({ page }) => {
  const input = page.locator('#file-input');
  await input.setInputFiles({
    name: 'accented.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      '\uFEFFfirst_name,last_name,email,phone,opt_out\nJosé,Nguyễn,jose@example.com,571-555-0101,No',
      'utf8',
    ),
  });
  await expect(page.locator('#ready-count')).toHaveText('1');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (1)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error('The accented-list download did not produce a file');
  }

  const downloadedFile = await readFile(path);
  expect(downloadedFile.toString('utf8').startsWith('\uFEFF')).toBe(true);
  const parsed = Papa.parse<Record<string, string>>(downloadedFile.toString('utf8'), {
    header: true,
  });
  expect(parsed.data[0].first_name).toBe('José');
  expect(parsed.data[0].last_name).toBe('Nguyễn');

  await input.setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'text/csv',
    buffer: downloadedFile,
  });
  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#checked-file-name')).toHaveText(download.suggestedFilename());
});

test('normalizes mixed line endings before checking a list', async ({ page }) => {
  const encoded = await readFile(
    new URL('../tests/fixtures/mixed-line-endings.csv.base64', import.meta.url),
    'utf8',
  );
  await page.locator('#file-input').setInputFiles({
    name: 'mixed-lines.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(encoded, 'base64'),
  });

  await expect(page.locator('#summary')).toHaveText('2 ready, 0 to review, 0 opted out.');
  await expect(page.locator('#opt-out-note')).toContainText(
    'No phone column, so we checked emails only.',
  );
});

test('reads Windows-1252 names in the browser and in the download', async ({ page }) => {
  const encoded = await readFile(
    new URL('../tests/fixtures/windows-1252.csv.base64', import.meta.url),
    'utf8',
  );
  await page.locator('#file-input').setInputFiles({
    name: 'windows-1252.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(encoded, 'base64'),
  });

  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#opt-out-note')).toContainText(
    'This file was read as Windows-1252 to preserve names.',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (1)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error('The Windows-1252 download did not produce a file');
  }
  const parsed = Papa.parse<Record<string, string>>(await readFile(path, 'utf8'), {
    header: true,
  });
  expect(parsed.data[0]).toMatchObject({ first_name: 'José', last_name: 'Peña' });
});

test('does not mark email-only people as missing a phone number', async ({ page }) => {
  const fixture = await readFile(
    new URL('../tests/fixtures/email-only.csv', import.meta.url),
  );
  await page.locator('#file-input').setInputFiles({
    name: 'email-only.csv',
    mimeType: 'text/csv',
    buffer: fixture,
  });

  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#review-count')).toHaveText('0');
  await expect(page.locator('#opt-out-note')).toContainText(
    'No phone column, so we checked emails only.',
  );
  await expect(page.locator('#review-table-body tr')).toHaveCount(0);
});

test('renders names as text and escapes spreadsheet formulas in downloaded cells', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'html-name.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,last_name,email,phone,opt_out\n<img src=x onerror=alert(1)>,Member,ana@example.com,555-01,No',
    ),
  });
  const injectedName = page.locator('#review-table-body td[data-label="Name"]');
  await expect(injectedName).toHaveText('<img src=x onerror=alert(1)> Member');
  await expect(page.locator('#review-table-body img')).toHaveCount(0);

  await page.locator('#file-input').setInputFiles({
    name: 'formulas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,email,phone,note,opt_out\nAna,ana@example.com,571-555-0101,=1+1,No\nBea,bea@example.com,571-555-0102,+1+1,No\nGia,gia@example.com,571-555-0103,@SUM(1),No',
    ),
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (3)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error('The formula-list download did not produce a file');
  }

  const parsed = Papa.parse<Record<string, string>>(await readFile(path, 'utf8'), {
    header: true,
  });
  expect(parsed.data.map(({ note }) => note)).toEqual(["'=1+1", "'+1+1", "'@SUM(1)"]);
  expect(parsed.data.every(({ phone_clean }) => phone_clean.startsWith('+'))).toBe(true);
});

test('preserves colliding source columns and adds separate checked columns', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'collision.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'first_name,phone,why,phone_clean,opt_out\nAna,571-555-0101,original reason,original phone,No',
    ),
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ready list (1)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error('The collision-list download did not produce a file');
  }

  const parsed = Papa.parse<Record<string, string>>(await readFile(path, 'utf8'), {
    header: true,
  });
  expect(parsed.meta.fields).toEqual([
    'first_name',
    'phone',
    'why',
    'phone_clean',
    'opt_out',
    'list_check_phone_clean',
    'list_check_why',
  ]);
  expect(parsed.data[0].why).toBe('original reason');
  expect(parsed.data[0].phone_clean).toBe('original phone');
  expect(parsed.data[0].list_check_phone_clean).toBe('+15715550101');
  expect(parsed.data[0].list_check_why).toBe('');
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
    '1 ready, 0 to review, 0 opted out.',
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
    '1 ready, 0 to review, 0 opted out.',
  );
  await expect(input).toHaveValue('');

  await input.setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(optedOutCsv),
  });
  await expect(page.locator('#summary')).toHaveText(
    '0 ready, 0 to review, 1 opted out.',
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

test('explains semicolon- and tab-delimited files', async ({ page }) => {
  const input = page.locator('#file-input');
  await input.setInputFiles({
    name: 'semicolon.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name;phone\nAna;571-555-0101'),
  });
  await expect(page.locator('#file-status')).toHaveText(
    'This file uses semicolons. Save it as comma-separated CSV and try again.',
  );

  await input.setInputFiles({
    name: 'tab.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name\tphone\nAna\t571-555-0101'),
  });
  await expect(page.locator('#file-status')).toHaveText(
    'This file uses tabs. Save it as comma-separated CSV and try again.',
  );
});

test('accepts a two-column CSV ending in a newline and confirms opt-out handling', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'two-columns.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('phone,city\n571-555-0101,Reston\n'),
  });

  await expect(page.locator('#file-status')).toBeHidden();
  await expect(page.locator('#opt-out-setup')).toBeVisible();
  await page.getByRole('checkbox', {
    name: 'I checked: this list has no opt-out information.',
  }).check();
  await page.getByRole('button', { name: 'This list has no opt-outs' }).click();
  await expect(page.locator('#ready-count')).toHaveText('1');
  await expect(page.locator('#summary')).toHaveText(
    '1 ready, 0 to review, 0 opted out.',
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
    buffer: Buffer.from('email,phone,opt_out\n'),
  });

  await expect(page.locator('#summary')).toHaveText(
    '0 ready, 0 to review, 0 opted out.',
  );
  await expect(page.locator('#review-empty')).toHaveText(
    'We found the column names but no people yet.',
  );
  await expect(page.locator('#next-step')).toHaveText(
    'Add people below the column names, then check the file again.',
  );
});

test('clears stale results on errors and replaces errors after a valid check', async ({ page }) => {
  const input = page.locator('#file-input');
  await input.setInputFiles({
    name: 'good.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,phone,opt_out\nAna,ana@example.com,571-555-0101,No'),
  });
  await expect(page.getByRole('button', { name: 'Download ready list (1)' })).toBeVisible();

  await input.setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,last_name\nAna,Reyes'),
  });
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#download-ready')).toBeHidden();
  await expect(page.locator('#download-review')).toBeHidden();
  await expect(page.locator('#download-opted-out')).toBeHidden();
  await expect(page.locator('#file-status')).toHaveText(
    'No phone or email column found. Add one, then try again.',
  );

  await input.setInputFiles({
    name: 'good-again.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,phone,opt_out\nLuis,luis@example.com,571-555-0102,No'),
  });
  await expect(page.locator('#results-card')).toBeVisible();
  await expect(page.locator('#file-status')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Download ready list (1)' })).toBeVisible();
});

test('checks 10,000 rows quickly and keeps the review table bounded', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'The timing threshold is measured in Chromium only.');

  const rows = Array.from(
    { length: 10_000 },
    (_, index) => `Member ${index},member${index}@example.com,,No`,
  );
  const csv = `first_name,email,phone,opt_out\n${rows.join('\n')}`;
  const startedAt = Date.now();
  await page.locator('#file-input').setInputFiles({
    name: 'large.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.locator('#summary')).toHaveText(
    '0 ready, 10000 to review, 0 opted out.',
  );
  expect(Date.now() - startedAt).toBeLessThan(3_000);
  await expect(page.locator('#review-table-body tr')).toHaveCount(11);
  await expect(page.locator('#review-table-body tr').last()).toHaveText(
    'and 9990 more in the download.',
  );

  await page.locator('#wordmark').click();
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#hero-title')).toBeFocused();
});

test('processes a 100,000-person list', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The large-list limit is measured in Chromium only.');

  const rows = Array.from(
    { length: 100_000 },
    (_, index) => `Member ${index},member${index}@example.com,No`,
  );
  const csv = `first_name,email,opt_out\n${rows.join('\n')}`;
  const startedAt = Date.now();
  await page.locator('#file-input').setInputFiles({
    name: '100000-people.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.locator('#summary')).toHaveText(
    '100000 ready, 0 to review, 0 opted out.',
    { timeout: 20_000 },
  );
  expect(Date.now() - startedAt).toBeLessThan(20_000);
});

test('does not prevent modified clicks on the logo', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  const prevented = await page.locator('#wordmark').evaluate((logo) => {
    const href = logo.getAttribute('href');
    logo.removeAttribute('href');
    const modifiedClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    logo.dispatchEvent(modifiedClick);
    if (href !== null) logo.setAttribute('href', href);
    return modifiedClick.defaultPrevented;
  });

  expect(prevented).toBe(false);
  await expect(page.locator('#results-card')).toBeVisible();
});

test('respects reduced motion for transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const [buttonDuration, uploadDuration] = await page.evaluate(() => [
    getComputedStyle(document.querySelector('#sample-button')!).transitionDuration,
    getComputedStyle(document.querySelector('#upload-zone')!).transitionDuration,
  ]);
  expect(buttonDuration).toBe('0s');
  expect(uploadDuration).toBe('0s');
});

test('keeps results and downloads hidden before a file is checked', async ({ page }) => {
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#download-ready')).toBeHidden();
  await expect(page.locator('#download-review')).toBeHidden();
  await expect(page.locator('#download-opted-out')).toBeHidden();
  await expect(page.locator('.upload-action')).toBeVisible();
});

test('supports keyboard navigation with a visible focus outline', async ({ page }) => {
  const fileInput = page.locator('#file-input');
  await fileInput.focus();
  await expect(fileInput).toBeFocused();
  await page.keyboard.press('Tab');
  const sampleButton = page.getByRole('button', { name: 'No file handy? Try a sample list' });
  await expect(sampleButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toHaveText(
    '5 ready, 8 to review, 3 opted out.',
  );

  const readyButton = page.getByRole('button', { name: 'Download ready list (5)' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Change' })).toBeFocused();
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const footerLinkPositions = await page.locator('.footer-links a').evaluateAll((links) =>
    links.map((link) => link.getBoundingClientRect().y),
  );
  expect(footerLinkPositions[1]).toBeGreaterThan(footerLinkPositions[0]);

  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#summary')).toHaveText(
    '5 ready, 8 to review, 3 opted out.',
  );

  const buttonHeights = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(buttonHeights.every((height) => height >= 44)).toBe(true);
  const rowCell = await page.locator('#review-table td[data-label="Row"]').first().boundingBox();
  const nameCell = await page.locator('#review-table td[data-label="Name"]').first().boundingBox();
  expect(rowCell).not.toBeNull();
  expect(nameCell).not.toBeNull();
  expect(Math.abs(rowCell!.y - nameCell!.y)).toBeLessThanOrEqual(1);
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

test('has no axe accessibility violations on Step 1', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('has no axe accessibility violations on the results', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#summary')).toHaveText(
    '5 ready, 8 to review, 3 opted out.',
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
    '1 ready, 0 to review, 0 opted out.',
  );

  const sampleResponse = page.waitForResponse((response) => response.url().includes('sample-members.csv'));
  releaseSample();
  await sampleResponse;
  await expect(page.locator('#summary')).toHaveText(
    '1 ready, 0 to review, 0 opted out.',
  );
  await expect(page.locator('#checked-file-name')).toHaveText('newer.csv');
});
