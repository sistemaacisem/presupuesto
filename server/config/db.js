'use strict';

/**
 * db.js — Selector de driver de base de datos
 *
 * Lee DB_DRIVER del .env y retorna la implementación correcta.
 *   DB_DRIVER=sqlite  → server/config/sqlite-wrapper.js (sincrónico, local)
 *   DB_DRIVER=pg      → server/config/supabase.js (asíncrono, Supabase/PostgreSQL)
 *
 * El módulo "database.js" wrappea esto y agrega init + schema.
 * La mayoría del código usa database.js, no este archivo directamente.
 */

const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let impl;
if (driver === 'pg') {
  impl = require('./supabase');
} else {
  impl = require('./sqlite-wrapper');
}

// db.openDatabase(path) o db.createPool(connString)
module.exports = impl;
module.exports.driver = driver;
