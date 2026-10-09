export interface DemoInvoice {
  id: string;
  number: string;
  customer_name: string;
  customer_email: string;
  issue_date: string;
  due_date: string;
  amount: number;
  currency: string;
  paypal_status: string;
  paid_amount: number;
  open_amount: number;
  days_overdue: number;
  match_status: 'matched' | 'suggested' | 'exception' | 'open';
}

export interface DemoTransaction {
  id: string;
  date: string;
  payer_name: string;
  payer_email: string;
  gross: number;
  fee: number;
  net: number;
  currency: string;
  event_code: string;
  kind: 'payment' | 'refund' | 'other';
  invoice_ref: string;
  note: string;
  match_status: string;
}

export interface DemoMatch {
  id: string;
  transaction_id: string;
  invoice_id: string;
  allocated: number;
  method: 'exact' | 'fee_adjusted' | 'combined' | 'partial' | 'email' | 'refund' | 'duplicate' | 'ai';
  confidence: number;
  reasons: string;
  state: 'auto' | 'suggested' | 'approved' | 'rejected';
}
