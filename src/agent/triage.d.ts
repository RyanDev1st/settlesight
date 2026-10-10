export interface TriageRankedItem {
  matchId: string;
  priorityRank: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: 'approve' | 'reject' | 'investigate' | 'rejected_by_engine';
  allocatedDollars: number;
  allocatedCents?: number;
  reasoning: string;
  riskAssessment: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  payerName?: string;
  invariantPassed: boolean;
  rejectionReason: string | null;
  isAmbiguityException?: boolean;
}

export interface TriageResult {
  mode: 'nemotron_live' | 'deterministic_fallback';
  model: string;
  rankedItems: TriageRankedItem[];
  verifiedCount: number;
  rejectedCount: number;
  totalItems: number;
  summaryText: string;
  timestamp: string;
}

export interface TriageOptions {
  state: any;
  callLlm?: (payload: any) => Promise<any>;
  model?: string;
}

export declare const DEFAULT_NEMOTRON_TRIAGE_MODEL: string;
export declare const TRIAGE_SYSTEM_PROMPT: string;

export declare function triageExceptionsWithNemotron(
  options: TriageOptions
): Promise<TriageResult>;
