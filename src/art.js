// 程序生成的像素素材。所有精灵都在原生分辨率下逐像素绘制，
// 质感来自 Bayer 有序抖动 + value noise，不使用任何半透明混色。

// ---------- 调色板（约 40 色） ----------
const HEX = {
  ink: '#16110f',
  g0: '#1d4527', g1: '#2c6a33', g2: '#46993b', g3: '#6fc046', g4: '#a7de5e',
  fw: '#f2ead4', fy: '#f0c348', fp: '#e7849c',
  l0: '#21130c', l1: '#3a2115', l2: '#56331f', l3: '#77492b', l4: '#9c6a40',
  th: '#d6b475',
  b0: '#6a4919', b1: '#ac7c2b', b2: '#e0b856', b3: '#fae79e',
  m0: '#222529', m1: '#3f444b', m2: '#626870', m3: '#8a8f96', m4: '#b6b9bc', m5: '#dfded6',
  s0: '#0d1613', s1: '#1b2c26',
  r0: '#6b1b19', r1: '#bd382a', r2: '#ef694b',
  p0: '#c9b791', p1: '#ebdfc0',
  co: '#d7812d',
  rain0: '#3c535a', rain1: '#5d7a81', rain2: '#86a1a5',
  night0: '#231d45', night1: '#3b326d', night2: '#5b5097',
  echo0: '#1e3d27', echo1: '#326343', echo2: '#4d895b',
  dawn0: '#7b2e1b', dawn1: '#bd512e', dawn2: '#e57e4e',
};
export const C = {};
for (const k in HEX) {
  const h = HEX[k];
  C[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
export const CSSC = HEX;

// ---------- 工具 ----------
const B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x, y) => (B4[y & 3][x & 3] + 0.5) / 16;
export function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, sc, s = 0) {
  const fx = x / sc, fy = y / sc;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}
// 在相邻色阶之间做有序抖动：大部分区域是纯色，过渡处出现棋盘格
function pick(v, x, y, levels, soft = 0.3) {
  const n = levels.length - 1;
  const t = Math.max(0, Math.min(n - 1e-6, v * n));
  const base = Math.floor(t);
  let f = t - base;
  f = Math.max(0, Math.min(1, (f - (0.5 - soft / 2)) / soft));
  return f > bayer(x, y) ? levels[base + 1] : levels[base];
}

export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  on(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] > 0; }
  get(x, y) { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
  hline(x0, x1, y, c) { for (let i = x0; i <= x1; i++) this.set(i, y, c); }
  vline(x, y0, y1, c) { for (let j = y0; j <= y1; j++) this.set(x, j, c); }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    cv.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return cv;
  }
}

function inRR(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const cx = x < r ? r - 0.5 : x >= w - r ? w - r - 0.5 : x;
  const cy = y < r ? r - 0.5 : y >= h - r ? h - r - 0.5 : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= (r - 0.2) * (r - 0.2) + 0.6;
}

// 给已有像素描外框（4 邻域）
function outline(P, c) {
  const edge = [];
  for (let y = -1; y <= P.h; y++) for (let x = -1; x <= P.w; x++) {
    if (P.on(x, y)) continue;
    if (P.on(x - 1, y) || P.on(x + 1, y) || P.on(x, y - 1) || P.on(x, y + 1)) edge.push([x, y]);
  }
  edge.forEach(([x, y]) => P.set(x, y, c));
}

