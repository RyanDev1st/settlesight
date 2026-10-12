import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function findBinary(envVar, name) {
  if (process.env[envVar]) return process.env[envVar];
  const wingetPath = `C:/Users/admin/AppData/Local/Microsoft/WinGet/Links/${name}.exe`;
  if (fs.existsSync(wingetPath)) return wingetPath;
  const hermesPath = `D:/Hermes/tools/ffmpeg-9.0.1-win32-x64/bin/${name}.exe`;
  if (fs.existsSync(hermesPath)) return hermesPath;
  return name;
}

const FFMPEG_BIN = findBinary('FFMPEG_BIN', 'ffmpeg');
const FFPROBE_BIN = findBinary('FFPROBE_BIN', 'ffprobe');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9223;
const MCP_PORT = 8791;
const VAL_PORT = 8792;
const FPS = 10;

const VIDEO_DIR = path.resolve('submission/amazon/video');
const FRAMES_DIR = path.join(VIDEO_DIR, 'frames');
const AUDIO_DIR = path.join(VIDEO_DIR, 'audio');
const QC_DIR = path.join(VIDEO_DIR, 'qc');
const OUTPUT_MP4 = path.join(VIDEO_DIR, 'settlesight-alexa-demo.mp4');
const MASTER_AUDIO = path.join(AUDIO_DIR, 'master_audio.wav');
const SRT_PATH = path.join(VIDEO_DIR, 'subtitles.srt');
const TIMINGS_PATH = path.join(AUDIO_DIR, 'voiceover_timings.json');

const APP_URL = `http://127.0.0.1:${MCP_PORT}/alexa-sim/`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSrtTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function generateSrt(shots, outputPath) {
  let srtContent = '';
  let elapsed = 0;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const startSec = elapsed;
    const endSec = elapsed + shot.Duration;
    elapsed = endSec;

    const startFormatted = formatSrtTime(startSec);
    const endFormatted = formatSrtTime(endSec);

    srtContent += `${i + 1}\n${startFormatted} --> ${endFormatted}\n${shot.Text}\n\n`;
  }
  fs.writeFileSync(outputPath, srtContent, 'utf-8');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getTitleCardHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 35%, #183F35 0%, #0B1A17 100%);
      font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #FFFFFF;
      overflow: hidden;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 24px;
      background: rgba(169, 213, 156, 0.15);
      border: 1px solid rgba(169, 213, 156, 0.5);
      border-radius: 999px;
      font-size: 15px;
      font-weight: 700;
      color: #A9D59C;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 28px;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 18px;
    }
    .logo-mark {
      width: 80px;
      height: 80px;
      background: #245B48;
      border: 2px solid #A9D59C;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: 900;
      color: #FFFFFF;
      box-shadow: 0 12px 30px rgba(24, 63, 53, 0.6);
    }
    .title {
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #FFFFFF;
    }
    .subtitle {
      font-size: 26px;
      color: #A9D59C;
      font-weight: 600;
      margin-bottom: 40px;
      letter-spacing: 0.02em;
    }
    .feature-pills {
      display: flex;
      gap: 16px;
    }
    .pill {
      padding: 12px 24px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(169, 213, 156, 0.25);
      border-radius: 12px;
      font-size: 16px;
      color: #E2E8F0;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="badge">Amazon Alexa+ Track Entry · Web Simulation</div>
  <div class="logo-container">
    <div class="logo-mark">S</div>
    <div class="title">SettleSight for Alexa+ (simulated)</div>
  </div>
  <div class="subtitle">MCP server · Streamable HTTP · protocol 2025-11-25</div>
  <div class="feature-pills">
    <div class="pill">⚡ Official @modelcontextprotocol/sdk 1.32.1</div>
    <div class="pill">🔒 Deterministic Accounting Invariants</div>
    <div class="pill">💬 Conversational Month-End Review</div>
    <div class="pill">🛡️ Human-in-the-Loop Confirmation Gate</div>
  </div>
</body>
</html>`;
}

function getTerminalCardHtml(output) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: #0B1A17;
      font-family: 'Consolas', 'Courier New', monospace;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #D1E1D4;
      overflow: hidden;
      padding: 40px;
    }
    .terminal {
      width: 1600px;
      height: 940px;
      background: #101F1C;
      border: 1px solid #285448;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .terminal-bar {
      height: 44px;
      background: #183F35;
      display: flex;
      align-items: center;
      padding: 0 16px;
      position: relative;
      border-bottom: 1px solid #285448;
    }
    .buttons {
      display: flex;
      gap: 8px;
    }
    .btn {
      width: 13px;
      height: 13px;
      border-radius: 50%;
    }
    .red { background: #FF5F56; }
    .yellow { background: #FFBD2E; }
    .green { background: #27C93F; }
    .terminal-title {
      position: absolute;
      left: 0; right: 0;
      text-align: center;
      font-size: 14px;
      color: #A9D59C;
      font-family: Arial, sans-serif;
      font-weight: 600;
    }
    .terminal-body {
      padding: 24px 30px;
      font-size: 13.5px;
      line-height: 1.45;
      color: #E2E8F0;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-all;
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="terminal-bar">
      <div class="buttons"><span class="btn red"></span><span class="btn yellow"></span><span class="btn green"></span></div>
      <div class="terminal-title">node mcp/validate.mjs http://127.0.0.1:8791/mcp — MCP Protocol 2025-11-25 Live Validation</div>
    </div>
    <div class="terminal-body">${escapeHtml(output.slice(0, 3600))}</div>
  </div>
</body>
</html>`;
}

function getClosingCardHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 35%, #183F35 0%, #0B1A17 100%);
      font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #FFFFFF;
      overflow: hidden;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 16px;
    }
    .logo-mark {
      width: 72px;
      height: 72px;
      background: #245B48;
      border: 2px solid #A9D59C;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 42px;
      font-weight: 900;
      color: #FFFFFF;
      box-shadow: 0 10px 25px rgba(24, 63, 53, 0.5);
    }
    .title {
      font-size: 56px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .tagline {
      font-size: 24px;
      color: #A9D59C;
      font-weight: 500;
      margin-bottom: 36px;
    }
    .links-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(169, 213, 156, 0.3);
      border-radius: 14px;
      padding: 28px 40px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-bottom: 30px;
      width: 760px;
    }
    .link-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
    }
    .link-label { color: #94AFA7; font-weight: 600; text-transform: uppercase; font-size: 13px; }
    .link-val { color: #A9D59C; font-family: monospace; font-size: 17px; font-weight: 600; }
    .footer-note {
      font-size: 15px;
      color: #718E84;
    }
  </style>
</head>
<body>
  <div class="logo-container">
    <div class="logo-mark">S</div>
    <div class="title">SettleSight</div>
  </div>
  <div class="tagline">Month-End Reconciliation by Conversation · Alexa+ (simulated)</div>
  <div class="links-card">
    <div class="link-row">
      <span class="link-label">GitHub Repository</span>
      <span class="link-val">https://github.com/RyanDev1st/settlesight</span>
    </div>
    <div class="link-row">
      <span class="link-label">MCP Protocol</span>
      <span class="link-val">2025-11-25 · Streamable HTTP Transport</span>
    </div>
    <div class="link-row">
      <span class="link-label">Safety Gate</span>
      <span class="link-val">Explicit confirm=true required for all approvals</span>
    </div>
  </div>
  <div class="footer-note">Synthetic demo dataset only. No PayPal account mutations. Human in the loop.</div>
</body>
</html>`;
}

async function run() {
  console.log('=== SettleSight Amazon Alexa+ Demo Video Pipeline ===');
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(QC_DIR, { recursive: true });

  // 0. Build the project
  console.log('0. Running npm run build...');
  await new Promise((resolve, reject) => {
    const bld = spawn('npm', ['run', 'build'], { shell: true, stdio: 'inherit' });
    bld.on('close', code => code === 0 ? resolve() : reject(new Error(`npm run build failed with code ${code}`)));
  });

  // 1. Synthesize Audio via PowerShell SAPI
  console.log('1. Synthesizing voiceover audio via synthesize-audio.ps1...');
  await new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-ExecutionPolicy', 'Bypass',
      '-File', path.join(VIDEO_DIR, 'synthesize-audio.ps1')
    ], { stdio: 'inherit' });
    ps.on('close', code => code === 0 ? resolve() : reject(new Error(`synthesize-audio.ps1 failed with code ${code}`)));
  });

  const timings = JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf-8').replace(/^\uFEFF/, ''));
  console.log('Loaded voiceover timings: total audio duration =', timings.totalDuration, 'seconds');

  // Generate Subtitles
  generateSrt(timings.shots, SRT_PATH);
  console.log('Generated burned-in subtitles at', SRT_PATH);

  // 2. Capture real output from validate.mjs on temporary port VAL_PORT
  console.log('2. Running temporary server on port', VAL_PORT, 'for validation capture...');
  const valServerProc = spawn('node', ['mcp/server.mjs'], {
    env: { ...process.env, MCP_PORT: String(VAL_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let valServerReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const res = await fetch(`http://127.0.0.1:${VAL_PORT}/alexa-sim/index.html`);
      if (res.ok || res.status === 200 || res.status === 302) {
        valServerReady = true;
        break;
      }
    } catch {}
  }
  if (!valServerReady) {
    valServerProc.kill();
    throw new Error('Failed to start temporary validation server on port ' + VAL_PORT);
  }

  let validateOutput = '';
  await new Promise((resolve, reject) => {
    const valProc = spawn('node', ['mcp/validate.mjs', `http://127.0.0.1:${VAL_PORT}/mcp`], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    valProc.stdout.on('data', d => validateOutput += d.toString());
    valProc.on('close', code => code === 0 ? resolve() : reject(new Error(`validate.mjs exited with code ${code}`)));
  });
  valServerProc.kill();
  console.log('Captured', validateOutput.length, 'bytes from validate.mjs; killed temporary server');

  // 3. Start fresh MCP Server on filming port MCP_PORT (with fresh 46.72% state)
  console.log('3. Starting fresh filming MCP Server on port', MCP_PORT);
  const serverProc = spawn('node', ['mcp/server.mjs'], {
    env: { ...process.env, MCP_PORT: String(MCP_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const res = await fetch(`http://127.0.0.1:${MCP_PORT}/alexa-sim/index.html`);
      if (res.ok || res.status === 200 || res.status === 302) {
        serverReady = true;
        break;
      }
    } catch {}
  }
  if (!serverReady) {
    serverProc.kill();
    throw new Error('Failed to start filming MCP server on port ' + MCP_PORT);
  }
  console.log('Filming MCP Server is ready at http://127.0.0.1:' + MCP_PORT);

  // 4. Launch Edge at 1920x1080 via CDP
  console.log('4. Launching Microsoft Edge via CDP on port', CDP_PORT);
  const edgeProc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${CDP_PORT}`,
      '--window-size=1920,1080',
      '--lang=en-US',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let targetWsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://localhost:${CDP_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((p) => p.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          targetWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
  }

  if (!targetWsUrl) {
    edgeProc.kill();
    serverProc.kill();
    throw new Error('Could not connect to Edge DevTools WebSocket');
  }

  const ws = new WebSocket(targetWsUrl);
  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id).resolve(d.result);
      pending.delete(d.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  let frameIdx = 0;

  async function captureFrame() {
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    const fileName = `frame_${String(frameIdx).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(FRAMES_DIR, fileName), Buffer.from(shot.data, 'base64'));
    frameIdx++;
    await sleep(20);
  }

  async function injectCursor() {
    await send('Runtime.evaluate', {
      expression: `(() => {
        if (document.getElementById('__demo_cursor')) return;
        const cursor = document.createElement('div');
        cursor.id = '__demo_cursor';
        cursor.style.cssText = 'position:fixed;width:24px;height:24px;border-radius:50%;background:rgba(36,91,72,0.35);border:2px solid #245b48;box-shadow:0 0 10px rgba(169,213,156,0.6);pointer-events:none;z-index:9999999;transform:translate(-50%,-50%);transition:all 0.15s ease-out;display:block;';
        document.body.appendChild(cursor);

        const dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;top:50%;left:50%;width:6px;height:6px;border-radius:50%;background:#245b48;transform:translate(-50%,-50%);';
        cursor.appendChild(dot);

        window.__cursorX = 960;
        window.__cursorY = 540;

        window.__setCursor = (x, y) => {
          window.__cursorX = x;
          window.__cursorY = y;
          cursor.style.left = x + 'px';
          cursor.style.top = y + 'px';
        };

        window.__clickRipple = () => {
          const rip = document.createElement('div');
          rip.style.cssText = 'position:fixed;left:' + window.__cursorX + 'px;top:' + window.__cursorY + 'px;width:10px;height:10px;border-radius:50%;border:2px solid #245b48;pointer-events:none;z-index:9999998;transform:translate(-50%,-50%);animation:__ripple 0.4s ease-out forwards;';
          document.body.appendChild(rip);
          setTimeout(() => rip.remove(), 400);
        };

        const style = document.createElement('style');
        style.textContent = '@keyframes __ripple { 0% { width: 10px; height: 10px; opacity: 1; } 100% { width: 60px; height: 60px; opacity: 0; } }';
        document.head.appendChild(style);

        window.__setCursor(960, 540);
      })()`,
    });
  }

  async function moveCursor(fromX, fromY, toX, toY, steps) {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(fromX + (toX - fromX) * t);
      const y = Math.round(fromY + (toY - fromY) * t);
      await send('Runtime.evaluate', { expression: `window.__setCursor(${x}, ${y})` });
      await captureFrame();
    }
  }

  async function waitForIdle() {
    for (let i = 0; i < 40; i++) {
      const r = await send('Runtime.evaluate', {
        expression: `!document.getElementById('send')?.disabled`,
        returnByValue: true
      });
      if (r?.result?.value) return;
      await sleep(150);
    }
  }

  async function getButtonPos(text) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const b = Array.from(document.querySelectorAll('.prompts button')).find(el => el.dataset.prompt === '${text}' || el.textContent.includes('${text}'));
        if (b) {
          const r = b.getBoundingClientRect();
          return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        }
        return { found: false, x: 500, y: 500 };
      })()`,
      returnByValue: true
    });
    return res.result?.value || { x: 500, y: 500 };
  }

  async function triggerButton(text) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        const b = Array.from(document.querySelectorAll('.prompts button')).find(el => el.dataset.prompt === '${text}' || el.textContent.includes('${text}'));
        if (b) {
          const r = b.getBoundingClientRect();
          window.__setCursor(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
          window.__clickRipple();
          b.click();
        }
      })()`,
    });
    await sleep(300);
    await waitForIdle();
  }

  const getShotDuration = (id) => timings.shots.find((s) => s.Id === id)?.Duration || 12.0;
  const getShotFrames = (id) => Math.round(getShotDuration(id) * FPS);

  // --- Shot 1: Title Card ---
  console.log('5. Recording Shot 1: Title Card...');
  const s1Target = getShotFrames('shot_01_title');
  const s1Start = frameIdx;
  const titleDataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(getTitleCardHtml());
  await send('Page.navigate', { url: titleDataUri });
  await sleep(1000);
  await injectCursor();
  await moveCursor(960, 540, 960, 480, Math.min(20, s1Target));
  while (frameIdx - s1Start < s1Target) {
    await captureFrame();
  }

  // --- Shot 2: Problem line & Simulation Intro ---
  console.log('6. Recording Shot 2: The Problem and Mode...');
  const s2Target = getShotFrames('shot_02_problem');
  const s2Start = frameIdx;
  await send('Page.navigate', { url: APP_URL });
  await sleep(2500);
  await injectCursor();
  // Ensure scripted demo is checked and spoken replies unchecked
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scr = document.getElementById('scripted');
      if (scr && !scr.checked) {
        scr.checked = true;
        scr.dispatchEvent(new Event('change'));
      }
      const spk = document.getElementById('spoken');
      if (spk) spk.checked = false;
    })()`
  });

  // Verify initial DOM percent
  const initialDomPercent = await send('Runtime.evaluate', {
    expression: `document.getElementById('percent')?.textContent.trim()`,
    returnByValue: true
  });
  console.log('Initial DOM Reconciled Percent:', initialDomPercent.result?.value);

  // Glide cursor over brand header, meter, and scripted checkbox
  await moveCursor(960, 480, 400, 60, 25);
  await moveCursor(400, 60, 960, 220, 30);
  await moveCursor(960, 220, 650, 465, 30);
  while (frameIdx - s2Start < s2Target) {
    await captureFrame();
  }

  // --- Shot 3: Month-end Summary ---
  console.log('7. Recording Shot 3: Month-end Summary...');
  const s3Target = getShotFrames('shot_03_summary');
  const s3Start = frameIdx;
  const { x: b3X, y: b3Y } = await getButtonPos('Month-end summary');
  await moveCursor(650, 465, b3X, b3Y, 20);
  await triggerButton('Month-end summary');
  await send('Runtime.evaluate', {
    expression: `(() => { const d = document.querySelector('#trace details'); if (d) d.open = true; })()`
  });
  await moveCursor(b3X, b3Y, 400, 320, 25);
  await moveCursor(400, 320, 1100, 350, 30);
  while (frameIdx - s3Start < s3Target) {
    await captureFrame();
  }

  // --- Shot 4: Review Queue ---
  console.log('8. Recording Shot 4: Review Queue...');
  const s4Target = getShotFrames('shot_04_review');
  const s4Start = frameIdx;
  const { x: b4X, y: b4Y } = await getButtonPos('Review queue');
  await moveCursor(1100, 350, b4X, b4Y, 20);
  await triggerButton('Review queue');
  await send('Runtime.evaluate', {
    expression: `(() => { const d = document.querySelector('#trace details'); if (d) d.open = true; })()`
  });
  await moveCursor(b4X, b4Y, 400, 360, 25);
  while (frameIdx - s4Start < s4Target) {
    await captureFrame();
  }

  // --- Shot 5: Explain INV-2026-016 ---
  console.log('9. Recording Shot 5: Explain INV-2026-016...');
  const s5Target = getShotFrames('shot_05_explain');
  const s5Start = frameIdx;
  const { x: b5X, y: b5Y } = await getButtonPos('Explain INV-2026-016');
  await moveCursor(400, 360, b5X, b5Y, 20);
  await triggerButton('Explain INV-2026-016');
  await send('Runtime.evaluate', {
    expression: `(() => { const d = document.querySelector('#trace details'); if (d) d.open = true; })()`
  });
  await moveCursor(b5X, b5Y, 400, 380, 20);
  await moveCursor(400, 380, 1100, 420, 25);
  while (frameIdx - s5Start < s5Target) {
    await captureFrame();
  }

  // --- Shot 6: Approve it ---
  console.log('10. Recording Shot 6: Approve it...');
  const s6Target = getShotFrames('shot_06_approve');
  const s6Start = frameIdx;
  const { x: b6X, y: b6Y } = await getButtonPos('Approve it');
  await moveCursor(1100, 420, b6X, b6Y, 20);
  await triggerButton('Approve it');
  await send('Runtime.evaluate', {
    expression: `(() => { const d = document.querySelector('#trace details'); if (d) d.open = true; })()`
  });
  await moveCursor(b6X, b6Y, 400, 420, 25);
  while (frameIdx - s6Start < s6Target) {
    await captureFrame();
  }

  // --- Shot 7: Yes, Confirm & Meter Update ---
  console.log('11. Recording Shot 7: Yes, Confirm and Meter Update...');
  const s7Target = getShotFrames('shot_07_confirm');
  const s7Start = frameIdx;

  // Capture before percent from DOM
  const beforeRes = await send('Runtime.evaluate', {
    expression: `document.getElementById('percent')?.textContent.trim()`,
    returnByValue: true
  });
  const beforePercent = beforeRes.result?.value;
  console.log('DOM Reconciled Percent before confirm:', beforePercent);

  const { x: b7X, y: b7Y } = await getButtonPos('Yes');
  await moveCursor(400, 420, b7X, b7Y, 20);
  await triggerButton('Yes');

  // Capture after percent from DOM
  const afterRes = await send('Runtime.evaluate', {
    expression: `document.getElementById('percent')?.textContent.trim()`,
    returnByValue: true
  });
  const afterPercent = afterRes.result?.value;
  console.log('DOM Reconciled Percent after confirm:', afterPercent);

  await send('Runtime.evaluate', {
    expression: `(() => { const d = document.querySelector('#trace details'); if (d) d.open = true; })()`
  });

  // Pan cursor up to highlight the updated meter and percentage
  await moveCursor(b7X, b7Y, 960, 220, 25);
  await moveCursor(960, 220, 1100, 220, 20);
  while (frameIdx - s7Start < s7Target) {
    await captureFrame();
  }

  // --- Shot 8: Terminal Card with Real Validate Output ---
  console.log('12. Recording Shot 8: MCP Protocol Validation Terminal...');
  const s8Target = getShotFrames('shot_08_terminal');
  const s8Start = frameIdx;
  const termDataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(getTerminalCardHtml(validateOutput));
  await send('Page.navigate', { url: termDataUri });
  await sleep(1000);
  await injectCursor();
  await moveCursor(960, 540, 500, 300, 25);
  await moveCursor(500, 300, 500, 650, 30);
  while (frameIdx - s8Start < s8Target) {
    await captureFrame();
  }

  // --- Shot 9: Closing Card ---
  console.log('13. Recording Shot 9: Closing Card...');
  const s9Target = getShotFrames('shot_09_close');
  const s9Start = frameIdx;
  const closeDataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(getClosingCardHtml());
  await send('Page.navigate', { url: closeDataUri });
  await sleep(1000);
  await injectCursor();
  await moveCursor(500, 650, 960, 550, 25);
  while (frameIdx - s9Start < s9Target) {
    await captureFrame();
  }

  console.log('Total frames recorded:', frameIdx);
  ws.close();
  edgeProc.kill();
  serverProc.kill();

  // 5. Assemble Video with FFmpeg
  console.log('14. Assembling MP4 with FFmpeg, burned-in subtitles, and master audio...');
  const ffmpegArgs = [
    '-y',
    '-framerate', String(FPS),
    '-i', 'frames/frame_%05d.jpg',
    '-i', 'audio/master_audio.wav',
    '-vf', "scale=1920:1080,subtitles=subtitles.srt:charenc=UTF-8:force_style='FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=16,FontName=Segoe UI'",
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-b:v', '3500k',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    'settlesight-alexa-demo.mp4'
  ];

  await new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, ffmpegArgs, { cwd: VIDEO_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (d) => (stderr += d.toString()));
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}:\n${stderr}`));
    });
  });

  const mp4Stats = fs.statSync(OUTPUT_MP4);
  console.log('MP4 produced successfully at:', OUTPUT_MP4);
  console.log('File size:', (mp4Stats.size / (1024 * 1024)).toFixed(2), 'MB');

  // 6. Quality Control Verification with ffprobe
  console.log('15. Quality Control Verification with ffprobe...');
  const probeInfo = await new Promise((resolve, reject) => {
    const ff = spawn(
      FFPROBE_BIN,
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', OUTPUT_MP4],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    ff.stdout.on('data', (d) => (stdout += d.toString()));
    ff.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(`ffprobe failed with code ${code}`));
    });
  });

  const durationSec = Number(probeInfo.format.duration);
  const vStream = probeInfo.streams.find((s) => s.codec_type === 'video');
  const aStream = probeInfo.streams.find((s) => s.codec_type === 'audio');

  console.log('=== QC PROBE RESULTS ===');
  console.log(`- Format duration: ${durationSec.toFixed(2)}s (Acceptance requirement <= 170s: ${durationSec <= 170 ? 'PASS' : 'FAIL'})`);
  console.log(`- Video stream: ${vStream?.codec_name} ${vStream?.width}x${vStream?.height} @ ${vStream?.r_frame_rate} fps`);
  console.log(`- Audio stream: ${aStream?.codec_name} ${aStream?.sample_rate} Hz, ${aStream?.channels} channel(s)`);

  // 7. Extract 6 QC still frames
  console.log('16. Extracting 6 QC still frames at key moments...');
  const qcTimes = [
    { sec: 2.0, name: 'frame_1_title.png', desc: 'Title Card: SettleSight for Alexa+ (simulated) with MCP protocol badge' },
    { sec: 10.0, name: 'frame_2_problem.png', desc: 'Problem Line & Mode: Alexa+ simulation interface with Scripted Demo checked' },
    { sec: 30.0, name: 'frame_3_summary.png', desc: 'Month-end Summary: 46.72% reconciled with reconciliation_summary trace row' },
    { sec: 50.0, name: 'frame_4_explain.png', desc: 'Explain Match: INV-2026-016 fee-adjusted explanation and trace breakdown' },
    { sec: 75.0, name: 'frame_5_approved_meter.png', desc: 'Confirmed Approval: Meter advanced to 49.35% with approve_match confirm:true' },
    { sec: 90.0, name: 'frame_6_terminal.png', desc: 'Terminal Card: Real output from node mcp/validate.mjs negotiating protocol 2025-11-25' },
  ];

  for (const qc of qcTimes) {
    const outPath = path.join(QC_DIR, qc.name);
    await new Promise((resolve, reject) => {
      const ff = spawn(
        FFMPEG_BIN,
        ['-y', '-ss', String(qc.sec), '-i', OUTPUT_MP4, '-frames:v', '1', outPath],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`QC frame extraction failed: ${code}`))));
    });
    console.log(`- Extracted ${qc.name}: ${qc.desc} (${fs.statSync(outPath).size} bytes)`);
  }

  // 8. Mean volume via ffmpeg volumedetect
  console.log('17. Measuring mean volume via ffmpeg volumedetect...');
  const volumeOutput = await new Promise((resolve) => {
    const ff = spawn(
      FFMPEG_BIN,
      ['-i', OUTPUT_MP4, '-af', 'volumedetect', '-f', 'null', 'NUL'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    ff.stderr.on('data', (d) => (stderr += d.toString()));
    ff.on('close', () => resolve(stderr));
  });

  const meanVolMatch = volumeOutput.match(/mean_volume:\s*([-\d.]+)\s*dB/);
  const maxVolMatch = volumeOutput.match(/max_volume:\s*([-\d.]+)\s*dB/);
  console.log(`- Mean volume: ${meanVolMatch ? meanVolMatch[1] + ' dB' : 'N/A'}`);
  console.log(`- Max volume: ${maxVolMatch ? maxVolMatch[1] + ' dB' : 'N/A'}`);

  console.log('=== Pipeline Completed Successfully ===');
}

run().catch((err) => {
  console.error('Video pipeline failed:', err);
  process.exit(1);
});
