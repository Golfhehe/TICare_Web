import React, { useCallback, useEffect, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { mutate } from '../lib/db';
import { tagLabel } from '../lib/eduTags';
import { ageLabel, kindLabel, kindIcon, STATUS_LABEL, openResource } from './resourceUtils';

const FIELDS = 'id,title,description,audience,kind,storage_path,external_url,status,tags,review_note,reviewed_at,created_at,author_id';
const NOTE_MAX = 500;

export default function ReviewPanel({ user, role, notify }) {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setError('Chưa kết nối Supabase.'); return; }
    setLoading(true); setError('');
    const [p, h] = await Promise.all([
      supabase.from('education_resources').select(FIELDS).eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      supabase.from('education_resources').select(FIELDS).neq('status', 'pending')
        .order('reviewed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(20),
    ]);
    if (p.error || h.error) setError('Không tải được danh sách: ' + (p.error || h.error).message);
    else { setPending(p.data || []); setHistory(h.data || []); }
    setLoading(false);
  }, []);
  useEffect(() => { if (role === 'admin') load(); }, [role, load]);

  if (role !== 'admin') return <div className="edu-v3-empty"><ShieldCheck size={35} /><b>Chỉ quản trị viên mới xem được mục này</b></div>;

  async function decide(r, approved) {
    const note = (notes[r.id] || '').trim();
    if (!approved && !note) { notify('Hãy ghi lý do từ chối để tác giả chỉnh sửa.'); return; }
    setBusyId(r.id);
    try {
      await mutate(supabase.from('education_resources').update({
        status: approved ? 'approved' : 'rejected', review_note: note || null,
        reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq('id', r.id));
      notify(approved ? 'Đã duyệt học liệu.' : 'Đã từ chối học liệu.');
      setNotes(n => Object.fromEntries(Object.entries(n).filter(([k]) => k !== r.id)));
      await load();
    } catch (err) { notify('Không thể xử lý: ' + err.message); }
    finally { setBusyId(null); }
  }

  const chips = r => r.tags?.length > 0 && <div className="edu-v3-chips">{r.tags.map(t => <span key={t}>{tagLabel(t)}</span>)}</div>;
  return <>
    <div className="edu-v3-library-head"><div><h2>Quản trị học liệu</h2><p>Duyệt học liệu do giáo viên gửi. Khi từ chối, ghi rõ lý do để tác giả chỉnh sửa và gửi lại.</p></div></div>
    {error && <p className="edu-v3-error" role="alert">{error}</p>}
    <h3 className="edu-v3-subhead">Chờ duyệt ({pending.length})</h3>
    {loading && pending.length === 0 ? <p>Đang tải...</p> : pending.length === 0 ? <div className="edu-v3-empty"><ShieldCheck size={35} /><b>Không có học liệu nào chờ duyệt</b></div>
      : <div className="edu-v3-grid">{pending.map(r => <article className="edu-v3-tile" key={r.id}>
        <span className="edu-v3-tile-icon">{kindIcon(r.kind)}</span>
        <span className="edu-v3-tag">{ageLabel(r.audience)} · {kindLabel(r.kind)}</span>
        <b>{r.title}</b><p>{r.description || 'Không có mô tả.'}</p>{chips(r)}
        <button className="btn btn-outline" type="button" onClick={() => openResource(r, notify)}><Download size={16} /> Xem học liệu</button>
        <label className="edu-v3-notefield">Ghi chú (bắt buộc khi từ chối, tối đa {NOTE_MAX})
          <textarea rows={2} maxLength={NOTE_MAX} value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} /></label>
        <div className="edu-v3-review"><button type="button" disabled={busyId === r.id} onClick={() => decide(r, true)}>Duyệt</button><button type="button" disabled={busyId === r.id} onClick={() => decide(r, false)}>Từ chối</button></div>
      </article>)}</div>}
    <h3 className="edu-v3-subhead">Đã xử lý gần đây ({history.length})</h3>
    {history.length === 0 ? <p className="edu-v3-muted">Chưa có học liệu nào được xử lý.</p>
      : <ul className="edu-v3-history">{history.map(r => <li key={r.id}>
        <div><b>{r.title}</b><span>{ageLabel(r.audience)} · {kindLabel(r.kind)}{r.reviewed_at ? ' · ' + new Date(r.reviewed_at).toLocaleDateString('vi-VN') : ''}</span>
          {r.review_note && <em>Ghi chú: {r.review_note}</em>}</div>
        <span className={'edu-v3-badge ' + r.status}>{STATUS_LABEL[r.status] || r.status}</span>
      </li>)}</ul>}
  </>;
}
