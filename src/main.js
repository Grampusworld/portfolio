import './style.css';
import { WORKS } from './works.js';
import { buildLayout, TOP_BAR_H } from './layout.js';
import * as A from './art.js';
import * as AUDIO from './audio.js';
import {
  sfxInsert, sfxKey, sfxLid, sfxMeow, sfxPick, sfxDrop, sfxWhoosh, sfxEject, sfxMotor, sfxSeek, sfxPower,
  sfxScreen, sfxTick, sfxBell, sfxPaper, sfxPop, setAmbience, duckAmbience,
  setReel, setMuted, isMuted, setVolume, getVolume, outputLevel,
} from './audio.js';

const $ = (q) => document.querySelector(q);
const cvs = $('#scene');
const g = cvs.getContext('2d');
const N = WORKS.length;
const params = new URLSearchParams(location.search);

// ---------- 减少动态效果 ----------
const rmq = matchMedia('(prefers-reduced-motion: reduce)');
// ?rm=1 可在不改系统设置的情况下模拟「减少动态效果」
let RM = rmq.matches || params.get('rm') === '1';
const applyRM = () => document.body.classList.toggle('rm', RM);
rmq.addEventListener('change', (e) => { RM = e.matches; applyRM(); });
applyRM();

// ---------- 状态 ----------
let L = null, s = 1, u = 1, NW = 320, NH = 180, ox = 0, oy = 0;
let G = null, grassT = -1e9, scroll = 0;
const spr = { tapes: [], bare: [], label: [], keys: {}, cat: [], lid: [], wheel: [] };
const S = {
  power: true, cur: -1, mode: 'idle', // idle | playing | paused
  busy: false, busySince: 0, fast: 0, preview: -1, counter: 0, counterT: 0,
  shakeUntil: 0, catSwing: null, reelFrame: 0, reelT: 0, keyDown: {},
  lid: 0, lidTarget: 0, lidHover: false, lastT: 0,
  fastUntil: 0, seekNote: '', // 快进 / 倒带：转轮加速到 fastUntil，状态栏显示 seekNote
};
const LID_MS = 110; // 玻璃盖从合上到完全翻开
const FREEZE = Number(params.get('freeze')) || 0;
// 悬停拿起用弹簧：ly/lv 是抬起高度和速度，lr/rv 是倾角和角速度（拿起时略微扶正）
const tapes = WORKS.map((w, i) => ({ i, w, where: 'bag', x: 0, y: 0, rot: 0, trail: [], anim: null, lift: 0, hover: false, ly: 0, lv: 0, lr: null, rv: 0 }));

const KEYS = [
  { k: 'play', label: '播放' }, { k: 'pause', label: '暂停' }, { k: 'eject', label: '退带' },
  { k: 'ff', label: '快进' }, { k: 'rew', label: '倒带' },
];

// ---------- 时间线：所有延时动作都挂在渲染循环上，和动画同一个时钟 ----------
const Q = [];
// 唯一时钟：每帧更新为 requestAnimationFrame 的时间戳；事件回调里读到的是最近一帧的时间
let CLOCK = performance.now();
const now = () => CLOCK;
function after(ms, fn) {
  if (RM || ms <= 0) { fn(); return; }
  Q.push({ at: now() + ms, fn });
}
function runQueue(tn) {
  for (let k = 0; k < Q.length; k++) {
    if (Q[k].at <= tn) { const { fn } = Q.splice(k, 1)[0]; k--; fn(); }
  }
}
function setBusy(v) { S.busy = v; S.busySince = now(); }

// ---------- 坐标工具 ----------
const homePos = (i) => {
  const h = L.homes[i];
  return { x: h.x - (L.mobile ? scroll : 0), y: h.y, rot: h.rot };
};
const deckPos = () => ({ x: L.m.x + L.m.win.x + L.m.win.w / 2, y: L.m.y + L.m.win.y + L.m.win.h / 2, rot: 0 });
const screenRect = () => {
  const b = L.m.bezel;
  return { x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 6 };
};
function place(el, x, y, w, h) {
  el.style.left = x * u + 'px'; el.style.top = y * u + 'px';
  if (w != null) el.style.width = w * u + 'px';
  if (h != null) el.style.height = h * u + 'px';
}
const toLayout = (e) => ({ x: e.clientX / u - ox, y: e.clientY / u - oy });
const inRect = (p, r, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
const lidZone = () => ({ x: L.m.x + L.m.win.x, y: L.m.y + L.m.win.y, w: L.m.win.w, h: L.m.win.h });

// ---------- DOM ----------
const stage = $('#stage');
const tapeLayer = $('#tapes');
const machineEl = $('#machine');
const screenEl = $('#screen');
const idleView = $('#idleView');
const detailView = $('#detailView');
const winHint = $('#winHint');
const counterEl = $('#counter');
const tip = $('#tip');
const sr = $('#sr');
const vid = $('#loopVid');
const vidBtn = $('#vidBtn');
let lastPointer = 'mouse';
let suppressClick = false;

const say = (t) => { sr.textContent = ''; setTimeout(() => { sr.textContent = t; }, 30); };
const fullName = (w) => `${w.code} ${w.title}`;

const tapeBtns = WORKS.map((w, i) => {
  const b = document.createElement('button');
  b.className = 'hit tape';
  b.type = 'button';
  tapeLayer.appendChild(b);
  b.addEventListener('pointerdown', (e) => onTapeDown(e, i));
  b.addEventListener('pointermove', onMove);
  b.addEventListener('pointerup', onUp);
  b.addEventListener('pointercancel', cancelDrag);
  b.addEventListener('lostpointercapture', (e) => { if (drag && drag.id === e.pointerId) cancelDrag(); });
  b.addEventListener('click', () => onTapeClick(i));
  b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !drag) preview(i); });
  b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && S.preview === i) unpreview(false); });
  b.addEventListener('focus', () => { if (lastPointer === 'kbd') { ensureVisible(i); preview(i); } });
  b.addEventListener('blur', () => { if (S.preview === i) unpreview(false); });
  return b;
});
window.addEventListener('keydown', () => { lastPointer = 'kbd'; }, true);
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);
// 指针在窗口外松开、切走窗口时，系统不一定把 pointerup 送回按钮——这里兜底
window.addEventListener('pointerup', (e) => onUp(e));
window.addEventListener('blur', () => cancelDrag());
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); });

function labelTape(i) {
  const t = tapes[i], w = WORKS[i];
  const b = tapeBtns[i];
  if (t.where === 'bag') b.setAttribute('aria-label', `磁带 ${fullName(w)}：插入播放机`);
  else b.setAttribute('aria-label', `空位：${w.code} ${w.label} 正在播放机里，按下退带`);
}

