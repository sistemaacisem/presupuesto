'use strict';

const express = require('express');
const db   = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/search?q=texto&limit=20
router.get('/', auth, async (req, res) => {
  const { q, limit = 20, page = 1 } = req.query;
  if (!q || q.trim().length < 2) return res.json({ articles: [], budgetDetails: [], total: 0 });

  const search = `%${q.trim()}%`;
  const lim = parseInt(limit);
  const off  = (parseInt(page) - 1) * lim;

  // Buscar artículos (nombre + aliases + categoría)
  const articles = await db.prepare(`
    SELECT a.*,
           COUNT(ph.id) as price_count,
           MIN(ph.unit_price) as min_price,
           MAX(ph.unit_price) as max_price,
           AVG(ph.unit_price) as avg_price
    FROM articles a
    LEFT JOIN price_history ph ON ph.article_id = a.id
    WHERE a.name LIKE ? OR a.aliases LIKE ? OR a.category LIKE ?
    GROUP BY a.id
    ORDER BY price_count DESC
    LIMIT ? OFFSET ?
  `).all(search, search, search, lim, off);

  // Buscar en detalles de presupuesto
  const budgetDetails = await db.prepare(`
    SELECT bd.*,
           b.number as budget_number, b.date as budget_date,
           p.name as provider_name, p.city as provider_city,
           a.name as article_name
    FROM budget_details bd
    JOIN budgets b ON b.id = bd.budget_id
    LEFT JOIN providers p ON p.id = b.provider_id
    LEFT JOIN articles a ON a.id = bd.article_id
    WHERE bd.raw_description LIKE ? OR a.name LIKE ?
    ORDER BY b.date DESC
    LIMIT ? OFFSET ?
  `).all(search, search, lim, off);

  // Guardar en historial
  const { v4: uuidv4 } = require('uuid');
  try {
    await db.prepare('INSERT INTO search_history (id, query, results_count) VALUES (?, ?, ?)').run(
      uuidv4(), q.trim(), articles.length + budgetDetails.length
    );
  } catch {}

  res.json({
    articles: articles.map(a => ({ ...a, aliases: JSON.parse(a.aliases || '[]') })),
    budgetDetails,
    total: articles.length + budgetDetails.length,
    query: q.trim()
  });
});

// GET /api/search/history
router.get('/history', auth, async (req, res) => {
  const history = await db.prepare(`
    SELECT query, MAX(created_at) as last_used, SUM(results_count) as total_results, COUNT(*) as search_count
    FROM search_history
    GROUP BY query
    ORDER BY last_used DESC
    LIMIT 20
  `).all();
  res.json(history);
});

module.exports = router;
