# Kit: swaggy-auditor

A second, deliberately different agent: a **read-only reviewer**. Same store,
same rules file — a smaller allowlist.

| | |
|---|---|
| **Name** | `swaggy-auditor` |
| **Role** | Read-only reviewer |
| **Requested tools** | `list_products`, `read_workspace_file` |
| **Default model** | `gpt-4o-mini` |

## The point of this kit

Swapping from `swaggy-store` to `swaggy-auditor` changes **which agent** runs
and **which tools** it is offered — without touching the rules. The auditor is
granted no mutation tools:

- It can list products and read the public workspace.
- It has **no** `update_price` or `set_inventory`. Ask it to change a price and
  the server denies the call (the tool is outside the auditor's effective
  allowlist) and records the denial in the audit log.

This is the Choice principle: the agent is a swappable, packaged unit; the rules
that bound every agent are fixed and live outside the agent's control. See
[`rules/sandbox-rules.yaml`](../../rules/sandbox-rules.yaml) and
[`docs/KITS.md`](../../docs/KITS.md).