const keyBtns = {};
const keysEl = $('#keys');
[...KEYS, { k: 'power', label: '电源' }].forEach(({ k, label }) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hit key key-' + k;
  b.innerHTML = `<span>${label}</span>`;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', () => onKey(k));
  // 悬停：键帽描琥珀色边、变亮；按住：键帽立刻压下去，松手再弹起
  b.addEventListener('pointerenter', () => { S.hoverKey = k; });
  b.addEventListener('pointerleave', () => { if (S.hoverKey === k) S.hoverKey = null; if (S.keyDown[k] === Infinity) S.keyDown[k] = now() + 60; });
  b.addEventListener('focus', () => { if (lastPointer === 'kbd') S.hoverKey = k; });
  b.addEventListener('blur', () => { if (S.hoverKey === k) S.hoverKey = null; });
  b.addEventListener('pointerdown', (e) => { if (e.button === 0) S.keyDown[k] = Infinity; });
  b.addEventListener('pointerup', () => { if (S.keyDown[k] === Infinity) S.keyDown[k] = now() + 60; });
  keysEl.appendChild(b);
  keyBtns[k] = b;
});

// 曲目单（空闲屏）
const trackList = $('#trackList');
WORKS.forEach((w, i) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'track';
  b.innerHTML = `<span class="tc">${w.code}</span><span class="tn">${w.title}</span>`;
  b.setAttribute('aria-label', `播放 ${fullName(w)}`);
  b.addEventListener('click', () => { sfxKey(); insert(i); });
  li.appendChild(b);
  trackList.appendChild(li);
});

// 作品列表浮层
const listDlg = $('#listDlg');
const listUl = $('#listItems');
WORKS.forEach((w, i) => {
  const li = document.createElement('li');
  const links = [
    w.links?.play ? `<a href="${w.links.play}" target="_blank" rel="noopener">试玩 ↗</a>` : '',
    w.links?.source ? `<a href="${w.links.source}" target="_blank" rel="noopener">源码 ↗</a>` : '',
  ].join('');
  li.innerHTML = `
    <button type="button" class="go"><span class="tc">${w.code}</span>${w.title}</button>
    <p class="intro">${w.intro}</p>
    <p class="meta">${w.tags.type} · ${w.tags.platform} · ${w.tags.year}</p>
    <p class="links">${links}</p>`;
  li.querySelector('.go').addEventListener('click', () => { listDlg.close(); insert(i); });
  listUl.appendChild(li);
});
$('#btnList').addEventListener('click', () => { sfxPaper(true); unpreview(); listDlg.showModal(); });
listDlg.addEventListener('close', () => sfxPaper(false));
$('#listClose').addEventListener('click', () => listDlg.close());
listDlg.addEventListener('click', (e) => { if (e.target === listDlg) listDlg.close(); });

// 声音只由音量滚轮控制：默认拨在最左（静音），往右拨出声
const audible = () => !isMuted() && getVolume() > 0;
function syncSound() {
  const on = audible();
  // 视频原声跟随总音量
  for (const v of [vid, bigVid]) { v.volume = getVolume(); v.muted = !on; }
  if (on && S.cur >= 0 && (S.mode === 'playing' || S.fast)) setReel(true, !!S.fast);
}

// ---------- 音量滚轮：往右拨音量增大，往左减小；拨到最左等于静音 ----------
const wheelEl = $('#volWheel');
function setVol(v, fromUser = false) {
  v = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  const before = getVolume();
  setVolume(v);
  if (fromUser && v > 0 && isMuted()) setMuted(false);
  // 每过 5% 一格，响一下棘轮
  if (fromUser && Math.floor(before * 20) !== Math.floor(v * 20)) sfxTick(v);
  const pct = Math.round(v * 100);
  syncWheelLabel();
  wheelEl.setAttribute('aria-valuenow', String(pct));
  wheelEl.setAttribute('aria-valuetext', pct === 0 ? '静音' : `${pct}%`);
  syncSound();
}
let wheelDrag = null;
const wheelLabel = wheelEl.querySelector('span');
// 悬停 / 拖动 / 键盘聚焦时，刻字换成当前音量
function syncWheelLabel() {
  const pct = Math.round(getVolume() * 100);
  wheelLabel.textContent = S.hoverWheel || wheelDrag ? (pct === 0 ? '静音' : `${pct}%`) : '音量';
}
wheelEl.addEventListener('pointerenter', () => { S.hoverWheel = true; syncWheelLabel(); });
wheelEl.addEventListener('pointerleave', () => { S.hoverWheel = false; syncWheelLabel(); });
wheelEl.addEventListener('focus', () => { S.hoverWheel = true; syncWheelLabel(); });
wheelEl.addEventListener('blur', () => { S.hoverWheel = false; syncWheelLabel(); });
wheelEl.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  wheelDrag = { id: e.pointerId, x0: e.clientX, v0: getVolume() };
  try { wheelEl.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
  e.preventDefault();
});
wheelEl.addEventListener('pointermove', (e) => {
  if (!wheelDrag || e.pointerId !== wheelDrag.id) return;
  setVol(wheelDrag.v0 + (e.clientX - wheelDrag.x0) / u * 0.02, true); // 横向拨 50 个原生像素 = 0→100%
});
const endWheel = () => { wheelDrag = null; syncWheelLabel(); };
wheelEl.addEventListener('pointerup', endWheel);
wheelEl.addEventListener('pointercancel', endWheel);
wheelEl.addEventListener('lostpointercapture', endWheel);
wheelEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  // 触控板横向滑动：往右 = 增大；普通鼠标滚轮：往上 = 增大
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
  setVol(getVolume() + Math.sign(d) * Math.min(0.1, Math.abs(d) * 0.002), true);
}, { passive: false });
wheelEl.addEventListener('keydown', (e) => {
  const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 }[e.key];
  if (step != null) setVol(getVolume() + step, true);
  else if (e.key === 'Home') setVol(0, true);
  else if (e.key === 'End') setVol(1, true);
  else return;
  e.preventDefault();
});

// 视频浮层（点开才加载完整视频）
const videoDlg = $('#videoDlg');
const bigVid = $('#bigVid');
vidBtn.addEventListener('click', () => {
  if (S.cur < 0) return;
  const m = WORKS[S.cur].media || {};
  const src = m.full || m.clip || m.loop;
  if (!src) return;
  // full 和 clip 是同一条时间线：放大后从小屏当前位置接着播
  const at = (m.full || m.clip) && vid.dataset.src === m.clip ? vid.currentTime : 0;
  vid.pause();
  bigVid.poster = m.poster || '';
  bigVid.src = src;
  bigVid.volume = getVolume();
  bigVid.muted = !audible();
  bigVid.loop = !m.full;
  bigVid.addEventListener('loadedmetadata', () => { try { bigVid.currentTime = at; } catch (_) { /* 忽略 */ } }, { once: true });
  $('#videoTitle').textContent = WORKS[S.cur].title + (m.full ? ' · 实机视频' : ' · 演示');
  sfxPop();
  videoDlg.showModal();
  bigVid.play().catch(() => {});
});
videoDlg.addEventListener('close', () => {
  bigVid.pause(); bigVid.removeAttribute('src'); bigVid.load();
  if (S.cur >= 0 && S.mode === 'playing' && !RM) vid.play().catch(() => {});
});
$('#videoClose').addEventListener('click', () => videoDlg.close());
videoDlg.addEventListener('click', (e) => { if (e.target === videoDlg) videoDlg.close(); });

