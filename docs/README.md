# Swaggy 5Cs Workshop Labs

A hands-on workshop for understanding the five security principles for AI agents through one fictional Docker merchandise store.

## Start here

1. [Facilitator run sheet](FACILITATOR-GUIDE.md) — a ready-to-deliver 30-minute session.
2. [The four Cs, mapped](FOUR-CS-MAP.md) — one table: principle → page → mechanism → live demo → limits.
3. [Lab 1 — Contain](LAB-1-CONTAIN.md) — filesystem and network isolation.
4. [Lab 2 — Control](LAB-2-CONTROL.md) — tool allowlists, policy enforcement, prompt injection and denied access.
   - [Lab 2b — See and stop](LAB-2b-SEE-AND-STOP.md) — live activity stream, pause/resume/kill, concurrency cap.
5. [Lab 3 — Choice](LAB-3-CHOICE.md) — choose a model/provider and deliberately expose capabilities.
   - [Lab 3b — Swap the agent](LAB-3b-SWAP-THE-AGENT.md) — swappable kits over fixed rules ([KITS.md](KITS.md)).
6. [Lab 4 — Capacity](LAB-4-CAPACITY.md) — resource and action budgets.
   - [Lab 6 — Scale out](LAB-6-SCALE-OUT.md) — parallel runs and moving the sandbox to the cloud.
7. [Lab 5 — Coordinate](LAB-5-COORDINATE.md) — human approval and auditability.

The keynote frames agent safety as **Contain, Control, Choice, Capacity**;
Swaggy keeps **Coordinate** (human approvals + audit) as a fifth C. The `b`/`6`
labs are the newer, live-demonstrable halves of Control, Choice and Capacity;
the facilitator guide folds them into the same 30 minutes.

## Before the workshop

Run the whole stack inside an isolated [Docker Sandbox](https://docs.docker.com/ai/sandboxes/)
microVM rather than on your host Docker daemon. Requires `sbx` 0.39.0+, signed
in (`sbx login`).

~~~bash
git clone https://github.com/ajeetraina/swaggy.git
cd swaggy
sbx run --clone claude .     # clones the repo into an isolated microVM
# then, inside the sandbox:
cp .env.example .env         # add a model API key for the live assistant demo
docker compose up -d --build
# back on your host, publish the ports (sandbox name is usually claude-swaggy):
sbx port publish claude-swaggy 5173:5173 4000:4000
~~~

`--clone` runs Swaggy on a private in-container clone of the repo, so your host
working tree is never mounted. Ports are not exposed automatically — publish
them from the host as shown. No `sbx`? See the Docker Compose fallback in the
[top-level README](../README.md#run-directly-with-docker-compose-fallback).

Open http://localhost:5173. Check http://localhost:4000/api/health. The health response should show ok=true, profile=protected, and sandbox=online.

No model key? The storefront and health/configuration remain available, but chat requires an OpenAI-compatible chat-completions endpoint with tool-calling support.

## Lab safety

Use only the synthetic, disposable Swaggy database. Keep SECURITY_PROFILE=protected and ALLOW_DESTRUCTIVE_DEMO=false for the standard workshop. Do not connect a real database, mount the Docker socket, expose the app publicly, or use real customer data. The approval API is unauthenticated and local-lab only.

## Suggested timing

| Segment | Time |
|---|---:|
| Store and threat model | 3 min |
| Contain | 5 min |
| Control | 7 min |
| Choice | 4 min |
| Capacity | 4 min |
| Coordinate | 5 min |
| Debrief | 2 min |

The five principles are complementary. A model can make a poor decision; the design goal is to ensure that decision cannot automatically become an unbounded action.
