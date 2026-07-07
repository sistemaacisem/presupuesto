'use strict';

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function detectAnomaliesForArticle(articleId, zThreshold = 2) {
  const prices = await db.prepare(`
    SELECT ph.unit_price, ph.date, ph.budget_id, ph.provider_id,
           b.number as budget_number, p.name as provider_name
    FROM price_history ph
    LEFT JOIN budgets b ON b.id = ph.budget_id
    LEFT JOIN providers p ON p.id = ph.provider_id
    WHERE ph.article_id = ?
    ORDER BY ph.date ASC
  `).all(articleId);

  if (!prices || prices.length < 5) return [];

  const mean = prices.reduce((s, p) => s + p.unit_price, 0) / prices.length;
  const std = Math.sqrt(prices.reduce((s, p) => s + (p.unit_price - mean) ** 2, 0) / prices.length);

  if (std === 0) return [];

  return prices.map(p => {
    const zScore = (p.unit_price - mean) / std;
    return {
      articleId,
      providerId: p.provider_id,
      providerName: p.provider_name,
      budgetId: p.budget_id,
      budgetNumber: p.budget_number,
      date: p.date,
      unitPrice: Math.round(p.unit_price),
      meanPrice: Math.round(mean),
      stdDev: Math.round(std),
      zScore: Math.round(zScore * 100) / 100,
      isAnomaly: Math.abs(zScore) > zThreshold,
      type: zScore > zThreshold ? 'overpriced' : zScore < -zThreshold ? 'underpriced' : 'normal'
    };
  }).filter(p => p.isAnomaly);
}

async function checkAllRecentAnomalies(daysBack = 90) {
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];
  const articles = await db.prepare(`
    SELECT DISTINCT ph.article_id, a.name as article_name
    FROM price_history ph
    JOIN articles a ON a.id = ph.article_id
    WHERE ph.date >= ?
  `).all(cutoff);

  const results = [];
  for (const art of articles) {
    const anomalies = await detectAnomaliesForArticle(art.article_id);
    if (anomalies.length) {
      results.push({ articleId: art.article_id, articleName: art.article_name, anomalies });
    }
  }
  return results;
}

async function createAlertsForAnomalies(anomalies) {
  let count = 0;
  for (const item of anomalies) {
    for (const a of item.anomalies) {
      await db.prepare(`
        INSERT INTO alerts (id, type, title, message, severity, budget_id, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(
        uuidv4(),
        a.type === 'overpriced' ? 'overpriced' : 'underpriced',
        `Anomalía detectada: ${item.articleName}`,
        `${item.articleName}: $${a.unitPrice} vs promedio $${a.meanPrice} (z-score: ${a.zScore})`,
        a.type === 'overpriced' ? 'warning' : 'info',
        a.budgetId
      );
      count++;
    }
  }
  return count;
}

module.exports = { detectAnomaliesForArticle, checkAllRecentAnomalies, createAlertsForAnomalies };
