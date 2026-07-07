'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function log(entityType, entityId, action, changes = {}, userId = null, userName = null) {
  try {
    const id = uuidv4();
    await db.prepare(`
      INSERT INTO audit_log (id, entity_type, entity_id, action, user_id, user_name, changes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entityType, entityId, action, userId || '', userName || '', JSON.stringify(changes));
  } catch (err) {
    const logger = require('../config/logger');
    logger.error({ err }, 'Error al registrar auditoría');
  }
}

async function getHistory(entityType, entityId, limit = 50) {
  return await db.prepare(`
    SELECT * FROM audit_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(entityType, entityId, limit);
}

module.exports = { log, getHistory };
