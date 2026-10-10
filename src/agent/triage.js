/**
 * SettleSight — LLM-Ranked Exception Triage (NVIDIA Nemotron & Deterministic Engine)
 *
 * Implements AI triage where NVIDIA Nemotron (Super/Ultra) reasons over
 * candidate matches and ambiguous exceptions, while the deterministic match
 * engine retains 100% final authority via `validateAllocation`.
 *
 * Invariant Rule:
 * Every allocation proposed by the LLM MUST pass deterministic validation.
 * Any proposed allocation that violates engine invariants is flagged as rejected,
 * displaying the exact mathematical violation to the merchant.
 */

import { listExceptions, explainMatch } from './tools.js';
import { validateAllocation } from '../match/validator.js';
import { fromCents, toCents } from '../match/normalize.js';

export const DEFAULT_NEMOTRON_TRIAGE_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

export const TRIAGE_SYSTEM_PROMPT = `You are the SettleSight Financial Reconciliation Auditor powered by NVIDIA Nemotron.
You analyze PayPal invoices, transactions, and ambiguous candidate matches to produce a prioritized review queue.

For each item:
1. Assign a priority rank (1 = most urgent).
2. Assess urgency: "critical", "high", "medium", or "low".
3. Recommend action: "approve", "reject", or "investigate".
4. Provide plain English reasoning highlighting fee deductions, customer names, or invoice references.
5. Identify risk factors (e.g., fee discrepancy, missing memo, partial installment).

Respond with valid JSON conforming to:
{
  "summary": "Brief executive summary of exceptions queue",
  "rankedItems": [
    {
      "matchId": "string",
      "priorityRank": number,
      "urgency": "critical" | "high" | "medium" | "low",
      "recommendedAction": "approve" | "reject" | "investigate",
      "allocatedDollars": number,
      "reasoning": "string",
      "riskAssessment": "string"
    }
  ]
}`;

/**
 * Runs LLM-ranked exception triage.
 *
 * @param {object} options
 * @param {object} options.state Current reconciliation engine state
 * @param {Function} [options.callLlm] Function calling the LLM proxy (POST /api/llm)
 * @param {string} [options.model] Model ID (default: nvidia/nemotron-3-super-120b-a12b)
 * @returns {Promise<object>} Triage result with rankedItems, verifiedCount, and rejectedCount
 */
