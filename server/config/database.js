'use strict';

/**
 * database.js — Inicialización unificada SQLite / PostgreSQL
 *
 * Usa DB_DRIVER del .env para elegir el motor:
 *   sqlite → server/config/sqlite-wrapper.js (local, sincrónico)
 *   pg     → server/config/supabase.js (Supabase, asíncrono)
 *
 * La API expuesta es la misma para ambos:
 *   db.prepare(sql).all(...) / .get(...) / .run(...)
 *   db.exec(sql)
 *   db.transaction(fn)
 *
 * Para PG todos los métodos devuelven Promesas → usar await.
 * Para SQLite son sincrónicos (comportamiento histórico).
 */

const path = require('path');
const fs = require('fs');
const dbModule = require('./db');
const logger = require('./logger');

const driver = dbModule.driver;
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db = null;
let _init = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'readonly',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    cuit        TEXT,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    city        TEXT,
    province    TEXT,
    notes       TEXT,
    rating      REAL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS articles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    aliases     TEXT DEFAULT '[]',
    category    TEXT,
    unit        TEXT DEFAULT 'unidad',
    tags        TEXT DEFAULT '[]',
    is_favorite INTEGER DEFAULT 0,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id           TEXT PRIMARY KEY,
    provider_id  TEXT,
    number       TEXT,
    date         TEXT,
    type         TEXT NOT NULL DEFAULT 'history',
    status       TEXT NOT NULL DEFAULT 'pending',
    file_name    TEXT,
    file_path    TEXT,
    total_amount REAL DEFAULT 0,
    notes        TEXT,
    tags         TEXT DEFAULT '[]',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budget_details (
    id              TEXT PRIMARY KEY,
    budget_id       TEXT NOT NULL,
    article_id      TEXT,
    raw_description TEXT,
    quantity        REAL DEFAULT 1,
    unit            TEXT DEFAULT 'unidad',
    unit_price      REAL DEFAULT 0,
    total_price     REAL DEFAULT 0,
    notes           TEXT
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id               TEXT PRIMARY KEY,
    article_id       TEXT NOT NULL,
    provider_id      TEXT NOT NULL,
    budget_id        TEXT,
    budget_detail_id TEXT,
    unit_price       REAL NOT NULL,
    quantity         REAL DEFAULT 1,
    date             TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comparisons (
    id               TEXT PRIMARY KEY,
    name             TEXT,
    budget_id        TEXT,
    date             TEXT NOT NULL,
    total_budget     REAL DEFAULT 0,
    total_savings    REAL DEFAULT 0,
    savings_pct      REAL DEFAULT 0,
    items_overpriced INTEGER DEFAULT 0,
    items_average    INTEGER DEFAULT 0,
    items_cheaper    INTEGER DEFAULT 0,
    results          TEXT DEFAULT '[]',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id            TEXT PRIMARY KEY,
    user_id       TEXT,
    query         TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_count  INTEGER DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL DEFAULT 'overpriced',
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'warning',
    budget_id   TEXT,
    comparison_id TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    action      TEXT NOT NULL,
    user_id     TEXT,
    user_name   TEXT,
    changes     TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_date  ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_ph_article  ON price_history(article_id);
  CREATE INDEX IF NOT EXISTS idx_ph_provider ON price_history(provider_id);
  CREATE INDEX IF NOT EXISTS idx_ph_date     ON price_history(date);
  CREATE INDEX IF NOT EXISTS idx_bd_budget   ON budget_details(budget_id);
  CREATE INDEX IF NOT EXISTS idx_bd_article  ON budget_details(article_id);
  CREATE INDEX IF NOT EXISTS idx_b_provider  ON budgets(provider_id);
  CREATE INDEX IF NOT EXISTS idx_b_date      ON budgets(date);
  CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
  CREATE INDEX IF NOT EXISTS idx_alerts_date ON alerts(created_at);
  CREATE INDEX IF NOT EXISTS idx_bd_budget_article ON budget_details(budget_id, article_id);
  CREATE INDEX IF NOT EXISTS idx_b_provider_type ON budgets(provider_id, type);
  CREATE INDEX IF NOT EXISTS idx_b_type_status ON budgets(type, status);
  CREATE INDEX IF NOT EXISTS idx_ph_article_provider ON price_history(article_id, provider_id);
  CREATE INDEX IF NOT EXISTS idx_comparisons_budget ON comparisons(budget_id);
`;

async function initDB() {
  if (_init) return _init;

  if (driver === 'pg') {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      logger.fatal('DB_DRIVER=pg requiere DATABASE_URL en .env');
      process.exit(1);
    }
    dbModule.createPool(connStr);
    const ok = await dbModule.testConnection();
    if (!ok) {
      logger.fatal('No se pudo conectar a PostgreSQL. Corré: node server/migrate.js');
      process.exit(1);
    }
    _db = dbModule;
    logger.info({ driver: 'pg', host: connStr.substring(0, 30) }, 'Usando PostgreSQL');
  } else {
    const dbPath = path.join(dataDir, 'database.sqlite');
    _db = await dbModule.openDatabase(dbPath);

    const statements = SCHEMA.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try { _db.exec(stmt); } catch (e) {
        if (!e.message.includes('already exists')) {
          logger.warn({ err: e.message, stmt: stmt.substring(0, 60) }, 'Schema warning');
        }
      }
    }
    logger.info({ path: dbPath }, 'Base de datos SQLite inicializada');
  }

  _init = Promise.resolve(_db);
  return _db;
}

function translateSql(sql) {
  sql = sql.replace(/\bdatetime\('now'\)/gi, 'NOW()');
  sql = sql.replace(/\bdate\('now',\s*'(-?\d+)\s*(days|months)'\)/gi, (_, num, unit) => {
    if (num.startsWith('-')) return `NOW() - INTERVAL '${num.slice(1)} ${unit}'`;
    return `NOW() + INTERVAL '${num} ${unit}'`;
  });
  sql = sql.replace(/\bdate\('now'\)/gi, 'CURRENT_DATE');
  sql = sql.replace(/strftime\('([^']+)',\s*([^)]+)\)/gi, (_, fmt, col) => {
    const map = { '%Y': 'YYYY', '%m': 'MM', '%d': 'DD', '%H': 'HH24', '%M': 'MI' };
    return `TO_CHAR(${col}, '${fmt.replace(/%[YmdHM]/g, m => map[m] || m)}')`;
  });
  sql = sql.replace(/\b(SET|WHERE|AND|OR)\s+(is_active|is_favorite|is_read)\s*=\s*(0|1)\b/gi, (_, kw, col, v) =>
    `${kw} ${col} = ${v === '1' ? 'TRUE' : 'FALSE'}`);
  sql = sql.replace(/\b(SET|WHERE|AND|OR)\s+(is_active|is_favorite|is_read)\s*=\s*\?/gi, (_, kw, col) =>
    `${kw} ${col} = CAST(? AS BOOLEAN)`);
  sql = sql.replace(/(INSERT\s+INTO\s+\w+\s*\()([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi, (full, prefix, cols, vals) => {
    const colArr = cols.split(',').map(c => c.trim().toLowerCase());
    const valArr = vals.split(',').map(v => v.trim());
    const boolCols = new Set(['is_active', 'is_favorite', 'is_read']);
    let changed = false;
    const newVals = valArr.map((v, i) => {
      const col = colArr[i];
      if (col && boolCols.has(col)) {
        if (v === '?') { changed = true; return 'CAST(? AS BOOLEAN)'; }
        if (v === '0') { changed = true; return 'FALSE'; }
        if (v === '1') { changed = true; return 'TRUE'; }
      }
      return v;
    });
    return changed ? `${prefix}${cols}) VALUES (${newVals.join(', ')})` : full;
  });
  sql = sql.replace(/ROUND\(([^,]+),\s*(\d+)\)/gi, (_, expr, digits) => {
    if (digits === '0') return `ROUND(${expr}::NUMERIC)`;
    return `ROUND(${expr}::NUMERIC, ${digits})`;
  });
  let paramIdx = 0;
  sql = sql.replace(/\?/g, () => `$${++paramIdx}`);
  return sql;
}

const dbProxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'initDB') return initDB;
    if (prop === 'driver') return () => driver;
    const db = _db;
    if (!db) throw new Error(`Database not ready. Property "${prop}" accessed before initDB() resolved.`);
    if (driver === 'pg' && prop === 'prepare') {
      const nativePrepare = db.prepare.bind(db);
      return (sql) => nativePrepare(translateSql(sql));
    }
    const val = db[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  }
});

module.exports = dbProxy;
