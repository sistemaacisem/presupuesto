'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const upload = require('../middleware/upload');
const { paginatedResponse, paginationParams } = require('../helpers/pagination');
const { parseFile } = require('../services/parser');
const { linkArticlesToBudget } = require('../services/intelligence');
const { generateBudgetPDF } = require('../services/pdf');
const jobs = require('../services/jobs');
const { validate, schemas } = require('../middleware/validate');
const audit = require('../services/audit');

const router = express.Router();

// GET /api/budgets
router.get('/', auth, async (req, res) => {
  const { type, status, provider_id, date_from, date_to } = req.query;
  const { page, limit, offset } = paginationParams(req.query);

  let query = `
    SELECT b.*, p.name as provider_name,
           COUNT(bd.id) as item_count
    FROM budgets b
    LEFT JOIN providers p ON p.id = b.provider_id
    LEFT JOIN budget_details bd ON bd.budget_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (type)        { query += ' AND b.type = ?';        params.push(type); }
  if (status)      { query += ' AND b.status = ?';      params.push(status); }
  if (provider_id) { query += ' AND b.provider_id = ?'; params.push(provider_id); }
  if (date_from)   { query += ' AND b.date >= ?';       params.push(date_from); }
  if (date_to)     { query += ' AND b.date <= ?';       params.push(date_to); }

  query += ` GROUP BY b.id, p.name ORDER BY b.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const budgets = await db.prepare(query).all(...params);

  let countQuery = 'SELECT COUNT(*) as c FROM budgets WHERE 1=1';
  const countParams = [];
  if (type)        { countQuery += ' AND type = ?';         countParams.push(type); }
  if (status)      { countQuery += ' AND status = ?';       countParams.push(status); }
  if (provider_id) { countQuery += ' AND provider_id = ?';  countParams.push(provider_id); }
  if (date_from)   { countQuery += ' AND date >= ?';        countParams.push(date_from); }
  if (date_to)     { countQuery += ' AND date <= ?';        countParams.push(date_to); }
  const total = (await db.prepare(countQuery).get(...countParams)).c;

  res.json(paginatedResponse({ data: budgets, total, page, limit }));
});

