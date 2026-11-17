// Work item 1 (Control) API tests. Deterministic: the model endpoint is a mock
// whose handlers pause/resume/kill the run mid-turn, and the database is the
// in-memory fake. No Postgres and no OpenAI key required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './server.js';
import { createFakePool, startMockModel, toolCall, finalMessage } from './test-helpers.js';

const delay = ms => new Promise(r => setTimeout(r, ms));

// Boot the app on an ephemeral port against a fake pool and a mock model.
// `ctx` is shared with the mock script so handlers can call back into the API.
async function boot(script, extraEnv = {}) {
  const ctx = {};
  const mock = await startMockModel(script(ctx));
  const pool = createFakePool();
  const app = createApp({
    pool,
    env: {
      OPENAI_API_KEY: 'test-key', OPENAI_BASE_URL: mock.baseUrl, OPENAI_MODEL: 'mock',
      RUN_PAUSE_WAIT_MS: '400', RUN_PAUSE_POLL_MS: '15', ...extraEnv
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  ctx.base = `http://127.0.0.1:${server.address().port}`;
  return {
    base: ctx.base, pool, mock,
    async close() { await new Promise(r => server.close(r)); await mock.close(); }
  };
}

const post = (base, path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const decisions = pool => pool._state.audit.map(a => a.decision);

test('pause blocks the next tool call', async () => {
  const runId = randomUUID();
  const app = await boot(ctx => [
    async () => { await post(ctx.base, `/api/runs/${runId}/pause`); return toolCall('list_products'); },
    finalMessage('done')
  ]);
  try {
    const res = await post(app.base, '/api/chat', { message: 'list products', run_id: runId });
    const data = await res.json();
    assert.equal(data.status, 'paused');
    assert.equal(data.trace.at(-1).result.blocked, true);
    assert.equal(data.trace.at(-1).result.reason, 'Run is paused by a reviewer');
    // The tool was never run, so there is no 'allowed' list_products audit.
    assert.ok(!app.pool._state.audit.some(a => a.action === 'list_products' && a.decision === 'allowed'));
    assert.ok(decisions(app.pool).includes('paused'));
  } finally { await app.close(); }
});

test('resume continues the run', async () => {
  const runId = randomUUID();
  const app = await boot(ctx => [
    async () => {
      await post(ctx.base, `/api/runs/${runId}/pause`);
      setTimeout(() => post(ctx.base, `/api/runs/${runId}/resume`), 60);
      return toolCall('list_products');
    },
    finalMessage('here are the products')
  ]);
  try {
    const res = await post(app.base, '/api/chat', { message: 'list products', run_id: runId });
    const data = await res.json();
    assert.equal(data.status, 'completed');
    assert.ok(data.trace.some(t => t.tool === 'list_products' && t.result.products));
    assert.ok(decisions(app.pool).includes('resumed'));
    assert.ok(app.pool._state.audit.some(a => a.action === 'list_products' && a.decision === 'allowed'));
  } finally { await app.close(); }
});

test('kill aborts the run and records killed', async () => {
  const runId = randomUUID();
  const app = await boot(ctx => [
    async () => { await post(ctx.base, `/api/runs/${runId}/kill`); return toolCall('list_products'); },
    finalMessage('unreachable')
  ]);
  try {
    const res = await post(app.base, '/api/chat', { message: 'list products', run_id: runId });
    const data = await res.json();
    assert.equal(data.status, 'killed');
    assert.ok(!data.trace.some(t => t.tool === 'list_products' && t.result.products));
    assert.equal(app.pool._state.runs.get(runId).status, 'killed');
    assert.ok(decisions(app.pool).includes('killed'));
  } finally { await app.close(); }
});

test('concurrency cap returns 429', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const app = await boot(() => [
    async () => { await gate; return finalMessage('slow run done'); }
  ], { MAX_CONCURRENT_RUNS: '1' });
  try {
    const first = post(app.base, '/api/chat', { message: 'hold a slot' }); // occupies the only slot
    // Wait until the run is active.
    for (let i = 0; i < 50 && (await (await fetch(app.base + '/api/health')).json()).active_runs < 1; i++) await delay(10);
    const second = await post(app.base, '/api/chat', { message: 'over the cap' });
    assert.equal(second.status, 429);
    const body = await second.json();
    assert.equal(body.max_concurrent_runs, 1);
    release();
    await first;
  } finally { await app.close(); }
});

test('SSE stream emits an event after a tool call', async () => {
  const app = await boot(() => [toolCall('list_products'), finalMessage('done')]);
  try {
    const stream = await fetch(app.base + '/api/activity/stream');
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    await post(app.base, '/api/chat', { message: 'list products' });
    let buffer = '';
    let sawListProducts = false;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !sawListProducts) {
      const { value, done } = await Promise.race([reader.read(), delay(2000).then(() => ({ done: true }))]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const block of buffer.split('\n\n')) {
        const line = block.split('\n').find(l => l.startsWith('data: '));
        if (line && JSON.parse(line.slice(6)).action === 'list_products') sawListProducts = true;
      }
    }
    await reader.cancel();
    assert.ok(sawListProducts, 'expected an SSE audit event for list_products');
  } finally { await app.close(); }
});

test('run control endpoints validate ids and transitions', async () => {
  const app = await boot(() => [finalMessage('hi')]);
  try {
    assert.equal((await post(app.base, '/api/runs/not-a-uuid/pause')).status, 400);
    assert.equal((await post(app.base, `/api/runs/${randomUUID()}/pause`)).status, 404);
  } finally { await app.close(); }
});
