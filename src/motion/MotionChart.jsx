import React, { useState } from 'react';
import { DISCLAIMER, MOTION_CHANNELS, channelLabel } from './constants';
import { formatClock } from './sessionData';
import { chartGeometry } from './chartGeometry';

export function Disclaimer({ className = '' }) {
  return <p className={'mi-disclaimer ' + className} role="note"><b>{DISCLAIMER}.</b> Các chỉ số chỉ mô tả mức độ chuyển động trong khung hình để giáo viên tham khảo.</p>;
}

export function MotionChart({ series, events, channel, windowS = 0 }) {
  const g = chartGeometry(series, events, channel, windowS);
  const color = MOTION_CHANNELS.find(c => c.id === channel)?.color || '#0d9488';
  const evCount = events.filter(e => e.channel === channel).length;
  return <div className="mi-v2-graph mi-chart">
    <svg viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label={`Biểu đồ ${channelLabel(channel)}: ${evCount} sự kiện`}>
      <g stroke="#dceee9" strokeWidth="1">{[0, 0.5, 1].map(f => { const yy = g.T + f * (g.H - g.T - g.B); return <line key={f} x1={g.L} x2={g.W - g.R} y1={yy} y2={yy} />; })}</g>
      {g.evs.map((e, i) => <rect key={i} x={e.x} y={g.T} width={e.w} height={g.H - g.T - g.B} fill={color} opacity="0.22" />)}
      {g.rows.length > 1 && <polyline points={g.points} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
      <g fontSize="10" fill="#61847e">
        <text x="2" y={g.T + 8}>{g.max.toFixed(2)}</text><text x="2" y={g.H - g.B}>0</text>
        <text x={g.L} y={g.H - 6}>{formatClock(g.t0)}</text><text x={g.W - g.R} y={g.H - 6} textAnchor="end">{formatClock(g.t1)}</text>
      </g>
    </svg>
    {g.rows.length < 2 && <span>Chưa có dữ liệu cho kênh này</span>}
  </div>;
}

export function ChannelTabs({ value, onChange, events = [] }) {
  return <div className="mi-v2-tabs" role="tablist" aria-label="Kênh tín hiệu">
    {MOTION_CHANNELS.map(ch => {
      const n = events.filter(e => e.channel === ch.id).length;
      return <button type="button" role="tab" aria-selected={value === ch.id} key={ch.id} className={value === ch.id ? 'active' : ''} onClick={() => onChange(ch.id)}>{ch.label}{n > 0 && <i className="mi-count">{n}</i>}</button>;
    })}
  </div>;
}

/** Compact event list grouped by channel, newest first, limited. */
export function EventList({ events, perGroup = 5, maxGroup = 30 }) {
  const [open, setOpen] = useState({});
  if (!events.length) return <p className="mi-muted">Chưa ghi nhận sự kiện nào.</p>;
  return <div className="mi-events">
    {MOTION_CHANNELS.map(ch => {
      const list = events.filter(e => e.channel === ch.id);
      if (!list.length) return null;
      const newest = [...list].reverse();
      const expanded = !!open[ch.id];
      const shown = newest.slice(0, expanded ? maxGroup : perGroup);
      return <div className="mi-events-group" key={ch.id}>
        <div className="mi-events-head"><span style={{ background: ch.color }} /><b>{ch.label}</b><small>{list.length} sự kiện</small></div>
        <ul>{shown.map((e, i) => <li key={e.id || `${e.t}-${i}`}><time>{formatClock(e.t)}</time><span>{e.duration} ms</span><span>cường độ {(+e.intensity).toFixed(1)}</span></li>)}</ul>
        {list.length > perGroup && <button type="button" className="mi-link" onClick={() => setOpen(o => ({ ...o, [ch.id]: !expanded }))}>{expanded ? 'Thu gọn' : `Xem thêm (${Math.min(list.length, maxGroup) - perGroup})`}</button>}
      </div>;
    })}
  </div>;
}
