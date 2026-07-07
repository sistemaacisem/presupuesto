'use strict';

const rateLimit = require('express-rate-limit');

const ROLE_LIMITS = {
  admin:    { windowMs: 15 * 60 * 1000, max: 1000 },
  auditor:  { windowMs: 15 * 60 * 1000, max: 600 },
  purchases:{ windowMs: 15 * 60 * 1000, max: 400 },
  viewer:   { windowMs: 15 * 60 * 1000, max: 200 },
};

const DEFAULT_LIMIT = { windowMs: 15 * 60 * 1000, max: 200 };

// Pre-create one limiter per role so counters persist correctly
const limiters = {};
for (const [role, opts] of Object.entries(ROLE_LIMITS)) {
  limiters[role] = rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: `Demasiadas solicitudes para tu rol (${role}). Intentá de nuevo más tarde.` },
  });
}

function roleAwareRateLimit(req, res, next) {
  const role = (req.user && req.user.role) || 'viewer';
  const limiter = limiters[role] || rateLimit({
    windowMs: DEFAULT_LIMIT.windowMs,
    max: DEFAULT_LIMIT.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intentá de nuevo más tarde.' },
  });
  return limiter(req, res, next);
}

module.exports = { roleAwareRateLimit, ROLE_LIMITS };