// 文字栅格化：按 8 倍字号画到临时画布，基线对齐像素格，再取每个 8×8 格子中心点，
// 得到和字体设计完全一致的像素（避免小字号抗锯齿后阈值化出现缺笔）
const K = 8, TWX = 96, THX = 14;
let tmpCtx = null;
export function textPixels(str) {
  if (!tmpCtx) { const c = document.createElement('canvas'); c.width = TWX * K; c.height = THX * K; tmpCtx = c.getContext('2d', { willReadFrequently: true }); }
  const g = tmpCtx;
  g.clearRect(0, 0, TWX * K, THX * K);
  g.font = `${8 * K}px FusionPixel8`; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
  g.fillText(str, 0, 10 * K);
  const w = Math.ceil(g.measureText(str).width / K);
  const d = g.getImageData(0, 0, TWX * K, THX * K).data;
  const pts = [];
  for (let y = 0; y < THX; y++) for (let x = 0; x < TWX; x++) {
    if (d[((y * K + K / 2) * TWX * K + x * K + K / 2) * 4 + 3] >= 128) pts.push([x, y]);
  }
  let minY = 16, maxY = 0;
  pts.forEach(p => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  return { w, pts: pts.map(([x, y]) => [x, y - minY]), h: maxY - minY + 1 };
}

// ---------- 草地 ----------
// 拆成两层：静态底色（含烘焙好的阴影）+ 每帧重画的亮草叶和小花，用来做随风摆动。
// shadows: [{x,y,w,h,r}] 以布局坐标给出。
const pack = (c) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
export function makeGrass(W, H, ox, oy, shadows) {
  const shade = new Uint8Array(W * H);
  for (const s of shadows) {
    for (let y = s.y - 2; y < s.y + s.h + 2; y++) for (let x = s.x - 2; x < s.x + s.w + 2; x++) {
      const px = x + ox, py = y + oy;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const inside = inRR(x - s.x, y - s.y, s.w, s.h, s.r);
      const near = !inside && inRR(x - s.x + 2, y - s.y + 2, s.w + 4, s.h + 4, s.r + 2);
      if (inside || (near && ((x + y) & 1))) shade[py * W + px] = 1;
    }
  }
  const P = new Pix(W, H);
  const lv = [C.g1, C.g2, C.g3], lvS = [C.g0, C.g1, C.g2];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ax = x - ox, ay = y - oy;
    const v = vnoise(ax, ay, 14, 3) * 0.55 + vnoise(ax, ay, 5, 4) * 0.3 + hash(ax, ay, 5) * 0.15;
    P.set(x, y, pick(0.15 + v * 0.75, ax, ay, shade[y * W + x] ? lvS : lv, 0.22));
  }
  const blades = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ax = x - ox, ay = y - oy;
    const r = hash(ax, ay, 9);
    const sh = shade[y * W + x];
    if (r < 0.035) blades.push({ x, y, sh, p: hash(ax, ay, 10) });
    else if (r < 0.06) { P.set(x, y, sh ? C.g0 : C.g1); P.set(x + 1, y - 1, sh ? C.g0 : C.g1); }
  }
  const flowers = [];
  for (let gy = -1; gy < H / 7 + 1; gy++) for (let gx = -1; gx < W / 7 + 1; gx++) {
    const kx = gx - (ox / 7 | 0), ky = gy - (oy / 7 | 0);
    const cx = gx * 7 + Math.floor(hash(kx, ky, 21) * 5);
    const cy = gy * 7 + Math.floor(hash(kx, ky, 22) * 5);
    const r = hash(kx, ky, 23);
    if (r > 0.075 || cx < 1 || cy < 1 || cx >= W - 2 || cy >= H - 3) continue;
    const pet = r < 0.03 ? C.fw : r < 0.055 ? C.fy : C.fp;
    flowers.push({ x: cx, y: cy, pet: pack(pet), mid: pack(pet === C.fy ? C.b1 : C.fy), p: hash(kx, ky, 24) });
  }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(P.d), W, H);
  return {
    W, H, canvas: cv, ctx, img,
    base32: new Uint32Array(P.d.buffer.slice(0)),
    buf32: new Uint32Array(img.data.buffer),
    blades, flowers,
    col: { tip: pack(C.g4), mid: pack(C.g3), root: pack(C.g1), tipS: pack(C.g3), midS: pack(C.g2), rootS: pack(C.g0), stem: pack(C.g0) },
  };
}

// 风：缓慢的整体摆动 + 一阵阵斜向扫过草地的阵风（阵风经过时草尖压低、变亮）
export function renderGrass(G, t) {
  const { W, H, buf32, col } = G;
  buf32.set(G.base32);
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) buf32[y * W + x] = c; };
  const gustAt = (x, y) => { const s = Math.sin(t * 0.9 - x * 0.03 - y * 0.012); return s > 0 ? s * s * s * s : 0; };
  for (const b of G.blades) {
    const gust = gustAt(b.x, b.y);
    const w = Math.sin(t * 2.1 + b.p * 6.283 - b.x * 0.07) * 0.6 + gust * 1.4;
    const o2 = w > 0.55 ? 1 : w < -0.45 ? -1 : 0;
    const o1 = gust > 0.7 ? 1 : 0;
    const lit = gust > 0.35;
    put(b.x, b.y + 2, b.sh ? col.rootS : col.root);
    put(b.x + o1, b.y + 1, b.sh ? col.midS : (lit ? col.tip : col.mid));
    put(b.x + o2, b.y, b.sh ? (lit ? col.tip : col.tipS) : col.tip);
  }
  for (const f of G.flowers) {
    const gust = gustAt(f.x, f.y);
    const o = gust > 0.5 || Math.sin(t * 1.7 + f.p * 6.283) > 0.85 ? 1 : 0;
    put(f.x, f.y + 2, col.stem);
    put(f.x + o - 1, f.y, f.pet); put(f.x + o + 1, f.y, f.pet);
    put(f.x + o, f.y - 1, f.pet); put(f.x, f.y + 1, f.pet);
    put(f.x + o, f.y, f.mid);
  }
  G.ctx.putImageData(G.img, 0, 0);
  return G.canvas;
}

