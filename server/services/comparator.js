'use strict';

const db = require('../config/database');

/**
 * Motor de comparación de precios.
 * Compara los ítems de un presupuesto nuevo contra el historial de precios.
 */

/**
 * Compara un presupuesto nuevo contra el historial.
 * @param {string} budgetId - ID del presupuesto nuevo
 * @returns {Object} Resultado de la comparación
 */
async function compareBudget(budgetId) {
  const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
  if (!budget) throw Object.assign(new Error('Presupuesto no encontrado'), { status: 404 });

  const details = await db.prepare(`
    SELECT bd.*, a.name as article_name, a.unit as article_unit
    FROM budget_details bd
    LEFT JOIN articles a ON a.id = bd.article_id
    WHERE bd.budget_id = ?
  `).all(budgetId);

  const results = [];
  let totalSavings = 0;
  let itemsOverpriced = 0;
  let itemsAverage = 0;
  let itemsCheaper = 0;

  for (const detail of details) {
    if (!detail.article_id) {
      results.push({ ...detail, status: 'unknown', comparison: null });
      continue;
    }

    // Obtener historial de precios para este artículo (excluyendo el presupuesto actual)
    const history = await db.prepare(`
      SELECT ph.unit_price, ph.date, p.name as provider_name, b.id as budget_id
      FROM price_history ph
      JOIN providers p ON p.id = ph.provider_id
      JOIN budgets b ON b.id = ph.budget_id
      WHERE ph.article_id = ? AND ph.budget_id != ?
      ORDER BY ph.date DESC
    `).all(detail.article_id, budgetId);

    if (!history.length) {
      results.push({ ...detail, status: 'no_history', comparison: null });
      continue;
    }

    const prices = history.map(h => h.unit_price).filter(p => p > 0);
    if (!prices.length) continue;

    const minPrice  = Math.min(...prices);
    const maxPrice  = Math.max(...prices);
    const avgPrice  = prices.reduce((s, p) => s + p, 0) / prices.length;
    const currentPrice = detail.unit_price;

    // Determinar proveedor más barato y más caro
    const cheapestEntry = history.reduce((a, b) => a.unit_price < b.unit_price ? a : b);
    const mostExpEntry  = history.reduce((a, b) => a.unit_price > b.unit_price ? a : b);

    const diffPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

    // Clasificar: rojo > 10% sobre promedio, verde < -5%, amarillo: dentro del promedio
    let status;
    if (diffPct > 10) {
      status = 'overpriced';
      itemsOverpriced++;
    } else if (diffPct < -5) {
      status = 'cheaper';
      itemsCheaper++;
    } else {
      status = 'average';
      itemsAverage++;
    }

    const potentialSaving = Math.max(0, (currentPrice - minPrice) * detail.quantity);
    totalSavings += potentialSaving;

    results.push({
      ...detail,
      status,
      comparison: {
        minPrice,
        maxPrice,
        avgPrice,
        currentPrice,
        diffPct: Math.round(diffPct * 100) / 100,
        potentialSaving,
        cheapestProvider: cheapestEntry.provider_name,
        cheapestPrice: cheapestEntry.unit_price,
        mostExpensiveProvider: mostExpEntry.provider_name,
        historyCount: history.length
      }
    });
  }

  const totalBudget = details.reduce((s, d) => s + (d.total_price || 0), 0);
  const savingsPct  = totalBudget > 0 ? (totalSavings / totalBudget) * 100 : 0;

  return {
    budgetId,
    date: new Date().toISOString().split('T')[0],
    totalBudget,
    totalSavings,
    savingsPct: Math.round(savingsPct * 100) / 100,
    itemsOverpriced,
    itemsAverage,
    itemsCheaper,
    results
  };
}

/**
 * Estadísticas rápidas de un artículo.
 */
