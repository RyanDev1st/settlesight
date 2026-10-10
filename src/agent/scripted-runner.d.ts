import type { ReconciliationEngineState } from './tools';
import type { ChatMessage } from './types';

export const SCRIPTED_DEMO_NOTICE: string;
export function isScriptedPrompt(prompt: string): boolean;
export function runScriptedDemo(prompt: string, state: ReconciliationEngineState, studioApi?: any): ChatMessage;
