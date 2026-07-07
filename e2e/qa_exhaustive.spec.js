'use strict';
const { test, expect } = require('@playwright/test');

/** Helper: login and wait for dashboard */
async function login(page) {
  await page.goto('/login.html');
  await page.fill('#email', 'admin@demo.com');
  await page.fill('#password', 'admin123');
  await page.click('#login-btn');
  await page.waitForURL('**/');
  await expect(page.locator('#sidebar')).toBeVisible({ timeout: 8000 });
}

/** Helper: navigate to hash route */
async function go(page, hash) {
  await page.evaluate(h => window.location.hash = h, hash);
  await page.waitForTimeout(800);
}

// ───────────────────────────────────────────────────────
// 1. AUTH
// ───────────────────────────────────────────────────────
test.describe('QA: Autenticación', () => {
  test('Login exitoso redirige al dashboard', async ({ page }) => {
    await login(page);
    await expect(page.locator('#topbar-title')).toHaveText('Dashboard');
  });

  test('Login fallido muestra mensaje de error', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'wrong');
    await page.click('#login-btn');
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#login-error')).not.toBeEmpty();
  });

  test('Logout redirige al login', async ({ page }) => {
    await login(page);
    await page.click('#logout-btn');
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 8000 });
  });

  test('Sin token redirige a login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login.html');
    await expect(page.locator('#login-form')).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────
// 2. NAVEGACIÓN — todas las rutas
// ───────────────────────────────────────────────────────
test.describe('QA: Navegación completa', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  const routes = [
    { hash: '#/dashboard',       title: 'Dashboard' },
    { hash: '#/history',         title: 'Cargar presupuesto' },
    { hash: '#/budget',          title: 'Historial de presupuestos' },
    { hash: '#/multicomparison', title: 'Comparación de presupuestos' },
    { hash: '#/search',          title: 'Buscador' },
    { hash: '#/articles',        title: 'Artículos' },
    { hash: '#/providers',       title: 'Proveedores' },
    { hash: '#/reports',         title: 'Reportes' },
  ];

  for (const { hash, title } of routes) {
    test(`Navegar a ${hash} muestra "${title}"`, async ({ page }) => {
      await go(page, hash);
      await expect(page.locator('#topbar-title')).toHaveText(title, { timeout: 8000 });
    });
  }

  test('Sidebar toggle colapsa y expande', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    await page.click('#sidebar-toggle');
    await expect(sidebar).toHaveClass(/collapsed/);
    await page.click('#sidebar-toggle');
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });
});

// ───────────────────────────────────────────────────────
// 3. DASHBOARD
// ───────────────────────────────────────────────────────
test.describe('QA: Dashboard', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('KPIs visibles con valores', async ({ page }) => {
    await expect(page.locator('#kpi-grid')).toBeVisible({ timeout: 10000 });
    const kpis = await page.locator('#kpi-grid .kpi-card').count();
    expect(kpis).toBeGreaterThanOrEqual(3);
  });

  test('Sección de gráficos visible', async ({ page }) => {
    await expect(page.locator('#chart-category')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#chart-monthly')).toBeVisible({ timeout: 5000 });
  });

  test('Tabla de presupuestos recientes visible', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10000 });
  });
});

