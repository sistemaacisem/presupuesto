'use strict';

const express = require('express');
const db   = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/providers — Compras por proveedor
router.get('/providers', auth, async (req, res) => {
  const data = await db.prepare(`
    SELECT p.id, p.name, p.city, p.province,
           COUNT(DISTINCT b.id) as budget_count,
           SUM(b.total_amount) as total_spent,
           AVG(b.total_amount) as avg_budget,
           MIN(b.date) as first_date,
           MAX(b.date) as last_date
    FROM providers p
    JOIN budgets b ON b.provider_id = p.id
    GROUP BY p.id
    ORDER BY total_spent DESC
  `).all();
  res.json(data);
});

// GET /api/reports/monthly — Compras por mes
router.get('/monthly', auth, async (req, res) => {
  const { year } = req.query;
  let query = `
    SELECT strftime('%Y-%m', date) as month,
           COUNT(*) as budget_count,
           SUM(total_amount) as total_spent
    FROM budgets
    WHERE date IS NOT NULL
  `;
  const params = [];
  if (year) { query += ` AND strftime('%Y', date) = ?`; params.push(year); }
  query += ` GROUP BY month ORDER BY month ASC`;

  res.json(await db.prepare(query).all(...params));
});

// GET /api/reports/top-articles — Productos más comprados
router.get('/top-articles', auth, async (req, res) => {
  const data = await db.prepare(`
    SELECT a.id, a.name, a.category,
           COUNT(ph.id) as purchase_count,
           SUM(ph.quantity) as total_quantity,
           MIN(ph.unit_price) as min_price,
           MAX(ph.unit_price) as max_price,
           AVG(ph.unit_price) as avg_price,
           MAX(ph.date) as last_date
    FROM price_history ph
    JOIN articles a ON a.id = ph.article_id
    GROUP BY a.id, a.name, a.category
    ORDER BY purchase_count DESC
    LIMIT 30
  `).all();
  res.json(data);
});

// GET /api/reports/price-increases — Productos con mayor aumento
router.get('/price-increases', auth, async (req, res) => {
  const raw = await db.prepare(`
    SELECT * FROM (
      SELECT a.id, a.name, a.category,
             AVG(CASE WHEN ph.date >= date('now', '-6 months') THEN ph.unit_price END) as recent_avg,
             AVG(CASE WHEN ph.date < date('now', '-6 months')  THEN ph.unit_price END) as old_avg
      FROM price_history ph
      JOIN articles a ON a.id = ph.article_id
      GROUP BY a.id, a.name, a.category
    ) sub
    WHERE sub.recent_avg IS NOT NULL AND sub.old_avg IS NOT NULL AND sub.old_avg > 0
    ORDER BY ((sub.recent_avg - sub.old_avg) / sub.old_avg) DESC
    LIMIT 20
  `).all();
  const data = raw.map(r => ({
    ...r,
    recent_avg: Math.round(r.recent_avg),
    old_avg:    Math.round(r.old_avg),
    change_pct: Math.round(((r.recent_avg - r.old_avg) / r.old_avg) * 100)
  }));
  res.json(data);
});

// GET /api/reports/savings — Ahorro acumulado de comparaciones
router.get('/savings', auth, async (req, res) => {
  const data = await db.prepare(`
    SELECT
      SUM(total_savings) as total_savings,
      AVG(savings_pct) as avg_savings_pct,
      COUNT(*) as comparison_count,
      SUM(items_overpriced) as total_overpriced,
      SUM(items_cheaper) as total_cheaper
    FROM comparisons
  `).get();

  const monthly = await db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(total_savings) as savings
    FROM comparisons
    GROUP BY month
    ORDER BY month ASC
  `).all();

  res.json({ summary: data, monthly });
});

// GET /api/reports/annual-comparison — Comparativa anual
router.get('/annual', auth, async (req, res) => {
  const data = await db.prepare(`
    SELECT strftime('%Y', ph.date) as year,
           COUNT(DISTINCT ph.article_id) as articles_count,
           AVG(ph.unit_price) as avg_price,
           COUNT(ph.id) as transactions
    FROM price_history ph
    GROUP BY year
    ORDER BY year ASC
  `).all();
  res.json(data);
});

module.exports = router;
