'use strict';
const { test, expect } = require('@playwright/test');

test.describe('Comparación de presupuestos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await page.waitForURL('**/');
  });

  test('Navegar a comparación múltiple muestra página', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/multicomparison');
    await expect(page.locator('#topbar-title')).toHaveText('Comparación de presupuestos', { timeout: 10000 });
  });

  test('Tiene elementos del formulario de comparación', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/multicomparison');
    await expect(page.locator('#topbar-title')).toHaveText('Comparación de presupuestos', { timeout: 10000 });
    await expect(page.locator('#mc-type-filter')).toBeVisible();
    await expect(page.locator('#mc-budget-list')).toBeVisible();
    await expect(page.locator('#btn-mc-compare')).toBeVisible();
  });
});
