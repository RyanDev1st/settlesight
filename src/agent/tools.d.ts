import type { ExceptionItem, MatchExplanation, ReminderDraft } from './types';

export interface ReconciliationEngineState {
  invoices: any[];
  transactions: any[];
  matches: any[];
  exceptions: any[];
}

export function listExceptions(
  state: ReconciliationEngineState,
  filter?: { minConfidence?: number; maxConfidence?: number; overdueDays?: number }
): ExceptionItem[];

export function explainMatch(
  state: ReconciliationEngineState,
  matchId: string
): MatchExplanation;

export function proposeAllocation(
  state: ReconciliationEngineState,
  matchId: string,
  allocatedCents: number
): { valid: boolean; allocatedCents: number; allocatedDollars: number; error?: string };

export function approveMatch(
  state: ReconciliationEngineState,
  matchId: string,
  options?: { confirmedByUser?: boolean }
): { success: boolean; matchId: string; error?: string; state?: ReconciliationEngineState };

export function draftReminder(
  state: ReconciliationEngineState,
  invoiceQuery: string
): ReminderDraft;
