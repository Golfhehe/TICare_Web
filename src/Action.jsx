import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, CheckCircle2, CalendarDays, NotebookPen, Trash2, Printer, Save, BookOpen, ArrowLeft, ShieldCheck, Search, AlertTriangle, Pencil, Check, X, Clock, ClipboardCheck } from 'lucide-react';
import { supabase } from './supabase';
import './action.css';

// Dữ liệu mẫu chỉ là gợi ý giáo dục, không phải chỉ định điều trị.
const LIBRARY = [
  { id: 'respect', group: 'Môi trường lớp học', title: 'Thiết lập quy tắc tôn trọng khác biệt', detail: 'Thống nhất cách nói chuyện tử tế, không trêu chọc hoặc bắt chước những biểu hiện khác biệt.' },
  { id: 'privacy', group: 'Môi trường lớp học', title: 'Trao đổi riêng tư và tôn trọng', detail: 'Hỏi về những điều giúp việc học thuận lợi hơn; không yêu cầu công khai thông tin sức khỏe.' },
  { id: 'time', group: 'Điều chỉnh học tập', title: 'Linh hoạt thời gian và nhiệm vụ', detail: 'Cân nhắc chia nhiệm vụ thành các phần nhỏ hoặc cho thêm thời gian khi có nhu cầu thực tế.' },
  { id: 'participation', group: 'Điều chỉnh học tập', title: 'Đa dạng cách tham gia hoạt động', detail: 'Cho phép tham gia bằng nói, viết hoặc hoạt động nhóm phù hợp với điều kiện lớp.' },
  { id: 'support', group: 'Phối hợp', title: 'Thống nhất phương án hỗ trợ', detail: 'Trao đổi với gia đình và bộ phận hỗ trợ của trường khi cần, theo nguyên tắc bảo mật.' },
  { id: 'review', group: 'Đánh giá', title: 'Đánh giá lại hoạt động sau một thời gian', detail: 'Ghi nhận những thay đổi trong trải nghiệm học tập và mức độ tham gia; tránh đánh giá sức khỏe từ camera.' }
];
const fresh = () => ({
  title: '', goal: '', classLevel: 'Tiểu học', startDate: new Date().toISOString().slice(0,10),
  endDate: '', status: 'draft', tasks: [], notes: '', review: '',
  focus: 'Tạo môi trường học tập tôn trọng, linh hoạt và an toàn.'
});
const statuses = {draft:'Bản nháp', active:'Đang thực hiện', done:'Đã hoàn thành'};
const shortDate = (s) => s ? new Date(s+'T00:00:00').toLocaleDateString('vi-VN') : 'Chưa đặt';
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const safeData = (x) => ({
  title: clean(x.title).slice(0,120), goal: clean(x.goal).slice(0,2000),
  classLevel: clean(x.classLevel).slice(0,80), startDate: x.startDate || '', endDate: x.endDate || '',
  status: ['draft','active','done'].includes(x.status) ? x.status : 'draft',
  focus: clean(x.focus).slice(0,500), notes: clean(x.notes).slice(0,4000), review: clean(x.review).slice(0,4000),
  tasks: (Array.isArray(x.tasks) ? x.tasks : []).slice(0,40).map(t => ({
    id: String(t.id || crypto.randomUUID()), text: clean(t.text).slice(0,500), done: !!t.done
  })).filter(t=>t.text)
});

