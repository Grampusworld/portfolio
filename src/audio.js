// Web Audio 实时合成的三个音效：插带、按键、转轮。默认静音，用户点喇叭后才创建 AudioContext。
let ctx = null, master = null, noise = null, reel = null;
let muted = true;
let volume = 0; // 0–1，由音量滚轮控制；默认 0 = 静音
const MAX_GAIN = 0.9;
const target = () => (muted ? 0 : volume * MAX_GAIN);
// 用滚轮（非点击）取消静音时，AudioContext 可能处于挂起状态；下一次点击 / 按键时恢复
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => { if (ctx && ctx.state === 'suspended' && !muted) ctx.resume(); }, true);
}

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const len = ctx.sampleRate;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  if (!m) ensure();
  if (!ctx) return;
  if (!m) ctx.resume();
  master.gain.setTargetAtTime(target(), ctx.currentTime, 0.02);
}
export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (ctx) master.gain.setTargetAtTime(target(), ctx.currentTime, 0.03);
}

function burst(t, dur, freq, q, gain) {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function thump(t, f0, f1, dur, gain) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}

// 「咔哒」：塑料壳撞到底 + 卡扣弹回
export function sfxInsert() {
  if (muted || !ctx) return;
  const t = ctx.currentTime + 0.005;
  burst(t, 0.03, 2600, 3, 0.9); thump(t, 150, 60, 0.08, 0.5);
  burst(t + 0.075, 0.025, 1700, 4, 0.6);
}
// 玻璃盖：开盖是轻的弹簧「嗒」，合盖是更短更亮的「咔」
export function sfxLid(open) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + 0.005;
  if (open) { burst(t, 0.03, 1400, 2, 0.35); thump(t, 260, 120, 0.05, 0.12); }
  else { burst(t, 0.015, 3600, 6, 0.4); }
}
// 小猫「喵」：三角波音高先升后降 + 带通，模拟元音
export function sfxMeow() {
  if (muted || !ctx || volume === 0) return;
  const t = ctx.currentTime + 0.01, d = 0.32 + Math.random() * 0.12;
  const f0 = 620 + Math.random() * 160;
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f0 * 1.55, t + d * 0.35);
  o.frequency.linearRampToValueAtTime(f0 * 0.9, t + d);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
  g.gain.setValueAtTime(0.3, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(bp).connect(g).connect(master); o.start(t); o.stop(t + d + 0.02);
}
export function sfxKey() {
  if (muted || !ctx) return;
  const t = ctx.currentTime + 0.005;
  burst(t, 0.018, 3200, 5, 0.45); thump(t, 400, 180, 0.03, 0.15);
}

// 转轮：带通噪声 + 随转速变化的幅度调制
export function setReel(on, fast = false) {
  if (!ctx) { return; }
  if (on && !reel) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0;
    const amp = ctx.createGain(); amp.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.35;
    lfo.connect(lfoG).connect(amp.gain);
    src.connect(bp).connect(amp).connect(g).connect(master);
    src.start(); lfo.start();
    reel = { src, g, lfo, bp };
  }
  if (!reel) return;
  const t = ctx.currentTime;
  reel.g.gain.setTargetAtTime(on ? (fast ? 0.11 : 0.06) : 0, t, 0.04);
  reel.lfo.frequency.setTargetAtTime(fast ? 18 : 9, t, 0.05);
  reel.bp.frequency.setTargetAtTime(fast ? 1100 : 700, t, 0.05);
}
