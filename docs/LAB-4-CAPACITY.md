# Lab 4 — Capacity: Put limits around resource use and action volume

**Goal:** demonstrate that an agent and its supporting worker need finite resource and action budgets.

## Why capacity matters

An agent can be inefficient, loop, request too much data, or generate excessive tool activity. Resource ceilings and per-request limits reduce the impact of mistakes and runaway behavior.

## Inspect the configured limits

Open the Capacity page and inspect docker-compose.yml, api/server.js, and sandbox/server.js.

| Limit | Configured value | Why it matters |
|---|---:|---|
| Worker memory | 256 MiB | Caps worker memory use |
| Worker CPU | 0.50 CPU | Caps CPU allocation |
| Worker PIDs | 64 | Limits process creation |
| Worker /tmp | 16 MiB | Bounds temporary storage |
| File read | 16 KiB | Prevents large workspace reads |
| User message | 4,000 characters | Bounds prompt size |
| Tool calls per turn | 8 | Bounds tool execution count |

These are the configured workshop limits. They are not a complete denial-of-service defense or a substitute for host-level monitoring.

## Exercise A — Inspect the runtime configuration

From the repository root:

~~~bash
docker compose config
docker compose ps
~~~

Locate mem_limit, cpus, pids_limit, and the /tmp tmpfs setting under sandbox-worker.

## Exercise B — Observe bounded file reads

Ask:

~~~text
Read README.md from the sandbox workspace.
~~~

The worker returns a small text file and enforces a maximum response size of 16 KiB. The public fixture is read-only.

## Exercise C — Discuss action budgets

Ask the group what should happen if a model tries to:
- call tools repeatedly in one turn;
- send a very large prompt;
- read a huge file;
- spawn many processes or consume all available memory.

Expected answer: bound inputs, tool calls, file sizes, CPU, memory, PIDs, and temporary storage. Add timeouts, rate limits, monitoring, and cancellation in a production system.

## Success criteria

- [ ] Locate the CPU, memory, PID and tmpfs limits.
- [ ] Identify the 16 KiB file-read ceiling.
- [ ] Identify the 4,000-character prompt and 8-call tool budget.
- [ ] Explain why capacity limits reduce impact but do not establish authorization.

## Discussion

Capacity is about resilience and bounded consumption. It complements Contain (where the agent runs) and Control (what it may do).