// ---------- 详情屏 ----------
function fillDetail(i) {
  const w = WORKS[i];
  $('#dCode').textContent = w.code;
  $('#dTitle').textContent = w.title;
  $('#dIntro').textContent = w.intro;
  const tags = $('#dTags');
  tags.innerHTML = '';
  [['类型', w.tags.type], ['平台', w.tags.platform], ['年份', w.tags.year]].forEach(([k, v]) => {
    if (!v) return;
    const li = document.createElement('li');
    li.textContent = v; li.setAttribute('aria-label', `${k}：${v}`);
    tags.appendChild(li);
  });
  const play = $('#dPlay'), src = $('#dSource');
  play.hidden = !w.links?.play; if (w.links?.play) play.href = w.links.play;
  src.hidden = !w.links?.source; if (w.links?.source) src.href = w.links.source;
  const m = w.media || {};
  const vsrc = m.clip || m.loop;
  vidBtn.hidden = !vsrc && !m.poster;
  vidBtn.classList.remove('err');
  vidBtn.setAttribute('aria-label', `放大观看《${w.title}》的${m.full ? '实机视频' : '演示'}`);
  if (vsrc) {
    // 懒加载：插带、详情屏打开时才给 video 设 src
    vid.poster = m.poster || '';
    if (vid.dataset.src !== vsrc) { vid.dataset.src = vsrc; vid.src = vsrc; }
    vid.volume = getVolume(); vid.muted = !audible();
    if (!RM && S.mode === 'playing') vid.play().catch(() => {});
  }
}
vid.addEventListener('error', () => vidBtn.classList.add('err'));
tip.querySelector('img').addEventListener('error', (e) => { e.target.hidden = true; posTip(); });

function openScreen(i) {
  sfxScreen();
  fillDetail(i);
  idleView.hidden = true;
  detailView.hidden = false;
  screenEl.classList.remove('opening');
  if (!RM) { void screenEl.offsetWidth; screenEl.classList.add('opening'); }
}
function closeScreen() {
  vid.pause();
  detailView.hidden = true;
  idleView.hidden = false;
  screenEl.classList.remove('opening');
}
function syncStatus() {
  const st = $('#dStatus');
  st.textContent = S.seekNote || (S.fast > 0 ? '快进 ▶▶' : S.fast < 0 ? '倒带 ◀◀' : S.mode === 'playing' ? '播放 ▶' : S.mode === 'paused' ? '暂停 ‖' : '');
  keyBtns.play.setAttribute('aria-pressed', String(S.mode === 'playing'));
  keyBtns.pause.setAttribute('aria-pressed', String(S.mode === 'paused'));
  keyBtns.power.setAttribute('aria-pressed', String(S.power));
  keyBtns.power.setAttribute('aria-label', S.power ? '电源：开' : '电源：关');
  screenEl.classList.toggle('off', !S.power);
  winHint.hidden = !(S.power && S.cur < 0 && !S.busy);
  tapes.forEach((t) => labelTape(t.i));
}

// ---------- 玻璃盖 ----------
function openLid(cb) {
  if (S.lidTarget !== 1 || S.lid < 1) sfxLid(true);
  S.lidTarget = 1;
  after(Math.ceil((1 - S.lid) * LID_MS), cb);
}
function closeLid(cb) {
  S.lidTarget = 0;
  sfxLid(false); // 音效里的「叮咔」在约 70ms 后，正好对上盖子扣上
  after(LID_MS, () => { cb && cb(); });
}

// ---------- 动作 ----------
function ctrlPoint(p0, p1) {
  if (!L.mobile) return { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - 34 };
  return { x: Math.min(L.W - 8, Math.max(p0.x, p1.x) + 26), y: (p0.y + p1.y) / 2 };
}
function flyTo(t, to, dur, done) {
  const p0 = { x: t.x, y: t.y, rot: t.rot };
  if (![p0.x, p0.y, p0.rot].every(Number.isFinite)) Object.assign(p0, homePos(t.i));
  const d = deckPos();
  const toDeck = Math.abs(to.x - d.x) < 0.5 && Math.abs(to.y - d.y) < 0.5;
  // 飞回包里的磁带落地时「嗒」一声
  const fin = () => { done(); if (!toDeck && t.where === 'bag') sfxDrop(); };
  if (RM || dur <= 0) { t.x = to.x; t.y = to.y; t.rot = to.rot; t.anim = null; t.where = 'hold'; fin(); return; }
  sfxWhoosh(dur / 1000, toDeck);
  t.where = 'fly';
  t.trail = [];
  t.anim = { t0: now(), dur, p0, p1: to, c: ctrlPoint(p0, to), done: fin };
}

// 磁带插到底：机身震 1px + 咔哒，开始播放；玻璃盖随后合上
function land(t, closeDelay = 60) {
  t.where = 'deck';
  S.cur = t.i;
  S.fast = 0;
  S.counter = 0;
  if (!RM) { S.shakeUntil = now() + 70; swingCat(1, 700, 180); }
  sfxInsert();
  after(90, () => sfxMotor(true));
  S.mode = 'playing';
  openScreen(t.i);
  setReel(true, false);
  syncStatus();
  say(`正在播放 ${fullName(t.w)}。${t.w.intro}`);
  after(closeDelay, () => closeLid(() => { setBusy(false); syncStatus(); }));
}

function insert(i) {
  if (S.busy) return;
  unpreview();
  if (!S.power) { S.power = true; syncStatus(); }
  if (S.cur === i) { if (S.mode !== 'playing') play(); return; }
  if (S.cur >= 0) { switchTo(i, i > S.cur ? 1 : -1); return; }
  const t = tapes[i];
  if (t.where === 'bag') Object.assign(t, homePos(i));
  if (t.where === 'drag') t.where = 'hold';
  setBusy(true);
  syncStatus();
  openLid(() => flyTo(t, deckPos(), 400, () => land(t)));
}

// 快进 / 倒带换带：开盖 → 旧磁带飞回 → 新磁带飞入 → 合盖，共约 0.72 秒
function switchTo(next, dir) {
  if (S.busy || S.cur < 0) return;
  const old = tapes[S.cur], nt = tapes[next];
  setBusy(true); S.fast = dir;
  if (nt.where === 'bag') Object.assign(nt, homePos(next));
  if (nt.where === 'drag') nt.where = 'hold';
  closeScreen();
  setReel(true, true);
  syncStatus();
  openLid(() => flyTo(old, homePos(old.i), 220, () => {
    old.where = 'bag'; S.cur = -1;
    flyTo(nt, deckPos(), 260, () => land(nt, 20));
  }));
}

