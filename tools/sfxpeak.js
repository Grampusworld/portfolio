// 在页面里执行：逐个触发音效，量 400ms 内主输出的峰值 RMS（背景风声先压到最低）
const T = window.__tape, A = window.__audio, sleep = ms => new Promise(r => setTimeout(r, ms));
T.setVol(0.7, true); await sleep(600);
A.setAmbience(0); A.duckAmbience(true); await sleep(1500);
const peak = async (fn) => { fn(); let p = 0; const t0 = performance.now(); while (performance.now() - t0 < 400) { p = Math.max(p, T.outputLevel()); await sleep(8); } await sleep(250); return +p.toFixed(3); };
const floor = await peak(() => {});
const r = { floor };
for (const [k, fn] of Object.entries({
  key: () => A.sfxKey(), motorOn: () => A.sfxMotor(true), motorOff: () => A.sfxMotor(false),
  seek: () => A.sfxSeek(1), powerOn: () => A.sfxPower(true), powerOff: () => A.sfxPower(false), tick: () => A.sfxTick(0.7),
  lidOpen: () => A.sfxLid(true), lidClose: () => A.sfxLid(false), insert: () => A.sfxInsert(), bell: () => A.sfxBell(2),
})) r[k] = await peak(fn);
return r;
