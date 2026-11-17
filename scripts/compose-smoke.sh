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
# Retry briefly: just after recreate the worker can be health-ok before its
# read-only bind mount is fully serving files.
for attempt in $(seq 1 10); do
  if docker compose exec -T sandbox-worker node --input-type=module -e "const allowed = await fetch('http://127.0.0.1:4100/v1/files?path=README.md'); console.log('Allowed fixture HTTP status:', allowed.status); if (!allowed.ok) process.exit(1); const denied = await fetch('http://127.0.0.1:4100/v1/files?path=%2Fetc%2Fpasswd'); console.log('Outside path HTTP status:', denied.status); if (denied.status !== 403) process.exit(1);"; then
    break
  fi
  if [ "$attempt" -eq 10 ]; then echo "Fixture path check failed after retries" >&2; exit 1; fi
  sleep 1
done

echo "Checking outbound network isolation"
docker compose exec -T sandbox-worker node --input-type=module -e "try { const response = await fetch('https://example.com/', { signal: AbortSignal.timeout(2500) }); console.error('Unexpected external network access:', response.status); process.exit(1); } catch (error) { console.log('PASS: outbound network denied:', error.cause?.code || error.name); }"

echo "Checking read-only fixture mount"
docker compose exec -T sandbox-worker node --input-type=module -e "import { writeFile } from 'node:fs/promises'; try { await writeFile('/workspace/README.md', 'tamper'); console.error('Unexpectedly wrote to read-only workspace'); process.exit(1); } catch (error) { console.log('PASS: fixture mount is read-only:', error.code || error.name); }"

echo "Checking the four-Cs API surface (Control, Choice, Capacity, Contain)"
agents_file="$(mktemp)"; contain_file="$(mktemp)"
curl --fail --silent http://127.0.0.1:4000/api/agents > "$agents_file"
curl --fail --silent http://127.0.0.1:4000/api/contain/status > "$contain_file"
node --input-type=module - "$health_file" "$agents_file" "$contain_file" <<'NODE'
import { readFileSync } from 'node:fs';
const [health, agents, contain] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
// Capacity: the concurrency cap is surfaced. Control: run state is tracked.
if (!Number.isInteger(health.max_concurrent_runs)) { console.error('health is missing max_concurrent_runs', health); process.exit(1); }
// Choice: both kits load, with an identical rules ceiling.
const names = agents.agents.map(a => a.name).sort();
if (!(names.includes('swaggy-store') && names.includes('swaggy-auditor'))) { console.error('agents missing', names); process.exit(1); }
if (!Array.isArray(agents.rules.tool_ceiling) || agents.rules.tool_ceiling.length === 0) { console.error('rules ceiling missing', agents.rules); process.exit(1); }
const auditor = agents.agents.find(a => a.name === 'swaggy-auditor');
if (auditor.effective_tools.includes('update_price')) { console.error('auditor should not have update_price'); process.exit(1); }
// Contain: the running worker is reachable, egress-blocked and read-only.
if (!(contain.worker_reachable && contain.worker_egress_blocked && contain.workspace_read_only)) { console.error('contain status not fully verified', contain); process.exit(1); }
console.log('PASS: four-Cs API surface is healthy (agents, rules ceiling, concurrency cap, contain status).');
NODE

echo "Checking /api/runs is available"
curl --fail --silent http://127.0.0.1:4000/api/runs > /dev/null && echo "PASS: /api/runs responded."

echo "Running hermetic API tests and the containment regression test"
( cd api && npm ci --silent >/dev/null 2>&1 || npm install --silent >/dev/null 2>&1 )
node --test api/*.test.js
node --test test/*.test.js

echo "Sandbox runtime boundary and four-Cs smoke tests passed."
