/**
 * Type declarations for SettleSight Reconciliation Engine JS modules.
 */

declare module '*/match/normalize.js' {
  export function toCents(val: number | string | undefined | null): number;
  export function fromCents(cents: number | undefined | null): number;
  export function normalizeInvoices(raw: any, opts?: any): any[];
  export function normalizeTransactions(raw: any, opts?: any): any[];
}

declare module '*/match/rules.js' {
  export function findCandidatesForTxn(txn: any, invoices: any[], settledIds: Set<string>): any[];
}

declare module '*/match/validator.js' {
  export function validateAllocation(match: any, state: any): { valid: boolean; error?: string };
}

declare module '*/match/summary.js' {
  export function summarize(state: any): {
    total_invoiced: number;
    matched_value: number;
    matched_percent: number;
    open_count: number;
    open_value: number;
    exceptions_count: number;
    aging_buckets: Record<string, { count: number; value: number }>;
  };
  export function toStudioSources(state: any): {
    invoices: any[];
    transactions: any[];
    matches: any[];
  };
}

declare module '*/match/engine.js' {
  export function proposeMatches(
    rawInvoices: any[],
    rawTransactions: any[],
    opts?: any
  ): {
    matches: any[];
    exceptions: any[];
    summary: any;
    state: {
      invoices: any[];
      transactions: any[];
      matches: any[];
      exceptions: any[];
    };
  };
  export function applyDecision(state: any, matchId: string, decision: 'approve' | 'reject'): any;
}

declare module '*/match/index.js' {
  export * from '*/match/normalize.js';
  export * from '*/match/rules.js';
  export * from '*/match/validator.js';
  export * from '*/match/summary.js';
  export * from '*/match/engine.js';
}
