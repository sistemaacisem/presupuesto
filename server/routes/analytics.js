'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const Cache = require('../services/cache');

const cache = new Cache(30); // 30s TTL

// GET /api/analytics/dashboard — Datos consolidados para el dashboard
router.get('/dashboard', auth, async (req, res) => {
  const cached = cache.get('analytics-dashboard');
  if (cached) return res.json(cached);

  const totalBudgetAmount = (await db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM budgets WHERE type = 'history'
  `).get()).total;

  const budgetCount = (await db.prepare(`
    SELECT COUNT(*) as c FROM budgets
  `).get()).c;

  const providerCount = (await db.prepare(`
    SELECT COUNT(*) as c FROM providers WHERE is_active = 1
  `).get()).c;

  const articleCount = (await db.prepare(`
    SELECT COUNT(*) as c FROM articles
  `).get()).c;

  const pendingAlerts = (await db.prepare(`
    SELECT COUNT(*) as c FROM alerts WHERE is_read = 0
  `).get()).c;

  const avgOverpriced = (await db.prepare(`
    SELECT COALESCE(AVG(items_overpriced), 0) as avg FROM comparisons
  `).get()).avg;

  const data = {
    totalBudgetAmount: Math.round(totalBudgetAmount),
    budgetCount,
    providerCount,
    articleCount,
    pendingAlerts,
    avgOverpriced: Math.round(avgOverpriced * 100) / 100,
    recentBudgets: await db.prepare(`
      SELECT b.id, b.number, b.date, b.total_amount, b.status, p.name as provider_name
      FROM budgets b LEFT JOIN providers p ON p.id = b.provider_id
      ORDER BY b.created_at DESC LIMIT 5
    `).all(),
    recentAlerts: await db.prepare(`
      SELECT a.* FROM alerts a ORDER BY a.created_at DESC LIMIT 5
    `).all()
  };

  cache.set('analytics-dashboard', data);
  res.json(data);
});

// GET /api/analytics/spending-by-category
router.get('/spending-by-category', auth, async (req, res) => {
  const cached = cache.get('spending-by-category');
  if (cached) return res.json(cached);
  const rows = await db.prepare(`
    SELECT COALESCE(a.category, 'Sin categoría') as category,
           COUNT(DISTINCT bd.id) as item_count,
           SUM(bd.total_price) as total
    FROM budget_details bd
    JOIN budgets b ON b.id = bd.budget_id AND b.type = 'history'
    LEFT JOIN articles a ON a.id = bd.article_id
    GROUP BY a.category
    ORDER BY total DESC
  `).all();

  const data = rows.map(r => ({ ...r, total: Math.round(r.total) }));
  cache.set('spending-by-category', data);
  res.json(data);
});

// GET /api/analytics/spending-by-provider
router.get('/spending-by-provider', auth, async (req, res) => {
  const cached = cache.get('spending-by-provider');
  if (cached) return res.json(cached);
  const rows = await db.prepare(`
    SELECT p.id, p.name, p.city, p.province,
           COUNT(DISTINCT b.id) as budget_count,
           SUM(b.total_amount) as total_spent,
           ROUND(AVG(b.total_amount), 0) as avg_budget
    FROM budgets b
    JOIN providers p ON p.id = b.provider_id
    WHERE b.type = 'history'
    GROUP BY p.id
    ORDER BY total_spent DESC
    LIMIT 20
  `).all();

  const data = rows.map(r => ({ ...r, total_spent: Math.round(r.total_spent), avg_budget: Math.round(r.avg_budget) }));
  cache.set('spending-by-provider', data);
  res.json(data);
});

// GET /api/analytics/monthly-trend
router.get('/monthly-trend', auth, async (req, res) => {
  const cached = cache.get('monthly-trend');
  if (cached) return res.json(cached);
  const rows = await db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COUNT(*) as budget_count,
           SUM(total_amount) as total,
           ROUND(AVG(total_amount), 0) as avg_budget
    FROM budgets
    WHERE type = 'history' AND date IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
    LIMIT 24
  `).all();

  const data = rows.map(r => ({ ...r, total: Math.round(r.total) }));
  cache.set('monthly-trend', data);
  res.json(data);
});

// GET /api/analytics/top-articles
router.get('/top-articles', auth, async (req, res) => {
  const cached = cache.get('top-articles');
  if (cached) return res.json(cached);
  const rows = await db.prepare(`
    SELECT a.id, a.name, a.category,
           COUNT(DISTINCT bd.id) as purchase_count,
           COUNT(DISTINCT b.id) as budget_count,
           MIN(bd.unit_price) as min_price,
           MAX(bd.unit_price) as max_price,
           ROUND(AVG(bd.unit_price), 0) as avg_price,
           SUM(bd.total_price) as total_spent
    FROM budget_details bd
    JOIN budgets b ON b.id = bd.budget_id AND b.type = 'history'
    JOIN articles a ON a.id = bd.article_id
    GROUP BY a.id
    ORDER BY total_spent DESC
    LIMIT 20
  `).all();

  const data = rows.map(r => ({
    ...r,
    min_price: Math.round(r.min_price),
    max_price: Math.round(r.max_price),
    total_spent: Math.round(r.total_spent)
  }));
  cache.set('top-articles', data);
  res.json(data);
});

// GET /api/analytics/export — Reporte completo en JSON
router.get('/export', auth, async (req, res) => {
  const byCategory = await db.prepare(`
    SELECT COALESCE(a.category, 'Sin categoría') as category, SUM(bd.total_price) as total
    FROM budget_details bd JOIN budgets b ON b.id = bd.budget_id AND b.type = 'history'
    LEFT JOIN articles a ON a.id = bd.article_id GROUP BY a.category ORDER BY total DESC
  `).all();

  const byProvider = await db.prepare(`
    SELECT p.name, COUNT(DISTINCT b.id) as budgets, SUM(b.total_amount) as total
    FROM budgets b JOIN providers p ON p.id = b.provider_id
    WHERE b.type = 'history' GROUP BY p.id ORDER BY total DESC
  `).all();

  const monthly = await db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count, SUM(total_amount) as total
    FROM budgets WHERE type = 'history' AND date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all();

  const summary = await db.prepare(`SELECT COUNT(*) as total_budgets, SUM(total_amount) as grand_total FROM budgets WHERE type = 'history'`).get();
  const avgBudget = (await db.prepare(`SELECT ROUND(AVG(total_amount), 0) as avg FROM budgets WHERE type = 'history'`).get()).avg;

  res.json({
    generatedAt: new Date().toISOString(),
    summary: { totalBudgets: summary.total_budgets, grandTotal: Math.round(summary.grand_total), avgBudget: Math.round(avgBudget) },
    byCategory: byCategory.map(r => ({ ...r, total: Math.round(r.total) })),
    byProvider: byProvider.map(r => ({ ...r, total: Math.round(r.total) })),
    monthlyTrend: monthly.map(r => ({ ...r, total: Math.round(r.total) }))
  });
});

module.exports = router;
