'use strict';

const { getMetrics } = require('../services/monitor');

async function handler(req, res) {
  const metrics = getMetrics();
  res.json(metrics);
}

module.exports = { handler };
