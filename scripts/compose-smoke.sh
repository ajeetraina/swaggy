#!/usr/bin/env bash
set -euo pipefail

docker compose up -d --build

cleanup() {
  docker compose down -v
}
trap cleanup EXIT

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
console.log('API and sandbox worker are healthy.');
NODE

docker compose exec -T sandbox-worker node --input-type=module -e "try { await fetch('https://example.com/', { signal: AbortSignal.timeout(2500) }); process.exit(1); } catch { process.exit(0); }"

docker compose exec -T sandbox-worker node --input-type=module -e "import { writeFile } from 'node:fs/promises'; try { await writeFile('/workspace/README.md', 'tamper'); process.exit(1); } catch { process.exit(0); }"

echo "Sandbox runtime boundary smoke tests passed."
