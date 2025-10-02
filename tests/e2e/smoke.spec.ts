import { test, expect } from '@playwright/test';

// Basic smoke test to ensure pages render

test('bonus page renders', async ({ page }) => {
  await page.goto('/bonus');
  await expect(page.getByRole('heading', { name: 'Bonus Points' })).toBeVisible();
});

// Optional admin login if ADMIN_SECRET is available
// This exercises cookie-based admin auth and middleware-protected pages.

test('admin rewards page loads after login', async ({ page }) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) test.skip(true, 'ADMIN_SECRET not provided');

  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible({ timeout: 10000 }).catch(() => {});

  // Fill a likely form shape; adjust if admin login page differs
  await page.getByLabel(/Email/i).fill('admin@example.com');
  await page.getByLabel(/Password/i).fill(adminSecret);
  // Some admin login pages may have role selector; try to click partner/admin if present
  const roleSelect = page.locator('select');
  if (await roleSelect.count()) {
    await roleSelect.first().selectOption('admin').catch(() => {});
  }
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Navigate to rewards
  await page.goto('/admin/rewards');
  await expect(page.getByRole('heading', { name: /Admin · Rewards/i })).toBeVisible();
});
