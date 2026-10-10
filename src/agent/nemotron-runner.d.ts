import type { ChatMessage } from './types';

export interface NemotronTurnOptions {
  prompt: string;
  state: any;
  callLlm?: (payload: any) => Promise<any>;
  studioApi?: any;
  model?: string;
}

export declare const DEFAULT_NEMOTRON_MODEL: string;
export declare const RECONCILIATION_TOOLS_SCHEMA: any[];
export declare const NEMOTRON_SYSTEM_PROMPT: string;

export declare function runNemotronAgentTurn(
  options: NemotronTurnOptions
): Promise<ChatMessage>;
