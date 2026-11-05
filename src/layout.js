// 两套版式，所有坐标都是原生像素（放大前）。
// 文字统一用 10px 像素字（行高 11），磁带标签这类小地方用 8px。
const JITTER = [
  { dx: 0, dy: 0, rot: -3 }, { dx: 0, dy: 2, rot: 2 },
  { dx: 1, dy: 1, rot: 2 }, { dx: -1, dy: -1, rot: -3 },
  { dx: 0, dy: 0, rot: -2 }, { dx: 1, dy: 1, rot: 3 },
];

// keys / power：键帽左上角 x；每个键位宽 keySlot（键帽 16 居中，下方刻 10px 字）
// wheel：音量滚轮（倒带和电源之间），横向拨动
const DESK_MACHINE = {
  x: 112, y: 18, w: 204, h: 160,
  keyY: 4, keys: [13, 39, 65, 91, 117], power: 179, panelH: 28, keySlot: 26, keyOff: 5,
  wheel: { x: 143, y: 5, w: 26, h: 9 }, vent: null, led: { x: 174, y: 9 },
  bezel: { x: 6, y: 31, w: 192, h: 86 },
  grille: { x: 9, y: 122, w: 54, h: 27 },
  win: { x: 72, y: 119, w: 60, h: 32 },
  counter: { x: 142, y: 127, w: 34, h: 14 },
  cat: { x: 184, y: 126 },
  // 详情屏内部（相对屏幕内区 186×80）：视频在左、介绍在右，底行标签 + 按钮
  scr: { title: [2, 0, 182, 11], video: [2, 13, 96, 54], intro: [102, 13, 82, 54], row: [2, 68, 182, 12] },
};

const MOB_MACHINE = {
  x: 4, y: 88, w: 172, h: 230,
  keyY: 4, keys: [7, 30, 53, 76, 99], power: 152, panelH: 28, keySlot: 23, keyOff: 3,
  wheel: { x: 123, y: 5, w: 22, h: 9 }, vent: null, led: { x: 148, y: 9 },
  bezel: { x: 4, y: 31, w: 164, h: 157 },
  grille: { x: 8, y: 194, w: 42, h: 26 },
  win: { x: 56, y: 191, w: 60, h: 32 },
  counter: { x: 120, y: 199, w: 34, h: 14 },
  cat: { x: 152, y: 198 },
  // 屏幕内区 158×151：自上而下
  scr: { title: [2, 0, 154, 11], video: [2, 13, 154, 87], intro: [2, 103, 154, 22], row: [2, 128, 154, 12] },
};

export const TOP_BAR_H = 18; // 右上角按钮占用的高度

export function buildLayout(mobile, n) {
  if (!mobile) {
    const rows = Math.ceil(n / 2);
    const bh = 12 + 7 + rows * 32 + 15;
    const bag = { x: 4, y: Math.max(TOP_BAR_H, Math.round((180 - bh) / 2) + 4), w: 104, h: bh, strapH: 12, straps: [18, 70] };
    bag.inner = { x: bag.x + 5, y: bag.y + 19, w: 94, h: bh - 27 };
    const homes = [];
    for (let i = 0; i < n; i++) {
      const j = JITTER[i % JITTER.length];
      const col = i % 2, row = Math.floor(i / 2);
      homes.push({ x: bag.x + 29 + col * 46 + j.dx, y: bag.y + 37 + row * 32 + j.dy, rot: j.rot });
    }
    return { mobile, W: 320, H: 180, bag, homes, m: DESK_MACHINE, scrollMax: 0 };
  }
  const bag = { x: 4, y: 22, w: 172, h: 62, strapH: 10, straps: [26, 134] };
  bag.inner = { x: bag.x + 5, y: bag.y + 17, w: bag.w - 10, h: bag.h - 25 };
  const homes = [];
  const rots = [-3, 2, -2, 4, -4, 2];
  for (let i = 0; i < n; i++) homes.push({ x: bag.x + 29 + i * 48, y: bag.y + 36 + (i % 2), rot: rots[i % rots.length] });
  const last = homes[n - 1].x + 25;
  const scrollMax = Math.max(0, last - (bag.inner.x + bag.inner.w - 2));
  return { mobile, W: 180, H: 320, bag, homes, m: MOB_MACHINE, scrollMax };
}
