# Swaggy

**Your AI store assistant. Your security problem.**

Swaggy is a disposable AI-powered Docker merchandise store. Its assistant can read the catalogue and use business tools to change prices, adjust stock, and attempt destructive actions. The workshop explores what happens when those permissions are too broad—and how independent controls change the outcome.

## What is included

- React storefront with synthetic Docker-themed merchandise
- Chat assistant named **Swaggy**, using an OpenAI-compatible tool-calling API
- PostgreSQL-backed product and inventory tools
- Agent activity panel showing tool arguments, policy decisions, and results
- Human approval queue for product price and inventory changes
- Server-enforced `protected` and explicitly gated `unrestricted-demo` profiles
- Isolated sandbox worker with a read-only fixture mount, dropped Linux capabilities, read-only root filesystem and no outbound internet route
- Docker Compose stack with no host Docker socket mount

## Run in a Docker Sandbox (recommended)

Swaggy is a security workshop, so the whole stack runs *inside* an isolated
[Docker Sandbox](https://docs.docker.com/ai/sandboxes/) microVM — its own Docker
daemon, filesystem and network — rather than on your host Docker daemon. This is
the "Contain" principle in practice: nothing Swaggy builds or runs can touch the
host.

Requirements: `sbx` 0.39.0 or later, signed in (`sbx login`). Install with
`brew install docker/tap/sbx` (macOS) — Docker Desktop is not required.

### Start the sandbox and application

From the repository root on your host:

```bash
git clone https://github.com/ajeetraina/swaggy.git
cd swaggy
sbx run --clone claude .
```

`--clone` gives the sandbox a private clone of this Git repository, so your host
working tree is never mounted or modified. You land in the agent session inside
the sandbox.

Then, inside the sandbox, bring up the stack with Compose:

```bash
cp .env.example .env            # then add your OPENAI_API_KEY
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:4000/api/health
```

### Reach the storefront from your host

Ports are not exposed automatically. From your host, publish the sandbox's
storefront and API ports (find the sandbox name with `sbx ls` — it defaults to
`claude-swaggy`):

```bash
sbx port publish claude-swaggy 5173:5173 4000:4000
```

Now open the storefront at [http://localhost:5173](http://localhost:5173). The
API health endpoint is
[http://localhost:4000/api/health](http://localhost:4000/api/health).

> Declarative alternative: [`sbxenv.yaml`](sbxenv.yaml) describes the same
> environment and its port forwards. Run `sbx env run --clone` instead, and
> `sbx` provisions the sandbox and publishes ports `5173`/`4000` for you.

To reset the disposable database and reseed the catalogue, inside the sandbox:

```bash
docker compose down -v
docker compose up -d --build
```

Tear the whole sandbox down from the host when you are done:

```bash
sbx rm claude-swaggy
```

## Run directly with Docker Compose (fallback)

If you cannot use Docker Sandboxes, you can still run the stack directly on a
host with Docker Desktop (or Docker Engine) and Compose:

```bash
cp .env.example .env     # then add your OPENAI_API_KEY
# set BIND_HOST=127.0.0.1 in .env to keep the ports on loopback only
docker compose up --build
```

This runs on your host Docker daemon and does not provide the microVM isolation
the workshop demonstrates. Stop with `docker compose down` (add `-v` to reset
the database).

## Try Swaggy

- "Show me all Docker hoodies and their stock."
- "Set the Docker Whale T-Shirt price to ₹1."
- "Set the stock of DCK-MUG-003 to 5."
- "Delete every product from the store."

The assistant uses model tool calling. If `OPENAI_API_KEY` is not configured, the storefront and product catalogue still load, but chat requests return a setup message.

## Runtime policy lab

The API and model provider run on the normal application network. A separate `sandbox-worker` runs only on an internal Docker network, so it has no outbound internet route. The API can call the worker, but the worker cannot initiate a connection to the public internet.

The worker runs with a read-only root filesystem, all Linux capabilities dropped, no-new-privileges, and only `sandbox/fixtures/public` mounted read-only at `/workspace`. It has no Docker socket and no host home-directory mount.

Try these prompts:
- "Read README.md from the sandbox workspace."
- "Try to read /etc/passwd from the sandbox."
- "Check whether the sandbox can reach the public internet."

The filesystem endpoint resolves paths and rejects anything outside the mounted workspace. The network check attempts a fixed request to `https://example.com` and sends no store data. These controls demonstrate this Compose lab's container/network boundaries; they are not a substitute for Docker Sandboxes or a production sandboxing product.

## The 5Cs workshop

The interface has a dedicated page for each principle:

1. **Contain** — filesystem and network boundaries.
2. **Control** — tool allowlists, server-side policy and prompt-injection resistance.
3. **Choice** — configurable OpenAI-compatible model/provider and explicitly exposed capabilities.
4. **Capacity** — CPU, memory, PID, file-size and per-turn tool budgets.
5. **Coordinate** — human approvals and the audit trail.

## Complete workshop materials

The five principles now have dedicated, hands-on lab guides and a timed facilitator run sheet:

- [Workshop index and setup](docs/README.md)
- [30-minute facilitator guide](docs/FACILITATOR-GUIDE.md)
- [Lab 1 — Contain](docs/LAB-1-CONTAIN.md)
- [Lab 2 — Control](docs/LAB-2-CONTROL.md)
- [Lab 3 — Choice](docs/LAB-3-CHOICE.md)
- [Lab 4 — Capacity](docs/LAB-4-CAPACITY.md)
- [Lab 5 — Coordinate](docs/LAB-5-COORDINATE.md)

## Security profiles

### Protected (default)

`SECURITY_PROFILE=protected`

Read-only catalogue lookups are available immediately. Price and inventory changes create a pending approval; the database is not changed until a human approves through the approval queue. Product deletion and catalogue-wide deletion are denied by the API before SQL mutation. Decisions are written to the audit table.

### Unrestricted demo (disposable database only)

`SECURITY_PROFILE=unrestricted-demo`

This enables the destructive workshop path only when the additional explicit switch is also set:

`ALLOW_DESTRUCTIVE_DEMO=true`

Both settings are required. The bulk-delete tool additionally requires the exact confirmation phrase `EMPTY DISPOSABLE STORE`. Use this only with the disposable database created by this Compose project. Never point this application at production, personal, or shared databases.

**Important:** "Unrestricted" refers only to the deliberately expanded tool permissions in this lab. It does not mean unrestricted host access. The app does not mount the Docker socket or expose a host-shell tool.

## Architecture

- `web/`: React + Vite storefront and chat UI, served by Nginx
- `api/`: Node.js API, model tool-calling loop, server-side policy checks and audit events
- `api/schema.sql`: synthetic product seed data and agent audit table
- `sandbox/`: isolated worker and public fixture files
- `docker-compose.yml`: PostgreSQL, API, sandbox worker and web services
- `sbxenv.yaml`: Docker Sandbox environment — clones the repo into an isolated microVM and forwards the storefront/API ports to the host

## Current MVP boundaries

- Products and inventory are real PostgreSQL records.
- There is no payment flow, checkout, customer account system, or order management yet.
- The model endpoint must support the OpenAI chat-completions tool-calling format.
- The approval endpoints are unauthenticated and intended only for a local trusted lab. In the recommended Docker Sandbox flow the stack is isolated inside a microVM and only the forwarded ports reach your host. If you run Compose directly on a host instead, set `BIND_HOST=127.0.0.1` to keep published ports on loopback; do not expose them through a public reverse proxy or shared network.
- This is a workshop prototype, not a production commerce application. Add authentication, authorization, rate limits, CSRF protections, secret management, and stronger approval workflows before exposing it beyond a trusted local lab.

## Safety principles

- Use synthetic data only.
- Never use production credentials or connect to production infrastructure.
- Do not mount `/var/run/docker.sock` or personal host directories.
- Treat model output as untrusted; enforce policy in the API/tool layer.
- Report attempts, blocks, and successful mutations as distinct outcomes.

## License

TBD.
