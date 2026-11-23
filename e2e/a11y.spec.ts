// Check accessible content, keyboard use, responsive layouts, and axe results.
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('the published page has a strict Content Security Policy', async ({ page }) => {
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("form-action 'none'");
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
  await expect(page.locator('.how-it-works summary')).toHaveText('How it works');
  await expect(page.locator('.site-footer a')).toHaveCount(1);
  const footerLinkHeights = await page.locator('.site-footer a').evaluateAll((links) =>
    links.map((link) => link.getBoundingClientRect().height),
  );
  expect(footerLinkHeights.every((height) => height >= 40)).toBe(true);
});

test('shows the sample report and review table', async ({ page }) => {
  await expect(page.locator('#results-card')).toBeHidden();
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();

  await expect(page.getByRole('heading', { name: 'Your results' })).toBeVisible();
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
  await expect(page.locator('.example-preview')).toBeHidden();

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

test('keeps the file picker above the fold on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await page.locator('#upload-zone').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test('mutes zero-count tiles and keeps Check another in one place', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'ready.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,opt_out\nAna,ana@example.com,No'),
  });
  await expect(page.locator('#ready-tile')).not.toHaveClass(/stat-tile--empty/);
  await expect(page.locator('#review-tile')).toHaveClass(/stat-tile--empty/);
  await expect(page.locator('#opted-out-tile')).toHaveClass(/stat-tile--empty/);
  expect(await page.locator('#check-another').evaluate((link) => link.parentElement?.id))
    .toBe('results-card');
  expect(await page.locator('#check-another').evaluate((link) =>
    Boolean(link.closest('.download-actions')),
  )).toBe(false);
  expect(await page.locator('.stat-number').first().evaluate((element) =>
    getComputedStyle(element).fontFamily,
  )).toContain('system-ui');
});

test('shows local how-it-works help and a visible review value', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({
    name: 'short-phone.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,email,phone,opt_out\nAna,ana@example.com,703-555-01,No'),
  });
  await expect(page.locator('#review-table-body td[data-label="Value"]')).toHaveText('703-555-01');
  await page.locator('.how-it-works summary').click();
  await expect(page.locator('.how-it-works p')).toHaveCount(3);
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
