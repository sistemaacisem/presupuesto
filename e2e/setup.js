'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

process.env.DB_DRIVER = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_e2e';
process.env.JWT_EXPIRES_IN = '24h';

const dbPath = path.join(__dirname, '../data/database.sqlite');
try { fs.unlinkSync(dbPath); } catch {}

execSync('node server/seeds/demo_data.js', {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, NO_AUTO_START: '1' },
});

require('../server/index');
