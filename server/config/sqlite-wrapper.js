'use strict';

/**
 * sqlite-wrapper.js — Envoltura sobre better-sqlite3
 *
 * Expone API compatible con la anterior (prepare().all()/.get()/.run(),
 * exec(), transaction(), persistNow(), flush()) pero delega en
 * better-sqlite3 que escribe a disco sincrónicamente sin necesidad
 * del buffer diferido que requería sql.js.
 *
 * WAL mode activado para mejor concurrencia en lecturas.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function openDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const realExec = db.exec.bind(db);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'persistNow') return () => {};
      if (prop === 'flush') return () => Promise.resolve();
      if (prop === '_raw') return target;
      if (prop === 'transaction') {
        return (fn) => (...args) => {
          realExec('BEGIN IMMEDIATE');
          try {
            const result = fn(...args);
            if (result && typeof result.then === 'function') {
              return result.then(r => { realExec('COMMIT'); return r; })
                .catch(e => { realExec('ROLLBACK'); throw e; });
            }
            realExec('COMMIT');
            return Promise.resolve(result);
          } catch (e) {
            realExec('ROLLBACK');
            return Promise.reject(e);
          }
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
}

module.exports = { openDatabase };