async function getArticleStats(articleId) {
  const history = await db.prepare(`
    SELECT ph.unit_price, ph.date, p.name as provider_name, p.id as provider_id
    FROM price_history ph
    JOIN providers p ON p.id = ph.provider_id
    WHERE ph.article_id = ?
    ORDER BY ph.date ASC
  `).all(articleId);

  if (!history.length) return null;

  const prices = history.map(h => h.unit_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;

  // Variación anual: comparar últimos 12 meses vs los 12 anteriores
  const now = new Date();
  const oneYearAgo = new Date(now); oneYearAgo.setFullYear(now.getFullYear() - 1);
  const twoYearsAgo = new Date(now); twoYearsAgo.setFullYear(now.getFullYear() - 2);

  const lastYear = history.filter(h => new Date(h.date) >= oneYearAgo);
  const prevYear = history.filter(h => new Date(h.date) >= twoYearsAgo && new Date(h.date) < oneYearAgo);

  let annualVariation = null;
  if (lastYear.length && prevYear.length) {
    const lastAvg = lastYear.reduce((s, h) => s + h.unit_price, 0) / lastYear.length;
    const prevAvg = prevYear.reduce((s, h) => s + h.unit_price, 0) / prevYear.length;
    annualVariation = ((lastAvg - prevAvg) / prevAvg) * 100;
  }

  // Proveedor más barato (promedio)
  const byProvider = {};
  for (const h of history) {
    if (!byProvider[h.provider_id]) byProvider[h.provider_id] = { name: h.provider_name, prices: [] };
    byProvider[h.provider_id].prices.push(h.unit_price);
  }
  const providerAvgs = Object.entries(byProvider).map(([id, data]) => ({
    id, name: data.name,
    avg: data.prices.reduce((s, p) => s + p, 0) / data.prices.length
  }));
  const recommendedProvider = providerAvgs.sort((a, b) => a.avg - b.avg)[0];

  const lastPurchase = history[history.length - 1];

  return {
    minPrice,
    maxPrice,
    avgPrice: Math.round(avgPrice),
    annualVariation: annualVariation ? Math.round(annualVariation * 10) / 10 : null,
    recommendedProvider: recommendedProvider?.name,
    lastPurchase: lastPurchase ? { date: lastPurchase.date, price: lastPurchase.unit_price, provider: lastPurchase.provider_name } : null,
    historyByDate: history,
    providerComparison: providerAvgs
  };
}

/**
 * Compara múltiples presupuestos lado a lado por artículo.
 * @param {string[]} budgetIds
 * @returns {Object}
 */
async function compareMultipleBudgets(budgetIds) {
  const budgets = (await Promise.all(budgetIds.map(async id => {
    const b = await db.prepare(`
      SELECT b.id, b.number, b.date, b.total_amount, p.name as provider_name
      FROM budgets b LEFT JOIN providers p ON p.id = b.provider_id
      WHERE b.id = ?
    `).get(id);
    if (!b) return null;

    const details = await db.prepare(`
      SELECT bd.*, a.name as article_name, a.category
      FROM budget_details bd
      LEFT JOIN articles a ON a.id = bd.article_id
      WHERE bd.budget_id = ?
    `).all(id);

    return { ...b, details };
  }))).filter(Boolean);

  if (!budgets.length) return { budgets: [], matrix: [] };

  // Agrupar detalles por article_id
  const articleMap = {};
  for (const b of budgets) {
    for (const d of b.details) {
      const key = d.article_id || d.raw_description;
      if (!key) continue;
      if (!articleMap[key]) {
        articleMap[key] = {
          articleId: d.article_id,
          articleName: d.article_name || d.raw_description,
          category: d.category,
          prices: {}
        };
      }
      articleMap[key].prices[b.id] = {
        unitPrice: d.unit_price,
        quantity: d.quantity,
        totalPrice: d.total_price,
        unit: d.unit
      };
    }
  }

  const matrix = Object.entries(articleMap).map(([key, art]) => {
    const prices = Object.values(art.prices).map(p => p.unitPrice).filter(p => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    const cols = {};
    for (const b of budgets) {
      const p = art.prices[b.id];
      if (p) {
        cols[b.id] = {
          ...p,
          isMin: minPrice !== null && p.unitPrice === minPrice,
          isMax: maxPrice !== null && p.unitPrice === maxPrice
        };
      } else {
        cols[b.id] = null;
      }
    }

    return {
      articleKey: key,
      articleId: art.articleId,
      articleName: art.articleName,
      category: art.category,
      minPrice,
      maxPrice,
      columns: cols
    };
  });

  return { budgets, matrix };
}

module.exports = { compareBudget, getArticleStats, compareMultipleBudgets };
