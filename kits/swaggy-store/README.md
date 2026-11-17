# Kit: swaggy-store

The default Swaggy agent — a store employee that can inspect the catalogue and
request business changes.

| | |
|---|---|
| **Name** | `swaggy-store` |
| **Role** | Store assistant (read + request mutations) |
| **Requested tools** | `list_products`, `update_price`, `set_inventory`, `read_workspace_file`, `check_network_egress` |
| **Default model** | `gpt-4o-mini` (the real model is whatever `OPENAI_MODEL` points the provider at) |

## What it can and cannot do

- Looks up products and stock (`list_products`).
- Requests price / inventory changes — these never apply directly; they enter
  the human approval queue (Coordinate).
- Reads the read-only public fixture workspace and runs the fixed network probe.
- Has **no** destructive tools. `delete_product` / `empty_store` are not in any
  kit allowlist; in the default `protected` profile they are blocked and, even
  if a prompt injection asks for them, the server denies the call and audits it.

## The rules still win

This file only *requests* tools. The authority is
[`rules/sandbox-rules.yaml`](../../rules/sandbox-rules.yaml), mounted read-only
into the API. The effective tool set is the **intersection** of the list above
and the rules' ceiling, enforced in trusted server code — not in the prompt.
Swapping to [`swaggy-auditor`](../swaggy-auditor/README.md) changes the tools;
it does not change the rules.

See [`docs/KITS.md`](../../docs/KITS.md) for how this maps to the Docker Sandbox
Kit format and how to build/share a kit.
