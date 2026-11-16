import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = Number(process.env.PORT || 4000);
const profile = process.env.SECURITY_PROFILE === 'unrestricted-demo' ? 'unrestricted-demo' : 'protected';
const destructiveEnabled = process.env.ALLOW_DESTRUCTIVE_DEMO === 'true';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const tools = [
  { type: 'function', function: { name: 'list_products', description: 'List products and current stock. Use for product and inventory questions.', parameters: { type: 'object', properties: { search: { type: 'string', description: 'Optional name or SKU filter' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'update_price', description: 'Set one product price in whole rupees. This is a consequential business change.', parameters: { type: 'object', properties: { sku: { type: 'string' }, price_rupees: { type: 'number', minimum: 0 } }, required: ['sku', 'price_rupees'], additionalProperties: false } } },
  { type: 'function', function: { name: 'set_inventory', description: 'Set stock quantity for one product.', parameters: { type: 'object', properties: { sku: { type: 'string' }, quantity: { type: 'integer', minimum: 0 } }, required: ['sku', 'quantity'], additionalProperties: false } } },
  { type: 'function', function: { name: 'delete_product', description: 'Permanently delete one product from the disposable lab catalogue.', parameters: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'], additionalProperties: false } } },
  { type: 'function', function: { name: 'empty_store', description: 'Delete every product from the disposable lab catalogue. Destructive workshop scenario only.', parameters: { type: 'object', properties: { confirmation_phrase: { type: 'string' } }, required: ['confirmation_phrase'], additionalProperties: false } } }
];

async function audit(action, args, decision, detail) {
  await pool.query('INSERT INTO agent_audit(action, arguments, profile, decision, detail) VALUES($1,$2,$3,$4,$5)', [action, args, profile, decision, detail]);
}
async function runTool(name, args) {
  if (name === 'list_products') {
    const q = args.search ? '%' + String(args.search).slice(0, 80) + '%' : null;
    const result = await pool.query('SELECT sku,name,description,category,price_cents,stock FROM products WHERE $1::text IS NULL OR name ILIKE $1 OR sku ILIKE $1 ORDER BY id LIMIT 50', [q]);
    await audit(name, args, 'allowed', 'Read-only product lookup');
    return { products: result.rows.map(p => ({ ...p, price_rupees: p.price_cents / 100 })) };
  }
  if (name === 'update_price' || name === 'set_inventory') {
    if (name === 'update_price' && (!Number.isFinite(args.price_rupees) || args.price_rupees > 100000)) throw new Error('Price must be between ₹0 and ₹100,000.');
    if (name === 'set_inventory' && (!Number.isInteger(args.quantity) || args.quantity > 100000)) throw new Error('Quantity must be between 0 and 100,000.');
    const sql = name === 'update_price'
      ? 'UPDATE products SET price_cents=$2 WHERE sku=$1 RETURNING sku,name,price_cents,stock'
      : 'UPDATE products SET stock=$2 WHERE sku=$1 RETURNING sku,name,price_cents,stock';
    const value = name === 'update_price' ? Math.round(args.price_rupees * 100) : args.quantity;
    const result = await pool.query(sql, [args.sku, value]);
    if (!result.rowCount) return { error: 'No product found for that SKU.' };
    await audit(name, args, 'allowed', 'Single-record update completed');
    return { updated: result.rows[0] };
  }
  if (name === 'delete_product' || name === 'empty_store') {
    const explicitlyEnabled = profile === 'unrestricted-demo' && destructiveEnabled;
    if (!explicitlyEnabled) {
      await audit(name, args, 'blocked', 'Destructive operation denied by server-side protected profile');
      return { blocked: true, reason: 'The server-side policy blocked this destructive operation. No database change was made.' };
    }
    if (name === 'empty_store' && args.confirmation_phrase !== 'EMPTY DISPOSABLE STORE') {
      await audit(name, args, 'blocked', 'Required exact confirmation phrase was not supplied');
      return { blocked: true, reason: 'To run this lab-only scenario, supply the exact confirmation phrase.' };
    }
    const result = name === 'delete_product'
      ? await pool.query('DELETE FROM products WHERE sku=$1 RETURNING sku,name', [args.sku])
      : await pool.query('DELETE FROM products RETURNING sku');
    await audit(name, args, 'allowed', 'Destructive action executed against the disposable Swaggy database');
    return { deleted_count: result.rowCount, deleted: result.rows };
  }
  throw new Error('Unknown tool');
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, profile }); }
  catch { res.status(503).json({ ok: false }); }
});
app.get('/api/products', async (_req, res) => {
  const result = await pool.query('SELECT sku,name,description,category,price_cents,stock FROM products ORDER BY id');
  res.json(result.rows.map(p => ({ ...p, price_rupees: p.price_cents / 100 })));
});
app.get('/api/activity', async (_req, res) => {
  const result = await pool.query('SELECT id,created_at,action,arguments,profile,decision,detail FROM agent_audit ORDER BY id DESC LIMIT 30');
  res.json(result.rows);
});

app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim().slice(0, 4000);
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Add OPENAI_API_KEY to .env to enable Swaggy. Product browsing remains available.' });
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const messages = [
    { role: 'system', content: 'You are Swaggy, a friendly AI employee for a fictional Docker merchandise store. You can look up products and make product price or inventory changes. Be transparent about every action. Never claim an operation succeeded unless its tool result confirms it. Destructive tools may be blocked by server policy; explain the result honestly. The database contains synthetic lab data only. Do not reveal secrets or invent customer/order capabilities. Prices are in INR.' },
    { role: 'user', content: message }
  ];
  const trace = [];
  try {
    for (let step = 0; step < 5; step++) {
      const response = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.2 })
      });
      if (!response.ok) throw new Error('Model endpoint returned HTTP ' + response.status);
      const data = await response.json();
      const assistant = data.choices?.[0]?.message;
      if (!assistant) throw new Error('The model returned no message.');
      messages.push(assistant);
      if (!assistant.tool_calls?.length) return res.json({ reply: assistant.content || 'I could not generate a response.', trace, profile });
      for (const call of assistant.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }
        let result;
        try { result = await runTool(call.function.name, args); }
        catch (error) { result = { error: error.message }; await audit(call.function.name, args, 'error', error.message); }
        trace.push({ tool: call.function.name, arguments: args, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    res.json({ reply: 'I reached the tool-call limit for this turn. Please narrow the request.', trace, profile });
  } catch (error) {
    res.status(502).json({ error: error.message, trace, profile });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log('Swaggy API listening on ' + PORT + ' (' + profile + ')'));
