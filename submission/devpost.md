# SettleSight — Devpost Submission

## Project Name
**SettleSight**

## Tagline (59 characters)
`AI reconciliation desk for PayPal merchants and freelancers`

*(Character count: 59 characters. Meets the 60-character limit.)*

---

## Inspiration

For freelancers, agencies, and small e-commerce merchants collecting revenue through PayPal, month-end bookkeeping is notoriously frustrating. When a client pays a $1,000 invoice, PayPal deducts processing fees and deposits $965.10. An accounting spreadsheet flags an immediate $34.90 discrepancy. Other clients make partial installment payments, pay two invoices with a single lump sum, or omit the invoice number entirely from the memo. Debited refunds and accidental duplicate payments complicate the picture even further.

Sellers often waste hours cross-referencing PayPal CSV activity feeds against unpaid invoices in spreadsheets. We wanted to build a dedicated, beautiful reconciliation cockpit where deterministic math handles the calculations, an AI auditor explains ambiguous discrepancies in plain English, and merchants can approve write-backs to PayPal in a single click.

---

## What It Does

**SettleSight** is an AI reconciliation desk powered by PayPal Developer APIs and AG Studio 3.0:

1. **Ingests & Normalizes:** Connects to **PayPal Invoicing v2** and **Transaction Search v1** (or pre-seeded sandbox snapshots) and normalizes all amounts into integer cents to prevent floating-point drift.
2. **Deterministic Auto-Matching:** Automatically matches unambiguous transactions (matching reference code and identical gross deposit) with 100% confidence.
3. **Smart Heuristic Candidate Proposals:** Generates scored match candidates for complex real-world accounting scenarios:
   - **Fee-Adjusted Matches:** Identifies transactions where gross received minus standard PayPal processing fees (~2.9% + $0.30) equals the net deposit.
   - **Combined Payments:** Detects single payments that cover two or more invoices from the same payer.
   - **Partial Installments:** Allocates milestone payments to open invoices without over-allocating.
   - **Payer-Email Matching:** Associates transactions where the buyer forgot the invoice reference code.
   - **Refund Debits:** Connects `T1107` refund transactions back to original invoices.
   - **Duplicate Flags:** Identifies second payments on settled invoices.
4. **AI Reconciliation Auditor:** Using the **Studio Agent Framework**, our embedded AI agent inspects exceptions, explains fee math, highlights aging accounts, and drafts polite reminder emails for overdue clients.
5. **Strict Mathematical Validation:** An invariant validator prevents the AI or user from ever over-allocating an invoice, exceeding transaction gross, or mixing currencies.
6. **One-Click PayPal Write-Back:** Once approved by the seller, SettleSight updates PayPal via `POST /v2/invoicing/invoices/{id}/payments` or dispatches reminders via `POST /v2/invoicing/invoices/{id}/remind`.

---

## How We Built It

SettleSight is built with modern, high-performance web and developer tools:

- **Frontend & Dashboard:** React 19, TypeScript, and Vite.
- **AG Studio 3.0 (`ag-studio`, `ag-studio-react`):** Embedded analytics dashboard featuring a custom PayPal-branded theme (`paypalTheme`), layout persistence in `localStorage`, and three custom analytics widgets:
  - *Reconciliation Meter:* Real-time radial reconciliation progress indicator.
  - *Aging Distribution Chart:* Interactive bucket chart (`0-30`, `31-60`, `61-90`, `90+` days overdue).
  - *Exceptions Queue:* Actionable triage queue with confidence indicators, rule breakdowns, and Approve / Reject controls.
- **Studio Agent Framework & LLM Architecture:**
  - Embedded AI harness built with AG Studio's `createAiHarness` and `directLlmRunner`.
  - Custom tool definitions: `list_exceptions`, `explain_match`, and `draft_reminder`.
  - Secure backend proxy (`server/llm.mjs`) routing to Google Gemini (`gemini-2.5-flash`) via its OpenAI-compatible endpoint, keeping API keys strictly server-side.
  - Scripted demo runner (`src/agent/scripted-runner.js`) with visible tool execution badges for zero-setup judging.
- **PayPal Developer Integration:**
  - Node.js backend client (`server/paypal.mjs`) implementing OAuth 2.0 with token caching, Invoicing v2 (list, record payment, remind), and Transaction Search v1 with automatic 31-day query range chunking.
  - Sandbox seeder script (`scripts/seed-sandbox.mjs`) generating 30 test invoices across 8 realistic scenarios.
- **Deterministic Math Engine:** Plain ESM JavaScript (`src/match/`) operating on integer cents with zero floating-point imprecision.
- **Automated Verification:** 56 unit and regression tests written for Node.js native test runner (`node --test`).

---

## Explicit Mapping to Hackathon Judging Criteria

### 1. Technological Implementation (20%)
- Thorough integration with PayPal Developer Platform: OAuth 2.0 client credentials with in-memory expiration caching, Invoicing v2 (`/v2/invoicing/invoices`, `/payments`, `/remind`), and Transaction Search v1 (`/v1/reporting/transactions`).
- Handled real-world API nuances: PayPal restricts Transaction Search queries to $\le 31$ days, so we implemented `splitDateRangeIntoWindows` to seamlessly chunk multi-month searches.
- Full Studio Agent Framework integration with custom tools, combined with a secure server-side LLM proxy and a deterministic fallback runner.
- Mathematical invariant validation guaranteeing that financial data integrity cannot be violated.
- 56 automated tests verifying engine rules, API client methods, and security guards.

