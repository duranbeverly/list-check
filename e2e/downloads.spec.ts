// Verify each CSV download, its safety, and round-trip behavior.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import Papa from 'papaparse';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
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
