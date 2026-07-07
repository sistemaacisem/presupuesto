const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');
const { predictNextPrice, predictMultipleArticles } = require('../services/predictions');

describe('Prediction Service', () => {
  before(async () => {
    await db.initDB();
  });

  it('predictMultipleArticles returns empty array for missing data', async () => {
    const result = await predictMultipleArticles(0);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  it('predictNextPrice returns null for non-existent article', async () => {
    const result = await predictNextPrice('00000000-0000-0000-0000-000000000000');
    assert.strictEqual(result, null);
  });

  it('predictNextPrice returns prediction for article with enough history', async () => {
    const article = db.prepare(`
      SELECT ph.article_id, a.name
      FROM price_history ph
      JOIN articles a ON a.id = ph.article_id
      GROUP BY ph.article_id
      HAVING COUNT(*) >= 3
      LIMIT 1
    `).get();
    if (!article) return;

    const result = await predictNextPrice(article.article_id);
    assert.ok(result !== null, `Should predict for article ${article.article_id}`);
    assert.strictEqual(result.articleId, article.article_id);
    assert.ok(typeof result.predictedPrice === 'number' && result.predictedPrice > 0);
    assert.ok(typeof result.confidence === 'number');
    assert.ok(result.dataPoints >= 3);
    assert.ok(Array.isArray(result.actual));
    assert.ok(result.actual.length >= 3);
  });

  it('predictMultipleArticles returns predictions limited by count', async () => {
    const result = await predictMultipleArticles(5);
    assert.ok(Array.isArray(result));
    assert.ok(result.length <= 5);
    for (const r of result) {
      assert.ok(r.id);
      assert.ok(r.name);
      assert.ok(typeof r.predictedPrice === 'number' && r.predictedPrice > 0);
    }
  });
});
