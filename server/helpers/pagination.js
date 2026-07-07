'use strict';

function paginatedResponse({ data, total, page, limit, additional = {} }) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 20));
  return {
    data,
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l),
    ...additional,
  };
}

function paginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { paginatedResponse, paginationParams };
