# Kits: packaging the Swaggy agent

Swaggy's **Choice** principle treats the *agent* as a swappable, packaged unit
while the *rules* that bound every agent stay fixed. This document describes
Swaggy's local kit layout and how it maps to the Docker Sandbox Kit format.

## Swaggy's local kit layout (what the API loads)

Each agent lives in `kits/<name>/`:

```
kits/
  swaggy-store/
    agent.yaml         # name, description, system prompt file, tools, default model
    system-prompt.md
    README.md
  swaggy-auditor/
    agent.yaml
    system-prompt.md
    README.md
```

`agent.yaml` fields:

| Field | Meaning |
|---|---|
| `name` | Agent id used by `/api/chat` (`agent` field) and `/api/agents` |
| `description` | Shown in the Choice UI |
| `system_prompt_file` | Path, relative to the kit dir, of the system prompt |
| `default_model` | The model the kit prefers (the real model is whatever `OPENAI_MODEL` sets) |
| `tools` | The tools this kit **requests** |

The API loads these at startup. The **effective** tool set for a run is the
intersection of a kit's `tools` and the ceiling in
[`rules/sandbox-rules.yaml`](../rules/sandbox-rules.yaml), enforced in trusted
server code. The rules file is mounted read-only into the API container and is
not editable through the API or by any agent — no agent tool can reach it (the
only file-reading tool is scoped to the worker's `/workspace`, which does not
contain it).

Swap the agent at runtime from the Choice page, or directly:

```bash
curl -s http://localhost:4000/api/agents | jq
curl -s -X POST http://localhost:4000/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"set the socks to 1 rupee","agent":"swaggy-auditor"}' | jq '.trace'
```

The auditor has no `update_price`, so the server denies the call and audits it.

## Mapping to the Docker Sandbox Kit format

Docker Sandboxes package agents and mixins as **kit artifacts**: declarative
YAML plus an optional `files/` directory, distributed as OCI artifacts. Verified
against `sbx` `v0.54.0-rc7` (`sbx kit --help`, `sbx kit pack --help`,
`sbx run --help`) and <https://docs.docker.com/ai/sandboxes/>:

- The `sbx kit` command group is **experimental** (its help prints
  "EXPERIMENTAL: this command may change or be removed in future releases").
- `sbx kit pack DIRECTORY` validates and packages a directory that "must
  contain a valid `spec.yaml` and an optional `files/` directory" into a ZIP.
- `sbx kit push` / `sbx kit pull` move kit artifacts to/from an OCI registry;
  `sbx kit sign` / `sbx kit verify` / `sbx kit provenance` handle signing and
  SLSA provenance; `sbx kit validate` checks an artifact.
- `sbx run <agent> --kit <ref>` adds a mixin from a local directory/ZIP, Docker
  Hub, an OCI reference, or a git URL. `sbx run <KIT>` runs an agent kit.

**What is deliberately not reproduced here.** The exact field schema of a kit
`spec.yaml` (schemaVersion and the full set of keys for credentials, network
policy, env, startup commands, and files) is defined by the experimental
`sbx kit` tooling and is **not pinned in this repo** — it is the kind of thing
that changes between `sbx` releases. Rather than copy a `spec.yaml` schema that
could drift and mislead, Swaggy keeps `agent.yaml` as its own stable,
application-level descriptor and leaves authoring a real kit `spec.yaml` to the
tool that owns the schema.

If you want to build and share a real kit, use the tool as the source of truth:

```bash
# Author a kit directory with a spec.yaml (+ optional files/), then:
sbx kit validate ./my-kit
sbx kit pack ./my-kit --output dist/my-kit.zip
sbx kit push ./my-kit <oci-reference>        # share via a registry

# Run an agent with the kit (or as a mixin):
sbx run ./my-kit
sbx run claude --kit ./my-kit.zip
```

For the authoritative, current schema and a guided authoring flow, use the
`sbx kit` help on your installed version and the official docs. (If you have the
`kit-author` / `create-kit-v3` Claude skills available, they walk through the
v3 kit descriptor end to end.)

> **To verify in your environment.** `sbx kit` is experimental; confirm the
> `spec.yaml` schema and subcommands against your installed `sbx version` before
> relying on them. The `agent.yaml` layout above is Swaggy's own and does not
> depend on `sbx`.
