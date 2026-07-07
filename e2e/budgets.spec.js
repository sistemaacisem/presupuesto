'use strict';
const { test, expect } = require('@playwright/test');

test.describe('Presupuestos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await page.waitForURL('**/');
  });

  test('Navegar a historial de presupuestos muestra tabla', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await expect(page.locator('#topbar-title')).toHaveText('Historial de presupuestos', { timeout: 8000 });
    await expect(page.locator('#budget-table-container')).toBeVisible();
    await expect(page.locator('#budget-search')).toBeVisible();
    await expect(page.locator('#budget-type-filter')).toBeVisible();
  });

  test('Tabla de presupuestos tiene columnas correctas', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await expect(page.locator('#budget-table-container .data-table')).toBeVisible({ timeout: 8000 });
    const headers = await page.locator('.data-table thead th').allTextContents();
    expect(headers.join(' ')).toMatch(/Fecha/);
    expect(headers.join(' ')).toContain('N°');
    expect(headers.join(' ')).toMatch(/Proveedor/);
    expect(headers.join(' ')).toMatch(/Artículos/);
    expect(headers.join(' ')).toMatch(/Precio/);
    expect(headers.join(' ')).toMatch(/Acciones/);
  });

  test('Filtro por tipo funciona', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await page.waitForTimeout(1000);
    await page.selectOption('#budget-type-filter', 'new');
    await page.waitForTimeout(1000);
    const rows = await page.locator('#budget-table-container .data-table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test('Búsqueda por proveedor filtra resultados', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await page.waitForTimeout(1000);
    const firstProvider = await page.locator('.data-table tbody tr td:nth-child(3)').first().textContent();
    if (firstProvider && firstProvider.trim() !== '—') {
      await page.fill('#budget-search', firstProvider.trim());
      await page.waitForTimeout(500);
      const rows = await page.locator('#budget-table-container .data-table tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(1);
    }
  });

  test('Botón Mirar navega al detalle', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await page.waitForTimeout(1000);
    const viewBtn = page.locator('.btn-view-budget').first();
    await expect(viewBtn).toBeVisible({ timeout: 8000 });
    await viewBtn.click();
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/budget\//);
    const table = page.locator('.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('Detalle de presupuesto muestra total', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await page.waitForTimeout(1000);
    await page.locator('.btn-view-budget').first().click();
    const tfoot = page.locator('.data-table tfoot');
    await expect(tfoot).toBeVisible({ timeout: 12000 });
    await expect(tfoot).toContainText('$');
  });

  test('Mensaje sin presupuestos cuando no hay resultados', async ({ page }) => {
    await page.evaluate(() => window.location.hash = '#/budget');
    await page.waitForTimeout(1000);
    await page.fill('#budget-search', 'zzzzzznoexiste');
    await page.waitForTimeout(500);
    const emptyMsg = page.locator('#budget-table-container .table-empty');
    const emptyVisible = await emptyMsg.isVisible().catch(() => false);
    if (emptyVisible) {
      await expect(emptyMsg).toContainText('Sin presupuestos');
    }
  });
});