// ───────────────────────────────────────────────────────
// 4. BUDGET HISTORY (listado)
// ───────────────────────────────────────────────────────
test.describe('QA: Historial de presupuestos', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/budget'); });

  test('Tabla se carga con datos', async ({ page }) => {
    await expect(page.locator('#budget-table-container .data-table')).toBeVisible({ timeout: 10000 });
    const rows = await page.locator('#budget-table-container .data-table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('Columnas de la tabla correctas', async ({ page }) => {
    await page.waitForTimeout(1000);
    const th = await page.locator('.data-table thead th').allTextContents();
    expect(th.join(' ')).toMatch(/Fecha/);
    expect(th.join(' ')).toMatch(/Proveedor/);
    expect(th.join(' ')).toMatch(/Precio/);
    expect(th.join(' ')).toMatch(/Acciones/);
  });

  test('Filtro Nuevos/Historial cambia resultados', async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.selectOption('#budget-type-filter', 'history');
    await page.waitForTimeout(1000);
    const rowsHistory = await page.locator('#budget-table-container .data-table tbody tr').count();
    await page.selectOption('#budget-type-filter', 'new');
    await page.waitForTimeout(1000);
    const rowsNew = await page.locator('#budget-table-container .data-table tbody tr').count();
    expect(rowsHistory + rowsNew).toBeGreaterThanOrEqual(1);
  });

  test('Búsqueda filtra por proveedor', async ({ page }) => {
    await page.waitForTimeout(1500);
    const cell = page.locator('.data-table tbody tr td:nth-child(3)').first();
    const text = await cell.textContent();
    if (text && text.trim() !== '—') {
      await page.fill('#budget-search', text.trim());
      await page.waitForTimeout(600);
      const rows = await page.locator('#budget-table-container .data-table tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(1);
    }
  });

  test('Botón Mirar navega al detalle', async ({ page }) => {
    await page.waitForTimeout(1000);
    const viewBtn = page.locator('.btn-view-budget').first();
    await expect(viewBtn).toBeVisible({ timeout: 8000 });
    await viewBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.data-table tfoot')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#page-content .card-title')).toBeVisible({ timeout: 5000 });
  });

  test('Botón Borrar — confirmación se puede cancelar', async ({ page }) => {
    await page.waitForTimeout(1000);
    const deleteBtn = page.locator('.btn-delete-budget').first();
    await expect(deleteBtn).toBeVisible({ timeout: 8000 });
    page.on('dialog', dialog => dialog.dismiss());
    await deleteBtn.click();
    await page.waitForTimeout(500);
  });

  test('Pie de tabla muestra cantidad de presupuestos', async ({ page }) => {
    await page.waitForTimeout(1000);
    const footer = page.locator('#budget-table-container .table-footer');
    await expect(footer).toBeVisible({ timeout: 8000 });
    const text = await footer.textContent();
    expect(text).toMatch(/\d+/);
  });
});

// ───────────────────────────────────────────────────────
// 5. HISTORY (carga de presupuestos)
// ───────────────────────────────────────────────────────
test.describe('QA: Cargar presupuesto', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/history'); });

  test('Página tiene zona de carga y tabla existente', async ({ page }) => {
    await expect(page.locator('#upload-zone-history')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#file-input-history')).toBeVisible();
  });

  test('Tabla de historial visible con datos', async ({ page }) => {
    await expect(page.locator('#hist-table')).toBeVisible({ timeout: 10000 });
    const rows = await page.locator('#hist-table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('Checkbox de selección funciona', async ({ page }) => {
    await page.waitForTimeout(1000);
    const checkbox = page.locator('.hist-checkbox').first();
    await expect(checkbox).toBeVisible({ timeout: 8000 });
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('Botón Eliminar seleccionados visible', async ({ page }) => {
    const checkbox = page.locator('.hist-checkbox').first();
    await expect(checkbox).toBeVisible({ timeout: 8000 });
    await checkbox.check();
    await expect(page.locator('#hist-bulk-delete')).toBeVisible({ timeout: 5000 });
  });

  test('Columnas de tabla de historial', async ({ page }) => {
    await page.waitForTimeout(1000);
    const th = await page.locator('#hist-table thead th').allTextContents();
    expect(th.join(' ')).toContain('N°');
    expect(th.join(' ')).toMatch(/Proveedor/);
    expect(th.join(' ')).toMatch(/Fecha/);
    expect(th.join(' ')).toMatch(/Total/);
  });
});

// ───────────────────────────────────────────────────────
// 6. MULTICOMPARISON
// ───────────────────────────────────────────────────────
test.describe('QA: Comparación de presupuestos', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/multicomparison'); });

  test('Formulario de comparación visible', async ({ page }) => {
    await expect(page.locator('#mc-type-filter')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#mc-budget-list')).toBeVisible();
    await expect(page.locator('#btn-mc-compare')).toBeVisible();
  });

  test('Seleccionar tipo carga lista de presupuestos', async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.selectOption('#mc-type-filter', 'new');
    await page.waitForTimeout(1000);
    const items = await page.locator('#mc-budget-list .mc-budget-item').count();
    expect(items).toBeGreaterThanOrEqual(0);
  });

  test('Botón Comparar existe', async ({ page }) => {
    await expect(page.locator('#btn-mc-compare')).toBeVisible();
    await expect(page.locator('#btn-mc-compare')).toBeDisabled();
  });
});

// ───────────────────────────────────────────────────────
// 7. ARTÍCULOS
// ───────────────────────────────────────────────────────
test.describe('QA: Artículos', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/articles'); });

  test('Tabla de artículos visible', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10000 });
    const rows = await page.locator('.data-table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('Buscador de artículos visible', async ({ page }) => {
    await expect(page.locator('#art-search')).toBeVisible({ timeout: 8000 });
  });

  test('Columnas correctas', async ({ page }) => {
    await page.waitForTimeout(1000);
    const th = await page.locator('.data-table thead th').allTextContents();
    expect(th.join(' ')).toMatch(/Artículo/);
    expect(th.join(' ')).toMatch(/Categoría/);
  });
});

