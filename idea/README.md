## Goal

Swaggy is a disposable AI store assistant used to teach agent safety. It currently demonstrates **Contain** well, but only partly demonstrates **Control**, **Choice** and **Capacity** as Docker's keynote defines them. Implement what is missing so each of the four Cs is a strong, live-demonstrable feature. Keep the existing **Coordinate** page (human approvals and audit trail) as Swaggy's fifth C.

Keynote definitions to match:

- **Contain**: know where agents can act. (Already strong. Do not regress it.)
- **Control**: see and stop agent activity.
- **Choice**: choose the agent, model and tools.
- **Capacity**: run work beyond a single laptop.

## Read first (do not skip)

Read these before changing anything: `README.md`, `docs/FACILITATOR-GUIDE.md`, `docs/LAB-1..5-*.md`, `api/server.js`, `api/schema.sql`, `web/src/App.jsx`, `web/src/styles.css`, `docker-compose.yml`, `docker-compose.sandbox.yml`, `sbxenv.yaml`, `sandbox/server.js`, `sandbox/policy.js`, `sandbox/policy.test.js`, `scripts/compose-smoke.sh`, `.github/workflows/ci.yml`. Then write a short plan and wait for no one: proceed, but commit in the order below.

## Hard constraints (existing safety principles — keep all of them)

