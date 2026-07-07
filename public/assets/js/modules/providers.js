/**
 * Providers Module — Gestión completa de proveedores
 */
import { api, formatARS, formatDate } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';

let providerChart = null;

export function cleanup() {
  if (providerChart) { try { providerChart.destroy(); } catch {} providerChart = null; }
}

export async function render(container, param) {
  if (param) { await renderProviderDetail(container, param); return; }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Proveedores</h1>
        <p>Directorio completo con historial de compras y ranking</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openProviderModal()">+ Nuevo proveedor</button>
      </div>
    </div>

    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <div class="search-box" style="width:240px">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="input" type="search" id="prov-search" placeholder="Buscar proveedor...">
          </div>
          <select class="select" id="prov-province" style="width:180px">
            <option value="">Todas las provincias</option>
            ${['Buenos Aires','Córdoba','Santa Fe','Mendoza','Tucumán','Entre Ríos','Salta','Misiones','Chaco','Corrientes','CABA'].map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
        <div class="table-toolbar-right">
          <span id="prov-count" class="text-secondary text-sm"></span>
        </div>
      </div>

      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>CUIT</th>
              <th>Ciudad / Provincia</th>
              <th>Contacto</th>
              <th>Presupuestos</th>
              <th>Total comprado</th>
              <th>Ranking</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="prov-tbody">
            <tr><td colspan="8" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="prov-footer" class="text-secondary text-sm"></span>
      </div>
    </div>`;

  await loadProviders();

  let t;
  document.getElementById('prov-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadProviders, 400); });
  document.getElementById('prov-province').addEventListener('change', loadProviders);
}

async function loadProviders() {
  const search   = document.getElementById('prov-search')?.value || '';
  const province = document.getElementById('prov-province')?.value || '';
  const tbody    = document.getElementById('prov-tbody');

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>`;

  try {
    const { providers, total } = await api.getProviders({ search, province, limit: 50 });

    document.getElementById('prov-count').textContent = `${total} proveedores`;
    document.getElementById('prov-footer').textContent = `Mostrando ${providers.length} de ${total}`;

    if (!providers.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><p>No se encontraron proveedores</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = providers.map(p => {
      const stars = renderStars(p.rating || 0);
      return `
        <tr onclick="navigateTo('providers/${p.id}')" style="cursor:pointer">
          <td>
            <div style="font-weight:600;font-size:13px">${p.name}</div>
            ${p.notes ? `<div style="font-size:11px;color:var(--text-tertiary)" class="truncate" style="max-width:200px">${p.notes.substring(0,60)}</div>` : ''}
          </td>
          <td><code style="font-size:11px">${p.cuit || '—'}</code></td>
          <td>
            <div style="font-size:13px">${p.city || '—'}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">${p.province || ''}</div>
          </td>
          <td>
            ${p.phone ? `<div style="font-size:12px">${p.phone}</div>` : ''}
            ${p.email ? `<div style="font-size:11px;color:var(--accent)">${p.email}</div>` : ''}
          </td>
          <td style="text-align:center;font-weight:600">${p.stats?.budget_count || 0}</td>
          <td style="font-weight:700;font-size:13px">${formatARS(p.stats?.total_spent)}</td>
          <td>${stars}</td>
          <td onclick="event.stopPropagation()">
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" onclick="openProviderModal('${p.id}')" title="Editar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm" onclick="deleteProvider('${p.id}')" style="color:var(--error-text)" title="Eliminar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><p style="color:var(--error-text)">${err.message}</p></td></tr>`;
  }
}

function renderStars(rating) {
  const full = Math.floor(rating);
  return `<div class="rating">${[1,2,3,4,5].map(i => `<svg class="rating-star ${i<=full?'filled':''}" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('')}</div>`;
}

window.openProviderModal = async (id = null) => {
  let provider = {};
  if (id) {
    try { const data = await api.getProvider(id); provider = data.provider; } catch {}
  }

  openModal({
    title: id ? 'Editar Proveedor' : 'Nuevo Proveedor',
    size: 'lg',
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1">
          <label>Razón social / Nombre *</label>
          <input class="input" id="p-name" value="${provider.name || ''}">
        </div>
        <div class="form-group"><label>CUIT</label><input class="input" id="p-cuit" value="${provider.cuit || ''}" placeholder="20-12345678-9"></div>
        <div class="form-group"><label>Teléfono</label><input class="input" id="p-phone" value="${provider.phone || ''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Email</label><input class="input" id="p-email" type="email" value="${provider.email || ''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Dirección</label><input class="input" id="p-address" value="${provider.address || ''}"></div>
        <div class="form-group"><label>Ciudad</label><input class="input" id="p-city" value="${provider.city || ''}"></div>
        <div class="form-group">
          <label>Provincia</label>
          <select class="select" id="p-province">
            ${['Buenos Aires','Córdoba','Santa Fe','Mendoza','Tucumán','Entre Ríos','Salta','Misiones','Chaco','Corrientes','CABA','Otra'].map(pr => `<option ${provider.province===pr?'selected':''}>${pr}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea class="textarea" id="p-notes" rows="2">${provider.notes || ''}</textarea></div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveProvider('${id || ''}')">Guardar</button>`
  });
};

window.saveProvider = async (id) => {
  const data = {
    name:     document.getElementById('p-name')?.value.trim(),
    cuit:     document.getElementById('p-cuit')?.value.trim(),
    phone:    document.getElementById('p-phone')?.value.trim(),
    email:    document.getElementById('p-email')?.value.trim(),
    address:  document.getElementById('p-address')?.value.trim(),
    city:     document.getElementById('p-city')?.value.trim(),
    province: document.getElementById('p-province')?.value,
    notes:    document.getElementById('p-notes')?.value.trim(),
  };

  if (!data.name) { showToast('Error', 'El nombre es requerido', 'error'); return; }

  try {
    if (id) { await api.updateProvider(id, data); showToast('Actualizado', data.name, 'success'); }
    else     { await api.createProvider(data);     showToast('Proveedor creado', data.name, 'success'); }
    closeModal();
    await loadProviders();
  } catch (err) { showToast('Error', err.message, 'error'); }
};

window.deleteProvider = async (id) => {
  if (!(await confirmModal('Se desactivará el proveedor y no aparecerá en nuevas búsquedas.', '¿Eliminar proveedor?'))) return;
  try {
    await api.deleteProvider(id);
    showToast('Eliminado', 'Proveedor desactivado', 'success');
    await loadProviders();
  } catch (err) { showToast('Error', err.message, 'error'); }
};

async function renderProviderDetail(container, id) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-ghost btn-sm" onclick="navigateTo('providers')">← Proveedores</button>
        <h1 id="prov-detail-title">Cargando...</h1>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="openProviderModal('${id}')">Editar</button>
      </div>
    </div>
    <div style="text-align:center;padding:48px"><div class="spinner spinner-lg"></div></div>`;

  try {
    const { provider, budgets, articles } = await api.getProvider(id);
    document.getElementById('prov-detail-title').textContent = provider.name;

    container.querySelector('div:last-child').outerHTML = `
      <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start">
        <!-- Izquierdo -->
        <div style="display:flex;flex-direction:column;gap:20px">
          <!-- Presupuestos -->
          <div class="card">
            <div class="card-header"><div class="card-title">Presupuestos (${budgets.length})</div></div>
            ${budgets.length ? `
              <div style="overflow-x:auto">
                <table class="data-table">
                  <thead><tr><th>N°</th><th>Fecha</th><th>Artículos</th><th>Total</th><th>Estado</th></tr></thead>
                  <tbody>
                    ${budgets.map(b => `<tr onclick="navigateTo('budget/${b.id}')" style="cursor:pointer">
                      <td><code style="font-size:11px">${b.number||'—'}</code></td>
                      <td style="font-size:12px;white-space:nowrap">${formatDate(b.date)}</td>
                      <td style="text-align:center">${b.item_count}</td>
                      <td style="font-weight:600">${formatARS(b.total_amount)}</td>
                      <td><span class="status-dot ${b.status}"></span></td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>` : '<div class="table-empty"><p>Sin presupuestos</p></div>'}
          </div>

          <!-- Artículos -->
          <div class="card">
            <div class="card-header"><div class="card-title">Artículos vendidos (${articles.length})</div></div>
            ${articles.length ? `
              <div style="overflow-x:auto">
                <table class="data-table">
                  <thead><tr><th>Artículo</th><th>Compras</th><th>Precio mín.</th><th>Precio prom.</th><th>Precio máx.</th></tr></thead>
                  <tbody>
                    ${articles.map(a => `<tr onclick="navigateTo('articles/${a.id}')" style="cursor:pointer">
                      <td style="font-weight:500;font-size:13px">${a.name}</td>
                      <td style="text-align:center">${a.purchase_count}</td>
                      <td style="color:var(--success-text)">${formatARS(a.min_price)}</td>
                      <td style="font-weight:600">${formatARS(Math.round(a.avg_price))}</td>
                      <td style="color:var(--error-text)">${formatARS(a.max_price)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>` : '<div class="table-empty"><p>Sin artículos registrados</p></div>'}
          </div>

          <!-- Evolución de precios -->
          <div class="card">
            <div class="card-header"><div class="card-title">Evolución de precios</div></div>
            <div style="padding:16px">
              <div class="form-group">
                <label>Seleccionar artículo</label>
                <select class="select" id="evol-article-select">
                  <option value="">Cargando...</option>
                </select>
              </div>
              <div style="margin-top:12px;position:relative;min-height:200px">
                <canvas id="evol-chart"></canvas>
                <div id="evol-placeholder" style="text-align:center;color:var(--text-tertiary);font-size:13px;padding:40px 0">
                  Seleccioná un artículo para ver su evolución
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Derecho -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title">Datos del proveedor</div></div>
            ${[
              ['CUIT', provider.cuit],
              ['Dirección', provider.address],
              ['Ciudad', `${provider.city || ''} ${provider.province ? '— ' + provider.province : ''}`],
              ['Teléfono', provider.phone],
              ['Email', provider.email],
            ].filter(([,v]) => v?.trim()).map(([l,v]) => `<div class="stat-row"><span class="stat-label">${l}</span><span class="stat-value" style="font-size:12px">${v}</span></div>`).join('')}
            ${provider.notes ? `<div style="margin-top:12px;padding:12px;background:var(--bg-body);border-radius:var(--radius-md);font-size:12.5px;color:var(--text-secondary)">${provider.notes}</div>` : ''}
          </div>
        </div>
      </div>`;
    // Cargar evolución de precios
    loadEvolution(id);
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function loadEvolution(providerId) {
  try {
    const articles = await api.getProviderEvolution(providerId);
    const select = document.getElementById('evol-article-select');
    if (!select) return;

    if (!articles.length) {
      select.innerHTML = '<option value="">Sin datos históricos</option>';
      document.getElementById('evol-placeholder').style.display = 'block';
      return;
    }

    select.innerHTML = '<option value="">Seleccionar artículo...</option>' +
      articles.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    select.addEventListener('change', () => {
      const art = articles.find(a => String(a.id) === select.value);
      const canvas = document.getElementById('evol-chart');
      const placeholder = document.getElementById('evol-placeholder');

      if (providerChart) { try { providerChart.destroy(); } catch {} providerChart = null; }

      if (!art || !art.prices || art.prices.length < 2) {
        placeholder.style.display = 'block';
        placeholder.textContent = art ? 'Se necesitan al menos 2 mediciones para mostrar evolución' : 'Seleccioná un artículo para ver su evolución';
        return;
      }

      placeholder.style.display = 'none';
      const ctx = canvas.getContext('2d');
      const dates = art.prices.map(p => new Date(p.date).toLocaleDateString('es-AR', { month:'short', year:'2-digit' }));
      const prices = art.prices.map(p => p.unitPrice);

      providerChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: art.name,
            data: prices,
            borderColor: '#0b5ed7',
            backgroundColor: 'rgba(11,94,215,0.08)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#0b5ed7',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `$${ctx.parsed.y.toLocaleString('es-AR')}`
              }
            }
          },
          scales: {
            y: {
              ticks: { callback: (v) => '$' + v.toLocaleString('es-AR') }
            }
          }
        }
      });
    });
  } catch (err) {
    console.error('Error loading evolution:', err);
  }
}
