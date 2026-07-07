'use strict';

class Cache {
  constructor(ttlSeconds = 60) {
    this._store = new Map();
    this._ttl = ttlSeconds * 1000;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this._ttl) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this._store.set(key, { value, ts: Date.now() });
  }

  invalidate(pattern) {
    if (!pattern) { this._store.clear(); return; }
    for (const key of this._store.keys()) {
      if (key.includes(pattern)) this._store.delete(key);
    }
  }
}

module.exports = Cache;
