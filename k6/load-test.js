'use strict';

const http = require('http');
const { check, sleep } = require('k6');
const { Rate, Trend, Counter } = require('k6/metrics');

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const apiCalls = new Counter('api_calls');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const params = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  },
  timeout: '10s',
};

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function () {
  const endpoints = [
    '/api/dashboard/stats',
    '/api/analytics/dashboard',
    '/api/analytics/spending-by-category',
    '/api/analytics/spending-by-provider',
    '/api/analytics/monthly-trend',
    '/api/analytics/top-articles',
    '/api/providers',
    '/api/articles',
    '/api/articles?search=agua',
    '/api/comparisons',
    '/api/alerts',
    '/api/search?q=agua',
    '/api/health',
  ];

  const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;

  const res = http.get(url, params);
  apiCalls.add(1);
  requestDuration.add(res.timings.duration);

  const ok = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 3000ms': (r) => r.timings.duration < 3000,
  });

  if (!ok) errorRate.add(1);

  // Simular creación de comparación cada ~10 requests
  if (Math.random() < 0.1 && TOKEN) {
    const budgets = http.get(`${BASE_URL}/api/budgets?limit=5`, params);
    if (budgets.status === 200) {
      try {
        const data = JSON.parse(budgets.body);
        const items = data.data || data.budgets || [];
        if (items.length > 0) {
          http.post(`${BASE_URL}/api/comparisons`,
            JSON.stringify({ budget_id: items[0].id, name: `k6-${randomId()}` }),
            params
          );
        }
      } catch { /* ignore */ }
    }
  }

  sleep(Math.random() * 3 + 1);
}
