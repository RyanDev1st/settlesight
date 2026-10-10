/**
 * SettleSight — Reconciliation React Context
 *
 * Provides shared state between the AG Studio Dashboard, Reconciliation Meter,
 * Exceptions Queue, and Reconciliation Agent Panel.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { AgDataSourcesDefinition, AgStudioApi } from 'ag-studio';
import {
  getInitialDemoData,
  loadReconciliationData,
  buildStudioSources,
  validateAllocation,
  applyDecision,
  summarize,
} from './data';

export interface ReconciliationContextValue {
  mode: 'demo' | 'live';
  hasLlm: boolean;
  llmProvider: 'nebius' | 'gemini' | 'none';
  engineState: {
    invoices: any[];
    transactions: any[];
    matches: any[];
    exceptions: any[];
  };
  summary: ReturnType<typeof summarize>;
  sources: AgDataSourcesDefinition;
  loading: boolean;
  error: string | null;
  studioApi: AgStudioApi | null;
  setStudioApi: (api: AgStudioApi | null) => void;
  approveCandidate: (matchId: string) => { success: boolean; error?: string };
  rejectCandidate: (matchId: string) => { success: boolean; error?: string };
  reload: () => Promise<void>;
}

const ReconciliationContext = createContext<ReconciliationContextValue | null>(null);

export const ReconciliationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronously initialize with demo dataset so AG Studio mounts with non-empty data and explicit schemas
  const initial = useMemo(() => getInitialDemoData(), []);
  const [mode, setMode] = useState<'demo' | 'live'>(initial.mode);
  const [hasLlm, setHasLlm] = useState<boolean>(initial.hasLlm);
  const [llmProvider, setLlmProvider] = useState<'nebius' | 'gemini' | 'none'>(initial.llmProvider);
  const [engineState, setEngineState] = useState<any>(initial.state);
  const [summary, setSummary] = useState<any>(initial.summary);
  const [sources, setSources] = useState<AgDataSourcesDefinition>(initial.sources);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [studioApi, setStudioApi] = useState<AgStudioApi | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadReconciliationData();
      setMode(res.mode);
      setHasLlm(res.hasLlm);
      setLlmProvider(res.llmProvider);
      setEngineState(res.state);
      setSummary(res.summary);
      setSources(res.sources);
      if (studioApi) {
        try {
          studioApi.setProperty('data', res.sources);
        } catch (e) {
          console.warn('Failed to update studioApi data on reload:', e);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [studioApi]);

  useEffect(() => {
    reload();
  }, [reload]);

  const approveCandidate = useCallback(
    (matchId: string): { success: boolean; error?: string } => {
      const match = (engineState.matches || []).find((m: any) => m.id === matchId);
      if (!match) {
        return { success: false, error: `Match ${matchId} not found` };
      }

      // Check allocation validation invariant
      const check = validateAllocation(match, engineState);
      if (!check.valid) {
        return { success: false, error: check.error || 'Allocation invariant failed' };
      }

      try {
        const nextState = applyDecision(engineState, matchId, 'approve');
        const clonedState = {
          invoices: [...nextState.invoices],
          transactions: [...nextState.transactions],
          matches: [...nextState.matches],
          exceptions: [...nextState.exceptions],
        };
        const nextSummary = summarize(clonedState);
        const nextSources = buildStudioSources(clonedState, nextSummary);

        setEngineState(clonedState);
        setSummary(nextSummary);
        setSources(nextSources);

        if (studioApi) {
          try {
            studioApi.setProperty('data', nextSources);
          } catch (e) {
            console.warn('Failed to update studioApi data on approve:', e);
          }
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [engineState, studioApi]
  );

  const rejectCandidate = useCallback(
    (matchId: string): { success: boolean; error?: string } => {
      try {
        const nextState = applyDecision(engineState, matchId, 'reject');
        const clonedState = {
          invoices: [...nextState.invoices],
          transactions: [...nextState.transactions],
          matches: [...nextState.matches],
          exceptions: [...nextState.exceptions],
        };
        const nextSummary = summarize(clonedState);
        const nextSources = buildStudioSources(clonedState, nextSummary);

        setEngineState(clonedState);
        setSummary(nextSummary);
        setSources(nextSources);

        if (studioApi) {
          try {
            studioApi.setProperty('data', nextSources);
          } catch (e) {
            console.warn('Failed to update studioApi data on reject:', e);
          }
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [engineState, studioApi]
  );

  const value = useMemo<ReconciliationContextValue>(
    () => ({
      mode,
      hasLlm,
      llmProvider,
      engineState,
      summary: summary || summarize(engineState),
      sources,
      loading,
      error,
      studioApi,
      setStudioApi,
      approveCandidate,
      rejectCandidate,
      reload,
    }),
    [mode, hasLlm, llmProvider, engineState, summary, sources, loading, error, studioApi, setStudioApi, approveCandidate, rejectCandidate, reload]
  );

  return <ReconciliationContext.Provider value={value}>{children}</ReconciliationContext.Provider>;
};

export function useReconciliation(): ReconciliationContextValue {
  const ctx = useContext(ReconciliationContext);
  if (!ctx) {
    throw new Error('useReconciliation must be used within a ReconciliationProvider');
  }
  return ctx;
}
