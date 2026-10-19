// Headless Chrome renderer via CDP. Usage: node render.mjs jobs.json
// jobs: [{url, width, height, out, fullPage?}]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const lab = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const profile = path.join(lab, '.chrome-profile-' + Date.now());
const port = 20000 + Math.floor(Math.random() * 30000);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver;
for (let i = 0; i < 100; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (ver.length) break; } catch {} await sleep(100); }
const page = ver.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  else listeners.forEach(l => l(m)); });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
try {
  for (const j of jobs) {
    await send('Emulation.setDeviceMetricsOverride', { width: j.width, height: j.height, deviceScaleFactor: j.scale || 1, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const loaded = new Promise(r => { const l = m => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
    const url = j.url.startsWith('file:') ? j.url : pathToFileURL(path.resolve(j.url)).href;
    await send('Page.navigate', { url }); await loaded;
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
    await sleep(j.wait || 300);
    let clip;
    if (j.fullPage) {
      const m = await send('Page.getLayoutMetrics');
      const h = Math.ceil(m.cssContentSize.height);
      await send('Emulation.setDeviceMetricsOverride', { width: j.width, height: h, deviceScaleFactor: j.scale || 1, mobile: false });
      await sleep(300);
      clip = { x: 0, y: 0, width: j.width, height: h, scale: 1 };
    }
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!j.fullPage, ...(clip ? { clip } : {}) });
    fs.writeFileSync(j.out, Buffer.from(shot.data, 'base64'));
    console.log('wrote', j.out);
  }
} finally {
  try { await send('Browser.close'); } catch {}
  ws.close(); await sleep(800); try { chrome.kill(); } catch {}
  for (let i = 0; i < 20; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); } }
}
