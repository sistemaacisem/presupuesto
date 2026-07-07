'use strict';

const express = require('express');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { paginatedResponse, paginationParams } = require('../helpers/pagination');

const router = express.Router();

// GET /api/alerts
router.get('/', auth, async (req, res) => {
  const { unread } = req.query;
  const { page, limit, offset } = paginationParams(req.query);

  let query = 'SELECT * FROM alerts';
  let countQuery = 'SELECT COUNT(*) as c FROM alerts';
  const params = [];

  if (unread === 'true') {
    query += ' WHERE is_read = 0';
    countQuery += ' WHERE is_read = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const alerts = await db.prepare(query).all(...params);
  const { c: total } = await db.prepare(countQuery).get();

  res.json(paginatedResponse({ data: alerts, total, page, limit }));
});

// GET /api/alerts/unread-count
router.get('/unread-count', auth, async (req, res) => {
  const { c } = await db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get();
  res.json({ count: c });
});

// PATCH /api/alerts/:id/read
router.patch('/:id/read', auth, async (req, res) => {
  await db.prepare("UPDATE alerts SET is_read = 1 WHERE id = ?").run(req.params.id);
  res.json({ message: 'Alerta marcada como leída' });
});

// POST /api/alerts/read-all
router.post('/read-all', auth, async (req, res) => {
  await db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
  res.json({ message: 'Todas las alertas marcadas como leídas' });
});

module.exports = router;
