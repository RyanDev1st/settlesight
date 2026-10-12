# SettleSight — Alexa+ simulated experience (2 minutes 40 seconds)

**0:00–0:20 — Show the label and synthetic-data notice.**
“This is SettleSight, an Alexa+ simulated web experience. It helps a bookkeeper review month-end reconciliation through an MCP server. This demo uses synthetic data and does not change a PayPal account.”

**0:20–0:45 — Ask with the microphone or text.**
“Alexa, how is my month-end reconciliation?”
Show the `reconciliation_summary` trace and 46.72% meter. “The agent gets its numbers from the deterministic engine through MCP. The visible trace shows the actual tool result.”

**0:45–1:05 — Ask: “What needs my review?”**
Show `list_exceptions`. “There are candidate matches and ambiguities. We keep the evidence visible so the reviewer can check the reason behind each recommendation.”

**1:05–1:35 — Ask: “Why is INV-2026-016 flagged?”**
Expand `explain_match`. “This candidate uses fee-adjusted matching. The tool returns the invoice, transaction, fee, confidence and recommended verification. The language model explains that evidence; it does not decide the accounting math.”

**1:35–2:05 — Ask: “Approve it.” Pause at the confirmation prompt. Then: “Yes.”**
Expand the first `approve_match` with `confirm:false`, followed by `confirm:true`. Show the meter and candidate count update. “Approval waits for an explicit confirmation. Only the in-memory synthetic state changes.”

**2:05–2:25 — Ask: “Draft a reminder for INV-2026-017.”**
Show `draft_payment_reminder`. “Reminders remain drafts. Nothing is sent to a customer.”

**2:25–2:40 — Show source and protocol evidence.**
“The official MCP SDK negotiates protocol 2025-11-25 over Streamable HTTP. We added this server and simulation to our existing reconciliation engine during the hackathon. This is a browser simulation, not a native Alexa integration.”

Recording notes: start with fresh demo memory; keep the trace visible. Use live LLM mode only when it has been verified with an included-quota key. If recording scripted mode, keep its label visible and say “scripted rehearsal with real MCP calls”; never present it as live inference. Speech permission and audio capture require a manual browser check. Keep the final public English video under three minutes.
