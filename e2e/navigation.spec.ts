// Verify browser history, step changes, scrolling, and focus.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('lets the browser Back button return from results to Step 1', async ({ page }) => {
  await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
  await expect(page.locator('#results-card')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#results-card')).toBeHidden();
  await expect(page.locator('#choose-card')).toBeVisible();
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
  expect(uploadHeightAfter).toBeCloseTo(uploadHeightBefore, 0);
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
