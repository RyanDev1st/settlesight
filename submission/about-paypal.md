<!-- Paste everything below into Devpost "About the project" -->

## Inspiration
For freelancers and merchants collecting payments via PayPal, month-end bookkeeping is frustrating. When a client pays a $1,000 invoice, PayPal deducts fees, depositing $965.10 with a $34.90 variance. Other clients make partial installment payments, combine invoices, or omit invoice numbers. Refunds (`T1107`) and duplicate payments complicate ledgers further.

Sellers spend hours cross-referencing CSV activity feeds against unpaid invoices in spreadsheets. We built **SettleSight**: a dedicated reconciliation cockpit where deterministic math handles financial calculations, an embedded AI auditor explains discrepancies, and merchants approve write-backs with one click.

*(Note: SettleSight uses synthetic demo data and PayPal sandbox records; all metrics describe test scenarios rather than production revenue or private customer metrics.)*

## What it does
SettleSight connects PayPal Developer APIs to an AG Studio reconciliation cockpit:

- **Ingests & Normalizes:** Converts PayPal Invoicing v2 and Transaction Search v1 records into integer cents, eliminating floating-point drift and retaining recorded-payment baselines (`baseline_paid`).
- **Deterministic Auto-Matching:** Reconciles unambiguous exact matches with 1.0 confidence.
- **7 Heuristic Candidates:** Flags fee deductions within tolerance bands (~2.9% + $0.30), combined payments, partial installments, payer-email matches, refund debits, and duplicates.
- **Validator-Gated AI Auditor:** Built on the Studio Agent Framework, an AI auditor inspects exceptions, drafts reminders, and triages queue items.
- **Conservation Validator:** The invariant validator (`validateAllocation`) strictly enforces conservation of funds. AI advises; deterministic code validates.
- **PayPal Write-Back:** Once confirmed (`confirmedByUser: true`), SettleSight records external payments via PayPal Invoicing v2 or dispatches reminders.

## How we built it
SettleSight satisfies all hackathon judging criteria (Technology, Design, Impact, Innovation, Presentation):

- **AG Studio 3.0 Cockpit & Theming:** Embedded `AgStudio` with a custom PayPal brand theme (`paypalTheme`) using `studioTheme.withParams()`.
- **Custom AG Studio Widgets:** Created three bespoke components via `createWidgets()`: *Reconciliation Meter* (real-time progress bar), *Aging Distribution Chart* (overdue buckets `0-30`, `31-60`, `61-90`, `90+` days), and *Exceptions Queue Grid* (interactive triage grid with Approve/Reject controls).
- **AG Grid Enterprise Tables:** Full-width enterprise grids for Invoices, Transactions, and Matches, with layout persistence in `localStorage` (`settlesight_studio_layout_v4`).
- **Studio Agent Framework:** Integrated `createAiHarness` and `directLlmRunner` to power the Reconciliation Auditor with four tools (`list_exceptions`, `explain_match`, `draft_reminder`, `triage_exceptions`), backed by a secure Node.js proxy supporting Gemini and Nebius.
- **PayPal APIs:** Node.js client (`server/paypal.mjs`) implementing OAuth 2.0 with token caching, Invoicing v2, and Transaction Search v1.

## Challenges we ran into
- **AG Studio "Source has no fields" Error:** Connecting dynamic data initially failed. We resolved this by defining explicit `AgFieldDefinition` arrays (`INVOICE_FIELDS`, `TRANSACTION_FIELDS`, `MATCH_FIELDS`, `AGING_FIELDS`).
- **Transaction Search 31-Day Limit:** PayPal restricts searches to 31 days. We implemented `splitDateRangeIntoWindows()` to chunk date ranges into sequential queries.
- **Node 22 Test Runner Globs:** Earlier Node versions failed to expand globs; upgrading CI to Node 22 ensured seamless test discovery.
- **Honesty Fixes & Fee Tolerances:** We corrected docs and narration to verify that discrepancies fall within fee tolerance bands rather than asserting universal exact formulas.
- **Preserving Settled Invoices:** Re-fetching invoices initially reset recorded payments. We implemented `baseline_paid` tracking to deduplicate external transactions.

## Accomplishments that we're proud of
- **Live PayPal Sandbox Verification:** Seeded 30 test invoices, recorded a $25.00 payment on `SS-DEMO-028` via confirmed write-back (`confirmedByUser: true`), and verified status transitioned to `PARTIALLY_PAID` (`EXTR-18338036U4388992R`).
- **Zero-Install Judge Experience:** Deployed an instant [GitHub Pages demo](https://ryandev1st.github.io/settlesight/) running client-side with synthetic demo data and a scripted demo auditor.
- **80 Automated Tests:** Achieved a 100% pass rate across 4 test suites (`node --test`), verifying integer-cent math, matching heuristics, and invariant rules.

## What we learned
- How to harness AG Studio 3.0's canvas, custom widget catalog, and `studioTheme.withParams` API for financial dashboards.
- How to architect AI agents using `createAiHarness` so generative models explain discrepancies conversationally while deterministic invariants govern allocation limits.
- Nuances of PayPal REST APIs, including event codes (`T1107` refunds vs `T0006` checkouts) and pagination.

## What's next for SettleSight
- **Multi-Currency FX Reconciliation:** Automatic currency conversion using PayPal's foreign exchange rates for cross-border transactions.
- **Real-Time Webhooks:** Instant event-driven reconciliation via `INVOICING.INVOICE.PAID` and `PAYMENT.CAPTURE.COMPLETED` webhooks.
- **Accounting Software Export:** One-click journal entry sync to QuickBooks, Xero, and FreshBooks.

<!-- Word count: 687 words -->
