# SettleSight: reconciliation by conversation

**Track:** Alexa+ — simulated web experience with a hosted MCP server.

## Inspiration

Month-end reconciliation involves more than matching totals. A bookkeeper needs to understand fee deductions, partial payments and conflicting candidates before approving them. SettleSight turns that review into a short conversation with visible evidence and an explicit confirmation step.

## What it does

Ask for a month-end summary, review exceptions, explain a flagged invoice, draft a payment reminder, and approve a synthetic match after confirmation. A visible MCP trace shows the arguments and results behind each answer. The reconciliation meter updates after approval. Reminder tools produce drafts only.

The page is labelled **Alexa+ (simulated)**. It is an independent browser experience, not native Alexa integration, an Alexa device skill, or an Amazon partnership. All demo invoices, identities and transactions are synthetic; approvals never write to PayPal.

## How we built it

- Existing deterministic SettleSight engine: integer-cent accounting, allocation validation and evidence-based candidate matching.
- Official `@modelcontextprotocol/sdk` 1.32.1: five tools exposed through stateless Streamable HTTP, with JSON schemas and clear descriptions.
- Browser SDK MCP client: initialization, discovery and tool calls; visible call trace.
- Gemini or NVIDIA Nemotron function calling through the existing server-side `LlmClient` proxy. Credentials stay on the server. A separately labelled scripted mode supports offline rehearsal and uses the same real MCP tools.
- Web Speech API recognition for push-to-talk where supported, a text fallback, and `speechSynthesis` for replies. Recognition may depend on browser/network support and microphone permission.
- Vercel Node function handlers plus static builds. No database, AWS account or paid infrastructure is required for this synthetic demonstration.

## What was updated after the submission period started

SettleSight existed before this entry as a PayPal reconciliation dashboard and agent. Its existing accounting engine, synthetic datasets, PayPal client and dashboard are reused; they are not claimed as new Alexa+ work.

**2026-10-12:** Added the `mcp/` Streamable HTTP server, five MCP tools, literal `confirm=true` approval gate, SDK protocol/tool tests and a reproducible validator. Added the `alexa-sim/` web experience, browser MCP client, server-side LLM proxy endpoint, function-calling loop, voice input/output, text fallback, explicit scripted rehearsal mode and tool trace. Added Vercel routing, separate simulation build scripts and this Amazon submission material. Existing `src/match`, `src/agent`, dashboard behavior and PayPal write-back paths were preserved.

## Challenges and limitations

Stateless transport is compatible with serverless deployment, but demo approvals live only in process memory. Hosted cold starts or separate instances may reset or diverge; this is not a durable accounting system. The prototype has no real customer authentication, production storage or native Alexa runtime. Live LLM mode requires an existing eligible provider key and quota; scripted mode is clearly labelled and never presented as live inference.
## How to try it

```sh
npm ci
npm test
npm run build
npm run mcp
```

Open http://127.0.0.1:8790/alexa-sim/ in your browser. The MCP endpoint is available at http://127.0.0.1:8790/mcp. Check "Scripted demo (no LLM)" for offline rehearsal, or provide server-side `GEMINI_API_KEY` or `NEBIUS_API_KEY` in `.env` for live function calling. Run `npm run mcp:validate` to verify all five MCP tools and protocol negotiation, or run `npm run video:amazon` to generate the automated demo video.

Hosted demo: https://settlesight.vercel.app/alexa-sim/ (MCP endpoint: https://settlesight.vercel.app/mcp)

## Evidence and links

- Source: https://github.com/RyanDev1st/settlesight
- Local usage, deployment handoff and verification: [README.md](README.md).
- SDK initialization and all tool-call output: [protocol-output.txt](protocol-output.txt).
- Local headless Edge screenshots: [live Nemotron](alexa-sim-edge-live.png), [scripted rehearsal](alexa-sim-edge.png).
- Actual live function-calling conversation: [live-conversation.txt](live-conversation.txt).
- Public deployment URL: https://settlesight.vercel.app/alexa-sim/ (hosted smoke test and `mcp/validate.mjs` passed on 2026-10-19).
- Public video URL: https://youtu.be/GKq2TDYsM2M

## Next steps

Deploy and validate the public endpoints, record the review/confirm flow, then submit the Alexa+ track entry by **2026-10-24 02:00 ICT** (internal target **2026-10-20**). Durable per-user reconciliation and native Alexa integration are future work, not implemented claims.
