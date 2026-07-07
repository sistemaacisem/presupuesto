'use strict';

const db = require('../config/database');

/**
 * Servicio de inteligencia semántica.
 * Detecta artículos similares y normaliza descripciones.
 */

/**
 * Normaliza un texto para comparación (lowercase, sin tildes, sin caracteres especiales).
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokeniza un texto en palabras relevantes (elimina stopwords cortas).
 */
function tokenize(text) {
  const stopwords = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'con', 'para', 'por', 'del', 'los', 'las', 'un', 'una']);
  return normalize(text)
    .split(' ')
    .filter(w => w.length > 1 && !stopwords.has(w));
}

/**
 * Calcula similitud entre dos textos usando coeficiente de Jaccard + bonus por inicio.
 * @returns {number} 0..1
 */
function similarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;

  const intersection = new Set([...ta].filter(x => tb.has(x)));
  const union = new Set([...ta, ...tb]);

  const jaccard = intersection.size / union.size;

  // Bonus si comparten la primera palabra importante
  const firstA = [...ta][0];
  const firstB = [...tb][0];
  const bonus = firstA === firstB ? 0.15 : 0;

  return Math.min(1, jaccard + bonus);
}

/**
 * Busca el artículo existente más similar a una descripción cruda.
 * @param {string} rawDescription
 * @param {number} threshold - Mínimo de similitud (0..1)
 * @returns {Object|null} Artículo más similar o null
 */
async function findSimilarArticle(rawDescription, threshold = 0.35) {
  const articles = await db.prepare('SELECT id, name, aliases FROM articles').all();

  let bestMatch = null;
  let bestScore = 0;

  for (const article of articles) {
    let score = similarity(rawDescription, article.name);

    // También comparar contra aliases
    const aliases = JSON.parse(article.aliases || '[]');
    for (const alias of aliases) {
      const aliasScore = similarity(rawDescription, alias);
      if (aliasScore > score) score = aliasScore;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...article, score };
    }
  }

  return bestScore >= threshold ? bestMatch : null;
}

/**
 * Intenta identificar y vincular artículos en los detalles de un presupuesto.
 * Actualiza budget_details.article_id cuando encuentra coincidencia.
 * @param {string} budgetId
 */
async function linkArticlesToBudget(budgetId) {
  const details = await db.prepare('SELECT * FROM budget_details WHERE budget_id = ?').all(budgetId);
  const allArticles = await db.prepare('SELECT id, name, aliases FROM articles').all();

  const updateDetail = db.prepare('UPDATE budget_details SET article_id = ? WHERE id = ?');
  const insertArticle = db.prepare(`
    INSERT INTO articles (id, name, aliases, created_at, updated_at)
    VALUES (?, ?, '[]', datetime('now'), datetime('now'))
  `);
  const insertPH = db.prepare(`
    INSERT INTO price_history (id, article_id, provider_id, budget_id, budget_detail_id, unit_price, quantity, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
  const { v4: uuidv4 } = require('uuid');

  const linkTransaction = db.transaction(async () => {
    for (const detail of details) {
      if (detail.article_id) continue; // Ya vinculado

      let matchedArticle = await findSimilarArticle(detail.raw_description);

      if (!matchedArticle) {
        // Crear artículo nuevo
        const newId = uuidv4();
        await insertArticle.run(newId, capitalize(detail.raw_description));
        matchedArticle = { id: newId };
      } else {
        // Agregar alias si es diferente al nombre
        const art = await db.prepare('SELECT * FROM articles WHERE id = ?').get(matchedArticle.id);
        const aliases = JSON.parse(art.aliases || '[]');
        const normNew = normalize(detail.raw_description);
        const normName = normalize(art.name);
        if (normNew !== normName && !aliases.some(a => normalize(a) === normNew)) {
          aliases.push(detail.raw_description);
          await db.prepare('UPDATE articles SET aliases = ? WHERE id = ?')
            .run(JSON.stringify(aliases), art.id);
        }
      }

      await updateDetail.run(matchedArticle.id, detail.id);

      // Insertar en historial de precios
      if (detail.unit_price > 0 && budget.provider_id) {
        await insertPH.run(
          uuidv4(),
          matchedArticle.id,
          budget.provider_id,
          budgetId,
          detail.id,
          detail.unit_price,
          detail.quantity || 1,
          budget.date || new Date().toISOString().split('T')[0]
        );
      }
    }
  });

  await linkTransaction();
}

/**
 * Capitaliza la primera letra de cada palabra.
 */
function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase()).trim();
}

module.exports = { findSimilarArticle, linkArticlesToBudget, similarity, normalize };
