import { describe, it, expect } from 'vitest';
import { createSeriesRecorder, compactSeries, capEvents, buildSessionPayload, buildCsv, summarize, formatClock } from './sessionData';
import { DISCLAIMER } from './constants';

describe('series recorder (1 Hz, peak per second)', () => {
  it('keeps the max per channel per whole second', () => {
    const r = createSeriesRecorder();
    r.add(0.1, { head: 0.01, left: 0.02 });
    r.add(0.5, { head: 0.05 });
    r.add(1.2, { head: 0.03, bogus: 9 });
    r.add(NaN, { head: 1 });
    expect(r.rows()).toEqual([{ t: 0, head: 0.05, left: 0.02 }, { t: 1, head: 0.03 }]);
    r.clear();
    expect(r.rows()).toEqual([]);
  });
});

describe('compactSeries / capEvents / payload', () => {
  it('compacts long sessions below the row limit with max per bucket', () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({ t: i, head: i === 5000 ? 0.9 : 0.01 }));
    const out = compactSeries(rows, 3000);
    expect(out.length).toBeLessThanOrEqual(3000);
    expect(Math.max(...out.map(r => r.head))).toBe(0.9);
  });
  it('caps events at 2000 keeping the strongest in time order', () => {
    const ev = Array.from({ length: 2500 }, (_, i) => ({ t: i, channel: 'head', intensity: i % 2500 < 500 ? 1 : 5, duration: 100 }));
    const out = capEvents(ev, 2000);
    expect(out).toHaveLength(2000);
    expect(out.every(e => e.intensity === 5)).toBe(true);
    expect(out[0].t).toBeLessThan(out[1].t);
  });
  it('builds a C2-shaped payload (label trimmed to 60, duration clamped, no video)', () => {
    const p = buildSessionPayload({
      label: ' HS-A ' + 'x'.repeat(100), source: 'camera', startedAt: 0, durationS: 99999,
      settings: { sensitivity: 50 }, events: [{ t: 1.234, channel: 'left', intensity: 7.77, duration: 210.4 }], rows: [{ t: 0, head: 0.01 }], note: '  ',
    });
    expect(p.label.length).toBe(60);
    expect(p.duration_s).toBe(14400);
    expect(p.events).toEqual([{ t: 1.23, channel: 'left', intensity: 7.8, duration: 210 }]);
    expect(p.note).toBeNull();
    expect(Object.keys(p).sort()).toEqual(['duration_s', 'events', 'label', 'note', 'series', 'settings', 'source', 'started_at']);
  });
});

describe('CSV export', () => {
  it('starts with the limitation line and lists series and events', () => {
    const csv = buildCsv({ series: [{ t: 0, head: 0.01, left: 0.5 }], events: [{ t: 0.4, channel: 'left', intensity: 9, duration: 300 }], meta: { label: 'HS-A', source: 'camera' } });
    expect(csv.startsWith('﻿# ' + DISCLAIMER)).toBe(true);
    expect(csv).toContain('giay,head,left,right,blink,face');
    expect(csv).toContain('0,0.01,0.5,,,');
    expect(csv).toContain('0.4,left,9,300');
    expect(csv).toContain('# ma: HS-A');
  });
});

describe('summary', () => {
  it('counts events per channel', () => {
    const s = summarize([{ channel: 'head', intensity: 5, duration: 100 }, { channel: 'head', intensity: 8, duration: 50 }, { channel: 'left', intensity: 3, duration: 10 }], 30);
    expect(s.total).toBe(3);
    expect(s.byChannel.head).toEqual({ count: 2, maxIntensity: 8, totalMs: 150 });
    expect(formatClock(75)).toBe('01:15');
  });
});
