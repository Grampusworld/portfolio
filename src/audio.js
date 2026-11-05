// 所有声音都用 Web Audio 实时合成，不下载音频文件。
// 默认静音（音量滚轮在最左）；往右拨滚轮才创建 AudioContext 并出声。
//
// 背景：风声（低通噪声，阵风时变响变亮）+ 草叶沙沙（高频噪声，阵风时变密）。
//       阵风强度由 main.js 按画面里扫过草地的风浪实时传进来，声画同步。
// 音效：拿起 / 放下磁带、飞行呼啸、插带咔哒、玻璃盖开合、退带弹簧、按键、
//       电机启动 / 停止、快进倒带、电源开关、音量棘轮、猫铃铛 + 喵、翻纸、屏幕点亮、视频放大。
let ctx = null, master = null, noise = null, reel = null, amb = null, meter = null;
let muted = true;
let volume = 0; // 0–1，由音量滚轮控制；默认 0 = 静音
const MAX_GAIN = 0.9;
const target = () => (muted ? 0 : volume * MAX_GAIN);
const on = () => ctx && !muted && volume > 0;
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
  meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
  // 3 秒的白噪声和粉噪声，循环播放时用不同起点去相关
  const len = ctx.sampleRate * 3;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
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

// ---------- 基础发声单元 ----------
function burst(t, dur, freq, q, gain, type = 'bandpass') {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 2); src.stop(t + dur + 0.02);
}
function tone(t, f0, f1, dur, gain, type = 'sine', attack = 0.004) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
// 噪声扫频：用于呼啸、磁带高速走带
function sweep(t, dur, f0, f1, q, gain) {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 2); src.stop(t + dur + 0.02);
}
const T = () => ctx.currentTime + 0.005;

// ---------- 背景：风 + 草 ----------
function startAmbience() {
  const mk = (offset) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, offset); return s; };
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);
  // 风：两级低通，阵风时截止频率上升 → 「呼——」
  const w = mk(0.3);
  const wl1 = ctx.createBiquadFilter(); wl1.type = 'lowpass'; wl1.frequency.value = 320; wl1.Q.value = 0.6;
  const wl2 = ctx.createBiquadFilter(); wl2.type = 'lowpass'; wl2.frequency.value = 900;
  const wg = ctx.createGain(); wg.gain.value = 0;
  w.connect(wl1).connect(wl2).connect(wg).connect(bus);
  // 草：高通 + 带通的细碎沙沙声，再用一个快速抖动的增益做出叶片互相拍打的颗粒感
  const r = mk(1.7);
  const rh = ctx.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 2200;
  const rb = ctx.createBiquadFilter(); rb.type = 'bandpass'; rb.frequency.value = 5200; rb.Q.value = 0.7;
  const rflut = ctx.createGain(); rflut.gain.value = 0.6;
  const lfo = mk(2.4); const lfoF = ctx.createBiquadFilter(); lfoF.type = 'lowpass'; lfoF.frequency.value = 18;
  const lfoG = ctx.createGain(); lfoG.gain.value = 3;
  lfo.connect(lfoF).connect(lfoG).connect(rflut.gain);
  const rg = ctx.createGain(); rg.gain.value = 0;
  r.connect(rh).connect(rb).connect(rflut).connect(rg).connect(bus);
  amb = { bus, wg, wl1, rg, rb };
}
// gust：0–1，画面中央的阵风强度；每秒调用约 12 次
export function setAmbience(gust) {
  if (!amb) return;
  const t = ctx.currentTime;
  amb.wg.gain.setTargetAtTime(0.22 + gust * 0.34, t, 0.25);
  amb.wl1.frequency.setTargetAtTime(260 + gust * 700, t, 0.3);
  amb.rg.gain.setTargetAtTime(0.012 + gust * 0.06, t, 0.2);
  amb.rb.frequency.setTargetAtTime(4600 + gust * 1600, t, 0.3);
}
// 视频有原声时把背景压低，避免打架
export function duckAmbience(duck) {
  if (!amb) return;
  amb.bus.gain.setTargetAtTime(duck ? 0.3 : 1, ctx.currentTime, 0.4);
}

