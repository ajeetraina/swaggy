import http from 'node:http';
import path from 'node:path';
import { resolveWorkspacePath, isWithinWorkspace } from './policy.js';
import { realpath, stat, readFile } from 'node:fs/promises';

const PORT = Number(process.env.PORT || 4100);
const ROOT = await realpath('/workspace');
const MAX_FILE_BYTES = 16 * 1024;

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, workspace: 'read-only' });
  }

  if (req.method === 'GET' && url.pathname === '/v1/files') {
    const requested = url.searchParams.get('path') || '';
    let candidate;
    try { candidate = resolveWorkspacePath(ROOT, requested); }
    catch { return send(res, 403, { blocked: true, reason: 'Path is outside the mounted workspace.' }); }
    if (!isWithinWorkspace(ROOT, candidate)) {
      return send(res, 403, { blocked: true, reason: 'Path is outside the mounted workspace.' });
    }
    try {
      const resolved = await realpath(candidate);
      if (!isWithinWorkspace(ROOT, resolved)) {
        return send(res, 403, { blocked: true, reason: 'Resolved path is outside the mounted workspace.' });
      }
      const info = await stat(resolved);
      if (!info.isFile()) return send(res, 400, { blocked: true, reason: 'Only regular files can be read.' });
      if (info.size > MAX_FILE_BYTES) return send(res, 413, { blocked: true, reason: 'File exceeds the 16 KiB read limit.' });
      const content = await readFile(resolved, 'utf8');
      return send(res, 200, { path: path.relative(ROOT, resolved), bytes: info.size, content });
    } catch (error) {
      return send(res, 404, { blocked: true, reason: 'File is not present in the mounted public workspace.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/network-check') {
    try {
      const response = await fetch('https://example.com/', {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(2500)
      });
      return send(res, 200, {
        reachable: true,
        blocked: false,
        status: response.status,
        target: 'https://example.com/',
        detail: 'The sandbox reached the fixed public test endpoint.'
      });
    } catch (error) {
      return send(res, 200, {
        reachable: false,
        blocked: true,
        target: 'https://example.com/',
        error_code: error.cause?.code || error.name || 'NETWORK_ERROR',
        detail: 'Outbound connectivity is unavailable from the sandbox worker network.'
      });
    }
  }

  return send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Swaggy sandbox worker listening on ' + PORT);
});