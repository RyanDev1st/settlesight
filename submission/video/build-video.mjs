import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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
const CDP_PORT = 9222;
const FPS = 10;
const FRAME_MS = 1000 / FPS; // 100ms per frame

const VIDEO_DIR = path.resolve('submission/video');
const FRAMES_DIR = path.join(VIDEO_DIR, 'frames');
const AUDIO_DIR = path.join(VIDEO_DIR, 'audio');
const QC_DIR = path.join(VIDEO_DIR, 'qc');
const OUTPUT_MP4 = path.join(VIDEO_DIR, 'settlesight-demo.mp4');
const MASTER_AUDIO = path.join(AUDIO_DIR, 'master_audio.wav');
const SRT_PATH = path.join(VIDEO_DIR, 'subtitles.srt');
const TIMINGS_PATH = path.join(AUDIO_DIR, 'voiceover_timings.json');

const LIVE_URL = process.env.VIDEO_URL || 'https://ryandev1st.github.io/settlesight/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      background: radial-gradient(circle at 50% 30%, #0F2344 0%, #071326 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
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
      gap: 8px;
      padding: 8px 18px;
      background: rgba(0, 112, 186, 0.2);
      border: 1px solid rgba(0, 112, 186, 0.6);
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      color: #38BDF8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 28px;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
    }
    .logo-mark {
      width: 76px;
      height: 76px;
      background: #0070BA;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 46px;
      font-weight: 900;
      color: #FFFFFF;
      box-shadow: 0 10px 25px rgba(0, 112, 186, 0.4);
    }
    .title {
      font-size: 68px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #FFFFFF 60%, #94A3B8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 26px;
      color: #94A3B8;
      font-weight: 500;
      margin-bottom: 40px;
    }
    .feature-pills {
      display: flex;
      gap: 16px;
    }
    .pill {
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      font-size: 15px;
      color: #E2E8F0;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="badge">Official PayPal AI Hackathon Submission</div>
  <div class="logo-container">
    <div class="logo-mark">S</div>
    <div class="title">SettleSight</div>
  </div>
  <div class="tagline">AI Reconciliation Desk for PayPal Sellers</div>
  <div class="feature-pills">
    <div class="pill">⚡ AG Studio 3.0 Embedded Analytics</div>
    <div class="pill">🤖 Studio Agent Framework Copilot</div>
    <div class="pill">🔒 Deterministic Invariant Math</div>
    <div class="pill">📋 PayPal Invoicing v2 Write-Back</div>
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
      background: radial-gradient(circle at 50% 30%, #0F2344 0%, #071326 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
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
      gap: 18px;
      margin-bottom: 16px;
    }
    .logo-mark {
      width: 68px;
      height: 68px;
      background: #0070BA;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 42px;
      font-weight: 900;
      color: #FFFFFF;
      box-shadow: 0 10px 25px rgba(0, 112, 186, 0.4);
    }
    .title {
      font-size: 58px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .tagline {
      font-size: 24px;
      color: #94A3B8;
      font-weight: 500;
      margin-bottom: 36px;
    }
    .links-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 24px 36px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 30px;
      width: 720px;
    }
    .link-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
    }
    .link-label { color: #94A3B8; font-weight: 600; text-transform: uppercase; font-size: 13px; }
    .link-val { color: #38BDF8; font-family: monospace; font-size: 16px; }
    .footer-note {
      font-size: 15px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="logo-container">
    <div class="logo-mark">S</div>
    <div class="title">SettleSight</div>
  </div>
  <div class="tagline">Reconcile PayPal in Minutes. Live on GitHub Pages.</div>
  <div class="links-card">
    <div class="link-row">
      <span class="link-label">Live Evaluation URL</span>
      <span class="link-val">https://ryandev1st.github.io/settlesight/</span>
    </div>
    <div class="link-row">
      <span class="link-label">GitHub Repository</span>
      <span class="link-val">https://github.com/ryandev1st/settlesight</span>
    </div>
    <div class="link-row">
      <span class="link-label">Architecture</span>
      <span class="link-val">AG Studio 3.0 + Studio Agent Framework + PayPal Invoicing v2</span>
    </div>
  </div>
  <div class="footer-note">Built for the PayPal AI Hackathon 2026. Zero float drift. Human in the loop.</div>
</body>
</html>`;
}

async function run() {
  console.log('=== SettleSight Demo Video Pipeline ===');
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(QC_DIR, { recursive: true });

  const timings = JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf-8').replace(/^\uFEFF/, ''));
  console.log('Loaded voiceover timings: total duration =', timings.totalDuration, 'seconds');

  console.log('1. Launching Edge at 1920x1080');
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

  let frameIdx = 0;

  async function captureFrame() {
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    const fileName = `frame_${String(frameIdx).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(FRAMES_DIR, fileName), Buffer.from(shot.data, 'base64'));
    frameIdx++;
  }

  // --- Title Card (2.0s = 20 frames) ---
  console.log('2. Recording Title Card (2.0s, 20 frames)...');
  const titleDataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(getTitleCardHtml());
  await send('Page.navigate', { url: titleDataUri });
  await sleep(1000);
  for (let i = 0; i < 20; i++) {
    await captureFrame();
  }

  // --- Navigate to Live Site ---
  console.log('3. Navigating to Live SettleSight Demo at', LIVE_URL);
  await send('Page.navigate', { url: LIVE_URL });
  await sleep(4000);

  // Inject Cursor Overlay and Interactive Helpers into page
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cursor = document.createElement('div');
      cursor.id = '__demo_cursor';
      cursor.style.cssText = 'position:fixed;width:24px;height:24px;border-radius:50%;background:rgba(0,112,186,0.35);border:2px solid #0070BA;box-shadow:0 0 10px rgba(0,112,186,0.6);pointer-events:none;z-index:9999999;transform:translate(-50%,-50%);transition:all 0.15s ease-out;display:block;';
      document.body.appendChild(cursor);

      const dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;top:50%;left:50%;width:6px;height:6px;border-radius:50%;background:#0070BA;transform:translate(-50%,-50%);';
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
        rip.style.cssText = 'position:fixed;left:' + window.__cursorX + 'px;top:' + window.__cursorY + 'px;width:10px;height:10px;border-radius:50%;border:2px solid #0070BA;pointer-events:none;z-index:9999998;transform:translate(-50%,-50%);animation:__ripple 0.4s ease-out forwards;';
        document.body.appendChild(rip);
        setTimeout(() => rip.remove(), 400);
      };

      const style = document.createElement('style');
      style.textContent = '@keyframes __ripple { 0% { width: 10px; height: 10px; opacity: 1; } 100% { width: 60px; height: 60px; opacity: 0; } }';
      document.head.appendChild(style);

      window.__setCursor(160, 24);
    })()`,
  });

  async function moveCursor(fromX, fromY, toX, toY, steps) {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(fromX + (toX - fromX) * t);
      const y = Math.round(fromY + (toY - fromY) * t);
      await send('Runtime.evaluate', { expression: `window.__setCursor(${x}, ${y})` });
      await captureFrame();
    }
  }

  async function clickAt(x, y) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.__setCursor(${x}, ${y});
        window.__clickRipple();
        const el = document.elementFromPoint(${x}, ${y});
        if (el) el.click();
      })()`,
    });
  }

  // Find shot durations from timings metadata
  const getShotDuration = (id) => timings.shots.find((s) => s.Id === id)?.Duration || 20.0;
  const getShotFrames = (id) => Math.round(getShotDuration(id) * FPS);

  // --- Shot 1: The Hook (10.4s -> 104 frames) ---
  console.log('4. Recording Shot 1: The Hook (104 frames)...');
  const s1Frames = getShotFrames('shot_01_hook');
  // Glide cursor across brand logo and navigation
  await moveCursor(160, 24, 400, 24, 40);
  await moveCursor(400, 24, 1720, 24, 40);
  for (let i = 80; i < s1Frames; i++) {
    await captureFrame();
  }

  // --- Shot 2: The Problem (17.86s -> 179 frames) ---
  console.log('5. Recording Shot 2: The Problem (179 frames)...');
  const s2Frames = getShotFrames('shot_02_problem');
  // Move to "All data" tab button dynamically
  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'All data');
      if (b) {
        const r = b.getBoundingClientRect();
        window.__targetBtnX = Math.round(r.left + r.width / 2);
        window.__targetBtnY = Math.round(r.top + r.height / 2);
      } else {
        window.__targetBtnX = 420;
        window.__targetBtnY = 24;
      }
    })()`,
  });
  const btnPos = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ x: window.__targetBtnX, y: window.__targetBtnY })`,
    returnByValue: true,
  });
  const { x: adX, y: adY } = JSON.parse(btnPos.result.value);
  await moveCursor(1720, 24, adX, adY, 25);
  await clickAt(adX, adY);
  await sleep(600);
  // Pan cursor down into the invoices grid
  await moveCursor(adX, adY, 450, 220, 35);
  // Hover and scroll invoices
  await moveCursor(450, 220, 550, 340, 40);
  // Move to Transactions grid
  await moveCursor(550, 340, 500, 600, 40);
  for (let i = 140; i < s2Frames; i++) {
    await captureFrame();
  }

  // --- Shot 3: Dashboard & Auto-Match (23.77s -> 238 frames) ---
  console.log('6. Recording Shot 3: Live Demo - Dashboard & Auto-Match (238 frames)...');
  const s3Frames = getShotFrames('shot_03_dashboard');
  // Move back to "Close the month" tab dynamically
  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Close the month');
      if (b) {
        const r = b.getBoundingClientRect();
        window.__targetBtnX = Math.round(r.left + r.width / 2);
        window.__targetBtnY = Math.round(r.top + r.height / 2);
      } else {
        window.__targetBtnX = 350;
        window.__targetBtnY = 24;
      }
    })()`,
  });
  const closePos = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ x: window.__targetBtnX, y: window.__targetBtnY })`,
    returnByValue: true,
  });
  const { x: cmX, y: cmY } = JSON.parse(closePos.result.value);
  await moveCursor(500, 600, cmX, cmY, 30);
  await clickAt(cmX, cmY);
  await sleep(600);
  // Pan through KPI tiles: Invoiced, Reconciled, Open balance, Needs review
  await moveCursor(cmX, cmY, 160, 95, 30);
  await moveCursor(160, 95, 460, 95, 30);
  await moveCursor(460, 95, 760, 95, 30);
  await moveCursor(760, 95, 1060, 95, 30);
  // Pan to Reconciliation Meter (x: 350, y: 250)
  await moveCursor(1060, 95, 350, 250, 35);
  for (let i = 185; i < s3Frames; i++) {
    await captureFrame();
  }

  // --- Shot 4: Exceptions Queue Triage (21.23s -> 212 frames) ---
  console.log('7. Recording Shot 4: Exceptions Queue Triage (212 frames)...');
  const s4Frames = getShotFrames('shot_04_exceptions');
  // Move cursor down to Exceptions Queue widget (x: 250, y: 460)
  await moveCursor(350, 250, 250, 460, 35);
  // Hover over filter tabs: Suggested, Review <80%
  await moveCursor(250, 460, 850, 430, 35);
  // Hover row 1 (Pam Beesly, fee adjusted)
  await moveCursor(850, 430, 400, 520, 35);
  // Hover row 5 (Toby Flenderson, combined)
  await moveCursor(400, 520, 400, 750, 45);
  for (let i = 150; i < s4Frames; i++) {
    await captureFrame();
  }

  // --- Shot 5: Ask the Reconciliation Agent (23.11s -> 231 frames) ---
  console.log('8. Recording Shot 5: Ask the Reconciliation Agent (231 frames)...');
  const s5Frames = getShotFrames('shot_05_agent');
  // Move cursor to right agent sidebar suggested prompt 1
  await moveCursor(400, 750, 1600, 365, 40);
  // Click prompt 1: "Show unpaid invoices over 30 days"
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__setCursor(1600, 365);
      window.__clickRipple();
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Show unpaid invoices over 30 days'));
      if (b) b.click();
    })()`,
  });
  await sleep(1000);
  // Hold and capture tool badge execution
  for (let i = 0; i < 40; i++) await captureFrame();

  // Move cursor to prompt 2: "Audit partial payments & fee discrepancies"
  await moveCursor(1600, 365, 1600, 395, 20);
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__setCursor(1600, 395);
      window.__clickRipple();
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Audit partial payments & fee discrepancies'));
      if (b) b.click();
    })()`,
  });
  await sleep(1000);
  // Pan down agent chat to show explain_match calculation
  await moveCursor(1600, 395, 1600, 650, 30);
  for (let i = 130; i < s5Frames; i++) {
    await captureFrame();
  }

  // --- Shot 6: Layout Customization (18.78s -> 188 frames) ---
  console.log('9. Recording Shot 6: Layout Customization (188 frames)...');
  const s6Frames = getShotFrames('shot_06_layout');
  // Move cursor to top right "Customize Layout" button (x: 1800, y: 24)
  await moveCursor(1600, 650, 1800, 24, 35);
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__setCursor(1800, 24);
      window.__clickRipple();
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Customize Layout'));
      if (b) b.click();
    })()`,
  });
  await sleep(1000);
  // Move cursor over Aging Distribution bars (x: 850, y: 250)
  await moveCursor(1800, 24, 850, 250, 40);
  await moveCursor(850, 250, 950, 320, 35);
  // Move back to lock layout into view mode
  await moveCursor(950, 320, 1800, 24, 30);
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__setCursor(1800, 24);
      window.__clickRipple();
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Mode: Editing Layout'));
      if (b) b.click();
    })()`,
  });
  for (let i = 140; i < s6Frames; i++) {
    await captureFrame();
  }

  // --- Shot 7: Approve with Validator (18.74s -> 187 frames) ---
  console.log('10. Recording Shot 7: Approve with Validator (187 frames)...');
  const s7Frames = getShotFrames('shot_07_approve');
  // Move cursor to Exceptions Queue first Approve button (approx x: 1300, y: 520)
  await moveCursor(1800, 24, 1300, 520, 35);
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__setCursor(1300, 520);
      window.__clickRipple();
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Approve');
      if (b) b.click();
    })()`,
  });
  await sleep(1000);
  // Move cursor up to Reconciliation Meter and KPI cards (showing Reconciled rose and Needs review dropped)
  await moveCursor(1300, 520, 450, 95, 35);
  await moveCursor(450, 95, 1060, 95, 30);
  await moveCursor(1060, 95, 300, 250, 35);
  for (let i = 135; i < s7Frames; i++) {
    await captureFrame();
  }

  // --- Shot 8: Write-Back Confirm & Close (20.69s -> 207 frames) ---
  console.log('11. Recording Shot 8: Write-Back Confirm & Close (207 frames)...');
  const s8Frames = getShotFrames('shot_08_close');
  // Move cursor to agent prompt 3: "Draft reminder for overdue Horizon invoice"
  await moveCursor(300, 250, 1600, 425, 30);
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__setCursor(1600, 425);
      window.__clickRipple();
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Draft reminder for overdue Horizon invoice'));
      if (b) b.click();
    })()`,
  });
  await sleep(1000);
  // Pan down to show reminder email draft in chat
  await moveCursor(1600, 425, 1600, 700, 35);
  // Hover over Demo Mode badge in header
  await moveCursor(1600, 700, 1660, 24, 35);
  // For the final 4 seconds (40 frames), navigate to Closing Card
  const remainingAppFrames = s8Frames - 40 - 100;
  for (let i = 0; i < remainingAppFrames; i++) {
    await captureFrame();
  }

  console.log('12. Rendering Closing Title Card (4.0s = 40 frames)...');
  const closeDataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(getClosingCardHtml());
  await send('Page.navigate', { url: closeDataUri });
  await sleep(1000);
  for (let i = 0; i < 40; i++) {
    await captureFrame();
  }

  console.log('Total frames recorded:', frameIdx);
  ws.close();
  edgeProc.kill();

  // --- Assembly via FFmpeg ---
  console.log('13. Assembling MP4 with FFmpeg, burned-in subtitles, and master audio...');
  // Note: we run ffmpeg inside submission/video so relative path to subtitles.srt works cleanly with libass
  const ffmpegArgs = [
    '-y',
    '-framerate', String(FPS),
    '-i', 'frames/frame_%05d.jpg',
    '-i', 'audio/master_audio.wav',
    '-vf', "scale=1920:1080,subtitles=subtitles.srt:charenc=UTF-8:force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=28,FontName=Segoe UI'",
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-b:v', '3500k',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    'settlesight-demo.mp4'
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
  console.log('MP4 produced successfully!');
  console.log('Path:', OUTPUT_MP4);
  console.log('Size:', (mp4Stats.size / (1024 * 1024)).toFixed(2), 'MB');

  // --- QC: Probe video & audio streams ---
  console.log('14. Quality Control Verification with ffprobe:');
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

  console.log(`- Duration: ${durationSec.toFixed(2)}s (Acceptance requires < 175s: ${durationSec < 175 ? 'PASS' : 'FAIL'})`);
  console.log(`- Video: ${vStream?.codec_name} ${vStream?.width}x${vStream?.height} @ ${vStream?.r_frame_rate} fps`);
  console.log(`- Audio: ${aStream?.codec_name} ${aStream?.sample_rate} Hz, ${aStream?.channels} ch`);

  // --- Extract 6 QC still frames at even intervals ---
  console.log('15. Extracting 6 QC still frames at even intervals...');
  const qcTimes = [
    { sec: 1.0, name: 'frame_1_title.png', desc: 'Title Card (SettleSight logo & tagline)' },
    { sec: 10.0, name: 'frame_2_overview.png', desc: 'Shot 1: Dashboard overview and navigation' },
    { sec: 25.0, name: 'frame_3_all_data.png', desc: 'Shot 2: All Data grids showing raw invoices and fee deductions' },
    { sec: 65.0, name: 'frame_4_exceptions.png', desc: 'Shot 4: Exceptions Queue with confidence indicators' },
    { sec: 88.0, name: 'frame_5_agent_chat.png', desc: 'Shot 5: Reconciliation Agent tool badges and audit explanations' },
    { sec: 130.0, name: 'frame_6_approved.png', desc: 'Shot 7: Approved candidate with updated meter and KPI tiles' },
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

  console.log('=== Pipeline Completed Successfully ===');
}

export async function assembleVideo(directory, output, fps = FPS) {
  await new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, [
      '-y', '-framerate', String(fps), '-i', 'frames/frame_%05d.jpg',
      '-i', 'audio/master_audio.wav',
      '-vf', "scale=1920:1080,subtitles=subtitles.srt:charenc=UTF-8:force_style='FontSize=14,BorderStyle=3,Outline=2,Shadow=0,MarginV=16,FontName=Segoe UI'",
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', '3500k',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', output,
    ], { cwd: directory, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    ff.stderr.on('data', d => { stderr += d; });
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-1000)}`)));
  });
}

const pipeline = process.argv.includes('--nebius')
  ? import('../nebius/record-video.mjs').then(module => module.runNebiusVideo())
  : run();
pipeline.catch((err) => {
  console.error('Video pipeline failed:', err);
  process.exit(1);
});
