import path from 'node:path';

export function isWithinWorkspace(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

export function resolveWorkspacePath(root, requested) {
  const candidate = path.resolve(root, String(requested || ''));
  if (!isWithinWorkspace(root, candidate)) {
    throw new Error('Path is outside the mounted workspace.');
  }
  return candidate;
}
