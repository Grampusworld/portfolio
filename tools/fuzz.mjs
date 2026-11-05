// 压力测试：用无头 Chrome（真实时间）打开 ?fuzz=秒数，随机连点 / 拖拽，读回结果。
// 用法：node tools/fuzz.mjs [url] [秒数] [轮数]
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://localhost:5177/';
const secs = Number(process.argv[3] || 20);
const rounds = Number(process.argv[4] || 3);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'fuzz-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch { /* 等 Chrome 起来 */ }
  await sleep(200);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');

let fails = 0;
for (let k = 1; k <= rounds; k++) {
  errors.length = 0;
  await send('Page.navigate', { url: `${url}?fuzz=${secs}` });
  const res = await send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `new Promise(r => { const t = setInterval(() => { if (document.title.startsWith('FUZZ')) { clearInterval(t); r(document.title); } }, 200); })`,
  });
  const title = res.result?.result?.value;
  if (!/FUZZ OK/.test(title) || /recovers=[1-9]/.test(title)) fails++;
  console.log(`round ${k}: ${title}`);
  if (errors.length) console.log('  console:', [...new Set(errors)].slice(0, 5).join(' | '));
}
ws.close();
chrome.kill();
process.exit(fails ? 1 : 0);
