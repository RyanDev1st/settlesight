# SettleSight — Nemotron reconciliation auditor

**Track:** Best Apps and Agents Track. This exact name and its Nemotron/Token Factory requirement were checked on the [official hackathon page](https://nebiusglobalaihackathon.devpost.com/) on 2026-10-11.

**Pitch:** A PayPal reconciliation desk with deterministic financial checks, live NVIDIA Nemotron ranking and explanations, and human approval.

## Inspiration and functionality

Invoice references, partial payments, combined payments, fees, refunds, and duplicates make month-end reconciliation more than an amount lookup. SettleSight normalizes records, proposes matches, displays totals and an exceptions queue, and lets a person approve a valid candidate. The engine uses integer cents and validates allocation limits. Nemotron ranks the queue and explains its reasoning; it cannot override the validator.

The agent can call `list_exceptions`, `explain_match`, `draft_reminder`, and `triage_exceptions`, with a visible tool trace. Drafting a reminder does not send it. Dashboard approvals update local reconciliation state. A separate server endpoint requires `confirmedByUser: true` for PayPal payment recording.

The video uses **synthetic demo data with live Nemotron inference**, labeled “Demo data · Nemotron Live.” A separate cut shows PayPal sandbox records. These test invoices and the recorded $25 external payment are not customer revenue.

## How we built it

React and TypeScript render the AG Studio dashboard. JavaScript modules implement matching and validation. A local Node.js server keeps credentials out of the browser and proxies PayPal sandbox and Nebius Token Factory calls.

The server discovers and caches NVIDIA Nemotron IDs through `/v1/models`, honors a configured Nemotron model, and selects Super for triage and Nano/Lightning for fast calls. It fails clearly if no Nemotron model is available. Live checks exercised `nvidia/nemotron-3-super-120b-a12b` and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`; Ultra was discovered but was not inference-tested. We used Token Factory inference, not AI Cloud compute or Serverless deployment.

## Verified live on 2026-10-11

The [live verification report](../../docs/live-verification.md) records real Nebius tool calling, 30 PayPal sandbox invoices, and a confirmed payment-recording API request. A subsequent read shows SS-DEMO-028 as `PARTIALLY_PAID` with $25 recorded. The [video verification](verification.md) and [sanitized recording log](run-log.json) contain this recording's actual calls, validator counts, and before/after totals. Narration and subtitles derive from those results.

## Significantly updated during the Submission Period

The [official rules](https://nebiusglobalaihackathon.devpost.com/rules) give a submission period of August 26–October 30, 2026. The first SettleSight commit is dated October 9, inside that window; we are not claiming a pre-window project. These Git author dates use UTC+07:00:

| Date | Commit | Contribution |
| --- | --- | --- |
| 2026-10-09 | `451750d` | AG Studio dashboard scaffold. |
| 2026-10-09 | `d894aae` | PayPal proxy, live data loading, and sandbox seeding. |
| 2026-10-09 | `87dc739` | Engine-driven dashboard and agent. |
| 2026-10-10 | `9169af6` | Deterministic matching, validator, and synthetic fixtures. |
| 2026-10-10 | `b38d943` | README, license, Pages deployment, and submission drafts. |
| 2026-10-10 | `94ea815` | Studio schemas and meter labels. |
| 2026-10-10 | `03adb1e` | Dashboard polish and accurate documentation. |
| 2026-10-10 | `aff02e2` | Corrected KPI labels and overclaims. |
| 2026-10-10 | `501dd33` | Node 22 test CI. |
| 2026-10-10 | `32cdd85` | Video automation, subtitles, and QC frames. |
| 2026-10-10 | `ac7da24` | Corrected sandbox/fee narration. |
| 2026-10-11 | `7bfa495` | Nebius provider and Nemotron triage. |
| 2026-10-11 | `f012ea5` | Live model/tool and PayPal invoice/write-back verification; recorded-payment ledger support. |
| 2026-10-11 | This delivery | Hybrid mode and tests, live Nemotron video, and corrected submission pack. |

## Feedback from using Nebius and NVIDIA models

The OpenAI-compatible response structure let our tool loop use Token Factory without an SDK. Discovery mattered because IDs must match the live catalog. Super returned ranked JSON and Nano selected reconciliation tools in bounded checks. We record latency and usage in the reports instead of claiming general performance guarantees.

## Built with

`Nebius Token Factory`, `NVIDIA Nemotron`, `React`, `TypeScript`, `JavaScript`, `Node.js`, `AG Studio`, `Vite`, `PayPal Sandbox`, `FFmpeg`.

## Links and judging setup

- [Public repository and MIT license](https://github.com/RyanDev1st/settlesight)
- [GitHub Pages demo](https://ryandev1st.github.io/settlesight/) — synthetic data and scripted fallback; Pages has no live credentials or proxy.
- Video: `YOUTUBE_URL_PENDING` — local artifact `submission/nebius/settlesight-nebius.mp4` (gitignored).
- [Live verification](../../docs/live-verification.md)
- [Video verification and reproduction](verification.md)

For live AI, follow the README's local setup with your own Nebius credentials. Set `DATA_SOURCE=demo` with `LLM_PROVIDER=nebius` for the hybrid presentation; leave `DATA_SOURCE` unset for configured PayPal sandbox data. Uploading the video and submitting the entry remain pending.
