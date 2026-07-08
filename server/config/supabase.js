'use strict';

/**
 * supabase.js — Conexión asíncrona a PostgreSQL via Supabase
 *
 * API compatible con el wrapper sqlite-wrapper.js pero 100% async.
 * Los métodos devuelven Promesas en lugar de resultados sincrónicos.
 *
 * Uso:
 *   await db.query(sql, params)      — array de filas
 *   await db.queryOne(sql, params)    — una fila o null
 *   await db.execute(sql, params)     — { rows, rowCount }
 *   await db.exec(sql)                — raw SQL
 *   await db.transaction(fn)          — transacción
 */

const { Pool } = require('pg');
const logger = require('./logger');

let pool = null;

function createPool(connectionString) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Error inesperado en el pool de PostgreSQL');
  });

  return pool;
}

async function testConnection() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT version()');
    client.release();
    logger.info({ version: res.rows[0].version.split(',')[0] }, 'Conectado a PostgreSQL');
    return true;
  } catch (err) {
    logger.error({ err }, 'Error de conexión a PostgreSQL');
    return false;
  }
}

async function close() {
  if (pool) await pool.end();
}

// Compatibilidad con sqlite-wrapper API (pero asíncrona)
function query(sql, params = []) {
  return pool.query(sql, params).then(r => r.rows);
}

function queryOne(sql, params = []) {
  return pool.query(sql, params).then(r => r.rows[0] || null);
}

function execute(sql, params = []) {
  return pool.query(sql, params).then(r => ({ rows: r.rows, rowCount: r.rowCount ?? 0 }));
}

function exec(sql, params = []) {
  return pool.query(sql, params).then(r => ({ rows: r.rows, rowCount: r.rowCount ?? 0 }));
}

// Wrapper que emula db.prepare().all()/.get()/.run()
function prepare(sql) {
  return {
    all: (...params) => query(sql, params),
    get: (...params) => queryOne(sql, params),
    run: (...params) => execute(sql, params)
  };
}

function transaction(fn) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(...args);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };
}

module.exports = { createPool, testConnection, close, query, queryOne, execute, exec, prepare, transaction };
