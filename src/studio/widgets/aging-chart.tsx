import React from 'react';
import type { AgWidgetParams } from 'ag-studio';
import { useReconciliation } from '../../ui/reconciliation-context';
import { fromCents } from '../../match/normalize.js';

interface BucketInfo {
  label: string;
  key: '0-30' | '31-60' | '61-90' | '90+';
  color: string;
  badgeBg: string;
}

const BUCKETS: BucketInfo[] = [
  { label: '0–30 Days', key: '0-30', color: '#10B981', badgeBg: '#ECFDF5' },
  { label: '31–60 Days', key: '31-60', color: '#F59E0B', badgeBg: '#FFFBEB' },
  { label: '61–90 Days', key: '61-90', color: '#F97316', badgeBg: '#FFF7ED' },
  { label: '90+ Days', key: '90+', color: '#EF4444', badgeBg: '#FEF2F2' },
];

export const AgingChart: React.FC<AgWidgetParams> = () => {
  const { summary } = useReconciliation();

  const bucketsData = BUCKETS.map((b) => {
    const raw = summary?.aging_buckets?.[b.key] || { count: 0, value: 0 };
    return {
      ...b,
      count: raw.count,
      amount: fromCents(raw.value),
    };
  });

  const totalOpenDollars = bucketsData.reduce((sum, b) => sum + b.amount, 0);
  const maxAmount = Math.max(...bucketsData.map((b) => b.amount), 1);

  return (
    <div
      style={{
        padding: '16px',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0A192F', margin: 0 }}>
            Aging Distribution
          </h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Open balance: <strong>${totalOpenDollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '14px' }}>
          Overdue periods by outstanding balance (0–30, 31–60, 61–90, 90+ days)
        </div>

        {/* Horizontal Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {bucketsData.map((b) => {
            const barPct = totalOpenDollars > 0 ? (b.amount / maxAmount) * 100 : 0;
            const sharePct = totalOpenDollars > 0 ? ((b.amount / totalOpenDollars) * 100).toFixed(1) : '0';

            return (
              <div key={b.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>
                    {b.label} <span style={{ color: '#64748B', fontWeight: 400 }}>({b.count} invoices)</span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    ${b.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>({sharePct}%)</span>
                  </span>
                </div>
                <div
                  style={{
                    height: '12px',
                    backgroundColor: '#F1F5F9',
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${barPct}%`,
                      backgroundColor: b.color,
                      borderRadius: '6px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Summary Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          paddingTop: '8px',
          borderTop: '1px solid #EEF2F6',
        }}
      >
        {bucketsData.map((b) => (
          <div
            key={b.key}
            style={{
              padding: '6px',
              backgroundColor: b.badgeBg,
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '10px', color: b.color, fontWeight: 700 }}>{b.key}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
              ${b.amount >= 1000 ? `${(b.amount / 1000).toFixed(1)}k` : b.amount.toFixed(0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgingChart;
