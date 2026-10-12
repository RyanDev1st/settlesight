# Amazon Alexa+ simulation handoff

## Local run

```sh
npm ci
npm test
npm run build
npm run mcp
```

Open http://127.0.0.1:8790/alexa-sim/. The MCP endpoint is http://127.0.0.1:8790/mcp. For editing the simulation, keep the MCP process running and use `npm run alexa-sim` (Vite port 5174). The original application keeps its original dev commands.

`npm run mcp` loads an existing untracked `.env` if present. Configure `GEMINI_API_KEY`, or `LLM_PROVIDER=nebius` plus `NEBIUS_API_KEY`, only in local/server environment settings. Optional model overrides follow `server/llm.mjs`. Do not add keys to source or use Vite-prefixed key variables. Use existing included quota only; no new paid API spend is authorized. The scripted checkbox provides a clearly labelled no-LLM rehearsal with actual SDK MCP calls.

## Protocol support

Installed official SDK: **1.32.1**, pinned in `package.json` and lockfile. The [1.24.0 release changelog](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.24.0) states: “This release brings us up to speed with the latest MCP spec `2025-11-25`.”

The installed `node_modules/@modelcontextprotocol/sdk/dist/esm/types.js` exports `LATEST_PROTOCOL_VERSION = '2025-11-25'`. The SDK client initialization test checks the actual negotiated protocol, five discovered tool schemas and every tool, including the approval gate and meter update. Stateless mode uses `sessionIdGenerator: undefined` and JSON responses over Streamable HTTP, not stdio or legacy SSE transport.

Reproduce the full handshake and calls against a fresh local MCP process:

```sh
npm run mcp:validate
```

This validator approves the synthetic `mat_16`; restart the local process before filming the initial 46.72% state. [protocol-output.txt](protocol-output.txt) contains the complete captured output, including initialize, tools/list and tools/call for every tool.

## Vercel import — user/coordinator action

1. Import the public `RyanDev1st/settlesight` repository into an existing free Vercel account; root directory is the repository root. `vercel.json` declares the Node function builders and static build, so no AWS account is required. Keep spending at $0; do not enable paid add-ons.
2. Add an existing included-quota provider key in Vercel environment settings if live inference is needed. Leave keys unset for the explicitly labelled scripted rehearsal.
3. Deploy; open `/alexa-sim/` and run `node mcp/validate.mjs https://YOUR-HOST/mcp`. The Node SDK transport is stateless and needs no persistent connection or session storage. [Vercel Node runtime documentation](https://vercel.com/docs/functions/runtimes/node-js) describes Node request/response support.
4. Verify the hosted five-question flow and trace. This repository includes deployment configuration; a public deployment is not claimed until the import and hosted smoke test succeed. Demo state is in-memory and shared by visitors to a warm instance; cold starts/multiple instances may reset or diverge. Never use it for real accounting.
5. Verify microphone permission and spoken playback manually, then record/upload the English video under three minutes and submit the Alexa+ track entry.

## Boundaries

The original deterministic engine and PayPal agent are imported, not edited. The original UI remains a separate build. MCP approvals mutate demo state only. Reminders are never sent. There is no native Alexa integration, durable storage, real-customer data or customer-payment claim. A screenshot verifies rendering and text interactions, not actual microphone recognition or audible output.

## Verified locally on 2026-10-12

- `npm test`: **83 passed, 0 failed**; explicit test file paths include all existing PayPal/engine tests and new MCP tests.
- `npm run build`: TypeScript and both Vite builds passed. The existing main application retains its large-chunk warning.
- SDK client: protocol **2025-11-25**, five tools discovered, every tool called, approval without confirmation left state unchanged, confirmation approved synthetic `mat_16`.
- Headless **Microsoft Edge**: summary → review queue → INV-2026-016 explanation → approval prompt → yes. Meter stayed **46.72%** before confirmation and became **49.35%**, with **19** suggested matches, after confirmation. Both explicitly scripted mode and live Nebius/Nemotron function calling were exercised. See [live-conversation.txt](live-conversation.txt), [live screenshot](alexa-sim-edge-live.png) and [scripted screenshot](alexa-sim-edge.png).
- Initial live testing exposed reasoning consuming the reply budget and model arithmetic errors. The simulation proxy disables Nemotron thinking for voice turns, gives it a bounded 2,048-token output budget and supplies exact formatted USD values alongside integer-cent engine metrics. Empty answers report an error. The final live summary reported $36,995.00 invoiced, $17,285.00 matched and $19,710.00 open correctly; reviewers should still inspect the tool evidence rather than treat model wording as accounting authority.
- A bounded Luna review of tools, handlers, client and deployment routes found no critical or important issues.
- Public Vercel deployment, real microphone recognition and audible speech playback remain **unverified**.

NVIDIA's [Nemotron 3 Nano model card](https://catalog.ngc.nvidia.com/orgs/nim/nvidia/models/nemotron-3-nano/hf-fp8-f25a17a) documents the thinking control; its OpenAI-compatible `chat_template_kwargs.enable_thinking=false` was exercised successfully through the existing Nebius proxy path.
