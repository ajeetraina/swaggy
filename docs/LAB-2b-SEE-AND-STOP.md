# Lab 2b — Control: see and stop a run

**Goal:** go beyond the after-the-fact audit trail. Watch a run live and stop it
mid-flight — pause the next tool call, or kill the whole run — and see every
state change recorded.

## Background

Lab 2 showed that the server, not the model, decides what is allowed. This lab
adds the *operational* half of Control: live visibility and intervention. Each
`/api/chat` turn is a **run** with a client-generated id. The API tracks run
state in a `runs` table and an in-memory `AbortController`, checks that state
before every model step and every tool call, and streams each audit row to the
UI over Server-Sent Events.

Key endpoints (unauthenticated, local-lab only):

- `POST /api/chat` — accepts a `run_id`; returns `run_id` and `status`.
- `POST /api/runs/:id/pause` · `/resume` · `/kill`
- `GET /api/runs` — recent runs with status
- `GET /api/activity/stream` — SSE feed of audit events

## Exercise A — watch activity stream live

Open **Control** (or **Activity**). The header shows **● LIVE** when the SSE
stream is connected. Ask Swaggy:

~~~text
List all Docker apparel and their stock.
~~~

The `list_products` event appears in the feed immediately, with no refresh and
an `ALLOWED` badge.

## Exercise B — pause blocks the next tool call

Ask something that will take a tool call, and while it is in flight use the
**Pause** control (on the chat view's live run indicator, or the Runs panel on
Control):

~~~text
Read README.md from the sandbox workspace, then list all products.
~~~

Expected: the run pauses. The next tool call is **not** executed; the trace
shows `{blocked: true, reason: "Run is paused by a reviewer"}` and the audit log
records a `paused` decision with the before/after run status. Press **Resume**
and the run continues from where it paused.

## Exercise C — kill aborts the run

Start another run and press **Kill**:

~~~text
List all products and their stock.
~~~

Expected: the run aborts (the in-flight model request is cancelled), the reply
says the run was stopped by a reviewer, the run's status becomes `killed`, and
the audit log records `killed` with before/after status.

## Exercise D — the concurrency cap

The API caps simultaneous runs at `MAX_CONCURRENT_RUNS` (default 4), shown on
the Capacity page. Start more at once than the cap (see Lab 6's
`scripts/parallel-runs.sh`) and the extra runs get HTTP 429 — a bounded,
observable back-pressure signal rather than unbounded fan-out.

## Success criteria

- [ ] Activity updates live over SSE without a manual refresh.
- [ ] Pause blocks the next tool call; Resume continues the run.
- [ ] Kill aborts the run and records `killed`.
- [ ] Every pause, resume and kill appears in the audit log with before/after
      run status.

## Discussion

Observability and a stop button are part of the control surface, not an add-on.
If you cannot see what an agent is doing and cannot stop it, you are trusting the
model to stop itself. The pause/kill decisions live in trusted server code and
are audited exactly like tool calls.

> These control endpoints are unauthenticated and bound to localhost for a
> trusted local lab, like the approval endpoints. They are not a production
> operator console.
