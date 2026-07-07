/**
 * Budget Module — Historial de presupuestos + Detalle
 */
import { api, formatARS, formatDate, formatPct } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

let currentComparisonResult = null;

export function cleanup() {
  currentComparisonResult = null;
}

export async function render(container, param) {
  if (param) {
    await renderBudgetDetail(container, param);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Historial de presupuestos</h1>
        <p>Presupuestos cargados, detalle y seguimiento</p>
      </div>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <div class="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="input" id="budget-search" placeholder="Buscar por proveedor o N°...">
          </div>
          <select class="select" id="budget-type-filter" style="width:auto;min-width:130px">
            <option value="">Todos</option>
            <option value="new">Nuevos</option>
            <option value="history">Historial</option>
          </select>
        </div>
      </div>
      <div id="budget-table-container">
        <div style="text-align:center;padding:48px"><div class="spinner spinner-lg"></div></div>
      </div>
    </div>`;

  await loadBudgetTable();
  setupBudgetFilters();
}

async function loadBudgetTable() {
  const container = document.getElementById('budget-table-container');
  try {
    const search = document.getElementById('budget-search')?.value?.trim() || '';
    const type = document.getElementById('budget-type-filter')?.value || '';
    const params = { limit: 100 };
    if (type) params.type = type;

    const { budgets } = await api.getBudgets(params);

    let filtered = budgets;
    if (search) {
      const q = search.toLowerCase();
      filtered = budgets.filter(b =>
        (b.provider_name || '').toLowerCase().includes(q) ||
        (b.number || '').toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      container.innerHTML = `<div class="table-empty">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <h3>Sin presupuestos</h3>
        <p>No hay presupuestos cargados todavía. Subí uno desde "Cargar presupuesto".</p>
        <a href="#/history" class="btn btn-primary" data-nav>Cargar presupuesto</a>
      </div>`;
      container.querySelectorAll('a[data-nav]').forEach(el => {
        el.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = el.getAttribute('href'); });
      });
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>N° Presupuesto</th>
              <th>Proveedor</th>
              <th style="text-align:center">Artículos</th>
              <th style="text-align:right">Precio</th>
              <th style="text-align:center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(b => `
              <tr>
                <td style="white-space:nowrap">${formatDate(b.date)}</td>
                <td><code>${b.number || '—'}</code></td>
                <td>${b.provider_name || '—'}</td>
                <td style="text-align:center">${b.item_count}</td>
                <td style="text-align:right;font-weight:600;white-space:nowrap">${formatARS(b.total_amount)}</td>
                <td style="text-align:center">
                  <div class="flex gap-1" style="justify-content:center">
                    <button class="btn btn-ghost btn-sm btn-view-budget" data-id="${b.id}" title="Mirar">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm btn-delete-budget" data-id="${b.id}" title="Borrar" style="color:var(--error-text)">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${filtered.length} presupuesto${filtered.length !== 1 ? 's' : ''}</span>
      </div>`;

    container.querySelectorAll('.btn-view-budget').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.hash = `#/budget/${btn.dataset.id}`;
      });
    });

    container.querySelectorAll('.btn-delete-budget').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) return;
        try {
          await api.deleteBudget(btn.dataset.id);
          showToast('Eliminado', 'Presupuesto eliminado correctamente', 'success');
          await loadBudgetTable();
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="table-empty"><p class="text-error">${err.message}</p></div>`;
  }
}

function setupBudgetFilters() {
  const searchInput = document.getElementById('budget-search');
  const typeFilter = document.getElementById('budget-type-filter');
  if (searchInput) searchInput.addEventListener('input', debounce(loadBudgetTable, 300));
  if (typeFilter) typeFilter.addEventListener('change', loadBudgetTable);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── COMPARACIÓN E HISTORIAL DE ACCIONES ───────────────────────────────────────
window.runComparison = async (budgetId) => {
  const resultDiv = document.getElementById('comparison-result');
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="card"><div style="text-align:center;padding:32px"><div class="spinner spinner-lg"></div><p style="margin-top:12px;color:var(--text-secondary)">Analizando precios contra el historial...</p></div></div>`;
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  try {
    const result = await api.compare(budgetId);
    currentComparisonResult = result;
    if (resultDiv) renderComparisonResult(resultDiv, result);
    showToast('Comparación lista', `Ahorro potencial: ${formatARS(result.totalSavings)}`, 'success');
  } catch (err) {
    if (resultDiv) resultDiv.innerHTML = `<div class="card"><p style="color:var(--error-text);padding:16px">${err.message}</p></div>`;
    showToast('Error', err.message, 'error');
  }
};

