# Live verification — 2026-10-11

Verified locally using `node server/index.mjs`, `npm run dev`, real Nebius Token Factory inference, and PayPal **sandbox** credentials from the ignored `.env`. No production payment or genuine revenue occurred. Credentials and OAuth tokens were never printed or committed.

## NVIDIA Nemotron on Nebius

`GET /api/health` returned HTTP 200 with `mode: "live"`, `llmProvider: "nebius"`, `llmModel: "nvidia/nemotron-3-super-120b-a12b"`, and true credential-presence booleans. Authenticated `GET /v1/models` discovery found these NVIDIA Nemotron IDs:

- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`
- `nvidia/Nemotron-3_5-Lightning`
- `nvidia/Nemotron-3-Ultra-550b-a55b`

Discovery is cached, including concurrent first requests. `NEBIUS_MODEL` overrides automatic selection and must be an available NVIDIA Nemotron ID. Triage prefers Super; fast tool requests prefer Nano, then Lightning. A catalog without NVIDIA Nemotron produces an explicit error.

Live requests went through `POST /api/llm`, using the same `triageExceptionsWithNemotron` and `runNemotronAgentTurn` functions as the UI. The input was the synthetic demo dataset, normalized and passed through `proposeMatches`.

| Request | Actual model | Latency | Prompt tokens | Completion tokens | Total tokens | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Direct exception triage | Super | 15,788 ms | 4,323 | 3,989 | 8,312 | `nemotron_live`, 23 ranked items |
| Agent first turn | Super | 1,032 ms | 759 | 79 | 838 | Structured `triage_exceptions` tool call |
| Executed triage tool | Super | 14,744 ms | 4,323 | 3,738 | 8,061 | `nemotron_live`, real model ranking |
| Agent synthesis after tool result | Super | 3,143 ms | 4,333 | 534 | 4,867 | Final assistant response, `isNemotron: true` |
| Automatic fast tool selection | Nano | 2,121 ms | 583 | 163 | 746 | HTTP 200, `list_exceptions`, arguments `{}` |

Direct triage passed 15 candidate allocations through the deterministic validator and rejected 5; 3 ambiguity exceptions required investigation without an allocation. The complete agent path took approximately 20 seconds across its three API requests; these measurements do not support a sub-second claim. Super supports real function calling, so no alternative-model retry was required. Ultra and Lightning were discovered but not inference-tested.

Sample actual final agent response:

> The highest-priority risks are ambiguity exceptions where multiple transactions or invoice candidates compete with equal confidence, followed by critical duplicate/overpayment items that have already been flagged as rejected by the engine. Human review should focus on resolving these ambiguities and verifying/refunding the overpayments before proceeding to lower-risk items.

This was advice only: the agent did not approve matches, issue refunds, send reminders, or write to PayPal.

## PayPal sandbox invoices and confirmed write-back

1. `node scripts/seed-sandbox.mjs --dry-run` completed without network calls: 30 planned invoices, USD 42,750.00 invoiced and USD 31,700.00 planned external payments. Scenarios: 8 exact, 5 fee-adjusted, 4 combined, 4 partial, 3 email-match, 2 refund, 1 duplicate, and 3 overdue/unpaid.
2. `node scripts/seed-sandbox.mjs` authenticated successfully and exited 0, reporting **30 new sandbox invoices**. A real `GET /api/invoices` returned HTTP 200 and all 30 `SS-DEMO-001` through `SS-DEMO-030` records across pagination. Before the extra verification payment, statuses were 23 `MARKED_AS_PAID`, 4 `PARTIALLY_PAID`, and 3 `SENT`.
3. The initial `GET /api/transactions` returned HTTP **403**, with `code: "TRANSACTION_SEARCH_DISABLED"`. The server logged `PayPal Transaction Search HTTP 403` and the reason. The UI preserved real invoices and used synthetic demo transactions with the visible notice **“Live invoices + demo transactions (enable Transaction Search on your sandbox app)”**. On the final recheck, the real endpoint returned HTTP **200 with 1 sandbox transaction**: event `T1900`, USD 5,000.00, no invoice reference. The worker did not change account settings. The final screenshot therefore shows fully live inputs. The explicit fallback remains available when reporting is denied.
4. The UI path's API `POST /api/invoices/INV2-C8Q2-3Y38-JVX8-WA85/record-payment` received `confirmedByUser: true`, `amount: 25`, `currency: "USD"`, and `method: "OTHER"`. It returned HTTP 200 and payment ID `EXTR-18338036U4388992R`.
5. A fresh `GET /api/invoices` verified `SS-DEMO-028` changed from `SENT` to `PARTIALLY_PAID`, with `payments.paid_amount` equal to USD **25.00** against its USD 3,400.00 invoice. This confirms a real sandbox write-back, rather than merely an accepted local request. The write was issued through the API used by the UI, not by clicking a payment button.

The seeder records synthetic external payments; it does not generate incoming buyer transactions or actual refunds. The fallback transactions have demo invoice references rather than the live seed IDs. The current single reporting transaction does not establish reconciliation of incoming payments to the seeded invoice set.

**Recorded-payment baseline fix:** A live check uncovered and fixed the engine resetting PayPal paid amounts. Normalization now retains `baseline_paid` and dated payment records; paid invoice list summaries are enriched from Invoicing v2 details. `paid_amount = baseline_paid + sum(auto/approved allocations)` and `open_amount = amount - paid_amount`; the validator limits new allocations to the remaining balance. A transaction matching one recorded payment by invoice reference, currency, amount and date is **excluded once from candidate allocation**, marked matched, and rejected by the allocation validator if submitted again. Each recorded payment consumes at most one matching transaction, leaving additional payments available for review. No aggregate-only guess is used when dates are missing.

After write-back and reload, real PayPal data shows **USD 31,725.00 paid, USD 11,025.00 open, 7 open invoices**. `SS-DEMO-028` retains its USD 25.00 baseline and USD **3,375.00** remaining. A transaction-shaped fixture constructed from that actual recorded payment was excluded with zero new matches and unchanged USD 25.00 paid; this is a deduplication check using a fixture, not a claim that Transaction Search returned that external payment. Demo totals remain unchanged: USD 36,995.00 invoiced, USD 17,285.00 paid/reconciled, USD 19,710.00 open, 3 exceptions, and 20 suggestions. Real Nemotron triage and the agent tool loop were rerun after the fix; the table above contains those final measurements.

## Headless Edge and local checks

Ran native Microsoft Edge from `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` against `http://127.0.0.1:5173/`, served by `npm run dev` and the live proxy. Used a separate scratch browser profile, `--headless=new --dump-dom --enable-logging=stderr --v=0 --virtual-time-budget=45000`, then a screenshot run with `--window-size=1440,900`.

