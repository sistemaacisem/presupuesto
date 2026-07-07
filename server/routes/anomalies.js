'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const { detectAnomaliesForArticle, checkAllRecentAnomalies, createAlertsForAnomalies } = require('../services/anomalies');

// GET /api/anomalies/article/:id
router.get('/article/:id', auth, async (req, res) => {
  const threshold = parseFloat(req.query.threshold) || 2;
  res.json(await detectAnomaliesForArticle(req.params.id, threshold));
});

// GET /api/anomalies/check — Revisar todos los artículos con actividad reciente
router.get('/check', auth, async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const results = await checkAllRecentAnomalies(days);

  const alertsCreated = await createAlertsForAnomalies(results);

  res.json({
    articlesChecked: results.length,
    anomaliesFound: results.reduce((s, r) => s + r.anomalies.length, 0),
    alertsCreated,
    details: results
  });
});

module.exports = router;
