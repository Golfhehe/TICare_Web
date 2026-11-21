import { DISCLAIMER, MOTION_CHANNELS, channelLabel } from './constants';
import { chartGeometry } from './chartGeometry';
import { formatClock } from './sessionData';

/** Renders one channel's chart to a PNG blob; the fixed limitation sentence is part of the picture footer. */
export function renderChartPng({ series, events, channel, title = 'TICare Motion Insight', subtitle = '' }) {
  const W = 900, H = 400, dpr = 1;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#123a42'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(`${title} · ${channelLabel(channel)}`, 24, 34);
  ctx.fillStyle = '#54736c'; ctx.font = '13px sans-serif'; if (subtitle) ctx.fillText(subtitle, 24, 56);
  const g = chartGeometry(series, events, channel, 0);
  const X0 = 24, Y0 = 70, PW = W - 48, PH = 250;
  const sx = t => X0 + 40 + ((t - g.t0) / (g.t1 - g.t0)) * (PW - 50);
  const sy = v => Y0 + 10 + (1 - v / g.max) * (PH - 40);
  const color = MOTION_CHANNELS.find(c => c.id === channel)?.color || '#0d9488';
  ctx.strokeStyle = '#dceee9'; ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) { const yy = Y0 + 10 + f * (PH - 40); ctx.beginPath(); ctx.moveTo(X0 + 40, yy); ctx.lineTo(X0 + PW - 10, yy); ctx.stroke(); }
  ctx.fillStyle = color; ctx.globalAlpha = 0.22;
  for (const e of events.filter(ev => ev.channel === channel)) ctx.fillRect(sx(e.t), Y0 + 10, Math.max(3, sx(e.t + e.duration / 1000) - sx(e.t)), PH - 40);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath();
  g.rows.forEach((r, i) => { const px = sx(r.t), py = sy(r[channel]); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.stroke();
  ctx.fillStyle = '#61847e'; ctx.font = '11px sans-serif';
  ctx.fillText(g.max.toFixed(2), X0, Y0 + 20); ctx.fillText('0', X0 + 24, Y0 + PH - 30);
  ctx.fillText(formatClock(g.t0), X0 + 40, Y0 + PH - 12); ctx.textAlign = 'right'; ctx.fillText(formatClock(g.t1), X0 + PW - 10, Y0 + PH - 12); ctx.textAlign = 'left';
  const n = events.filter(e => e.channel === channel).length;
  ctx.fillStyle = '#153a40'; ctx.font = '13px sans-serif'; ctx.fillText(`${n} sự kiện ở kênh này · vùng tô màu = thời gian có sự kiện`, 24, 345);
  ctx.fillStyle = '#7a5b00'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(DISCLAIMER, 24, 380);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Không tạo được ảnh PNG.'))), 'image/png'));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
