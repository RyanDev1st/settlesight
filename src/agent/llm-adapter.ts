/**
 * SettleSight — AG Studio LLM Adapter for Gemini Proxy
 *
 * Implements AgLlmAdapter to communicate with the local proxy at /api/llm,
 * which forwards requests to Gemini 2.5 Flash via Google's OpenAI endpoint.
 */

import type {
  AgLlmAdapter,
  AgLlmRequest,
  AgLlmResponseHandler,
  AgLlmExecuteTurnOptions,
  AgLlmResponse,
} from 'ag-studio';

export class GeminiLlmAdapter implements AgLlmAdapter {
  private endpoint: string;

  constructor(endpoint: string = '/api/llm') {
    this.endpoint = endpoint;
  }

  executeTurn(request: AgLlmRequest, options?: AgLlmExecuteTurnOptions): AgLlmResponseHandler {
    const signal = options?.signal;

    // Convert AG Studio conversation input to OpenAI-compatible messages format
    const messages: Array<{ role: string; content: string; name?: string; tool_call_id?: string }> = [];

    if (request.instructions) {
      messages.push({ role: 'system', content: request.instructions });
    }

    for (const item of request.input || []) {
      if ((item as any).role === 'user') {
        const text = typeof (item as any).content === 'string'
          ? (item as any).content
          : JSON.stringify((item as any).content);
        messages.push({ role: 'user', content: text });
      } else if ((item as any).role === 'assistant') {
        const text = typeof (item as any).content === 'string'
          ? (item as any).content
          : JSON.stringify((item as any).content);
        messages.push({ role: 'assistant', content: text });
      }
    }

    // Convert AG Studio tool schemas if provided
    const tools = (request.tools || []).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const payload: Record<string, unknown> = {
      model: request.model?.id || 'gemini-2.5-flash',
      messages,
      ...(tools.length > 0 ? { tools } : {}),
    };

    const completionPromise: Promise<AgLlmResponse> = (async () => {
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return {
            id: `err-${Date.now()}`,
            createdAt: Date.now(),
            status: 'failed',
            error: { code: String(res.status), message: errText || 'LLM proxy error' },
            output: [],
          };
        }

        const data = await res.json();
        const choice = data?.choices?.[0];
        const content = choice?.message?.content || '';

        const output: any[] = [];
        if (content) {
          output.push({
            type: 'message',
            content: [{ type: 'text', text: content }],
          });
        }

        // Handle tool calls from model if any
        if (choice?.message?.tool_calls) {
          for (const tc of choice.message.tool_calls) {
            output.push({
              type: 'tool_call',
              callId: tc.id,
              name: tc.function?.name,
              args: JSON.parse(tc.function?.arguments || '{}'),
            });
          }
        }

        return {
          id: data.id || `turn-${Date.now()}`,
          createdAt: Date.now(),
          status: 'completed',
          output,
          model: data.model || 'gemini-2.5-flash',
          usage: data.usage
            ? {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return {
            id: `abort-${Date.now()}`,
            createdAt: Date.now(),
            status: 'cancelled',
            output: [],
          };
        }
        return {
          id: `err-${Date.now()}`,
          createdAt: Date.now(),
          status: 'failed',
          error: { code: 'NETWORK_ERROR', message: err.message },
          output: [],
        };
      }
    })();

    // Stream generator yielding the completed response as protocol events
    const stream = {
      async *[Symbol.asyncIterator]() {
        const result = await completionPromise;
        for (const out of result.output) {
          if (out.type === 'message') {
            for (const c of out.content) {
              if (c.type === 'text') {
                yield { type: 'content_delta', delta: c.text };
              }
            }
          }
        }
      },
    };

    return {
      stream: stream as any,
      complete: completionPromise,
    };
  }
}
