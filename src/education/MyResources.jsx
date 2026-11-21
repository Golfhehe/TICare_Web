import React, { useCallback, useEffect, useState } from 'react';
import { UploadCloud, Download, Trash2, X, BookOpen } from 'lucide-react';
import { supabase } from '../supabase';
import { mutate } from '../lib/db';
import { uid } from '../lib/uid';
import { sanitizeTags, tagLabel } from '../lib/eduTags';
import { AGES, ageLabel, kindLabel, kindIcon, STATUS_LABEL, openResource } from './resourceUtils';
import TagPicker from './TagPicker';
import Modal from '../components/Modal';

const FIELDS = 'id,title,description,audience,kind,storage_path,external_url,status,tags,review_note,reviewed_at,created_at';

export default function MyResources({ user, notify, openAuth }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [age, setAge] = useState('lop_1');
  const [kind, setKind] = useState('slide');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase.from('education_resources').select(FIELDS)
      .eq('author_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (err) setError('Không tải được học liệu của bạn: ' + err.message); else setItems(data || []);
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!user) { openAuth?.(); return; }
    const t = title.trim();
    if (!t) { notify('Nhập tên học liệu.'); return; }
    if (!supabase) { notify('Chưa kết nối Supabase.'); return; }
    let safeUrl = null, path = null;
    if (kind === 'link') {
      try { const p = new URL(url.trim()); if (p.protocol !== 'https:') throw Error(); safeUrl = p.href; }
      catch { notify('Liên kết phải bắt đầu bằng https://'); return; }
    } else {
      const allowed = { slide: ['pptx', 'pdf'], scratch: ['sb3'], document: ['pdf', 'pptx'] };
      const ext = file?.name?.split('.').pop()?.toLowerCase();
      if (!file || !allowed[kind]?.includes(ext)) { notify('Chọn đúng định dạng: PPTX/PDF hoặc Scratch SB3.'); return; }
      if (file.size > 10 * 1024 * 1024) { notify('Tệp tối đa 10 MB.'); return; }
      path = `${user.id}/${uid()}.${ext}`;
    }
    setBusy(true);
    try {
      if (path) {
        const up = await supabase.storage.from('education-resources').upload(path, file, { upsert: false, contentType: kind === 'scratch' ? 'application/octet-stream' : file.type || 'application/octet-stream' });
        if (up.error) throw up.error;
      }
      const { error: err } = await supabase.from('education_resources').insert({
        title: t, description: desc.trim(), audience: age, kind, storage_path: path, external_url: safeUrl,
        author_id: user.id, status: 'pending', tags: sanitizeTags(tags),
      });
      if (err) throw err;
      notify('Đã gửi học liệu! Admin sẽ duyệt trước khi công khai.');
      setOpen(false); setTitle(''); setDesc(''); setFile(null); setUrl(''); setTags([]);
      await load();
    } catch (err) {
      if (path) await supabase.storage.from('education-resources').remove([path]);
      notify('Không thể tải học liệu: ' + (err.message || 'Có lỗi xảy ra'));
    } finally { setBusy(false); }
  }

  async function remove(r) {
    try {
      // Delete the row first (RLS: own + not approved); only then remove the file, so a denied delete never orphans the row.
      await mutate(supabase.from('education_resources').delete().eq('id', r.id));
      if (r.storage_path) {
        const { error: err } = await supabase.storage.from('education-resources').remove([r.storage_path]);
        if (err) console.warn('Could not remove storage file', err.message);
      }
      notify('Đã xoá học liệu.');
      setConfirmId(null);
      await load();
    } catch (err) { notify('Không thể xoá: ' + err.message); }
  }

  if (!user) {
    return <div className="edu-v3-empty"><BookOpen size={35} /><b>Đăng nhập để gửi và quản lý học liệu của bạn</b>
      <button type="button" className="btn btn-primary" onClick={() => openAuth?.()}>Đăng nhập</button></div>;
  }
  return <>
    <div className="edu-v3-library-head"><div><h2>Học liệu của tôi</h2><p>Gửi học liệu mới (PPTX/PDF, Scratch SB3, liên kết HTTPS). Admin sẽ duyệt trước khi hiển thị công khai. Bạn có thể xoá học liệu chưa được duyệt.</p></div>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><UploadCloud size={17} /> Gửi học liệu</button></div>
    {error && <p className="edu-v3-error" role="alert">{error}</p>}
    {loading ? <p>Đang tải học liệu...</p> : items.length === 0 ? <div className="edu-v3-empty"><BookOpen size={35} /><b>Bạn chưa gửi học liệu nào</b><p>Chia sẻ bài giảng hoặc trò chơi Scratch đầu tiên của bạn.</p></div>
      : <div className="edu-v3-grid">{items.map(r => <article className="edu-v3-tile" key={r.id}>
        <span className="edu-v3-tile-icon">{kindIcon(r.kind)}</span>
        <span className="edu-v3-tag">{ageLabel(r.audience)} · {kindLabel(r.kind)}</span>
        <b>{r.title}</b><p>{r.description || 'Học liệu dành cho lớp học.'}</p>
        <span className={'edu-v3-badge ' + r.status}>{STATUS_LABEL[r.status] || r.status}</span>
        {r.status === 'rejected' && <p className="edu-v3-note" role="note"><b>Lý do từ chối:</b> {r.review_note || 'Admin không ghi chú thêm.'}</p>}
        {r.tags?.length > 0 && <div className="edu-v3-chips">{r.tags.map(t => <span key={t}>{tagLabel(t)}</span>)}</div>}
        <button className="btn btn-outline" type="button" onClick={() => openResource(r, notify)}><Download size={16} /> {r.kind === 'link' ? 'Mở liên kết' : 'Mở / tải học liệu'}</button>
        {r.status !== 'approved' && (confirmId === r.id
          ? <div className="edu-v3-review"><button type="button" className="danger" onClick={() => remove(r)}>Xác nhận xoá</button><button type="button" onClick={() => setConfirmId(null)}>Giữ lại</button></div>
          : <button type="button" className="edu-v3-delete" onClick={() => setConfirmId(r.id)}><Trash2 size={15} /> Xoá</button>)}
      </article>)}</div>}
    {open && <Modal onClose={() => setOpen(false)} dismissible={!busy} className="edu-v3-modal" labelledBy="share-res-title">
      <button type="button" className="close" onClick={() => setOpen(false)} aria-label="Đóng" disabled={busy}><X /></button>
      <h2 id="share-res-title">Chia sẻ học liệu</h2>
      <p>Chỉ đăng tài liệu có quyền chia sẻ. Không đưa tên, hình ảnh hoặc hồ sơ sức khỏe của trẻ vào học liệu.</p>
      <form className="form-stack" onSubmit={submit}>
        <label>Tên học liệu<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Giới thiệu ngắn<textarea maxLength={500} rows={3} value={desc} onChange={e => setDesc(e.target.value)} /></label>
        <label>Độ tuổi<select value={age} onChange={e => setAge(e.target.value)}>{AGES.map(a => <option value={a.id} key={a.id}>{a.label}</option>)}</select></label>
        <label>Loại học liệu<select value={kind} onChange={e => { setKind(e.target.value); setFile(null); setUrl(''); }}><option value="slide">Bài giảng PPTX / PDF</option><option value="scratch">Dự án Scratch .sb3</option><option value="document">Tài liệu PDF / PPTX</option><option value="link">Liên kết trò chơi online (HTTPS)</option></select></label>
        {kind === 'link'
          ? <label>Liên kết HTTPS<input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://scratch.mit.edu/projects/..." /></label>
          : <label>Chọn tệp (tối đa 10 MB)<input type="file" required accept={kind === 'scratch' ? '.sb3' : '.pdf,.pptx'} onChange={e => setFile(e.target.files?.[0] || null)} /></label>}
        <TagPicker value={tags} onChange={setTags} />
        <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi chờ duyệt'} <UploadCloud size={17} /></button>
      </form>
    </Modal>}
  </>;
}
