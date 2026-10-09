import type { AgDataSourcesDefinition } from 'ag-studio';
import {
  DEMO_INVOICES,
  DEMO_TRANSACTIONS,
  DEMO_MATCHES,
  type DemoInvoice,
  type DemoTransaction,
  type DemoMatch,
} from './placeholder-data';

export type { DemoInvoice, DemoTransaction, DemoMatch };

export function loadDemoData(): AgDataSourcesDefinition {
  return {
    sources: [
      {
        id: 'invoices',
        name: 'Invoices',
        description: 'PayPal Invoicing v2 records with status and match tracking',
        data: DEMO_INVOICES,
      },
      {
        id: 'transactions',
        name: 'Transactions',
        description: 'PayPal Transaction Search activity including fees and net amounts',
        data: DEMO_TRANSACTIONS,
      },
      {
        id: 'matches',
        name: 'Reconciliation Matches',
        description: 'Deterministic and AI-assisted match candidates and allocations',
        data: DEMO_MATCHES,
      },
    ],
    relationships: [
      {
        id: 'match-to-invoice',
        source: { tableId: 'matches', fieldId: 'invoice_id' },
        target: { tableId: 'invoices', fieldId: 'id' },
        type: 'many-to-one',
      },
      {
        id: 'match-to-transaction',
        source: { tableId: 'matches', fieldId: 'transaction_id' },
        target: { tableId: 'transactions', fieldId: 'id' },
        type: 'many-to-one',
      },
    ],
  };
}
