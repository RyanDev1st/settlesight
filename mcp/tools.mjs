import { readFileSync } from 'node:fs';
import { normalizeInvoices, normalizeTransactions, proposeMatches, summarize } from '../src/match/index.js';
import { listExceptions, explainMatch, draftReminder, approveMatch } from '../src/agent/tools.js';
import { z } from 'zod';

export function createDemo() {
  const invoices = JSON.parse(readFileSync(new URL('../src/data/demo/invoices.json', import.meta.url))).items;
  const transactions = JSON.parse(readFileSync(new URL('../src/data/demo/transactions.json', import.meta.url))).transaction_details;
  return { state: proposeMatches(normalizeInvoices(invoices, { asOfDate: '2026-10-09' }), normalizeTransactions(transactions), { autoApplyExact: true }).state };
}

export const definitions = {
  reconciliation_summary: { description: 'Summarize synthetic month-end reconciliation. Raw money fields are integer USD cents; read formatted_usd for exact dollar strings without arithmetic. matched_percent is a percentage. No live account access.', schema: {} },
  list_exceptions: { description: 'List unapproved candidate matches and ambiguities requiring human review in the synthetic demo.', schema: { filter: z.object({ minConfidence: z.number().min(0).max(1).optional(), maxConfidence: z.number().min(0).max(1).optional(), overdueDays: z.number().int().min(0).optional() }).optional() } },
  explain_match: { description: 'Explain a match using deterministic evidence. Supply a match ID, invoice ID or invoice number such as INV-2026-016.', schema: { id: z.string().min(1) } },
  draft_payment_reminder: { description: 'Draft a reminder for an exact invoice ID or number. Returns a draft only; never sends email or contacts a customer.', schema: { invoice_id: z.string().min(1) } },
  approve_match: { description: 'Approve a synthetic candidate only after explicit human confirmation. Omit confirm or set false to obtain a confirmation prompt; confirm=true mutates in-memory demo state only. Never changes PayPal.', schema: { id: z.string().min(1), confirm: z.boolean().optional() } },
};

function resolveMatch(state, id) {
  const invoice = state.invoices.find(i => i.id === id || i.number === id);
  const match = state.matches.find(m => m.id === id || m.invoice_id === invoice?.id);
  if (!match) throw new Error(`Match not found: ${id}`);
  return match;
}

function summary(state) {
  const metrics = summarize(state);
  const dollars = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return { ...metrics, formatted_usd: {
    total_invoiced: dollars(metrics.total_invoiced),
    matched_value: dollars(metrics.matched_value),
    open_value: dollars(metrics.open_value),
    aging_buckets: Object.fromEntries(Object.entries(metrics.aging_buckets).map(([bucket, value]) => [bucket, dollars(value.value)])),
  } };
}

export function callTool(demo, name, args = {}) {
  const state = demo.state;
  switch (name) {
    case 'reconciliation_summary': return summary(state);
    case 'list_exceptions': {
      const items = listExceptions(state, args.filter).filter(item => !['approved', 'rejected'].includes(item.state));
      return { count: items.length, items };
    }
    case 'explain_match': {
      const match = resolveMatch(state, args.id);
      const invoice = state.invoices.find(i => i.id === match.invoice_id);
      return { ...explainMatch(state, match.id), openAmountDollars: invoice.open_amount / 100,
        remainingAfterApprovalDollars: (invoice.open_amount - (match.state === 'approved' ? 0 : match.allocated)) / 100 };
    }
    case 'draft_payment_reminder': {
      const invoice = state.invoices.find(i => i.id === args.invoice_id || i.number === args.invoice_id);
      if (!invoice) throw new Error(`Invoice not found: ${args.invoice_id}`);
      return draftReminder(state, invoice.id);
    }
    case 'approve_match': {
      const match = resolveMatch(state, args.id);
      if (args.confirm !== true) return { confirmation_required: true, matchId: match.id, prompt: `Approve ${state.invoices.find(i => i.id === match.invoice_id).number} for $${(match.allocated / 100).toFixed(2)} in the synthetic demo? Say yes to confirm.`, demo_only: true };
      if (match.state === 'approved') return { success: true, already_approved: true, matchId: match.id, summary: summary(state), demo_only: true };
      const result = approveMatch(state, match.id);
      if (result.success) demo.state = result.state;
      return { success: result.success, error: result.error, matchId: match.id, summary: summary(demo.state), demo_only: true };
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
