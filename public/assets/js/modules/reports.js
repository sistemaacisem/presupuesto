/**
 * Reports Module — Reportes y gráficos analíticos
 */
import { api, formatARS } from '../api.js';
import { showToast } from '../components/toast.js';

let charts = [];

function destroyCharts() {
  charts.forEach(c => { try { c.destroy(); } catch {} });
  charts = [];
}

export function cleanup() {
  destroyCharts();
}

export async function render(container) {
  destroyCharts();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Reportes</h1>
        <p>Análisis histórico de compras, proveedores y tendencias de precios</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="exportReportCSV()">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <div class="tab active" data-tab="providers">Proveedores</div>
      <div class="tab" data-tab="monthly">Compras mensuales</div>
      <div class="tab" data-tab="articles">Artículos top</div>
      <div class="tab" data-tab="increases">Mayores aumentos</div>
      <div class="tab" data-tab="savings">Ahorros</div>
    </div>

    <div id="report-content">
      <div style="text-align:center;padding:48px"><div class="spinner spinner-lg"></div></div>
    </div>`;

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      destroyCharts();
      loadTab(tab.dataset.tab);
    });
  });

  loadTab('providers');
}

async function loadTab(tab) {
  const content = document.getElementById('report-content');
  content.innerHTML = `<div style="text-align:center;padding:48px"><div class="spinner spinner-lg"></div></div>`;

  try {
    switch (tab) {
      case 'providers': await renderProviders(content); break;
      case 'monthly':   await renderMonthly(content); break;
      case 'articles':  await renderArticles(content); break;
      case 'increases': await renderIncreases(content); break;
      case 'savings':   await renderSavings(content); break;
    }
  } catch (err) {
    content.innerHTML = `<div class="card"><p style="color:var(--error-text);padding:16px">${err.message}</p></div>`;
    showToast('Error', err.message, 'error');
  }
}

async function renderProviders(container) {
  const data = await api.getReportProviders();

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 400px;gap:20px;align-items:start">
      <div class="card">
        <div class="card-header"><div class="card-title">Compras por Proveedor</div></div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Proveedor</th><th>Ciudad</th><th>Presupuestos</th><th>Total comprado</th><th>Prom. por presupuesto</th></tr></thead>
            <tbody>
              ${data.map((p, i) => `<tr>
                <td style="font-weight:600;font-size:13px">
                  ${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${p.name}
                </td>
                <td style="font-size:12px;color:var(--text-secondary)">${p.city||'—'}, ${p.province||''}</td>
                <td style="text-align:center;font-weight:600">${p.budget_count}</td>
                <td style="font-weight:700">${formatARS(p.total_spent)}</td>
                <td>${formatARS(Math.round(p.avg_budget))}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Distribución por proveedor</div></div>
        <div class="chart-container" style="height:300px">
          <canvas id="providers-chart"></canvas>
        </div>
      </div>
    </div>`;

  if (data.length && typeof Chart !== 'undefined') {
    const ctx = document.getElementById('providers-chart');
    const colors = ['#5E6AD2','#22C55E','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899'];
    const c = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(p => p.name),
        datasets: [{ data: data.map(p => p.total_spent), backgroundColor: colors.slice(0, data.length), borderWidth: 2, borderColor: 'var(--bg-surface)' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatARS(ctx.parsed)}` } }
        }
      }
    });
    charts.push(c);
  }
}

