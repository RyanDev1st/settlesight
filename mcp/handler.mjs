import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDemo, definitions, callTool } from './tools.mjs';

// Ephemeral synthetic state; transport sessions are deliberately disabled.
const demo = createDemo();

export function createMcpServer(state = demo) {
  const server = new McpServer({ name: 'settlesight', version: '0.2.0' });
  for (const [name, definition] of Object.entries(definitions)) {
    server.registerTool(name, {
      description: definition.description,
      inputSchema: definition.schema,
      annotations: { readOnlyHint: name !== 'approve_match', destructiveHint: false, openWorldHint: false },
    }, async args => {
      try {
        return { content: [{ type: 'text', text: JSON.stringify(callTool(state, name, args)) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: JSON.stringify(error.message) }] };
      }
    });
  }
  return server;
}

export default async function handler(req, res) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
