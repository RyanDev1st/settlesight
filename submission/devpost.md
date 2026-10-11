# SettleSight — Devpost Submission

## Project Name
**SettleSight**

## Tagline (59 characters)
`AI reconciliation desk for PayPal merchants and freelancers`

*(Character count: 59 characters. Meets the 60-character limit.)*

---

## Links

- **Code Repository:** [https://github.com/RyanDev1st/settlesight](https://github.com/RyanDev1st/settlesight) (Public, MIT License)
- **Live Demo (Zero-Install):** [https://ryandev1st.github.io/settlesight/](https://ryandev1st.github.io/settlesight/) (Runs in browser with synthetic sandbox snapshot data; zero keys or credentials required)
- **Demo Video (YouTube):** [https://youtu.be/j63ms4Xu-rY](https://youtu.be/j63ms4Xu-rY) (Duration under 3 minutes; meets the 3-minute hackathon video limit)
- **Live Verification Report:** [https://github.com/RyanDev1st/settlesight/blob/main/docs/live-verification.md](https://github.com/RyanDev1st/settlesight/blob/main/docs/live-verification.md) (Detailed local verification with PayPal sandbox invoices, confirmed write-back, and live LLM inference logs)

---

## Target Tracks & Sponsor Prizes

- **Main Hackathon:** Build What's Next with PayPal and AI ([https://paypalaihackathon.devpost.com/](https://paypalaihackathon.devpost.com/))
- **Sponsor Prize Category:** **Best Use of AG Grid** (1st: $5,000, 2nd: $2,000, 3rd: $1,000)
  - SettleSight builds directly on **AG Studio 3.0** (`ag-studio`, `ag-studio-react`) and AG Grid Enterprise to deliver a professional financial reconciliation cockpit.
  - Features an interactive **Exceptions Queue** triage grid with candidate match confidence scores, discrepancy explanations, and one-click Approve/Reject controls.
  - Integrates custom **Reconciliation Meter** and **Aging Distribution** analytics widgets with responsive layouts.
  - Features a custom **PayPal Brand Theme** (`paypalTheme`) with dark/light tokens and saved layout persistence in browser `localStorage`.
  - Integrates AG Studio's **Studio Agent Framework** natively with custom tools and server-side LLM proxies.

---

## Inspiration

For freelancers, agencies, and small e-commerce merchants collecting revenue through PayPal, month-end bookkeeping is notoriously frustrating. When a client pays a $1,000 invoice, PayPal deducts processing fees and deposits $965.10. An accounting spreadsheet flags an immediate $34.90 discrepancy. Other clients make partial installment payments, pay two invoices with a single lump sum, or omit the invoice number entirely from the memo. Debited refunds and accidental duplicate payments complicate the picture even further.

Sellers often spend hours cross-referencing PayPal CSV activity feeds against unpaid invoices in spreadsheets. We wanted to build a dedicated, beautiful reconciliation cockpit where deterministic math handles the calculations, an AI auditor explains ambiguous discrepancies in plain English, and merchants can approve write-backs to PayPal with a single click.

*(Note: SettleSight is an original hackathon submission developed for this competition; all metrics and scenarios in this document describe tested sandbox and synthetic data rather than production revenue or private customer metrics.)*

---

## What It Does

**SettleSight** is an AI reconciliation desk powered by PayPal Developer APIs and AG Studio 3.0:

1. **Ingests & Normalizes:** Connects to **PayPal Invoicing v2** and **Transaction Search v1** (or pre-seeded sandbox snapshots) and normalizes all amounts into integer cents to eliminate floating-point drift. Retains recorded payment baselines (`baseline_paid`) so reloaded data preserves past PayPal settlements.
2. **Deterministic Auto-Matching:** Automatically matches unambiguous transactions (matching reference code and identical gross deposit) with confidence 1.0 (rule-based).
3. **Smart Heuristic Candidate Proposals:** Evaluates 7 accounting reconciliation heuristics to generate scored match candidates:
   - **Fee-Adjusted Matches:** Identifies transactions where gross received minus the PayPal fee (~2.9% + $0.30) equals the net deposit.
   - **Combined Payments:** Detects single payments that cover two or more open invoices from the same payer.
   - **Partial Installments:** Allocates milestone payments to open balances without over-allocating.
   - **Payer-Email Matching:** Associates transactions where the buyer forgot the invoice reference code.
   - **Refund Debits:** Connects `T1107` refund transactions back to original invoices.
   - **Duplicate Flags:** Identifies duplicate payments on already settled invoices.
4. **Validator-Gated AI Auditor & Triage:** Using the **Studio Agent Framework**, our embedded AI agent inspects exceptions, explains fee math, highlights aging accounts, and prioritizes ambiguous queue items. Crucially, the AI is **gated behind an invariant math validator**: the LLM advises and explains, but cannot over-allocate an invoice, exceed transaction gross, or mix currencies. AI advises; deterministic code validates.
5. **Strict Mathematical Validation:** The invariant validator (`validateAllocation` in `src/match/validator.js`) strictly verifies every candidate match against mathematical conservation rules before any approval can occur.
6. **One-Click PayPal Write-Back:** Once confirmed by the seller (`confirmedByUser: true`), SettleSight updates PayPal sandbox records via `POST /v2/invoicing/invoices/{id}/payments` (recording external payments) or dispatches reminders via `POST /v2/invoicing/invoices/{id}/remind`.

---

## Live PayPal Sandbox & LLM Verification Proof

On 2026-10-11, the end-to-end integration was verified locally against live PayPal Developer Sandbox services and live LLM inference (documented in [`docs/live-verification.md`](https://github.com/RyanDev1st/settlesight/blob/main/docs/live-verification.md)):

### 1. PayPal Sandbox Invoicing & Write-Back
- **30 Realistic Test Invoices Seeded:** `scripts/seed-sandbox.mjs` authenticated against PayPal sandbox OAuth 2.0 and generated 30 test invoices (`SS-DEMO-001` through `SS-DEMO-030`, totaling USD 42,750.00 invoiced and USD 31,700.00 planned external payments) covering all 8 reconciliation edge cases.
- **Invoicing v2 API Verification:** A real `GET /api/invoices` call fetched all 30 invoice records across pagination with HTTP 200.
- **Confirmed Payment Write-Back:** The backend API `POST /api/invoices/INV2-C8Q2-3Y38-JVX8-WA85/record-payment` received `confirmedByUser: true` with amount USD 25.00. PayPal returned HTTP 200 with payment ID `EXTR-18338036U4388992R`.
- **Status Change Verified:** A subsequent `GET /api/invoices` verified invoice `SS-DEMO-028` transitioned from `SENT` to `PARTIALLY_PAID`, with `paid_amount` equal to USD 25.00 and USD 3,375.00 remaining balance.
- **Recorded-Payment Ledger Baseline:** The matching engine was enhanced to retain `baseline_paid` and deduct matching recorded payments once, preventing double-counting on reload. Live PayPal totals showed USD 31,725.00 paid and USD 11,025.00 open across 7 open invoices.
- **Transaction Search Handling:** Handles PayPal's 31-day search window limitation via `splitDateRangeIntoWindows`. If reporting permissions are pending (sandbox HTTP 403 `TRANSACTION_SEARCH_DISABLED`), the UI gracefully displays a clear indicator ("Live invoices + demo transactions") while preserving live invoices. On recheck, returned HTTP 200 with sandbox transaction `T1900` ($5,000.00).

### 2. Live LLM Exception Triage & Agent Tool Execution
- **Nebius Token Factory with NVIDIA Nemotron:** Verified live using real Token Factory inference. Dynamic runtime discovery (`GET /v1/models`) resolved `nvidia/nemotron-3-super-120b-a12b` for exception triage and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for fast tool calls.
- **Measured Performance:** Direct triage evaluated 23 candidate items (8,312 tokens, 15.8s latency), returning structured rankings where 15 candidates passed the deterministic validator and 5 invalid allocations were rejected. Fast tool selection answered in 2.1s (746 tokens). Full multi-turn agent execution completed in ~20s with real function calling (`list_exceptions`, `explain_match`, `triage_exceptions`).

---

## LLM Provider Architecture & Honest Implementation Status

SettleSight's backend proxy (`server/llm.mjs`) provides a modular, OpenAI-compatible architecture with three tiers:

| Provider | Configuration | Implementation File | Status & Live Verification |
| :--- | :--- | :--- | :--- |
| **Nebius Token Factory** | `LLM_PROVIDER=nebius`<br>`NEBIUS_API_KEY` | `server/llm.mjs`<br>`src/agent/nemotron-runner.js` | **Fully Verified Live:** Dynamic model discovery via `GET /v1/models`. Tested with `nvidia/nemotron-3-super-120b-a12b` and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. Live triage and function calling logs recorded in `docs/live-verification.md`. |
| **Google Gemini** | `LLM_PROVIDER=gemini`<br>`GEMINI_API_KEY` | `server/llm.mjs`<br>`src/agent/llm-adapter.ts` | **Code Implemented & Tested:** Proxies to Google's OpenAI-compatible endpoint (`gemini-2.5-flash`). Client adapter implements AG Studio's `AgAiLlmAdapter`. Covered by automated unit and stub tests; requires user API key for live proxying. |
| **Scripted Fallback Runner** | Zero configuration required | `src/agent/scripted-runner.js`<br>`src/agent/tools.js` | **Demo Ready:** Deterministic fallback runner executing real tool calls (`list_exceptions`, `explain_match`, `draft_reminder`) with visible badge traces in the chat panel. Powers the instant GitHub Pages evaluation. |

*Security Guarantee:* All API keys (`PAYPAL_CLIENT_SECRET`, `NEBIUS_API_KEY`, `GEMINI_API_KEY`) remain strictly on the Node.js server inside `.env`. The browser client never sees or handles credentials.

---

## How We Built It

SettleSight is built with modern, high-performance web and developer tools:

- **Frontend & Dashboard:** React 19, TypeScript, and Vite.
- **AG Studio 3.0 (`ag-studio`, `ag-studio-react`):** Embedded analytics dashboard featuring a custom PayPal-branded theme (`paypalTheme`), layout persistence in `localStorage`, and three custom analytics widgets:
  - *Reconciliation Meter:* Real-time horizontal reconciliation progress indicator.
  - *Aging Distribution Chart:* Interactive bucket chart (`0-30`, `31-60`, `61-90`, `90+` days overdue).
  - *Exceptions Queue:* Actionable triage grid with confidence indicators, rule breakdowns, and Approve / Reject controls.
- **Studio Agent Framework & LLM Architecture:**
  - Embedded AI harness built with AG Studio's `createAiHarness` and `directLlmRunner`.
  - Custom tool definitions: `list_exceptions`, `explain_match`, `draft_reminder`, and `triage_exceptions`.
  - Secure backend proxy (`server/llm.mjs`) routing to Nebius Token Factory or Google Gemini via OpenAI-compatible endpoints.
  - Scripted demo runner (`src/agent/scripted-runner.js`) with visible tool execution badges for zero-setup judging.
- **PayPal Developer Integration:**
  - Node.js backend client (`server/paypal.mjs`) implementing OAuth 2.0 with token caching, Invoicing v2 (list, record payment, remind), and Transaction Search v1 with automatic 31-day query range chunking.
  - Sandbox seeder script (`scripts/seed-sandbox.mjs`) generating 30 test invoices across 8 realistic scenarios.
- **Deterministic Math Engine & Validator:** Plain ESM JavaScript (`src/match/`) operating on integer cents with zero floating-point imprecision. An invariant validator rejects any candidate that would over-allocate an invoice or transaction.
- **Automated Verification:** **80 automated tests** written for Node.js native test runner (`node --test`), verifying engine rules, API client methods, recorded-payment baselines, and security guards across 4 test suites.

---

## Explicit Mapping to Hackathon Judging Criteria

### 1. Technological Implementation (20%)
- **Thorough PayPal Platform Integration:** OAuth 2.0 client credentials with in-memory expiration caching, Invoicing v2 (`/v2/invoicing/invoices`, `/payments`, `/remind`), and Transaction Search v1 (`/v1/reporting/transactions`).
- **Real-World API Resilience:** PayPal restricts Transaction Search queries to $\le 31$ days, so we implemented `splitDateRangeIntoWindows` to seamlessly chunk multi-month searches. Gracefully detects reporting permission status with clear UI indicators.
- **Validator-Gated Agent Architecture:** Embedded Studio Agent Framework integration where AI reasoning is strictly bounded by a mathematical invariant validator (`validateAllocation`), preventing hallucinations from affecting financial ledgers.
- **Dual LLM Provider Implementation:** OpenAI-compatible proxy supporting both Nebius Token Factory (with runtime model discovery) and Google Gemini, keeping credentials secure on the backend.
- **80 Automated Tests:** 100% pass rate on Node.js native test runner verifying matching heuristics, invariant validation, API client methods, recorded-payment exclusion, and regression safety.

### 2. Design (20%)
- **Executive-Grade Cockpit in AG Studio 3.0:** Clean, cohesive product experience built inside AG Studio.
- **PayPal Brand Palette:** Custom `paypalTheme` with tailored light and dark mode tokens.
- **Three Custom AG Studio Widgets:** Reconciliation Meter, Aging Distribution Chart, and Exceptions Queue tailored to financial reconciliation workflows.
- **Saved Layout Persistence:** Widget arrangements, active tabs, and column states persist automatically to `localStorage`.
- **Dual Operational Modes:** Instant zero-install browser demo mode for judges (zero keys required) and live sandbox mode with server proxy.

### 3. Potential Impact (20%)
- **Solves Real Merchant Friction:** Eliminates hours of manual spreadsheet reconciliation for freelancers and small businesses collecting PayPal payments.
- **Handles Real Edge Cases:** Resolves hidden transaction fees, partial payments, combined multi-invoice payments, omitted invoice numbers, refund debits, and accidental duplicates.
- **Surfaces Aging Cash Flow:** Visualizes overdue invoices in aging buckets and enables one-click polite payment reminder drafting.
- **Strict Human-in-the-Loop Safety:** AI assists and explains, deterministic math validates, and human sellers confirm write-backs.

### 4. Innovation / Idea (20%)
- **Separation of Concerns:** Instead of asking probabilistic LLMs to perform error-prone mental math, our deterministic engine computes allocations in integer cents, while the LLM acts as an explanatory auditor and workflow copilot.
- **Validator-Gated Governance:** The invariant validator enforces conservation of funds; any allocation violating mathematical limits is rejected with clear error codes.
- **First-of-its-Kind AG Studio + PayPal Integration:** Pairs AG Studio's embedded analytics and Studio Agent Framework with PayPal's merchant settlement APIs.

### 5. Presentation (20%)
- **Public Video Demonstration:** High-definition video demonstration (under 3 minutes; conforms to hackathon video limits) with clear English voiceover showing live features.
- **Zero-Install Evaluation Link:** Instant live evaluation hosted on GitHub Pages with synthetic demo fixtures.
- **Comprehensive Testing Instructions:** Complete, step-by-step setup instructions for judges to test both demo and live modes locally.
- **Transparent Disclosures:** Full disclosure of pre-existing work and commit chronology per Hackathon Rules §4.

---

## Sponsor Prize Alignment: Best Use of AG Grid

SettleSight is a prime candidate for the **Best Use of AG Grid** sponsor prize ($5,000 1st, $2,000 2nd, $1,000 3rd):

1. **Core Architectural Foundation:** The entire merchant user interface is built on **AG Studio 3.0** (`ag-studio`, `ag-studio-react`), utilizing AG Grid Enterprise components under the official hackathon evaluation license.
2. **Actionable Exceptions Queue Grid:** The centerpiece of the reconciliation workflow is a custom AG Grid-backed triage table displaying:
   - Candidate match confidence percentage indicators.
   - Rule identification badges (`Exact`, `Fee-Adjusted`, `Partial`, `Combined`, `Email`, `Refund`, `Duplicate`).
   - Line-by-line financial breakdowns (invoice balance vs payment amount).
   - Interactive row actions: **Approve** and **Reject** buttons that mutate local reconciliation state and prepare write-backs.
3. **Custom Analytics Widgets:** Designed two additional custom AG Studio widgets (`ReconciliationMeter` and `AgingChart`) that interact with the grid dataset in real time.
4. **Theme & Layout Customization:** Implemented a full `paypalTheme` using AG Studio's `studioTheme.withParams` API and enabled automatic layout state persistence (`settlesight_studio_layout_v4`) in `localStorage`.
5. **Studio Agent Framework:** Leveraged AG Studio's built-in AI agent APIs (`createAiHarness`, `directLlmRunner`) to embed the Reconciliation Auditor directly into the dashboard shell.

---

## Testing Instructions for Judges

Judges can evaluate SettleSight either instantly in the browser or locally on their machine.

### Option A: Instant Evaluation (0 Seconds, Zero Install)
Visit the hosted GitHub Pages deployment:
👉 **[https://ryandev1st.github.io/settlesight/](https://ryandev1st.github.io/settlesight/)**
- Runs 100% client-side with pre-seeded sandbox snapshot fixtures and a scripted demo AI runner.
- No PayPal credentials, API tokens, or server installations required.
- Test interactive widget reorganization, approve/reject triage items, view aging charts, and trigger the scripted auditor.

### Option B: Run Automated Tests Locally (< 30 Seconds)
```bash
# 1. Clone the repository
git clone https://github.com/RyanDev1st/settlesight.git
cd settlesight

# 2. Install dependencies
npm install

# 3. Run the complete test suite (expect 80 tests passing across 4 suites)
npm test
```

### Option C: Run Local Live Mode (with Sandbox & LLM Keys)
```bash
# 1. Set up environment variables
cp env.example .env
```
Edit `.env` with your sandbox and LLM credentials:
```env
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
NEBIUS_API_KEY=your_nebius_api_key    # Optional: enables live Nebius/Nemotron triage
GEMINI_API_KEY=your_gemini_api_key    # Optional: enables live Gemini LLM
PORT=8787
```

```bash
# 2. (Optional) Seed your PayPal sandbox with 30 realistic test invoices
npm run seed

# 3. Start the backend proxy server
npm run dev:server

# 4. In a separate terminal, start the Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser. SettleSight will detect the local backend and mount live sandbox data.

---

## Pre-Existing Work & "Meaningful Progress" Disclosure (Rules §4)

In compliance with Section 4 of the official PayPal AI Hackathon rules regarding pre-existing work and meaningful progress during the submission period (October 1 – November 12, 2026):

### 1. Pre-Existing Base (Prior to October 1, 2026)
- **Origin:** An elementary offline browser script experiment (`products/invoice-match-desk/core.js`, 124 lines).
- **Scope of Prior Work:** Contained basic offline CSV spreadsheet parsing and simple exact-match string comparisons for static files. It had **no PayPal API integration, no AI agents, no AG Studio widgets, no backend server, and no live capabilities**.

### 2. Built Newly During Hackathon Period (October 1 – November 12, 2026)
The `settlesight` repository was created completely from scratch during the hackathon period, as demonstrated by the repository's Git commit history:

| Date | Commit | Contribution & Milestone |
| :--- | :---: | :--- |
| **2026-10-09** | `451750d` | Initial scaffold of SettleSight AG Studio dashboard, theme, and shell. |
| **2026-10-09** | `d894aae` | PayPal OAuth 2.0, Invoicing v2, Transaction Search v1 client, and 30-invoice seeder (`scripts/seed-sandbox.mjs`). |
| **2026-10-09** | `87dc739` | AG Studio Agent Framework harness, custom agent tools, Gemini LLM proxy, and scripted demo runner. |
| **2026-10-10** | `9169af6` | Deterministic integer-cent match engine (`src/match/`), mathematical invariant validator, and demo dataset. |
| **2026-10-10** | `b38d943` | README, license, GitHub Pages automated deployment, and initial submission drafts. |
| **2026-10-10** | `94ea815` | Explicit Studio schemas and honest reconciliation meter labels. |
| **2026-10-10** | `03adb1e` | Judge-ready dashboard polish and documentation alignment. |
| **2026-10-10** | `aff02e2` | Fix KPI tile labels and overclaim wording. |
| **2026-10-10** | `501dd33` | Node 22 test CI configuration. |
| **2026-10-10** | `32cdd85` | Automated demo video pipeline, subtitles, and QC frame verification. |
| **2026-10-10** | `ac7da24` | Fix narration honesty for sandbox data and fee tolerance logic. |
| **2026-10-11** | `7bfa495` | Nebius Token Factory provider integration and Nemotron AI exception triage. |
| **2026-10-11** | `f012ea5` | Live PayPal sandbox verification (30 invoices, confirmed write-back `SS-DEMO-028` $25), live Nemotron triage and function calling, recorded-payment ledger baseline fix, test suite expanded to 80 tests. |
| **2026-10-11** | `c6aad99` | Hybrid demo mode, Nebius video pipeline, and submission packaging. |
| **2026-10-11** | `927b4cc` | Isolate Edge capture profile from Vite watcher. |
| **2026-10-11** | `6920a47` | UTF-8 title card and subtitle encoding fixes. |
| **2026-10-11** | `0fa9146` | Absolute submission links and concrete Token Factory feedback. |

All production code, integrations, UI components, tests, and documentation were written entirely during the hackathon submission window.

---

## Challenges We Ran Into

- **PayPal Transaction Search 31-Day Range Limit:** PayPal's Transaction Search v1 endpoint returns an error if the query range exceeds 31 days. We solved this by developing `splitDateRangeIntoWindows()`, which automatically chunks quarterly or annual date ranges into sequential 31-day queries and merges results.
- **Sandbox Reporting Ingestion Latency & Permissions:** In the PayPal sandbox, newly settled transactions can take up to 3 hours to appear in reporting feeds, and some sandbox accounts require explicit Transaction Search enablement. We engineered dual operational modes: an instant demo mode using verified sandbox snapshot JSON, and a live mode that clearly signals reporting status while keeping invoices live.
- **Preserving Settled Invoices Across Reloads:** An early version reset paid balances when re-fetching open invoices. We implemented a recorded-payment ledger baseline where historical settlements (`baseline_paid`) are preserved and matching external payments are deduplicated without double-counting.
- **Preventing Floating-Point Rounding Drift:** Standard floating-point currency math can produce rounding anomalies ($0.1 + 0.2 = 0.30000000000000004$). We implemented an integer-cent internal representation throughout the matching engine, converting to decimal representations only at the AG Studio UI boundary.

---

## Accomplishments That We're Proud Of

- Zero-install, instantaneous demo mode deployed on GitHub Pages allowing judges to test every feature without creating PayPal sandbox apps or providing API keys.
- Real integration of AG Studio 3.0 and the Studio Agent Framework with custom agent definitions, tools, and theme.
- Robust, bug-free deterministic engine backed by **80 automated tests** verifying complex matching rules (fees, combined, partial, email, refund, duplicate).
- Zero-drift integer-cent mathematical invariant validator protecting merchants from over-allocation.
- Live verified end-to-end write-back to PayPal Developer Sandbox (`SS-DEMO-028` updated to `PARTIALLY_PAID` with USD 25.00 recorded).

---

## What We Learned

- How to integrate AG Studio's `createAiHarness` and `directLlmRunner` to build domain-specific AI agents that operate seamlessly inside embedded analytics dashboards.
- Nuances of PayPal's Invoicing v2 and Transaction Search v1 REST APIs, including event code classification (`T1107` refunds vs `T0006` checkouts, `T1900` adjustments) and pagination handling.
- The power of combining deterministic mathematical verification with generative AI explanation: AI provides conversational agility, while strict code invariants enforce allocation rules.

---

## What's Next for SettleSight

- **Multi-Currency FX Reconciliation:** Automatic rate conversion using PayPal's FX conversion quotes when invoices and payments are in different currencies.
- **Webhook Subscriptions:** Real-time event listener for `INVOICING.INVOICE.PAID` and `PAYMENT.CAPTURE.COMPLETED` webhooks for instant reconciliation without periodic polling.
- **QuickBooks & Xero Sync:** One-click journal entry export to popular cloud accounting software once a month is reconciled.

---

## Built With

`paypal-developer-platform`, `paypal-invoicing-v2`, `paypal-transaction-search`, `ag-studio`, `ag-grid`, `studio-agent-framework`, `nebius-token-factory`, `nvidia-nemotron`, `gemini-api`, `react-19`, `typescript`, `vite`, `node-test`

---

<!--
VERIFICATION & DEVPOST REFERENCE CITATIONS:
- Hackathon Main Page: https://paypalaihackathon.devpost.com/
- Official Hackathon Rules: https://paypalaihackathon.devpost.com/rules
- Hackathon Resources: https://paypalaihackathon.devpost.com/resources
- Judging Criteria (Equally Weighted 20% each):
  1. Technological Implementation (20%): Thoroughness & skill using PayPal Developer Platform & AI tools; working, non-trivial build.
  2. Design (20%): Complete, coherent product experience rather than a bare proof-of-concept.
  3. Potential Impact (20%): Credible solution for a real problem facing a real audience.
  4. Innovation/Idea (20%): Originality and creativity of the concept.
  5. Presentation (20%): Quality and clarity of project documentation and demonstration video.
- Sponsor Prizes:
  - Best Use of AG Grid: 1st Place $5,000; 2nd Place $2,000; 3rd Place $1,000 (3 winners).
  - Rule: Project can win at most one Grand/Honorable Mention prize and one Sponsor Prize.
- Required Submission Fields Verified:
  - Public GitHub repository with open license & testing instructions.
  - Public demo video uploaded to YouTube (maximum 3 minutes).
  - Working prototype / functional demo URL or reproducible local build.
  - Meaningful use of both PayPal APIs/SDKs and AI.
- Verification Report: https://github.com/RyanDev1st/settlesight/blob/main/docs/live-verification.md
-->