export default function Action({ user, notify = () => {}, openAuth = () => {} }) {
  const [plans,setPlans] = useState([]);
  const [selected,setSelected] = useState(null);
  const [draft,setDraft] = useState(fresh());
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [dirty,setDirty] = useState(false);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('all');
  const [newTask,setNewTask] = useState('');
  const [error,setError] = useState('');
  const [view,setView] = useState('list');

  useEffect(() => {
    let alive = true;
    setPlans([]); setSelected(null);setDraft(fresh());setDirty(false);setView('list');
    if (!supabase || !user?.id) return;
    setLoading(true);
    supabase.from('action_plans').select('id,title,status,plan,updated_at')
      .eq('owner_id',user.id).order('updated_at',{ascending:false}).then(({data,error})=>{
        if (!alive) return;
        if (error) { setError('Chưa tải được kế hoạch: '+error.message); }
        else { setPlans(data || []); setError(''); }
        setLoading(false);
      });
    return ()=>{alive=false;};
  },[user?.id]);

  const visible = useMemo(()=>plans.filter(p=>
    (filter==='all' || p.status===filter) &&
    (p.title||'').toLowerCase().includes(query.toLowerCase())
  ),[plans,filter,query]);
  const counts = useMemo(()=>({total:plans.length,active:plans.filter(p=>p.status==='active').length,done:plans.filter(p=>p.status==='done').length}),[plans]);
  const completion = draft.tasks.length ? Math.round(100*draft.tasks.filter(t=>t.done).length/draft.tasks.length) : 0;
  const update = (patch)=>{setDraft(v=>({...v,...patch}));setDirty(true);};
  const show = (p) => {setSelected(p.id);setDraft({...fresh(),...p.plan,title:p.title,status:p.status});setDirty(false);setError('');setView('edit');};
  const create = () => {setSelected(null);setDraft(fresh());setDirty(true);setError('');setView('edit');};
  const back = ()=>{if(dirty && !window.confirm('Thay đổi chưa lưu sẽ bị mất. Quay lại?'))return;setView('list');setDirty(false);setSelected(null);setError('');};
  const addTask = (text) => {
    const val=clean(text);
    if (!val || draft.tasks.length>=40)return;
    update({tasks:[...draft.tasks,{id:crypto.randomUUID(),text:val.slice(0,500),done:false}]});
    setNewTask('');
  };
  async function save() {
    if(!supabase || !user?.id){openAuth();return;}
    const data=safeData(draft);
    if(data.title.length<3){setError('Đặt tên kế hoạch ít nhất 3 ký tự.');return;}
    if(data.endDate && data.startDate && data.endDate<data.startDate){setError('Ngày kết thúc không được sớm hơn ngày bắt đầu.');return;}
    setSaving(true);setError('');
    try {
      const record={owner_id:user.id,title:data.title,status:data.status,plan:data};
      const req= selected
        ? supabase.from('action_plans').update(record).eq('id',selected).eq('owner_id',user.id).select('id,title,status,plan,updated_at').single()
        : supabase.from('action_plans').insert(record).select('id,title,status,plan,updated_at').single();
      const {data:stored,error}=await req;
      if(error) throw error;
      setSelected(stored.id);setPlans(old=>[stored,...old.filter(p=>p.id!==stored.id)].sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)));
      setDraft({...fresh(),...stored.plan});setDirty(false);
      notify('Đã lưu kế hoạch vào tài khoản TICare.');
    } catch(e){setError('Không lưu được: '+e.message);} finally {setSaving(false);}
  }
  async function remove() {
    if(!selected || !window.confirm('Xóa kế hoạch này khỏi tài khoản? Không thể khôi phục.'))return;
    setSaving(true);setError('');
    try {
      const {data,error}=await supabase.from('action_plans').delete().eq('id',selected).eq('owner_id',user.id).select('id');
      if(error) throw error;
      if(!data?.length) throw new Error('Không tìm thấy kế hoạch hoặc không đủ quyền.');
      setPlans(p=>p.filter(x=>x.id!==selected));setSelected(null);setDraft(fresh());setDirty(false);setView('list');notify('Đã xóa kế hoạch.');
    }catch(e){setError('Không thể xóa: '+e.message);}finally{setSaving(false);}
  }
  function printPlan(){
    const data=safeData(draft);
    if(!data.title){setError('Hãy nhập tên kế hoạch trước khi in.');return;}
    const escape=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(data.title)}</title><style>body{font:15px/1.65 Arial,sans-serif;max-width:800px;margin:35px auto;color:#19383a}h1{color:#087c70;font-size:26px}h2{font-size:18px;margin-top:25px;border-bottom:1px solid #bddcd6}.meta{color:#50666a}li{padding:4px 0}.note{white-space:pre-wrap;background:#f1f8f5;padding:12px;border-radius:8px}@media print{body{margin:15mm}}</style></head><body><h1>${escape(data.title)}</h1><p class="meta">${escape(data.classLevel)} · ${escape(shortDate(data.startDate))} – ${escape(shortDate(data.endDate))} · ${escape(statuses[data.status])}</p><h2>Mục tiêu</h2><div class="note">${escape(data.goal||'Chưa ghi')}</div><h2>Định hướng hỗ trợ</h2><div class="note">${escape(data.focus)}</div><h2>Danh sách công việc</h2><ul>${data.tasks.map(t=>`<li>${t.done?'☑':'☐'} ${escape(t.text)}</li>`).join('')||'<li>Chưa có</li>'}</ul><h2>Ghi chú thực hiện</h2><div class="note">${escape(data.notes||'Chưa ghi')}</div><h2>Đánh giá & điều chỉnh</h2><div class="note">${escape(data.review||'Chưa ghi')}</div><p class="meta">TICare Action — tài liệu hỗ trợ giáo dục, không phải kết luận y tế. Không đưa thông tin định danh hoặc sức khỏe học sinh vào kế hoạch.</p></body></html>`;
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,'_blank');
    if(!win){URL.revokeObjectURL(url);setError('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up và thử lại.');return;}
    // Trang HTML có thể in / Save as PDF bằng trình duyệt.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  if(!user) return <section className="action-page"><div className="action-hero"><span>TICARE ACTION</span><h1>Kế hoạch đồng hành</h1><p>Lập kế hoạch, ghi chú và theo dõi các điều chỉnh giáo dục trong không gian riêng của giáo viên.</p></div><div className="action-signin"><ShieldCheck size={34}/><h2>Đăng nhập để quản lý kế hoạch</h2><p>Kế hoạch được lưu riêng theo tài khoản và không hiển thị công khai.</p><button className="action-primary" onClick={openAuth}>Đăng nhập TICare</button></div></section>;
  if(!supabase) return <section className="action-page"><div className="action-error">Chưa cấu hình Supabase cho TICare Action.</div></section>;
  return <section className="action-page">
    <div className="action-hero"><div><span>TICARE ACTION · KHÔNG GIAN GIÁO VIÊN</span><h1>Kế hoạch đồng hành</h1><p>Thiết kế hỗ trợ học tập, lưu tiến độ và đánh giá hoạt động giáo dục.</p></div><div className="action-hero-icon"><ClipboardList size={38}/></div></div>
    <div className="action-privacy"><ShieldCheck size={17}/> Chỉ dùng thông tin không định danh; không nhập tên thật, tình trạng sức khỏe hoặc dữ liệu camera của học sinh.</div>
    {error&&<div className="action-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Đóng lỗi"><X size={16}/></button></div>}
    {view==='list'?<>
      <div className="action-stats"><div><strong>{counts.total}</strong><span>Tổng kế hoạch</span></div><div><strong>{counts.active}</strong><span>Đang thực hiện</span></div><div><strong>{counts.done}</strong><span>Đã hoàn thành</span></div></div>
      <div className="action-toolbar"><div className="action-search"><Search size={17}/><input aria-label="Tìm kế hoạch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm theo tên kế hoạch..."/></div><select aria-label="Lọc trạng thái" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="active">Đang thực hiện</option><option value="done">Hoàn thành</option></select><button className="action-primary" onClick={create}><Plus size={17}/> Tạo kế hoạch</button></div>
      {loading?<div className="action-empty">Đang tải kế hoạch...</div>:!visible.length?<div className="action-empty"><ClipboardList size={36}/><h3>{plans.length?'Không có kế hoạch phù hợp':'Chưa có kế hoạch nào'}</h3><p>Tạo một kế hoạch đầu tiên để bắt đầu đồng hành.</p><button className="action-primary" onClick={create}><Plus size={17}/> Tạo kế hoạch mới</button></div>:<div className="action-plan-grid">{visible.map(p=>{const tasks=p.plan?.tasks||[];const progress=tasks.length?Math.round(100*tasks.filter(t=>t.done).length/tasks.length):0;return <button className="action-plan-card" key={p.id} onClick={()=>show(p)}><div className="action-card-head"><span className={'action-status '+p.status}>{statuses[p.status]||'Bản nháp'}</span><span className="action-date"><Clock size={13}/> {new Date(p.updated_at).toLocaleDateString('vi-VN')}</span></div><h3>{p.title}</h3><p>{p.plan?.goal||'Chưa thêm mục tiêu'}</p><div className="action-progress"><span style={{width:progress+'%'}}/></div><small>{tasks.filter(t=>t.done).length}/{tasks.length} công việc · {progress}%</small></button>})}</div>}
    </>:<>
      <div className="action-editor-head"><button className="action-back" type="button" onClick={back}><ArrowLeft size={17}/> Danh sách</button><div className="action-editor-actions">{selected&&<button className="action-danger" onClick={remove} disabled={saving}><Trash2 size={16}/> Xóa</button>}<button className="action-soft" onClick={printPlan}><Printer size={16}/> In / PDF</button><button className="action-primary" onClick={save} disabled={saving}><Save size={17}/>{saving?'Đang lưu...':dirty?'Lưu thay đổi':'Đã lưu'}</button></div></div>
      <div className="action-editor-grid"><div className="action-editor-main">
        <div className="action-panel"><h2><Pencil size={20}/> Thông tin kế hoạch</h2><label>Tên kế hoạch<input maxLength={120} value={draft.title} onChange={e=>update({title:e.target.value})} placeholder="Ví dụ: Xây dựng lớp học tôn trọng sự khác biệt"/></label><label>Mục tiêu giáo dục<textarea rows={3} maxLength={2000} value={draft.goal} onChange={e=>update({goal:e.target.value})} placeholder="Nêu mục tiêu học tập và môi trường lớp học, không nhập thông tin sức khỏe cá nhân"/></label><div className="action-field-row"><label>Cấp học / bối cảnh<input value={draft.classLevel} maxLength={80} onChange={e=>update({classLevel:e.target.value})}/></label><label>Trạng thái<select value={draft.status} onChange={e=>update({status:e.target.value})}>{Object.entries(statuses).map(([v,k])=><option value={v} key={v}>{k}</option>)}</select></label></div><div className="action-field-row"><label>Bắt đầu<input type="date" value={draft.startDate} onChange={e=>update({startDate:e.target.value})}/></label><label>Dự kiến đánh giá lại<input type="date" value={draft.endDate} onChange={e=>update({endDate:e.target.value})}/></label></div><label>Định hướng hỗ trợ<textarea rows={3} maxLength={500} value={draft.focus} onChange={e=>update({focus:e.target.value})}/></label></div>
        <div className="action-panel"><h2><ClipboardCheck size={20}/> Công việc cần thực hiện <span className="action-count">{completion}%</span></h2><div className="action-progress"><span style={{width:completion+'%'}}/></div><div className="action-task-list">{draft.tasks.map(t=><div key={t.id} className="action-task"><input type="checkbox" aria-label={'Hoàn thành '+t.text} checked={t.done} onChange={e=>update({tasks:draft.tasks.map(x=>x.id===t.id?{...x,done:e.target.checked}:x)})}/><span className={t.done?'completed':''}>{t.text}</span><button type="button" title="Xóa công việc" onClick={()=>update({tasks:draft.tasks.filter(x=>x.id!==t.id)})}><X size={16}/></button></div>)}{!draft.tasks.length&&<p className="action-muted">Chưa có công việc. Chọn biện pháp gợi ý hoặc tự thêm.</p>}</div><div className="action-task-add"><input value={newTask} maxLength={500} onChange={e=>setNewTask(e.target.value)} placeholder="Thêm công việc cần làm" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTask(newTask)}}}/><button type="button" onClick={()=>addTask(newTask)}><Plus size={16}/> Thêm</button></div></div>
        <div className="action-panel"><h2><NotebookPen size={20}/> Nhật ký & đánh giá</h2><label>Ghi chú quá trình thực hiện<textarea rows={5} maxLength={4000} value={draft.notes} onChange={e=>update({notes:e.target.value})} placeholder="Ghi nhận biện pháp đã thực hiện, khó khăn và cách xử lý (không nêu tên học sinh)."/></label><label>Đánh giá hiệu quả và hướng điều chỉnh<textarea rows={5} maxLength={4000} value={draft.review} onChange={e=>update({review:e.target.value})} placeholder="Ví dụ: Hoạt động nhóm giúp học sinh tham gia tự tin hơn; cần điều chỉnh thời lượng."/></label></div>
      </div><aside className="action-editor-side"><div className="action-panel"><h2><BookOpen size={19}/> Thư viện biện pháp</h2><p className="action-muted">Nhấn để đưa biện pháp vào checklist; giáo viên tự đánh giá tính phù hợp.</p>{LIBRARY.map(a=><div key={a.id} className="action-library-item"><small>{a.group}</small><strong>{a.title}</strong><p>{a.detail}</p><button type="button" disabled={draft.tasks.some(t=>t.text===a.title)||draft.tasks.length>=40} onClick={()=>addTask(a.title)}>{draft.tasks.some(t=>t.text===a.title)?<><Check size={15}/> Đã thêm</>:<><Plus size={15}/> Thêm vào kế hoạch</>}</button></div>)}</div></aside></div>
    </>}
    <p className="action-disclaimer">TICare Action hỗ trợ lập kế hoạch giáo dục, không chẩn đoán hoặc đề xuất điều trị. Kế hoạch chỉ được lưu khi nhấn “Lưu thay đổi”.</p>
  </section>;
}
