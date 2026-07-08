/**
 * app.js — Router SPA principal
 * Maneja navegación hash, autenticación y carga de módulos
 */

import { currentUser } from './api.js';
import { showToast, enableRippleEffect } from './components/toast.js';

// ─── Guard de autenticación ──────────────────────────────────
if (!localStorage.getItem('token')) {
  window.location.href = '/login.html';
}

document.documentElement.setAttribute('data-theme', 'dark');

// ─── Ripple effect en botones ────────────────────────────────
enableRippleEffect();

// ─── Info de usuario ─────────────────────────────────────────
const user = currentUser();

const ROLE_LABELS = { admin: 'Administrador', purchases: 'Compras', readonly: 'Consulta' };

if (user.name) {
  const initials = user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar-initials').textContent = initials;
  document.getElementById('user-display-name').textContent = user.name;
  document.getElementById('user-display-role').textContent = ROLE_LABELS[user.role] || user.role;

  // Mostrar sección admin si es admin
  if (user.role === 'admin') {
    document.getElementById('nav-admin-section').style.display = '';
    document.getElementById('nav-users').style.display = '';
  }
}

// ─── Logout ──────────────────────────────────────────────────
document.getElementById('logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
});

// ─── Sidebar toggle ───────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const mainWrapper = document.getElementById('main-wrapper');
const topbar = document.getElementById('topbar');

const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
if (isCollapsed) {
  sidebar.classList.add('collapsed');
  document.body.classList.add('sidebar-collapsed');
}

document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
  const collapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('sidebarCollapsed', collapsed);
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', String(!collapsed));
});

// ─── Sidebar móvil ────────────────────────────────────────────
const overlay = document.getElementById('sidebar-overlay');
const mobileBtn = document.getElementById('mobile-menu-btn');

if (window.innerWidth <= 768) mobileBtn.style.display = 'flex';

mobileBtn?.addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('visible');
});

overlay?.addEventListener('click', () => {
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('visible');
});

window.addEventListener('resize', () => {
  if (window.innerWidth <= 768) {
    mobileBtn.style.display = 'flex';
  } else {
    mobileBtn.style.display = 'none';
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('visible');
  }
});

// ─── ROUTER SPA ───────────────────────────────────────────────
const ROUTES = {
  'dashboard':    { title: 'Dashboard',         module: () => import('./modules/dashboard.js') },
  'history':      { title: 'Cargar presupuesto',  module: () => import('./modules/history.js') },
  'budget':       { title: 'Historial de presupuestos', module: () => import('./modules/budget.js') },
      'multicomparison': { title: 'Comparación de presupuestos', module: () => import('./modules/multicomparison.js') },
  'search':       { title: 'Buscador',          module: () => import('./modules/search.js') },
  'articles':     { title: 'Artículos',         module: () => import('./modules/articles.js') },
  'providers':    { title: 'Proveedores',       module: () => import('./modules/providers.js') },
  'reports':      { title: 'Reportes',          module: () => import('./modules/reports.js') },
  'users':        { title: 'Usuarios',          module: () => import('./modules/users.js') },
};

let currentRoute = null;
let currentCleanup = null;