// ---------- 皮质收纳包 ----------
export function makeBag(w, h, strapsX, strapH = 12) {
  const P = new Pix(w, h);
  const bodyY = strapH, bodyH = h - strapH;
  const leatherLv = [C.l1, C.l2, C.l3];
  // 扣带（在包身后面，向上伸出）
  for (const sx of strapsX) {
    for (let y = 1; y < strapH + 6; y++) for (let x = sx; x < sx + 12; x++) {
      const v = vnoise(x, y, 4, 11) * 0.7 + hash(x, y, 12) * 0.3;
      P.set(x, y, pick(0.35 + v * 0.5, x, y, leatherLv));
    }
    for (let y = 2; y < strapH + 5; y += 3) { P.set(sx + 2, y, C.th); P.set(sx + 9, y, C.th); }
    // 黄铜扣
    P.rect(sx + 1, 3, 10, 6, C.b1);
    P.rect(sx + 3, 5, 6, 2, C.l1);
    P.hline(sx + 1, sx + 10, 3, C.b2); P.set(sx + 2, 3, C.b3);
    P.hline(sx + 1, sx + 10, 8, C.b0);
    P.set(sx + 6, 4, C.b0); P.set(sx + 6, 5, C.b2); P.set(sx + 6, 6, C.b2);
  }
  // 包身
  const inBody = (x, y) => inRR(x, y - bodyY, w, bodyH, 5);
  const ix0 = 5, ix1 = w - 6, iy0 = bodyY + 7, iy1 = h - 8;
  for (let y = bodyY; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inBody(x, y)) continue;
    let v = vnoise(x, y, 9, 1) * 0.55 + vnoise(x, y, 3, 2) * 0.3 + hash(x, y, 3) * 0.15;
    const edge = Math.min(x, w - 1 - x, y - bodyY, h - 1 - y);
    if (edge < 4) v -= (4 - edge) * 0.05; // 边缘磨暗
    let c = pick(0.2 + v * 0.7, x, y, leatherLv);
    if (hash(x, y, 4) > 0.965) c = C.l1; // 毛孔
    if (edge < 3 && hash(x, y, 5) > 0.9) c = C.l4; // 磨损亮点
    P.set(x, y, c);
  }
  // 包口沿（稍亮）
  for (let y = bodyY + 1; y <= bodyY + 5; y++) for (let x = 2; x < w - 2; x++) {
    if (!inBody(x, y)) continue;
    const v = 0.55 + vnoise(x, y, 6, 7) * 0.4 - (y - bodyY - 1) * 0.06;
    P.set(x, y, pick(v, x, y, [C.l2, C.l3, C.l4], 0.25));
  }
  // 包内（无内衬，翻毛皮面，偏暗）
  for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
    if (!inRR(x - ix0, y - iy0, ix1 - ix0 + 1, iy1 - iy0 + 1, 2)) continue;
    let v = vnoise(x, y, 6, 8) * 0.5 + hash(x, y, 9) * 0.5;
    v -= Math.max(0, 4 - (y - iy0)) * 0.12; // 口沿投下的阴影
    P.set(x, y, pick(0.15 + v * 0.6, x, y, [C.l0, C.l1, C.l2], 0.35));
  }
  P.hline(ix0, ix1, iy0 - 1, C.l0);
  // 前沿下方高光
  P.hline(ix0, ix1, iy1 + 1, C.l4);
  // 缝线（2 实 1 虚 + 针孔阴影）
  const stitchH = (y, x0, x1) => { for (let x = x0; x <= x1; x++) if (x % 3 !== 2) { P.set(x, y, C.th); P.set(x, y + 1, C.l1); } };
  const stitchV = (x, y0, y1) => { for (let y = y0; y <= y1; y++) if (y % 3 !== 2) { P.set(x, y, C.th); P.set(x + 1, y, C.l1); } };
  stitchH(bodyY + 3, 7, w - 8);
  stitchH(h - 4, 7, w - 8);
  stitchV(2, iy0, h - 7);
  stitchV(w - 4, iy0, h - 7);
  outline(P, C.l0);
  // 铆钉
  const rivet = (cx, cy) => {
    P.set(cx - 1, cy, C.b1); P.set(cx + 1, cy, C.b0); P.set(cx, cy - 1, C.b2); P.set(cx, cy + 1, C.b0);
    P.set(cx, cy, C.b2); P.set(cx - 1, cy - 1, C.b3); P.set(cx + 1, cy + 1, C.l0);
  };
  for (const sx of strapsX) { rivet(sx + 3, bodyY + 3); rivet(sx + 8, bodyY + 3); }
  rivet(4, h - 5); rivet(w - 5, h - 5);
  return P.canvas();
}

// ---------- 磁带 ----------
const SHELL = {
  rain: [C.rain0, C.rain1, C.rain2],
  night: [C.night0, C.night1, C.night2],
  echo: [C.echo0, C.echo1, C.echo2],
  dawn: [C.dawn0, C.dawn1, C.dawn2],
};
export const TW = 46, TH = 28;
export const HUBS = [17, 28]; // 卷带花毂的 x（y=18），卡座里的转轴对齐到这里

// 3×5 小号数字，用来把编号印在外壳左上角
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

