export function usesPaypalData(health) {
  return Boolean(health.hasPaypal) && health.dataSource !== 'demo';
}

export function modeBadge({ mode, hasLlm, llmProvider, dataNotice }) {
  if (mode === 'demo' && hasLlm && llmProvider === 'nebius') return 'Demo data · Nemotron Live';
  if (dataNotice) return 'Live invoices + demo transactions';
  return mode === 'live' ? 'Live Sandbox' : 'Demo Mode';
}
