'use strict';

const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const Cache = require('../services/cache');

const router = express.Router();
const cache = new Cache(30); // 30s TTL

async function computeStats() {
  const totalBudgets   = (await db.prepare("SELECT COUNT(*) as c FROM budgets").get()).c;
  const totalProviders = (await db.prepare("SELECT COUNT(*) as c FROM providers WHERE is_active = 1").get()).c;
  const totalArticles  = (await db.prepare("SELECT COUNT(*) as c FROM articles").get()).c;
  const pendingBudgets = (await db.prepare("SELECT COUNT(*) as c FROM budgets WHERE status = 'pending'").get()).c;

  const lastUpdate = (await db.prepare("SELECT MAX(created_at) as d FROM budgets").get()).d;

  const savingsRow = await db.prepare(`
    SELECT COALESCE(SUM(total_savings), 0) as total
    FROM comparisons
    WHERE date >= date('now', '-30 days')
  `).get();

  const topIncreases = (await db.prepare(`
    SELECT * FROM (
      SELECT a.id, a.name,
             AVG(CASE WHEN ph.date >= date('now', '-6 months') THEN ph.unit_price END) as recent_avg,
             AVG(CASE WHEN ph.date < date('now', '-6 months')  THEN ph.unit_price END) as old_avg
      FROM price_history ph
      JOIN articles a ON a.id = ph.article_id
      GROUP BY a.id, a.name
    ) sub
    WHERE recent_avg IS NOT NULL AND old_avg IS NOT NULL AND old_avg > 0
    ORDER BY ((recent_avg - old_avg) / old_avg) DESC
    LIMIT 5
  `).all()).map(r => ({
    name: r.name,
    recentAvg: Math.round(r.recent_avg),
    oldAvg:    Math.round(r.old_avg),
    changePct: Math.round(((r.recent_avg - r.old_avg) / r.old_avg) * 100)
  }));

  const recentBudgets = await db.prepare(`
    SELECT b.id, b.number, b.date, b.type, b.status, b.total_amount, p.name as provider_name
    FROM budgets b
    LEFT JOIN providers p ON p.id = b.provider_id
    ORDER BY b.created_at DESC
    LIMIT 5
  `).all();

  const budgetsByMonth = await db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count, SUM(total_amount) as total
    FROM budgets
    WHERE date >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
  `).all();

  const topProviders = await db.prepare(`
    SELECT p.name, COUNT(b.id) as budget_count, SUM(b.total_amount) as total_amount
    FROM providers p
    JOIN budgets b ON b.provider_id = p.id
    GROUP BY p.id
    ORDER BY total_amount DESC
    LIMIT 5
  `).all();

  return {
    totals: { budgets: totalBudgets, providers: totalProviders, articles: totalArticles, pending: pendingBudgets },
    lastUpdate,
    potentialSavings: Math.round(savingsRow.total),
    topIncreases,
    recentBudgets,
    budgetsByMonth,
    topProviders
  };
}

// GET /api/dashboard/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const cached = cache.get('dashboard-stats');
    if (cached) return res.json(cached);

    const data = await computeStats();
    cache.set('dashboard-stats', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