function hub(P, cx, cy, frame) {
  // 卷带（棕色磁带圈）
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    const r = Math.hypot(x, y);
    if (r <= 4.6 && r > 3.2) P.set(cx + x, cy + y, ((x + y) & 1) ? C.l1 : C.l2);
  }
  const th0 = frame * Math.PI / 8; // 4 帧 × 22.5° = 90°（花毂 4 齿对称）
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const r = Math.hypot(x, y);
    if (r > 3.3) continue;
    let a = Math.atan2(y, x) - th0;
    a = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    const tooth = r > 1.0 && r <= 2.4 && (a < 0.42 || a > Math.PI / 2 - 0.42);
    const ring = r > 2.4;
    P.set(cx + x, cy + y, ring ? C.p1 : tooth ? C.p1 : r <= 1 ? C.m1 : C.s0);
  }
}

// 标签文字单独成图：磁带倾斜时只转外壳，文字保持水平叠在标签上（8px 字旋转后会断笔）。
// 返回 { img, cx, cy }：文字图中心相对磁带中心的偏移
export function makeLabelText(work) {
  const lx = 10, ly = 3, lw = 35;
  const t = textPixels(work.label || work.title);
  const inkW = Math.max(1, t.pts.reduce((a, p) => Math.max(a, p[0] + 1), 0));
  const P = new Pix(inkW, Math.max(1, t.h));
  t.pts.forEach(([x, y]) => P.set(x, y, C.ink));
  const tx = lx + Math.max(0, Math.floor((lw - inkW) / 2)), ty = ly + 2 + Math.max(0, Math.floor((8 - t.h) / 2));
  return { img: P.canvas(), cx: tx + inkW / 2 - TW / 2, cy: ty + t.h / 2 - TH / 2 };
}

export function makeTape(work, frame = 0, withText = true) {
  const P = new Pix(TW, TH);
  const [d, m, l] = SHELL[work.shell] || SHELL.rain;
  const sd = work.code.charCodeAt(1) * 7;
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inRR(x, y, TW, TH, 2)) continue;
    let v = 0.5 + (vnoise(x, y, 6, sd) - 0.5) * 0.35 + (hash(x, y, sd + 1) - 0.5) * 0.25;
    if (y <= 1) v += 0.35; if (x <= 1) v += 0.15; if (y >= TH - 2 || x >= TW - 2) v -= 0.35;
    P.set(x, y, pick(v, x, y, [d, m, l], 0.3));
  }
  // 底部梯形
  for (let y = 22; y < TH - 1; y++) {
    const inset = 8 - (y - 22);
    P.hline(6 + inset, TW - 7 - inset, y, d);
  }
  P.hline(9, TW - 10, 22, l);
  [14, 20, 25, 31].forEach(x => { P.set(x, 25, C.ink); });
  // 编号：外壳左上角的小号数字
  [...work.code].forEach((ch, k) => {
    const g = DIGITS[+ch] || DIGITS[0];
    for (let i = 0; i < 15; i++) if (g[i] === '1') P.set(2 + k * 4 + (i % 3), 4 + Math.floor(i / 3), C.p1);
  });
  // 纸标签：游戏名（8px 像素字）
  const lx = 10, ly = 3, lw = 35, lh = 11;
  for (let y = ly; y < ly + lh; y++) for (let x = lx; x < lx + lw; x++) {
    let c = C.p1;
    if (hash(x, y, sd + 3) > 0.93) c = C.p0;
    P.set(x, y, c);
  }
  P.hline(lx, lx + lw - 1, ly + lh - 1, C.p0);
  P.vline(lx + lw - 1, ly, ly + lh - 1, C.p0);
  P.hline(lx + 1, lx + lw - 2, ly + lh, d);
  P.hline(lx + 1, lx + lw - 2, ly + 1, m); // 标签色条
  const t = textPixels(work.label || work.title);
  const inkW = t.pts.reduce((a, p) => Math.max(a, p[0] + 1), 0);
  const tx = lx + Math.max(0, Math.floor((lw - inkW) / 2)), ty = ly + 2 + Math.max(0, Math.floor((8 - t.h) / 2));
  if (withText) t.pts.forEach(([x, y]) => { if (tx + x < lx + lw - 1) P.set(tx + x, ty + y, C.ink); });
  // 卷带窗
  P.rect(12, 15, 22, 7, C.s0);
  P.hline(12, 33, 14, d); P.hline(12, 33, 22, l);
  hub(P, HUBS[0], 18, frame);
  hub(P, HUBS[1], 18, (frame + 2) % 4);
  P.rect(21, 16, 4, 4, C.s1);
  // 螺丝
  [[TW - 3, 2], [2, TH - 3], [TW - 3, TH - 3], [22, 24]].forEach(([x, y]) => { P.set(x, y, C.m4); });
  outline(P, C.ink);
  return P.canvas();
}

