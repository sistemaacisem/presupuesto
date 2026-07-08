'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db    = require('../config/database');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const { getArticleStats } = require('../services/comparator');
const { validate, schemas } = require('../middleware/validate');
const audit = require('../services/audit');
const { paginatedResponse, paginationParams } = require('../helpers/pagination');

const router = express.Router();

// GET /api/articles
router.get('/', auth, async (req, res) => {
  const { search, category, favorite } = req.query;
  const { page, limit, offset } = paginationParams(req.query);

  let query = 'SELECT * FROM articles WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR aliases LIKE ? OR category LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (favorite === 'true') { query += ' AND is_favorite = 1'; }

  query += ` ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;

  const articles = await db.prepare(query).all(...params);

  let countQuery = 'SELECT COUNT(*) as c FROM articles WHERE 1=1';
  const countParams = [];
  if (search) {
    countQuery += ' AND (name LIKE ? OR aliases LIKE ? OR category LIKE ?)';
    const s = `%${search}%`;
    countParams.push(s, s, s);
  }
  if (category) { countQuery += ' AND category = ?'; countParams.push(category); }
  if (favorite === 'true') { countQuery += ' AND is_favorite = 1'; }
  const total = (await db.prepare(countQuery).get(...countParams)).c;

  res.json(paginatedResponse({ data: articles, total, page, limit }));
});

// GET /api/articles/categories
router.get('/categories', auth, async (req, res) => {
  const cats = await db.prepare("SELECT DISTINCT category FROM articles WHERE category IS NOT NULL ORDER BY category").all();
  res.json(cats.map(r => r.category));
});

// GET /api/articles/:id
router.get('/:id', auth, async (req, res) => {
  const article = await db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });

  const stats = await getArticleStats(req.params.id);

  const budgetHistory = await db.prepare(`
    SELECT b.id, b.number, b.date, p.name as provider_name,
           bd.unit_price, bd.quantity, bd.unit
    FROM budget_details bd
    JOIN budgets b ON b.id = bd.budget_id
    JOIN providers p ON p.id = b.provider_id
    WHERE bd.article_id = ?
    ORDER BY b.date DESC
    LIMIT 50
  `).all(req.params.id);

  res.json({ article, stats, budgetHistory });
});

// POST /api/articles
router.post('/', auth, roles(['admin', 'purchases']), validate(schemas.createArticle), async (req, res) => {
  const { name, aliases, category, unit, tags, notes } = req.validated;

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO articles (id, name, aliases, category, unit, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, JSON.stringify(aliases || []), category || '', unit || 'unidad', JSON.stringify(tags || []), notes || '');

  await audit.log('article', id, 'create', { name }, req.user?.id, req.user?.name);
  res.status(201).json(await db.prepare('SELECT * FROM articles WHERE id = ?').get(id));
});

// PUT /api/articles/:id
router.put('/:id', auth, roles(['admin', 'purchases']), validate(schemas.updateArticle), async (req, res) => {
  const { name, aliases, category, unit, tags, notes, is_favorite } = req.validated;
  const existing = await db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Artículo no encontrado' });

  await db.prepare(`
    UPDATE articles SET name=?, aliases=?, category=?, unit=?, tags=?, notes=?, is_favorite=?, updated_at=datetime('now')
    WHERE id = ?
  `).run(
    name,
    JSON.stringify(aliases || []),
    category || '',
    unit || 'unidad',
    JSON.stringify(tags || []),
    notes || '',
    is_favorite ? 1 : 0,
    req.params.id
  );

  await audit.log('article', req.params.id, 'update', { name }, req.user?.id, req.user?.name);
  res.json(await db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id));
});

// PATCH /api/articles/:id/favorite
router.patch('/:id/favorite', auth, async (req, res) => {
  const article = await db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });
  const newVal = article.is_favorite ? 0 : 1;
  await db.prepare('UPDATE articles SET is_favorite = ? WHERE id = ?').run(newVal, req.params.id);
  res.json({ is_favorite: !!newVal });
});

// POST /api/articles/bulk-delete
router.post('/bulk-delete', auth, roles(['admin']), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'IDs requeridos' });

  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.prepare(`SELECT id, name FROM articles WHERE id IN (${placeholders})`).all(...ids);
  for (const row of rows) {
    await audit.log('article', row.id, 'delete', { name: row.name }, req.user?.id, req.user?.name);
  }
  await db.prepare(`DELETE FROM articles WHERE id IN (${placeholders})`).run(...ids);
  res.json({ message: `${rows.length} artículo(s) eliminado(s)` });
});

// DELETE /api/articles/:id
router.delete('/:id', auth, roles(['admin']), async (req, res) => {
  const article = await db.prepare('SELECT name FROM articles WHERE id = ?').get(req.params.id);
  await audit.log('article', req.params.id, 'delete', { name: article?.name }, req.user?.id, req.user?.name);
  await db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Artículo eliminado' });
});

module.exports = router;