function eject() {
  if (S.busy || S.cur < 0) return;
  const t = tapes[S.cur];
  setBusy(true); S.mode = 'idle';
  closeScreen();
  setReel(false);
  syncStatus();
  sfxEject();
  openLid(() => flyTo(t, homePos(t.i), 400, () => {
    t.where = 'bag'; S.cur = -1; S.counter = 0;
    closeLid(() => { setBusy(false); syncStatus(); });
    syncStatus();
    say(`已退带，${t.w.code} ${t.w.label} 放回收纳包`);
  }));
}
function play() {
  if (S.cur < 0 || S.busy) { flashHint(); return; }
  if (S.mode !== 'playing') sfxMotor(true);
  S.mode = 'playing';
  if (!RM) vid.play().catch(() => {});
  setReel(true, false);
  syncStatus();
}
function pause() {
  if (S.cur < 0 || S.busy || S.mode !== 'playing') return;
  S.mode = 'paused';
  sfxMotor(false);
  vid.pause();
  setReel(false);
  syncStatus();
}
// 快进 / 倒带：当前磁带的视频前后跳 3 秒，转轮短暂加速
function seek(d) {
  if (S.cur < 0 || S.busy || !vid.getAttribute('src')) { flashHint(); return; }
  const dur = Number.isFinite(vid.duration) ? vid.duration : 0;
  let t = (vid.currentTime || 0) + d;
  t = Math.max(0, dur ? Math.min(dur - 0.05, t) : t);
  try { vid.currentTime = t; } catch (_) { /* 元数据还没加载 */ }
  S.fast = d > 0 ? 1 : -1;
  S.fastUntil = now() + 450;
  S.seekNote = d > 0 ? `快进 ▶▶ +${d}s` : `倒带 ◀◀ ${d}s`;
  sfxSeek(d);
  setReel(true, true);
  syncStatus();
  say(`${d > 0 ? '快进' : '倒带'}到 ${Math.floor(t)} 秒`);
}
function flashHint() {
  winHint.classList.remove('flash'); void winHint.offsetWidth; winHint.classList.add('flash');
}
function setPower(on) {
  if (on === S.power || S.busy) return;
  sfxPower(on);
  if (!on) {
    if (S.cur >= 0) eject();
    S.power = false; S.mode = 'idle';
    say('电源已关');
  } else { S.power = true; say('电源已开'); }
  syncStatus();
}

function onKey(k) {
  sfxKey();
  S.keyDown[k] = now() + 150;
  if (k === 'power') { setPower(!S.power); return; }
  if (!S.power) return;
  if (k === 'play') play();
  else if (k === 'pause') { if (S.mode === 'paused') play(); else pause(); }
  else if (k === 'eject') eject();
  else if (k === 'ff' || k === 'rew') seek(k === 'ff' ? 3 : -3);
}

// ---------- 左上角标题牌（默认 A 木牌；三版方案保留，?sign=A|B|C 切换） ----------
const SIGNS = {
  // A 木牌：插在草地上的告示牌
  A: { sprite: 'wood', x: 6, y: 4, w: 100, h: 26, post: 12,
    lines: [{ t: 'Grampus 游戏作品集', center: true, cls: 'big ink-wood' }],
    mob: { w: 96, h: 14, post: 0, lines: [{ t: 'Grampus 游戏作品集', center: true, cls: 'big ink-wood' }] } },
  // B 磁带封面卡：像一张掉在草地上的 J-card
  B: { sprite: 'card', x: 4, y: 5, w: 104, h: 30,
    lines: [{ t: 'GRAMPUS MIXTAPE', x: 11, y: 4, cls: 'big ink' }, { t: '芦茂霖 · 游戏作品集', x: 11, y: 17, cls: 'small ink-brown' }],
    mob: { w: 104, h: 14, lines: [{ t: 'GRAMPUS MIXTAPE', x: 11, y: 2, cls: 'big ink' }] } },
  // C 草地大字：直接写在草地上，带一行操作提示
  C: { sprite: null, x: 7, y: 6, w: 100, h: 30,
    lines: [{ t: 'Grampus 的游戏作品集', x: 0, y: 0, cls: 'big on-grass' }, { t: '把磁带插进播放机 ▸', x: 0, y: 14, cls: 'big on-grass amber' }],
    mob: { w: 116, h: 13, lines: [{ t: 'Grampus 的游戏作品集', x: 0, y: 1, cls: 'big on-grass' }] } },
};
const SIGN_KEY = (params.get('sign') || 'A').toUpperCase(); // 定稿：A 木牌；?sign=B / C 可预览另两版，?sign=0 不显示
const SIGN = SIGNS[SIGN_KEY] || null;
const signEl = document.createElement('div');
signEl.id = 'sign';
signEl.setAttribute('aria-hidden', 'true'); // 页面标题已由 <h1> 提供给读屏
stage.appendChild(signEl);
function signSpec() {
  if (!SIGN) return null;
  if (!L.mobile) return SIGN;
  // 手机：收纳包上方放得下就用完整两行版，贴着包的上沿；放不下退回单行版
  const fullH = SIGN.h + (SIGN.post || 0);
  const y = L.bag.y - fullH - 3;
  if (y + oy >= TOP_BAR_H) return { ...SIGN, x: 4, y };
  return { ...SIGN, ...SIGN.mob, x: 4, y: 3 };
}
function buildSign() {
  signEl.innerHTML = '';
  spr.sign = null;
  const sp = signSpec();
  if (!sp) return;
  if (sp.sprite === 'wood') spr.sign = A.makeSignWood(sp.w, sp.h, sp.post || 0);
  if (sp.sprite === 'card') spr.sign = A.makeSignCard(sp.w, sp.h);
  for (const ln of sp.lines) {
    const e = document.createElement('span');
    e.className = ln.cls; e.textContent = ln.t;
    e.dataset.x = ln.x ?? 0; e.dataset.y = ln.y ?? 0;
    if (ln.center) e.dataset.center = '1';
    signEl.appendChild(e);
  }
}
function placeSign() {
  const sp = signSpec();
  if (!sp) return;
  place(signEl, ox + sp.x, oy + sp.y, sp.w, sp.h);
  for (const e of signEl.children) {
    if (!e.dataset.center) { place(e, +e.dataset.x, +e.dataset.y); continue; }
    // 在木板上上下左右居中：按原生像素取整，避免半像素偏移把像素字弄糊
    place(e, 0, 0);
    // 比例字体末字自带 1px 字距，算墨迹宽度时扣掉；竖直方向把 1px 投影一起算进字块
    const tw = Math.round(e.offsetWidth / u) - 1, th = 10;
    place(e, Math.round((sp.w - tw) / 2), Math.floor((sp.h - th) / 2) - 2);
  }
}

// ---------- 三花猫挂件：点一下随机左右摆，逐渐停下 ----------
function swingCat(amp, dur, period, dir = Math.random() < 0.5 ? -1 : 1) {
  if (RM) return;
  S.catSwing = { t0: now(), amp, dur, period, dir };
}
function catOffset(tn) {
  const c = S.catSwing;
  if (!c) return 0;
  const k = (tn - c.t0) / c.dur;
  if (k >= 1) { S.catSwing = null; return 0; }
  const o = c.dir * c.amp * Math.sin((2 * Math.PI * (tn - c.t0)) / c.period) * (1 - k);
  return Math.max(-2, Math.min(2, Math.round(o)));
}
const catBtn = $('#catBtn');
catBtn.addEventListener('click', () => {
  const amp = Math.random() < 0.5 ? 1 : 2;
  swingCat(amp, 900 + Math.random() * 900, 220 + Math.random() * 180);
  sfxBell(amp + 1);                       // 挂件上的小铃铛，摇得越大响得越多
  if (Math.random() < 0.6) sfxMeow();     // 偶尔「喵」一声
  say('三花猫晃了晃');
});

