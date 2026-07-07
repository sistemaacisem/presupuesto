const { describe, it, before } = require('node:test');
const assert = require('node:assert');

describe('Auth Middleware', () => {
  let authMiddleware;

  before(() => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests';
    delete require.cache[require.resolve('../middleware/auth')];
    authMiddleware = require('../middleware/auth');
  });

  it('exports a function', () => {
    assert.strictEqual(typeof authMiddleware, 'function');
  });

  it('rejects missing Authorization header', () => {
    const req = { headers: {}, query: {} };
    let statusCode, jsonData;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { jsonData = data; }
    };
    let calledNext = false;
    authMiddleware(req, res, () => { calledNext = true; });

    assert.strictEqual(statusCode, 401);
    assert.ok(jsonData.error);
    assert.strictEqual(calledNext, false);
  });

  it('rejects invalid token format', () => {
    const req = { headers: { authorization: 'InvalidFormat' }, query: {} };
    let statusCode, jsonData;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { jsonData = data; }
    };
    let calledNext = false;
    authMiddleware(req, res, () => { calledNext = true; });

    assert.strictEqual(statusCode, 401);
    assert.ok(jsonData.error);
    assert.strictEqual(calledNext, false);
  });

  it('rejects malformed token', () => {
    const req = { headers: { authorization: 'Bearer not-a-valid-jwt' }, query: {} };
    let statusCode, jsonData;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { jsonData = data; }
    };
    let calledNext = false;
    authMiddleware(req, res, () => { calledNext = true; });

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(calledNext, false);
  });

  it('accepts valid token', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 'test-id', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    let calledNext = false;
    const res = {
      status: () => res,
      json: () => {}
    };
    authMiddleware(req, res, () => { calledNext = true; });

    assert.strictEqual(calledNext, true);
    assert.strictEqual(req.user.id, 'test-id');
    assert.strictEqual(req.user.role, 'admin');
  });

  it('rejects token from query param (removed for security)', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 'query-user', role: 'readonly' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: {}, query: { token } };
    let statusCode, jsonData;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { jsonData = data; }
    };
    let calledNext = false;
    authMiddleware(req, res, () => { calledNext = true; });

    assert.strictEqual(statusCode, 401);
    assert.ok(jsonData.error);
    assert.strictEqual(calledNext, false);
  });

  it('rejects expired token', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 'test' }, process.env.JWT_SECRET, { expiresIn: '0s' });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    let statusCode, jsonData;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { jsonData = data; }
    };
    let calledNext = false;
    authMiddleware(req, res, () => { calledNext = true; });

    assert.strictEqual(statusCode, 401);
    assert.ok(jsonData.error);
    assert.strictEqual(calledNext, false);
  });
});
