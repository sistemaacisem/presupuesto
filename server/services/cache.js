'use strict';

class Cache {
  constructor(ttlSeconds = 60) {
    this._store = new Map();
    this._ttl = ttlSeconds * 1000;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, customTtlMs) {
    this._store.set(key, { value, ts: Date.now(), ttl: customTtlMs || this._ttl });
  }

  _isExpired(entry) {
    return Date.now() - entry.ts > entry.ttl;
  }

  invalidate(pattern) {
    if (!pattern) { this._store.clear(); return; }
    for (const key of this._store.keys()) {
      if (key.includes(pattern)) this._store.delete(key);
    }
  }
}

module.exports = Cache;
