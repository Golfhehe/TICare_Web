import { describe, it, expect } from 'vitest';
import { buildObservationSummary } from './summaryText';

const events = [
  { t: 12.5, channel: 'left', intensity: 3.1, duration: 400 },
  { t: 40.1, channel: 'left', intensity: 2.2, duration: 300 },
  { t: 80, channel: 'head', intensity: 4, duration: 500 },
];

describe('buildObservationSummary', () => {
  it('describes channels, rough duration and count in general terms', () => {
    const r = buildObservationSummary({ events, durationS: 310 });
    expect(r.text).toContain('khoảng 5 phút');
    expect(r.text).toContain('3 sự kiện');
    expect(r.text).toContain('cổ tay trái và đầu / cổ');
    expect(r.question).toMatch(/^Phiên quan sát .* Trong lớp học, khi quan sát thấy .* thì giáo viên nên hỗ trợ thế nào\?$/);
    expect(r.plan.title).toBe('Kế hoạch hỗ trợ sau quan sát');
    expect(r.plan.goal.length).toBeLessThanOrEqual(2000);
  });

  it('handles an empty session and short durations', () => {
    const r = buildObservationSummary({ events: [], durationS: 20 });
    expect(r.text).toContain('dưới 1 phút');
    expect(r.text).toContain('chưa ghi nhận');
    expect(r.question).toContain('cử động lặp lại thì giáo viên');
  });

  it('never contains student label, note, exact timestamps or seconds', () => {
    const r = buildObservationSummary({ events, durationS: 310, label: 'HS-A lớp 2', note: 'giờ toán', startedAt: '2026-11-18T08:15:00Z' });
    const all = JSON.stringify(r);
    expect(all).not.toMatch(/HS-A|lớp 2|giờ toán|2026|08:15|12\.5|12,5/);
  });

  it('tolerates missing input', () => {
    expect(buildObservationSummary().question).toBeTruthy();
  });
});
