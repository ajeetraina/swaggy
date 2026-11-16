# Swaggy

**Your AI store assistant. Your security problem.**

Swaggy is a deliberately small, disposable AI-powered merchandise store built to demonstrate the security risks of giving agents access to real business tools.

The same assistant can answer product questions and perform operational actions. The workshop then explores what happens when those permissions are too broad—and how independent controls change the outcome.

## Project goals

- A Docker-themed merchandise storefront
- A conversational assistant named **Swaggy**
- Real product and inventory tools backed by PostgreSQL
- A visible agent activity trace (intent, tool, arguments, policy decision, result)
- Explicit `unrestricted-demo` and `protected` security profiles
- Synthetic data only; destructive exercises target only the disposable Compose database

## Safety model

This is a security training application, not a production commerce system.

- Never connect it to production databases, credentials, customer data, or infrastructure.
- The database is seeded with synthetic merchandise and customers only.
- The application must never mount the host Docker socket.
- Destructive actions are available only against the disposable lab database.
- The protected profile enforces policy in the server/tool layer; an LLM refusal is not a security control.
- The UI must distinguish an agent attempt from a successful operation and show evidence for every policy decision.

## Planned architecture

- **Web:** React + Vite storefront and chat UI
- **API:** Node.js service exposing narrowly scoped agent tools
- **Data:** PostgreSQL with synthetic seed data
- **Model:** OpenAI-compatible chat-completions endpoint configured through environment variables
- **Runtime:** Docker Compose, designed to be run inside a Docker Sandbox

## Development status

Initial repository scaffold. The first milestone is the working storefront, chat API, product/inventory tools, and activity trace. Model integration and the security workshop scenarios follow.

## Quick start

Quick-start instructions will be added with the first runnable application milestone.

## License

TBD.