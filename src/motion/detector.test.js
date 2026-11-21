import { describe, it, expect } from 'vitest';
import { createDetector, sensitivityToZ, sensitivityToMinBurstMs } from './detector';

// ---- deterministic synthetic signals (seeded PRNG, never flaky) ----
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rnd) {
  return Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
}
const FPS = 30;
const NOISE = 0.002; // landmark jitter, in shoulder widths per frame

/**
 * Build a frame list. `position(ch, t)` gives the underlying landmark position (shoulder widths);
 * the frame value is the 2D displacement magnitude since the previous frame, plus jitter.
 */
function synth({ seconds, seed = 1, channels = ['head', 'left', 'right'], position = () => 0, trunk = null, fps = FPS }) {
  const rnd = mulberry32(seed);
  const frames = [];
  const n = Math.round(seconds * fps);
  for (let k = 1; k <= n; k++) {
    const t = k / fps;
    const ch = {};
    for (const c of channels) {
      const dx = position(c, t) - position(c, t - 1 / fps);
      ch[c] = Math.hypot(dx + NOISE * gaussian(rnd), NOISE * gaussian(rnd));
    }
    const f = { t, channels: ch };
    if (trunk) {
      const dx = trunk(t) - trunk(t - 1 / fps);
      f.trunk = Math.hypot(dx + NOISE * gaussian(rnd), NOISE * gaussian(rnd));
    }
    frames.push(f);
  }
  return frames;
}
function run(det, frames, { flush = true } = {}) {
  const events = [], alerts = [];
  for (const f of frames) {
    const r = det.push(f);
    events.push(...r.events);
    alerts.push(...(r.alerts || []));
  }
  if (flush) events.push(...det.flush());
  return { events, alerts };
}
const QUIET = 8; // seconds of calm before something happens (baseline warm-up)

describe('sensitivity mapping (C6)', () => {
  it('maps 0..100 to z 6..2 and minBurst 120..60 ms', () => {
    expect(sensitivityToZ(0)).toBeCloseTo(6);
    expect(sensitivityToZ(100)).toBeCloseTo(2);
    expect(sensitivityToZ(50)).toBeCloseTo(4);
    expect(sensitivityToMinBurstMs(0)).toBeCloseTo(120);
    expect(sensitivityToMinBurstMs(100)).toBeCloseTo(60);
  });
});

describe('detector C6 case 1: quiet + small noise', () => {
  it.each([20, 40, 60, 70])('0 events over 3 minutes at sensitivity %i', sensitivity => {
    const det = createDetector({ sensitivity });
    const { events, alerts } = run(det, synth({ seconds: 180, seed: 11 + sensitivity }));
    expect(events).toEqual([]);
    expect(alerts).toEqual([]);
  });
});