### 2. Design (20%)
- Clean, cohesive, executive-grade product experience built inside AG Studio 3.0.
- Custom PayPal brand palette (`paypalTheme`) with light and dark mode tokens.
- Three custom-crafted AG Studio widgets tailored to financial reconciliation workflows.
- Seamless state persistence: widget arrangements, active tabs, and column states persist automatically to `localStorage`.
- Dual operational modes: instant browser demo mode for judges (zero keys required) and live sandbox mode with server proxy.

### 3. Potential Impact (20%)
- Solves a verified, universal pain point for millions of small business owners and freelancers who use PayPal to invoice clients.
- Eliminates manual spreadsheet calculations for transaction fees, partial payments, and split invoices.
- Minimizes cash-flow leakage by surfacing overdue invoices and providing one-click reminder drafting.
- Enforces strict human-in-the-loop controls: AI assists and explains, math validates, and humans approve write-backs.

### 4. Innovation / Idea (20%)
- Novel architectural separation: rather than asking a generative model to perform probabilistic math or guess transaction matches, our deterministic match engine does the calculations while the AI agent functions as an explanatory auditor and workflow copilot.
- The AI explains the *why* behind fee deductions and candidate matches, while an invariant math validator strictly enforces conservation of funds.
- First-of-its-kind integration pairing AG Studio's embedded analytics and Studio Agent Framework with PayPal's merchant settlement APIs.

### 5. Presentation (20%)
- Comprehensive, judge-ready documentation in `README.md` with exact API citations, setup commands, and architectural diagrams.
- 10-second zero-install evaluation link hosted on GitHub Pages.
- Step-by-step video demonstration script with timestamped UI interactions and clear English voiceover.
- Fully transparent pre-existing project disclosures per Hackathon Rules Section 4.

---

## Pre-Existing Work & "Meaningful Progress" Disclosure (Rules §4)

In compliance with Section 4 of the official PayPal AI Hackathon rules:

- **Pre-Existing Base (Prior to October 1, 2026):**
  The author previously experimented with an elementary offline browser script (`products/invoice-match-desk/core.js`, 124 lines) for parsing offline CSV spreadsheet files and performing basic exact-match string comparisons. It had no PayPal API integration, no AI agents, no dashboard, and no live capabilities.
- **Significantly Updated During Hackathon Period (October 1 – November 12, 2026):**
  The `settlesight` repository was created completely from scratch during the hackathon period:
  - Commit `451750d` (Oct 9, 2026): Scaffolding of SettleSight AG Studio dashboard, theme, and shell.
  - Commit `d894aae` (Oct 9, 2026): PayPal OAuth 2.0, Invoicing v2, Transaction Search v1 client, and 30-invoice sandbox seeder.
  - Commit `87dc739` (Oct 9, 2026): Studio Agent Framework harness, custom agent tools, Gemini LLM proxy, and scripted demo runner.
  - Commit `9169af6` (Oct 10, 2026): Integer-cent deterministic match engine, invariant validator, and 56-test regression suite.
  - Complete overhaul from a static CSV toy into a production-grade PayPal reconciliation application.

---

## Challenges We Ran Into

- **PayPal Transaction Search 31-Day Range Limit:** PayPal's Transaction Search v1 endpoint returns an error if the query range exceeds 31 days. We solved this by developing `splitDateRangeIntoWindows()`, which automatically chunks quarterly or annual date ranges into sequential 31-day queries and merges results.
- **Sandbox Reporting Ingestion Latency:** In the PayPal sandbox, newly settled transactions can take up to 3 hours to appear in reporting feeds. To provide a smooth testing experience for judges, we engineered dual operational modes: an instant demo mode using verified sandbox snapshot JSON, and a live mode with seed scripts.
- **Preventing Floating-Point Rounding Drift:** Standard floating-point currency math can produce rounding anomalies ($0.1 + 0.2 = 0.30000000000000004$). We implemented an integer-cent internal representation throughout the matching engine, converting to decimal representations only at the AG Studio UI boundary.

---

## Accomplishments That We're Proud Of

- Zero-install, instantaneous demo mode deployed on GitHub Pages allowing judges to test every feature without creating PayPal sandbox apps or providing API keys.
- Real integration of AG Studio 3.0 and the Studio Agent Framework with custom agent definitions, tools, and theme.
- Robust, bug-free deterministic engine backed by 56 automated tests verifying complex matching rules (fees, combined, partial, email, refund, duplicate).
- Zero-drift integer-cent mathematical invariant validator protecting merchants from over-allocation.

---

## What We Learned

- How to integrate AG Studio's `createAiHarness` and `directLlmRunner` to build domain-specific AI agents that operate seamlessly inside embedded analytics dashboards.
- Nuances of PayPal's Invoicing v2 and Transaction Search v1 REST APIs, including event code classification (`T1107` refunds vs `T0006` checkouts) and pagination handling.
- The power of combining deterministic mathematical verification with generative AI explanation: AI provides conversational agility, while strict code invariants guarantee financial accuracy.

---

## What's Next for SettleSight

- **Multi-Currency FX Reconciliation:** Automatic rate conversion using PayPal's FX conversion quotes when invoices and payments are in different currencies.
- **Webhook Subscriptions:** Real-time event listener for `INVOICING.INVOICE.PAID` and `PAYMENT.CAPTURE.COMPLETED` webhooks for instant reconciliation without periodic polling.
- **QuickBooks & Xero Sync:** One-click journal entry export to popular cloud accounting software once a month is reconciled.

---

## Built With
`paypal-api`, `invoicing-v2`, `transaction-search`, `ag-studio`, `ag-grid`, `studio-agent-framework`, `gemini-api`, `react-19`, `typescript`, `vite`, `node-test`
