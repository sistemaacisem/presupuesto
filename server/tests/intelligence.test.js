const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');

describe('Intelligence Service', () => {
  let normalize, similarity, findSimilarArticle;

  before(async () => {
    await db.initDB();
    const mod = require('../services/intelligence');
    normalize = mod.normalize;
    similarity = mod.similarity;
    findSimilarArticle = mod.findSimilarArticle;
  });

  describe('normalize()', () => {
    it('lowercases and trims', () => {
      assert.strictEqual(normalize('  Hola Mundo  '), 'hola mundo');
    });
    it('removes accents', () => {
      assert.strictEqual(normalize('ación estación'), 'acion estacion');
    });
    it('removes special characters', () => {
      assert.strictEqual(normalize('silla@escritorio!'), 'silla escritorio');
    });
    it('collapses multiple spaces', () => {
      assert.strictEqual(normalize('hoja   A4    papel'), 'hoja a4 papel');
    });
    it('handles empty string', () => {
      assert.strictEqual(normalize(''), '');
      assert.strictEqual(normalize('   '), '');
    });
  });

  describe('similarity()', () => {
    it('returns 1 for identical strings', () => {
      assert.strictEqual(similarity('hoja a4', 'hoja a4'), 1);
    });
    it('returns 0 for completely different strings', () => {
      assert.strictEqual(similarity('hoja a4', 'computadora'), 0);
    });
    it('is symmetric', () => {
      const a = similarity('resma papel', 'papel resma');
      const b = similarity('papel resma', 'resma papel');
      assert.strictEqual(a, b);
    });
    it('gives bonus for matching first word', () => {
      const high = similarity('hoja a4', 'hoja carta');
      const low = similarity('hoja a4', 'carta hoja');
      assert.ok(high > low, 'same first word should score higher');
    });
    it('handles single-word inputs', () => {
      assert.strictEqual(similarity('mesa', 'mesa'), 1);
    });
  });

  describe('findSimilarArticle()', () => {
    it('returns null for empty input', async () => {
      const result = await findSimilarArticle('');
      assert.strictEqual(result, null);
    });

    it('finds a match for a known article name', async () => {
      const article = db.prepare('SELECT id, name FROM articles LIMIT 1').get();
      if (!article) return;
      const result = await findSimilarArticle(article.name);
      assert.ok(result !== null, `Should match "${article.name}"`);
      assert.strictEqual(result.id, article.id);
    });

    it('returns null for a nonsensical input with high threshold', async () => {
      const result = await findSimilarArticle('xyzzy_nonexistent_99999', 0.99);
      assert.strictEqual(result, null);
    });
  });
});