describe('detector C6 case 2: shaking 3-5 Hz for 15 s, amplitude 0.05, 30 fps', () => {
  const shake = hz => synth({
    seconds: QUIET + 15 + 5, seed: Math.round(hz * 10),
    position: (c, t) => (t > QUIET && t <= QUIET + 15 && c === 'left' ? 0.05 * Math.sin(2 * Math.PI * hz * t) : 0),
  });
  for (const hz of [3, 4, 5]) {
    it.each([20, 30, 40, 50, 60, 80, 100])(`${hz} Hz: >=1 alert (on 'left') at sensitivity %i`, sensitivity => {
      const { events, alerts } = run(createDetector({ sensitivity }), shake(hz));
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(events.some(e => e.channel === 'left' && e.t > QUIET)).toBe(true);
      if (sensitivity <= 60) {
        // the alert is on the shaking channel, right after the shaking starts, and calm channels stay silent
        expect(alerts.filter(a => a.channel !== 'left')).toEqual([]);
        expect(alerts[0].t).toBeGreaterThan(QUIET);
        expect(alerts[0].t).toBeLessThan(QUIET + 1);
      } // at 80-100 the threshold (z 2.8..2) sits inside the noise tail, so noise alone can fire (and start a cooldown) earlier
    });
  }
  it('also alerts at the lowest sensitivity the UI offers (20) across the whole 3-5 Hz range', () => {
    for (const hz of [3, 3.5, 4, 4.5, 5]) {
      const { alerts } = run(createDetector({ sensitivity: 20 }), shake(hz));
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('detector C6 case 3: slow 1 Hz waving', () => {
  it('produces at least one event', () => {
    const frames = synth({
      seconds: QUIET + 10 + 4, seed: 5,
      position: (c, t) => (t > QUIET && t <= QUIET + 10 && c === 'right' ? 0.1 * Math.sin(2 * Math.PI * t) : 0),
    });
    const { events } = run(createDetector({ sensitivity: 60 }), frames);
    expect(events.filter(e => e.channel === 'right').length).toBeGreaterThanOrEqual(1);
  });
});

describe('detector C6 case 4: single 150 ms jerk', () => {
  it('produces exactly one event of about 150 ms', () => {
    const frames = synth({ seconds: QUIET + 3, seed: 9 });
    // 150 ms jerk on head: 5 frames of 0.03 displacement
    const start = Math.round(QUIET * FPS) + 10;
    for (let k = start; k < start + 5; k++) frames[k].channels.head = Math.hypot(0.03, NOISE);
    const { events, alerts } = run(createDetector({ sensitivity: 60 }), frames);
    expect(events).toHaveLength(1);
    expect(events[0].channel).toBe('head');
    expect(events[0].duration).toBeGreaterThanOrEqual(100);
    expect(events[0].duration).toBeLessThanOrEqual(220);
    expect(events[0].intensity).toBeGreaterThan(sensitivityToZ(60));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ channel: 'head', reason: 'burst', count: 1 });
  });
});

describe('detector C6 case 5: whole-body shift is not an alert', () => {
  it('ignores a move where every channel and the shoulder midpoint move together', () => {
    // person moves 0.6 shoulder widths in 0.7 s, twice
    const bump = (t, t0) => { const u = (t - t0) / 0.7; return u <= 0 ? 0 : u >= 1 ? 0.6 : 0.6 * (3 * u * u - 2 * u * u * u); };
    const move = t => bump(t, QUIET + 1) + bump(t, QUIET + 5);
    const frames = synth({ seconds: QUIET + 9, seed: 21, channels: ['head', 'left', 'right', 'face'], position: (c, t) => move(t), trunk: move });
    const { events, alerts } = run(createDetector({ sensitivity: 60 }), frames);
    expect(alerts).toEqual([]);
    expect(events).toEqual([]);
  });
  it('but a hand shake while the torso stays still is still detected', () => {
    const frames = synth({
      seconds: QUIET + 6, seed: 22, channels: ['head', 'left'],
      position: (c, t) => (c === 'left' && t > QUIET && t < QUIET + 4 ? 0.05 * Math.sin(2 * Math.PI * 4 * t) : 0),
      trunk: () => 0,
    });
    const { alerts } = run(createDetector({ sensitivity: 60 }), frames);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('detector behaviour', () => {
  it('applies cooldown per channel and then alerts again', () => {
    const det = createDetector({ sensitivity: 60, holdSeconds: 2, cooldownSeconds: 10 });
    const frames = synth({ seconds: QUIET + 30, seed: 31 });
    const jerk = sec => { const s = Math.round(sec * FPS); for (let k = s; k < s + 6; k++) frames[k].channels.head = 0.04; };
    jerk(QUIET + 1); jerk(QUIET + 4); jerk(QUIET + 15);
    const { alerts } = run(det, frames);
    expect(alerts.map(a => Math.round(a.t))).toEqual([QUIET + 1, QUIET + 15]);
  });
  it('does not alert before the baseline warm-up', () => {
    const det = createDetector({ sensitivity: 60 });
    const frames = synth({ seconds: 5, seed: 41 });
    for (let k = 10; k < 16; k++) frames[k].channels.head = 0.05; // at ~0.3 s
    const { alerts } = run(det, frames);
    expect(alerts).toEqual([]);
  });
  it('skips non-finite values and reset() clears state', () => {
    const det = createDetector({ sensitivity: 60 });
    const frames = synth({ seconds: QUIET + 2, seed: 51 });
    frames[100].channels.head = NaN;
    expect(() => run(det, frames)).not.toThrow();
    det.reset();
    expect(det.flush()).toEqual([]);
  });
  it('blink channel: isolated blinks are events but not alerts; a rapid run of blinks alerts', () => {
    const det = createDetector({ sensitivity: 60 });
    const frames = synth({ seconds: QUIET + 14, seed: 61, channels: ['blink'] });
    const blink = sec => { const s = Math.round(sec * FPS); for (let k = s; k < s + 4; k++) frames[k].channels.blink = 0.4; };
    blink(QUIET + 1); blink(QUIET + 9);
    const r1 = run(det, frames);
    expect(r1.events.length).toBe(2);
    expect(r1.alerts).toEqual([]);
    const det2 = createDetector({ sensitivity: 60 });
    const frames2 = synth({ seconds: QUIET + 6, seed: 62, channels: ['blink'] });
    const blink2 = sec => { const s = Math.round(sec * FPS); for (let k = s; k < s + 3; k++) frames2[k].channels.blink = 0.4; };
    for (let i = 0; i < 5; i++) blink2(QUIET + 1 + i * 0.4);
    expect(run(det2, frames2).alerts.length).toBeGreaterThanOrEqual(1);
  });
});
