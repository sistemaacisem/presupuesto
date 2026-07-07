const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');
const { compareMultipleBudgets } = require('../services/comparator');

describe('Comparator Service', () => {
  before(async () => {
    await db.initDB();
  });

  describe('compareMultipleBudgets()', () => {
    it('returns empty result for empty array', async () => {
      const result = await compareMultipleBudgets([]);
      assert.deepStrictEqual(result, { budgets: [], matrix: [] });
    });

    it('handles budgets with no matching articles', async () => {
      const result = await compareMultipleBudgets(['00000000-0000-0000-0000-000000000000']);
      assert.deepStrictEqual(result, { budgets: [], matrix: [] });
    });

    it('identifies min and max prices correctly', async () => {
      const rows = db.prepare('SELECT DISTINCT budget_id FROM budget_details WHERE article_id IS NOT NULL LIMIT 2').all();
      if (rows.length < 2) return;
      const ids = rows.map(r => r.budget_id);
      const result = await compareMultipleBudgets(ids);
      assert.ok(result.budgets.length >= 2);
      assert.ok(result.matrix.length > 0);
      for (const entry of result.matrix) {
        if (entry.minPrice !== null && entry.maxPrice !== null) {
          assert.ok(entry.minPrice <= entry.maxPrice,
            `minPrice (${entry.minPrice}) > maxPrice (${entry.maxPrice}) for ${entry.articleName}`);
        }
      }
    });

    it('handles budgets with different quantities of the same article', async () => {
      const row = db.prepare(`
        SELECT bd.article_id, COUNT(DISTINCT bd.budget_id) as cnt
        FROM budget_details bd
        WHERE bd.article_id IS NOT NULL
        GROUP BY bd.article_id
        HAVING cnt >= 2
        LIMIT 1
      `).get();
      if (!row) return;
      const ids = db.prepare('SELECT budget_id FROM budget_details WHERE article_id = ? LIMIT 2')
        .all(row.article_id).map(r => r.budget_id);
      const result = await compareMultipleBudgets(ids);
      const entry = result.matrix.find(m => m.articleId === row.article_id);
      assert.ok(entry, `Article ${row.article_id} should appear in matrix`);
      for (const id of ids) {
        assert.ok(entry.columns[id], `Budget ${id} should have a column`);
        assert.ok(typeof entry.columns[id].quantity === 'number');
      }
    });
  });
});
