/**
 * API Client — Wrapper fetch para la REST API
 * Maneja autenticación JWT, errores y serialización
 */

const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getHeaders(isFormData = false) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return headers;
}

async function handleResponse(res) {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    throw new Error('Sesión expirada');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  // ─── Auth ─────────────────────────────────────────────────
  async login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async me() {
    const res = await fetch(`${BASE_URL}/auth/me`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // ─── Dashboard ────────────────────────────────────────────
  async getDashboardStats() {
    const res = await fetch(`${BASE_URL}/dashboard/stats`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // ─── Analytics ────────────────────────────────────────────
  async getAnalyticsDashboard() {
    const res = await fetch(`${BASE_URL}/analytics/dashboard`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getSpendingByCategory() {
    const res = await fetch(`${BASE_URL}/analytics/spending-by-category`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getSpendingByProvider() {
    const res = await fetch(`${BASE_URL}/analytics/spending-by-provider`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getMonthlyTrend() {
    const res = await fetch(`${BASE_URL}/analytics/monthly-trend`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getTopArticles() {
    const res = await fetch(`${BASE_URL}/analytics/top-articles`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async exportAnalyticsReport() {
    const res = await fetch(`${BASE_URL}/analytics/export`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // ─── Providers ────────────────────────────────────────────
  async getProviders(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/providers?${q}`, { headers: getHeaders() });
    const body = await handleResponse(res);
    return { providers: body.data, total: body.total, page: body.page, limit: body.limit, totalPages: body.totalPages };
  },
  async getProvider(id) {
    const res = await fetch(`${BASE_URL}/providers/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async createProvider(data) {
    const res = await fetch(`${BASE_URL}/providers`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  async updateProvider(id, data) {
    const res = await fetch(`${BASE_URL}/providers/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  async getProviderEvolution(id) {
    const res = await fetch(`${BASE_URL}/providers/${id}/evolution`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async deleteProvider(id) {
    const res = await fetch(`${BASE_URL}/providers/${id}`, {
      method: 'DELETE', headers: getHeaders()
    });
    return handleResponse(res);
  },

  // ─── Articles ─────────────────────────────────────────────
  async getArticles(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/articles?${q}`, { headers: getHeaders() });
    const body = await handleResponse(res);
    return { articles: body.data, total: body.total, page: body.page, limit: body.limit, totalPages: body.totalPages };
  },
  async getArticle(id) {
    const res = await fetch(`${BASE_URL}/articles/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getArticleCategories() {
    const res = await fetch(`${BASE_URL}/articles/categories`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async createArticle(data) {
    const res = await fetch(`${BASE_URL}/articles`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  async updateArticle(id, data) {
    const res = await fetch(`${BASE_URL}/articles/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  async toggleFavorite(id) {
    const res = await fetch(`${BASE_URL}/articles/${id}/favorite`, {
      method: 'PATCH', headers: getHeaders()
    });
    return handleResponse(res);
  },

  // ─── Budgets ──────────────────────────────────────────────
  async getBudgets(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/budgets?${q}`, { headers: getHeaders() });
    const body = await handleResponse(res);
    return { budgets: body.data, total: body.total, page: body.page, limit: body.limit, totalPages: body.totalPages };
  },
  async getBudget(id) {
    const res = await fetch(`${BASE_URL}/budgets/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async uploadBudget(formData) {
    const res = await fetch(`${BASE_URL}/budgets/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    return handleResponse(res);
  },
  async createBudget(data) {
    const res = await fetch(`${BASE_URL}/budgets`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  async updateBudgetStatus(id, status) {
    const res = await fetch(`${BASE_URL}/budgets/${id}/status`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },
  async deleteBudget(id) {
    const res = await fetch(`${BASE_URL}/budgets/${id}`, {
      method: 'DELETE', headers: getHeaders()
    });
    return handleResponse(res);
  },
  async bulkDeleteBudgets(ids) {
    const res = await fetch(`${BASE_URL}/budgets/bulk-delete`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ ids })
    });
    return handleResponse(res);
  },

  // ─── Comparisons ──────────────────────────────────────────
  async compare(budgetId, name) {
    const res = await fetch(`${BASE_URL}/comparisons`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ budget_id: budgetId, name })
    });
    return handleResponse(res);
  },
  async getComparisons() {
    const res = await fetch(`${BASE_URL}/comparisons`, { headers: getHeaders() });
    const body = await handleResponse(res);
    return body.data;
  },
  async getComparison(id) {
    const res = await fetch(`${BASE_URL}/comparisons/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async compareMultiple(budgetIds) {
    const res = await fetch(`${BASE_URL}/comparisons/multi`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ budget_ids: budgetIds })
    });
    return handleResponse(res);
  },
  async deleteComparison(id) {
    const res = await fetch(`${BASE_URL}/comparisons/${id}`, {
      method: 'DELETE', headers: getHeaders()
    });
    return handleResponse(res);
  },

  // ─── Search ───────────────────────────────────────────────
  async search(query, params = {}) {
    const q = new URLSearchParams({ q: query, ...params }).toString();
    const res = await fetch(`${BASE_URL}/search?${q}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getSearchHistory() {
    const res = await fetch(`${BASE_URL}/search/history`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // ─── Reports ──────────────────────────────────────────────
  async getReportProviders() {
    const res = await fetch(`${BASE_URL}/reports/providers`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getReportMonthly(year) {
    const q = year ? `?year=${year}` : '';
    const res = await fetch(`${BASE_URL}/reports/monthly${q}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getReportTopArticles() {
    const res = await fetch(`${BASE_URL}/reports/top-articles`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getReportPriceIncreases() {
    const res = await fetch(`${BASE_URL}/reports/price-increases`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getReportSavings() {
    const res = await fetch(`${BASE_URL}/reports/savings`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getReportAnnual() {
    const res = await fetch(`${BASE_URL}/reports/annual`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // ─── Users ────────────────────────────────────────────────
  async getUsers() {
    const res = await fetch(`${BASE_URL}/users`, { headers: getHeaders() });
    const body = await handleResponse(res);
    return body.data;
  },
  async createUser(data) {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  async updateUser(id, data) {
    const res = await fetch(`${BASE_URL}/users/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  // ─── Alerts ────────────────────────────────────────────────
  async getAlerts(unread) {
    const q = unread ? '?unread=true' : '';
    const res = await fetch(`${BASE_URL}/alerts${q}`, { headers: getHeaders() });
    const body = await handleResponse(res);
    return body.data;
  },
  async getUnreadAlertCount() {
    const res = await fetch(`${BASE_URL}/alerts/unread-count`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async markAlertRead(id) {
    const res = await fetch(`${BASE_URL}/alerts/${id}/read`, {
      method: 'PATCH', headers: getHeaders()
    });
    return handleResponse(res);
  },
  async markAllAlertsRead() {
    const res = await fetch(`${BASE_URL}/alerts/read-all`, {
      method: 'POST', headers: getHeaders()
    });
    return handleResponse(res);
  },

  async changePassword(id, password) {
    const res = await fetch(`${BASE_URL}/users/${id}/password`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ password })
    });
    return handleResponse(res);
  }
};

// ─── Utilidades de formato ────────────────────────────────────
export function formatARS(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatPct(value) {
  if (value == null || isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

export function statusLabel(status) {
  const map = { pending: 'Pendiente', reviewed: 'Revisado', approved: 'Aprobado', history: 'Historial', new: 'Nuevo' };
  return map[status] || status;
}

export function rolLabel(role) {
  const map = { admin: 'Administrador', purchases: 'Compras', readonly: 'Solo lectura' };
  return map[role] || role;
}

export function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); }
  catch { return {}; }
}
