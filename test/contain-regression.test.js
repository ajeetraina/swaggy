// Contain (C1) regression guard. Fails if the Compose files ever mount the
// Docker socket or a host home directory, or if the sandbox network loses
// `internal: true`. These are the boundaries the workshop teaches; this test
// makes weakening them a visible, failing change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(path.join(ROOT, f), 'utf8');
const base = read('docker-compose.yml');
const sandbox = read('docker-compose.sandbox.yml');
const both = base + '\n' + sandbox;

test('no Docker socket is mounted', () => {
  assert.ok(!/docker\.sock/.test(both), 'a Compose file references the Docker socket');
});

test('no host home directory is mounted', () => {
  // Reject home-directory mounts in either direction. The sandbox override's
  // single, specific CA-cert file mount is intentionally not a home dir.
  for (const pattern of [/\$HOME/, /\$\{HOME\}/, /~\//, /\/Users\//, /\/home\//, /\/root\//]) {
    assert.ok(!pattern.test(both), `a Compose file mounts a host home path matching ${pattern}`);
  }
});

test('the sandbox network keeps internal: true', () => {
  assert.match(base, /sandbox:\s*\n\s*internal:\s*true/, 'the sandbox network must stay internal: true');
});

test('the sandbox worker workspace mount stays read-only', () => {
  assert.match(base, /\/workspace:ro/, 'the worker workspace mount must remain :ro');
});