// ---------- 磁带 ----------
// 拿起：塑料外壳离开皮面的轻「嚓」
export function sfxPick() {
  if (!on()) return; const t = T();
  burst(t, 0.05, 1900, 1.5, 0.16); burst(t + 0.012, 0.02, 4200, 4, 0.08);
}
// 放下：落回皮面的闷「嗒」
export function sfxDrop() {
  if (!on()) return; const t = T();
  burst(t, 0.035, 850, 2, 0.22); tone(t, 190, 90, 0.06, 0.12);
}
// 飞行呼啸：时长和飞行一致，飞向播放机时音高上扬，飞回包里时下沉
export function sfxWhoosh(dur, toDeck) {
  if (!on()) return; const t = T(), d = Math.max(0.15, dur);
  sweep(t, d, toDeck ? 600 : 2400, toDeck ? 2400 : 600, 1.4, 0.14);
}
// 「咔哒」：塑料壳撞到底 + 卡扣弹回
export function sfxInsert() {
  if (!on()) return; const t = T();
  burst(t, 0.03, 2600, 3, 0.9); tone(t, 150, 60, 0.08, 0.5);
  burst(t + 0.075, 0.025, 1700, 4, 0.6);
}
// 退带：弹簧把磁带顶出来的「嘣」
export function sfxEject() {
  if (!on()) return; const t = T();
  burst(t, 0.02, 2200, 3, 0.5);
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
  const vib = ctx.createOscillator(); vib.frequency.value = 38; const vg = ctx.createGain(); vg.gain.value = 40;
  vib.connect(vg).connect(o.frequency);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(master); o.start(t); vib.start(t); o.stop(t + 0.25); vib.stop(t + 0.25);
}
// 玻璃盖
// 开盖：卡扣松开的脆响 → 弹簧「铮」→ 盖子翻下去的风声 → 碰到限位的「嗒」
// 合盖：盖子翻上来的风声 → 玻璃扣上的清脆「叮咔」（高频瞬态 + 玻璃泛音）→ 卡扣咬合
export function sfxLid(open) {
  if (!on()) return; const t = T();
  if (open) {
    burst(t, 0.008, 4800, 3, 1.1);
    burst(t + 0.002, 0.006, 3000, 0, 0.7, 'highpass');
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1150, t + 0.01); o.frequency.exponentialRampToValueAtTime(1350, t + 0.12);
    const vib = ctx.createOscillator(); vib.frequency.value = 46; const vg = ctx.createGain(); vg.gain.value = 60; vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 0.01); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(master); o.start(t + 0.01); vib.start(t + 0.01); o.stop(t + 0.18); vib.stop(t + 0.18);
    sweep(t + 0.015, 0.1, 900, 2200, 1.2, 0.16);
    burst(t + 0.115, 0.01, 2600, 3, 0.75); tone(t + 0.115, 300, 150, 0.06, 0.35);
  } else {
    sweep(t, 0.07, 2200, 900, 1.2, 0.12);
    burst(t + 0.07, 0.006, 3500, 0, 1.4, 'highpass');
    burst(t + 0.07, 0.01, 5200, 4, 0.9);
    tone(t + 0.07, 3250, 3200, 0.14, 0.16);   // 玻璃泛音「叮」
    tone(t + 0.07, 4800, 4760, 0.09, 0.08);
    tone(t + 0.07, 190, 90, 0.06, 0.4);       // 机身闷响
    burst(t + 0.095, 0.006, 4200, 4, 0.8);     // 卡扣咬合「咔」
  }
}