// 包内空位：一圈虚线轮廓
export function makeSlot() {
  const P = new Pix(TW, TH);
  let i = 0;
  const pts = [];
  for (let x = 2; x < TW - 2; x++) pts.push([x, 0]);
  pts.push([TW - 2, 1]);
  for (let y = 2; y < TH - 2; y++) pts.push([TW - 1, y]);
  pts.push([TW - 2, TH - 2]);
  for (let x = TW - 3; x >= 2; x--) pts.push([x, TH - 1]);
  pts.push([1, TH - 2]);
  for (let y = TH - 3; y >= 2; y--) pts.push([0, y]);
  pts.push([1, 1]);
  for (const [x, y] of pts) { if (i % 4 < 2) P.set(x, y, C.th); i++; }
  return P.canvas();
}

// ---------- 旋转（最近邻，无半透明边） ----------
const rotCache = new WeakMap();
export function rotated(src, deg) {
  deg = Number.isFinite(deg) ? Math.round(deg) : 0;
  let m = rotCache.get(src);
  if (!m) { m = new Map(); rotCache.set(src, m); }
  if (m.has(deg)) return m.get(deg);
  let out;
  if (deg === 0) out = src;
  else {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const w = src.width, h = src.height;
    const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s)) + 1, H = Math.ceil(Math.abs(w * s) + Math.abs(h * c)) + 1;
    const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const P = new Pix(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
      const sx = Math.floor(c * dx + s * dy + w / 2), sy = Math.floor(-s * dx + c * dy + h / 2);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const i = (sy * w + sx) * 4;
      if (sd[i + 3] < 128) continue;
      P.set(x, y, [sd[i], sd[i + 1], sd[i + 2]]);
    }
    out = P.canvas();
  }
  m.set(deg, out);
  return out;
}
const silCache = new WeakMap();
export function silhouette(src, color = C.l0) {
  if (silCache.has(src)) return silCache.get(src);
  const g = src.getContext('2d');
  const d = g.getImageData(0, 0, src.width, src.height).data;
  const P = new Pix(src.width, src.height);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 0) P.set(x, y, color);
  const out = P.canvas();
  silCache.set(src, out);
  return out;
}

