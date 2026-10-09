import { createWidgets } from 'ag-studio-react';
import type { AgWidgetsConfig } from 'ag-studio';
import { ReconciliationMeter } from './reconciliation-meter';
import { ExceptionsQueue } from './exceptions-queue';

export { ReconciliationMeter, ExceptionsQueue };

export const customWidgets: AgWidgetsConfig<any> = (createWidgets as any)({
  additionalTypes: [
    {
      id: 'reconciliationMeter',
      label: 'Reconciliation Meter',
      comp: ReconciliationMeter,
      form: (params: any) => params.createDefaults({}),
      defaultSize: { width: 400, height: 240 },
      minSize: { width: 280, height: 180 },
      ai: {
        description:
          'Displays the percentage of reconciled invoices versus unmatched PayPal transactions and metrics breakdown.',
      },
    },
    {
      id: 'exceptionsQueue',
      label: 'Exceptions Queue',
      comp: ExceptionsQueue,
      form: (params: any) => params.createDefaults({}),
      defaultSize: { width: 700, height: 350 },
      minSize: { width: 350, height: 200 },
      ai: {
        description:
          'Interactive queue of invoice and payment exceptions with AI confidence scores and review actions.',
      },
    },
  ],
  menu: [
    {
      label: 'Reconciliation Desk',
      widgetIds: ['reconciliationMeter', 'exceptionsQueue'],
    },
  ],
});
