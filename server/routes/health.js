const { driver } = require('../config/db');

async function getStatus() {
  const db = require('../config/database');
  const status = {
    status: 'ok',
    driver,
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    dbStatus: 'ok'
  };
  try {
    const count = await db.prepare('SELECT COUNT(*) as c FROM budgets').get();
    status.budgetCount = count.c;
  } catch (e) {
    status.status = 'degraded';
    status.dbStatus = 'error';
    status.dbError = e.message;
  }
  return status;
}

async function handler(req, res) {
  const status = await getStatus();
  res.json(status);
}

async function readinessHandler(req, res) {
  const status = await getStatus();
  if (status.dbStatus !== 'ok') {
    return res.status(503).json({ status: 'not ready', dbStatus: status.dbStatus });
  }
  res.json({ status: 'ready', driver, uptime: process.uptime() });
}

module.exports = { handler, readinessHandler };
