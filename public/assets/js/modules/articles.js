/**
 * Articles Module — Catálogo de artículos y ficha de artículo
 */
import { api, formatARS, formatDate, formatPct } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

let articleChart = null;

export function cleanup() {
  if (articleChart) { try { articleChart.destroy(); } catch {} articleChart = null; }
}

export async function render(container, param) {
  if (param) { await renderArticleDetail(container, param); return; }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Artículos</h1>
        <p>Catálogo completo con historial de precios por proveedor</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="filter-favorites-btn">★ Solo favoritos</button>
        <button class="btn btn-primary" onclick="openNewArticleModal()">+ Nuevo artículo</button>
      </div>
    </div>

    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <div class="search-box" style="width:240px">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="input" type="search" id="art-search" placeholder="Buscar artículo...">
          </div>
          <select class="select" id="art-category" style="width:180px">
            <option value="">Todas las categorías</option>
          </select>
        </div>
        <div class="table-toolbar-right">
          <span id="art-count" class="text-secondary text-sm"></span>
        </div>
      </div>

      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Artículo</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th>Precio mín.</th>
              <th>Precio prom.</th>
              <th>Precio máx.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="art-tbody">
            <tr><td colspan="8" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="art-footer" class="text-secondary text-sm"></span>
        <div class="pagination" id="art-pagination"></div>
      </div>
    </div>`;

  // Cargar categorías
  loadCategories();

  // Cargar tabla
  let currentPage = 1;
  let favOnly = false;

  const load = async () => {
    const search   = document.getElementById('art-search')?.value || '';
    const category = document.getElementById('art-category')?.value || '';
    const tbody    = document.getElementById('art-tbody');

    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>`;

    try {
      const { articles, total } = await api.getArticles({
        search, category, favorite: favOnly ? 'true' : '', page: currentPage, limit: 20
      });

      document.getElementById('art-count').textContent = `${total} artículos`;
      document.getElementById('art-footer').textContent = `Mostrando ${articles.length} de ${total}`;

      if (!articles.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><p>No se encontraron artículos</p></div></td></tr>`;
        return;
      }

      // Obtener precios desde el historial para cada artículo
      tbody.innerHTML = articles.map(a => {
        const aliases = JSON.parse(typeof a.aliases === 'string' ? a.aliases : JSON.stringify(a.aliases || []));
        return `
          <tr onclick="navigateTo('articles/${a.id}')" style="cursor:pointer">
            <td style="padding:8px 8px 8px 14px" onclick="event.stopPropagation();toggleFav('${a.id}',this)">
              <span style="font-size:16px;cursor:pointer;color:${a.is_favorite?'#F59E0B':'var(--border-strong)'}" title="Favorito">${a.is_favorite?'★':'☆'}</span>
            </td>
            <td>
              <div style="font-weight:500;font-size:13px">${a.name}</div>
              ${aliases.length ? `<div style="font-size:11px;color:var(--text-tertiary)">${aliases.slice(0,2).join(', ')}</div>` : ''}
            </td>
            <td><span class="badge badge-default">${a.category || '—'}</span></td>
            <td style="font-size:12px;color:var(--text-secondary)">${a.unit}</td>
            <td id="min-${a.id}" style="color:var(--success-text);font-weight:600;font-size:13px">—</td>
            <td id="avg-${a.id}" style="font-weight:600;font-size:13px">—</td>
            <td id="max-${a.id}" style="color:var(--error-text);font-size:13px">—</td>
            <td onclick="event.stopPropagation()">
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm" onclick="navigateTo('articles/${a.id}')" title="Ver ficha">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
      }).join('');

      // Cargar precios en background
      articles.forEach(async (a) => {
        try {
          const { stats } = await api.getArticle(a.id);
          if (stats) {
            const el = (id) => document.getElementById(id);
            if (el(`min-${a.id}`)) el(`min-${a.id}`).textContent = formatARS(stats.minPrice);
            if (el(`avg-${a.id}`)) el(`avg-${a.id}`).textContent = formatARS(stats.avgPrice);
            if (el(`max-${a.id}`)) el(`max-${a.id}`).textContent = formatARS(stats.maxPrice);
          }
        } catch {}
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><p style="color:var(--error-text)">${err.message}</p></td></tr>`;
    }
  };

  load();

  let searchTimeout;
  document.getElementById('art-search').addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(load, 400); });
  document.getElementById('art-category').addEventListener('change', load);
  document.getElementById('filter-favorites-btn').addEventListener('click', function() {
    favOnly = !favOnly;
    this.classList.toggle('btn-accent', favOnly);
    this.textContent = favOnly ? '★ Todos' : '★ Solo favoritos';
    load();
  });
}

async function loadCategories() {
  try {
    const cats = await api.getArticleCategories();
    const sel = document.getElementById('art-category');
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  } catch {}
}

window.toggleFav = async (id, el) => {
  try {
    const { is_favorite } = await api.toggleFavorite(id);
    el.querySelector('span').textContent  = is_favorite ? '★' : '☆';
    el.querySelector('span').style.color = is_favorite ? '#F59E0B' : 'var(--border-strong)';
  } catch (err) { showToast('Error', err.message, 'error'); }
};

window.openNewArticleModal = () => {
  const overlay = openModal({
    title: 'Nuevo Artículo',
    size: 'md',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group"><label>Nombre *</label><input class="input" id="new-art-name" placeholder="Ej: Pintura Látex Interior"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Categoría</label><input class="input" id="new-art-cat" placeholder="Ej: Pinturas"></div>
          <div class="form-group"><label>Unidad</label><input class="input" id="new-art-unit" placeholder="litro, kg, unidad..."></div>
        </div>
        <div class="form-group"><label>Alias / Sinónimos</label><input class="input" id="new-art-aliases" placeholder="Látex blanco, Pintura blanca (separados por coma)"></div>
        <div class="form-group"><label>Observaciones</label><textarea class="textarea" id="new-art-notes" rows="2"></textarea></div>
      </div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
             <button class="btn btn-primary" onclick="saveNewArticle()">Guardar</button>`
  });
};

