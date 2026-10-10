# SettleSight Synthetic Demo Dataset

Realistic synthetic dataset formatted in exact PayPal REST API response schemas:
- `invoices.json`: PayPal Invoicing v2 API `GET /v2/invoicing/invoices` (`items` array, 40 invoices)
- `transactions.json`: PayPal Transaction Search v1 API `GET /v1/reporting/transactions` (`transaction_details` array, 60 transactions)

All entities use fictional names, `example.com` email addresses, and integer cent amounts converted via `normalize.js`.

---

## Scripted Scenarios by Invoice Number

### 1. Exact Matches (Invoices INV-2026-001 to INV-2026-015)
- **Method:** `exact` (confidence: 1.0, state: `auto`)
- **Rule:** Exact invoice reference in transaction plus gross equal to the open amount.
- **Invoices:**
  - `INV-2026-001`: $1,250.00 (Alice Smith) matched with `TXN-DEMO-001` ($1,250.00, ref: INV-2026-001)
  - `INV-2026-002`: $450.00 (Bob Jones) matched with `TXN-DEMO-002` ($450.00, ref: INV-2026-002)
  - `INV-2026-003`: $2,800.00 (Charlie Brown) matched with `TXN-DEMO-003` ($2,800.00, ref: INV-2026-003)
  - `INV-2026-004`: $620.00 (Diana Prince) matched with `TXN-DEMO-004` ($620.00, ref: INV-2026-004)
  - `INV-2026-005`: $1,500.00 (Evan Wright) matched with `TXN-DEMO-005` ($1,500.00, ref: INV-2026-005)
  - `INV-2026-006`: $310.00 (Fiona Gallagher) matched with `TXN-DEMO-006` ($310.00, ref: INV-2026-006)
  - `INV-2026-007`: $890.00 (George Clark) matched with `TXN-DEMO-007` ($890.00, ref: INV-2026-007)
  - `INV-2026-008`: $2,200.00 (Hannah Abbott) matched with `TXN-DEMO-008` ($2,200.00, ref: INV-2026-008)
  - `INV-2026-009`: $740.00 (Ian Malcolm) matched with `TXN-DEMO-009` ($740.00, ref: INV-2026-009)
  - `INV-2026-010`: $850.00 (Julia Roberts) matched with `TXN-DEMO-010` ($850.00, ref: INV-2026-010)
  - `INV-2026-011`: $1,120.00 (Kevin Bacon) matched with `TXN-DEMO-011` ($1,120.00, ref: INV-2026-011)
  - `INV-2026-012`: $530.00 (Laura Croft) matched with `TXN-DEMO-012` ($530.00, ref: INV-2026-012)
  - `INV-2026-013`: $1,950.00 (Michael Scott) matched with `TXN-DEMO-013` ($1,950.00, ref: INV-2026-013)
  - `INV-2026-014`: $400.00 (Nancy Wheeler) matched with `TXN-DEMO-014` ($400.00, ref: INV-2026-014)
  - `INV-2026-015`: $1,675.00 (Oscar Martinez) matched with `TXN-DEMO-015` ($1,675.00, ref: INV-2026-015)

---

### 2. Fee-Adjusted Matches (Invoices INV-2026-016 to INV-2026-019)
- **Method:** `fee_adjusted` (confidence: 0.92, state: `suggested`)
- **Rule:** Gross received is net of standard PayPal payment processing fee.
- **Invoices:**
  - `INV-2026-016`: $1,000.00 (Pam Beesly) matched with `TXN-DEMO-016` (gross: $970.70, fee: $29.30, ref: INV-2026-016)
  - `INV-2026-017`: $500.00 (Quinn Fabray) matched with `TXN-DEMO-017` (gross: $485.20, fee: $14.80, ref: INV-2026-017)
  - `INV-2026-018`: $750.00 (Ryan Howard) matched with `TXN-DEMO-018` (gross: $728.00, fee: $22.00, ref: INV-2026-018)
  - `INV-2026-019`: $1,200.00 (Stanley Hudson) matched with `TXN-DEMO-019` (gross: $1,165.00, fee: $35.00, ref: INV-2026-019)

---

### 3. Combined Matches (Invoices INV-2026-020 to INV-2026-024)
- **Method:** `combined` (confidence: 0.88, state: `suggested`)
- **Rule:** One payment covers the exact sum of 2–3 open invoices for the same payer email.
- **Invoices:**
  - **Pair combination (2 invoices):**
    - `INV-2026-020`: $350.00 (Toby Flenderson, `toby.combined@example.com`)
    - `INV-2026-021`: $650.00 (Toby Flenderson, `toby.combined@example.com`)
    - Matched to `TXN-DEMO-020` ($1,000.00 = $350.00 + $650.00)
  - **Triplet combination (3 invoices):**
    - `INV-2026-022`: $200.00 (Ursula Buffay, `ursula.batch@example.com`)
    - `INV-2026-023`: $300.00 (Ursula Buffay, `ursula.batch@example.com`)
    - `INV-2026-024`: $500.00 (Ursula Buffay, `ursula.batch@example.com`)
    - Matched to `TXN-DEMO-021` ($1,000.00 = $200.00 + $300.00 + $500.00)

