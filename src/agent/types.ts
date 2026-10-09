/**
 * SettleSight — Reconciliation Agent Types
 */

export interface ToolCallStep {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallStep[];
  isDemoScripted?: boolean;
}

export interface ExceptionItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  transactionId: string;
  payerName: string;
  allocated: number;
  openAmount: number;
  method: string;
  confidence: number;
  reasons: string;
  state: 'suggested' | 'auto' | 'approved' | 'rejected' | 'exception';
}

export interface MatchExplanation {
  matchId: string;
  invoiceId: string;
  invoiceNumber: string;
  transactionId: string;
  customerName: string;
  payerName: string;
  allocatedDollars: number;
  invoiceTotalDollars: number;
  transactionGrossDollars: number;
  feeDollars: number;
  netDollars: number;
  method: string;
  confidence: number;
  explanation: string;
  recommendedAction: string;
}

export interface ReminderDraft {
  invoiceId: string;
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  openAmountDollars: number;
  daysOverdue: number;
  status: 'draft_only';
}
