// 作品数据：增删作品只改这里（支持 3–6 个）。
// media 路径相对 public/；缺哪个字段，对应按钮/画面自动隐藏。
// clip：详情屏播放的片段（360p，插带时才加载，快进/倒带在它上面跳 ±3 秒）；
// full：点开放大的 720p 版（和 clip 同一条时间线）；loop：没有 clip 时的 3–5 秒循环兜底。
// label 是磁带纸标签上的名字（8px 字，宽度 ≤ 34 像素：约 4 个汉字或 7 个英文字母）。
// intro 控制在 21 个汉字以内。
export const WORKS = [
  {
    id: 'ib',
    code: '01',
    label: 'Ib',
    shell: 'rain',
    title: 'Ib · 空缺',
    intro: '闭馆前一夜，父亲回顾展里的人都没有脸。',
    tags: { type: '恐怖', platform: 'Web', year: '2026' },
    links: {
      play: 'https://ib-museum-demo.app.workbuddy.host/?sharecode=5WGABVAYL7',
      source: 'https://github.com/Grampusworld/Unity_Project_Ib',
    },
    media: { loop: 'media/ib/loop.mp4', clip: 'media/ib/clip.mp4', poster: 'media/ib/poster.webp', full: 'media/ib/full.mp4' },
  },
  {
    id: 'sleight',
    code: '02',
    label: 'SLEIGHT',
    shell: 'night',
    title: '障眼法 SLEIGHT',
    intro: '追光之下演十个魔术，秘密只在暗处完成。',
    tags: { type: '解谜', platform: 'Web', year: '2026' },
    links: {
      play: 'https://grampus2003.itch.io/sleight',
      source: 'https://github.com/ByteSized-Ocean/SLEIGHT',
    },
    media: { loop: 'media/sleight/loop.mp4', clip: 'media/sleight/clip.mp4', poster: 'media/sleight/poster.webp' },
  },
  {
    id: 'ski',
    code: '03',
    label: '3D滑雪',
    shell: 'echo',
    title: '3D 滑雪大冒险',
    intro: '雪崩在身后越追越快，一路冲下雪山。',
    tags: { type: '跑酷', platform: 'Web', year: '2026' },
    links: {
      play: 'https://grampusworld.github.io/3d-ski-adventure/',
      source: 'https://github.com/Grampusworld/3d-ski-adventure',
    },
    media: { loop: 'media/ski/loop.mp4', clip: 'media/ski/clip.mp4', poster: 'media/ski/poster.webp' },
  },
  {
    id: 'lottery',
    code: '04',
    label: '挂个爽',
    shell: 'dawn',
    title: '挂个爽 Lottery Mania',
    intro: '洗盘子、刮彩票，攒够两百万给猫买猫粮。',
    tags: { type: '放置', platform: 'Web·PC', year: '2026' },
    links: {
      play: 'https://grampusworld.github.io/Unity_Lottery/',
      source: 'https://github.com/Grampusworld/Unity_Lottery',
    },
    media: {
      loop: 'media/lottery/loop.mp4',
      clip: 'media/lottery/clip.mp4',
      poster: 'media/lottery/poster.webp',
      full: 'media/lottery/full.mp4',
    },
  },
];