- Synthetic data only. Never point at production resources.
- No host Docker socket mount, no host home mount, no host-shell tool.
- Treat model output and tool arguments as untrusted. Enforce policy in trusted server code, never in the prompt.
- Default profile stays `protected`. Destructive tools stay blocked unless both `SECURITY_PROFILE=unrestricted-demo` and `ALLOW_DESTRUCTIVE_DEMO=true`.
- Never log or display API keys. `/api/health` must keep reporting provider host only.
- The new control endpoints are unauthenticated lab endpoints like the existing approval endpoints. Keep ports bound to `127.0.0.1` by default and state this caveat in the docs. Do not claim production readiness.
- Do not invent Docker CLI flags or Kit formats. Verify against current docs (https://docs.docker.com/ai/sandboxes/ and https://docs.docker.com/agentic-platform/) before writing commands. If you cannot verify something, document it as "to verify" rather than guessing.
- Keep dependencies minimal. Match the existing code style (plain Node ESM in `api/`, React + Vite in `web/`).

## Work item 1 — Control: see and stop

Today Swaggy records an audit trail and shows it after the fact. Add **live visibility** and **pause / kill**.

API (`api/server.js`, `api/schema.sql`):

1. Add a `runs` table: `id text primary key, status text check in ('running','paused','killed','completed'), agent text, started_at, ended_at`. Add an idempotent migration path (the schema only seeds on first DB init, so also create-if-not-exists at API startup).
2. `POST /api/chat` accepts an optional client-generated `run_id` (uuid). Create the run row, keep an in-memory `Map` of active runs with an `AbortController`, and return `run_id` in the response.
3. Before **every** model step and **every** tool call in the loop, check run state:
   - `paused`: do not execute the tool. Return a `blocked` tool result `{blocked:true, reason:'Run is paused by a reviewer'}`, audit with decision `paused`, and stop the loop with a clear reply.
   - `killed`: abort any in-flight model `fetch` via the `AbortController`, audit decision `killed`, mark the run `killed`, and return immediately.
4. Endpoints: `POST /api/runs/:id/pause`, `POST /api/runs/:id/resume`, `POST /api/runs/:id/kill`, `GET /api/runs` (recent runs with status). Validate ids, return 404/409 correctly, audit every state change.
5. `GET /api/activity/stream`: Server-Sent Events that push each new `agent_audit` row as it is written (emit from the `audit()` helper via an in-process `EventEmitter`). Send a heartbeat comment every 15s. Keep `GET /api/activity` unchanged.
6. Add a concurrency cap `MAX_CONCURRENT_RUNS` (default 4). Over the cap, `/api/chat` returns 429 with a clear message. Expose the value in `/api/health`.

UI (`web/src/App.jsx`, `web/src/styles.css`):

7. On the **Control** page and the **Activity** page, replace polling with the SSE stream (fall back to polling if SSE fails). Show each event live with its decision badge (allowed, blocked, pending_approval, approved, rejected, paused, killed).
8. Add a **Runs** panel with Pause / Resume / Kill buttons for each active run. The assistant chat view shows a live run indicator with its own Pause and Kill controls.

Tests: add API tests (Node test runner) covering: pause blocks the next tool call, resume continues, kill aborts the run and records `killed`, concurrency cap returns 429, SSE emits an event after a tool call. Mock the model endpoint so tests are deterministic.

## Work item 2 — Choice: swap the agent, keep the rules

Today only the model/provider is configurable; the agent and tool surface are fixed in code. Make the **agent** a swappable, packaged unit while the **rules** stay fixed and outside the agent's control.

1. Create `kits/` with two agent definitions, each a directory:
   - `kits/swaggy-store/` — the current agent: system prompt, tool allowlist (`list_products`, `update_price`, `set_inventory`, `read_workspace_file`, `check_network_egress`), default model.
   - `kits/swaggy-auditor/` — a second, different agent: read-only reviewer prompt, tool allowlist limited to `list_products` and `read_workspace_file`.
   Each has an `agent.yaml` (name, description, system prompt file, tools, default model) and a `README.md`.
2. Create `rules/sandbox-rules.yaml`: the authority that applies to **every** agent regardless of kit — allowed tools ceiling, filesystem scope (`/workspace` read-only), network policy (worker has no egress; model provider host allowlisted), approval-required actions, destructive-profile gating. This file is mounted read-only into the API container and is **not** editable through the API or the agent.
3. API loads agent definitions at startup. The effective tool set for a run is the **intersection** of the kit's allowlist and the rules' ceiling. A tool outside either is never offered to the model and, if the model requests it anyway, is denied server-side and audited. Add `GET /api/agents` and make `/api/chat` accept `agent` (default `swaggy-store`). `/api/health` reports the active agent, model, provider host and effective tools.
4. UI **Choice** page: an agent selector (kit A / kit B), the model/provider display, the effective tool list for the selected agent, and a side-by-side view showing "Kit differs / Rules identical". Selecting `swaggy-auditor` and asking it to change a price must be denied by the server and audited.
5. Kit packaging: research the current Docker Sandbox Kit format (OCI image) in the official docs. If it is documented well enough, add a `kits/Dockerfile` or build script and a short `docs/KITS.md` showing how to build and share each Kit and how to run it in a sandbox. If the format is not clearly documented, write `docs/KITS.md` stating exactly what is unverified and keep the `agent.yaml` layout as the local equivalent. Do not fabricate Kit manifest fields.

Tests: swapping the agent changes the offered tools but not the rules; the auditor cannot call `update_price`; the store agent still creates a pending approval; destructive tools remain blocked in the protected profile for both agents.

## Work item 3 — Capacity: scale out beyond the laptop

Today Capacity means per-run limits (kept). Add the keynote meaning: **run the same sandbox in Docker-managed cloud compute and run work in parallel.**

1. Keep the existing ceilings (256 MiB, 0.5 CPU, 64 PIDs, 16 MiB `/tmp`, 16 KiB file read, 4,000-char message, 8 tool calls per turn) and surface them on the Capacity page as "Limits per run".
2. Add a **Scale out** section to the Capacity page showing: the concurrency cap from item 1, the number of active runs, and a step-by-step "Move this sandbox to the cloud" guide.
3. Add `scripts/parallel-runs.sh`: start N concurrent chat runs against the API (default 3), each asking the store agent a harmless read-only question, and print each run's id, status and tool-call count. It must respect the 429 cap and exit non-zero on unexpected failures.
4. Add `docs/LAB-6-SCALE-OUT.md` covering: run Swaggy locally in a sandbox, then move it with `sbx move NAME --to cloud`, attach with `sbx --cloud attach NAME`, set cloud credentials with `sbx --cloud secret set`, and run parallel work. Verify every command against `sbx --help`, `sbx --cloud --help` and the official docs. Note that cloud sandboxes require a Docker Agentic Platform subscription and that cloud credentials are separate from local ones. Mark any step you could not run yourself as "not verified in this environment".
5. Update `sbxenv.yaml` comments only if the verified docs justify it. Do not change ports or add host mounts.

## Work item 4 — Contain: no regression, add proof

1. Do not weaken any existing boundary. Add a test that fails if the compose file ever mounts the Docker socket or a host home directory, or removes `internal: true` from the `sandbox` network.
2. On the Contain page, add a small "Verified" panel that calls a new `GET /api/contain/status` returning booleans derived from the live `docker compose config` equivalents the API can know about (worker reachable, worker egress blocked via the existing probe, read-only workspace). Do not shell out to the host.

## Docs, CI and slides alignment

- Update `README.md`: describe all four keynote Cs plus Coordinate, new endpoints, new env vars (`MAX_CONCURRENT_RUNS`), `kits/`, `rules/`, and the new scripts. Keep the "workshop prototype, not production" boundaries section and add the new unauthenticated endpoints to it.
- Add `docs/LAB-2b-SEE-AND-STOP.md`, `docs/LAB-3b-SWAP-THE-AGENT.md`, and `docs/LAB-6-SCALE-OUT.md`. Update `docs/README.md` and `docs/FACILITATOR-GUIDE.md` run-of-show (keep it to 30 minutes; trim, do not extend).
- Extend `scripts/compose-smoke.sh` and `.github/workflows/ci.yml` to run the new API tests and the contain regression test. Do not require an OpenAI key in CI.
- Add a short `docs/FOUR-CS-MAP.md` table: keynote C → Swaggy page → mechanism → how to demo it live → what it does **not** prove.

## Acceptance checklist (verify each one yourself and report results)

- [ ] Control: while a chat run is in flight, Pause stops the next tool call; Kill aborts and records `killed`; the Activity page updates live without refresh.
- [ ] Control: every pause, resume and kill appears in the audit log with before/after run status.
- [ ] Choice: switching to `swaggy-auditor` changes the tool list; asking it to change a price is denied and audited; the rules file is shown as identical for both agents.
- [ ] Choice: the agent cannot read or modify `rules/sandbox-rules.yaml` through any tool or endpoint.
- [ ] Capacity: more than `MAX_CONCURRENT_RUNS` simultaneous runs get 429; `scripts/parallel-runs.sh` runs 3 in parallel and reports results.
- [ ] Capacity: `docs/LAB-6-SCALE-OUT.md` commands are checked against the CLI help or clearly marked unverified.
- [ ] Contain: the regression test passes; no socket or home mounts; worker still has no internet route.
- [ ] `protected` profile still blocks `delete_product` and `empty_store`; price and stock changes still go to the approval queue.
- [ ] `docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d --build` works inside a sandbox; `/api/health` is ok.
- [ ] All tests and the smoke script pass.

## Deliverable format

Work on a branch `feat/four-cs`. Make one commit per work item with a clear message. At the end, print: what changed per C, how to demo each C live in under two minutes, anything you could not verify, and any decision where you deviated from this prompt and why.
