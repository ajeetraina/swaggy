# Lab 3 — Choice: Select the model and expose only deliberate tools

**Goal:** understand model/provider choice as an engineering decision, while keeping security independent of model obedience.

## Key idea

Different models and providers can vary in latency, cost, quality, tool-call reliability, and data-handling terms. Choosing a model does not replace least privilege. A more capable model can still make a bad decision; the API must still enforce policy.

Swaggy uses an OpenAI-compatible /chat/completions endpoint with tool calling. The default configuration is gpt-4o-mini at the OpenAI API host.

## Exercise A — Inspect the current selection

Open the Choice page and visit:

~~~text
http://localhost:4000/api/health
~~~

Inspect:
- model: configured model name.
- provider: provider hostname only.
- tools: the tool names deliberately exposed to the model.
- tool_budget: maximum tool calls per turn.

The API key is not returned by health and must never be displayed or pasted into workshop material.

## Exercise B — Change the model/provider (optional)

Only do this if you have credentials for another OpenAI-compatible provider that supports chat-completions tool calling.

Edit .env:

~~~dotenv
OPENAI_BASE_URL=https://your-compatible-provider.example/v1
OPENAI_API_KEY=your-secret-key
OPENAI_MODEL=your-tool-capable-model
~~~

Use the actual base URL, key, and model name supplied by that provider. Do not use the example hostname literally.

Recreate only the API service:

~~~bash
docker compose up -d --force-recreate api
~~~

Refresh /api/health and confirm the model/provider host changed. Run the same prompt:

~~~text
Show me all Docker hoodies and their stock.
~~~

Compare response quality and tool selection. Return to the original .env values when finished.

## Exercise C — Review the exposed capability set

Compare the tools list in health with the capability map in Lab 2.

Ask:
- Does the assistant need a generic shell tool? No.
- Does it need arbitrary filesystem access? No.
- Does it need arbitrary network fetch? No.
- Does it need a product lookup and a constrained request for price/stock changes? Yes, for this workshop.

The right model is only one part of the choice. The tool surface is also a deliberate choice.

## Success criteria

- [ ] Identify the configured model and provider host without revealing the key.
- [ ] Explain why tool-calling compatibility matters.
- [ ] Identify which tools are exposed to the model.
- [ ] Explain why model selection is not a security boundary.

## Discussion

Choose models based on task performance, cost, latency, reliability, and data governance. Keep authorization, isolation, and approval enforcement in your own application.
