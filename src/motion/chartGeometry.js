/** Plot values are per-second peak displacement (shoulder widths per frame). Event spans are shaded. */
export function chartGeometry(series, events, channel, windowS) {
  let rows = series.filter(r => Number.isFinite(r[channel]));
  const lastT = Math.max(rows.length ? rows[rows.length - 1].t : 0, events.length ? events[events.length - 1].t : 0);
  let t0 = rows.length ? rows[0].t : 0;
  if (windowS && lastT - t0 > windowS) { t0 = lastT - windowS; rows = rows.filter(r => r.t >= t0); }
  const t1 = Math.max(lastT + 1, t0 + 10);
  const max = Math.max(0.02, ...rows.map(r => r[channel])) * 1.15;
  const W = 700, H = 170, L = 38, R = 10, T = 10, B = 22;
  const x = t => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = v => T + (1 - v / max) * (H - T - B);
  const points = rows.map(r => `${x(r.t).toFixed(1)},${y(r[channel]).toFixed(1)}`).join(' ');
  const evs = events.filter(e => e.channel === channel && e.t >= t0 - 1)
    .map(e => ({ x: x(e.t), w: Math.max(3, x(e.t + (e.duration || 0) / 1000) - x(e.t)) }));
  return { rows, t0, t1, max, W, H, L, R, T, B, x, y, points, evs };
}
