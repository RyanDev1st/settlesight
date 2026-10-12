import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const $ = id => document.getElementById(id);
const client = new Client({ name: 'settlesight-alexa-simulation', version: '0.2.0' });
let tools = [], busy = false, pending = null, selected = 'INV-2026-016';
const messages = [{ role: 'system', content: 'You are SettleSight in an Alexa+ web simulation, using synthetic data. Use MCP tools for all financial facts. Raw money in summaries is integer USD cents: use formatted_usd strings verbatim for dollar amounts and never calculate conversions yourself. Answer in at most three short sentences and explain evidence briefly. Approvals require a separate explicit user yes; first call approve_match with confirm=false. Drafts are never sent. Do not claim native Alexa or live PayPal access.' }];

function say(text, role = 'assistant') {
  const node = document.createElement('div');
  node.className = `message ${role}`;
  node.textContent = `${role === 'user' ? 'You' : 'SettleSight'}: ${text}`;
  $('messages').append(node);
  node.scrollIntoView({ block: 'nearest' });
  if (role === 'assistant' && $('spoken').checked && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}

async function invoke(name, args = {}) {
  const raw = await client.callTool({ name, arguments: args });
  const text = raw.content.find(item => item.type === 'text').text;
  let result;
  try { result = JSON.parse(text); } catch { result = text; }
  const entry = document.createElement('details');
  const title = document.createElement('summary');
  title.textContent = `${name}(${JSON.stringify(args)})${raw.isError ? ' · error' : ' · complete'}`;
  const output = document.createElement('pre');
  output.textContent = JSON.stringify(result, null, 2);
  entry.append(title, output); $('trace').prepend(entry);
  if (raw.isError) throw new Error(result);
  if (name === 'explain_match') selected = result.matchId;
  if (name === 'approve_match') pending = result.confirmation_required ? result.matchId : null;
  if (name === 'reconciliation_summary' || result.summary) {
    const summary = result.summary || result;
    $('percent').textContent = `${summary.matched_percent}%`;
    $('meter').value = summary.matched_percent;
    $('metrics').textContent = `${summary.suggested_count} candidate matches · ${summary.exceptions_count} ambiguities · $${(summary.open_value / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} open`;
  }
  return result;
}

async function scripted(question) {
  const invoice = question.match(/INV-2026-\d+/i)?.[0]?.toUpperCase() || selected;
  if (/approve/i.test(question)) return (await invoke('approve_match', { id: invoice, confirm: false })).prompt;
  if (/why|explain|flagged/i.test(question)) { const r = await invoke('explain_match', { id: invoice }); return `${r.invoiceNumber}: ${r.explanation} ${r.recommendedAction}`; }
  if (/review|exception/i.test(question)) { const r = await invoke('list_exceptions'); return `${r.count} items need review. ${r.items.slice(0, 5).map(i => `${i.invoiceNumber}: ${i.method}`).join('; ')}. Ask why INV-2026-016 is flagged.`; }
  if (/reminder/i.test(question)) { const r = await invoke('draft_payment_reminder', { invoice_id: invoice }); return `Draft only: ${r.subject}. Nothing was sent.`; }
  if (/summary|reconciliation|month.end/i.test(question)) { const r = await invoke('reconciliation_summary'); return `${r.matched_percent}% of invoice value is reconciled. ${r.suggested_count} candidate matches and ${r.exceptions_count} ambiguities need review.`; }
  return 'Scripted demo supports a summary, review queue, invoice explanation, approval and reminder draft. Try the example buttons.';
}

async function agent(question) {
  messages.push({ role: 'user', content: question });
  for (let step = 0; step < 5; step++) {
    const response = await fetch('/alexa-sim/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, tools }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    $('provider').textContent = `Live ${data.provider} function calling → MCP tools`;
    const message = data.message;
    if (!message) throw new Error('Empty LLM response');
    messages.push({ role: 'assistant', content: message.content, ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}) });
    if (!message.tool_calls?.length) {
      if (!message.content?.trim()) throw new Error('The LLM returned an empty answer. Retry or use the scripted demo.');
      return message.content;
    }
    let confirmationPrompt;
    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments || '{}');
      // Only the explicit confirmation branch below may send confirm=true.
      if (call.function.name === 'approve_match') args.confirm = false;
      const result = await invoke(call.function.name, args);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      if (result.confirmation_required) confirmationPrompt = result.prompt;
    }
    if (confirmationPrompt) return confirmationPrompt;
  }
  throw new Error('Agent reached the five-step limit. Try a shorter question.');
}

async function submit(question) {
  if (busy) return;
  busy = true; $('send').disabled = true; $('talk').disabled = true;
  say(question, 'user'); $('question').value = '';
  try {
    let reply;
    if (pending && /^(yes|yes[, ]*confirm|confirm|yes please)[.!]?$/i.test(question.trim())) {
      const result = await invoke('approve_match', { id: pending, confirm: true });
      reply = result.success ? `Approved ${result.matchId} in the synthetic demo. Reconciliation is now ${result.summary.matched_percent}%.` : `Approval failed: ${result.error}`;
      messages.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
    } else {
      if (pending) pending = null;
      reply = $('scripted').checked ? await scripted(question) : await agent(question);
    }
    say(reply);
  } catch (error) { say(error.message); }
  finally { busy = false; $('send').disabled = false; $('talk').disabled = !Recognition; }
}

$('chat').addEventListener('submit', event => { event.preventDefault(); void submit($('question').value); });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => void submit(button.dataset.prompt)));
$('scripted').addEventListener('change', () => { $('provider').textContent = $('scripted').checked ? 'Scripted demo · no LLM · real MCP calls' : 'LLM mode · server-side keys required'; });
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Recognition) {
  const recognition = new Recognition(); recognition.lang = 'en-US'; recognition.interimResults = false;
  $('talk').addEventListener('click', () => { $('speech-status').textContent = 'Listening…'; recognition.start(); });
  recognition.onresult = event => { void submit(event.results[0][0].transcript); };
  recognition.onerror = event => { $('speech-status').textContent = `Speech recognition: ${event.error}. Use the text box.`; };
  recognition.onend = () => { if ($('speech-status').textContent === 'Listening…') $('speech-status').textContent = ''; };
} else { $('talk').disabled = true; $('speech-status').textContent = 'Speech recognition is unavailable here. Use the text box.'; }

async function connect() {
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', location.origin)));
  const list = await client.listTools();
  tools = list.tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }));
  $('provider').textContent = 'MCP connected · LLM mode · server-side keys required';
  await invoke('reconciliation_summary');
} catch (error) { $('provider').textContent = `Connection failed: ${error.message}`; }
}
void connect();
