// tools/capture.cjs — staged 1280x720 screenshots via Electron (CommonJS; run with
// electron.exe tools/capture.cjs <url> <out.jpg> <quality>). Polls window.__shotReady
// (run.js draws the staged frame synchronously — hidden windows never fire rAF).
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');

const url = process.argv[2];
const out = process.argv[3];
const quality = Number(process.argv[4] ?? 86);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  await app.whenReady();
  const win = new BrowserWindow({ width: 1280, height: 720, show: true, useContentSize: true });
  const page = win.webContents;
  page.on('console', e => { if (e.level >= 3) console.error('page console:', e.text); });
  page.on('did-fail-load', (_e, code, desc) => console.error('load fail:', code, desc));
  await page.loadURL(url);
  const deadline = Date.now() + 20000;
  for (;;) {
    const ready = await page.executeJavaScript('window.__shotReady === true');
    if (ready) break;
    if (Date.now() > deadline) { console.error('timeout waiting for __shotReady'); app.exit(1); return; }
    await sleep(120);
  }
  await sleep(300);
  const image = await page.capturePage();
  const resized = image.resize({ width: 1280, height: 720 });
  fs.writeFileSync(out, resized.toJPEG(quality));
  console.log('WROTE', out, resized.getSize().width + 'x' + resized.getSize().height);
  app.exit(0);
})().catch(e => { console.error(e); app.exit(2); });