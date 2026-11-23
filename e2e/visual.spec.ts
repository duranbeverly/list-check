import { expect, test } from '@playwright/test';

const viewports = [
  {
    name: 'light',
    colorScheme: 'light' as const,
    size: { width: 1280, height: 900 },
  },
  {
    name: 'dark',
    colorScheme: 'dark' as const,
    size: { width: 1280, height: 900 },
  },
  {
    name: 'phone',
    colorScheme: 'light' as const,
    size: { width: 390, height: 844 },
  },
];

for (const viewport of viewports) {
  for (const step of ['one', 'two'] as const) {
    test(`visual: Step ${step} in ${viewport.name}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Visual snapshots are maintained in Chromium.');
      await page.setViewportSize(viewport.size);
      await page.emulateMedia({
        colorScheme: viewport.colorScheme,
        reducedMotion: 'reduce',
      });
      await page.goto('./');
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      if (step === 'two') {
        await page.getByRole('button', { name: 'No file handy? Try a sample list' }).click();
        await expect(page.locator('#ready-count')).toHaveText('5');
      }

      await expect(page).toHaveScreenshot(`step-${step}-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}