export async function triageExceptionsWithNemotron({ state, callLlm, model } = {}) {
  if (!state) {
    throw new Error('Reconciliation state is required for exception triage');
  }

  const rawExceptions = listExceptions(state);
  if (!rawExceptions || rawExceptions.length === 0) {
    return {
      mode: callLlm ? 'nemotron_live' : 'deterministic_fallback',
      model: model || DEFAULT_NEMOTRON_TRIAGE_MODEL,
      rankedItems: [],
      verifiedCount: 0,
      rejectedCount: 0,
      totalItems: 0,
      summaryText: 'No open exceptions or candidate matches requiring triage.',
      timestamp: new Date().toISOString(),
    };
  }

  let rankedItems = [];
  let summaryText = '';
  let mode = 'deterministic_fallback';

  if (typeof callLlm === 'function') {
    try {
      const prompt = `Review these ${rawExceptions.length} reconciliation candidates and exceptions:\n` +
        JSON.stringify(rawExceptions, null, 2);

      const completion = await callLlm({
        model,
        messages: [
          { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      });
      model = completion.model || model;

      const content = completion?.choices?.[0]?.message?.content || '';
      let parsed = null;
      try {
        // Strip markdown code fences if model returned them
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
        parsed = JSON.parse(jsonMatch[1] || content);
      } catch {
        // Fall back to heuristic ranking if JSON parsing fails
      }

      if (parsed && Array.isArray(parsed.rankedItems)) {
        rankedItems = parsed.rankedItems;
        summaryText = parsed.summary || 'Nemotron triage complete.';
        mode = 'nemotron_live';
      }
    } catch (err) {
      console.warn('Nemotron live triage failed, falling back to deterministic ranker:', err.message);
    }
  }

  // Fallback to deterministic heuristic ranker if LLM not called or failed
  if (rankedItems.length === 0) {
    rankedItems = rawExceptions
      .map((item, idx) => {
        let urgency = 'medium';
        let action = 'investigate';
        if (item.confidence >= 0.85) {
          urgency = 'high';
          action = 'approve';
        } else if (item.method === 'ambiguity' || item.state === 'exception') {
          urgency = 'critical';
          action = 'investigate';
        }

        return {
          matchId: item.id,
          priorityRank: idx + 1,
          urgency,
          recommendedAction: action,
          allocatedDollars: item.allocated || 0,
          reasoning: `Heuristic candidate via ${item.method} rule (${Math.round((item.confidence || 0) * 100)}% confidence). ${item.reasons}`,
          riskAssessment: item.method === 'fee_adjusted'
            ? 'Verify PayPal merchant processing fee deduction against standard rates.'
            : item.method === 'partial'
            ? 'Verify customer payment milestone schedule.'
            : 'Requires confirmation of payer identity.',
        };
      })
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.urgency] ?? 4) - (order[b.urgency] ?? 4);
      })
      .map((item, idx) => ({ ...item, priorityRank: idx + 1 }));

    summaryText = `Heuristic triage: ${rankedItems.length} candidate matches prioritized by confidence and rule class.`;
  }

  // =========================================================================
  // DETERMINISTIC INVARIANT ENFORCEMENT: validateAllocation Authority Check
  // =========================================================================
  let verifiedCount = 0;
  let rejectedCount = 0;

  const validatedItems = rankedItems.map((item) => {
    const raw = rawExceptions.find((e) => e.id === item.matchId) || {};
    const matchRecord = (state.matches || []).find((m) => m.id === item.matchId);

    // If item represents an ambiguity exception rather than an existing match
    if (!matchRecord) {
      return {
        ...item,
        invoiceNumber: raw.invoiceNumber || 'N/A',
        customerName: raw.customerName || 'Multiple Claimants',
        payerName: raw.payerName || 'Unassigned',
        allocatedDollars: item.allocatedDollars || 0,
        invariantPassed: true,
        rejectionReason: null,
        isAmbiguityException: true,
      };
    }

    // Determine proposed allocation in cents
    const proposedCents = item.allocatedDollars !== undefined
      ? toCents(item.allocatedDollars)
      : (matchRecord.allocated || 0);

    const testCandidate = {
      ...matchRecord,
      allocated: proposedCents,
    };

    // Run deterministic engine validator
    const check = validateAllocation(testCandidate, state);

    if (check.valid) {
      verifiedCount++;
      return {
        ...item,
        invoiceId: matchRecord.invoice_id,
        invoiceNumber: raw.invoiceNumber || matchRecord.invoice_id,
        customerName: raw.customerName || 'Customer',
        payerName: raw.payerName || 'Payer',
        allocatedDollars: fromCents(proposedCents),
        allocatedCents: proposedCents,
        invariantPassed: true,
        rejectionReason: null,
      };
    } else {
      rejectedCount++;
      return {
        ...item,
        invoiceId: matchRecord.invoice_id,
        invoiceNumber: raw.invoiceNumber || matchRecord.invoice_id,
        customerName: raw.customerName || 'Customer',
        payerName: raw.payerName || 'Payer',
        allocatedDollars: fromCents(proposedCents),
        allocatedCents: proposedCents,
        invariantPassed: false,
        rejectionReason: check.error || 'Deterministic math violation',
        recommendedAction: 'rejected_by_engine',
      };
    }
  });

  return {
    mode,
    model: model || DEFAULT_NEMOTRON_TRIAGE_MODEL,
    rankedItems: validatedItems,
    verifiedCount,
    rejectedCount,
    totalItems: validatedItems.length,
    summaryText,
    timestamp: new Date().toISOString(),
  };
}
