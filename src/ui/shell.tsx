import React, { useState } from 'react';
import { StudioDashboard } from '../studio/dashboard';
import { clearSavedState } from '../studio/state';
import { AgentChatPanel } from './agent-chat-panel';
import { ReconciliationProvider, useReconciliation } from './reconciliation-context';

const AppShellInner: React.FC = () => {
  const [resetKey, setResetKey] = useState<number>(0);
  const [studioMode, setStudioMode] = useState<'view' | 'edit'>('view');
  const [activePage, setActivePage] = useState<string>('Close the month');
  const { mode } = useReconciliation();

  const isLive = mode === 'live';

  const handleResetLayout = () => {
    if (window.confirm('Reset dashboard layout to default PayPal reconciliation view?')) {
      clearSavedState();
      setActivePage('Close the month');
      setResetKey((prev) => prev + 1);
    }
  };

  const handleToggleMode = () => {
    setStudioMode((prev) => (prev === 'view' ? 'edit' : 'view'));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        minWidth: '1280px',
        minHeight: '720px',
        backgroundColor: '#F4F6F8',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Application Header */}
      <header
        style={{
          height: '56px',
          backgroundColor: '#0A192F',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#0070BA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                color: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(0, 112, 186, 0.4)',
              }}
            >
              S
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, letterSpacing: '-0.2px' }}>
                SettleSight
              </h1>
              <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 400 }}>
                — reconcile PayPal in minutes
              </span>
            </div>
          </div>

          {/* Page Switcher Navigation Tabs */}
          <nav
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: '#020C1B',
              padding: '3px',
              borderRadius: '8px',
            }}
          >
            <button
              onClick={() => setActivePage('Close the month')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activePage === 'Close the month' ? '#0070BA' : 'transparent',
                color: activePage === 'Close the month' ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Close the month
            </button>
            <button
              onClick={() => setActivePage('All data')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activePage === 'All data' ? '#0070BA' : 'transparent',
                color: activePage === 'All data' ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All data
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Dynamic Mode Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isLive ? '#064E3B' : '#002B49',
              border: `1px solid ${isLive ? '#059669' : '#005088'}`,
              padding: '4px 10px',
              borderRadius: '16px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isLive ? '#10B981' : '#38BDF8',
                boxShadow: `0 0 6px ${isLive ? '#10B981' : '#38BDF8'}`,
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: isLive ? '#6EE7B7' : '#38BDF8' }}>
              {isLive ? 'Live Sandbox' : 'Demo Mode'}
            </span>
          </div>

          {/* Toggle Edit/View Button */}
          <button
            onClick={handleToggleMode}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: studioMode === 'edit' ? '#0070BA' : '#1E293B',
              color: '#FFFFFF',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {studioMode === 'edit' ? 'Mode: Editing Layout' : 'Customize Layout'}
          </button>

          {/* Reset Layout Button */}
          <button
            onClick={handleResetLayout}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: '#1E293B',
              color: '#E2E8F0',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            Reset layout
          </button>
        </div>
      </header>

      {/* Main Workspace: Studio Dashboard (Left) + Agent Chat Panel (Right) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>
        {/* AG Studio Dashboard Area */}
        <main style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          <StudioDashboard
            resetKey={resetKey}
            mode={studioMode}
            activePageId={activePage}
            onPageChange={setActivePage}
          />
        </main>

        {/* AI Reconciliation Agent Panel */}
        <AgentChatPanel />
      </div>
    </div>
  );
};

export const AppShell: React.FC = () => {
  return (
    <ReconciliationProvider>
      <AppShellInner />
    </ReconciliationProvider>
  );
};

export default AppShell;
