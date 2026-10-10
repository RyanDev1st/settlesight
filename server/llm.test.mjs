import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LlmClient,
  GEMINI_OPENAI_URL,
  NEBIUS_TOKEN_FACTORY_URL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_NEBIUS_MODEL,
} from './llm.mjs';

describe('LlmClient Multi-Provider & Nebius Unit Tests', () => {
  test('Defaults to Gemini provider when LLM_PROVIDER is unset', () => {
    const client = new LlmClient({
      provider: 'gemini',
      apiKey: 'test-gemini-key',
    });
    assert.equal(client.getProvider(), 'gemini');
    assert.equal(client.apiUrl, GEMINI_OPENAI_URL);
    assert.equal(client.defaultModel, DEFAULT_GEMINI_MODEL);
    assert.equal(client.hasApiKey(), true);
  });

  test('Configures Nebius Token Factory provider and default Nemotron model', () => {
    const client = new LlmClient({
      provider: 'nebius',
      apiKey: 'test-nebius-key',
    });
    assert.equal(client.getProvider(), 'nebius');
    assert.equal(client.apiUrl, NEBIUS_TOKEN_FACTORY_URL);
    assert.equal(client.defaultModel, 'nvidia/nemotron-3-super-120b-a12b');
    assert.equal(client.hasApiKey(), true);
  });

  test('Rejection when API key missing: throws HTTP 503 with exact provider key name', async () => {
    const nebiusClient = new LlmClient({ provider: 'nebius', apiKey: '' });
    assert.equal(nebiusClient.hasApiKey(), false);
    await assert.rejects(
      async () => nebiusClient.chatCompletion({ messages: [{ role: 'user', content: 'test' }] }),
      (err) => {
        assert.equal(err.status, 503);
        assert.ok(err.message.includes('NEBIUS_API_KEY'));
        return true;
      }
    );

    const geminiClient = new LlmClient({ provider: 'gemini', apiKey: '' });
    assert.equal(geminiClient.hasApiKey(), false);
    await assert.rejects(
      async () => geminiClient.chatCompletion({ messages: [{ role: 'user', content: 'test' }] }),
      (err) => {
        assert.equal(err.status, 503);
        assert.ok(err.message.includes('GEMINI_API_KEY'));
        return true;
      }
    );
  });

  test('Nebius request shape: verifies base URL, headers, Nemotron model, and tool calling structure', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-nebius-12345',
          model: 'nvidia/nemotron-3-super-120b-a12b',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_triage_001',
                    type: 'function',
                    function: {
                      name: 'list_exceptions',
                      arguments: JSON.stringify({ minConfidence: 0.8 }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 45, completion_tokens: 28, total_tokens: 73 },
        }),
      };
    };

    const client = new LlmClient({
      provider: 'nebius',
      apiKey: 'nebius_live_token_secret_xyz',
      fetchFn: mockFetch,
    });

    const toolsDefinition = [
      {
        type: 'function',
        function: {
          name: 'list_exceptions',
          description: 'List exceptions and candidate matches in reconciliation queue',
          parameters: {
            type: 'object',
            properties: {
              minConfidence: { type: 'number' },
            },
          },
        },
      },
    ];

    const result = await client.chatCompletion({
      messages: [{ role: 'user', content: 'Audit ambiguous exceptions' }],
      tools: toolsDefinition,
      tool_choice: 'auto',
    });

    // 1. Verify URL conforms to official Nebius Token Factory endpoint
    assert.equal(capturedUrl, 'https://api.tokenfactory.nebius.com/v1/chat/completions');

    // 2. Verify Authorization Header conforming to Nebius Bearer token format
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(capturedOptions.headers.Authorization, 'Bearer nebius_live_token_secret_xyz');

    // 3. Verify Body Payload shape
    const body = JSON.parse(capturedOptions.body);
    assert.equal(body.model, 'nvidia/nemotron-3-super-120b-a12b');
    assert.equal(body.messages[0].content, 'Audit ambiguous exceptions');
    assert.equal(body.tools[0].function.name, 'list_exceptions');
    assert.equal(body.tool_choice, 'auto');

    // 4. Verify completion response handling
    assert.equal(result.id, 'chatcmpl-nebius-12345');
    assert.equal(result.choices[0].message.tool_calls[0].function.name, 'list_exceptions');
  });

  test('Gemini request shape: verifies base URL, headers, and gemini-2.5-flash model', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-gemini-999',
          model: 'gemini-2.5-flash',
          choices: [{ message: { role: 'assistant', content: 'Gemini audited successfully.' } }],
        }),
      };
    };

    const client = new LlmClient({
      provider: 'gemini',
      apiKey: 'gemini_test_token_abc',
      fetchFn: mockFetch,
    });

    const result = await client.chatCompletion({
      messages: [{ role: 'user', content: 'Check ledger health' }],
    });

    assert.equal(capturedUrl, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(capturedOptions.headers.Authorization, 'Bearer gemini_test_token_abc');
    const body = JSON.parse(capturedOptions.body);
    assert.equal(body.model, 'gemini-2.5-flash');
    assert.equal(result.choices[0].message.content, 'Gemini audited successfully.');
  });

  test('Model override: allows targeting Nemotron Ultra 550b for deep reasoning', async () => {
    let capturedBody = null;
    const mockFetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
      };
    };

    const client = new LlmClient({
      provider: 'nebius',
      apiKey: 'key',
      defaultModel: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      fetchFn: mockFetch,
    });

    await client.chatCompletion({ messages: [{ role: 'user', content: 'deep analysis' }] });
    assert.equal(capturedBody.model, 'nvidia/Nemotron-3-Ultra-550b-a55b');
  });

  test('Error propagation: propagates status and parses Nebius JSON error messages', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid Token Factory API key' } }),
    });

    const client = new LlmClient({
      provider: 'nebius',
      apiKey: 'invalid-key',
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => client.chatCompletion({ messages: [] }),
      (err) => {
        assert.equal(err.status, 401);
        assert.ok(err.message.includes('Nebius Token Factory API error (401)'));
        assert.ok(err.message.includes('Invalid Token Factory API key'));
        return true;
      }
    );
  });
});
