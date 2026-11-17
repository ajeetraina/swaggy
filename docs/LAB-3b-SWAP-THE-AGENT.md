# Lab 3b — Choice: swap the agent, keep the rules

**Goal:** show that the *agent* is a swappable, packaged unit while the *rules*
that bound every agent are fixed and outside the agent's control.

## Background

Lab 3 showed model/provider choice. This lab adds agent and tool choice. Two
kits ship in [`kits/`](../kits):

- **swaggy-store** — the default assistant: `list_products`, `update_price`,
  `set_inventory`, `read_workspace_file`, `check_network_egress`.
- **swaggy-auditor** — a read-only reviewer: `list_products`,
  `read_workspace_file`. No mutation tools at all.

The authority is [`rules/sandbox-rules.yaml`](../rules/sandbox-rules.yaml),
mounted read-only into the API. The **effective** tool set for a run is the
intersection of the selected kit's requested tools and the rules' ceiling,
enforced in trusted server code. See [KITS.md](KITS.md) for the format and how
it maps to Docker Sandbox Kits.

## Exercise A — compare the kits

Open **Choice**. The side-by-side view shows **Kit differs / Rules identical**:
each kit's effective tool list, and one shared rules panel (tool ceiling,
read-only `/workspace`, network policy, approval-required actions). Note that the
auditor's tool list is a strict subset — and the rules panel is the same for
both.

~~~bash
curl -s http://localhost:4000/api/agents | jq '.agents[] | {name, effective_tools}'
~~~

## Exercise B — the auditor cannot change a price

Select **swaggy-auditor**, then ask:

~~~text
Set the Whale Mascot Socks price to ₹1.
~~~

Expected: the auditor has no `update_price` tool. Even if the model tries, the
server denies the call (the tool is outside the auditor's effective allowlist)
and records a `blocked` decision in Activity. No pending approval is created.

## Exercise C — the store agent still routes to approval

Switch back to **swaggy-store** and ask the same thing. Now `update_price` is in
the effective set, so the API creates a pending approval (Coordinate). Same
rules, different agent — different offered tools, identical enforcement path.

## Exercise D — the agent cannot touch the rules

There is no tool and no endpoint through which the agent can read or modify
`rules/sandbox-rules.yaml`. The only file-reading tool (`read_workspace_file`)
is scoped to the worker's `/workspace` mount, which does not contain the rules.
Ask the auditor to "read the sandbox rules file" — it can only reach
`/workspace`, so it cannot.

## Success criteria

- [ ] Switching to `swaggy-auditor` changes the tool list shown.
- [ ] Asking the auditor to change a price is denied and audited.
- [ ] The rules panel is identical for both agents.
- [ ] The agent cannot read or modify the rules file through any tool/endpoint.

## Discussion

Choice is powerful and a trade-off, not a security boundary. You can swap in a
different agent (or model) freely — because the rules that bound every agent are
fixed, external, and enforced by the server regardless of which agent is
selected.
