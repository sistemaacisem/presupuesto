import { api, formatARS, formatDate } from '../api.js';
import { showToast } from '../components/toast.js';

let chartInstances = [];
let animTimers = [];

export function cleanup() {
  chartInstances.forEach(c => { try { c.destroy(); } catch {} });
  chartInstances = [];
  animTimers.forEach(t => { try { clearInterval(t); clearTimeout(t); } catch {} });
  animTimers = [];
}

export async function render(container) {
  cleanup();
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="skeleton" style="width:220px;height:28px;margin-bottom:8px"></div>
        <div class="skeleton" style="width:160px;height:16px"></div>
      </div>
    </div>
    <div class="skeleton-kpi-grid">
      ${Array(6).fill(`
        <div class="skeleton-kpi">
          <div class="skeleton skeleton-kpi-bar"></div>
          <div class="skeleton skeleton-kpi-bar"></div>
          <div class="skeleton skeleton-kpi-bar"></div>
        </div>
      `).join('')}
    </div>
    <div class="skeleton-chart-row">
      <div class="skeleton-chart">
        <div class="skeleton" style="width:140px;height:16px;margin-bottom:16px"></div>
        <div class="skeleton-chart-bar">
          ${Array(4).fill('<span class="skeleton" style="height:60%"></span>').join('')}
        </div>
      </div>
      <div class="skeleton-chart">
        <div class="skeleton" style="width:140px;height:16px;margin-bottom:16px"></div>
        <div class="skeleton-chart-bar">
          ${Array(6).fill('<span class="skeleton" style="height:40%"></span>').join('')}
        </div>
      </div>
    </div>`;

  const results = await Promise.allSettled([
    api.getAnalyticsDashboard(),
    api.getSpendingByCategory(),
    api.getSpendingByProvider(),
    api.getMonthlyTrend(),
    api.getTopArticles()
  ]);

  const [dash, byCategory, byProvider, monthly, topArticles] = results.map(r =>
    r.status === 'fulfilled' ? r.value : null
  );

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    showToast('Error al cargar datos', errors.map(e => e.reason.message).join('; '), 'error');
  }

  if (!dash) {
    container.innerHTML = `<div class="empty-state"><p class="text-error">No se pudieron cargar los datos del dashboard.</p></div>`;
    return;
  }

  renderDashboard(container, {
    dash,
    byCategory: byCategory || [],
    byProvider: byProvider || [],
    monthly: monthly || [],
    topArticles: topArticles || []
  });
}

function animateKPIValue(element, targetValue, duration = 800) {
  const isCurrency = typeof targetValue === 'string' && targetValue.startsWith('$');
  let start = 0;
  const end = isCurrency
    ? parseFloat(targetValue.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'))
    : parseFloat(targetValue) || 0;

  const step = end > 10000000 ? Math.ceil(end / 30) : Math.ceil(end / 40) || 1;
  const interval = Math.max(15, Math.min(40, duration / (end / step)));

  const formatter = isCurrency
    ? (v) => formatARS(v)
    : (v) => Number.isInteger(v) ? v.toLocaleString('es-AR') : v.toFixed(1);

  const timer = setInterval(() => {
    if (!element.isConnected) {
      clearInterval(timer);
      return;
    }
    start += step;
    if (start >= end) {
      start = end;
      clearInterval(timer);
    }
    element.textContent = formatter(start);
  }, interval);
  animTimers.push(timer);
}

function renderDashboard(container, data) {
  const { dash, byCategory, byProvider, monthly, topArticles } = data;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Dashboard Analítico</h1>
        <p>Visión general del sistema de compras</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-export-report">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Exportar Reporte
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid" id="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"/></svg></div>
        <div class="kpi-value" data-value="${formatARS(dash.totalBudgetAmount)}">${formatARS(dash.totalBudgetAmount)}</div>
        <div class="kpi-label">Inversión Total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon info"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
        <div class="kpi-value" data-value="${dash.budgetCount}">${dash.budgetCount}</div>
        <div class="kpi-label">Presupuestos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon info"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg></div>
        <div class="kpi-value" data-value="${dash.providerCount}">${dash.providerCount}</div>
        <div class="kpi-label">Proveedores</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon info"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
        <div class="kpi-value" data-value="${dash.articleCount}">${dash.articleCount}</div>
        <div class="kpi-label">Artículos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon ${dash.avgOverpriced > 1 ? 'error' : 'success'}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg></div>
        <div class="kpi-value ${dash.avgOverpriced > 1 ? 'text-error' : 'text-success'}" data-value="${dash.avgOverpriced.toFixed(1)}">${dash.avgOverpriced.toFixed(1)}</div>
        <div class="kpi-label">Prom. sobreprecio</div>
        ${dash.avgOverpriced > 1 ? '<div class="kpi-change up"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg> Requiere atención</div>' : '<div class="kpi-change down"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg> Dentro de lo esperado</div>'}
      </div>
      <div class="kpi-card">
        <div class="kpi-icon ${dash.pendingAlerts > 0 ? 'warning' : 'info'}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
        <div class="kpi-value ${dash.pendingAlerts > 0 ? 'text-warning' : 'text-secondary'}" data-value="${dash.pendingAlerts}">${dash.pendingAlerts}</div>
        <div class="kpi-label">Alertas pendientes</div>
        ${dash.pendingAlerts > 0 ? '<div class="kpi-change up" style="background:var(--warning-bg);color:var(--warning-text)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01"/></svg> Revisar</div>' : '<div class="kpi-change down" style="background:var(--bg-hover);color:var(--text-tertiary)">Sin novedades</div>'}
      </div>
    </div>

    <!-- Charts Row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
      <div class="card"><div class="card-header"><div class="card-title">Gasto por Categoría</div></div><div style="padding:8px;height:170px"><canvas id="chart-category"></canvas></div></div>
      <div class="card"><div class="card-header"><div class="card-title">Tendencia Mensual</div></div><div style="padding:8px;height:170px"><canvas id="chart-monthly"></canvas></div></div>
    </div>

    <!-- Second row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
      <div class="card"><div class="card-header"><div class="card-title">Top Proveedores</div></div><div style="padding:8px;height:170px"><canvas id="chart-providers"></canvas></div></div>
      <div class="card"><div class="card-header"><div class="card-title">Top Artículos por Gasto</div></div><div style="padding:8px;height:170px"><canvas id="chart-articles"></canvas></div></div>
    </div>

    <!-- Presupuestos recientes -->
    <div class="card" style="margin-top:8px">
      <div class="card-header">
        <div class="card-title">Presupuestos Recientes</div>
        <a href="#/history" class="btn btn-ghost btn-sm" data-nav>Ver todos</a>
      </div>
      ${dash.recentBudgets?.length ? `
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>N°</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              ${dash.recentBudgets.map(b => `<tr onclick="navigateTo('budget/${b.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navigateTo('budget/${b.id}')}" tabindex="0" role="link" style="cursor:pointer">
                <td><code>${b.number || '—'}</code></td>
                <td>${b.provider_name || '—'}</td>
                <td style="white-space:nowrap">${formatDate(b.date)}</td>
                <td style="font-weight:600">${formatARS(b.total_amount)}</td>
                <td><span class="status-dot ${b.status}"></span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="table-empty">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          <h3>Sin presupuestos cargados</h3>
          <p>Subí presupuestos históricos para comenzar a ver análisis y comparaciones.</p>
          <a href="#/history" class="btn btn-primary" data-nav>Cargar historial</a>
        </div>`}
    </div>`;

  renderCharts(byCategory, byProvider, monthly, topArticles);
  setupExport(dash, byCategory, byProvider, monthly);
  container.querySelectorAll('a[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = el.getAttribute('href'); });
  });

  // Animar contadores de KPIs
  document.querySelectorAll('.kpi-value').forEach((el, i) => {
    const originalText = el.textContent;
    el.textContent = '0';
    setTimeout(() => animateKPIValue(el, originalText), 100 + i * 80);
  });
}

function renderCharts(byCategory, byProvider, monthly, topArticles) {
  const colors = ['#0b5ed7','#22c55e','#eab308','#ef4444','#a855f7','#f97316','#06b6d4','#ec4899','#84cc16','#14b8a6'];

  // Pie: gasto por categoría
  const catCtx = document.getElementById('chart-category')?.getContext('2d');
  if (catCtx && byCategory.length) {
    chartInstances.push(new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: byCategory.map(r => r.category),
        datasets: [{ data: byCategory.map(r => r.total), backgroundColor: colors.slice(0, byCategory.length), borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    }));
  }

  // Line: tendencia mensual
  const monCtx = document.getElementById('chart-monthly')?.getContext('2d');
  if (monCtx && monthly.length) {
    chartInstances.push(new Chart(monCtx, {
      type: 'line',
      data: {
        labels: monthly.map(r => r.month),
        datasets: [{
          label: 'Gasto mensual',
          data: monthly.map(r => r.total),
          borderColor: '#0b5ed7', backgroundColor: 'rgba(11,94,215,0.08)',
          fill: true, tension: 0.3, pointRadius: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatARS(ctx.parsed.y) } } },
        scales: { y: { ticks: { callback: (v) => formatARS(v) } } }
      }
    }));
  }

  // Bar: top proveedores
  const provCtx = document.getElementById('chart-providers')?.getContext('2d');
  if (provCtx && byProvider.length) {
    const top5 = byProvider.slice(0, 5);
    chartInstances.push(new Chart(provCtx, {
      type: 'bar',
      data: {
        labels: top5.map(r => r.name?.length > 15 ? r.name.substring(0, 15) + '…' : r.name),
        datasets: [{
          label: 'Gasto total',
          data: top5.map(r => r.total_spent),
          backgroundColor: colors.slice(0, 5), borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatARS(ctx.parsed.x) } } },
        scales: { x: { ticks: { callback: (v) => formatARS(v) } } }
      }
    }));
  }

  // Bar: top artículos
  const artCtx = document.getElementById('chart-articles')?.getContext('2d');
  if (artCtx && topArticles.length) {
    const top5 = topArticles.slice(0, 5);
    chartInstances.push(new Chart(artCtx, {
      type: 'bar',
      data: {
        labels: top5.map(r => r.name?.length > 18 ? r.name.substring(0, 18) + '…' : r.name),
        datasets: [{
          label: 'Gasto total',
          data: top5.map(r => r.total_spent),
          backgroundColor: colors.slice(5, 10), borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatARS(ctx.parsed.y) } } },
        scales: { y: { ticks: { callback: (v) => formatARS(v) } } }
      }
    }));
  }
}

function setupExport(dash, byCategory, byProvider, monthly) {
  document.getElementById('btn-export-report')?.addEventListener('click', async () => {
    try {
      const report = await api.exportAnalyticsReport();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `reporte-acisem-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Reporte exportado', 'JSON descargado', 'success');
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  });
}