// ---------- 自愈：任何异常或卡住超过 3 秒，把状态收拢到一个合法状态 ----------
let lastRecover = 0;
function recover(reason) {
  const tn = now();
  if (tn - lastRecover < 200) return;
  lastRecover = tn;
  Q.length = 0;
  drag = null;
  let deckTape = S.cur >= 0 ? tapes[S.cur] : null;
  for (const t of tapes) {
    t.anim = null; t.trail = []; t.lift = 0; t.hover = false; t.ly = 0; t.lv = 0; t.lr = null;
    if (t === deckTape) t.where = 'deck';
    else t.where = 'bag';
  }
  S.busy = false; S.fast = 0; S.lidTarget = 0; S.lidHover = false;
  if (deckTape) { if (S.mode === 'idle') S.mode = 'playing'; if (detailView.hidden) openScreen(deckTape.i); }
  else { S.cur = -1; S.mode = 'idle'; closeScreen(); }
  setReel(S.mode === 'playing');
  unpreview();
  syncStatus();
  console.warn('[tape] recovered:', reason);
}

// ---------- 预览（悬停 / 第一次点击 / 键盘聚焦） ----------
function preview(i) {
  const t = tapes[i];
  if (t.where !== 'bag' || S.busy) return;
  if (S.preview >= 0 && S.preview !== i) tapes[S.preview].hover = false;
  if (!t.hover) sfxPick();
  S.preview = i; t.hover = true;
  const w = WORKS[i];
  const img = tip.querySelector('img');
  const poster = w.media?.poster;
  img.hidden = !poster;
  if (poster && img.getAttribute('src') !== poster) img.src = poster;
  tip.querySelector('b').textContent = fullName(w);
  tip.querySelector('span').textContent = L.mobile ? '点一下插入' : '点击或拖进卡座';
  tip.hidden = false;
  posTip();
}
function posTip() {
  if (S.preview < 0 || tip.hidden) return;
  const h = homePos(S.preview);
  const tw = 80;
  place(tip, 0, 0, tw, null);
  const th = Math.round(tip.offsetHeight / u);
  let x = Math.round(h.x - tw / 2), y = Math.round(h.y - 16 - th);
  if (y + oy < TOP_BAR_H) {
    if (!L.mobile) { x = L.bag.x + L.bag.w + 2; y = Math.round(h.y - th / 2); } // 桌面：放在收纳包右侧
    else y = Math.round(h.y + 17);
  }
  x = Math.max(-ox + 2, Math.min(NW - ox - tw - 2, x));
  y = Math.max(-oy + 2, Math.min(NH - oy - th - 2, y));
  place(tip, ox + x, oy + y, tw, null);
}
// silent=false 时播放「放下」声（鼠标移开 / 失焦）；插带、开始拖拽时静默收起
function unpreview(silent = true) {
  if (S.preview >= 0) {
    const t = tapes[S.preview];
    if (t.hover && !silent && t.where === 'bag') after(RM ? 0 : 110, sfxDrop); // 等弹簧落到底再响
    t.hover = false;
  }
  S.preview = -1;
  tip.hidden = true;
}

