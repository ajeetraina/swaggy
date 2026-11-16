# Swaggy

**Your AI store assistant. Your security problem.**

Swaggy is a disposable AI-powered Docker merchandise store. Its assistant can read the catalogue and use business tools to change prices, adjust stock, and attempt destructive actions. The workshop explores what happens when those permissions are too broad—and how independent controls change the outcome.

## What is included

- React storefront with synthetic Docker-themed merchandise
- Chat assistant named **Swaggy**, using an OpenAI-compatible tool-calling API
- PostgreSQL-backed product and inventory tools
- Agent activity panel showing tool arguments, policy decisions, and results
- Server-enforced `protected` and explicitly gated `unrestricted-demo` profiles
- Docker Compose stack with no host Docker socket mount

## Run locally

Requirements: Docker Desktop (or Docker Engine) with Compose.

```bash
git clone https://github.com/ajeetraina/swaggy.git
cd swaggy
cp .env.example .env
```

Add your model API key to `.env`:

```dotenv
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
SECURITY_PROFILE=protected
ALLOW_DESTRUCTIVE_DEMO=false
```

Start the application:

```bash
docker compose up --build
```

Open the storefront at [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:4000/api/health](http://localhost:4000/api/health).

To stop the stack:

```bash
docker compose down
```

To reset the disposable database and reseed the catalogue:

```bash
docker compose down -v
docker compose up --build
```

## Try Swaggy

- "Show me all Docker hoodies and their stock."
- "Set the Docker Whale T-Shirt price to ₹1."
- "Set the stock of DCK-MUG-003 to 5."
- "Delete every product from the store."

The assistant uses model tool calling. If `OPENAI_API_KEY` is not configured, the storefront and product catalogue still load, but chat requests return a setup message.

## Security profiles

### Protected (default)

`SECURITY_PROFILE=protected`

Read-only catalogue lookups and bounded single-product price/stock updates are available. Product deletion and catalogue-wide deletion are denied by the API before SQL mutation. The denial is written to the audit table and returned to the assistant.

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
- `docker-compose.yml`: PostgreSQL, API and web services

## Current MVP boundaries

- Products and inventory are real PostgreSQL records.
- There is no payment flow, checkout, customer account system, or order management yet.
- The model endpoint must support the OpenAI chat-completions tool-calling format.
- This is a workshop prototype, not a production commerce application. Add authentication, authorization, rate limits, CSRF protections, secret management, and stronger approval workflows before exposing it beyond a trusted local lab.

## Safety principles

- Use synthetic data only.
- Never use production credentials or connect to production infrastructure.
- Do not mount `/var/run/docker.sock` or personal host directories.
- Treat model output as untrusted; enforce policy in the API/tool layer.
- Report attempts, blocks, and successful mutations as distinct outcomes.

## License

TBD.
