<!-- Paste everything below into Devpost "About the project" -->

## Inspiration
For freelancers and merchants collecting payments via PayPal, month-end bookkeeping involves far more than matching invoice totals against deposits. Processing fees (~2.9% + $0.30) cause balance variances, while partial installments, combined payments, and omitted invoice numbers create confusion. Debited refunds (`T1107`) and duplicate payments complicate ledgers further.

Sellers often spend hours auditing spreadsheets manually. We built **SettleSight**: a reconciliation desk combining deterministic mathematical checks with **NVIDIA Nemotron** on **Nebius Token Factory** to autonomously audit exceptions, evaluate fee math, and triage discrepancies for human approval.

*(Note: SettleSight uses synthetic demo data and PayPal sandbox records; all metrics describe test scenarios rather than production revenue or private customer metrics.)*

## What it does
SettleSight delivers an autonomous reconciliation desk with an AI auditor powered by Nebius Token Factory:

- **Normalizes & Auto-Matches:** Converts invoice and transaction feeds into integer cents, auto-matching clean pairs with 1.0 confidence.
- **7 Reconciliation Heuristics:** Flags fee deductions within tolerance, combined payments, partial installments, email matches, refund debits, and duplicates.
- **Nemotron AI Triage Mode:** An interactive toggle activates **NVIDIA Nemotron** to inspect exceptions, evaluate fee math, and output a prioritized queue with risk ratings (`Critical`, `High`, `Medium`).
- **Deterministic Math Governance:** Invariant validator (`validateAllocation`) strictly checks all proposals. If the LLM proposes an over-allocation, the engine flags an `❌ Invariant Rejection`. AI advises; code validates.
- **Two-Turn Function Calling:** Nemotron executes structured tools (`list_exceptions`, `explain_match`, `draft_reminder`, `triage_exceptions`) with visible traces.
- **Confirmation Gate:** Approvals update local state. PayPal sandbox payment recording requires explicit confirmation (`confirmedByUser: true`).

## How we built it
SettleSight combines React 19, TypeScript, Vite, Node.js, and AG Studio 3.0:

- **Nebius Token Factory:** Secure Node.js proxy (`server/llm.mjs`) proxies requests to Token Factory's OpenAI-compatible endpoint. API keys remain server-side.
- **Runtime Model Discovery:** Backend queries `GET /v1/models` at runtime to discover and cache active NVIDIA Nemotron models. It selects `nvidia/nemotron-3-super-120b-a12b` for complex triage and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for fast tool calls, failing cleanly if none exist.
- **Deterministic Math Engine:** Developed integer-cent matching rules and an invariant allocation validator in ESM JavaScript (`src/match/`).
- **Submission Window Milestones (Aug 26 – Oct 30, 2026):**
  - *2026-10-09:* Dashboard scaffold (`451750d`), PayPal sandbox client (`d894aae`), and agent harness (`87dc739`).
  - *2026-10-10:* Matching engine (`2c2d3d4`), Node 22 CI (`7bc156e`), and automated video pipeline (`145bae2`).
  - *2026-10-11:* Nebius Token Factory provider (`fa04901`), live Nemotron triage and PayPal write-back (`4080e23`), hybrid mode (`c865a71`), and video fixes (`667f128`, `d139c7b`).

## Challenges we ran into
- **Undocumented Nemotron Model IDs:** Token Factory docs featured Llama and DeepSeek, omitting exact Nemotron IDs. We implemented dynamic discovery against `GET /v1/models` to resolve `nvidia/nemotron-3-super-120b-a12b` and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`.
- **Model Latency Tradeoffs:** Nemotron Super took ~14.7s for 8k-token triage (fine for queue ranking), while Nemotron Nano completed fast tool turns in ~2.1s. Splitting tasks by model size solved this latency hurdle.
- **Vite Watcher & Edge Capture Interference:** Headless Edge recording triggered Vite watcher reload loops. We isolated Edge's user profile in `submission/video/` for clean automated captures.
- **UTF-8 Title Card Encoding:** FFmpeg drawtext corrupted UTF-8 punctuation (`→`, `·`) on Windows. We resolved this by rendering cards as browser screenshots.
- **Honesty Fixes:** We aligned demo narration to clearly distinguish synthetic demo data from sandbox records and verified fee tolerance logic.

## Accomplishments that we're proud of
- **Live Nebius Inference Verification:** Verified real Token Factory inference on 2026-10-11: Nemotron Super evaluated 23 candidates (8,312 tokens), with 15 passing mathematical validation and 5 invalid allocations correctly rejected.
- **PayPal Sandbox Write-Back:** Authenticated against PayPal sandbox with 30 test invoices, executing a confirmed write-back on invoice `SS-DEMO-028` ($25.00) that transitioned to `PARTIALLY_PAID` (`EXTR-18338036U4388992R`).
- **80 Passing Automated Tests:** Node native test runner passes all 80 tests across 4 suites covering math rules, API methods, and security guards.
- **Hybrid Demo Presentation:** Shipped an instant GitHub Pages demo alongside a hybrid mode displaying "Demo data · Nemotron Live".

## What we learned
- How easily OpenAI-compatible apps adopt Nebius Token Factory with zero custom SDKs—just updating the base URL and Bearer token.
- Pairing generative AI with deterministic code: Nemotron provides flexible reasoning, while invariant checks protect financial ledgers.
- Optimizing multi-model LLM architectures by pairing lightweight models (Nemotron Nano) for tool calling with larger models (Nemotron Super) for triage.

## What's next for SettleSight
- **Multi-Currency FX Triage:** Applying Nemotron reasoning to cross-currency exchange rate adjustments.
- **Real-Time Webhooks:** Event-driven triage triggered by PayPal webhook notifications.
- **Accounting Sync:** Automated reconciliation export to cloud accounting platforms like Xero and QuickBooks.

<!-- Word count: 670 words -->
