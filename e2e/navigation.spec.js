'use strict';
const { test, expect } = require('@playwright/test');

test.describe('Navegación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await page.waitForURL(/\/$/);
    await expect(page.locator('#sidebar')).toBeVisible();
  });

  test('Navegar a history', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/history');
    await expect(page.locator('#topbar-title')).toHaveText('Cargar presupuesto', { timeout: 8000 });
  });

  test('Navegar a providers', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/providers');
    await expect(page.locator('#topbar-title')).toHaveText('Proveedores', { timeout: 8000 });
  });

  test('Navegar a reports', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/reports');
    await expect(page.locator('#topbar-title')).toHaveText('Reportes', { timeout: 8000 });
  });

  test('Sidebar toggle', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
    await page.click('#sidebar-toggle');
    await expect(sidebar).toHaveClass(/collapsed/);
    await page.click('#sidebar-toggle');
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('Logout redirige a login', async ({ page }) => {
    await page.click('#logout-btn');
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 8000 });
  });
});
