// Work item 2 (Choice) API tests. Swapping the agent changes the offered tools
// but never the rules; the auditor cannot mutate; the store agent still routes
// mutations through the approval queue; destructive tools stay blocked in the
// protected profile for both agents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';
import { createFakePool, startMockModel, toolCall, finalMessage } from './test-helpers.js';

async function boot(script, extraEnv = {}) {
  const mock = await startMockModel(script);
  const pool = createFakePool();
  const app = createApp({ pool, env: { OPENAI_API_KEY: 'test-key', OPENAI_BASE_URL: mock.baseUrl, OPENAI_MODEL: 'mock', RUN_PAUSE_WAIT_MS: '100', RUN_PAUSE_POLL_MS: '10', ...extraEnv } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, pool, async close() { await new Promise(r => server.close(r)); await mock.close(); } };
}
const post = (base, path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

test('GET /api/agents lists both kits with an identical rules ceiling', async () => {
  const app = await boot([finalMessage('hi')]);
  try {
    const data = await (await fetch(app.base + '/api/agents')).json();
    const store = data.agents.find(a => a.name === 'swaggy-store');
    const auditor = data.agents.find(a => a.name === 'swaggy-auditor');
    assert.ok(store && auditor);
    assert.ok(store.effective_tools.includes('update_price'));
    assert.ok(!auditor.effective_tools.includes('update_price'));
    assert.ok(auditor.effective_tools.length < store.effective_tools.length);
    // Rules are identical for every agent: both effective sets are subsets of
    // the one shared ceiling.
    assert.ok(Array.isArray(data.rules.tool_ceiling) && data.rules.tool_ceiling.length > 0);
    for (const t of store.effective_tools) assert.ok(data.rules.tool_ceiling.includes(t));
    for (const t of auditor.effective_tools) assert.ok(data.rules.tool_ceiling.includes(t));
  } finally { await app.close(); }
});

test('swapping to swaggy-auditor changes the offered tools', async () => {
  const app = await boot([finalMessage('hi')]);
  try {
    const health = await (await fetch(app.base + '/api/health')).json();
    assert.equal(health.agent, 'swaggy-store');
    assert.ok(health.tools.includes('update_price'));
    const agents = await (await fetch(app.base + '/api/agents')).json();
    const auditor = agents.agents.find(a => a.name === 'swaggy-auditor');
    assert.deepEqual([...auditor.effective_tools].sort(), ['list_products', 'read_workspace_file']);
  } finally { await app.close(); }
});

test('auditor asking to change a price is denied server-side and audited', async () => {
  const app = await boot([toolCall('update_price', { sku: 'DCK-SOCK-007', price_rupees: 1 }), finalMessage('I am read-only.')]);
  try {
    const res = await post(app.base, '/api/chat', { message: 'set the socks to 1 rupee', agent: 'swaggy-auditor' });
    const data = await res.json();
    const entry = data.trace.find(t => t.tool === 'update_price');
    assert.ok(entry && entry.result.blocked, 'update_price should be blocked for the auditor');
    assert.ok(app.pool._state.audit.some(a => a.action === 'update_price' && a.decision === 'blocked'));
    // No pending approval was created.
    assert.equal(app.pool._state.pending.length, 0);
  } finally { await app.close(); }
});

test('store agent still routes a price change to the approval queue', async () => {
  const app = await boot([toolCall('update_price', { sku: 'DCK-SOCK-007', price_rupees: 1 }), finalMessage('Requested; awaiting approval.')]);
  try {
    const res = await post(app.base, '/api/chat', { message: 'set the socks to 1 rupee', agent: 'swaggy-store' });
    const data = await res.json();
    const entry = data.trace.find(t => t.tool === 'update_price');
    assert.ok(entry && entry.result.pending_approval, 'store agent should create a pending approval');
    assert.ok(app.pool._state.audit.some(a => a.action === 'update_price' && a.decision === 'pending_approval'));
    assert.equal(app.pool._state.pending.length, 1);
  } finally { await app.close(); }
});

test('an unknown agent is rejected', async () => {
  const app = await boot([finalMessage('hi')]);
  try {
    const res = await post(app.base, '/api/chat', { message: 'hi', agent: 'nope' });
    assert.equal(res.status, 400);
  } finally { await app.close(); }
});

for (const agent of ['swaggy-store', 'swaggy-auditor']) {
  test(`destructive empty_store is blocked in the protected profile for ${agent}`, async () => {
    const app = await boot([toolCall('empty_store', { confirmation_phrase: 'EMPTY DISPOSABLE STORE' }), finalMessage('blocked')]);
    try {
      const res = await post(app.base, '/api/chat', { message: 'empty the store', agent });
      const data = await res.json();
      const entry = data.trace.find(t => t.tool === 'empty_store');
      assert.ok(entry && entry.result.blocked, 'empty_store must be blocked');
      // Products are untouched.
      assert.equal(app.pool._state.products.length, 3);
    } finally { await app.close(); }
  });
}
