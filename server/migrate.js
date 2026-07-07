'use strict';

/**
 * migrate.js — Runner de migraciones para PostgreSQL
 *
 * Uso:
 *   DB_DRIVER=pg DATABASE_URL=postgresql://... node server/migrate.js
 *   DB_DRIVER=pg DATABASE_URL=postgresql://... node server/migrate.js rollback
 *
 * Lee migraciones de server/migrations/*.sql y las aplica en orden.
 * La tabla "migrations" lleva el registro de lo aplicado.
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');

const { createPool, close, exec, queryOne } = require('./config/supabase');
const logger = require('./config/logger');

async function run() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('[MIGRATE] ERROR: DATABASE_URL no definida');
    process.exit(1);
  }

  createPool(connStr);
  logger.info('Conectando a PostgreSQL para migraciones...');

  // Crear tabla migrations si no existe
  try {
    await exec(`CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando tabla migrations');
    process.exit(1);
  }

  const isRollback = process.argv[2] === 'rollback';

  if (isRollback) {
    await rollbackLast();
  } else {
    await applyPending();
  }

  await close();
  logger.info('Migracion completada');
}

async function applyPending() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = await exec(`SELECT name FROM migrations ORDER BY name`);
  const appliedNames = new Set(applied.rows.map(r => r.name));

  for (const file of files) {
    if (appliedNames.has(file)) {
      logger.info({ file }, 'Migracion ya aplicada');
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    logger.info({ file }, 'Aplicando migracion...');

    try {
      await exec(sql);
      await exec(`INSERT INTO migrations (name) VALUES ($1)`, [file]);
      logger.info({ file }, 'Migracion aplicada');
    } catch (err) {
      logger.error({ err, file }, 'Migracion fallo');
      process.exit(1);
    }
  }
}

async function rollbackLast() {
  const last = await queryOne(`SELECT name FROM migrations ORDER BY applied_at DESC LIMIT 1`);
  if (!last) {
    logger.info('No hay migraciones para revertir');
    return;
  }

  logger.info({ file: last.name }, 'Revirtiendo migracion...');
  await exec(`DELETE FROM migrations WHERE name = $1`, [last.name]);
  logger.info({ file: last.name }, 'Migracion revertida');
}

run().catch(err => {
  logger.fatal({ err }, 'Error en migracion');
  process.exit(1);
});
