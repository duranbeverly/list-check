// Exercise large-file responsiveness, cancellation, and request races.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
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

test('keeps the page responsive and cancels a 300,000-row check', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'The cancel affordance is checked in Chromium only.');
  await page.clock.install();
  await page.goto('./');
  const rows = Array.from(
    { length: 300_000 },
    (_, index) => `Member ${index},member${index}@example.com,No`,
  );
  const csv = `first_name,email,opt_out\n${rows.join('\n')}`;

  await page.locator('#file-input').setInputFiles({
    name: 'cancel-300000.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Cancel check' })).toBeVisible();
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.locator('#file-status')).toHaveText('Still checking your list…');
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await expect(page.locator('#file-status')).toHaveText(
    'Check canceled. Choose a file to try again.',
  );
  await expect(page.locator('#results-card')).toBeHidden();
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

test('rejects a list over the 500,000-row limit', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The row-limit case is checked in Chromium only.');
  const rows = Array.from(
    { length: 500_001 },
    (_, index) => `Member ${index},member${index}@example.com,No`,
  );
  await page.locator('#file-input').setInputFiles({
    name: 'over-row-limit.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`first_name,email,opt_out\n${rows.join('\n')}`),
  });
  await expect(page.locator('#file-status')).toHaveText(
    'This file has more than 500,000 rows. Split it in two and try again.',
    { timeout: 20_000 },
  );
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
