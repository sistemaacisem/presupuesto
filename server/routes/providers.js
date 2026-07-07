'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validate');
const audit = require('../services/audit');
const { paginatedResponse, paginationParams } = require('../helpers/pagination');

const router = express.Router();

// GET /api/providers
router.get('/', auth, async (req, res) => {
  const { search, province } = req.query;
  const { page, limit, offset } = paginationParams(req.query);

  let query = 'SELECT * FROM providers WHERE is_active = 1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR cuit LIKE ? OR city LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (province) {
    query += ' AND province = ?';
    params.push(province);
  }
  query += ` ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;

  const providers = await db.prepare(query).all(...params);

  const enriched = await Promise.all(providers.map(async p => {
    const stats = await db.prepare(`
      SELECT COUNT(DISTINCT b.id) as budget_count, SUM(b.total_amount) as total_spent,
             AVG(bd.unit_price) as avg_price
      FROM budgets b
      LEFT JOIN budget_details bd ON bd.budget_id = b.id
      WHERE b.provider_id = ?
    `).get(p.id);
    return { ...p, stats };
  }));

  let countQuery = "SELECT COUNT(*) as c FROM providers WHERE is_active = 1";
  const countParams = [];
  if (search) {
    countQuery += ' AND (name LIKE ? OR cuit LIKE ? OR city LIKE ?)';
    const s = `%${search}%`;
    countParams.push(s, s, s);
  }
  if (province) { countQuery += ' AND province = ?'; countParams.push(province); }
  const total = (await db.prepare(countQuery).get(...countParams)).c;

  res.json(paginatedResponse({ data: enriched, total, page, limit }));
});

// GET /api/providers/:id
router.get('/:id', auth, async (req, res) => {
  const provider = await db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const budgets = await db.prepare(`
    SELECT b.*, COUNT(bd.id) as item_count
    FROM budgets b
    LEFT JOIN budget_details bd ON bd.budget_id = b.id
    WHERE b.provider_id = ?
    GROUP BY b.id
    ORDER BY b.date DESC
  `).all(req.params.id);

  const articles = await db.prepare(`
    SELECT DISTINCT a.id, a.name, a.category,
           COUNT(ph.id) as purchase_count,
           MIN(ph.unit_price) as min_price,
           MAX(ph.unit_price) as max_price,
           AVG(ph.unit_price) as avg_price
    FROM price_history ph
    JOIN articles a ON a.id = ph.article_id
    WHERE ph.provider_id = ?
    GROUP BY a.id
    ORDER BY purchase_count DESC
  `).all(req.params.id);

  res.json({ provider, budgets, articles });
});

// POST /api/providers
router.post('/', auth, roles(['admin', 'purchases']), validate(schemas.createProvider), async (req, res) => {
  const { name, cuit, address, phone, email, city, province, notes } = req.validated;

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO providers (id, name, cuit, address, phone, email, city, province, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, cuit || '', address || '', phone || '', email || '', city || '', province || '', notes || '');

  await audit.log('provider', id, 'create', { name }, req.user?.id, req.user?.name);
  res.status(201).json(await db.prepare('SELECT * FROM providers WHERE id = ?').get(id));
});

// GET /api/providers/:id/evolution — Evolución de precios por artículo
router.get('/:id/evolution', auth, async (req, res) => {
  const rows = await db.prepare(`
    SELECT bd.article_id, a.name as article_name, a.category,
           bd.unit_price, bd.quantity, bd.total_price,
           b.id as budget_id, b.number as budget_number, b.date as budget_date
    FROM budget_details bd
    JOIN budgets b ON b.id = bd.budget_id
    LEFT JOIN articles a ON a.id = bd.article_id
    WHERE b.provider_id = ? AND bd.article_id IS NOT NULL
    ORDER BY bd.article_id, b.date ASC
  `).all(req.params.id);

  // Agrupar por artículo
  const articles = {};
  for (const r of rows) {
    if (!articles[r.article_id]) {
      articles[r.article_id] = { id: r.article_id, name: r.article_name, category: r.category, prices: [] };
    }
    articles[r.article_id].prices.push({
      date: r.budget_date,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      quantity: r.quantity,
      budgetId: r.budget_id,
      budgetNumber: r.budget_number
    });
  }

  res.json(Object.values(articles));
});

// PUT /api/providers/:id
router.put('/:id', auth, roles(['admin', 'purchases']), validate(schemas.updateProvider), async (req, res) => {
  const { name, cuit, address, phone, email, city, province, notes } = req.validated;
  const existing = await db.prepare('SELECT id FROM providers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });

  await db.prepare(`
    UPDATE providers SET name=?, cuit=?, address=?, phone=?, email=?, city=?, province=?, notes=?, updated_at=datetime('now')
    WHERE id = ?
  `).run(name, cuit || '', address || '', phone || '', email || '', city || '', province || '', notes || '', req.params.id);

  await audit.log('provider', req.params.id, 'update', { name }, req.user?.id, req.user?.name);
  res.json(await db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id));
});

// DELETE /api/providers/:id
router.delete('/:id', auth, roles(['admin']), async (req, res) => {
  const old = await db.prepare('SELECT name FROM providers WHERE id = ?').get(req.params.id);
  await audit.log('provider', req.params.id, 'delete', { name: old?.name }, req.user?.id, req.user?.name);
  await db.prepare("UPDATE providers SET is_active = 0 WHERE id = ?").run(req.params.id);
  res.json({ message: 'Proveedor eliminado' });
});

module.exports = router;