// ---------- 指针：点击 / 拖拽 / 横向滑动 ----------
let drag = null;
function onTapeDown(e, i) {
  if (e.button > 0) return;
  const p = toLayout(e);
  drag = { i, id: e.pointerId, sx: p.x, sy: p.y, mode: null, scroll0: scroll, offx: 0, offy: 0 };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* 有的浏览器在特殊状态下会拒绝 */ }
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const p = toLayout(e);
  const dx = p.x - drag.sx, dy = p.y - drag.sy;
  const t = drag.i != null ? tapes[drag.i] : null;
  if (!drag.mode) {
    if (Math.hypot(dx, dy) < 4) return;
    if (L.mobile && Math.abs(dx) > Math.abs(dy)) drag.mode = 'scroll';
    else if (t && t.where === 'bag' && !S.busy) {
      drag.mode = 'tape';
      if (!t.hover) sfxPick();
      const h = homePos(t.i);
      Object.assign(t, h);
      t.where = 'drag';
      drag.offx = h.x - drag.sx; drag.offy = h.y - drag.sy;
      unpreview();
    } else drag.mode = 'none';
  }
  if (drag.mode === 'scroll') { scroll = Math.max(0, Math.min(L.scrollMax, drag.scroll0 - dx)); posTip(); }
  if (drag.mode === 'tape' && t.where === 'drag') {
    t.x = p.x + drag.offx; t.y = p.y + drag.offy; t.rot = Math.round(L.homes[t.i].rot * 0.4);
    // 拖着磁带经过玻璃盖：盖子自动翻开
    S.lidHover = inRect({ x: t.x, y: t.y }, lidZone(), 10) || inRect(p, lidZone(), 6);
  }
}
function onUp(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; drag = null;
  S.lidHover = false;
  if (d.mode === 'scroll' || d.mode === 'none') suppressClick = true;
  if (d.mode === 'tape') {
    suppressClick = true;
    const t = tapes[d.i];
    const p = e ? toLayout(e) : { x: -1e3, y: -1e3 };
    const m = L.m;
    const over = inRect(p, { x: m.x, y: m.y, w: m.w, h: m.h }) || inRect({ x: t.x, y: t.y }, lidZone(), 10);
    if (t.where !== 'drag') { /* 拖拽中被别的动作接管了 */ }
    else if (over && !S.busy) insert(d.i);
    else flyTo(t, homePos(t.i), 220, () => { t.where = 'bag'; });
  }
  setTimeout(() => { suppressClick = false; }, 0);
}
function cancelDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  S.lidHover = false;
  if (d.mode === 'tape') {
    const t = tapes[d.i];
    if (t.where === 'drag') flyTo(t, homePos(t.i), 220, () => { t.where = 'bag'; });
  }
}
function onTapeClick(i) {
  if (suppressClick) { suppressClick = false; return; }
  const t = tapes[i];
  if (t.where !== 'bag') { if (S.cur === i) eject(); return; }
  // 触屏的桌面版式：第一次点预览，再点一次插入；手机版式点一下就插入
  if (lastPointer === 'touch' && !L.mobile && S.preview !== i) { preview(i); return; }
  insert(i);
}
const bagHit = $('#bagHit');
bagHit.addEventListener('pointerdown', (e) => {
  if (!L.mobile) return;
  const p = toLayout(e);
  drag = { i: null, id: e.pointerId, sx: p.x, sy: p.y, mode: 'scroll', scroll0: scroll };
  try { bagHit.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
});
bagHit.addEventListener('pointermove', onMove);
bagHit.addEventListener('pointerup', onUp);
bagHit.addEventListener('pointercancel', cancelDrag);
bagHit.addEventListener('wheel', (e) => {
  if (!L.mobile) return;
  scroll = Math.max(0, Math.min(L.scrollMax, scroll + (e.deltaX || e.deltaY) / u));
  e.preventDefault();
}, { passive: false });
function ensureVisible(i) {
  if (!L.mobile) return;
  const h = L.homes[i], r = L.bag.inner;
  if (h.x - 24 - scroll < r.x) scroll = Math.max(0, h.x - 24 - r.x);
  if (h.x + 24 - scroll > r.x + r.w) scroll = Math.min(L.scrollMax, h.x + 24 - (r.x + r.w));
}

// ---------- 缩放与版式 ----------
function buildSprites() {
  spr.bag = A.makeBag(L.bag.w, L.bag.h, L.bag.straps, L.bag.strapH);
  spr.machine = A.makeMachine(L.m);
  spr.winBack = A.makeWindowBack(L.m.win);
  spr.lid = [];
  spr.wheel = [];
  for (let f = 0; f < A.LID_FRAMES; f++) spr.lid.push(A.makeLid(L.m.win, f));
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!vw || !vh) { requestAnimationFrame(resize); return; } // 页面还没布局好（隐藏标签页等）
  const mobile = vh > vw;
  const layoutChanged = !L || L.mobile !== mobile;
  if (layoutChanged) {
    L = buildLayout(mobile, N);
    scroll = 0;
    document.body.classList.toggle('mob', mobile);
    buildSprites();
  }
  s = Math.max(1, Math.floor(Math.min((vw * dpr) / L.W, (vh * dpr) / L.H)));
  u = s / dpr;
  NW = Math.ceil(vw / u); NH = Math.ceil(vh / u);
  ox = Math.floor((NW - L.W) / 2); oy = Math.max(0, Math.floor((NH - L.H) / 2));
  cvs.width = NW; cvs.height = NH;
  buildSign(); // 手机版牌子用哪一版取决于 oy，所以每次缩放都重建
  cvs.style.width = NW * u + 'px'; cvs.style.height = NH * u + 'px';
  stage.style.width = NW * u + 'px'; stage.style.height = NH * u + 'px';
  const root = document.documentElement.style;
  root.setProperty('--u', u + 'px');
  root.setProperty('--t', Math.max(1, Math.floor(s / 2)) / dpr + 'px');
  g.imageSmoothingEnabled = false;
  const b = L.bag, m = L.m;
  G = A.makeGrass(NW, NH, ox, oy, [
    { x: b.x + 2, y: b.y + b.strapH + 3, w: b.w, h: b.h - b.strapH, r: 5 },
    { x: m.x + 3, y: m.y + 4, w: m.w, h: m.h, r: 5 },
  ]);
  grassT = -1e9;
  A.renderGrass(G, now() / 1000);
  positionDom();
}
function positionDom() {
  const m = L.m;
  place(machineEl, ox + m.x, oy + m.y, m.w, m.h);
  KEYS.forEach(({ k }, j) => place(keyBtns[k], m.keys[j] - m.keyOff, m.keyY - 1, m.keySlot, 25));
  place(keyBtns.power, m.power - m.keyOff, m.keyY - 1, m.keySlot, 25);
  place(wheelEl, m.wheel.x - 1, m.keyY - 1, m.wheel.w + 2, 25);
  const sc = screenRect();
  place(screenEl, sc.x, sc.y, sc.w, sc.h);
  const lay = m.scr;
  place($('#dHead'), ...lay.title);
  place(vidBtn, ...lay.video);
  place($('#dIntro'), ...lay.intro);
  place($('#dTags'), ...lay.row);
  place($('#dLinks'), ...(lay.row2 || lay.row));
  place(winHint, m.win.x, m.win.y, m.win.w, m.win.h);
  place(catBtn, m.cat.x, m.cat.y, 16, 22);
  place(counterEl, m.counter.x + 1, m.counter.y + 1, m.counter.w - 2, m.counter.h - 2);
  const r = L.bag.inner;
  place(bagHit, ox + r.x, oy + r.y, r.w, r.h);
  positionTapes();
  // 右上角两个按钮贴着页面右上角，对齐像素网格
  const corner = $('#corner');
  place(corner, NW - 4 - 50, 2, 50, 13);
  placeSign();
  posTip();
}
let lastScroll = -1;
function positionTapes() {
  tapes.forEach((t, i) => {
    const h = homePos(i);
    place(tapeBtns[i], ox + Math.round(h.x - A.TW / 2), oy + Math.round(h.y - A.TH / 2), A.TW, A.TH);
    if (L.mobile) {
      const r = L.bag.inner;
      const vis = h.x + 20 > r.x && h.x - 20 < r.x + r.w;
      tapeBtns[i].style.pointerEvents = vis ? '' : 'none';
    } else tapeBtns[i].style.pointerEvents = '';
  });
  lastScroll = scroll;
}

// ---------- 绘制 ----------
function blit(img, cx, cy) {
  g.drawImage(img, Math.round(ox + cx - img.width / 2), Math.round(oy + cy - img.height / 2));
}
function drawTape(t, frame, x, y, rot, lift = 0, shadow = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const deg = Number.isFinite(rot) ? Math.round(rot) : 0;
  const img = deg === 0 ? spr.tapes[t.i][frame] : A.rotated(spr.bare[t.i], deg);
  if (shadow) blit(A.silhouette(img), x + 1, y + shadow);
  blit(img, x, y - lift);
  if (deg !== 0) {
    // 倾斜时文字单独叠上去，保持水平
    const L = spr.label[t.i], a = deg * Math.PI / 180;
    blit(L.img, x + L.cx * Math.cos(a) - L.cy * Math.sin(a), y - lift + L.cx * Math.sin(a) + L.cy * Math.cos(a));
  }
}