async function navigate(hash) {
  // Limpiar módulo anterior antes de navegar
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.warn('Module cleanup error:', e); }
    currentCleanup = null;
  }

  const raw  = hash.replace('#/', '') || 'dashboard';
  // Soporte para rutas con parámetros: articles/UUID
  const [route, param] = raw.split('/');
  const config = ROUTES[route] || ROUTES['dashboard'];

  // Mostrar barra de progreso
  const nbar = document.querySelector('#nprogress .bar');
  if (nbar) {
    nbar.classList.add('indeterminate');
    nbar.style.width = '30%';
  }

  // Actualizar nav activo con ARIA
  document.querySelectorAll('.nav-item').forEach(el => {
    const isActive = el.dataset.route === route;
    el.classList.toggle('active', isActive);
    if (isActive) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });

  // Actualizar topbar title
  document.getElementById('topbar-title').textContent = config.title;
  document.title = `${config.title} — A.C.I.S.E.M.`;

  // Cerrar sidebar en móvil
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('visible');
  }

  // Mostrar loading
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="empty-state page-fade">
      <div class="empty-state-icon"><div class="spinner spinner-lg"></div></div>
      <p>Cargando módulo...</p>
    </div>`;

  try {
    const mod = await config.module();
    currentRoute = route;
    content.innerHTML = '';
    await mod.render(content, param);
    currentCleanup = typeof mod.cleanup === 'function' ? mod.cleanup : null;
    content.classList.add('page-enter');
    setTimeout(() => content.classList.remove('page-enter'), 300);

    // Completar barra de progreso
    if (nbar) {
      nbar.style.width = '100%';
      setTimeout(() => {
        nbar.classList.remove('indeterminate');
        nbar.style.width = '0%';
      }, 300);
    }
  } catch (err) {
    currentCleanup = null;
    console.error('Error cargando módulo:', err);
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3>Error al cargar</h3>
        <p>${err.message}</p>
        <button class="btn btn-primary" onclick="window.location.reload()">Recargar página</button>
      </div>`;
    showToast('Error', `No se pudo cargar el módulo: ${err.message}`, 'error');

    // Reset barra de progreso
    if (nbar) {
      nbar.classList.remove('indeterminate');
      nbar.style.width = '0%';
    }
  }
}

// ─── Event listener de hash ───────────────────────────────────
window.addEventListener('hashchange', () => navigate(window.location.hash));

// ─── Navegación inicial ───────────────────────────────────────
navigate(window.location.hash || '#/dashboard');

// ─── Alertas / notificaciones ─────────────────────────────────
async function updateAlertsBadge() {
  try {
    const { api } = await import('./api.js');
    const { count } = await api.getUnreadAlertCount();
    const badge = document.getElementById('alerts-count');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch {}
}
updateAlertsBadge();
setInterval(updateAlertsBadge, 30000);

window.markAlertRead = async (id) => {
  const { api } = await import('./api.js');
  try {
    await api.markAlertRead(id);
    updateAlertsBadge();
  } catch {}
};

window.markAllAlertsRead = async () => {
  const { api } = await import('./api.js');
  try {
    await api.markAllAlertsRead();
    updateAlertsBadge();
  } catch {}
};

document.getElementById('alerts-btn')?.addEventListener('click', async () => {
  const { api, formatDate, formatARS } = await import('./api.js');
  const { openModal } = await import('./components/modal.js');
  try {
    const alerts = await api.getAlerts();
    openModal({
      title: '🔔 Alertas',
      size: 'md',
      body: `
        ${alerts.length === 0 ? '<p style="text-align:center;padding:24px;color:var(--text-tertiary)">No hay alertas</p>' : ''}
        <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">
          ${alerts.map(a => `
            <div style="display:flex;align-items:start;gap:10px;padding:10px;border-radius:var(--radius-md);background:${a.is_read ? 'transparent' : 'var(--bg-secondary)'};border:1px solid var(--border)">
              <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${a.severity === 'warning' ? 'var(--warning-bg)' : 'var(--error-bg)'}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:${a.severity === 'warning' ? 'var(--warning-text)' : 'var(--error-text)'}"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px">${a.title}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${a.message}</div>
                <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">${formatDate(a.created_at)}</div>
              </div>
              ${!a.is_read ? `<button class="btn btn-ghost btn-sm" onclick="markAlertRead('${a.id}')" style="flex-shrink:0" title="Marcar leída">✓</button>` : ''}
            </div>
          `).join('')}
        </div>
      `,
      footer: alerts.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="markAllAlertsRead()">Marcar todas leídas</button>` : ''
    });
  } catch {}
});

// ─── Navegación programática (para otros módulos) ─────────────
window.navigateTo = (route) => {
  window.location.hash = `#/${route}`;
};
