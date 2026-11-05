"""把 Fusion Pixel 8px / 10px 裁成只含页面用到的字。

用法：python3 tools/subset_font.py
源字体放在 tools/fonts-src/（zh_hans 版 woff2）。
改了文案（src/works.js、index.html、src/main.js）后重跑一次。
依赖：pip install fonttools brotli
"""
import pathlib

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = {
    'fp8.woff2': 'fusion-pixel-8px-proportional-zh_hans.ttf.woff2',
    'fp10.woff2': 'fusion-pixel-10px-proportional-zh_hans.ttf.woff2',
}

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set('▶◀‖↗·—…「」《》、，。：；！？（）')
for p in [ROOT / 'index.html', *sorted((ROOT / 'src').glob('*.js'))]:
    chars |= set(p.read_text(encoding='utf-8'))
chars = {c for c in chars if c.isprintable() and c not in '\n\r\t'}

for out_name, src_name in FONTS.items():
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(str(ROOT / 'tools/fonts-src' / src_name), opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(sorted(chars)))
    sub.subset(font)
    out = ROOT / 'public/fonts' / out_name
    subset.save_font(font, str(out), opts)
    print(f'{len(chars)} chars -> {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.1f} KB)')
