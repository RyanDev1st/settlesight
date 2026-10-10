/**
 * SettleSight - Local PayPal Sandbox & AI Proxy Server
 *
 * Provides safe REST endpoints for the browser dashboard.
 * Secrets are kept strictly server-side and never logged or exposed.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PayPalClient } from './paypal.mjs';
import { LlmClient } from './llm.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Built-in zero-dependency .env parser.
 * Reads KEY=VALUE pairs, ignores comments and whitespace, and sets process.env.
 */
export function loadEnvFile(envPath) {
  const targetPath = envPath || path.resolve(__dirname, '../.env');
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();

      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      // Do not overwrite existing environment variables
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
    return true;
  } catch (err) {
    console.warn('Could not read .env file:', err.message);
    return false;
  }
}

// Load .env on module load
loadEnvFile();

/**
 * Checks if origin is a local development origin.
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * Sets standard JSON and CORS headers.
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
}

/**
 * Parses JSON body from request.
 */
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Factory for creating the server instance.
 */
export function createServer(options = {}) {
  const client = options.paypalClient || new PayPalClient();
  const llmClient = options.llmClient || new LlmClient();

  return http.createServer(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    try {
      // GET /api/health
      if (req.method === 'GET' && pathname === '/api/health') {
        const hasPaypal = client.hasCredentials();
        const hasLlm = llmClient.hasApiKey();
        const llmProvider = typeof llmClient.getProvider === 'function'
          ? llmClient.getProvider()
          : (llmClient.provider || 'gemini');
        const payload = {
          mode: hasPaypal ? 'live' : 'demo',
          hasPaypal,
          hasLlm,
          llmProvider,
          llmModel: typeof llmClient.resolveModel === 'function' ? await llmClient.resolveModel() : '',
          hasLlmKey: hasLlm,
        };
        res.writeHead(200);
        return res.end(JSON.stringify(payload));
      }

      // GET /api/invoices
      if (req.method === 'GET' && pathname === '/api/invoices') {
        if (!client.hasCredentials()) {
          res.writeHead(503);
          return res.end(JSON.stringify({ error: 'PayPal credentials not configured on server' }));
        }

        const pageSize = Number(parsedUrl.searchParams.get('page_size')) || 20;
        const invoices = await client.listInvoices({ pageSize });
        res.writeHead(200);
        return res.end(JSON.stringify(invoices));
      }

      // GET /api/transactions
      if (req.method === 'GET' && pathname === '/api/transactions') {
        if (!client.hasCredentials()) {
          res.writeHead(503);
          return res.end(JSON.stringify({ error: 'PayPal credentials not configured on server' }));
        }

        const startDate = parsedUrl.searchParams.get('start_date');
        const endDate = parsedUrl.searchParams.get('end_date');
        let transactions;
        try {
          transactions = await client.listTransactions(startDate, endDate);
        } catch (err) {
          if (err.status !== 403) throw err;
          const reason = 'Live invoices + demo transactions (enable Transaction Search on your sandbox app)';
          console.warn(`PayPal Transaction Search HTTP 403: ${reason}`);
          res.writeHead(403);
          return res.end(JSON.stringify({ error: reason, code: 'TRANSACTION_SEARCH_DISABLED' }));
        }
        res.writeHead(200);
        return res.end(JSON.stringify(transactions));
      }

      // POST /api/invoices/:id/record-payment
      const recordMatch = pathname.match(/^\/api\/invoices\/([^/]+)\/record-payment$/);
      if (req.method === 'POST' && recordMatch) {
        const invoiceId = decodeURIComponent(recordMatch[1]);
        const body = await parseJsonBody(req);

        // Guard: Action requires explicit user confirmation
        if (body.confirmedByUser !== true) {
          res.writeHead(400);
          return res.end(
            JSON.stringify({
              error: 'Action requires explicit user confirmation (confirmedByUser: true)',
            })
          );
        }

        const result = await client.recordPayment(invoiceId, body);
        res.writeHead(200);
        return res.end(JSON.stringify(result));
      }

      // POST /api/invoices/:id/remind
      const remindMatch = pathname.match(/^\/api\/invoices\/([^/]+)\/remind$/);
      if (req.method === 'POST' && remindMatch) {
        const invoiceId = decodeURIComponent(remindMatch[1]);
        const body = await parseJsonBody(req);

        // Guard: Action requires explicit user confirmation
        if (body.confirmedByUser !== true) {
          res.writeHead(400);
          return res.end(
            JSON.stringify({
              error: 'Action requires explicit user confirmation (confirmedByUser: true)',
            })
          );
        }

        const result = await client.sendReminder(invoiceId, body);
        res.writeHead(200);
        return res.end(JSON.stringify(result));
      }

      // POST /api/llm
      if (req.method === 'POST' && pathname === '/api/llm') {
        if (!llmClient.hasApiKey()) {
          const provider = typeof llmClient.getProvider === 'function'
            ? llmClient.getProvider()
            : (llmClient.provider || 'gemini');
          const keyName = provider === 'nebius' ? 'NEBIUS_API_KEY' : 'GEMINI_API_KEY';
          res.writeHead(503);
          return res.end(
            JSON.stringify({
              error: `${keyName} is not configured on server. Live AI disabled.`,
            })
          );
        }

        const body = await parseJsonBody(req);
        const completion = await llmClient.chatCompletion(body);
        res.writeHead(200);
        return res.end(JSON.stringify(completion));
      }

      // 404 for unknown routes
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch (err) {
      console.error('API Error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  });
}

// Start server if executed directly
if (process.argv[1] && (process.argv[1].includes('server/index.mjs') || process.argv[1].includes('server\\index.mjs'))) {
  const PORT = Number(process.env.PORT) || 8787;
  const server = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`SettleSight PayPal proxy server running at http://127.0.0.1:${PORT}`);
    console.log(`Live Mode Active: ${new PayPalClient().hasCredentials()}`);
  });
}
