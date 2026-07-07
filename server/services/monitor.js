'use strict';

const os = require('os');

const counters = { requests: 0, byStatus: {}, byRoute: {}, errors5xx: 0 };
let startTime = Date.now();

function requestCounter(req, res, next) {
  counters.requests++;
  const route = req.route ? req.route.path : req.path;
  counters.byRoute[route] = (counters.byRoute[route] || 0) + 1;

  res.on('finish', () => {
    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
    counters.byStatus[statusGroup] = (counters.byStatus[statusGroup] || 0) + 1;
    if (res.statusCode >= 500) counters.errors5xx++;
  });

  next();
}

function getMetrics() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    uptime: process.uptime(),
    uptimeHuman: formatUptime(process.uptime()),
    startTime: new Date(startTime).toISOString(),
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      rssMB: round(mem.rss / 1024 / 1024),
      heapUsedMB: round(mem.heapUsed / 1024 / 1024),
    },
    cpu: {
      user: cpu.user,
      system: cpu.system,
      userMS: round(cpu.user / 1000),
      systemMS: round(cpu.system / 1000),
    },
    os: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      loadAvg: os.loadavg(),
      freemem: os.freemem(),
      totalmem: os.totalmem(),
      freememMB: round(os.freemem() / 1024 / 1024),
      totalmemMB: round(os.totalmem() / 1024 / 1024),
    },
    requests: {
      total: counters.requests,
      byStatus: { ...counters.byStatus },
      byRoute: { ...counters.byRoute },
      errors5xx: counters.errors5xx,
      activeConnections: 0,
    }
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = { requestCounter, getMetrics };
