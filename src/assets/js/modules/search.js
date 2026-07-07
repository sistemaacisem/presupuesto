/**
 * Search Module — Buscador Inteligente con Fuse.js
 */
import { api, formatARS, formatDate } from '../api.js';
import { showToast } from '../components/toast.js';

let fuseInstance = null;
let allArticles  = [];
let searchTimeout = null;

export function cleanup() {
  if (searchTimeout) { clearTimeout(searchTimeout); searchTimeout = null; }
  fuseInstance = null;
  allArticles = [];
}

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Buscador Inteligente</h1>
        <p>Buscá artículos con sinónimos, errores ortográficos o nombres parciales</p>
      </div>
    </div>

    <!-- Search hero -->
    <div class="card" style="margin-bottom:24px">
      <div class="search-box" style="max-width:700px;margin:0 auto">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="input" type="search" id="main-search"
               placeholder='Buscá "Látex Blanco", "Pintura", "cemento", "cable 2.5"...'
               style="font-size:15px;padding:12px 12px 12px 40px;border-radius:var(--radius-lg)"
               autocomplete="off" autofocus>
      </div>

      <!-- Historial de búsquedas -->
      <div id="search-history-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;justify-content:center"></div>

      <div style="text-align:center;margin-top:8px">
        <span style="font-size:12px;color:var(--text-tertiary)">
          Tip: funciona con errores de tipeo ("pint blanca" → Pintura Látex Blanca)
        </span>
      </div>
    </div>

    <!-- Results -->
    <div id="search-results">
      <!-- Artículos destacados (favoritos) -->
      <div id="favorites-section" style="margin-bottom:24px">
        <h2 style="font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:12px">★ Artículos Favoritos</h2>
        <div id="favorites-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
          <div class="skeleton" style="height:80px;border-radius:12px"></div>
          <div class="skeleton" style="height:80px;border-radius:12px"></div>
          <div class="skeleton" style="height:80px;border-radius:12px"></div>
        </div>
      </div>

      <!-- Tabla de resultados (oculta al inicio) -->
      <div id="results-table-wrapper" style="display:none">
        <div class="table-wrapper">
          <div class="table-toolbar">
            <div class="table-toolbar-left">
              <span id="results-count" style="font-size:13px;font-weight:600;color:var(--text-primary)"></span>
              <span id="results-query" style="font-size:13px;color:var(--text-tertiary)"></span>
            </div>
            <div class="table-toolbar-right">
              <button class="btn btn-ghost btn-sm" id="clear-search">Limpiar</button>
            </div>
          </div>

          <!-- Artículos encontrados -->
          <div id="articles-results"></div>

          <!-- Historial de precios encontrado -->
          <div id="price-results"></div>
        </div>
      </div>
    </div>`;

  // Cargar artículos para Fuse.js (búsqueda local offline)
  loadArticlesForFuse();
  loadFavorites();
  loadSearchHistory();

  // Input handler con debounce
  const input = document.getElementById('main-search');
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (q.length < 2) {
      showFavorites();
      return;
    }
    searchTimeout = setTimeout(() => doSearch(q), 300);
  });

  document.getElementById('clear-search')?.addEventListener('click', () => {
    input.value = '';
    showFavorites();
  });
}

async function loadArticlesForFuse() {
  try {
    const { articles } = await api.getArticles({ limit: 1000 });
    allArticles = articles;
    fuseInstance = new Fuse(articles, {
      keys: [
        { name: 'name',     weight: 0.6 },
        { name: 'aliases',  weight: 0.3 },
        { name: 'category', weight: 0.1 },
      ],
      threshold: 0.45,
      includeScore: true,
      ignoreLocation: true,
      useExtendedSearch: false,
    });
  } catch {}
}

async function loadFavorites() {
  try {
    const { articles } = await api.getArticles({ favorite: 'true', limit: 12 });
    const grid = document.getElementById('favorites-grid');
    if (!articles.length) {
      grid.innerHTML = `<p style="color:var(--text-tertiary);font-size:13px;grid-column:1/-1">Sin favoritos marcados aún</p>`;
      return;
    }
    grid.innerHTML = articles.map(a => `
      <div class="card hover-lift" style="padding:14px;cursor:pointer" onclick="navigateTo('articles/${a.id}')">
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">${a.category || 'Sin categoría'}</div>
        <div style="font-weight:600;font-size:13px;color:var(--text-primary)" class="truncate">${a.name}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${a.unit}</div>
      </div>`).join('');
  } catch {}
}

async function loadSearchHistory() {
  try {
    const history = await api.getSearchHistory();
    const chips = document.getElementById('search-history-chips');
    chips.innerHTML = history.slice(0, 10).map(h => `
      <span class="chip" style="cursor:pointer" onclick="quickSearch('${h.query.replace(/'/g, "\\'")}')">
        ${h.query}
        <span style="color:var(--text-tertiary);font-size:10px">(${h.search_count})</span>
      </span>`).join('');
  } catch {}
}

async function doSearch(query) {
  const favSection   = document.getElementById('favorites-section');
  const resultWrapper = document.getElementById('results-table-wrapper');
  const articlesDiv  = document.getElementById('articles-results');
  const priceDiv     = document.getElementById('price-results');

  favSection.style.display = 'none';
  resultWrapper.style.display = 'block';

  document.getElementById('results-count').textContent = 'Buscando...';
  document.getElementById('results-query').textContent = '';

  try {
    // Búsqueda local con Fuse.js (instantánea)
    let localResults = [];
    if (fuseInstance) {
      localResults = fuseInstance.search(query).slice(0, 20).map(r => r.item);
    }

    // Búsqueda remota (incluye historial de precios)
    const remote = await api.search(query, { limit: 30 });

    // Combinar: priorizar resultados locales de Fuse + resultados remotos únicos
    const seen = new Set(localResults.map(a => a.id));
    const combined = [...localResults];
    remote.articles.forEach(a => { if (!seen.has(a.id)) { combined.push(a); seen.add(a.id); } });

    const total = combined.length + remote.budgetDetails.length;
    document.getElementById('results-count').textContent = `${total} resultados`;
    document.getElementById('results-query').textContent = `para "${query}"`;

    // Artículos
    if (combined.length) {
      articlesDiv.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text-tertiary)">
          ARTÍCULOS (${combined.length})
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:16px">
          ${combined.map(a => `
            <div class="card hover-lift" style="padding:14px;cursor:pointer" onclick="navigateTo('articles/${a.id}')">
              <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
                <div style="min-width:0">
                  <div style="font-size:11px;color:var(--text-tertiary)">${a.category || '—'}</div>
                  <div style="font-weight:600;font-size:13px;margin-top:2px" class="truncate">${a.name}</div>
                  ${a.aliases?.length ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">También: ${JSON.parse(typeof a.aliases === 'string' ? a.aliases : JSON.stringify(a.aliases)).slice(0,2).join(', ')}</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                  ${a.avg_price ? `<div style="font-weight:700;font-size:13px">${formatARS(Math.round(a.avg_price))}</div><div style="font-size:10px;color:var(--text-tertiary)">promedio</div>` : ''}
                </div>
              </div>
            </div>`).join('')}
        </div>`;
    } else {
      articlesDiv.innerHTML = '';
    }

    // Historial de precios
    if (remote.budgetDetails.length) {
      priceDiv.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text-tertiary)">
          HISTORIAL DE PRECIOS (${remote.budgetDetails.length})
        </div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr>
              <th>Artículo</th><th>Proveedor</th><th>Fecha</th>
              <th>Cantidad</th><th>Unidad</th><th>Precio Unit.</th><th>Total</th>
            </tr></thead>
            <tbody>
              ${remote.budgetDetails.map(d => `
                <tr onclick="navigateTo('articles/${d.article_id || ''}')" style="cursor:pointer">
                  <td style="font-weight:500;max-width:200px" class="truncate">${d.article_name || d.raw_description || '—'}</td>
                  <td style="font-size:12px">
                    <div>${d.provider_name || '—'}</div>
                    <div style="color:var(--text-tertiary)">${d.provider_city || ''}</div>
                  </td>
                  <td style="white-space:nowrap;font-size:12px">${formatDate(d.budget_date)}</td>
                  <td>${d.quantity}</td>
                  <td>${d.unit}</td>
                  <td style="font-weight:600">${formatARS(d.unit_price)}</td>
                  <td style="font-weight:600">${formatARS(d.total_price)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      priceDiv.innerHTML = '';
    }

    if (!combined.length && !remote.budgetDetails.length) {
      articlesDiv.innerHTML = `
        <div class="empty-state" style="padding:48px">
          <div class="empty-state-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3>Sin resultados</h3>
          <p>No encontramos "${query}". Probá con otro término o cargá más presupuestos al historial.</p>
        </div>`;
    }
  } catch (err) {
    articlesDiv.innerHTML = `<p style="color:var(--error-text);padding:24px">${err.message}</p>`;
  }
}

function showFavorites() {
  document.getElementById('favorites-section').style.display = '';
  document.getElementById('results-table-wrapper').style.display = 'none';
}

window.quickSearch = (query) => {
  const input = document.getElementById('main-search');
  if (input) { input.value = query; input.dispatchEvent(new Event('input')); }
};