function renderComparisonResult(container, result) {
  const overpriced = result.results.filter(r => r.status === 'overpriced');
  const average    = result.results.filter(r => r.status === 'average');
  const cheaper    = result.results.filter(r => r.status === 'cheaper');
  const unknown    = result.results.filter(r => r.status === 'no_history' || r.status === 'unknown');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📊 Resultado del Análisis</div>
          <div class="card-subtitle">Comparación contra historial de precios</div>
        </div>
        <div class="flex gap-2" style="align-items:center">
          <button class="btn btn-secondary btn-sm" id="btn-export-excel-comp">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:2px"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Exportar Excel
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:2px"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Imprimir PDF
          </button>
          <a class="btn btn-ghost btn-sm" href="#/multicomparison">Comparar presupuestos</a>
        </div>
      </div>

      <!-- Resumen general -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
        <div style="background:var(--bg-body);border-radius:var(--radius-md);padding:16px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:1.5rem;font-weight:700">${formatARS(result.totalBudget)}</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Total presupuesto</div>
        </div>
        <div style="background:var(--success-bg);border-radius:var(--radius-md);padding:16px;text-align:center;border:1px solid rgba(34,197,94,.2)">
          <div style="font-size:1.5rem;font-weight:700;color:var(--success-text)">${result.savingsPct.toFixed(1)}%</div>
          <div style="font-size:11px;color:var(--success-text);opacity:.7;margin-top:4px">% de ahorro</div>
        </div>
        <div style="background:var(--bg-body);border-radius:var(--radius-md);padding:16px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:1.5rem;font-weight:700">${result.results.length}</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Artículos analizados</div>
        </div>
      </div>

      <!-- Semáforo -->
      <div class="comparison-summary">
        <div class="comparison-stat overpriced">
          <div class="cs-number">${result.itemsOverpriced}</div>
          <div class="cs-label">🔴 Sobrepreciados</div>
        </div>
        <div class="comparison-stat average">
          <div class="cs-number">${result.itemsAverage}</div>
          <div class="cs-label">🟡 En promedio</div>
        </div>
        <div class="comparison-stat cheaper">
          <div class="cs-number">${result.itemsCheaper}</div>
          <div class="cs-label">🟢 Más baratos</div>
        </div>
      </div>

      <!-- Tabla detalle -->
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Artículo</th>
              <th>Cantidad</th>
              <th>Precio actual</th>
              <th>Precio mín. histórico</th>
              <th>Precio promedio</th>
              <th>Variación</th>
              <th>Ahorro posible</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${result.results.map(item => {
              const c = item.comparison;
              if (!c) return `
                <tr>
                  <td style="font-weight:500">${item.raw_description || item.article_name || '—'}</td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>${formatARS(item.unit_price)}</td>
                  <td colspan="4" style="color:var(--text-tertiary);font-size:12px">Sin historial</td>
                  <td><span class="price-tag unknown">Sin datos</span></td>
                </tr>`;

              const tagClass = item.status === 'overpriced' ? 'overpriced' : item.status === 'cheaper' ? 'cheaper' : 'average';
              const tagLabel = item.status === 'overpriced' ? '▲ Caro' : item.status === 'cheaper' ? '▼ Barato' : '≈ Promedio';

              return `
                <tr>
                  <td style="font-weight:500;max-width:200px" class="truncate">${item.article_name || item.raw_description}</td>
                  <td style="white-space:nowrap">${item.quantity} ${item.unit}</td>
                  <td style="font-weight:600">${formatARS(c.currentPrice)}</td>
                  <td style="color:var(--success-text);font-weight:600">${formatARS(c.minPrice)}</td>
                  <td>${formatARS(Math.round(c.avgPrice))}</td>
                  <td style="font-weight:600;color:${c.diffPct > 0 ? 'var(--error-text)' : 'var(--success-text)'}">${formatPct(c.diffPct)}</td>
                  <td style="font-weight:600;color:var(--success-text)">${c.potentialSaving > 0 ? formatARS(c.potentialSaving) : '—'}</td>
                  <td><span class="price-tag ${tagClass}">${tagLabel}</span></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${result.itemsOverpriced > 0 ? `
      <div style="margin-top:20px;padding:16px;background:var(--error-bg);border-radius:var(--radius-md);border:1px solid rgba(239,68,68,.2)">
        <div style="font-weight:600;color:var(--error-text);margin-bottom:8px">⚠️ Artículos con sobreprecio detectados</div>
        ${overpriced.map(r => r.comparison ? `
          <div style="font-size:12.5px;color:var(--error-text);margin-bottom:4px">
            • <strong>${r.article_name || r.raw_description}</strong>: 
            ${formatARS(r.unit_price)} vs promedio histórico ${formatARS(Math.round(r.comparison.avgPrice))} 
            (+${r.comparison.diffPct.toFixed(1)}%). 
            Más barato en: <strong>${r.comparison.cheapestProvider}</strong> (${formatARS(r.comparison.cheapestPrice)})
          </div>`:'').join('')}
      </div>` : ''}
    </div>`;

  // Asignar evento al botón de exportar Excel
  document.getElementById('btn-export-excel-comp')?.addEventListener('click', exportExcelComparison);
}

function exportExcelComparison() {
  if (!currentComparisonResult) {
    showToast('Error', 'No hay datos de comparación para exportar', 'error');
    return;
  }

  const res = currentComparisonResult;
  const dataRows = [
    ["A.C.I.S.E.M. — SECRETARÍA DE EDUCACIÓN"],
    ["INFORME COMPARTATIVO DE PRESUPUESTO"],
    [`Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}`],
    [`Presupuesto Total: ${formatARS(res.totalBudget)} | Ahorro Potencial: ${formatARS(res.totalSavings)} (${res.savingsPct.toFixed(1)}%)`],
    [],
    ["Artículo / Descripción", "Cantidad", "Unidad", "Precio Actual", "Mínimo Histórico", "Promedio Histórico", "Diferencia %", "Ahorro Posible", "Proveedor Más Económico", "Estado"]
  ];

  res.results.forEach(item => {
    const c = item.comparison;
    dataRows.push([
      item.article_name || item.raw_description,
      item.quantity,
      item.unit,
      item.unit_price,
      c ? c.minPrice : '—',
      c ? Math.round(c.avgPrice) : '—',
      c ? `${c.diffPct > 0 ? '+' : ''}${c.diffPct.toFixed(1)}%` : '—',
      c ? c.potentialSaving : 0,
      c ? c.cheapestProvider : '—',
      item.status === 'overpriced' ? 'Sobrepreciado' : item.status === 'cheaper' ? 'Económico' : item.status === 'average' ? 'En Promedio' : 'Sin Historial'
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  
  // Darle un ancho básico a las columnas
  ws['!cols'] = [
    { wch: 35 }, // Artículo
    { wch: 10 }, // Cantidad
    { wch: 10 }, // Unidad
    { wch: 15 }, // Precio Actual
    { wch: 15 }, // Mínimo
    { wch: 15 }, // Promedio
    { wch: 12 }, // Variación
    { wch: 15 }, // Ahorro
    { wch: 25 }, // Proveedor
    { wch: 15 }  // Estado
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Cuadro Comparativo");
  XLSX.writeFile(wb, `cuadro_comparativo_ACISEM_${Date.now()}.xlsx`);
  showToast('Exportación exitosa', 'El cuadro comparativo se ha descargado.', 'success');
}

async function renderBudgetDetail(container, budgetId) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-ghost btn-sm" onclick="history.back()">← Volver</button>
        <h1>Detalle de Presupuesto</h1>
      </div>
    </div>
    <div style="text-align:center;padding:48px"><div class="spinner spinner-lg"></div></div>`;

  try {
    const { budget, details } = await api.getBudget(budgetId);
    container.querySelector('h1').textContent = `Presupuesto ${budget.number || budget.id.slice(0,8)}`;
    container.querySelector('div:last-child').innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${budget.provider_name || 'Sin proveedor'}</div>
            <div class="card-subtitle">${formatDate(budget.date)} · ${budget.number || '—'}</div>
          </div>
          <div class="flex gap-2">
            <span class="badge ${budget.type === 'new' ? 'badge-accent' : 'badge-default'}">${budget.type === 'new' ? 'Nuevo' : 'Historial'}</span>
            <span class="status-dot ${budget.status}"></span>
            <a class="btn btn-ghost btn-sm" href="/api/budgets/${budget.id}/pdf?token=${localStorage.getItem('token')}" target="_blank" title="Descargar PDF">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v6h6"/></svg>
              PDF
            </a>
            ${budget.type === 'new' ? `<button class="btn btn-primary btn-sm" onclick="runComparison('${budget.id}')">Comparar</button>` : ''}
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Precio Unit.</th><th>Total</th></tr></thead>
            <tbody>
              ${details.map(d => `
                <tr>
                  <td style="max-width:280px">${d.article_name || d.raw_description || '—'}</td>
                  <td>${d.quantity}</td>
                  <td>${d.unit}</td>
                  <td style="font-weight:600">${formatARS(d.unit_price)}</td>
                  <td style="font-weight:700">${formatARS(d.total_price)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="font-weight:700;text-align:right;padding:12px 14px">Total:</td>
                <td style="font-weight:700;font-size:15px">${formatARS(budget.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}