- Final DOM capture: 623,325 characters, containing the resolved Super model ID and corrected USD 31,725.00 paid / USD 11,025.00 open totals.
- Final console capture: 5,940 characters; **zero `Fatal error` lines**. [Extracted console messages](live-console.txt) are saved with the report. The earlier 403 run also had zero fatal lines and logged the fallback reason. AG Studio evaluation-license warnings remain; this is not a claim of zero browser warnings.
- Saved and visually inspected [the native Edge screenshot](screenshots/live-mode.png): 30 live invoices, 1 live reporting transaction, corrected balances, and model label are present; the dashboard mounts successfully.

Stubbed tests cover discovery caching and concurrent calls, overrides, missing NVIDIA models, payload/tool shapes, health metadata, confirmation guards, and the reporting 403 response. Recorded-payment regressions cover reduced open balances, write-back/reload, full settlement, exclusion without double-counting, extra identical payments, remaining allocation capacity, raw payment details, and unchanged demo totals. No tests need real credentials or inference requests.

```text
npm test
# tests 78
# pass 78
# fail 0

npm run build
> tsc && vite build
✓ 60 modules transformed.
✓ built in 19.91s
```

## Official references

- [Nebius Token Factory quickstart](https://docs.tokenfactory.nebius.com/quickstart)
- [Nebius function calling](https://docs.tokenfactory.nebius.com/ai-models-inference/function-calling)
- [Nebius API reference](https://docs.tokenfactory.nebius.com/api-reference/introduction)
- [PayPal Invoicing v2](https://developer.paypal.com/docs/api/invoicing/v2/)
- [PayPal Transaction Search](https://developer.paypal.com/docs/api/transaction-search/v1/)