---

### 4. Partial Payment Matches (Invoices INV-2026-025 to INV-2026-027)
- **Method:** `partial` (confidence: 0.80, state: `suggested`)
- **Rule:** Payment amount is smaller than open amount, with matching reference or email.
- **Invoices:**
  - `INV-2026-025`: $800.00 open matched with `TXN-DEMO-022` ($400.00 deposit, ref: INV-2026-025)
  - `INV-2026-026`: $1,500.00 open matched with `TXN-DEMO-023` ($500.00 milestone, ref: INV-2026-026)
  - `INV-2026-027`: $600.00 open matched with `TXN-DEMO-024` ($300.00 installment, ref: INV-2026-027)

---

### 5. Email Matches (Invoices INV-2026-028 to INV-2026-030)
- **Method:** `email` (confidence: 0.75, state: `suggested`)
- **Rule:** Amount exactly matches open invoice for payer email, but transaction lacks invoice reference.
- **Invoices:**
  - `INV-2026-028`: $450.00 (Yvonne Strahovski, `yvonne.direct@example.com`) matched with `TXN-DEMO-025` ($450.00, no ref)
  - `INV-2026-029`: $920.00 (Zachary Levi, `zachary.direct@example.com`) matched with `TXN-DEMO-026` ($920.00, no ref)
  - `INV-2026-030`: $340.00 (Amber Heard, `amber.direct@example.com`) matched with `TXN-DEMO-027` ($340.00, no ref)

---

### 6. Refund Matches (Transactions TXN-DEMO-028 to TXN-DEMO-030)
- **Method:** `refund` (confidence: 0.85, state: `suggested`)
- **Rule:** T1107 event code or negative amount linked to original invoice/payment.
- **Transactions:**
  - `TXN-DEMO-028`: -$1,250.00 refund (T1107) linked to `INV-2026-001` via reference
  - `TXN-DEMO-029`: -$450.00 refund (T1107) linked to `INV-2026-002` via reference
  - `TXN-DEMO-030`: -$2,800.00 refund (T1107) linked to `INV-2026-003` via email and amount

---

### 7. Duplicate Payment Matches (Transactions TXN-DEMO-031 to TXN-DEMO-032)
- **Method:** `duplicate` (confidence: 0.70, state: `suggested`)
- **Rule:** Second payment received for an already-settled invoice.
- **Transactions:**
  - `TXN-DEMO-031`: $620.00 received with reference to settled `INV-2026-004`
  - `TXN-DEMO-032`: $1,500.00 received with reference to settled `INV-2026-005`

---

### 8. Ambiguous Exceptions (Invoices INV-2026-031 to INV-2026-035)
- **Classification:** `exception` (never auto-matched, flagged for human review)
- **Scenarios:**
  - **Scenario 1:** `INV-2026-031` ($250.00) and `INV-2026-032` ($250.00) for `brad.ambig@example.com`. `TXN-DEMO-033` arrives with $250.00 from that email without an invoice reference. Both candidates share equal top confidence (0.75).
  - **Scenario 2:** `INV-2026-033` ($180.00). Both `TXN-DEMO-034` and `TXN-DEMO-035` contain explicit references to `INV-2026-033` for $180.00. Competing claims create an exception.
  - **Scenario 3:** `INV-2026-034` ($400.00) and `INV-2026-035` ($400.00) for `daniel.ambig@example.com`. `TXN-DEMO-036` arrives for $200.00 without reference, presenting two equal partial candidates.

---

### 9. Overdue Invoices and Aging Buckets (Invoices INV-2026-036 to INV-2026-040)
- **Reference Date:** `2026-10-09`
- **Invoices:**
  - `INV-2026-036`: $550.00, due 2026-09-29 (10 days overdue) -> **0–30 bucket**
  - `INV-2026-037`: $820.00, due 2026-08-25 (45 days overdue) -> **31–60 bucket**
  - `INV-2026-038`: $1,300.00, due 2026-07-26 (75 days overdue) -> **61–90 bucket**
  - `INV-2026-039`: $2,100.00, due 2026-06-11 (120 days overdue) -> **90+ bucket**
  - `INV-2026-040`: $3,400.00, due 2026-05-12 (150 days overdue) -> **90+ bucket**

---

### 10. Miscellaneous Unrelated Transactions (Transactions TXN-DEMO-037 to TXN-DEMO-060)
- 24 non-matching transactions:
  - Account interest credits (T0000)
  - Merchant processing service fees (T0200)
  - Automatic checking sweep withdrawals (T0000)
  - Unrelated micro-payments from guest checkouts
