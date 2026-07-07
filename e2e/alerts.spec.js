'use strict';
const { test, expect } = require('@playwright/test');

test.describe('Alertas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await page.waitForURL('**/');
  });

  test('Boton de alertas visible en topbar', async ({ page }) => {
    await expect(page.locator('#alerts-btn')).toBeVisible();
  });

  test('Badge de alertas visible si hay alertas', async ({ page }) => {
    await page.waitForTimeout(2000);
    const badge = page.locator('#alerts-count');
    const count = await badge.textContent();
    if (count && parseInt(count) > 0) {
      await expect(badge).toBeVisible();
    }
  });

  test('Abrir modal de alertas', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.click('#alerts-btn');
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#modal-close-btn')).toBeVisible();
  });

  test('Cerrar modal de alertas', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.click('#alerts-btn');
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await page.click('#modal-close-btn');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });
});
