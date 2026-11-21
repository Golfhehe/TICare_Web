import React, { useCallback, useEffect, useState } from 'react';
import { Download, History, Trash2 } from 'lucide-react';
import { supabase, live } from '../supabase';
import { mutate } from '../lib/db';
import { channelLabel } from './constants';
import { buildCsv, formatClock } from './sessionData';
import { ChannelTabs, Disclaimer, EventList, MotionChart } from './MotionChart';
import FollowUp from './FollowUp';
import { buildObservationSummary } from './summaryText';
import { renderChartPng, downloadBlob } from './exportPng';

const fmtDate = iso => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const sourceLabel = s => (s === 'video' ? 'Video thử' : 'Camera');

/** "My sessions": list, re-open (chart + events), export, delete. Owner-only through RLS. */
export default function MotionHistory({ user, notify, openAuth, refreshKey = 0, onAskAssistant, onCreatePlan }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [channel, setChannel] = useState('left');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!live || !user) return;
    setError('');
    const { data, error: err } = await supabase.from('motion_sessions')
      .select('id,label,source,started_at,duration_s,settings,events,series,note').order('started_at', { ascending: false }).limit(30);
    if (err) { setError('Không tải được lịch sử phiên: ' + err.message); setRows([]); return; }
    setRows(data || []);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    // reload when the user changes or after a new session is saved
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load, refreshKey]);

  useEffect(() => { if (!user) { setRows(null); setOpenId(null); } }, [user]);

  async function remove(id) {
    if (!window.confirm('Xóa phiên này? Không thể khôi phục.')) return;
    setBusyId(id);
    try {
      await mutate(supabase.from('motion_sessions').delete().eq('id', id));
      setRows(r => (r || []).filter(x => x.id !== id));
      if (openId === id) setOpenId(null);
      notify?.('Đã xóa phiên.');
    } catch (e) { notify?.('Không xóa được phiên: ' + e.message); }
    setBusyId(null);
  }

  const session = rows?.find(r => r.id === openId);
  const meta = s => ({ label: s.label, source: s.source, startedAt: s.started_at });

  async function png(s) {
    try {
      const blob = await renderChartPng({ series: s.series, events: s.events, channel, subtitle: `${s.label || 'Phiên không đặt mã'} · ${fmtDate(s.started_at)} · ${formatClock(s.duration_s)}` });
      downloadBlob(blob, `ticare-bieu-do-${channel}.png`);
    } catch (e) { notify?.(e.message); }
  }
  function csv(s) {
    downloadBlob(new Blob([buildCsv({ series: s.series, events: s.events, meta: meta(s) })], { type: 'text/csv;charset=utf-8' }), 'ticare-motion-phien.csv');
  }

  return <section className="mi-v2-panel mi-history" aria-labelledby="mi-history-title">
    <div className="mi-v2-heading"><div><h3 id="mi-history-title"><History size={18} /> Lịch sử phiên của tôi</h3><p>Chỉ bạn xem được. Phiên lưu chỉ số tổng hợp, không có video và không có tên học sinh.</p></div></div>
    {!user && <p className="mi-muted">Đăng nhập để lưu và xem lại các phiên quan sát. <button type="button" className="mi-link" onClick={() => openAuth?.()}>Đăng nhập</button></p>}
    {user && rows === null && <p className="mi-muted">Đang tải...</p>}
    {error && <div className="mi-v2-error">{error}</div>}
    {user && rows && !rows.length && !error && <p className="mi-muted">Chưa có phiên nào được lưu.</p>}
    {user && rows?.length > 0 && <ul className="mi-history-list">
      {rows.map(s => <li key={s.id} className={s.id === openId ? 'open' : ''}>
        <div><b>{s.label || 'Phiên không đặt mã'}</b><small>{fmtDate(s.started_at)} · {sourceLabel(s.source)} · {formatClock(s.duration_s)} · {s.events?.length || 0} sự kiện</small></div>
        <div className="mi-history-actions">
          <button type="button" className="btn btn-outline small" onClick={() => setOpenId(s.id === openId ? null : s.id)}>{s.id === openId ? 'Đóng' : 'Xem lại'}</button>
          <button type="button" className="icon-button" aria-label={`Xóa phiên ${s.label || ''}`} disabled={busyId === s.id} onClick={() => remove(s.id)}><Trash2 size={16} /></button>
        </div>
      </li>)}
    </ul>}
    {session && <div className="mi-history-detail">
      <h4>{session.label || 'Phiên không đặt mã'} <small>{fmtDate(session.started_at)}</small></h4>
      <p className="mi-muted">Độ nhạy {session.settings?.sensitivity ?? '—'} · giữ {session.settings?.holdSeconds ?? '—'} giây · giãn cách {session.settings?.cooldownSeconds ?? '—'} giây</p>
      {session.note && <p className="mi-note-text">{session.note}</p>}
      <ChannelTabs value={channel} onChange={setChannel} events={session.events || []} />
      <MotionChart series={session.series || []} events={session.events || []} channel={channel} />
      <div className="mi-v2-exports">
        <button type="button" onClick={() => png(session)}><Download size={15} /> PNG ({channelLabel(channel)})</button>
        <button type="button" onClick={() => csv(session)}><Download size={15} /> CSV</button>
      </div>
      <EventList events={session.events || []} />
      <FollowUp summary={buildObservationSummary({ events: session.events || [], durationS: session.duration_s })} onAskAssistant={onAskAssistant} onCreatePlan={onCreatePlan} />
      <Disclaimer />
    </div>}
  </section>;
}
