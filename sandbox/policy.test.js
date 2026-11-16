import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, symlink, rm, realpath } from 'node:fs/promises';
import { resolveWorkspacePath, isWithinWorkspace } from './policy.js';

test('allows a relative file inside the workspace', () => {
  const root = path.resolve('/tmp/swaggy-workspace');
  assert.equal(resolveWorkspacePath(root, 'README.md'), path.join(root, 'README.md'));
});

test('rejects parent traversal', () => {
  const root = path.resolve('/tmp/swaggy-workspace');
  assert.throws(() => resolveWorkspacePath(root, '../secrets.txt'));
});

test('rejects absolute paths outside the workspace', () => {
  const root = path.resolve('/tmp/swaggy-workspace');
  assert.throws(() => resolveWorkspacePath(root, '/etc/passwd'));
});

test('detects a symlink that resolves outside the workspace', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'swaggy-policy-'));
  const root = path.join(temp, 'workspace');
  const outside = path.join(temp, 'outside');
  try {
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, path.join(root, 'escape'));
    const lexical = resolveWorkspacePath(root, 'escape');
    const resolved = await realpath(lexical);
    assert.equal(isWithinWorkspace(root, lexical), true);
    assert.equal(isWithinWorkspace(root, resolved), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
