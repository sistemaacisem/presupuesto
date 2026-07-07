'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db    = require('../config/database');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validate');
const audit = require('../services/audit');
const { paginatedResponse, paginationParams } = require('../helpers/pagination');

const router = express.Router();

// GET /api/users
router.get('/', auth, roles(['admin']), async (req, res) => {
  const { page, limit, offset } = paginationParams(req.query);

  const users = await db.prepare(`SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name ASC LIMIT ? OFFSET ?`).all(limit, offset);
  const { c: total } = await db.prepare('SELECT COUNT(*) as c FROM users').get();

  res.json(paginatedResponse({ data: users, total, page, limit }));
});

// POST /api/users
router.post('/', auth, roles(['admin']), validate(schemas.createUser), async (req, res) => {
  const { name, email, password, role } = req.validated;

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)').run(id, name, email.toLowerCase(), hash, role);
  await audit.log('user', id, 'create', { name, email, role }, req.user?.id, req.user?.name);
  res.status(201).json({ id, name, email, role });
});

// PUT /api/users/:id
router.put('/:id', auth, roles(['admin']), validate(schemas.updateUser), async (req, res) => {
  const { name, email, role, is_active } = req.validated;
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  await db.prepare(`UPDATE users SET name=?, email=?, role=?, is_active=?, updated_at=datetime('now') WHERE id=?`)
    .run(name, email?.toLowerCase(), role, is_active ? 1 : 0, req.params.id);

  res.json(await db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(req.params.id));
});

// PATCH /api/users/:id/password
router.patch('/:id/password', auth, roles(['admin']), validate(schemas.changePassword), async (req, res) => {
  const { password } = req.validated;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare("UPDATE users SET password=?, updated_at=datetime('now') WHERE id=?").run(hash, req.params.id);
  res.json({ message: 'Contraseña actualizada' });
});

module.exports = router;
