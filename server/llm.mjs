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
 * - Nebius Token Factory Quickstart: https://docs.tokenfactory.nebius.com/quickstart
 * - Nebius Function Calling: https://docs.tokenfactory.nebius.com/ai-models-inference/function-calling
 * - Nebius API Reference: https://docs.tokenfactory.nebius.com/api-reference/introduction
 *
 * Keeps API keys strictly on the server; the browser never receives
 * or inspects authentication credentials.
 */

export const GEMINI_OPENAI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const NEBIUS_TOKEN_FACTORY_URL = 'https://api.tokenfactory.nebius.com/v1/chat/completions';
export const NEBIUS_TOKEN_FACTORY_MODELS_URL = 'https://api.tokenfactory.nebius.com/v1/models';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_NEBIUS_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

export class LlmClient {
  /**
   * @param {object} [options]
   * @param {'gemini'|'nebius'} [options.provider] Provider identifier
   * @param {string} [options.apiKey] API key override
   * @param {string} [options.apiUrl] API URL override
   * @param {string} [options.modelsUrl] Models list URL override
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
      this.modelsUrl = options.modelsUrl || (this.apiUrl.replace(/\/chat\/completions\/?$/, '') + '/models');
      this.configuredModelOverride = options.defaultModel || process.env.NEBIUS_MODEL || null;
      this.defaultModel = this.configuredModelOverride || DEFAULT_NEBIUS_MODEL;
    } else {
      this.apiKey = options.apiKey !== undefined
        ? options.apiKey
        : (process.env.GEMINI_API_KEY || '');
      this.apiUrl = options.apiUrl || process.env.GEMINI_BASE_URL || GEMINI_OPENAI_URL;
      this.modelsUrl = options.modelsUrl || '';
      this.configuredModelOverride = options.defaultModel || process.env.GEMINI_MODEL || null;
      this.defaultModel = this.configuredModelOverride || DEFAULT_GEMINI_MODEL;
    }

    // Cache resolved model from /v1/models call
    this.modelDiscovery = null;
  }

  getProvider() {
    return this.provider;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Resolves the active model ID at runtime:
   * - For Gemini: returns configured model or gemini-2.5-flash.
   * - For Nebius with API key: queries GET /v1/models (cached at first use).
   *   Chooses in order:
   *   1. NEBIUS_MODEL env if set and present in the NVIDIA Nemotron list;
   *   2. Super for triage; Nano/Lightning for fast tool calls;
   *   3. Throws clear error if no NVIDIA Nemotron model is available.
   *
   * @param {AbortSignal} [signal] Optional abort signal
   * @returns {Promise<string>} Chosen model ID
   */
  async resolveModel(signal, fast = false) {
    if (this.provider === 'gemini') {
      return this.configuredModelOverride || DEFAULT_GEMINI_MODEL;
    }

    // If no API key is set yet (demo/offline mode), return configured or default placeholder
    if (!this.hasApiKey()) {
      return this.configuredModelOverride || DEFAULT_NEBIUS_MODEL;
    }

    if (!this.modelDiscovery) this.modelDiscovery = this.discoverModels(signal).catch((err) => {
      this.modelDiscovery = null;
      throw err;
    });
    const modelIds = await this.modelDiscovery;
    const nemotron = modelIds.filter((id) => /^nvidia\/.*nemotron/i.test(id));
    if (!nemotron.length) throw new Error('No NVIDIA Nemotron model available on this Token Factory account');
    const override = this.configuredModelOverride?.trim();
    if (override) {
      if (!nemotron.includes(override)) throw new Error(`Configured NEBIUS_MODEL is not available as a NVIDIA Nemotron model: ${override}`);
      return override;
    }
    const preferences = fast ? [/nano/i, /lightning/i, /super/i] : [/super/i, /ultra/i, /nano/i, /lightning/i];
    return preferences.map((pattern) => nemotron.find((id) => pattern.test(id))).find(Boolean) || nemotron[0];
  }

  async discoverModels(signal) {
    const res = await this.fetchFn(this.modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey.trim()}`,
        Accept: 'application/json',
      },
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let parsedMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedMessage = parsed.error?.message || parsed.message || errorText;
      } catch {}
      const err = new Error(`Nebius Token Factory models error (${res.status}): ${parsedMessage}`);
      err.status = res.status;
      throw err;
    }

    const body = await res.json();
    const rawList = Array.isArray(body)
      ? body
      : (Array.isArray(body?.data) ? body.data : (Array.isArray(body?.models) ? body.models : []));

    return rawList
      .map((m) => (typeof m === 'string' ? m : (m?.id || m?.name || '')))
      .filter(Boolean);

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

    // Resolve model at runtime if not specified in payload
    let targetModel = payload.model;
    if (!targetModel) {
      targetModel = await this.resolveModel(signal, Boolean(payload.tools));
    }

    const body = {
      model: targetModel,
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
