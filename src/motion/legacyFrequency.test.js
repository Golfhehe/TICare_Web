import { describe, it, expect } from 'vitest';
import { estimatePeriod } from './legacyFrequency';

// Reproduces M-RC (plan): the legacy estimator was built for slow, regular oscillation at ~10 Hz sampling.
function sampled(freqHz, { fs = 10, seconds = 7, amp = 0.05 } = {}) {
  const out = [];
  let phase = 0;
  for (let k = 0; k < fs * seconds; k++) {
    const t = k / fs;
    phase += 2 * Math.PI * freqHz / fs;
    out.push({ t, value: amp * Math.sin(phase) });
  }
  return out;
}

describe('legacy estimatePeriod (M-RC reproduction)', () => {
  it('control: slow regular oscillation (1 Hz) is measured as ~60/min', () => {
    for (const s of [20, 60, 100]) {
      const f = estimatePeriod(sampled(1), s);
      expect(f).toBeGreaterThan(55);
      expect(f).toBeLessThan(65);
    }
  });

  it.each([3, 4, 5])('%i Hz shaking at 10 Hz sampling returns null at the default and lower sensitivities', hz => {
    for (const s of [10, 20, 40, 60]) expect(estimatePeriod(sampled(hz), s)).toBeNull();
  });

  it('4 Hz shaking is never reported correctly, even at max sensitivity (null or aliased, never ~240/min)', () => {
    const f = estimatePeriod(sampled(4), 100);
    expect(f === null || Math.abs(f - 240) > 60).toBe(true);
  });
});