async function renderMonthly(container) {
  const data = await api.getReportMonthly();

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Compras por Mes</div></div>
      <div class="chart-container chart-container-lg">
        <canvas id="monthly-chart"></canvas>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><div class="card-title">Detalle mensual</div></div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Mes</th><th>Presupuestos</th><th>Total gastado</th></tr></thead>
          <tbody>
            ${data.map(d => `<tr>
              <td style="font-weight:500">${d.month}</td>
              <td style="text-align:center">${d.budget_count}</td>
              <td style="font-weight:700">${formatARS(d.total_spent)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  if (data.length && typeof Chart !== 'undefined') {
    const ctx = document.getElementById('monthly-chart');
    const c = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [{
          label: 'Total gastado (ARS)',
          data: data.map(d => d.total_spent),
          backgroundColor: 'rgba(94,106,210,0.8)',
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatARS(ctx.parsed.y) } } },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: v => '$' + (v/1000000).toFixed(1) + 'M' } }
        }
      }
    });
    charts.push(c);
  }
}

async function renderArticles(container) {
  const data = await api.getReportTopArticles();

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Artículos más comprados</div></div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>#</th><th>Artículo</th><th>Categoría</th><th>Compras</th><th>Precio mín.</th><th>Precio prom.</th><th>Precio máx.</th></tr></thead>
          <tbody>
            ${data.map((a, i) => `<tr onclick="navigateTo('articles/${a.id}')" style="cursor:pointer">
              <td style="font-weight:700;color:var(--text-tertiary)">${i+1}</td>
              <td style="font-weight:600;font-size:13px">${a.name}</td>
              <td><span class="badge badge-default">${a.category||'—'}</span></td>
              <td style="text-align:center;font-weight:700">${a.purchase_count}</td>
              <td style="color:var(--success-text);font-weight:600">${formatARS(a.min_price)}</td>
              <td style="font-weight:600">${formatARS(Math.round(a.avg_price))}</td>
              <td style="color:var(--error-text)">${formatARS(a.max_price)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function renderIncreases(container) {
  const data = await api.getReportPriceIncreases();

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 380px;gap:20px;align-items:start">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Artículos con Mayor Aumento de Precio</div>
          <div class="card-subtitle">Últimos 6 meses vs período anterior</div>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Artículo</th><th>Categoría</th><th>Precio anterior</th><th>Precio reciente</th><th>Aumento</th></tr></thead>
            <tbody>
              ${data.map(a => `<tr>
                <td style="font-weight:500;font-size:13px">${a.name}</td>
                <td><span class="badge badge-default">${a.category||'—'}</span></td>
                <td>${formatARS(a.old_avg)}</td>
                <td style="font-weight:700">${formatARS(a.recent_avg)}</td>
                <td><span class="badge ${a.change_pct>30?'badge-error':a.change_pct>15?'badge-warning':'badge-default'}">+${a.change_pct}%</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Top 8 Aumentos</div></div>
        <div class="chart-container" style="height:300px">
          <canvas id="increases-chart"></canvas>
        </div>
      </div>
    </div>`;

  if (data.length && typeof Chart !== 'undefined') {
    const top8 = data.slice(0, 8);
    const ctx = document.getElementById('increases-chart');
    const c = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top8.map(a => a.name.length > 20 ? a.name.substring(0,18)+'…' : a.name),
        datasets: [{ label: 'Aumento %', data: top8.map(a => a.change_pct), backgroundColor: top8.map(a => a.change_pct > 30 ? '#EF4444' : a.change_pct > 15 ? '#F59E0B' : '#5E6AD2'), borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `+${ctx.parsed.x}%` } } },
        scales: { x: { ticks: { callback: v => v + '%' } }, y: { ticks: { font: { size: 11 } } } }
      }
    });
    charts.push(c);
  }
}

async function renderSavings(container) {
  const { summary, monthly } = await api.getReportSavings();

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      <div class="kpi-card">
        <div class="kpi-icon success"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1"/></svg></div>
        <div class="kpi-value">${formatARS(summary?.total_savings || 0)}</div>
        <div class="kpi-label">Ahorro total acumulado</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"/></svg></div>
        <div class="kpi-value">${summary?.comparison_count || 0}</div>
        <div class="kpi-label">Comparaciones realizadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon warning"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>
        <div class="kpi-value">${summary?.total_overpriced || 0}</div>
        <div class="kpi-label">Artículos sobrepreciados detectados</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon success"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
        <div class="kpi-value">${summary?.total_cheaper || 0}</div>
        <div class="kpi-label">Artículos más económicos</div>
      </div>
    </div>

    ${monthly.length ? `
    <div class="card">
      <div class="card-header"><div class="card-title">Ahorro mensual acumulado</div></div>
      <div class="chart-container"><canvas id="savings-chart"></canvas></div>
    </div>` : ''}`;

  if (monthly.length && typeof Chart !== 'undefined') {
    const ctx = document.getElementById('savings-chart');
    const c = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthly.map(m => m.month),
        datasets: [{
          label: 'Ahorro detectado (ARS)',
          data: monthly.map(m => m.savings),
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34,197,94,0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#22C55E',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatARS(ctx.parsed.y) } } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => '$' + (v/1000).toFixed(0)+'K' } } }
      }
    });
    charts.push(c);
  }
}

window.exportReportCSV = async () => {
  try {
    const data = await api.getReportProviders();
    const rows = [
      ['Proveedor','Ciudad','Provincia','Presupuestos','Total Comprado','Promedio por Presupuesto'],
      ...data.map(p => [p.name, p.city||'', p.province||'', p.budget_count, p.total_spent, Math.round(p.avg_budget)])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `reporte-proveedores-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Exportado', 'Reporte CSV descargado', 'success');
  } catch (err) { showToast('Error', err.message, 'error'); }
};