function update(tn) {
  const dt = Math.min(100, tn - (S.lastT || tn));
  S.lastT = tn;
  runQueue(tn);
  // 玻璃盖：忙碌时由动作序列控制，空闲时跟随「拖着磁带悬停」
  if (!S.busy) {
    const tg = S.lidHover ? 1 : 0;
    if (tg !== S.lidTarget) sfxLid(tg === 1); // 拖着磁带经过卡座：开盖 / 合盖都有声
    S.lidTarget = tg;
  }
  if (RM) S.lid = S.lidTarget;
  else if (S.lid !== S.lidTarget) {
    const step = dt / LID_MS;
    S.lid = S.lidTarget > S.lid ? Math.min(S.lidTarget, S.lid + step) : Math.max(S.lidTarget, S.lid - step);
  }
  for (const t of tapes) {
    // 兜底：不允许悬空——没人在拖却处于拖拽态 / 不忙却停在半空，都送回原位
    if (t.where === 'fly' && !t.anim) t.where = S.cur === t.i ? 'deck' : 'bag';
    if (t.where === 'drag' && !(drag && drag.mode === 'tape' && drag.i === t.i)) flyTo(t, homePos(t.i), 220, () => { t.where = 'bag'; });
    if (t.where === 'hold' && !S.busy) t.where = S.cur === t.i ? 'deck' : 'bag';
    if (t.where !== 'bag') { t.ly = 0; t.lv = 0; t.lr = null; t.lift = 0; }
    if (t.where === 'bag') {
      const h = homePos(t.i);
      t.x = h.x; t.y = h.y;
      // 拿起 / 落下：欠阻尼弹簧，拿起时冲高 1px 再稳住，落下时陷进皮面 1px 再弹回；同时略微扶正
      if (t.lr == null) { t.lr = h.rot; t.rv = 0; }
      const ty = t.hover ? 4 : 0, tr = t.hover ? h.rot * 0.35 : h.rot;
      if (RM) { t.ly = ty; t.lv = 0; t.lr = tr; t.rv = 0; }
      else {
        const dts = Math.min(0.034, dt / 1000);
        for (let k = 0; k < 2; k++) { // 半步积分，低帧率时也稳定
          const hs = dts / 2;
          t.lv += (340 * (ty - t.ly) - 15 * t.lv) * hs; t.ly += t.lv * hs;
          t.rv += (220 * (tr - t.lr) - 24 * t.rv) * hs; t.lr += t.rv * hs;
        }
      }
      t.rot = t.lr;
      t.lift = Math.round(t.ly);
    }
    else if (t.where === 'deck') { const d = deckPos(); t.x = d.x; t.y = d.y; t.rot = 0; }
    else if (t.where === 'fly' && t.anim) {
      const a = t.anim;
      let k = Math.max(0, Math.min(1, (tn - a.t0) / a.dur));
      if (FREEZE && k > FREEZE) k = FREEZE; // 调试：?freeze=0.4 把飞行定格在 40%
      const e = 1 - Math.pow(1 - k, 3); // 先快后慢
      const q = 1 - e;
      t.x = q * q * a.p0.x + 2 * q * e * a.c.x + e * e * a.p1.x;
      t.y = q * q * a.p0.y + 2 * q * e * a.c.y + e * e * a.p1.y;
      t.rot = a.p0.rot + (a.p1.rot - a.p0.rot) * e;
      t.trail.unshift({ x: t.x, y: t.y, rot: t.rot });
      if (t.trail.length > 7) t.trail.pop();
      if (k >= 1) { t.anim = null; t.trail = []; a.done(); }
    }
  }
  // 卡住超过 3 秒：自愈
  if (S.busy && !FREEZE && tn - S.busySince > 3000) recover('busy timeout');
  // 转轮：播放 8 帧/秒，快进倒带翻倍；减少动态效果时停住
  const spinning = S.cur >= 0 && S.power && (S.mode === 'playing' || S.fast);
  if ((spinning || S.fast) && !RM) {
    const iv = S.fast ? 62 : 125;
    if (tn - S.reelT > iv) { S.reelT = tn; S.reelFrame = (S.reelFrame + (S.fast < 0 ? 3 : 1)) % 4; }
  }
  if (S.fast && S.fastUntil && tn > S.fastUntil) {
    S.fast = 0; S.fastUntil = 0; S.seekNote = '';
    setReel(S.mode === 'playing' && S.cur >= 0, false);
    syncStatus();
  }
  // 计数器：显示当前磁带视频播放到第几秒
  const secs = S.cur >= 0 && !S.busy && vid.getAttribute('src') ? Math.floor(vid.currentTime || 0) : 0;
  if (secs !== S.counter || counterEl.textContent.length !== 3) { S.counter = secs; counterEl.textContent = String(secs % 1000).padStart(3, '0'); }
  else if (secs === 0 && counterEl.textContent !== '000') counterEl.textContent = '000';
  if (L.mobile && scroll !== lastScroll) positionTapes();
  // 草地：12 帧/秒随风摆动
  if (tn - grassT > 83) {
    grassT = tn;
    if (!RM) A.renderGrass(G, tn / 1000);
    // 背景音：取画面中央的阵风强度（和草地动画同一个公式），声画同步
    const s0 = Math.sin((tn / 1000) * 0.9 - (NW / 2) * 0.03 - (NH / 2) * 0.012);
    setAmbience(s0 > 0 ? s0 * s0 : 0);
    // 视频有原声且正在播放时，把风声压低
    const m = S.cur >= 0 ? WORKS[S.cur].media || {} : {};
    duckAmbience(audible() && ((m.audio && !vid.paused && !detailView.hidden) || (videoDlg.open && !bigVid.paused)));
  }
}

function draw(tn) {
  g.drawImage(G.canvas, 0, 0);
  // 左上角标题牌
  if (spr.sign) { const sp = signSpec(); g.drawImage(spr.sign, ox + sp.x, oy + sp.y); }
  // 收纳包
  g.drawImage(spr.bag, ox + L.bag.x, oy + L.bag.y);
  g.save();
  if (L.mobile) {
    const r = L.bag.inner;
    g.beginPath(); g.rect(ox + r.x, oy + r.y - 6, r.w, r.h + 10); g.clip();
  }
  for (const t of tapes) if (t.where !== 'bag') { const h = homePos(t.i); blit(A.rotated(spr.slot, h.rot), h.x, h.y); }
  const inBag = tapes.filter((t) => t.where === 'bag').sort((a, b) => a.ly - b.ly);
  // 抬得越高，影子离得越远
  for (const t of inBag) drawTape(t, 0, t.x, t.y, t.rot, t.lift, 1 + Math.max(0, Math.round(t.ly / 2)));
  g.restore();

  // 磁带机
  const m = L.m;
  const shake = tn < S.shakeUntil ? 1 : 0;
  const mx = ox + m.x, my = oy + m.y + shake;
  machineEl.classList.toggle('shake', shake === 1);
  g.drawImage(spr.machine, mx, my);
  const down = (k) => {
    if (S.keyDown[k] && S.keyDown[k] > tn) return true;
    if (k === 'power') return S.power;
    if (!S.power) return false;
    if (k === 'play') return S.mode === 'playing' && !S.fast;
    if (k === 'pause') return S.mode === 'paused';
    if (k === 'ff') return S.fast > 0;
    if (k === 'rew') return S.fast < 0;
    return false;
  };
  const keyImg = (k) => spr.keys[k][down(k) ? 1 : S.hoverKey === k ? 2 : 0]; // 0 弹起 / 1 按下 / 2 悬停
  KEYS.forEach(({ k }, j) => g.drawImage(keyImg(k), mx + m.keys[j], my + m.keyY));
  g.drawImage(keyImg('power'), mx + m.power, my + m.keyY);
  g.fillStyle = S.power ? A.CSSC.r2 : A.CSSC.r0;
  g.fillRect(mx + m.led.x, my + m.led.y, 2, 2);
  // 音量滚轮：条纹随音量平移；下方琥珀色刻度条显示音量大小
  const wh = m.wheel, vol = getVolume();
  const phase = Math.round(vol * 40) % 3;
  const hot = S.hoverWheel || !!wheelDrag;
  const wk = phase + (hot ? 3 : 0);
  if (!spr.wheel[wk]) spr.wheel[wk] = A.makeWheel(wh, phase, hot);
  g.drawImage(spr.wheel[wk], mx + wh.x, my + wh.y);
  if (hot) { // 悬停：滚轮外圈描琥珀色
    g.fillStyle = A.CSSC.b2;
    g.fillRect(mx + wh.x - 1, my + wh.y - 1, wh.w + 2, 1); g.fillRect(mx + wh.x - 1, my + wh.y + wh.h, wh.w + 2, 1);
    g.fillRect(mx + wh.x - 1, my + wh.y, 1, wh.h); g.fillRect(mx + wh.x + wh.w, my + wh.y, 1, wh.h);
  }
  const lit = Math.round(wh.w * vol);
  if (lit > 0) { g.fillStyle = audible() ? A.CSSC.b2 : A.CSSC.m2; g.fillRect(mx + wh.x, my + wh.y + wh.h + 2, lit, 1); }
  if (!S.power) {
    const sc = screenRect();
    g.fillStyle = A.CSSC.s0; g.fillRect(mx + sc.x, my + sc.y, sc.w, sc.h);
  }
  // 卡座：腔体 → 磁带 → 玻璃盖
  g.drawImage(spr.winBack, mx + m.win.x, my + m.win.y);
  const inDeck = tapes.find((t) => t.where === 'deck');
  if (inDeck) {
    g.save();
    g.beginPath(); g.rect(mx + m.win.x, my + m.win.y, m.win.w, m.win.h); g.clip();
    const img = spr.tapes[inDeck.i][S.reelFrame];
    g.drawImage(img, Math.round(mx + m.win.x + (m.win.w - img.width) / 2), Math.round(my + m.win.y + (m.win.h - img.height) / 2));
    g.restore();
  }
  const lf = spr.lid[Math.round(S.lid * (A.LID_FRAMES - 1))];
  g.drawImage(lf.img, mx + m.win.x + lf.ox, my + m.win.y + lf.oy);
  // 三花猫挂件
  g.drawImage(spr.cat[catOffset(tn) + 2], mx + m.cat.x - A.CAT_PAD, my + m.cat.y);

  // 飞行 / 拖拽中的磁带（在最上层），带 3 帧拖影
  for (const t of tapes) {
    if (t.where === 'fly') {
      [6, 4, 2].forEach((k, j) => {
        const p = t.trail[k];
        if (!p) return;
        g.globalAlpha = [0.18, 0.3, 0.45][j];
        drawTape(t, 0, p.x, p.y, p.rot);
      });
      g.globalAlpha = 1;
      drawTape(t, 0, t.x, t.y, t.rot, 0, 3);
    } else if (t.where === 'drag' || t.where === 'hold') {
      drawTape(t, 0, t.x, t.y, t.rot, 0, 4);
    }
  }
}

