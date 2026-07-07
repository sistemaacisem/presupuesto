'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const HTML_DIR = path.join(__dirname, '../../public');

function nonceMiddleware(req, res, next) {
  res.locals.nonce = crypto.randomBytes(16).toString('base64url');

  const originalSendFile = res.sendFile;
  const originalJson = res.json;
  const originalSend = res.send;

  res.sendFile = function (filePath, ...args) {
    if (typeof filePath === 'string' && filePath.endsWith('.html')) {
      const absolutePath = path.resolve(HTML_DIR, path.basename(filePath));
      return sendWithNonce(res, absolutePath, res.locals.nonce, args[0] || {});
    }
    return originalSendFile.call(this, filePath, ...args);
  };

  next();
}

function sendWithNonce(res, filePath, nonce, options) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/__NONCE__/g, nonce);
    res.type('html').send(content);
  } catch (e) {
    res.status(404).send('Not found');
  }
}

module.exports = { nonceMiddleware };
