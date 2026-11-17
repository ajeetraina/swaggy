# The four Cs, mapped to Swaggy (plus Coordinate)

Docker's keynote frames agent safety as **Contain, Control, Choice, Capacity**.
Swaggy keeps **Coordinate** (human approvals + audit) as a fifth C. This table
is the quick reference: each principle, where it lives in the app, the mechanism
that enforces it, how to demo it live in under two minutes, and — importantly —
what the demo does *not* prove.

| C | Swaggy page | Mechanism (enforced in trusted code) | Demo live (< 2 min) | What it does NOT prove |
|---|---|---|---|---|
| **Contain** — know where agents can act | Contain | Worker on an `internal: true` network (no egress), read-only `/workspace` mount, dropped caps, no socket/home mount. `GET /api/contain/status` reports it live. | Open Contain → "Verified boundaries" shows worker reachable / egress blocked / read-only. Ask "Try to read /etc/passwd" → denied. | That the host itself is hardened, or that a real production sandbox is in use. This is a Compose lab boundary. |
| **Control** — see and stop agent activity | Control, Activity | Per-run state (`runs` table + in-memory `AbortController`); pause blocks the next tool call, kill aborts the model fetch; audit streamed over SSE; `MAX_CONCURRENT_RUNS` → 429. | Ask a question, then on Control hit **Pause** (next tool blocks) or **Kill** (run aborts, audited `killed`). Activity updates with no refresh. | That the model will behave; Control bounds a run after the fact, it does not make the model's choices correct. |
| **Choice** — choose the agent, model and tools | Choice | Swappable kits (`kits/*/agent.yaml`); effective tools = kit ∩ `rules/sandbox-rules.yaml` ceiling, enforced server-side; rules mounted read-only, unreachable by any agent. | On Choice select **swaggy-auditor**, ask it to change a price → denied + audited. Toggle back to **swaggy-store** → same ask becomes a pending approval. Rules panel is identical for both. | That a "better" model is safe. Model/agent choice is a trade-off; least-privilege tools and server checks still apply. |
| **Capacity** — run work beyond one laptop | Capacity | Per-run ceilings (mem/CPU/PID/tmp/file/msg/tool budget) **plus** the concurrency cap and `sbx move --to cloud` to run the same sandbox on Docker-managed compute. | Run `scripts/parallel-runs.sh 6` → runs report id/status/tool count; over the cap come back `THROTTLED (429)`. Show the move-to-cloud guide. | That cloud scale makes the agent safe. Capacity scales *where/how much*; the other Cs still apply in the cloud. |
| **Coordinate** — keep humans in the loop | Coordinate, Activity | Consequential mutations become pending approvals; transactional approve/reject; every outcome audited. | Ask "Set the socks to ₹1" → pending. Approve one, reject another; Store/Activity reflect the outcome. | That approvals are production-grade. The approval endpoints are unauthenticated, local-lab only. |

## How the Cs compose

The point is defense in depth, not any single control. A model can make a poor
decision (Choice is a trade-off); the design goal is that the decision cannot
become an unbounded action — it is **contained** to the worker, **controlled**
(pausable/killable, observable), **capacity**-bounded, and for consequential
changes it needs a human to **coordinate**. Each C has an independent mechanism,
and each has a clear limit above.
