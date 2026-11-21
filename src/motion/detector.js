// Per-channel motion-event detector (plan contract C6). Pure JS, no DOM, no MediaPipe.
//
// Input per frame: { t: seconds, channels: { head, left, right, blink, face: number }, trunk?: number }
//   each channel value = landmark displacement since the previous frame, normalized by shoulder width
//   (blendshape score delta for blink/face). `trunk` = shoulder-midpoint displacement (same units); when
//   present, a channel burst that the trunk explains (trunk >= TRUNK_RATIO * value) is whole-body movement
//   and is ignored.
// Baseline: rolling median + MAD per channel over `baselineSeconds`.
// Event: z = (v - median) / max(1.4826*MAD, minScale) stays above zThreshold(sensitivity) for >= minBurstMs
//   (allowing gaps shorter than RELEASE_MS, because a rectified oscillation passes through zero twice a cycle).
// Alert: an event is confirmed, and the channel has >= alertEvents events inside the hold window ("burst"), or the
//   cumulative active time in the hold window >= holdSeconds * 0.5 ("sustained"); then that channel is silent for
//   cooldownSeconds.
// No smoothing: it runs at the camera frame rate (never 10 Hz).

export { estimatePeriod } from './legacyFrequency.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sensitivityToZ = s => 6 - 4 * (clamp(+s || 0, 0, 100) / 100);
export const sensitivityToMinBurstMs = s => 120 - 60 * (clamp(+s || 0, 0, 100) / 100);

const RELEASE_MS = 100;
const TRUNK_RATIO = 0.5;
const STATS_EVERY = 4;
const MIN_WARMUP_SAMPLES = 30;

// Channel-specific tuning. minScale is a noise floor (so a perfectly still scene does not make z explode).
// Blinks are normal and frequent, so a blink alert needs a rapid run of them.
const CHANNEL_DEFAULTS = {
  head: { minScale: 0.001 },
  left: { minScale: 0.001 },
  right: { minScale: 0.001 },
  blink: { minScale: 0.02, alertEvents: 4, alertWindowS: 3 },
  face: { minScale: 0.02, alertEvents: 2, alertWindowS: 4 },
};
const FALLBACK_CHANNEL = { minScale: 0.001 };

function median(sortedArr) {
  const n = sortedArr.length;
  if (!n) return 0;
  const m = n >> 1;
  return n % 2 ? sortedArr[m] : (sortedArr[m - 1] + sortedArr[m]) / 2;
}

/**
 * @param {{sensitivity?:number, holdSeconds?:number, cooldownSeconds?:number, baselineSeconds?:number,
 *          warmupSeconds?:number, channels?:Record<string,{minScale?:number,alertEvents?:number,alertWindowS?:number}>}} [opts]
 * @returns {{push:(frame:object)=>{events:object[],alert:object|null,alerts:object[]}, flush:()=>object[], reset:()=>void,
 *           setOptions:(o:object)=>void}}
 */
