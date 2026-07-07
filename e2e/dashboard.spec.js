'use strict';
const { test, expect } = require('@playwright/test');

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await page.waitForURL('**/');
  });

  test('KPIs con valores reales positivos', async ({ page }) => {
    await expect(page.locator('#kpi-grid')).toBeVisible({ timeout: 10000 });
    const cards = page.locator('#kpi-grid .kpi-card');
    await expect(cards).toHaveCount(6);

    const texts = await cards.locator('.kpi-value').allTextContents();
    expect(texts.length).toBe(6);
    for (const t of texts) {
      const num = parseFloat(t.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
      expect(num).toBeGreaterThanOrEqual(0);
    }
  });

  test('Muestra seccion de graficos', async ({ page }) => {
    await expect(page.locator('#chart-category')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#chart-monthly')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#chart-providers')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#chart-articles')).toBeVisible({ timeout: 5000 });
    const catHeight = await page.locator('#chart-category').getAttribute('height');
    expect(parseInt(catHeight || '0')).toBeGreaterThan(0);
  });

  test('Muestra tabla de presupuestos recientes con filas', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10000 });
    const rows = await page.locator('.data-table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });
});