window.saveNewArticle = async () => {
  const name    = document.getElementById('new-art-name')?.value.trim();
  const cat     = document.getElementById('new-art-cat')?.value.trim();
  const unit    = document.getElementById('new-art-unit')?.value.trim();
  const aliases = document.getElementById('new-art-aliases')?.value.split(',').map(s => s.trim()).filter(Boolean);
  const notes   = document.getElementById('new-art-notes')?.value.trim();

  if (!name) { showToast('Error', 'El nombre es requerido', 'error'); return; }

  try {
    await api.createArticle({ name, category: cat, unit: unit || 'unidad', aliases, notes });
    closeModal();
    showToast('Artículo creado', name, 'success');
    navigateTo('articles');
  } catch (err) { showToast('Error', err.message, 'error'); }
};

async function renderArticleDetail(container, articleId) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-ghost btn-sm" onclick="navigateTo('articles')">← Artículos</button>
        <h1 id="art-title">Cargando...</h1>
      </div>
      <div class="page-header-actions" id="art-actions"></div>
    </div>
    <div style="text-align:center;padding:48px"><div class="spinner spinner-lg"></div></div>`;

  try {
    const { article, stats, budgetHistory } = await api.getArticle(articleId);
    document.getElementById('art-title').textContent = article.name;

    const aliases = JSON.parse(typeof article.aliases === 'string' ? article.aliases : JSON.stringify(article.aliases || []));

    document.getElementById('art-actions').innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="toggleFav('${article.id}', this)">
        <span style="color:${article.is_favorite?'#F59E0B':'var(--text-tertiary)'};font-size:16px">${article.is_favorite?'★':'☆'}</span>
        Favorito
      </button>`;

    container.querySelector('div:last-child').outerHTML = `
      <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
        <!-- Panel izquierdo -->
        <div style="display:flex;flex-direction:column;gap:20px">

          <!-- Estadísticas de precio -->
          ${stats ? `
          <div class="card">
            <div class="card-header"><div class="card-title">Análisis de Precios</div></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
              <div style="text-align:center;padding:16px;background:var(--success-bg);border-radius:var(--radius-md)">
                <div style="font-size:1.25rem;font-weight:700;color:var(--success-text)">${formatARS(stats.minPrice)}</div>
                <div style="font-size:11px;color:var(--success-text);opacity:.8">Precio mínimo</div>
              </div>
              <div style="text-align:center;padding:16px;background:var(--bg-body);border-radius:var(--radius-md)">
                <div style="font-size:1.25rem;font-weight:700">${formatARS(stats.avgPrice)}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">Precio promedio</div>
              </div>
              <div style="text-align:center;padding:16px;background:var(--error-bg);border-radius:var(--radius-md)">
                <div style="font-size:1.25rem;font-weight:700;color:var(--error-text)">${formatARS(stats.maxPrice)}</div>
                <div style="font-size:11px;color:var(--error-text);opacity:.8">Precio máximo</div>
              </div>
            </div>
            <!-- Gráfico de evolución de precios -->
            <div class="chart-container">
              <canvas id="price-chart"></canvas>
            </div>
          </div>` : ''}

          <!-- Historial de compras -->
          <div class="card">
            <div class="card-header"><div class="card-title">Historial de Compras</div></div>
            ${budgetHistory.length ? `
              <div style="overflow-x:auto">
                <table class="data-table">
                  <thead><tr><th>Fecha</th><th>Proveedor</th><th>N° Presupuesto</th><th>Cantidad</th><th>Precio Unit.</th></tr></thead>
                  <tbody>
                    ${budgetHistory.map(h => `
                      <tr>
                        <td style="white-space:nowrap;font-size:12px">${formatDate(h.date)}</td>
                        <td style="font-size:12px;font-weight:500">${h.provider_name}</td>
                        <td><code style="font-size:11px">${h.number || '—'}</code></td>
                        <td>${h.quantity} ${h.unit}</td>
                        <td style="font-weight:600">${formatARS(h.unit_price)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>` : '<div class="table-empty"><p>Sin historial de compras</p></div>'}
          </div>
        </div>

        <!-- Panel derecho -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title">Información</div></div>
            <div class="stat-row"><span class="stat-label">Categoría</span><span class="stat-value"><span class="badge badge-default">${article.category || '—'}</span></span></div>
            <div class="stat-row"><span class="stat-label">Unidad</span><span class="stat-value">${article.unit}</span></div>
            ${stats ? `
            <div class="stat-row"><span class="stat-label">Proveedor recomendado</span><span class="stat-value" style="color:var(--success-text)">${stats.recommendedProvider || '—'}</span></div>
            ${stats.lastPurchase ? `<div class="stat-row"><span class="stat-label">Última compra</span><span class="stat-value">${formatDate(stats.lastPurchase.date)}</span></div>` : ''}
            ${stats.annualVariation != null ? `<div class="stat-row"><span class="stat-label">Variación anual</span><span class="stat-value" style="color:${stats.annualVariation>0?'var(--error-text)':'var(--success-text)'}">${formatPct(stats.annualVariation)}</span></div>` : ''}
            ` : ''}
          </div>

          ${aliases.length ? `
          <div class="card">
            <div class="card-header"><div class="card-title">Sinónimos</div></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${aliases.map(a => `<span class="chip">${a}</span>`).join('')}
            </div>
          </div>` : ''}

          ${stats?.providerComparison?.length ? `
          <div class="card">
            <div class="card-header"><div class="card-title">Por Proveedor</div></div>
            ${stats.providerComparison.map((p, i) => `
              <div class="stat-row">
                <div>
                  <div style="font-size:12.5px;font-weight:500">${p.name}</div>
                  ${i===0 ? '<span class="badge badge-success" style="font-size:10px">Más barato</span>' : ''}
                </div>
                <span style="font-weight:700;font-size:13px">${formatARS(Math.round(p.avg))}</span>
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;

    // Renderizar gráfico de evolución si hay datos
    if (stats?.historyByDate?.length) {
      renderPriceChart(stats.historyByDate);
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
    container.innerHTML += `<div class="card"><p style="color:var(--error-text);padding:16px">${err.message}</p></div>`;
  }
}

function renderPriceChart(history) {
  const canvas = document.getElementById('price-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Agrupar por fecha y proveedor
  const byDate = {};
  history.forEach(h => {
    if (!byDate[h.date]) byDate[h.date] = [];
    byDate[h.date].push(h.unit_price);
  });

  const labels = Object.keys(byDate).sort();
  const data   = labels.map(d => {
    const prices = byDate[d];
    return Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  });

  if (articleChart) { try { articleChart.destroy(); } catch {} }
  articleChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels.map(d => formatDate(d)),
      datasets: [{
        label: 'Precio promedio (ARS)',
        data,
        borderColor: '#5E6AD2',
        backgroundColor: 'rgba(94,106,210,0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#5E6AD2',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
        y: {
          ticks: {
            font: { size: 11 },
            callback: v => '$' + v.toLocaleString('es-AR')
          }
        }
      }
    }
  });
}
