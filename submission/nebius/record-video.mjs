import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from '../../server/index.mjs';
import { findBinary, assembleVideo } from '../video/build-video.mjs';

const directory = path.resolve('submission/nebius');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const ffmpeg = findBinary('FFMPEG_BIN', 'ffmpeg');
const ffprobe = findBinary('FFPROBE_BIN', 'ffprobe');
const output = 'settlesight-nebius.mp4';
const fps = 10;

// Capture actual UI actions first. Audio and edited shot lengths derive from that run.
export async function runNebiusVideo() {
  if (process.argv.includes('--assemble-only')) {
    return buildFromRun(JSON.parse(fs.readFileSync(path.join(directory, 'run-log.json'), 'utf8')));
  }
  for (const folder of ['captures', 'frames', 'audio', 'qc']) fs.mkdirSync(path.join(directory, folder), { recursive: true });
  const run = { recordedAt: new Date().toISOString(), dataSource: 'demo', llmProvider: 'nebius', calls: [] };
  let server;
  let ws;
  let edge;
  const startServer = async source => {
    process.env.DATA_SOURCE = source;
    server = createServer();
    await new Promise(resolve => server.listen(8787, '127.0.0.1', resolve));
  };
  try {
    await startServer('demo');
    const health = await (await fetch('http://127.0.0.1:8787/api/health')).json();
    if (!health.hasLlm || health.llmProvider !== 'nebius' || health.mode !== 'demo') throw new Error('Hybrid inference health check failed');
    run.health = health;
    edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
      '--headless=new', '--no-first-run', '--disable-gpu', '--disable-extensions', '--window-size=1920,1080',
      '--remote-debugging-port=9233', `--user-data-dir=${path.join(os.tmpdir(), 'settlesight-nebius-video-edge')}`, 'about:blank',
    ], { stdio: 'ignore', windowsHide: true });
    let target;
    for (let i = 0; i < 40 && !target; i++) {
      try { target = (await (await fetch('http://127.0.0.1:9233/json/list')).json()).find(page => page.type === 'page' && page.url === 'about:blank'); } catch {}
      if (!target) await delay(500);
    }
    if (!target) throw new Error('Edge CDP unavailable');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => { ws.onopen = resolve; });
    let nextId = 0;
    const pending = new Map();
    const consoleErrors = [];
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.result?.description);
      return result.result.value;
    };
    const waitFor = async expression => {
      for (let i = 0; i < 180; i++) {
        if (await evaluate(expression)) return;
        await delay(500);
      }
      throw new Error('Timed out waiting for UI: ' + expression);
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await waitFor(`document.body.innerText.includes('Demo data · Nemotron Live')`);
    await evaluate(`localStorage.clear()`);
    await send('Page.reload');
    await waitFor(`document.body.innerText.includes('Demo data · Nemotron Live')`);
    await waitFor(`document.querySelector('aside') && document.body.innerText.includes('Run AI Triage (Nemotron)')`);
    await evaluate(`(() => {
      window.__calls = [];
      const original = window.fetch;
      window.fetch = async (...args) => {
        const started = performance.now();
        const response = await original(...args);
        if (args[0] === '/api/llm') {
          const completion = await response.clone().json();
          window.__calls.push({ latencyMs: Math.round(performance.now() - started), completion });
        }
        return response;
      };
      document.querySelector('aside').style.width = '560px';
      document.querySelector('aside').style.minWidth = '560px';
    })()`);
    const capture = async name => {
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      fs.writeFileSync(path.join(directory, 'captures', name + '.jpg'), Buffer.from(shot.data, 'base64'));
    };
    const click = async text => {
      const point = await evaluate(`(() => {
        const element = [...document.querySelectorAll('button')].find(button => button.innerText.trim() === ${JSON.stringify(text)});
        if (!element) throw new Error('Button missing');
        element.scrollIntoView({ block: 'center' });
        const rect = element.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
      await delay(400);
    };
    await waitFor(`!document.body.innerText.includes('Loading...')`);
    await delay(1000);
    await capture('overview');
    if (process.argv.includes('--overview-only')) return;
    console.log('Hybrid dashboard captured; calling real Nemotron triage');
    await click('Run AI Triage (Nemotron)');
    await capture('triage-click');
    await waitFor(`document.body.innerText.includes('Ranked Priority Queue') && !document.querySelector('input').nextElementSibling.disabled`);
    await evaluate(`document.querySelector('aside').querySelector('[style*="overflow-y"]').scrollTop = 0`);
    await capture('triage');
    const observed = await evaluate(`(async () => {
      const data = await import('/src/ui/data.ts');
      const { triageExceptionsWithNemotron } = await import('/src/agent/triage.js');
      const initial = data.getInitialDemoData();
      window.__initial = initial;
      const completion = window.__calls[0].completion;
      const triage = await triageExceptionsWithNemotron({ state: initial.state, model: completion.model, callLlm: async () => completion });
      window.__triage = triage;
      return { triage, summary: initial.summary, calls: window.__calls };
    })()`);
    if (observed.triage.mode !== 'nemotron_live' || !observed.triage.rejectedCount) throw new Error('Capture requires real triage and validator rejections');
    run.triage = observed.triage;
    run.beforeApproval = observed.summary;
    const rejectText = observed.triage.rankedItems.find(item => !item.invariantPassed).rejectionReason;
    await evaluate(`(() => {
      const element = [...document.querySelectorAll('span')].find(span => span.innerText.includes('Invariant Rejection: ' + ${JSON.stringify(rejectText)}));
      element.scrollIntoView({ block: 'center' });
    })()`);
    await capture('validator');
    const approval = observed.triage.rankedItems.find(item => item.invariantPassed && !item.isAmbiguityException && item.allocatedCents > 0);
    if (!approval) throw new Error('No approvable allocation');
    run.approvedMatchId = approval.matchId;
    run.afterApproval = await evaluate(`(async () => {
      const { applyDecision } = await import('/src/match/engine.js');
      const { summarize } = await import('/src/match/summary.js');
      return summarize(applyDecision(window.__initial.state, ${JSON.stringify(approval.matchId)}, 'approve'));
    })()`);
    await evaluate(`(() => {
      const heading = [...document.querySelectorAll('span')].find(span => span.innerText.startsWith('#') && span.innerText.includes(${JSON.stringify(approval.invoiceNumber)}));
      const card = heading.parentElement.parentElement;
      window.__approveButton = card.querySelector('button');
      window.__approveButton.scrollIntoView({ block: 'center' });
    })()`);
    await capture('approve-before');
    await evaluate(`window.__approveButton.click()`);
    await delay(700);
    await evaluate(`document.querySelector('aside').querySelector('[style*="overflow-y"]').scrollTop = 0`);
    await capture('approved');
    run.approvalVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify((run.afterApproval.matched_value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))})`);
    if (!run.approvalVisible || run.afterApproval.matched_value <= run.beforeApproval.matched_value) throw new Error('KPI approval update not observed');
    const prompt = 'Audit partial payments & fee discrepancies';
    await evaluate(`(() => {
      const input = document.querySelector('input[placeholder="Ask Nemotron Auditor..."]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(prompt)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click('Send');
    await capture('agent-request');
    await waitFor(`document.body.innerText.includes('Tool Call:') && !document.querySelector('input').nextElementSibling.disabled`);
    await evaluate(`(() => {
      const trace = [...document.querySelectorAll('div')].find(div => div.innerText.startsWith('🔧 Tool Call:') && div.innerText.length < 100);
      trace.scrollIntoView({ block: 'center' });
    })()`);
    await capture('agent');
    const calls = await evaluate('window.__calls');
    run.calls = calls.map(({ latencyMs, completion }) => ({ latencyMs, model: completion.model, usage: completion.usage, tools: completion.choices?.[0]?.message?.tool_calls?.map(tool => ({ name: tool.function.name, arguments: tool.function.arguments })) || [] }));
    run.agent = { prompt, toolNames: run.calls.slice(1).flatMap(call => call.tools.map(tool => tool.name)), response: calls.at(-1).completion.choices?.[0]?.message?.content };
    if (!run.agent.toolNames.length) throw new Error('No real Nemotron tool calls captured');
    fs.writeFileSync(path.join(directory, 'run-log.json'), JSON.stringify(run, null, 2));
    console.log('Real Nemotron tool trace captured; switching to PayPal sandbox');
    await new Promise(resolve => server.close(resolve));
    await startServer('paypal');
    await send('Page.reload');
    await waitFor(`document.body.innerText.includes('Live Sandbox')`);
    await delay(1200);
    const paypal = await (await fetch('http://127.0.0.1:8787/api/invoices?page_size=100')).json();
    const invoice = paypal.items.find(item => item.detail?.invoice_number === 'SS-DEMO-028');
    if (!invoice) throw new Error('Sandbox proof invoice missing');
    run.sandbox = { invoiceCount: paypal.items.length, id: invoice.id, number: invoice.detail.invoice_number, status: invoice.status, paid: invoice.payments?.paid_amount, paymentRecords: invoice.payments?.transactions?.map(payment => ({ paymentId: payment.payment_id, amount: payment.amount, method: payment.method })) };
    if (invoice.status !== 'PARTIALLY_PAID' || Number(invoice.payments?.paid_amount?.value) !== 25) throw new Error('PayPal reread payment proof did not match');
    fs.writeFileSync(path.join(directory, 'run-log.json'), JSON.stringify(run, null, 2));
    await capture('sandbox');
    await evaluate(`(() => {
      const proof = ${JSON.stringify(run.sandbox)};
      const card = document.createElement('div');
      card.style.cssText = 'position:fixed;left:300px;top:320px;width:1100px;padding:40px;background:#fff;border:3px solid #0070ba;border-radius:14px;z-index:999999;font:24px Segoe UI;color:#0a192f;box-shadow:0 15px 60px #0004';
      card.innerText = 'PayPal sandbox API reread · test environment\\n\\n' + proof.invoiceCount + ' invoices\\n' + proof.number + ' · ' + proof.status + '\\nRecorded external payment: ' + proof.paid.currency_code + ' ' + proof.paid.value + '\\nInvoice: ' + proof.id + '\\nPayment record: ' + proof.paymentRecords[0].paymentId + '\\n\\nNo additional payment was written during this recording.';
      document.body.appendChild(card);
    })()`);
    await capture('sandbox-proof');
    await send('Page.navigate', { url: 'data:text/html,' + encodeURIComponent(`<body style="margin:0;background:#0a192f;color:white;font:28px Segoe UI;display:grid;place-content:center;height:1080px;text-align:center"><h1>SettleSight</h1><p>Deterministic authority → Nemotron ranking & explanations → Human approval</p><p style="color:#38bdf8">Synthetic demo data · Live Nebius inference · PayPal test sandbox</p><p>Best Apps and Agents Track</p></body>`) });
    await delay(400);
    await capture('architecture');
    run.consoleErrors = consoleErrors;
    fs.writeFileSync(path.join(directory, 'run-log.json'), JSON.stringify(run, null, 2));
  } finally {
    ws?.close();
    edge?.kill();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
  }
  await buildFromRun(run);
}

async function buildFromRun(run) {
  const dollars = cents => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const shots = [
    { id: 'overview', images: ['overview'], text: `Month-end PayPal reconciliation means checking invoice references, partial payments, and fees. SettleSight puts the review queue beside the money totals. This recording uses synthetic demo data, with live NVIDIA Nemotron inference through Nebius Token Factory.` },
    { id: 'engine', images: ['overview'], text: `The deterministic engine works in integer cents and separates suggested matches from approved allocations. This run has ${run.triage.totalItems} review items. Recorded and reconciled value starts at ${dollars(run.beforeApproval.matched_value)} dollars. No language model controls the ledger.` },
    { id: 'triage', images: ['triage-click', 'triage'], text: `I click Run AI Triage. The response comes from ${run.triage.model}. Nemotron ranks the queue and explains the risks. The displayed results are from a real API call; the waiting time is edited for this video.` },
    { id: 'validator', images: ['validator'], text: `Of ${run.triage.totalItems} evaluated items, ${run.triage.verifiedCount} allocation proposals pass the engine, ${run.triage.rejectedCount} are rejected, and ${run.triage.totalItems - run.triage.verifiedCount - run.triage.rejectedCount} are ambiguity cases. Here the red card gives the exact invariant rejection. A confident explanation cannot bypass that check.` },
    { id: 'approved', images: ['approve-before', 'approved'], text: `I approve one validated candidate. Recorded and reconciled value changes from ${dollars(run.beforeApproval.matched_value)} to ${dollars(run.afterApproval.matched_value)} dollars. This approval updates the synthetic local ledger. It does not send a PayPal payment.` },
    { id: 'agent', images: ['agent-request', 'agent'], text: `Now I ask, Audit partial payments and fee discrepancies. Nemotron selects ${run.agent.toolNames.join(', ').replaceAll('_', ' ')}. The visible tool trace comes from live model calls and executes against the engine state. The agent then summarizes the evidence.` },
    { id: 'sandbox', images: ['sandbox', 'sandbox-proof'], text: `A separate cut shows Live Sandbox mode, with ${run.sandbox.invoiceCount} real PayPal sandbox invoices. This is a test environment. A fresh API read confirms ${run.sandbox.number.replaceAll('-', ' ')} is partially paid, with ${Number(run.sandbox.paid.value)} dollars recorded. That payment was written in the earlier live verification; this recording only rereads it.` },
    { id: 'architecture', images: ['architecture'], text: `SettleSight keeps three responsibilities clear: deterministic financial authority, Nemotron ranking and explanations on Nebius Token Factory, and human approval. The public repository includes setup instructions, tests, and the live verification report.` },
  ];
  fs.writeFileSync(path.join(directory, 'narration.json'), JSON.stringify(shots, null, 2));
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'synthesize-audio.ps1'), '-Directory', directory, '-Ffprobe', ffprobe], { stdio: 'pipe', windowsHide: true });
  const timings = JSON.parse(fs.readFileSync(path.join(directory, 'audio/timings.json'), 'utf8').replace(/^\uFEFF/, ''));
  const duration = timings.reduce((sum, shot) => sum + shot.duration, 0);
  if (duration >= 165) throw new Error(`Narration exceeds 2:45 (${duration.toFixed(2)} seconds)`);
  const stamp = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23).replace('.', ',');
  let time = 0;
  let frame = 0;
  let subtitle = 0;
  const srt = [];
  const qc = [];
  for (const shot of timings) {
    const sentences = shot.text.split(/(?<=[.!?])\s+(?=[A-Z])/u);
    const totalChars = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    let sentenceTime = time;
    for (const sentence of sentences) {
      const end = sentenceTime + shot.duration * sentence.length / totalChars;
      srt.push(`${++subtitle}\n${stamp(sentenceTime)} --> ${stamp(end)}\n${sentence.trim()}\n`);
      sentenceTime = end;
    }
    const endFrame = Math.round((time + shot.duration) * fps);
    const count = endFrame - frame;
    for (let i = 0; i < count; i++) {
      const image = shot.images[Math.min(shot.images.length - 1, Math.floor(i / count * shot.images.length))];
      fs.copyFileSync(path.join(directory, 'captures', image + '.jpg'), path.join(directory, 'frames', `frame_${String(frame++).padStart(5, '0')}.jpg`));
    }
    if (['overview', 'triage', 'validator', 'approved', 'agent', 'sandbox'].includes(shot.id)) qc.push({ name: `frame_${qc.length + 1}_${shot.id}.png`, seconds: time + shot.duration * 0.8 });
    time += shot.duration;
  }
  fs.writeFileSync(path.join(directory, 'subtitles.srt'), srt.join('\n'));
  fs.writeFileSync(path.join(directory, 'audio/concat.txt'), timings.map(shot => `file '${shot.id}.wav'`).join('\n'));
  execFileSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c:a', 'pcm_s16le', 'master_audio.wav'], { cwd: path.join(directory, 'audio'), stdio: 'pipe', windowsHide: true });
  await assembleVideo(directory, output, fps);
  const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', path.join(directory, output)], { encoding: 'utf8', windowsHide: true }));
  if (Number(probe.format.duration) >= 170 || !probe.streams.some(stream => stream.codec_type === 'audio') || !probe.streams.some(stream => stream.codec_type === 'video')) throw new Error('Video QC failed');
  for (const frame of qc) execFileSync(ffmpeg, ['-y', '-ss', String(frame.seconds), '-i', path.join(directory, output), '-frames:v', '1', path.join(directory, 'qc', frame.name)], { stdio: 'pipe', windowsHide: true });
  const volume = spawn(ffmpeg, ['-i', path.join(directory, output), '-af', 'volumedetect', '-vn', '-sn', '-dn', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let volumeLog = '';
  volume.stderr.on('data', data => { volumeLog += data; });
  await new Promise(resolve => volume.on('close', resolve));
  const volumeSummary = volumeLog.split('\n').filter(line => /mean_volume|max_volume/.test(line)).join('\n');
  const report = { ffprobe: probe, frames: qc, volume: volumeSummary, narrationSeconds: duration };
  fs.writeFileSync(path.join(directory, 'video-qc.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('MP4: ' + path.join(directory, output));
}
