#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  docker compose down -v
}
trap cleanup EXIT

echo "Starting Swaggy Compose stack"
docker compose up -d --build

health_file="$(mktemp)"
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:4000/api/health > "$health_file"; then
    break
  fi
  sleep 2
done

node --input-type=module - "$health_file" <<'NODE'
import { readFile } from 'node:fs/promises';
const health = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (!health.ok || health.sandbox !== 'online') {
  console.error('API or sandbox worker is unhealthy:', health);
  process.exit(1);
}
console.log('PASS: API and sandbox worker are healthy.');
NODE

echo "Checking allowed and denied filesystem paths"
docker compose exec -T sandbox-worker node --input-type=module -e "const allowed = await fetch('http://127.0.0.1:4100/v1/files?path=README.md'); console.log('Allowed fixture HTTP status:', allowed.status); if (!allowed.ok) process.exit(1); const denied = await fetch('http://127.0.0.1:4100/v1/files?path=%2Fetc%2Fpasswd'); console.log('Outside path HTTP status:', denied.status); if (denied.status !== 403) process.exit(1);"

echo "Checking outbound network isolation"
docker compose exec -T sandbox-worker node --input-type=module -e "try { const response = await fetch('https://example.com/', { signal: AbortSignal.timeout(2500) }); console.error('Unexpected external network access:', response.status); process.exit(1); } catch (error) { console.log('PASS: outbound network denied:', error.cause?.code || error.name); }"

echo "Checking read-only fixture mount"
docker compose exec -T sandbox-worker node --input-type=module -e "import { writeFile } from 'node:fs/promises'; try { await writeFile('/workspace/README.md', 'tamper'); console.error('Unexpectedly wrote to read-only workspace'); process.exit(1); } catch (error) { console.log('PASS: fixture mount is read-only:', error.code || error.name); }"

echo "Sandbox runtime boundary smoke tests passed."