// ---------- 磁带机 ----------
// L: { w,h, keys:[x...], power:x, keyY, bezel:{x,y,w,h}, win:{x,y,w,h}, grille:{x,y,w,h}, counter:{x,y,w,h}, led:{x,y} }
export function makeMachine(L) {
  const { w, h } = L;
  const P = new Pix(w, h);
  const lv = [C.m1, C.m2, C.m3, C.m4];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRR(x, y, w, h, y < h / 2 ? 6 : 3)) continue;
    // 拉丝：按行的随机明暗 + 横向长条纹
    let v = 0.58 + (hash(0, y, 31) - 0.5) * 0.12 + (vnoise(x / 9, y, 1, 32) - 0.5) * 0.18;
    v += (vnoise(x, y, 18, 33) - 0.5) * 0.2; // 大块做旧
    const edge = Math.min(x, w - 1 - x, y, h - 1 - y);
    if (edge < 6) v -= (6 - edge) * 0.025; // 角落积灰
    if (y < 2) v += 0.3; if (x < 2) v += 0.15; if (y > h - 3 || x > w - 3) v -= 0.3;
    let c = pick(v, x, y, lv, 0.28);
    if (hash(x, y, 34) > 0.985) c = C.m4; // 划痕亮点
    P.set(x, y, c);
  }
  // 斜向划痕
  for (let k = 0; k < 7; k++) {
    let x = Math.floor(hash(k, 1, 40) * (w - 20)) + 8, y = Math.floor(hash(k, 2, 40) * (h - 20)) + 8;
    const len = 4 + Math.floor(hash(k, 3, 40) * 6);
    for (let i = 0; i < len; i++) { P.set(x + i, y + (i >> 1), C.m4); }
  }
  // 控制面板凹槽
  const pnl = { x: 4, y: 2, w: w - 8, h: L.panelH - 2 };
  for (let y = pnl.y; y < pnl.y + pnl.h; y++) for (let x = pnl.x; x < pnl.x + pnl.w; x++) {
    if (!inRR(x - pnl.x, y - pnl.y, pnl.w, pnl.h, 2)) continue;
    const v = 0.4 + (hash(0, y, 35) - 0.5) * 0.1 + (hash(x, y, 36) - 0.5) * 0.12;
    P.set(x, y, pick(v, x, y, lv, 0.3));
  }
  P.hline(pnl.x + 2, pnl.x + pnl.w - 3, pnl.y, C.m1);
  P.hline(pnl.x + 2, pnl.x + pnl.w - 3, pnl.y + pnl.h, C.m4);
  // 键位凹坑
  for (const kx of [...L.keys, L.power]) P.rect(kx - 1, L.keyY - 1, 18, 13, C.m0);
  // 通风槽
  if (L.vent) for (let i = 0; i < 5; i++) {
    const vx = L.vent.x + i * 4;
    P.vline(vx, L.vent.y, L.vent.y + 6, C.m0); P.vline(vx + 1, L.vent.y, L.vent.y + 6, C.m4);
  }
  // LED 座
  P.rect(L.led.x - 1, L.led.y - 1, 4, 4, C.m0);
  // 音量滚轮的凹槽 + 下方的音量刻度槽
  if (L.wheel) {
    const wh = L.wheel;
    P.rect(wh.x - 1, wh.y - 1, wh.w + 2, wh.h + 2, C.m0);
    P.hline(wh.x - 1, wh.x + wh.w, wh.y + wh.h + 1, C.m4);
    P.rect(wh.x, wh.y + wh.h + 2, wh.w, 2, C.ink);
  }
  // 屏幕边框
  const b = L.bezel;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    if (!inRR(x - b.x, y - b.y, b.w, b.h, 3)) continue;
    const v = 0.3 + (hash(x, y, 37) - 0.5) * 0.15;
    P.set(x, y, pick(v, x, y, [C.m0, C.m1, C.m2], 0.3));
  }
  P.hline(b.x + 3, b.x + b.w - 4, b.y - 1, C.m1);
  P.hline(b.x + 3, b.x + b.w - 4, b.y + b.h, C.m5);
  // 屏幕本体（暗绿黑 + 扫描线）
  const sx = b.x + 3, sy = b.y + 3, sw = b.w - 6, sh = b.h - 6;
  for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
    P.set(x, y, (y & 1) ? C.s0 : C.s1);
  }
  P.hline(sx, sx + sw - 1, sy, C.ink); P.vline(sx, sy, sy + sh - 1, C.ink);
  // 扬声器网孔
  const gr = L.grille;
  for (let y = gr.y; y < gr.y + gr.h; y++) for (let x = gr.x; x < gr.x + gr.w; x++) {
    const hole = (x - gr.x) % 3 === 1 && (y - gr.y) % 3 === 1;
    if (hole) { P.set(x, y, C.m0); P.set(x + 1, y + 1, C.m4); }
  }
  // 计数器框
  const ct = L.counter;
  P.rect(ct.x, ct.y, ct.w, ct.h, C.m0);
  P.rect(ct.x + 1, ct.y + 1, ct.w - 2, ct.h - 2, C.ink);
  P.hline(ct.x, ct.x + ct.w - 1, ct.y + ct.h, C.m4);
  // 磁带窗框（内部留给动态绘制）
  const wn = L.win;
  P.rect(wn.x - 2, wn.y - 2, wn.w + 4, wn.h + 4, C.m1);
  P.hline(wn.x - 2, wn.x + wn.w + 1, wn.y - 2, C.m0);
  P.hline(wn.x - 2, wn.x + wn.w + 1, wn.y + wn.h + 2, C.m5);
  P.rect(wn.x - 1, wn.y - 1, wn.w + 2, wn.h + 2, C.ink);
  // 玻璃盖铰链（窗口底边两端）
  for (const hx of [wn.x - 1, wn.x + wn.w - 2]) { P.rect(hx, wn.y + wn.h, 3, 2, C.m0); P.set(hx + 1, wn.y + wn.h, C.m4); }
  // 四角螺丝
  [[4, h - 5], [w - 5, h - 5]].forEach(([x, y]) => {
    P.set(x, y, C.m1); P.set(x - 1, y, C.m2); P.set(x + 1, y, C.m2); P.set(x, y + 1, C.m4);
  });
  // 挂件挂环
  P.set(L.cat.x + 7, L.cat.y - 1, C.m0); P.set(L.cat.x + 8, L.cat.y - 1, C.m0); P.set(L.cat.x + 8, L.cat.y - 2, C.m4);
  outline(P, C.ink);
  return P.canvas();
}

// 卡座内部：暗色腔体 + 两根转轴（对齐磁带花毂）
export function makeWindowBack(wn) {
  const P = new Pix(wn.w, wn.h);
  for (let y = 0; y < wn.h; y++) for (let x = 0; x < wn.w; x++) P.set(x, y, ((x + y) % 5 === 0) ? C.s1 : C.s0);
  const ox = Math.floor((wn.w - TW) / 2), oy = Math.floor((wn.h - TH) / 2);
  for (const hx of HUBS) {
    const cx = ox + hx, cy = oy + 18;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const r = Math.hypot(x, y);
      if (r <= 2.3) P.set(cx + x, cy + y, r <= 0.8 ? C.m1 : (x + y < 0 ? C.m4 : C.m2));
    }
  }
  P.hline(2, wn.w - 3, wn.h - 3, C.m1); // 卡槽底沿
  return P.canvas();
}