// ---------- 磁带机 ----------
// 按键：按下的「咔」（高频瞬态 + 键帽撞底的闷响 + 塑料共鸣）+ 回弹的轻「嗒」
export function sfxKey() {
  if (!on()) return; const t = T();
  burst(t, 0.01, 2500, 0, 1.2, 'highpass');
  burst(t, 0.02, 3200, 4, 0.9);
  tone(t, 230, 110, 0.06, 0.45);
  tone(t + 0.002, 1850, 1750, 0.04, 0.1);
  burst(t + 0.065, 0.008, 4200, 4, 0.55);
}
// 电机：播放时由低到高启动，暂停时由高到低停下
export function sfxMotor(start) {
  if (!on()) return; const t = T();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(start ? 45 : 110, t); o.frequency.exponentialRampToValueAtTime(start ? 110 : 40, t + 0.28);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(lp).connect(g).connect(master); o.start(t); o.stop(t + 0.34);
  tone(t, start ? 220 : 520, start ? 520 : 200, 0.3, 0.05, 'sine', 0.04); // 电机啸叫
}
// 快进 / 倒带：磁带高速走带的「滋——」，快进音高上扬、倒带下沉
export function sfxSeek(dir) {
  if (!on()) return; const t = T();
  burst(t, 0.01, 2500, 0, 0.9, 'highpass');
  sweep(t, 0.4, dir > 0 ? 1600 : 4200, dir > 0 ? 4200 : 1600, 1.6, 0.75);
  tone(t, dir > 0 ? 500 : 900, dir > 0 ? 900 : 500, 0.35, 0.1, 'square');
}
// 电源：开机是显像管「嗡」一声亮起，关机是音高掉下去
export function sfxPower(turnOn) {
  if (!on()) return; const t = T();
  burst(t, 0.012, 2600, 0, 1.2, 'highpass'); tone(t, 200, 100, 0.06, 0.4);
  if (turnOn) { tone(t + 0.02, 90, 240, 0.4, 0.22, 'triangle', 0.05); tone(t + 0.05, 7200, 6800, 0.25, 0.03); }
  else tone(t + 0.02, 420, 60, 0.45, 0.22, 'triangle', 0.01);
}
// 屏幕点亮的轻微「滋」
export function sfxScreen() {
  if (!on()) return; const t = T();
  burst(t, 0.06, 6000, 2, 0.12); tone(t, 5200, 3800, 0.12, 0.05);
}
// 音量滚轮的棘轮「嗒」，越往右越亮
export function sfxTick(level) {
  if (!ctx || muted) return; const t = T();
  burst(t, 0.012, 3000 + level * 3000, 8, 0.2 + level * 0.15);
}

// ---------- 其他 ----------
// 小猫「喵」：三角波音高先升后降 + 带通，模拟元音
export function sfxMeow() {
  if (!on()) return;
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
// 猫挂件上的小铃铛：两个不协和泛音 + 快速衰减，摇几下响几下
export function sfxBell(times = 3) {
  if (!on()) return;
  for (let k = 0; k < times; k++) {
    const t = T() + k * (0.09 + Math.random() * 0.05), a = 0.06 / (k + 1);
    tone(t, 2650, 2630, 0.45, a); tone(t, 3980, 3950, 0.3, a * 0.6); tone(t, 6100, 6080, 0.15, a * 0.3);
  }
}
// 翻纸：作品列表打开 / 关闭
export function sfxPaper(open) {
  if (!on()) return; const t = T();
  for (let k = 0; k < 3; k++) burst(t + k * 0.035, 0.05, open ? 2600 + k * 500 : 3600 - k * 500, 1.2, 0.09);
}
// 视频放大：轻「噗」
export function sfxPop() {
  if (!on()) return; const t = T();
  tone(t, 280, 620, 0.09, 0.12); burst(t, 0.03, 1200, 2, 0.08);
}

// 转轮：带通噪声 + 随转速变化的幅度调制
export function setReel(onState, fast = false) {
  if (!ctx) { return; }
  if (onState && !reel) {
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
  reel.g.gain.setTargetAtTime(onState ? (fast ? 0.11 : 0.05) : 0, t, 0.04);
  reel.lfo.frequency.setTargetAtTime(fast ? 18 : 9, t, 0.05);
  reel.bp.frequency.setTargetAtTime(fast ? 1100 : 700, t, 0.05);
}

// 调试 / 测试用：主输出当前的 RMS 电平（0 = 无声）
export function outputLevel() {
  if (!meter) return 0;
  const buf = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(buf);
  let sum = 0; for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}