export function createDetector(opts = {}) {
  let cfg = { sensitivity: 60, holdSeconds: 2, cooldownSeconds: 20, baselineSeconds: 20, warmupSeconds: 3, channels: {}, ...opts };
  let states = new Map();
  let lastT = -Infinity;
  let dt = 1 / 30;

  const chanCfg = id => ({ ...FALLBACK_CHANNEL, ...(CHANNEL_DEFAULTS[id] || {}), ...(cfg.channels?.[id] || {}) });

  function stateOf(id) {
    let s = states.get(id);
    if (!s) {
      s = { ts: [], vs: [], head: 0, stats: null, since: 0, firstT: null, cand: null, recent: [], lastAlert: -Infinity };
      states.set(id, s);
    }
    return s;
  }

  function refreshStats(s, id) {
    const vals = s.vs.slice(s.head).sort((a, b) => a - b);
    if (vals.length < MIN_WARMUP_SAMPLES) return;
    const med = median(vals);
    const dev = vals.map(v => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = median(dev);
    s.stats = { med, scale: Math.max(1.4826 * mad, chanCfg(id).minScale) };
    s.since = 0;
  }

  function addBaseline(s, id, t, v, zThr) {
    // winsorize: a sustained burst may not drag the baseline up in one go, but a new normal is learned eventually
    const x = s.stats ? Math.min(v, s.stats.med + zThr * s.stats.scale) : v;
    s.ts.push(t); s.vs.push(x);
    const lo = t - cfg.baselineSeconds;
    while (s.head < s.ts.length && s.ts[s.head] < lo) s.head++;
    if (s.head > 512) { s.ts = s.ts.slice(s.head); s.vs = s.vs.slice(s.head); s.head = 0; }
    if (s.firstT === null) s.firstT = t;
    s.since++;
    if (!s.stats ? s.vs.length - s.head >= MIN_WARMUP_SAMPLES : s.since >= STATS_EVERY) refreshStats(s, id);
  }

  function activeMsInWindow(s, now, windowS) {
    const lo = now - windowS;
    let ms = 0;
    for (const r of s.recent) {
      const a = Math.max(r.t, lo), b = Math.min(r.end, now);
      if (b > a) ms += (b - a) * 1000;
    }
    return ms;
  }

  function closeCand(id, s, out) {
    const c = s.cand;
    s.cand = null;
    if (!c || !c.confirmed) return;
    out.push({ t: c.start, channel: id, intensity: +c.peak.toFixed(2), duration: Math.round((c.last - c.start + dt) * 1000) });
  }

  function maybeAlert(id, s, now, reason, alerts) {
    if (now - s.lastAlert < cfg.cooldownSeconds) return;
    const cc = chanCfg(id);
    const window = cc.alertWindowS ?? cfg.holdSeconds;
    const count = s.recent.filter(r => r.t >= now - window).length;
    let fire = null;
    if (reason === 'burst' && count >= (cc.alertEvents ?? 1)) fire = 'burst';
    else if (reason === 'sustained' && activeMsInWindow(s, now, cfg.holdSeconds) >= cfg.holdSeconds * 500) fire = 'sustained';
    if (!fire) return;
    s.lastAlert = now;
    alerts.push({ t: now, channel: id, count, reason: fire });
  }

  function push(frame) {
    const events = [], alerts = [];
    const t = frame?.t;
    if (!Number.isFinite(t) || t <= lastT) return { events, alert: null, alerts };
    if (Number.isFinite(lastT)) { const d = t - lastT; if (d < 0.5) dt = dt * 0.9 + d * 0.1; }
    lastT = t;
    const zThr = sensitivityToZ(cfg.sensitivity);
    const minBurstMs = sensitivityToMinBurstMs(cfg.sensitivity);
    const need = Math.max(2, Math.ceil(minBurstMs / (dt * 1000) - 1e-6));
    const trunk = Number.isFinite(frame.trunk) ? frame.trunk : null;

    // close candidates that have been quiet for longer than the release gap (also when the channel went missing)
    for (const [id, s] of states) {
      if (s.cand && t - s.cand.last > RELEASE_MS / 1000) closeCand(id, s, events);
    }

    for (const [id, v] of Object.entries(frame.channels || {})) {
      if (!Number.isFinite(v)) continue;
      const s = stateOf(id);
      const warm = s.stats && s.firstT !== null && t - s.firstT >= cfg.warmupSeconds;
      let above = false, z = 0;
      if (warm) {
        z = (v - s.stats.med) / s.stats.scale;
        above = z >= zThr && !(trunk !== null && trunk >= TRUNK_RATIO * v);
      }
      if (above) {
        if (!s.cand) s.cand = { start: t, last: t, frames: 1, peak: z, confirmed: false };
        else { s.cand.last = t; s.cand.frames++; s.cand.peak = Math.max(s.cand.peak, z); }
        const c = s.cand;
        if (!c.confirmed && c.frames >= need) {
          c.confirmed = true;
          c.rec = { t: c.start, end: t + dt };
          s.recent.push(c.rec);
          maybeAlert(id, s, t, 'burst', alerts);
        } else if (c.confirmed) {
          c.rec.end = t + dt;
        }
      }
      if (s.cand?.confirmed) maybeAlert(id, s, t, 'sustained', alerts);
      // forget old window entries
      const keepFrom = t - Math.max(cfg.holdSeconds, chanCfg(id).alertWindowS ?? 0, 5);
      while (s.recent.length && s.recent[0].end < keepFrom) s.recent.shift();
      addBaseline(s, id, t, v, zThr);
    }
    return { events, alert: alerts[0] || null, alerts };
  }

  return {
    push,
    flush() {
      const out = [];
      for (const [id, s] of states) closeCand(id, s, out);
      return out;
    },
    reset() { states = new Map(); lastT = -Infinity; dt = 1 / 30; },
    setOptions(o) { cfg = { ...cfg, ...o }; },
  };
}