// 渲染循环：先排下一帧，再执行本帧；本帧出错只自愈，不会让循环停掉
let errCount = 0;
// ?debug=1：左下角显示状态
const DEBUG = params.get('debug') === '1' ? Object.assign(document.body.appendChild(document.createElement('pre')), { style: 'position:fixed;left:4px;bottom:4px;margin:0;font:12px monospace;color:#fff;background:#000a;z-index:99;max-width:96vw;white-space:pre-wrap' }) : null;
function loop(ts) {
  requestAnimationFrame(loop);
  if (Number.isFinite(ts) && ts > CLOCK) CLOCK = ts;
  if (!G) return;
  const tn = CLOCK;
  try {
    update(tn);
    draw(tn);
    if (DEBUG) DEBUG.textContent = JSON.stringify({ busy: S.busy, cur: S.cur, mode: S.mode, lid: +S.lid.toFixed(2), q: Q.length, err: errCount, t: tapes.map((t) => t.where + (t.anim ? '*' : '') + ':' + Math.round(t.x) + ',' + Math.round(t.y)) });
  } catch (err) {
    g.globalAlpha = 1;
    errCount++;
    console.error('[tape] frame error', err);
    recover('frame error');
  }
}

// ---------- 启动 ----------
async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('8px FusionPixel8', 'IbSLEIGHT3D滑雪挂个爽'),
        document.fonts.load('10px FusionPixel', '作品列表'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (_) { /* 字体失败时退回系统字体 */ }
  WORKS.forEach((w, i) => {
    spr.tapes[i] = [0, 1, 2, 3].map((f) => A.makeTape(w, f));
    spr.bare[i] = A.makeTape(w, 0, false);
    spr.label[i] = A.makeLabelText(w);
  });
  spr.slot = A.makeSlot();
  [...KEYS.map((k) => k.k), 'power'].forEach((k) => { spr.keys[k] = [A.makeKey(k, false), A.makeKey(k, true), A.makeKey(k, false, true)]; });
  spr.cat = [-2, -1, 0, 1, 2].map((o) => A.makeCat(o)); // 下标 = 偏移 + 2
  resize();
  setVol(getVolume());
  syncStatus();
  window.addEventListener('resize', resize);
  document.body.classList.add('ready');
  requestAnimationFrame(loop);
  // 调试用：?state=play2 直接进入某个作品
  const q = params.get('state');
  if (q && /^play\d$/.test(q)) insert(Number(q.slice(4)) - 1);
}
boot().then(() => { if (params.get('fuzz')) fuzz(Number(params.get('fuzz')) || 20); });

// ---------- 调试：?fuzz=秒数 随机连点 / 拖拽，结束后检查状态是否一致 ----------
let recoverCount = 0;
const _recover = recover;
// eslint-disable-next-line no-func-assign
recover = (r) => { recoverCount++; _recover(r); };
async function fuzz(secs) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pe = (el, type, x, y, id) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true, button: 0, isPrimary: true }));
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const rnd = (n) => Math.floor(Math.random() * n);
  const end = performance.now() + secs * 1000;
  let n = 0, pid = 100;
  while (performance.now() < end) {
    n++;
    const a = rnd(10);
    if (a < 4) onKey(['play', 'pause', 'eject', 'ff', 'rew', 'ff', 'rew', 'eject', 'power'][rnd(9)]);
    else if (a < 6) tapeBtns[rnd(N)].click();
    else {
      const b = tapeBtns[rnd(N)]; const [x0, y0] = center(b); const id = ++pid;
      const [x1, y1] = center(rnd(3) ? screenEl : $('#btnList'));
      pe(b, 'pointerdown', x0, y0, id);
      for (let k = 1; k <= 4; k++) { pe(b, 'pointermove', x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * k / 4, id); await sleep(rnd(40)); }
      const end2 = rnd(4);
      if (end2 === 0) cancelDrag(); else if (end2 === 1) window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: -50, clientY: -50 })); else pe(b, 'pointerup', x1, y1, id);
      b.click();
    }
    await sleep(rnd(rnd(2) ? 60 : 500));
  }
  await sleep(3500);
  const decks = tapes.filter((t) => t.where === 'deck').length;
  const odd = tapes.filter((t) => !['bag', 'deck'].includes(t.where)).length;
  const ok = !S.busy && odd === 0 && decks <= 1 && (decks === 1) === (S.cur >= 0);
  document.title = `FUZZ ${ok ? 'OK' : 'FAIL'} actions=${n} errors=${errCount} recovers=${recoverCount} busy=${S.busy} decks=${decks} odd=${odd} cur=${S.cur}`;
  const out = document.body.appendChild(document.createElement('pre'));
  out.style.cssText = 'position:fixed;left:4px;top:4px;margin:0;font:16px monospace;color:#fff;background:#000c;z-index:99;padding:4px';
  out.textContent = document.title;
  console.log(document.title);
}
window.__tape = { S, tapes, insert, eject, onKey, recover, outputLevel, setVol, get errors() { return errCount; } };
window.__audio = AUDIO; // 调试 / 测试用
