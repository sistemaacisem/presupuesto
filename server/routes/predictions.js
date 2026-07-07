'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { predictNextPrice, predictMultipleArticles } = require('../services/predictions');

// GET /api/predictions/article/:id
router.get('/article/:id', auth, async (req, res) => {
  const months = parseInt(req.query.months) || 3;
  const result = await predictNextPrice(req.params.id, months);
  if (!result) return res.status(404).json({ error: 'No hay suficientes datos históricos para predecir' });
  res.json(result);
});

// GET /api/predictions/all
router.get('/all', auth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(await predictMultipleArticles(limit));
});

module.exports = router;
