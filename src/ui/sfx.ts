/** Petits sons de synthèse (provisoires) — aucun fichier audio nécessaire. */
let ctx: AudioContext | null = null;
let muted = false;

export const setMuted = (m: boolean) => { muted = m; };
export const isMuted = () => muted;

function tone(freq: number, dur = 0.08, type: OscillatorType = 'sine', vol = 0.08, slide = 0) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio indisponible */ }
}

export const sfx = {
  pickup: () => tone(660, 0.06, 'triangle'),
  drop: () => tone(440, 0.06, 'triangle'),
  nope: () => tone(180, 0.1, 'square', 0.04),
  chop: () => tone(900, 0.05, 'square', 0.03),
  done: () => { tone(784, 0.08, 'triangle'); setTimeout(() => tone(988, 0.1, 'triangle'), 70); },
  burnt: () => tone(200, 0.3, 'sawtooth', 0.05, -80),
  served: () => { tone(880, 0.08, 'sine'); setTimeout(() => tone(1175, 0.08, 'sine'), 80); setTimeout(() => tone(1568, 0.14, 'sine'), 160); },
  bell: () => tone(1320, 0.4, 'sine', 0.06),
  left: () => tone(330, 0.25, 'triangle', 0.06, -120),
  trash: () => tone(260, 0.12, 'triangle', 0.05, -60),
};
