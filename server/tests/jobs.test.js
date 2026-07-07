const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const jobs = require('../services/jobs');

describe('Jobs Service', () => {
  beforeEach(() => {
    jobs.clear();
  });

  it('exports enqueue, pending, clear', () => {
    assert.strictEqual(typeof jobs.enqueue, 'function');
    assert.strictEqual(typeof jobs.pending, 'function');
    assert.strictEqual(typeof jobs.clear, 'function');
  });

  it('enqueue processes a job', async () => {
    let executed = false;
    await new Promise((resolve) => {
      jobs.enqueue('test', async () => { executed = true; resolve(); });
    });
    assert.ok(executed);
  });

  it('enqueue multiple jobs processes in order', async () => {
    const order = [];
    const p1 = new Promise(r => jobs.enqueue('a', async () => { order.push(1); r(); }));
    const p2 = new Promise(r => jobs.enqueue('b', async () => { order.push(2); r(); }));
    const p3 = new Promise(r => jobs.enqueue('c', async () => { order.push(3); r(); }));
    await Promise.all([p1, p2, p3]);
    assert.deepStrictEqual(order, [1, 2, 3]);
  });

  it('handles errors gracefully without crashing', async () => {
    let ranAfterError = false;
    const p1 = new Promise(r => jobs.enqueue('fail', async () => {
      try { throw new Error('fail'); } finally { r(); }
    }));
    const p2 = new Promise(r => jobs.enqueue('good', async () => { ranAfterError = true; r(); }));
    await p1;
    await p2;
    assert.ok(ranAfterError);
  });

  it('clear() removes pending jobs', () => {
    jobs.enqueue('a', async () => {});
    jobs.enqueue('b', async () => {});
    jobs.clear();
    assert.strictEqual(jobs.pending(), 0);
  });

  it('pending() returns correct count', () => {
    assert.strictEqual(jobs.pending(), 0);
    jobs.enqueue('a', async () => {});
    assert.strictEqual(jobs.pending(), 1);
    jobs.clear();
  });
});
