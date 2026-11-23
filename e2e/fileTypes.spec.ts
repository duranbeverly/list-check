// Cover accepted CSV formats, malformed rows, and file errors.
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import Papa from 'papaparse';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
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

test('rejects a CSV larger than the browser file-size limit', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The large-file guard is checked in Chromium only.');
  const bigPath = test.info().outputPath('over-limit.csv');
  await writeFile(bigPath, Buffer.alloc(50 * 1024 * 1024 + 1));
  await page.locator('#file-input').setInputFiles(bigPath);
  await expect(page.locator('#file-status')).toHaveText(
    'This file is too big for your browser. Split it in two and try again.',
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
  await expect(page.locator('#review-table-body td[data-label="Value"]')).toHaveText(
    '703-200-0027 / 703-200-0028',
  );
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
    'No phone or email column found. Columns in this file: first_name, last_name.',
  );
  await expect(page.locator('#file-status')).toBeFocused();
  await expect(page.locator('#file-status-icon')).toBeVisible();
  await expect(page.locator('#selected-file')).toHaveText(
    'missing-contact.csv · Choose a different file',
  );
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
  await page.getByRole('radio', { name: 'My list has no opt-out information' }).check();
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
    'No phone or email column found. Columns in this file: first_name, last_name.',
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
