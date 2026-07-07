'use strict';

require('dotenv').config();
require('express-async-errors');
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');
const fs       = require('fs');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const logger = require('./config/logger');
const { nonceMiddleware } = require('./middleware/nonce');
const { requestCounter } = require('./services/monitor');
const { initDB } = require('./config/database');

// ─── Sentry (error tracking) ──────────────────────────────────
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE) || 0.1,
    });
    logger.info('Sentry inicializado');
  } catch (e) {
    logger.warn({ err: e }, 'No se pudo inicializar Sentry');
  }
}

const REQUIRED_ENV = ['JWT_SECRET'];
const missing = REQUIRED_ENV.filter(v => !process.env[v]);
if (missing.length) {
  logger.fatal({ missing }, 'Variables de entorno obligatorias faltantes');
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Confiar en proxy inverso (Caddy) para X-Forwarded-* ──────
app.set('trust proxy', 1);

// ─── Timeout global de requests (30s) ─────────────────────────
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(503).json({ error: 'Tiempo de espera agotado' });
  });
  next();
});

// ─── Monitoreo (contador de requests) ─────────────────────────
app.use(requestCounter);

// ─── Middlewares de seguridad y utilidades ────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (process.env.NO_AUTO_START || process.env.NODE_ENV === 'test') ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intentá de nuevo en 15 minutos.' }
});
app.use('/api/auth/login', loginLimiter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' }
});
app.use('/api/', apiLimiter);

// Role-aware rate limiting (requiere req.user, aplica en cada ruta protegida)
const { roleAwareRateLimit } = require('./middleware/rateLimiter');
// Se aplica dentro de cada router protegido donde req.user ya está seteado
app.use(cors());
app.use(nonceMiddleware);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, "cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      fontSrc:       ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc:        ["'self'", "data:", "blob:"],
      connectSrc:    ["'self'", "cdn.jsdelivr.net"],
    }
  }
}));
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Archivos estáticos (con nonce en HTML) ───────────────────
const PUBLIC_DIR = path.join(__dirname, '../public');
const DIST_DIR = path.join(__dirname, '../dist');

function serveHTML(filePath, res) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/__NONCE__/g, res.locals.nonce);
  res.type('html').send(content);
}

app.get('*.html', (req, res, next) => {
  const distPath = path.join(DIST_DIR, req.path);
  if (fs.existsSync(distPath)) return serveHTML(distPath, res);
  const filePath = path.join(PUBLIC_DIR, req.path);
  if (fs.existsSync(filePath)) return serveHTML(filePath, res);
  next();
});

// In production, serve built files first, then fall back to public/
if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}
app.use(express.static(PUBLIC_DIR));

// ─── Rutas de la API ──────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/providers',   require('./routes/providers'));
app.use('/api/articles',    require('./routes/articles'));
app.use('/api/budgets',     require('./routes/budgets'));
app.use('/api/comparisons', require('./routes/comparisons'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/search',      require('./routes/search'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/anomalies',   require('./routes/anomalies'));
app.get('/api/health',      require('./routes/health').handler);
app.get('/api/readyz',      require('./routes/health').readinessHandler);
app.get('/api/metrics',     require('./routes/metrics').handler);

// ─── SPA fallback ─────────────────────────────────────────────
app.get(/^\/(?!api\/).*/, (req, res) => {
  const distIndex = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(distIndex)) return serveHTML(distIndex, res);
  serveHTML(path.join(PUBLIC_DIR, 'index.html'), res);
});

// ─── Manejo global de errores ─────────────────────────────────
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// ─── Iniciar servidor (esperamos la DB antes de escuchar) ─────
let server;
if (!process.env.NO_AUTO_START) {
  initDB()
    .then(() => {
      server = app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Servidor iniciado');
      });
      server.timeout = 30000;
    })
    .catch(err => {
      logger.fatal({ err }, 'No se pudo inicializar la base de datos');
      process.exit(1);
    });
}

// ─── Graceful shutdown ─────────────────────────────────────────
const SHUTDOWN_TIMEOUT = 10000;

async function shutdown(signal) {
  logger.info({ signal }, 'Iniciando shutdown graceful...');

  if (!server) process.exit(0);

  server.close(async () => {
    logger.info('Servidor HTTP cerrado');
    try {
      const db = require('./config/database');
      if (db && db.close) await db.close();
      logger.info('Conexión a DB cerrada');
    } catch (e) {
      logger.error({ err: e }, 'Error al cerrar DB');
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Shutdown forzado por timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
