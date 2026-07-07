const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { initDB } = require('../config/database');
const db = require('../config/database');

let app, server, base;

function fetchJson(url, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  return fetch(new URL(url, base), {
    method: 'GET',
    ...rest,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  }).then(async r => ({ status: r.status, body: await r.json(), headers: r.headers }));
}

function token(role = 'admin') {
  const creds = role === 'admin'
    ? { email: 'admin@demo.com', password: 'admin123' }
    : role === 'readonly'
    ? { email: 'consulta@demo.com', password: 'consulta123' }
    : { email: 'compras@demo.com', password: 'compras123' };
  return fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(creds)
  }).then(r => r.body.token);
}

describe('Probe: Edge Cases & Security', () => {
  before(async () => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests';
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

  after(() => server?.close());

  // ─── AUTH BYPASS ─────────────────────────────────
  it('rejects requests without token on protected routes', async () => {
    const routes = ['/api/budgets', '/api/providers', '/api/articles', '/api/comparisons', '/api/users', '/api/alerts', '/api/dashboard/stats', '/api/reports/providers', '/api/analytics/dashboard', '/api/predictions/all', '/api/anomalies/check'];
    for (const route of routes) {
      const { status } = await fetchJson(route);
      assert.strictEqual(status, 401, `${route} should return 401 without auth`);
    }
  });

  it('rejects malformed auth header', async () => {
    const { status } = await fetchJson('/api/budgets', { headers: { Authorization: 'Bearer' } });
    assert.strictEqual(status, 401);
  });

  it('rejects expired/malformed token', async () => {
    const { status } = await fetchJson('/api/budgets', { headers: { Authorization: 'Bearer invalid.token.here' } });
    assert.strictEqual(status, 401);
  });

  // ─── ROLE-BASED ACCESS ───────────────────────────
  it('readonly user cannot create providers', async () => {
    const t = await token('readonly');
    const { status } = await fetchJson('/api/providers', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ name: 'Test Provider' })
    });
    assert.strictEqual(status, 403);
  });

  it('purchases user cannot delete providers', async () => {
    const t = await token('purchases');
    const { status } = await fetchJson('/api/providers/nonexistent', {
      method: 'DELETE', headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 403);
  });

  it('readonly user cannot create budgets', async () => {
    const t = await token('readonly');
    const { status } = await fetchJson('/api/budgets', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(status, 403);
  });

  // ─── SQL INJECTION ATTEMPTS ──────────────────────
  it('handles SQL injection in search parameter gracefully', async () => {
    const t = await token();
    const payloads = ["' OR 1=1--", "'; DROP TABLE users;--", "' UNION SELECT * FROM users--", "''; SELECT pg_sleep(5)--"];
    for (const payload of payloads) {
      const { status } = await fetchJson(`/api/search?q=${encodeURIComponent(payload)}`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      assert.ok(status < 500, `SQL injection payload "${payload.slice(0,20)}" should not crash server`);
    }
  });

  it('handles SQL injection in provider search', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/providers?search=" OR 1=1--', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 200);
  });

  // ─── INPUT VALIDATION EDGE CASES ─────────────────
  it('rejects empty provider name', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/providers', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ name: '' })
    });
    assert.strictEqual(status, 400);
  });

  it('rejects extremely long provider name', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/providers', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ name: 'A'.repeat(10000) })
    });
    assert.strictEqual(status, 400);
  });

  it('rejects negative unit_price in budget', async () => {
    const t = await token();
    const provider = db.prepare('SELECT id FROM providers LIMIT 1').get();
    if (!provider) return;
    const { status, body } = await fetchJson('/api/budgets', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ provider_id: provider.id, details: [{ description: 'Test', unit_price: -100 }] })
    });
    assert.strictEqual(status, 400, JSON.stringify(body));
  });

  // ─── NOT FOUND / 404 HANDLING ────────────────────
  it('returns 404 for non-existent provider', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/providers/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  it('returns 404 for non-existent budget', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/budgets/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  it('returns 404 for non-existent article', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/articles/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  it('returns 404 for non-existent comparison', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/comparisons/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  it('returns 404 for non-existent prediction article', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/predictions/article/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  // ─── PDF EDGE CASES ──────────────────────────────
  it('returns 404 for non-existent comparison PDF', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/comparisons/00000000-0000-0000-0000-000000000000/pdf', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  it('returns 404 for non-existent budget PDF', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/budgets/00000000-0000-0000-0000-000000000000/pdf', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 404);
  });

  // ─── REPORTS ENDPOINTS ───────────────────────────
  it('returns reports providers data', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/reports/providers', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 200);
  });

  it('returns reports monthly data', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/reports/monthly', {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 200);
  });

  // ─── ANOMALIES EDGE CASES ────────────────────────
  it('returns empty array for article with no price history anomalies', async () => {
    const t = await token();
    const article = db.prepare('SELECT id FROM articles ORDER BY name LIMIT 1').get();
    if (!article) return;
    const { status, body } = await fetchJson(`/api/anomalies/article/${article.id}?threshold=99`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
  });

  // ─── RESPONSE CONSISTENCY ────────────────────────
  it('all error responses have consistent format', async () => {
    const routes = [
      ['GET', '/api/budgets/00000000-0000-0000-0000-000000000000', null],
      ['POST', '/api/providers', { name: '' }],
      ['GET', '/api/providers/00000000-0000-0000-0000-000000000000', null],
    ];
    for (const [method, route, body] of routes) {
      const t = body !== null ? await token() : null;
      const { body: resBody } = await fetchJson(route, {
        method, headers: { Authorization: t ? `Bearer ${t}` : '' },
        body: body ? JSON.stringify(body) : undefined
      });
      assert.ok(typeof resBody === 'object', `${route} should return JSON`);
    }
  });

  // ─── CONCURRENT REQUESTS ─────────────────────────
  it('handles 10 concurrent requests without error', async () => {
    const t = await token();
    const requests = Array.from({ length: 10 }, () =>
      fetchJson('/api/budgets', { headers: { Authorization: `Bearer ${t}` } })
    );
    const results = await Promise.all(requests);
    for (const r of results) {
      assert.strictEqual(r.status, 200);
    }
  });

  it('handles concurrent search and mutate operations', async () => {
    const t = await token();
    const provider = db.prepare('SELECT id FROM providers LIMIT 1').get();
    if (!provider) return;

    const ops = [
      fetchJson('/api/budgets', { headers: { Authorization: `Bearer ${t}` } }),
      fetchJson(`/api/providers/${provider.id}`, { headers: { Authorization: `Bearer ${t}` } }),
      fetchJson('/api/articles', { headers: { Authorization: `Bearer ${t}` } }),
      fetchJson('/api/search?q=hoja', { headers: { Authorization: `Bearer ${t}` } }),
    ];
    const results = await Promise.all(ops);
    for (const r of results) {
      assert.strictEqual(r.status, 200);
    }
  });

  // ─── PARSER EDGE CASES (integration level) ───────
  it('handles budget upload without file gracefully', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/budgets/upload', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 400);
  });

  // ─── COMPARISON CREATION WITH INVALID BUDGET ─────
  it('returns 404 when comparing non-existent budget', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/comparisons', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ budget_id: '00000000-0000-0000-0000-000000000000' })
    });
    assert.strictEqual(status, 404);
  });

  // ─── PREDICTION WITH 0 MONTHS ────────────────────
  it('handles prediction with 0 months ahead', async () => {
    const t = await token();
    const article = db.prepare(`
      SELECT ph.article_id FROM price_history ph
      GROUP BY ph.article_id HAVING COUNT(*) >= 3 LIMIT 1
    `).get();
    if (!article) return;
    const { status, body } = await fetchJson(`/api/predictions/article/${article.article_id}?months=0`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(typeof body.predictedPrice === 'number');
  });

  // ─── MALFORMED JSON IN REQUEST BODY ───────────────
  it('handles malformed JSON body gracefully', async () => {
    const t = await token();
    const res = await fetch(new URL('/api/providers', base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: 'not-json-at-all'
    });
    assert.strictEqual(res.status, 400);
  });

  // ─── EMPTY ARRAYS AND DEFAULTS ───────────────────
  it('creates budget with empty details array', async () => {
    const t = await token();
    const { status } = await fetchJson('/api/budgets', {
      method: 'POST', headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ details: [] })
    });
    assert.strictEqual(status, 201);
  });
});
