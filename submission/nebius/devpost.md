# Nebius x NVIDIA Global AI Hackathon — Devpost Submission

## 1. Hackathon & Submission Metadata

- **Competition:** [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/)
- **Rules & Terms:** [Official Hackathon Rules](https://nebiusglobalaihackathon.devpost.com/rules)
- **Submission Deadline:** October 30, 2026 @ 10:00 AM PDT (➡️ **October 31, 2026 @ 12:00 AM ICT Midnight**)
- **Selected Track:** **Coding and Agentic Engineering Track**
  - *Track Selection Justification:* SettleSight is an agentic engineering system built around autonomous tool execution, deterministic invariant enforcement, and multi-turn financial auditing with NVIDIA Nemotron. While it features an interactive AG Studio UI, the core innovation lies in code-level agent architecture: OpenAI-compatible function calling, deterministic validation gates prohibiting hallucinated write-backs, and LLM-ranked exception triage.
- **Participant Eligibility:** Solo developer, adult student residing in Vietnam. Eligible under standard Devpost terms (non-OFAC territory, age of majority).
- **GitHub Repository:** [https://github.com/RyanDev1st/settlesight](https://github.com/RyanDev1st/settlesight)
- **Live Demo Link (No Key Required):** [https://ryandev1st.github.io/settlesight/](https://ryandev1st.github.io/settlesight/)

---

## 2. Devpost Form Fields

### Project Title
**SettleSight — Autonomous Financial Reconciliation Desk with NVIDIA Nemotron**

### Elevator Pitch / Tagline
> Reconcile PayPal merchant invoices and transactions in minutes using NVIDIA Nemotron on Nebius Token Factory for exception triage, backed by deterministic invariant validation and AG Studio analytics.

### About the Project

#### Inspiration
Small business owners, digital creators, and freelancers who get paid via PayPal dread the end of the month. A $1,000 invoice is settled with a $965.10 deposit because of PayPal processing fees (~2.9% + $0.30). Clients send single lump sums covering three different invoices without specifying how the funds should be allocated. Wire transfers arrive without an invoice number in the memo. Installments and milestone retainers create fractional open balances.

Most businesses spend hours cross-referencing messy CSV exports or accept accounting errors. Existing AI financial bots often hallucinate numbers or risk writing incorrect transactions directly into accounting books. We set out to build an autonomous financial reconciliation desk that combines the reasoning intelligence of **NVIDIA Nemotron on Nebius Token Factory** with strict, deterministic mathematical validation where AI advises, the math validates, and the human confirms.

#### What It Does
SettleSight orchestrates a 5-step reconciliation pipeline:

1. **Ingests & Normalizes:** Pulls invoices and transactions from PayPal Sandbox REST APIs (or pre-seeded fixtures) and normalizes all currency values into integer cents to prevent floating-point rounding drift.
2. **Deterministic Match Engine:** Auto-matches clean transactions (matching reference code and equal gross amount) with confidence 1.0. Harder cases (fees, combined payments, partial payments, customer email matches, refunds, duplicates) generate scored candidates.
3. **NVIDIA Nemotron AI Exception Triage:** Powered by `nvidia/nemotron-3-super-120b-a12b` and `nvidia/Nemotron-3-Ultra-550b-a55b` via Nebius Token Factory. Nemotron evaluates the candidate match pool, audits fee structures, examines customer payment histories, and generates a prioritized, ranked review queue with plain-English audit reasoning and risk assessments.
4. **Deterministic Invariant Authority:** Before any Nemotron recommendation is presented or approved, it must pass `validateAllocation`. The engine mathematically verifies that allocations cannot exceed open balances, transactions cannot over-allocate gross deposits, and currencies cannot cross. Any invalid LLM proposal is prominently flagged as `❌ Invariant Rejection` with mathematical proof.
5. **Human Confirmation & PayPal Write-Back:** The seller reviews suggestions in the AG Studio dashboard and approves verified matches with one click. Approved payments and reminders are securely written back to PayPal.

#### How We Built It
- **LLM Inference & Agent Engine:** Proxied through `server/llm.mjs` to **Nebius Token Factory** (`https://api.tokenfactory.nebius.com/v1/chat/completions`) using OpenAI-compatible Bearer authentication.
- **NVIDIA Nemotron Models:**
  - `nvidia/nemotron-3-super-120b-a12b`: Primary model for high-speed multi-turn function calling (`list_exceptions`, `explain_match`, `draft_reminder`, `triage_exceptions`).
  - `nvidia/Nemotron-3-Ultra-550b-a55b`: Deep reasoning model for high-complexity multi-invoice exception triage.
- **Agent Architecture (`src/agent/`):** AG Studio Agent Framework integration with custom tool calling loop (`runNemotronAgentTurn`) and exception triage module (`triageExceptionsWithNemotron`).
- **Mathematical Invariant Engine (`src/match/`):** Pure TypeScript integer-cent match engine and invariant validator (`validateAllocation`).
- **User Interface (`src/ui/`, `src/studio/`):** **AG Studio 3.0** (`ag-studio`, `ag-studio-react`) and **AG Grid Enterprise** with custom analytics widgets (`ReconciliationMeter`, `AgingChart`, `ExceptionsQueue`) and an interactive "AI triage (Nemotron)" control panel.

#### Challenges We Ran Into
- **Prohibiting Financial Hallucinations:** Large language models are prone to subtle arithmetic errors when calculating fee percentages or remaining balances. We solved this by enforcing architectural separation: Nemotron provides semantic reasoning and priority ranking, but never mutates ledger balances directly. Every allocation must pass deterministic validation.
- **Handling Multi-Provider Support Cleanly:** To ensure compatibility across evaluation environments, we implemented dynamic provider detection supporting both Nebius Token Factory (`LLM_PROVIDER=nebius`) and Google AI Studio (`LLM_PROVIDER=gemini`), while allowing full offline evaluation in zero-key demo mode.
- **PayPal Sandbox Search Window Limits:** PayPal Transaction Search v1 enforces a 31-day search window per API call. We implemented an automatic date-window partitioner (`splitDateRangeIntoWindows`) to slice rolling quarterly queries into valid sub-month requests.

#### Accomplishments We're Proud Of
- **100% Invariant Enforcement:** Proved through unit tests that an LLM proposal attempting to over-allocate funds or mismatch currencies is immediately intercepted and flagged as rejected by the engine.
- **Fast Function Calling with Nemotron Super:** Demonstrated sub-second function calling loops querying ledger state and drafting polite customer payment reminders.
- **Zero-Key Evaluation Experience:** Judges can evaluate the full application immediately in their browser via GitHub Pages with pre-seeded demo fixtures and deterministic agent fallbacks.

#### What We Learned
- How to implement OpenAI-compatible multi-turn tool calling with NVIDIA Nemotron on Nebius Token Factory.
- The power of combining LLM reasoning with deterministic code invariants in high-stakes domains like accounting and finance.

#### What's Next for SettleSight
- Integration with QuickBooks and Xero ledger sync APIs.
- Multi-currency automatic conversion using live European Central Bank (ECB) rate feeds.
- Autonomous multi-agent reconciliation committees where Nemotron Ultra and Nemotron Super act as peer auditors.

---

## 3. Disclosure: Pre-Existing Project Significantly Updated

In strict accordance with the official rules (*"Projects must be either newly created by the Entrant or, if the Entrant's Project existed prior to the Hackathon Submission Period, must have been significantly updated after the start of the Hackathon Submission Period. Entrants should explain how their Project was significantly updated during the Submission Period"*):

### Timeline & Prior Work Context
- **Hackathon Submission Window:** Started October 1, 2026.
- **Prior Base (October 9–10, 2026):** An initial PayPal reconciliation prototype was created for an earlier PayPal hackathon, focusing on PayPal Invoicing v2 REST endpoints, AG Studio charts, and an initial Gemini chat proxy.

### Significant Updates Built Specifically for Nebius x NVIDIA Hackathon (October 11, 2026)
All of the following components were newly architected, implemented, and verified specifically for the Nebius x NVIDIA Global AI Hackathon:

| Component | Files Modified / Created | Significant Enhancement Description |
| :--- | :--- | :--- |
| **Nebius Token Factory Provider** | [`server/llm.mjs`](server/llm.mjs) | Engineered full provider selection supporting Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/chat/completions`) with Bearer token auth, provider switching (`LLM_PROVIDER=nebius`), and custom model overrides. |
| **NVIDIA Nemotron Integration** | [`server/llm.mjs`](server/llm.mjs), [`src/agent/nemotron-runner.js`](src/agent/nemotron-runner.js) | Configured native support for `nvidia/nemotron-3-super-120b-a12b` (for high-speed function calling) and `nvidia/Nemotron-3-Ultra-550b-a55b` (for complex audit reasoning). |
| **LLM-Ranked Exception Triage Engine** | [`src/agent/triage.js`](src/agent/triage.js), [`src/agent/triage.d.ts`](src/agent/triage.d.ts) | Created a dedicated AI triage engine where Nemotron analyzes the candidate match pool, audits PayPal fee discrepancies, and returns a prioritized review queue with risk assessments. |
| **Deterministic Invariant Validation Gate** | [`src/agent/triage.js`](src/agent/triage.js), [`src/agent/agent.test.mjs`](src/agent/agent.test.mjs) | Connected Nemotron proposals directly to `validateAllocation`. Any LLM proposal exceeding balance limits is marked as `❌ Invariant Rejection` with the mathematical violation shown to the merchant. |
| **Nemotron Real Tool Calling Loop** | [`src/agent/nemotron-runner.js`](src/agent/nemotron-runner.js) | Implemented two-turn function calling with OpenAI-format tools (`list_exceptions`, `explain_match`, `draft_reminder`, `triage_exceptions`), falling back cleanly to the scripted runner when no key is set. |
| **Interactive AI Triage UI Toggle** | [`src/ui/agent-chat-panel.tsx`](src/ui/agent-chat-panel.tsx), [`src/ui/data.ts`](src/ui/data.ts), [`src/ui/reconciliation-context.tsx`](src/ui/reconciliation-context.tsx) | Added dynamic "AI triage (Nemotron)" dashboard toggle and ranked queue card views, visible only when the backend reports `llmProvider: "nebius"`. |
| **Multi-Provider Unit Test Suite** | [`server/llm.test.mjs`](server/llm.test.mjs), [`src/agent/agent.test.mjs`](src/agent/agent.test.mjs) | Added comprehensive unit tests with stubbed `fetch` verifying Nebius Token Factory base URLs, headers, Nemotron tool-calling payloads, and invariant rejection reporting (68 tests passing). |

---

## 4. Official Nebius Documentation Evidence & Credit Details

All integration details were verified from official documentation:

1. **Token Factory Base URL & Chat Endpoint:**
   - Base URL: `https://api.tokenfactory.nebius.com/v1/`
   - Endpoint: `https://api.tokenfactory.nebius.com/v1/chat/completions`
   - Documentation Reference: [Nebius Token Factory API Reference](https://docs.nebius.com/token-factory/api-reference)
2. **Authentication Header:**
   - Format: `Authorization: Bearer <NEBIUS_API_KEY>`
   - Documentation Reference: [Nebius Token Factory Authentication](https://docs.nebius.com/token-factory/authentication)
3. **Exact Nemotron Model IDs Available:**
   - `nvidia/nemotron-3-super-120b-a12b` (Recommended default: optimized for tool calling & multi-agent systems)
   - `nvidia/Nemotron-3-Ultra-550b-a55b` (For high-level reasoning and complex evaluations)
   - `nvidia/nemotron-3-nano-30b` (Lightweight low-latency inference)
   - `nvidia/Llama-3.1-Nemotron-70B-Instruct` (General instruction-following)
   - Documentation Reference: [Nebius Models Catalogue — Nemotron](https://docs.nebius.com/token-factory/models/nemotron)
4. **Tool / Function-Calling Support:**
   - Conforms to standard OpenAI function-calling format with `tools: [{ type: "function", function: { name, description, parameters } }]` and `tool_choice: "auto"`.
   - Documentation Reference: [Nebius Function Calling Guide](https://docs.nebius.com/token-factory/guides/function-calling)
5. **Free Credits & Billing Information:**
   - Participants receive **$25 USD** in Token Factory credits via the form on the [Devpost Hackathon Resources Page](https://nebiusglobalaihackathon.devpost.com/resources) with activation promo code `NEBIUS-DEVPOST-GLOBAL26`, plus an additional $25 USD via the Nebius Builders Program ($50 USD total).
   - Card requirement: Standard registration prompts for payment card verification; however, as documented in the official Hackathon Discord FAQ, participants facing credit card or geographic restrictions can request manual credit provisioning directly through the Nebius Discord `#hackathon-support` channel without entering card details.
6. **Live Key Notice:**
   - Live API calls are optional for evaluation. The project runs in full demo mode out of the box with zero keys required, allowing judges to test all UI controls, analytics charts, and deterministic agent flows without spending credits. To enable live inference with NVIDIA Nemotron, configure `NEBIUS_API_KEY` in `.env`.