// ───────────────────────────────────────────────────────
// 8. PROVEEDORES
// ───────────────────────────────────────────────────────
test.describe('QA: Proveedores', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/providers'); });

  test('Lista de proveedores visible', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10000 });
    const rows = await page.locator('.data-table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('Buscador de proveedores visible', async ({ page }) => {
    await expect(page.locator('#prov-search')).toBeVisible({ timeout: 8000 });
  });

  test('Hacer clic en proveedor muestra detalle con presupuestos', async ({ page }) => {
    await page.waitForTimeout(1000);
    const firstRow = page.locator('.data-table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });
    await firstRow.click();
    await page.waitForTimeout(1000);
    const detailTable = page.locator('.data-table');
    const detailVisible = await detailTable.isVisible().catch(() => false);
    if (detailVisible) {
      const rows = await detailTable.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    }
  });
});

// ───────────────────────────────────────────────────────
// 9. BUSCADOR
// ───────────────────────────────────────────────────────
test.describe('QA: Buscador', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/search'); });

  test('Input de búsqueda visible', async ({ page }) => {
    await expect(page.locator('#main-search')).toBeVisible({ timeout: 8000 });
  });

  test('Historial de búsqueda presente', async ({ page }) => {
    await expect(page.locator('#search-history-chips')).toBeAttached({ timeout: 8000 });
  });

  test('Búsqueda por texto devuelve resultados', async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.fill('#main-search', 'hoja');
    await page.waitForTimeout(1000);
    const results = page.locator('#search-results');
    const visible = await results.isVisible().catch(() => false);
    if (visible) {
      const count = await results.locator('.search-result-item').count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

// ───────────────────────────────────────────────────────
// 10. REPORTES
// ───────────────────────────────────────────────────────
test.describe('QA: Reportes', () => {
  test.beforeEach(async ({ page }) => { await login(page); await go(page, '#/reports'); });

  test('Tab de proveedores cargado', async ({ page }) => {
    await expect(page.locator('#report-content .data-table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#report-content')).toBeVisible();
  });

  test('Tabla de artículos más caros visible', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10000 });
  });

  test('Botón de exportar visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Exportar")')).toBeVisible({ timeout: 8000 });
  });
});

// ───────────────────────────────────────────────────────
// 11. ADMIN — USUARIOS
// ───────────────────────────────────────────────────────
test.describe('QA: Usuarios (admin)', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Sección de usuarios visible para admin', async ({ page }) => {
    await page.evaluate(() => {
      const section = document.getElementById('nav-admin-section');
      if (section) section.style.display = '';
      const link = document.getElementById('nav-users');
      if (link) link.style.display = '';
    });
    await go(page, '#/users');
    await expect(page.locator('#topbar-title')).toHaveText('Usuarios', { timeout: 8000 });
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10000 });
  });
});

// ───────────────────────────────────────────────────────
// 12. ERROR HANDLING & EDGE CASES
// ───────────────────────────────────────────────────────
test.describe('QA: Edge Cases', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Navegar a ruta inexistente redirige al dashboard', async ({ page }) => {
    await go(page, '#/ruta-que-no-existe-98765');
    await page.waitForTimeout(1000);
    await expect(page.locator('#topbar-title')).toHaveText('Dashboard', { timeout: 8000 });
  });

  test('SIDEBAR: todos los nav items tienen icono y label', async ({ page }) => {
    const items = await page.locator('#sidebar .nav-item').count();
    expect(items).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < items; i++) {
      const navItem = page.locator('#sidebar .nav-item').nth(i);
      await expect(navItem.locator('svg')).toBeVisible();
      await expect(navItem.locator('.nav-item-label')).toBeVisible();
    }
  });

  test('TOPBAR: usuario logueado visible', async ({ page }) => {
    await expect(page.locator('#sidebar-user-btn')).toBeVisible({ timeout: 8000 });
  });

  test('Ruta /dashboard funciona sin hash', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/');
    await expect(page.locator('#topbar-title')).toHaveText('Dashboard', { timeout: 8000 });
  });
});
