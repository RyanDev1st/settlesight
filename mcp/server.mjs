import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import handler from './handler.mjs';
import agentHandler from '../alexa-sim/api.mjs';

export function startServer(port = 8790) {
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/mcp') return await handler(req, res);
      if (path === '/alexa-sim/api') return await agentHandler(req, res);
      if (path === '/' || path === '/alexa-sim' || path === '/alexa-sim/') {
        res.writeHead(302, { Location: '/alexa-sim/index.html' });
        return res.end();
      }
      if (!/^\/alexa-sim\/(index\.html|assets\/[\w.-]+)$/.test(path)) { res.writeHead(404); return res.end(); }
      const file = await readFile(new URL(`../dist${path}`, import.meta.url));
      const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
      res.writeHead(200, { 'Content-Type': type });
      res.end(file);
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.MCP_PORT || 8790));
  console.log(`SettleSight MCP: http://127.0.0.1:${server.address().port}/mcp | Alexa+ simulation: /alexa-sim/ (run npm run build first)`);
}
