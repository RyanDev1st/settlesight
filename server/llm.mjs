/**
 * SettleSight — LLM Client Proxy (Gemini & Nebius Token Factory)
 *
 * Forwards chat completions to either:
 * - Google's OpenAI-compatible endpoint:
 *   https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
 * - Nebius Token Factory OpenAI-compatible endpoint:
 *   https://api.tokenfactory.nebius.com/v1/chat/completions
 *
 * References:
 * - Google Gemini: https://ai.google.dev/gemini-api/docs/openai
 * - Nebius Token Factory: https://docs.nebius.com/token-factory/
 * - NVIDIA Nemotron on Nebius: https://docs.nebius.com/token-factory/models/nemotron
 *
 * Keeps API keys strictly on the server; the browser never receives
 * or inspects authentication credentials.
 */

export const GEMINI_OPENAI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const NEBIUS_TOKEN_FACTORY_URL = 'https://api.tokenfactory.nebius.com/v1/chat/completions';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_NEBIUS_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

export class LlmClient {
  /**
   * @param {object} [options]
   * @param {'gemini'|'nebius'} [options.provider] Provider identifier
   * @param {string} [options.apiKey] API key override
   * @param {string} [options.apiUrl] API URL override
   * @param {string} [options.defaultModel] Model name override
   * @param {typeof fetch} [options.fetchFn] Custom fetch function for testing
   */
  constructor(options = {}) {
    const envProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
    if (options.provider) {
      this.provider = options.provider;
    } else if (envProvider === 'nebius') {
      this.provider = 'nebius';
    } else if (envProvider === 'gemini') {
      this.provider = 'gemini';
    } else if (process.env.NEBIUS_API_KEY && !process.env.GEMINI_API_KEY) {
      this.provider = 'nebius';
    } else {
      this.provider = 'gemini';
    }

    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);

    if (this.provider === 'nebius') {
      this.apiKey = options.apiKey !== undefined
        ? options.apiKey
        : (process.env.NEBIUS_API_KEY || '');
      this.apiUrl = options.apiUrl || process.env.NEBIUS_BASE_URL || NEBIUS_TOKEN_FACTORY_URL;
      this.defaultModel = options.defaultModel || process.env.NEBIUS_MODEL || DEFAULT_NEBIUS_MODEL;
    } else {
      this.apiKey = options.apiKey !== undefined
        ? options.apiKey
        : (process.env.GEMINI_API_KEY || '');
      this.apiUrl = options.apiUrl || process.env.GEMINI_BASE_URL || GEMINI_OPENAI_URL;
      this.defaultModel = options.defaultModel || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    }
  }

  getProvider() {
    return this.provider;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Forwards chat completion request to the active LLM provider.
   *
   * @param {object} payload Request body conforming to OpenAI chat completion format
   * @param {AbortSignal} [signal] Optional abort signal
   * @returns {Promise<object>} JSON completion response
   */
  async chatCompletion(payload = {}, signal) {
    if (!this.hasApiKey()) {
      const keyName = this.provider === 'nebius' ? 'NEBIUS_API_KEY' : 'GEMINI_API_KEY';
      const err = new Error(`${keyName} is not configured on the server`);
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

    const res = await this.fetchFn(this.apiUrl, {
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
        parsedMessage = parsed.error?.message || parsed.message || errorText;
      } catch {
        // use raw text
      }
      const providerLabel = this.provider === 'nebius' ? 'Nebius Token Factory' : 'Gemini';
      const err = new Error(`${providerLabel} API error (${res.status}): ${parsedMessage}`);
      err.status = res.status;
      throw err;
    }

    return await res.json();
  }
}

export const defaultLlmClient = new LlmClient();
