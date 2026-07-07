import { api, formatARS } from '../api.js';
import { showToast } from '../components/toast.js';

let selectedBudgetIds = [];

export function cleanup() {
  selectedBudgetIds = [];
}

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Comparación de presupuestos</h1>
        <p>Seleccioná presupuestos para comparar precios lado a lado</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Seleccionar Presupuestos</div>
        </div>
        <div style="padding:16px">
          <div class="form-group">
            <label>Tipo</label>
            <select class="select" id="mc-type-filter">
              <option value="history">Historial</option>
              <option value="new">Nuevos</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" id="mc-budget-list">
            <div class="spinner spinner-sm"></div>
          </div>
          <div style="margin-top:12px">
            <span id="mc-selected-count" class="text-secondary text-sm">0 seleccionados</span>
          </div>
          <button class="btn btn-primary w-full" id="btn-mc-compare" disabled style="margin-top:12px">
            Comparar ${selectedBudgetIds.length} presupuestos
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Resultado</div>
        </div>
        <div id="mc-result" style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px">
          Seleccioná al menos 2 presupuestos y hacé clic en Comparar
        </div>
      </div>
    </div>`;

  await loadBudgetList();
  setupEvents();
}

async function loadBudgetList() {
  const type = document.getElementById('mc-type-filter')?.value || 'history';
  const list = document.getElementById('mc-budget-list');
  try {
    const { budgets } = await api.getBudgets({ type, limit: 50 });
    list.innerHTML = budgets.map(b => `
      <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;font-size:12px;background:${selectedBudgetIds.includes(b.id) ? 'var(--accent-light)' : 'transparent'}"
             data-id="${b.id}">
        <input type="checkbox" value="${b.id}" ${selectedBudgetIds.includes(b.id) ? 'checked' : ''}
               onchange="window.toggleMCBudget('${b.id}')">
        <span style="font-weight:500">${b.provider_name || '—'}</span>
        <span class="text-tertiary">${b.number ? '· '+b.number : ''}</span>
      </label>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p class="text-error">${err.message}</p>`;
  }
}

window.toggleMCBudget = (id) => {
  const idx = selectedBudgetIds.indexOf(id);
  if (idx === -1) {
    selectedBudgetIds.push(id);
  } else {
    selectedBudgetIds.splice(idx, 1);
  }
  updateSelection();
  loadBudgetList();
};

function updateSelection() {
  document.getElementById('mc-selected-count').textContent = `${selectedBudgetIds.length} seleccionados`;
  const btn = document.getElementById('btn-mc-compare');
  btn.disabled = selectedBudgetIds.length < 2;
  btn.textContent = `Comparar ${selectedBudgetIds.length} presupuestos`;
}

function setupEvents() {
  document.getElementById('mc-type-filter').addEventListener('change', () => {
    loadBudgetList();
  });

  document.getElementById('btn-mc-compare').addEventListener('click', async () => {
    if (selectedBudgetIds.length < 2) return;
    const resultDiv = document.getElementById('mc-result');
    resultDiv.innerHTML = `<div class="spinner"></div>`;
    try {
      const data = await api.compareMultiple(selectedBudgetIds);
      renderResult(resultDiv, data);
    } catch (err) {
      resultDiv.innerHTML = `<p style="color:var(--error-text)">${err.message}</p>`;
      showToast('Error', err.message, 'error');
    }
  });
}

function renderResult(container, data) {
  if (!data.matrix || !data.matrix.length) {
    container.innerHTML = `<p style="color:var(--text-tertiary)">No hay artículos en común entre los presupuestos seleccionados</p>`;
    return;
  }

  const provNames = {};
  data.budgets.forEach(b => { provNames[b.id] = b.provider_name || b.number || b.id.substring(0,8); });

  container.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:12px">${data.matrix.length} artículos encontrados en ${data.budgets.length} presupuestos</div>
    <div style="overflow-x:auto">
      <table class="data-table" style="font-size:12px">
        <thead>
          <tr>
            <th>Artículo</th>
            ${data.budgets.map(b => `<th style="text-align:center;min-width:110px">${provNames[b.id]}</th>`).join('')}
            <th style="text-align:center">Min</th>
            <th style="text-align:center">Max</th>
          </tr>
        </thead>
        <tbody>
          ${data.matrix.map(row => {
            const prices = Object.values(row.columns).filter(Boolean).map(c => c.unitPrice);
            const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
            return `<tr>
              <td style="max-width:200px" class="truncate" title="${row.articleName}">${row.articleName}</td>
              ${data.budgets.map(b => {
                const col = row.columns[b.id];
                if (!col) return `<td style="text-align:center;color:var(--text-tertiary)">—</td>`;
                const cls = col.isMin ? 'cheaper' : col.isMax ? 'overpriced' : 'average';
                return `<td style="text-align:center;font-weight:600" class="price-tag ${cls}">${formatARS(col.unitPrice)}</td>`;
              }).join('')}
              <td style="text-align:center;font-weight:700;color:var(--success-text)">${formatARS(row.minPrice)}</td>
              <td style="text-align:center;font-weight:700;color:var(--error-text)">${formatARS(row.maxPrice)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}
