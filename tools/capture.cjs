// tools/capture.cjs - the screenshot rig. Boots a tiny static server for game/,
// drives desktop Chrome headless over CDP (Node 22's built-in WebSocket client),
// loads each ?shot= staged frame, waits for the frame to be drawn, captures the
// viewport at exactly 1280x720 as JPEG under 256 KiB, and records shots.json.
// The shots are taken against the real game: no stubs, no fakes.
const { spawn } = require('node:child_process');
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const SHOT_DIR = join(ROOT, 'screenshots');
const PORT = 8091;
const CDP_PORT = 9223;
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const NODE = process.execPath;

const SHOTS = [
  ['1-cover.jpg', 'cover'],
  ['2-drill.jpg', 'drill'],
  ['3-lockdown.jpg', 'lockdown'],
  ['4-escape.jpg', 'escape'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFetch(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { return await fetch(url); } catch { await sleep(250); }
  }
  throw new Error(`no answer from ${url}`);
}

let cdpId = 0;
const pending = new Map();
let ws;

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++cdpId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const server = spawn(NODE, ['serve.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });

  // Attach to a Chrome already listening on the debugging port, or launch one.
  // On hosts where a browser cannot be spawned from this process at all, the
  // script says exactly what to start, then attaches to it on the next run.
  const profile = join(ROOT, `.chrome-tmp-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,720',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    'about:blank',
  ];

  const cdpUp = async () => {
    try { await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); return true; } catch { return false; }
  };

  if (!(await cdpUp())) {
    spawn(CHROME, args, { stdio: 'ignore' });
    await sleep(4000);
  }
  if (!(await cdpUp())) {
    spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath '${CHROME}' -ArgumentList ${args.map(a => `'${a}'`).join(',')}`,
    ], { stdio: 'ignore' });
    await sleep(5000);
  }
  if (!(await cdpUp())) {
    throw new Error(
      `no Chrome on 127.0.0.1:${CDP_PORT}. Start one, then re-run:\n` +
      `  & "${CHROME}" ${args.join(' ')}`,
    );
  }

  try {
    await waitFetch(`http://127.0.0.1:${PORT}/index.html`);

    const records = [];
    for (const [file, shot] of SHOTS) {
      // /json/new only answers PUT; GET is refused with a plain-text notice
      const target = await (await fetch(
        `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/?shot=${shot}`)}`,
        { method: 'PUT' },
      )).json();
      ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
          const p = pending.get(msg.id);
          pending.delete(msg.id);
          msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
        }
      };

      await cdp('Page.enable');
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
      });

      let ready = false;
      for (let i = 0; i < 80 && !ready; i++) {
        const r = await cdp('Runtime.evaluate', {
          expression: 'window.__shotReady === true',
          returnByValue: true,
        });
        ready = r.result.value === true;
        if (!ready) await sleep(250);
      }
      if (!ready) throw new Error(`frame ${shot} never drew`);

      const shotNow = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
      const bytes = Buffer.from(shotNow.data, 'base64');
      mkdirSync(SHOT_DIR, { recursive: true });
      writeFileSync(join(SHOT_DIR, file), bytes);
      records.push({ file, shot, width: 1280, height: 720, bytes: bytes.length, ok: bytes.length <= 262144 });
      console.log(`${shot.padEnd(8)} -> ${file}  ${bytes.length} bytes (${bytes.length <= 262144 ? 'OK' : 'TOO BIG'})`);
      ws.close();
      ws = null;
    }

    writeFileSync(join(ROOT, 'shots.json'), JSON.stringify({ at: new Date().toISOString(), records }, null, 2));
    console.log('shots.json written, all frames captured from the real game.');
  } finally {
    if (ws) try { ws.close(); } catch {}
    // kill only the chrome processes that carry this run's profile
    spawn('powershell.exe', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
      `Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' } | ` +
      `ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ], { stdio: 'ignore' });
    server.kill();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
