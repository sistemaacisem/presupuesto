'use strict';

const db = require('../config/database');

async function predictNextPrice(articleId, monthsAhead = 3) {
  const history = await db.prepare(`
    SELECT ph.unit_price, ph.date
    FROM price_history ph
    WHERE ph.article_id = ?
    ORDER BY ph.date ASC
  `).all(articleId);

  if (!history || history.length < 3) return null;

  // Convertir fechas a días desde primera fecha
  const base = new Date(history[0].date).getTime();
  const points = history.map(p => ({
    x: (new Date(p.date).getTime() - base) / (1000 * 60 * 60 * 24),
    y: p.unit_price
  }));

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calcular R² (bondad de ajuste)
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Predecir X días en el futuro
  const lastDate = new Date(history[history.length - 1].date);
  const futureDate = new Date(lastDate);
  futureDate.setMonth(futureDate.getMonth() + monthsAhead);
  const futureX = (futureDate.getTime() - base) / (1000 * 60 * 60 * 24);
  const predictedPrice = Math.max(0, slope * futureX + intercept);

  // Último precio real
  const lastPrice = history[history.length - 1].unit_price;
  const variationPct = lastPrice > 0 ? ((predictedPrice - lastPrice) / lastPrice) * 100 : 0;

  // Precios reales para el chart
  const actual = points.map(p => ({
    days: Math.round(p.x),
    date: new Date(base + p.x * 86400000).toISOString().slice(0, 10),
    price: Math.round(p.y)
  }));

  return {
    articleId,
    currentPrice: Math.round(lastPrice),
    predictedPrice: Math.round(predictedPrice),
    variationPct: Math.round(variationPct * 10) / 10,
    confidence: Math.round(r2 * 100),
    monthsAhead,
    dataPoints: n,
    slope: Math.round(slope * 100) / 100,
    actual
  };
}

async function predictMultipleArticles(limit = 10) {
  const articles = await db.prepare(`
    SELECT a.id, a.name, a.category
    FROM articles a
    WHERE a.id IN (SELECT DISTINCT article_id FROM price_history WHERE article_id IS NOT NULL)
    ORDER BY a.name LIMIT ?
  `).all(limit);

  return (await Promise.all(articles.map(async a => {
    const pred = await predictNextPrice(a.id);
    return pred ? { id: a.id, name: a.name, category: a.category, ...pred } : null;
  }))).filter(Boolean);
}

module.exports = { predictNextPrice, predictMultipleArticles };