// GET /api/budgets/:id
router.get('/:id', auth, async (req, res) => {
  const budget = await db.prepare(`
    SELECT b.*, p.name as provider_name, p.cuit as provider_cuit
    FROM budgets b LEFT JOIN providers p ON p.id = b.provider_id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });

  const details = await db.prepare(`
    SELECT bd.*, a.name as article_name, a.category
    FROM budget_details bd
    LEFT JOIN articles a ON a.id = bd.article_id
    WHERE bd.budget_id = ?
  `).all(req.params.id);

  res.json({ budget, details });
});

// POST /api/budgets/upload — sube y parsea archivo
router.post('/upload', auth, roles(['admin', 'purchases']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

  try {
    const { type = 'history', provider_id, number, date, notes } = req.body;

    // Parsear el archivo
    const parsed = await parseFile(req.file.path, req.file.originalname);

    // Buscar o crear proveedor
    let finalProviderId = provider_id || null;
    if (!finalProviderId && parsed.provider) {
      const existing = await db.prepare('SELECT id FROM providers WHERE name LIKE ?').get(`%${parsed.provider}%`);
      if (existing) {
        finalProviderId = existing.id;
      } else {
        finalProviderId = uuidv4();
        await db.prepare('INSERT INTO providers (id, name) VALUES (?, ?)').run(finalProviderId, parsed.provider);
      }
    }

    const budgetId = uuidv4();
    const budgetDate = date || parsed.date || new Date().toISOString().split('T')[0];
    const budgetNumber = number || parsed.number || `PRES-${Date.now()}`;

    // Insertar presupuesto
    await db.prepare(`
      INSERT INTO budgets (id, provider_id, number, date, type, status, file_name, file_path, notes, total_amount)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(
      budgetId, finalProviderId, budgetNumber, budgetDate, type,
      req.file.originalname, req.file.path, notes || '',
      parsed.rows.reduce((s, r) => s + (r.totalPrice || 0), 0)
    );

    // Insertar detalles
    const insertDetail = db.prepare(`
      INSERT INTO budget_details (id, budget_id, raw_description, quantity, unit, unit_price, total_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = db.transaction(async () => {
      for (const row of parsed.rows) {
        if (!row.rawDescription && row.unitPrice === 0) continue;
        await insertDetail.run(uuidv4(), budgetId, row.rawDescription, row.quantity, row.unit, row.unitPrice, row.totalPrice, row.notes || '');
      }
    });
    await insertAll();

    await audit.log('budget', budgetId, 'upload', {
      provider_id: finalProviderId,
      number: budgetNumber,
      file: req.file.originalname,
      rows: parsed.rows.length
    }, req.user?.id, req.user?.name);

    // Vincular artículos automáticamente (asíncrono, no bloquea)
    jobs.enqueue(`link-${budgetId}`, () => linkArticlesToBudget(budgetId));

    const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    const details = await db.prepare('SELECT * FROM budget_details WHERE budget_id = ?').all(budgetId);

    res.status(201).json({
      message: 'Presupuesto cargado exitosamente',
      budget,
      details,
      parsed: { rowsFound: parsed.rows.length }
    });
  } catch (err) {
    console.error('Error al procesar archivo:', err);
    res.status(500).json({ error: err.message || 'Error al procesar el archivo' });
  }
});

// POST /api/budgets (manual)
router.post('/', auth, roles(['admin', 'purchases']), validate(schemas.createBudget), async (req, res) => {
  const { provider_id, number, date, type, notes, details } = req.validated;

  const budgetId = uuidv4();
  const totalAmount = details.reduce((s, d) => s + (d.total_price || d.unit_price * d.quantity || 0), 0);

  await db.prepare(`
    INSERT INTO budgets (id, provider_id, number, date, type, total_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(budgetId, provider_id || null, number || '', date || new Date().toISOString().split('T')[0], type, totalAmount, notes || '');

  const insertDetail = db.prepare(`
    INSERT INTO budget_details (id, budget_id, raw_description, quantity, unit, unit_price, total_price, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await db.transaction(async () => {
    for (const d of details) {
      await insertDetail.run(uuidv4(), budgetId, d.description || '', d.quantity || 1, d.unit || 'u', d.unit_price || 0, d.total_price || 0, d.notes || '');
    }
  })();

  await audit.log('budget', budgetId, 'create', {
    provider_id,
    number,
    type,
    details_count: details.length
  }, req.user?.id, req.user?.name);

  jobs.enqueue(`link-${budgetId}`, () => linkArticlesToBudget(budgetId));

  res.status(201).json(await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId));
});

// POST /api/budgets/bulk-delete
router.post('/bulk-delete', auth, roles(['admin']), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de IDs' });
  }

  const placeholders = ids.map(() => '?').join(',');

  for (const id of ids) {
    await audit.log('budget', id, 'delete', {}, req.user?.id, req.user?.name);
  }

  await db.prepare(`DELETE FROM budgets WHERE id IN (${placeholders})`).run(...ids);

  res.json({ message: `${ids.length} presupuestos eliminados`, count: ids.length });
});

// GET /api/budgets/:id/pdf — Exportar presupuesto a PDF
router.get('/:id/pdf', auth, async (req, res, next) => {
  try {
    const pdf = await generateBudgetPDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=presupuesto-${req.params.id.substring(0,8)}.pdf`);
    res.send(pdf);
  } catch (err) { next(err); }
});

// PATCH /api/budgets/:id/status
router.patch('/:id/status', auth, roles(['admin', 'purchases']), validate(schemas.budgetStatus), async (req, res) => {
  const { status } = req.validated;
  const old = await db.prepare('SELECT status FROM budgets WHERE id = ?').get(req.params.id);
  await db.prepare("UPDATE budgets SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  await audit.log('budget', req.params.id, 'status_change', { from: old?.status, to: status }, req.user?.id, req.user?.name);
  res.json({ message: 'Estado actualizado', status });
});

// DELETE /api/budgets/:id
router.delete('/:id', auth, roles(['admin']), async (req, res) => {
  await audit.log('budget', req.params.id, 'delete', {}, req.user?.id, req.user?.name);
  await db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
  res.json({ message: 'Presupuesto eliminado' });
});

module.exports = router;
