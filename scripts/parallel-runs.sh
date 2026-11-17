#!/usr/bin/env bash
# Capacity (C4): start N concurrent Swaggy runs and report each run's id, status
# and tool-call count. Demonstrates running work in parallel and the
# MAX_CONCURRENT_RUNS cap (runs over the cap get HTTP 429, reported as THROTTLED,
# not a failure). Exits non-zero on unexpected failures.
#
#   scripts/parallel-runs.sh [N]        # N concurrent runs (default 3)
#   API_URL=http://127.0.0.1:4000 AGENT=swaggy-auditor scripts/parallel-runs.sh 5
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000}"
N="${1:-3}"
AGENT="${AGENT:-swaggy-auditor}"
MESSAGE="${MESSAGE:-How many products are in the catalogue? Read only, do not change anything.}"

if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 1 ]; then
  echo "Usage: $0 [N]  (N must be a positive integer)" >&2
  exit 2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Starting $N concurrent runs against $API as agent '$AGENT'"

for i in $(seq 1 "$N"); do
  rid="$(node -e 'console.log(require("crypto").randomUUID())')"
  echo "$rid" > "$tmp/$i.rid"
  payload="$(MESSAGE="$MESSAGE" RID="$rid" AGENT="$AGENT" node -e 'process.stdout.write(JSON.stringify({message:process.env.MESSAGE,run_id:process.env.RID,agent:process.env.AGENT}))')"
  (
    code="$(curl -s -o "$tmp/$i.json" -w '%{http_code}' -X POST "$API/api/chat" \
      -H 'content-type: application/json' --data "$payload" || echo "000")"
    echo "$code" > "$tmp/$i.code"
  ) &
done
wait

echo
TMP="$tmp" N="$N" node --input-type=module - <<'NODE'
import { readFileSync, existsSync } from 'node:fs';
const tmp = process.env.TMP, n = Number(process.env.N);
const rows = [];
let unexpected = 0, throttled = 0, ok = 0;
for (let i = 1; i <= n; i++) {
  const rid = existsSync(`${tmp}/${i}.rid`) ? readFileSync(`${tmp}/${i}.rid`, 'utf8').trim() : '?';
  const code = existsSync(`${tmp}/${i}.code`) ? readFileSync(`${tmp}/${i}.code`, 'utf8').trim() : '000';
  let body = {};
  try { body = JSON.parse(readFileSync(`${tmp}/${i}.json`, 'utf8')); } catch {}
  let status, tools = '-';
  if (code === '200') { status = body.status || 'completed'; tools = Array.isArray(body.trace) ? body.trace.length : 0; ok++; }
  else if (code === '429') { status = 'THROTTLED (429, cap reached)'; throttled++; }
  else if (code === '503') { status = 'MODEL NOT CONFIGURED (503)'; unexpected++; }
  else { status = `UNEXPECTED (HTTP ${code})`; unexpected++; }
  rows.push({ run: (body.run_id || rid).slice(0, 8), code, status, tools });
}
const pad = (s, w) => String(s).padEnd(w);
console.log(pad('RUN', 10) + pad('HTTP', 6) + pad('TOOLS', 7) + 'STATUS');
for (const r of rows) console.log(pad(r.run, 10) + pad(r.code, 6) + pad(r.tools, 7) + r.status);
console.log(`\n${ok} ok, ${throttled} throttled, ${unexpected} unexpected`);
if (unexpected > 0) { console.error('FAIL: one or more runs failed unexpectedly.'); process.exit(1); }
console.log('PASS: parallel runs completed (throttling is expected above the cap).');
NODE
