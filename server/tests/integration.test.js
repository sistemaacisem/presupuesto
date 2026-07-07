const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { initDB } = require('../config/database');

let app;
let server;
let base;

function fetchJson(path, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  return fetch(new URL(path, base), {
    method: 'GET',
    ...rest,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  }).then(async r => ({ status: r.status, body: await r.json() }));
}

function loginToken() {
  return fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' })
  }).then(r => r.body.token);
}

describe('API Integration', () => {
  before(async () => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests';
    process.env.JWT_EXPIRES_IN = '24h';
    process.env.NO_AUTO_START = '1';
    process.env.SQLITE_PATH = ':memory:';
    app = require('../index');
    await initDB();
    const { main: seed } = require('../seeds/demo_data');
    await seed();
    server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    base = `http://localhost:${server.address().port}`;
  });

  after(() => { server?.close(); });

  it('GET /api/health returns 200', async () => {
    const { status, body } = await fetchJson('/api/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.driver, 'sqlite');
    assert.strictEqual(body.dbStatus, 'ok');
    assert.ok(typeof body.budgetCount === 'number');
  });

  it('POST /api/auth/login valid credentials returns token', async () => {
    const { status, body } = await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' })
    });
    assert.strictEqual(status, 200);
    assert.ok(body.token);
    assert.strictEqual(body.user.role, 'admin');
  });

  it('POST /api/auth/login invalid credentials returns 401', async () => {
    const { status } = await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@demo.com', password: 'wrong' })
    });
    assert.strictEqual(status, 401);
  });

  it('GET /api/budgets requires auth', async () => {
    const { status } = await fetchJson('/api/budgets');
    assert.strictEqual(status, 401);
  });

  it('GET /api/budgets with auth returns list', async () => {
    const token = await loginToken();
    const { status, body } = await fetchJson('/api/budgets', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    assert.ok(typeof body.total === 'number');
  });

  it('GET /api/providers returns paginated providers', async () => {
    const token = await loginToken();
    const { status, body } = await fetchJson('/api/providers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(typeof body.total === 'number');
  });

  it('POST /api/comparisons/multi validates budget_ids', async () => {
    const token = await loginToken();
    const { status, body } = await fetchJson('/api/comparisons/multi', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ budget_ids: ['not-a-uuid'] })
    });
    assert.strictEqual(status, 400);
    assert.ok(body.error || body.details);
  });

  it('POST /api/comparisons/multi requires at least 2 ids', async () => {
    const token = await loginToken();
    const { status, body } = await fetchJson('/api/comparisons/multi', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ budget_ids: [] })
    });
    assert.strictEqual(status, 400);
    assert.ok(body.error || body.details);
  });

  it('POST /api/comparisons validates budget_id', async () => {
    const token = await loginToken();
    const { status } = await fetchJson('/api/comparisons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ budget_id: 'bad-uuid' })
    });
    assert.strictEqual(status, 400);
  });

  it('GET /api/alerts returns paginated alerts', async () => {
    const token = await loginToken();
    const { status, body } = await fetchJson('/api/alerts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(typeof body.total === 'number');
    assert.ok(typeof body.page === 'number');
  });

  it('GET /api/users returns paginated users', async () => {
    const token = await loginToken();
    const { status, body } = await fetchJson('/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(typeof body.total === 'number');
    assert.ok(body.data.length > 0);
    assert.ok(body.data.every(u => u.id && u.email));
  });
});
