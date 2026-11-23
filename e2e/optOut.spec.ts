// Cover opt-out detection, confirmation, and column changes.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
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
