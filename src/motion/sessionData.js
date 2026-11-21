import { DISCLAIMER, MAX_EVENTS, MAX_SERIES_ROWS, MOTION_CHANNELS, channelLabel } from './constants';

const CH_IDS = MOTION_CHANNELS.map(c => c.id);
const r4 = x => Math.round(x * 10000) / 10000;

/** 1 Hz recorder: keeps the peak per-frame displacement of each channel in every whole second. */
export function createSeriesRecorder() {
  let buckets = new Map();
  return {
    add(t, channels) {
      if (!Number.isFinite(t) || t < 0) return;
      const sec = Math.floor(t);
      let row = buckets.get(sec);
      if (!row) { row = { t: sec }; buckets.set(sec, row); }
      for (const id of CH_IDS) {
        const v = channels?.[id];
        if (Number.isFinite(v) && !(row[id] >= v)) row[id] = v;
      }
    },
    rows() { return [...buckets.values()].sort((a, b) => a.t - b.t).map(roundRow); },
    clear() { buckets = new Map(); },
    get size() { return buckets.size; },
  };
}
const roundRow = row => { const o = { t: row.t }; for (const id of CH_IDS) if (Number.isFinite(row[id])) o[id] = r4(row[id]); return o; };

/** Merge 1 Hz rows into coarser buckets (max per channel) so a long session stays small. */
export function compactSeries(rows, maxRows = MAX_SERIES_ROWS) {
  if (rows.length <= maxRows) return rows;
  const span = rows[rows.length - 1].t - rows[0].t + 1;
  const step = Math.ceil(span / maxRows);
  const out = new Map();
  for (const row of rows) {
    const k = Math.floor(row.t / step) * step;
    const cur = out.get(k) || { t: k };
    for (const id of CH_IDS) if (Number.isFinite(row[id]) && !(cur[id] >= row[id])) cur[id] = row[id];
    out.set(k, cur);
  }
  return [...out.values()].sort((a, b) => a.t - b.t);
}

/** Keep at most `max` events; when over the limit keep the strongest ones, in time order. */
export function capEvents(events, max = MAX_EVENTS) {
  if (events.length <= max) return events;
  return [...events].sort((a, b) => b.intensity - a.intensity).slice(0, max).sort((a, b) => a.t - b.t);
}

export function normalizeEvents(events) {
  return events.map(e => ({ t: Math.round(e.t * 100) / 100, channel: e.channel, intensity: Math.round(e.intensity * 10) / 10, duration: Math.round(e.duration) }));
}

/** Row for public.motion_sessions (plan contract C2). */
export function buildSessionPayload({ label, source, startedAt, durationS, settings, events, rows, note }) {
  const cleanLabel = (label || '').trim().slice(0, 60);
  return {
    label: cleanLabel || null,
    source,
    started_at: new Date(startedAt).toISOString(),
    duration_s: Math.min(14400, Math.max(1, Math.round(durationS))),
    settings: settings || {},
    events: capEvents(normalizeEvents(events || [])),
    series: compactSeries(rows || []),
    note: note ? note.trim().slice(0, 2000) || null : null,
  };
}

/** Per-channel event counts and the strongest event, for the result screen. */
export function summarize(events, durationS) {
  const byChannel = {};
  for (const e of events) {
    const s = (byChannel[e.channel] ||= { count: 0, maxIntensity: 0, totalMs: 0 });
    s.count++;
    s.maxIntensity = Math.max(s.maxIntensity, e.intensity);
    s.totalMs += e.duration || 0;
  }
  return { durationS, total: events.length, byChannel };
}

/** CSV with a limitation line, the 1 Hz series, and the event table. UTF-8 BOM so Excel reads Vietnamese. */
export function buildCsv({ series, events, meta = {} }) {
  const lines = [
    `# ${DISCLAIMER}`,
    '# TICare Motion Insight: cac chi so chuyen dong tong hop, khong luu video, khong dinh danh',
  ];
  if (meta.label) lines.push(`# ma: ${meta.label}`);
  if (meta.source) lines.push(`# nguon: ${meta.source}`);
  if (meta.startedAt) lines.push(`# bat dau: ${new Date(meta.startedAt).toISOString()}`);
  lines.push('# do lon = dich chuyen moi khung hinh, chuan hoa theo be rong vai (chop mat/co mat: thay doi diem so)');
  lines.push(['giay', ...CH_IDS].join(','));
  for (const r of series) lines.push([r.t, ...CH_IDS.map(id => (Number.isFinite(r[id]) ? r[id] : ''))].join(','));
  lines.push('', '# su kien', 'giay,kenh,cuong_do_z,thoi_luong_ms');
  for (const e of events) lines.push([e.t, e.channel, e.intensity, e.duration].join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const eventText = e => `${channelLabel(e.channel)} · ${formatClock(e.t)} · ${e.duration} ms · cường độ ${(+e.intensity).toFixed(1)}`;
export function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
