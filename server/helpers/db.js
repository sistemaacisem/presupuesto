const db = require('../config/database');

function getAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function getOne(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function paginate(table, fields = '*', { where, params, order, page, limit } = {}) {
  const offset = ((page || 1) - 1) * (limit || 20);
  const whereClause = where ? ` WHERE ${where}` : '';
  const orderClause = order ? ` ORDER BY ${order}` : '';

  const rows = getAll(`SELECT ${fields} FROM ${table}${whereClause}${orderClause} LIMIT ? OFFSET ?`, [...params, limit || 20, offset]);
  const total = getOne(`SELECT COUNT(*) as c FROM ${table}${whereClause}`, params).c;

  return { rows, total };
}

module.exports = { getAll, getOne, run, paginate };
