import { LlmClient } from '../server/llm.mjs';

const client = new LlmClient({
  fetchFn: (url, options) => {
    if (options.body) {
      const body = JSON.parse(options.body);
      // Nemotron voice turns use direct answers, leaving the budget for tool calls.
      if (/nemotron/i.test(body.model || '')) body.chat_template_kwargs = { enable_thinking: false };
      options = { ...options, body: JSON.stringify(body) };
    }
    return fetch(url, options);
  },
});
export default async function agentHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.writeHead(405); return res.end(JSON.stringify({ error: 'POST required' })); }
  try {
    let body = req.body;
    if (!body) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 100000) throw new Error('Conversation too long; reload the demo');
      }
      body = JSON.parse(raw);
    }
    const result = await client.chatCompletion({ messages: body.messages, tools: body.tools, tool_choice: 'auto', max_tokens: 2048 }, AbortSignal.timeout(45000));
    res.end(JSON.stringify({ message: result.choices?.[0]?.message, provider: client.getProvider() }));
  } catch (error) {
    res.writeHead(error.status === 503 ? 503 : 502);
    res.end(JSON.stringify({ error: error.status === 503 ? 'No server LLM key configured; use the clearly labelled scripted demo.' : 'LLM unavailable; retry or use the scripted demo.', offline_available: true }));
  }
}
