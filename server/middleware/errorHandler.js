const logger = require('../config/logger');

function wrapAsync(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(err => next(err));
      }
    } catch (err) {
      next(err);
    }
  };
}

function errorHandler(err, req, res, _next) {
  const dev = process.env.NODE_ENV !== 'production';

  if (process.env.SENTRY_DSN && err.status >= 500) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(err);
    } catch (_) { }
  }

  logger.error({ err, method: req.method, path: req.path }, err.message);
  res.status(err.status || 500).json({
    error: err.status ? err.message : 'Error interno del servidor',
    ...(dev && err.status >= 500 ? { stack: err.stack } : {})
  });
}

module.exports = { wrapAsync, errorHandler };
