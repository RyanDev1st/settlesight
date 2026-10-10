import type { AgReportState } from 'ag-studio';

export const STORAGE_KEY = 'settlesight_studio_layout_v4';

export const DEFAULT_INITIAL_STATE: any = {
  pages: [
    {
      id: 'Close the month',
      widgets: {
        'widget-kpi-invoiced': {
          type: 'value',
          dataMapping: {
            value: [{ id: 'invoices.amount', aggregation: 'sum' }],
          },
          format: {
            title: { enabled: false },
          },
        },
        'widget-kpi-matched': {
          type: 'value',
          dataMapping: {
            value: [{ id: 'invoices.paid_amount', aggregation: 'sum' }],
          },
          format: {
            title: { enabled: false },
          },
        },
        'widget-kpi-open': {
          type: 'value',
          dataMapping: {
            value: [{ id: 'invoices.open_amount', aggregation: 'sum' }],
          },
          format: {
            title: { enabled: false },
          },
        },
        'widget-kpi-exceptions': {
          type: 'value',
          dataMapping: {
            value: [{ id: 'review_items.id', aggregation: 'count' }],
          },
          format: {
            title: { enabled: false },
          },
        },
        'widget-meter': {
          type: 'reconciliationMeter',
        },
        'widget-aging-chart': {
          type: 'agingChart',
        },
        'widget-exceptions': {
          type: 'exceptionsQueue',
        },
      },
      widgetLayout: {
        'widget-kpi-invoiced': { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 6 },
        'widget-kpi-matched': { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 6 },
        'widget-kpi-open': { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 6 },
        'widget-kpi-exceptions': { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 6 },
        'widget-meter': { xTrack: 0, yTrack: 6, xSpan: 11, ySpan: 12 },
        'widget-aging-chart': { xTrack: 11, yTrack: 6, xSpan: 13, ySpan: 12 },
        'widget-exceptions': { xTrack: 0, yTrack: 18, xSpan: 24, ySpan: 25 },
      },
    },
    {
      id: 'All data',
      widgets: {
        'widget-grid-invoices': {
          type: 'grid',
          dataMapping: {
            cols: [
              { id: 'invoices.number' },
              { id: 'invoices.customer_name' },
              { id: 'invoices.amount' },
              { id: 'invoices.paid_amount' },
              { id: 'invoices.open_amount' },
              { id: 'invoices.paypal_status' },
              { id: 'invoices.match_status' },
              { id: 'invoices.days_overdue' },
            ],
          },
          format: {
            title: { text: 'Invoices (PayPal Invoicing v2)' },
          },
        },
        'widget-grid-transactions': {
          type: 'grid',
          dataMapping: {
            cols: [
              { id: 'transactions.id' },
              { id: 'transactions.date' },
              { id: 'transactions.payer_name' },
              { id: 'transactions.gross' },
              { id: 'transactions.fee' },
              { id: 'transactions.net' },
              { id: 'transactions.kind' },
              { id: 'transactions.invoice_ref' },
              { id: 'transactions.match_status' },
            ],
          },
          format: {
            title: { text: 'Transactions (PayPal Search Activity)' },
          },
        },
        'widget-grid-matches': {
          type: 'grid',
          dataMapping: {
            cols: [
              { id: 'matches.id' },
              { id: 'matches.invoice_id' },
              { id: 'matches.transaction_id' },
              { id: 'matches.allocated' },
              { id: 'matches.method' },
              { id: 'matches.confidence' },
              { id: 'matches.reasons' },
              { id: 'matches.state' },
            ],
          },
          format: {
            title: { text: 'Reconciliation Candidates & Matches' },
          },
        },
      },
      widgetLayout: {
        'widget-grid-invoices': { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 12 },
        'widget-grid-transactions': { xTrack: 0, yTrack: 12, xSpan: 24, ySpan: 12 },
        'widget-grid-matches': { xTrack: 0, yTrack: 24, xSpan: 24, ySpan: 12 },
      },
    },
  ],
  selectedPageId: 'Close the month',
};

export function loadSavedState(): AgReportState {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_STATE as AgReportState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INITIAL_STATE as AgReportState;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse saved layout from localStorage, using default:', err);
  }
  return DEFAULT_INITIAL_STATE as AgReportState;
}

export function saveStateToStorage(state: AgReportState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save layout to localStorage:', err);
  }
}

export function clearSavedState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear layout from localStorage:', err);
  }
}