// 透明玻璃盖：底边铰链，向前翻开。4 帧：0 合上 → 3 完全翻开（垂在铰链下方）。
// 返回 { img, ox, oy }：绘制时 img 左上角 = 窗口左上角 + (ox, oy)
export const LID_FRAMES = 4;
export function makeLid(wn, frame) {
  const ang = [0, 42, 76, 104][frame] * Math.PI / 180;
  const H = wn.h, W = wn.w;
  const ph = Math.round(H * Math.cos(ang)); // >0 在铰链上方，<0 垂在下方
  const flare = Math.round(4 * Math.sin(ang)); // 越靠近观众的一边越宽（透视）
  const cw = W + 8, ch = H + 12;
  const P = new Pix(cw, ch);
  const hingeY = H + 1; // 画布里铰链所在行（对应窗口底边下一行）
  const x0 = 4;
  const rows = Math.max(2, Math.abs(ph));
  for (let r = 0; r < rows; r++) {
    // r=0 是铰链边，r=rows-1 是盖子上沿（翻开后是外沿）
    const t = rows === 1 ? 1 : r / (rows - 1);
    const grow = Math.round(flare * t);
    const y = ph >= 0 ? hingeY - 1 - r : hingeY + r;
    const xa = x0 - grow, xb = x0 + W - 1 + grow;
    const edge = r === rows - 1;
    const hinge = r === 0;
    for (let x = xa; x <= xb; x++) {
      const side = x === xa || x === xb;
      let c = null;
      if (edge) c = frame === 0 ? C.m4 : C.m5;
      else if (hinge) c = C.m2;
      else if (side) c = C.m3;
      else if (ph < 0) {
        // 翻开后垂在下方：看到的是盖子内侧，玻璃斜着反光，比合上时更「实」
        const k = (x - xa) + r * 2;
        c = (k % 9 === 0 || k % 9 === 1) ? C.m5 : ((x + y) & 1) ? C.m4 : C.m2;
      } else {
        // 玻璃：稀疏的斜向反光，翻开越多反光越密
        const k = (x - xa) + (rows - r) * (frame >= 2 ? 2 : 1);
        const dot = ((x + y) & 1) === 0; // 点状反光，透过玻璃仍能看清标签
        if (dot && (k % 23 === 0 || k % 23 === 2 || (frame >= 2 && k % 23 === 11))) c = C.m5;
        else if (frame >= 1 && ((x + y) % 4 === 0)) c = C.m4;
      }
      if (c) P.set(x, y, c);
    }
    if (edge && frame > 0) P.hline(xa + 1, xb - 1, ph >= 0 ? y + 1 : y - 1, C.m2); // 盖子厚度
  }
  // 上沿的小拉手
  if (ph > 4) { const y = hingeY - rows; P.rect(x0 + Math.floor(W / 2) - 3, y - 1, 6, 2, C.m1); P.hline(x0 + Math.floor(W / 2) - 2, x0 + Math.floor(W / 2) + 1, y - 1, C.m4); }
  if (ph < -4) { const y = hingeY + rows; P.rect(x0 + Math.floor(W / 2) - 3, y - 1, 6, 2, C.m1); }
  return { img: P.canvas(), ox: -x0, oy: -1 };
}

// ---------- 左上角标题牌 ----------
// 木牌：两块木板拼成，四角钉子，下方两根桩插进草地
export function makeSignWood(w, h, postH) {
  const P = new Pix(w, h + postH);
  for (const px of [10, w - 14]) for (let y = h - 2; y < h + postH; y++) for (let x = px; x < px + 4; x++) {
    P.set(x, y, x === px ? C.l4 : x === px + 3 ? C.l1 : C.l3);
  }
  for (let y = h + postH - 2; y < h + postH; y++) for (const px of [9, w - 15]) P.hline(px, px + 5, y, C.g1); // 桩脚的草
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRR(x, y, w, h, 2)) continue;
    let v = 0.55 + (vnoise(x / 6, y, 1, 61) - 0.5) * 0.5 + (hash(x, y, 62) - 0.5) * 0.15;
    if (y === Math.floor(h / 2)) v = 0.05; // 两块木板的接缝
    if (y <= 1) v += 0.25; if (y >= h - 2) v -= 0.25;
    P.set(x, y, pick(v, x, y, [C.l1, C.l2, C.l3, C.l4], 0.3));
  }
  outline(P, C.l0);
  for (const [x, y] of [[3, 2], [w - 4, 2], [3, h - 3], [w - 4, h - 3]]) { P.set(x, y, C.m4); P.set(x + 1, y + 1, C.l0); }
  return P.canvas();
}
// 磁带封面卡（J-card）：左侧书脊是四盘磁带的颜色条，右上角折角
export function makeSignCard(w, h) {
  const P = new Pix(w + 1, h + 1);
  P.rect(1, 1, w, h, C.g0); // 投在草地上的影子
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) P.set(x, y, hash(x, y, 71) > 0.94 ? C.p0 : C.p1);
  const bands = [C.rain1, C.night1, C.echo1, C.dawn1];
  for (let y = 0; y < h; y++) for (let x = 0; x < 6; x++) P.set(x, y, bands[Math.min(3, Math.floor(y / (h / 4)))]);
  P.vline(6, 0, h - 1, C.p0); P.vline(7, 0, h - 1, C.ink);
  for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) P.set(w - 4 + j, i, C.g2); // 折角露出草地
  P.hline(w - 4, w - 1, 4, C.p0);
  P.hline(0, w - 1, h - 1, C.p0);
  return P.canvas();
}

