'use strict';

/**
 * Cola de trabajos asíncronos en memoria.
 * Ejecuta tareas pesadas (linkArticles, etc.) sin bloquear el request.
 */

const queue = [];
let processing = false;

function processNext() {
  if (processing || !queue.length) return;
  processing = true;
  const job = queue.shift();
  setImmediate(async () => {
    try {
      await job.handler();
    } catch (err) {
      console.error(`[JOB] Error en trabajo "${job.name}":`, err.message);
    }
    processing = false;
    processNext();
  });
}

function enqueue(name, handler) {
  queue.push({ name, handler });
  processNext();
}

function pending() {
  return queue.length;
}

function clear() {
  queue.length = 0;
}

module.exports = { enqueue, pending, clear };
