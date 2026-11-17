// Contain (C1): /api/contain/status derives booleans from the worker's health
// and the egress probe only. The worker is a fake fetch here — no real worker,
// no host access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';
import { createFakePool } from './test-helpers.js';

function fakeWorker({ reachable = true, readOnly = true, egressReachable = false } = {}) {
  return async (url, opts) => {
    const u = String(url);
    if (u.endsWith('/health')) {
      if (!reachable) throw new Error('worker down');
      return { ok: true, json: async () => ({ ok: true, workspace: readOnly ? 'read-only' : 'writable' }) };
    }
    if (u.endsWith('/v1/network-check')) {
      return { ok: true, json: async () => ({ reachable: egressReachable, blocked: !egressReachable }) };
    }
    throw new Error('unexpected fetch ' + u);
  };
}

async function boot(fetchImpl) {
  const app = createApp({ pool: createFakePool(), fetch: fetchImpl, env: { SANDBOX_URL: 'http://worker.test' } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('contain status reports a healthy, contained worker', async () => {
  const app = await boot(fakeWorker({ reachable: true, readOnly: true, egressReachable: false }));
  try {
    const data = await (await fetch(app.base + '/api/contain/status')).json();
    assert.deepEqual(data, { worker_reachable: true, worker_egress_blocked: true, workspace_read_only: true });
  } finally { await app.close(); }
});

test('contain status flags egress that is NOT blocked', async () => {
  const app = await boot(fakeWorker({ egressReachable: true }));
  try {
    const data = await (await fetch(app.base + '/api/contain/status')).json();
    assert.equal(data.worker_egress_blocked, false);
  } finally { await app.close(); }
});

test('contain status reports an unreachable worker', async () => {
  const app = await boot(fakeWorker({ reachable: false }));
  try {
    const data = await (await fetch(app.base + '/api/contain/status')).json();
    assert.equal(data.worker_reachable, false);
    assert.equal(data.worker_egress_blocked, null);
  } finally { await app.close(); }
});
