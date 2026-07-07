const { describe, it } = require('node:test');
const assert = require('node:assert');
const { schemas } = require('../middleware/validate');

describe('Validation Schemas', () => {
  describe('createBudget', () => {
    it('accepts valid minimal data', () => {
      const result = schemas.createBudget.safeParse({
        provider_id: '550e8400-e29b-41d4-a716-446655440000',
        details: [{ description: 'Hoja A4', quantity: 100, unit: 'un', unit_price: 150 }]
      });
      assert.ok(result.success);
    });

    it('accepts empty details (defaults to [])', () => {
      const result = schemas.createBudget.safeParse({
        provider_id: '550e8400-e29b-41d4-a716-446655440000'
      });
      assert.ok(result.success);
      assert.deepStrictEqual(result.data.details, []);
    });

    it('rejects invalid provider_id (not uuid)', () => {
      const result = schemas.createBudget.safeParse({
        provider_id: 'not-a-uuid'
      });
      assert.ok(!result.success);
    });

    it('rejects negative unit_price in details', () => {
      const result = schemas.createBudget.safeParse({
        provider_id: '550e8400-e29b-41d4-a716-446655440000',
        details: [{ description: 'Test', quantity: 1, unit_price: -10 }]
      });
      assert.ok(!result.success);
    });

    it('rejects invalid type value', () => {
      const result = schemas.createBudget.safeParse({
        provider_id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'invalid'
      });
      assert.ok(!result.success);
    });
  });

  describe('budgetStatus', () => {
    it('accepts valid status values', () => {
      for (const s of ['pending', 'reviewed', 'approved']) {
        assert.ok(schemas.budgetStatus.safeParse({ status: s }).success);
      }
    });

    it('rejects invalid status', () => {
      const result = schemas.budgetStatus.safeParse({ status: 'invalid' });
      assert.ok(!result.success);
    });

    it('rejects empty status', () => {
      const result = schemas.budgetStatus.safeParse({});
      assert.ok(!result.success);
    });
  });

  describe('createProvider', () => {
    it('accepts valid provider', () => {
      const result = schemas.createProvider.safeParse({
        name: 'Proveedor Test',
        cuit: '20-12345678-9',
        email: 'test@test.com'
      });
      assert.ok(result.success);
    });

    it('rejects empty name', () => {
      const result = schemas.createProvider.safeParse({ name: '' });
      assert.ok(!result.success);
    });

    it('accepts missing optional fields (defaults to "")', () => {
      const result = schemas.createProvider.safeParse({ name: 'Test' });
      assert.ok(result.success);
      assert.strictEqual(result.data.cuit, '');
      assert.strictEqual(result.data.email, '');
    });
  });

  describe('createArticle', () => {
    it('accepts valid article', () => {
      const result = schemas.createArticle.safeParse({
        name: 'Hoja A4',
        category: 'Papelería'
      });
      assert.ok(result.success);
    });

    it('rejects empty name', () => {
      const result = schemas.createArticle.safeParse({ name: '' });
      assert.ok(!result.success);
    });

    it('accepts category with defaults', () => {
      const result = schemas.createArticle.safeParse({ name: 'Bolígrafo' });
      assert.ok(result.success);
      assert.strictEqual(result.data.category, '');
    });
  });

  describe('login', () => {
    it('accepts valid credentials', () => {
      const result = schemas.login.safeParse({
        email: 'user@test.com',
        password: 'password123'
      });
      assert.ok(result.success);
    });

    it('rejects invalid email format', () => {
      const result = schemas.login.safeParse({
        email: 'not-email',
        password: 'password123'
      });
      assert.ok(!result.success);
    });

    it('rejects empty password', () => {
      const result = schemas.login.safeParse({
        email: 'user@test.com',
        password: ''
      });
      assert.ok(!result.success);
    });
  });

  describe('createUser', () => {
    it('accepts valid user', () => {
      const result = schemas.createUser.safeParse({
        name: 'Test User',
        email: 'test@test.com',
        password: 'pass123',
        role: 'admin'
      });
      assert.ok(result.success);
    });

    it('rejects invalid role', () => {
      const result = schemas.createUser.safeParse({
        name: 'Test',
        email: 'test@test.com',
        password: 'pass123',
        role: 'superadmin'
      });
      assert.ok(!result.success);
    });

    it('rejects invalid email', () => {
      const result = schemas.createUser.safeParse({
        name: 'Test',
        email: 'bad',
        password: 'pass123',
        role: 'purchases'
      });
      assert.ok(!result.success);
    });
  });

  describe('changePassword', () => {
    it('accepts password >= 6 chars', () => {
      assert.ok(schemas.changePassword.safeParse({ password: '123456' }).success);
    });

    it('rejects password < 6 chars', () => {
      const result = schemas.changePassword.safeParse({ password: '12345' });
      assert.ok(!result.success);
    });
  });
});