// ---------- 音量滚轮 ----------
// 竖轴、横向拨动的拇指轮：竖条纹随音量值平移，制造转动感；两侧按圆柱面压暗
export function makeWheel(wh, phase, hot = false) {
  const P = new Pix(wh.w, wh.h);
  for (let y = 0; y < wh.h; y++) for (let x = 0; x < wh.w; x++) {
    const edge = Math.min(x, wh.w - 1 - x);
    const ridge = (x + phase) % 3 === 0;
    let c = ridge ? (hot ? C.m2 : C.m1) : edge < 2 ? (hot ? C.m3 : C.m2) : edge < 5 ? (hot ? C.m4 : C.m3) : (hot ? C.m5 : C.m4);
    if (!ridge && (y === 0)) c = edge < 3 ? C.m3 : (hot ? C.p1 : C.m5); // 顶面高光
    if (y === wh.h - 1) c = C.m1;                      // 底部阴影
    P.set(x, y, c);
  }
  return P.canvas();
}

// ---------- 按键 ----------
const ICON = {
  play: ['1....', '111..', '11111', '111..', '1....'],
  pause: ['11.11', '11.11', '11.11', '11.11', '11.11'],
  eject: ['..1..', '.111.', '11111', '.....', '11111'],
  ff: ['1..1.', '11.11', '11111', '11.11', '1..1.'],
  rew: ['.1..1', '11.11', '11111', '11.11', '.1..1'],
  power: ['..1..', '1.1.1', '1.1.1', '1...1', '.111.'],
};
// hover：键帽整体亮一档、描琥珀色边（像被灯照到），提示可以按
export function makeKey(kind, down, hover = false) {
  const P = new Pix(16, 11);
  const red = kind === 'power';
  let [dk, mid, hi, top] = red ? [C.r0, C.r1, C.r1, C.r2] : [C.m2, C.m3, C.m4, C.m5];
  if (hover) [dk, mid, hi, top] = red ? [C.r1, C.r2, C.r2, C.fp] : [C.m3, C.m4, C.m5, C.p1];
  const off = down ? 2 : 0;
  // 键帽侧面（按下后变矮）
  P.rect(0, off, 16, 11 - off, dk);
  for (let y = off + 1; y < 8 + Math.floor(off / 2); y++) for (let x = 1; x < 15; x++) {
    const v = 0.5 + (hash(x, y, 51 + (red ? 1 : 0)) - 0.5) * 0.4;
    P.set(x, y, down ? (v > 0.7 ? hi : mid) : (v > 0.35 ? hi : mid));
  }
  P.hline(1, 14, off, down ? hi : top);
  const ic = ICON[kind];
  const ix = 5, iy = off + 1 + (down ? 0 : 0);
  ic.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '1') P.set(ix + x, iy + y, red ? C.p1 : C.ink); }));
  outline(P, C.ink);
  // outline 会把画布外圈吃掉一圈，这里直接在内部补一圈描边
  const Q = new Pix(16, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 16; x++) {
    if (!P.on(x, y)) continue;
    const e = x === 0 || x === 15 || y === off || y === 10;
    Q.set(x, y, e ? (hover ? C.b1 : C.ink) : P.get(x, y));
  }
  return Q.canvas();
}

// ---------- 三花猫挂件（2 帧摇摆） ----------
// 画布比猫宽 4 像素（左右各留 2），摆动 ±2 时不会被裁掉；绘制时 x 要减 CAT_PAD
export const CAT_PAD = 2;
export function makeCat(sway = 0) {
  const P = new Pix(16 + CAT_PAD * 2, 22);
  const W_ = C.fw, O = C.co, K = C.ink, N = C.fp;
  // 挂绳：上端固定，下半段跟着身体偏
  for (let y = 0; y < 6; y++) P.set(8 + CAT_PAD + (y > 2 ? Math.round(sway * (y - 2) / 3) : 0), y, C.th);
  const ox = sway + CAT_PAD;
  const art = [
    '..k........k...',
    '.kok......kWk..',
    '.kOOkkkkkkWWk..',
    '.kOOOWWWWKKWk..',
    'kOOWWWWWWWKKWk.',
    'kWWkWWWWWkWKWk.',
    'kWWWWWnWWWWWWk.',
    '.kWWWWWWWWWWk..',
    '..kkWWWWWWkk...',
    '..kOOWWWWKKk...',
    '.kOOOWWWWKKKk..',
    '.kOOWWWWWWKKk.k',
    '.kWWWWWWWWWWkkO',
    '.kWWkWWWWkWWkO.',
    '..kkkkkkkkkkk..',
  ];
  const map = { k: K, W: W_, O, K: C.l0, n: N, o: C.fp };
  art.forEach((row, y) => [...row].forEach((ch, x) => { if (map[ch]) P.set(x + ox, y + 6, map[ch]); }));
  return P.canvas();
}
