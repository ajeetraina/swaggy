# Lab 6 — Capacity: scale out beyond the laptop

**Goal:** show the two halves of Capacity. First, the per-run ceilings that bound
a single run (kept from Lab 4). Second, the keynote meaning: run the *same*
sandbox in Docker-managed cloud compute, and run work in parallel.

> **Verification note.** CLI syntax below was checked against `sbx version`
> `v0.54.0-rc7` using `sbx --help`, `sbx move --help`, `sbx attach --help` and
> `sbx secret set --help`, plus <https://docs.docker.com/ai/sandboxes/>. Cloud
> sandboxes require a Docker **pay-as-you-go** subscription and use credentials
> **separate** from your local ones. Steps that need that subscription are
> marked **(not verified in this environment)** — run them yourself with an
> entitled account. Commands and flags can change between `sbx` releases;
> re-check with `sbx <cmd> --help`.

## Part A — limits per run (unchanged)

Open the **Capacity** page. The "Limits per run" cards show the ceilings that
bound a single run: 256 MiB memory, 0.5 CPU, 64 PIDs, a 16 MiB `/tmp`, a 16 KiB
file-read ceiling, a 4,000-character message, and 8 tool calls per turn. These
limit the blast radius of one run; they do not prove the run's intent is safe.

## Part B — run work in parallel (local)

The API caps simultaneous runs at `MAX_CONCURRENT_RUNS` (default 4). Over the
cap, `/api/chat` returns HTTP 429. The **Scale out** section of the Capacity page
shows the cap and the current number of active runs live.

Start several runs at once and watch them report:

```bash
scripts/parallel-runs.sh 3          # 3 concurrent read-only runs
API_URL=http://localhost:4000 scripts/parallel-runs.sh 6   # exceed the cap on purpose
```

Each run prints its id, HTTP code, tool-call count and status. Runs above the
cap come back as `THROTTLED (429)` — expected, not a failure. Watch the Control
page at the same time: the active runs appear and clear live.

## Part C — move the same sandbox to the cloud

The whole point: the identical Swaggy sandbox can run on Docker-managed cloud
compute instead of your laptop. `sbx move` captures the sandbox's filesystem as
an image and starts a new sandbox from it on the destination; running processes
and in-memory state do **not** travel, and the destination gets a new id.

1. **Store cloud credentials** (separate from local). Service secrets are
   injected by the proxy so the key never enters the sandbox:

   ```bash
   sbx --cloud secret set openai          # or: sbx --cloud secret set openai --oauth
   ```
   **(not verified in this environment — needs a cloud subscription)**

2. **Move your local sandbox up to the cloud.** Use the sandbox name from
   `sbx ls` (the Swaggy sandbox is usually `claude-swaggy`):

   ```bash
   sbx move claude-swaggy --to cloud --name swaggy-cloud
   # optional: --ttl 2h  --on-timeout stop
   ```
   Moving to cloud stops the local sandbox; restart it later with
   `sbx run --name claude-swaggy`. **(not verified in this environment)**

3. **Attach to the cloud sandbox** (starts it if stopped):

   ```bash
   sbx --cloud ls
   sbx --cloud attach swaggy-cloud
   ```
   **(not verified in this environment)**

4. **Bring the stack up in the cloud sandbox** exactly as locally — its own
   Docker daemon, nothing on your host:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d --build
   curl -fsS http://localhost:4000/api/health
   ```
   Publish ports and run `scripts/parallel-runs.sh` against the cloud API the
   same way. **(not verified in this environment)**

5. **Tidy up.** A stopped cloud source keeps its id and state:

   ```bash
   sbx --cloud ls
   sbx --cloud rm swaggy-cloud        # delete the cloud sandbox
   ```
   **(not verified in this environment)**

## What does not travel (verified from `sbx move --help`)

- Host bind mounts (including the workspace) and host port bindings.
- Secrets managed by `sbx` — the destination picks its own, so you may sign in
  again. This is why cloud credentials are set separately in step 1.
- Locally-added network rules; the kit's network rules do travel.
- Running processes and in-memory state — only the filesystem image moves.

## Success criteria

- [ ] `scripts/parallel-runs.sh 3` runs three reads in parallel and reports each
      run's id, status and tool-call count.
- [ ] Exceeding `MAX_CONCURRENT_RUNS` returns HTTP 429, shown as THROTTLED.
- [ ] You can explain how `sbx move --to cloud` relocates the *same* sandbox and
      what does not travel with it.
- [ ] Cloud steps are run with an entitled account, or acknowledged as requiring
      a cloud subscription.

## What this does NOT prove

Cloud capacity scales *where* and *how much* work runs; it does not make the
agent's decisions safe. Contain, Control, Choice and Coordinate still apply
identically in the cloud — the sandbox rules and approval queue travel with the
application, not with the host.
