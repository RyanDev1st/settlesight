/**
 * SettleSight — Gemini OpenAI-Compatible LLM Client Proxy
 *
 * Forwards chat completions to Google's OpenAI-compatible endpoint:
 * https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
 *
 * Reference: https://ai.google.dev/gemini-api/docs/openai
 *
 * Keeps GEMINI_API_KEY strictly on the server; the browser never receives
 * or inspects authentication credentials.
 */

const GEMINI_OPENAI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export class LlmClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
    this.apiUrl = options.apiUrl || GEMINI_OPENAI_URL;
    this.defaultModel = options.defaultModel || DEFAULT_MODEL;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Forwards chat completion request to Gemini.
   *
   * @param {object} payload Request body conforming to OpenAI chat completion format
   * @param {AbortSignal} [signal] Optional abort signal
   * @returns {Promise<object>} JSON completion response
   */
  async chatCompletion(payload = {}, signal) {
    if (!this.hasApiKey()) {
      const err = new Error('GEMINI_API_KEY is not configured on the server');
      err.status = 503;
      throw err;
    }

    const body = {
      model: payload.model || this.defaultModel,
      messages: payload.messages || [],
      temperature: payload.temperature ?? 0.2,
      ...(payload.tools ? { tools: payload.tools } : {}),
      ...(payload.tool_choice ? { tool_choice: payload.tool_choice } : {}),
      ...(payload.max_tokens ? { max_tokens: payload.max_tokens } : {}),
      ...(payload.response_format ? { response_format: payload.response_format } : {}),
    };

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let parsedMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedMessage = parsed.error?.message || errorText;
      } catch {
        // use raw text
      }
      const err = new Error(`Gemini API error (${res.status}): ${parsedMessage}`);
      err.status = res.status;
      throw err;
    }

    return await res.json();
  }
}

export const defaultLlmClient = new LlmClient();
