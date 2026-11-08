/* v0.5 on-device measurement overlay. Loaded only with ?measure=1 (see bootstrap.js).
   Measures the real display frame interval with its own requestAnimationFrame loop, so the numbers
   come from the device that runs the page. Nothing is sent anywhere; results stay on screen and in
   localStorage ('dustline-measure') of this browser only. */
const startedAt = performance.now();
let readyAt = null, playStart = null, last = 0, frames = [], minuteFps = [], minuteFrames = 0, minuteStart = 0;
const box = document.createElement('div');
box.id = 'measureBox';
box.style.cssText = 'position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 4px);transform:translateX(-50%);z-index:9;' +
  'background:#071319d9;border:1px solid #77f1dc88;color:#e6f0e9;font:10px/1.4 ui-monospace,Menlo,monospace;padding:4px 7px;' +
  'border-radius:4px;pointer-events:none;white-space:pre;text-align:left;max-width:min(46vw,330px);overflow:hidden';
document.getElementById('app').appendChild(box);

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'WebGL2なし';
  } catch { return '不明'; }
}
const device = {
  gpu: gpuName(),
  screen: `${screen.width}x${screen.height} dpr${devicePixelRatio}`,
  ua: navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90),
};
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const quality = () => ({0: '省電力', 1: '標準', 2: '高画質'})[document.getElementById('quality')?.value] ?? '?';
const playing = () => document.getElementById('modalWrap')?.classList.contains('hide');

function tick(now) {
  requestAnimationFrame(tick);
  if (readyAt === null && !document.getElementById('start').disabled) readyAt = now;
  const dt = last ? now - last : 0; last = now;
  if (!playing() || document.hidden || dt <= 0 || dt > 1000) { render(now); return; }   // menu/pause/background excluded
  if (playStart === null) { playStart = now; minuteStart = now; }
  frames.push(dt); if (frames.length > 36000) frames.shift();
  minuteFrames++;
  if (now - minuteStart >= 60000) { minuteFps.push(Math.round(minuteFrames * 1000 / (now - minuteStart))); minuteFrames = 0; minuteStart = now; save(); }
  render(now);
}
let lastDraw = 0;
function render(now) {
  if (now - lastDraw < 500) return; lastDraw = now;
  const recent = frames.slice(-60), avgRecent = recent.length ? 1000 / (recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
  const all = frames.length ? 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length) : 0;
  const low1 = frames.length ? 1000 / pct(frames, .99) : 0;
  const slow = frames.length ? frames.filter(d => d > 34).length / frames.length * 100 : 0;
  const t = playStart === null ? 0 : (performance.now() - playStart) / 1000;
  box.textContent =
    `計測 ${fmt(t)}  画質 ${quality()}  読込 ${readyAt ? ((readyAt - startedAt) / 1000).toFixed(1) + '秒' : '…'}\n` +
    `今 ${avgRecent.toFixed(0)}fps  平均 ${all.toFixed(1)}  下位1% ${low1.toFixed(0)}  34ms超 ${slow.toFixed(1)}%\n` +
    `1分ごと ${minuteFps.slice(-12).join(' ') || '—'}\n${device.screen} ${device.gpu.replace(/^ANGLE \(|\)$/g, '').slice(0, 34)}`;
}
function save() {
  try {
    localStorage.setItem('dustline-measure', JSON.stringify({at: new Date().toISOString(), device, quality: quality(),
      minuteFps, frames: frames.length, loadSec: readyAt ? (readyAt - startedAt) / 1000 : null}));
  } catch { /* private mode: keep on screen only */ }
}
requestAnimationFrame(tick);
