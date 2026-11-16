# Swaggy 5Cs Workshop Labs

A hands-on workshop for understanding the five security principles for AI agents through one fictional Docker merchandise store.

## Start here

1. [Facilitator run sheet](FACILITATOR-GUIDE.md) — a ready-to-deliver 30-minute session.
2. [Lab 1 — Contain](LAB-1-CONTAIN.md) — filesystem and network isolation.
3. [Lab 2 — Control](LAB-2-CONTROL.md) — tool allowlists, policy enforcement, prompt injection and denied access.
4. [Lab 3 — Choice](LAB-3-CHOICE.md) — choose a model/provider and deliberately expose capabilities.
5. [Lab 4 — Capacity](LAB-4-CAPACITY.md) — resource and action budgets.
6. [Lab 5 — Coordinate](LAB-5-COORDINATE.md) — human approval and auditability.

## Before the workshop

~~~bash
git clone https://github.com/ajeetraina/swaggy.git
cd swaggy
cp .env.example .env
# Add a model API key to .env for the live assistant demo.
docker compose up --build
~~~

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
