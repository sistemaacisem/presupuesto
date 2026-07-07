const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db    = require('../config/database');
const auth  = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { compareBudget, compareMultipleBudgets } = require('../services/comparator');
const { generateComparisonPDF } = require('../services/pdf');
const { paginatedResponse, paginationParams } = require('../helpers/pagination');

const router = express.Router();

router.post('/', auth, validate(schemas.createComparison), async (req, res) => {
  const { budget_id, name } = req.validated;
  const result = await compareBudget(budget_id);
  const id = uuidv4();

  await db.prepare(`
    INSERT INTO comparisons (id, name, budget_id, date, total_budget, total_savings, savings_pct, items_overpriced, items_average, items_cheaper, results)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name || `Comparación ${new Date().toLocaleDateString('es-AR')}`,
    budget_id,
    result.date,
    result.totalBudget,
    result.totalSavings,
    result.savingsPct,
    result.itemsOverpriced,
    result.itemsAverage,
    result.itemsCheaper,
    JSON.stringify(result.results)
  );

  await db.prepare("UPDATE budgets SET status='reviewed', updated_at=datetime('now') WHERE id=?").run(budget_id);

  if (result.itemsOverpriced > 0) {
    const alertId = uuidv4();
    const budget = await db.prepare('SELECT number FROM budgets WHERE id = ?').get(budget_id);
    const savings = Math.round(result.totalSavings).toLocaleString('es-AR');
    await db.prepare(`
      INSERT INTO alerts (id, type, title, message, severity, budget_id, comparison_id)
      VALUES (?, 'overpriced', ?, ?, 'warning', ?, ?)
    `).run(
      alertId,
      'Ítems sobrepreciados detectados',
      `${result.itemsOverpriced} artículo(s) por ${savings} ARS por encima del promedio. Presupuesto: ${budget?.number || '—'}.`,
      budget_id, id
    );

  }

  res.status(201).json({ id, ...result });
});

router.get('/', auth, async (req, res) => {
  const { page, limit, offset } = paginationParams(req.query);

  const comparisons = await db.prepare(`
    SELECT c.*, b.number as budget_number, p.name as provider_name
    FROM comparisons c
    LEFT JOIN budgets b ON b.id = c.budget_id
    LEFT JOIN providers p ON p.id = b.provider_id
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const { c: total } = await db.prepare('SELECT COUNT(*) as c FROM comparisons').get();

  res.json(paginatedResponse({
    data: comparisons.map(c => ({ ...c, results: JSON.parse(c.results || '[]') })),
    total, page, limit,
  }));
});

router.get('/:id', auth, async (req, res) => {
  const comp = await db.prepare('SELECT * FROM comparisons WHERE id = ?').get(req.params.id);
  if (!comp) return res.status(404).json({ error: 'Comparación no encontrada' });

  const budget = await db.prepare(`
    SELECT b.*, p.name as provider_name
    FROM budgets b LEFT JOIN providers p ON p.id = b.provider_id
    WHERE b.id = ?
  `).get(comp.budget_id);

  res.json({ ...comp, results: JSON.parse(comp.results || '[]'), budget });
});

router.post('/multi', auth, validate(schemas.createMultiComparison), async (req, res) => {
  res.json(await compareMultipleBudgets(req.validated.budget_ids));
});

router.get('/:id/pdf', auth, async (req, res, next) => {
  try {
    const pdf = await generateComparisonPDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=comparacion-${req.params.id.substring(0,8)}.pdf`);
    res.send(pdf);
  } catch (err) { next(err); }
});

router.delete('/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM comparisons WHERE id = ?').run(req.params.id);
  res.json({ message: 'Comparación eliminada' });
});

module.exports = router;
