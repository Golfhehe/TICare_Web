import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus, CheckCircle2, NotebookPen, Trash2, Printer, Save, BookOpen, ArrowLeft, ShieldCheck, Search, AlertTriangle, Pencil, Check, X, Clock, ClipboardCheck, BellRing, Image as ImageIcon, Paperclip, Download, Tag, UploadCloud, CalendarClock } from 'lucide-react';
import { supabase } from './supabase';
import { uid } from './lib/uid';
import './action.css';
import { LIBRARY, LIBRARY_GROUPS, searchLibrary } from './action/library';
import { safeData, freshPlan, todayLocal, daysUntil, normalizeTags, progressOf, allTags, filterByTag, STATUSES, LIMITS } from './action/planModel';
import { summarizeDue } from './action/dueSummary';
import { notifyDueOncePerDay, requestNotifications, notificationsSupported, notificationsGranted } from './action/dueNotify';
import DueBanner from './action/DueBanner';
import AttachmentThumb, { ImageModal } from './action/AttachmentThumb';
import { formatSize, isImage } from './action/files';

const fresh = freshPlan;
const statuses = STATUSES;
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const shortDate = (s) => s ? new Date(s+'T00:00:00').toLocaleDateString('vi-VN') : 'Chưa đặt';


export default function Action({ user, notify = () => {}, openAuth = () => {}, seed = null, onSeedUsed = () => {} }) {
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
  const [attachmentUrls,setAttachmentUrls] = useState({});
  const [uploading,setUploading] = useState(false);
  const [libraryGroup,setLibraryGroup] = useState('Tất cả');
  const [notifyEnabled,setNotifyEnabled] = useState(()=>notificationsGranted());
  const [reminderDismissed,setReminderDismissed] = useState(false);
  const [tagFilter,setTagFilter] = useState('all');
  const [librarySearch,setLibrarySearch] = useState('');
  const [taskDraft,setTaskDraft] = useState({tags:'',start:'',due:''});
  const [lightbox,setLightbox] = useState(null);
  const pendingSeed = useRef(null);
  const pendingOpen = useRef(null); // plan id to open once plans are loaded (from the home DueBanner)


  useEffect(() => {
    let alive = true;
    setPlans([]); setSelected(null);setDraft(fresh());setDirty(false);setView('list');setAttachmentUrls({});setReminderDismissed(false);
    if (!supabase || !user?.id) return;
    setLoading(true);
    supabase.from('action_plans').select('id,title,status,plan,updated_at')
      .eq('owner_id',user.id).order('updated_at',{ascending:false}).then(({data,error})=>{
        if (!alive) return;
        if (error) { setError('Chưa tải được kế hoạch: '+error.message); }
        else {
          setPlans(data || []); setError('');
          const want = pendingOpen.current; pendingOpen.current = null;
          const hit = want && (data || []).find(x => x.id === want);
          if (hit) show(hit);
        }
        setLoading(false);
      });
    return ()=>{alive=false;};
  },[user?.id]);

  // One-shot seed from another page (e.g. Motion result): opens a NEW, unsaved plan form. Needs login first.
  useEffect(() => {
    const incoming = seed;
    if (incoming && incoming.openPlanId) {
      onSeedUsed();
      const hit = plans.find(x => x.id === incoming.openPlanId);
      if (hit) show(hit); else pendingOpen.current = String(incoming.openPlanId);
      return;
    }
    if (incoming) { pendingSeed.current = incoming; onSeedUsed(); }
    const s = pendingSeed.current;
    if (!s) return;
    if (!user?.id) { if (incoming) openAuth(); return; }
    pendingSeed.current = null;
    setAttachmentUrls({});setTagFilter('all');setTaskDraft({tags:'',start:'',due:''});setLightbox(null);
    setSelected(null);
    setDraft({ ...fresh(), title: String(s.title || '').slice(0,120), goal: String(s.goal || '').slice(0,2000) });
    setDirty(true);setError('');setView('edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, user?.id]);

  const visible = useMemo(()=>plans.filter(p=>
    (filter==='all' || p.status===filter) &&
    `${p.title||''} ${p.plan?.caseTag||''}`.toLowerCase().includes(query.toLowerCase())
  ),[plans,filter,query]);
  const counts = useMemo(()=>({total:plans.length,active:plans.filter(p=>p.status==='active').length,done:plans.filter(p=>p.status==='done').length}),[plans]);
  const dueSummary = useMemo(()=>summarizeDue(plans,todayLocal()),[plans]);
  const dueTotal = dueSummary.overdue.length+dueSummary.dueSoon.length;
  const completion = progressOf(draft.tasks);
  const tagOptions = useMemo(()=>allTags(draft.tasks),[draft.tasks]);
  const activeTag = tagOptions.some(g=>g.toLowerCase()===tagFilter.toLowerCase()) ? tagFilter : 'all';
  const shownTasks = useMemo(()=>filterByTag(draft.tasks,activeTag),[draft.tasks,activeTag]);
  const libraryItems = useMemo(()=>searchLibrary(LIBRARY,librarySearch,libraryGroup),[librarySearch,libraryGroup]);
  const update = (patch)=>{setDraft(v=>({...v,...patch}));setDirty(true);};
  const resetEditorUi = ()=>{setAttachmentUrls({});setTagFilter('all');setTaskDraft({tags:'',start:'',due:''});setLightbox(null);};
  const show = (p) => {resetEditorUi();setSelected(p.id);setDraft(safeData({...fresh(),...p.plan,title:p.title,status:p.status}));setDirty(false);setError('');setView('edit');};
  const openById = (id) => {const p=plans.find(x=>x.id===id);if(!p)return;if(view==='edit'&&dirty&&!window.confirm('Thay đổi chưa lưu sẽ bị mất. Mở kế hoạch khác?'))return;show(p);};
  const create = () => {resetEditorUi();setSelected(null);setDraft(fresh());setDirty(true);setError('');setView('edit');};
  const back = ()=>{if(dirty && !window.confirm('Thay đổi chưa lưu sẽ bị mất. Quay lại?'))return;setView('list');setDirty(false);setSelected(null);setError('');};
  const addTask = (text,extra={}) => {
    const val=clean(text);
    if (!val || draft.tasks.length>=LIMITS.tasks)return false;
    const start=extra.start||'',due=extra.due||'';
    if(start&&due&&due<start){setError('Hạn của công việc không được sớm hơn ngày bắt đầu.');return false;}
    update({tasks:[...draft.tasks,{id:uid(),text:val.slice(0,LIMITS.taskText),done:false,tags:normalizeTags(extra.tags||[]),start,due}]});
    setNewTask('');setError('');return true;
  };
  const addTypedTask = () => {
    const tags=taskDraft.tags.split(/[,;]/);
    if(addTask(newTask,{tags,start:taskDraft.start,due:taskDraft.due}))setTaskDraft({tags:'',start:'',due:''});
  };
  const patchTask = (id,patch) => update({tasks:draft.tasks.map(x=>x.id===id?{...x,...patch}:x)});

  const imagePaths = JSON.stringify((draft.attachments||[]).filter(a=>a.type?.startsWith('image/')).map(a=>a.path));
  useEffect(()=>{
    if(!selected||!supabase||!user?.id){setAttachmentUrls({});return;}
    let active=true;
    const paths=JSON.parse(imagePaths);
    if(!paths.length){setAttachmentUrls({});return;}
    Promise.all(paths.map(async path=>{
      const {data,error}=await supabase.storage.from('action-notes').createSignedUrl(path,600);
      return [path,error?null:data?.signedUrl];
    })).then(entries=>{if(active)setAttachmentUrls(Object.fromEntries(entries.filter(([,url])=>url)));});
    return()=>{active=false;};
  },[selected,user?.id,imagePaths]);

  async function enableDeadlineAlerts(){
    if(!notificationsSupported()){notify('Trình duyệt không hỗ trợ thông báo hệ thống. Nhắc hạn vẫn hiển thị trong TICare.');return;}
    const perm=await requestNotifications();
    setNotifyEnabled(perm==='granted');
    notify(perm==='granted'?'Đã bật nhắc hạn khi TICare đang mở.':'Chưa cấp quyền thông báo; nhắc hạn vẫn hiện trên trang.');
  }
  useEffect(()=>{
    if(!notifyEnabled||!user?.id||!dueTotal||document.hidden)return;
    notifyDueOncePerDay(user.id,dueSummary);
  },[notifyEnabled,user?.id,dueSummary,dueTotal]);

  async function previewAttachment(a){
    if(!supabase||!user?.id||!selected)return;
    const external=!isImage(a);
    const newTab=external?window.open('about:blank','_blank'):null;
    try{
      const {data,error}=await supabase.storage.from('action-notes').createSignedUrl(a.path,600);
      if(error)throw error;
      setAttachmentUrls(old=>({...old,[a.path]:data.signedUrl}));
      if(!external)setLightbox({url:data.signedUrl,name:a.name});
      if(external){
        if(newTab)newTab.location.replace(data.signedUrl);
        else notify('Hãy cho phép mở tab mới để xem PDF.');
      }
    }catch(e){if(newTab)newTab.close();setError('Không mở được tệp: '+e.message);}
  }
  async function uploadAttachment(e){
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    if(!selected||dirty){setError('Hãy lưu kế hoạch và mọi chỉnh sửa trước khi thêm tệp.');return;}
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    const allowed=['png','jpg','jpeg','webp','pdf'];
    if(!allowed.includes(ext)||file.size>5*1024*1024){setError('Chỉ nhận PNG, JPG, WEBP, PDF tối đa 5 MB.');return;}
    if((draft.attachments||[]).length>=15){setError('Mỗi kế hoạch tối đa 15 tệp.');return;}
    setUploading(true);setError('');
    const path=`${user.id}/${selected}/${uid()}.${ext}`;
    try{
      const {error:upError}=await supabase.storage.from('action-notes').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
      if(upError)throw upError;
      const attachment={path,name:file.name.slice(0,120),type:file.type||'',size:file.size};
      const next=safeData({...draft,attachments:[...(draft.attachments||[]),attachment]});
      const {data,error}=await supabase.from('action_plans').update({plan:next}).eq('id',selected).eq('owner_id',user.id).select('id,title,status,plan,updated_at').single();
      if(error){await supabase.storage.from('action-notes').remove([path]);throw error;}
      setDraft({...fresh(),...data.plan});setPlans(old=>[data,...old.filter(p=>p.id!==data.id)]);setDirty(false);
      // Ảnh sẽ được xem trước tự động qua signed URL từ effect.
      notify('Đã lưu tệp đính kèm.');
    }catch(err){setError('Không tải được tệp: '+err.message);}finally{setUploading(false);}
  }
  async function deleteAttachment(a){
    if(!selected||dirty){setError('Hãy lưu thay đổi trước khi xóa tệp.');return;}
    if(!window.confirm('Gỡ tệp đính kèm này?'))return;
    setUploading(true);setError('');
    try{
      const {error}=await supabase.storage.from('action-notes').remove([a.path]);if(error)throw error;
      const next=safeData({...draft,attachments:(draft.attachments||[]).filter(x=>x.path!==a.path)});
      const {data,error:dbError}=await supabase.from('action_plans').update({plan:next}).eq('id',selected).eq('owner_id',user.id).select('id,title,status,plan,updated_at').single();
      if(dbError)throw dbError;
      setDraft({...fresh(),...data.plan});setPlans(old=>[data,...old.filter(p=>p.id!==data.id)]);setDirty(false);
      setAttachmentUrls(old=>{const n={...old};delete n[a.path];return n;});
      notify('Đã gỡ tệp.');
    }catch(err){setError('Không gỡ được tệp: '+err.message);}finally{setUploading(false);}
  }

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
      if((draft.attachments||[]).length){await supabase.storage.from('action-notes').remove(draft.attachments.map(a=>a.path));}
      setPlans(p=>p.filter(x=>x.id!==selected));setSelected(null);setDraft(fresh());setDirty(false);setView('list');notify('Đã xóa kế hoạch.');
    }catch(e){setError('Không thể xóa: '+e.message);}finally{setSaving(false);}
  }
  function printPlan(){
    const data=safeData(draft);
    if(!data.title){setError('Hãy nhập tên kế hoạch trước khi in.');return;}
    const escape=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(data.title)}</title><style>body{font:15px/1.65 Arial,sans-serif;max-width:800px;margin:35px auto;color:#19383a}h1{color:#087c70;font-size:26px}h2{font-size:18px;margin-top:25px;border-bottom:1px solid #bddcd6}.meta{color:#50666a}li{padding:4px 0}.note{white-space:pre-wrap;background:#f1f8f5;padding:12px;border-radius:8px}@media print{body{margin:15mm}}</style></head><body><h1>${escape(data.title)}</h1><p class="meta">${escape(data.classLevel)} · ${escape(shortDate(data.startDate))} – ${escape(shortDate(data.endDate))} · ${escape(statuses[data.status])}</p><p class="meta">Mã kế hoạch/nhóm: ${escape(data.caseTag||'Không gắn nhãn')}</p><h2>Mục tiêu</h2><div class="note">${escape(data.goal||'Chưa ghi')}</div><h2>Định hướng hỗ trợ</h2><div class="note">${escape(data.focus)}</div><h2>Danh sách công việc</h2><ul>${data.tasks.map(t=>`<li>${t.done?'☑':'☐'} ${escape(t.text)}${t.tags.length?' '+escape(t.tags.map(g=>'#'+g).join(' ')):''}${t.due?' · hạn '+escape(shortDate(t.due)):''}</li>`).join('')||'<li>Chưa có</li>'}</ul><h2>Ghi chú thực hiện</h2><div class="note">${escape(data.notes||'Chưa ghi')}</div><h2>Tệp tham khảo</h2><ul>${data.attachments.map(a=>`<li>${escape(a.name)}</li>`).join('')||'<li>Không có</li>'}</ul><h2>Đánh giá & điều chỉnh</h2><div class="note">${escape(data.review||'Chưa ghi')}</div><p class="meta">TICare Action — tài liệu hỗ trợ giáo dục, không phải kết luận y tế. Không đưa thông tin định danh hoặc sức khỏe học sinh vào kế hoạch.</p></body></html>`;
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
    {!reminderDismissed&&dueTotal>0&&<DueBanner summary={dueSummary} onOpen={openById} onEnableNotify={notificationsSupported()&&!notifyEnabled?enableDeadlineAlerts:undefined} onDismiss={()=>setReminderDismissed(true)}/>}
    {error&&<div className="action-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Đóng lỗi"><X size={16}/></button></div>}
    {view==='list'?<>
      <div className="action-stats"><div><strong>{counts.total}</strong><span>Tổng kế hoạch</span></div><div><strong>{counts.active}</strong><span>Đang thực hiện</span></div><div><strong>{counts.done}</strong><span>Đã hoàn thành</span></div></div>
      <div className="action-toolbar"><div className="action-search"><Search size={17}/><input aria-label="Tìm kế hoạch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc nhãn kế hoạch..."/></div><select aria-label="Lọc trạng thái" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="active">Đang thực hiện</option><option value="done">Hoàn thành</option></select><button className="action-primary" onClick={create}><Plus size={17}/> Tạo kế hoạch</button></div>
      {loading?<div className="action-empty">Đang tải kế hoạch...</div>:!visible.length?<div className="action-empty"><ClipboardList size={36}/><h3>{plans.length?'Không có kế hoạch phù hợp':'Chưa có kế hoạch nào'}</h3><p>Tạo một kế hoạch đầu tiên để bắt đầu đồng hành.</p><button className="action-primary" onClick={create}><Plus size={17}/> Tạo kế hoạch mới</button></div>:<div className="action-plan-grid">{visible.map(p=>{const tasks=p.plan?.tasks||[];const progress=tasks.length?Math.round(100*tasks.filter(t=>t.done).length/tasks.length):0;return <button className="action-plan-card" key={p.id} onClick={()=>show(p)}><div className="action-card-head"><span className={'action-status '+p.status}>{statuses[p.status]||'Bản nháp'}</span><span className="action-date"><Clock size={13}/> {new Date(p.updated_at).toLocaleDateString('vi-VN')}</span></div><h3>{p.title}</h3>{p.plan?.caseTag&&<span className="action-case-tag"><Tag size={12}/>{p.plan.caseTag}</span>}<p>{p.plan?.goal||'Chưa thêm mục tiêu'}</p><div className="action-progress"><span style={{width:progress+'%'}}/></div><small>{tasks.filter(t=>t.done).length}/{tasks.length} công việc · {progress}%</small>{p.plan?.endDate&&<span className={daysUntil(p.plan.endDate)<0&&p.status!=='done'?'action-due overdue':'action-due'}><CalendarClock size={13}/> {daysUntil(p.plan.endDate)<0&&p.status!=='done'?'Quá hạn · ':'Đến hạn · '}{shortDate(p.plan.endDate)}</span>}</button>})}</div>}
    </>:<>
      <div className="action-editor-head"><button className="action-back" type="button" onClick={back}><ArrowLeft size={17}/> Danh sách</button><div className="action-editor-actions">{selected&&<button className="action-danger" onClick={remove} disabled={saving}><Trash2 size={16}/> Xóa</button>}<button className="action-soft" onClick={printPlan}><Printer size={16}/> In / PDF</button><button className="action-primary" onClick={save} disabled={saving}><Save size={17}/>{saving?'Đang lưu...':dirty?'Lưu thay đổi':'Đã lưu'}</button></div></div>
      <div className="action-editor-grid"><div className="action-editor-main">
        <div className="action-panel"><h2><Pencil size={20}/> Thông tin kế hoạch</h2><label>Tên kế hoạch<input maxLength={120} value={draft.title} onChange={e=>update({title:e.target.value})} placeholder="Ví dụ: Xây dựng lớp học tôn trọng sự khác biệt"/></label><label>Mã/nhãn kế hoạch (không ghi tên học sinh)<input maxLength={40} value={draft.caseTag||''} onChange={e=>update({caseTag:e.target.value})} placeholder="Ví dụ: Nhóm A · Lớp 2"/></label><label>Mục tiêu giáo dục<textarea rows={3} maxLength={2000} value={draft.goal} onChange={e=>update({goal:e.target.value})} placeholder="Nêu mục tiêu học tập và môi trường lớp học, không nhập thông tin sức khỏe cá nhân"/></label><div className="action-field-row"><label>Cấp học / bối cảnh<input value={draft.classLevel} maxLength={80} onChange={e=>update({classLevel:e.target.value})}/></label><label>Trạng thái<select value={draft.status} onChange={e=>update({status:e.target.value})}>{Object.entries(statuses).map(([v,k])=><option value={v} key={v}>{k}</option>)}</select></label></div><div className="action-field-row"><label>Bắt đầu<input type="date" value={draft.startDate} onChange={e=>update({startDate:e.target.value})}/></label><label>Hạn hoàn thành / đánh giá<input type="date" value={draft.endDate} onChange={e=>update({endDate:e.target.value})}/></label></div><label>Định hướng hỗ trợ<textarea rows={3} maxLength={500} value={draft.focus} onChange={e=>update({focus:e.target.value})}/></label></div>
        <div className="action-panel"><h2><ClipboardCheck size={20}/> Công việc cần thực hiện <span className="action-count">{completion}%</span></h2><div className="action-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} aria-label="Tiến độ công việc"><span style={{width:completion+'%'}}/></div>
          {tagOptions.length>0&&<div className="action-tag-filter" aria-label="Lọc công việc theo nhãn"><button type="button" className={activeTag==='all'?'chosen':''} onClick={()=>setTagFilter('all')}>Tất cả</button>{tagOptions.map(g=><button type="button" key={g} className={activeTag===g?'chosen':''} onClick={()=>setTagFilter(activeTag===g?'all':g)}>#{g}</button>)}</div>}
          <div className="action-task-list">{shownTasks.map(t=>{const days=daysUntil(t.due);return <div key={t.id} className="action-task"><input type="checkbox" aria-label={'Hoàn thành '+t.text} checked={t.done} onChange={e=>patchTask(t.id,{done:e.target.checked})}/><div className="action-task-body"><span className={t.done?'completed':''}>{t.text}</span>{(t.tags.length>0||t.start||t.due)&&<div className="action-task-meta">{t.tags.map(g=><button type="button" className="action-chip" key={g} onClick={()=>setTagFilter(g)} title="Lọc theo nhãn này">#{g}</button>)}{(t.start||t.due)&&<em className={!t.done&&days!==null&&days<0?'action-chip-date overdue':'action-chip-date'}><CalendarClock size={12}/> {t.start?shortDate(t.start):'…'} – {t.due?shortDate(t.due):'…'}{!t.done&&days!==null&&days<0?' · quá hạn':''}</em>}</div>}</div><button type="button" title="Xóa công việc" aria-label={'Xóa công việc '+t.text} onClick={()=>update({tasks:draft.tasks.filter(x=>x.id!==t.id)})}><X size={16}/></button></div>})}{!draft.tasks.length&&<p className="action-muted">Chưa có công việc. Chọn biện pháp gợi ý hoặc tự thêm.</p>}{draft.tasks.length>0&&!shownTasks.length&&<p className="action-muted">Không có công việc nào mang nhãn này.</p>}</div>
          <div className="action-task-form"><div className="action-task-add"><input aria-label="Nội dung công việc" value={newTask} maxLength={LIMITS.taskText} onChange={e=>setNewTask(e.target.value)} placeholder="Thêm công việc cần làm" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTypedTask()}}}/><button type="button" onClick={addTypedTask}><Plus size={16}/> Thêm</button></div><div className="action-task-extra"><label>Nhãn (tối đa {LIMITS.tags}, cách nhau bằng dấu phẩy)<input maxLength={LIMITS.tags*(LIMITS.tagLen+2)} value={taskDraft.tags} onChange={e=>setTaskDraft(v=>({...v,tags:e.target.value}))} placeholder="Ví dụ: Lớp 2, Gia đình"/></label><label>Bắt đầu<input type="date" value={taskDraft.start} onChange={e=>setTaskDraft(v=>({...v,start:e.target.value}))}/></label><label>Hạn<input type="date" value={taskDraft.due} onChange={e=>setTaskDraft(v=>({...v,due:e.target.value}))}/></label></div></div></div>
        <div className="action-panel"><h2><NotebookPen size={20}/> Nhật ký & đánh giá</h2><label>Ghi chú quá trình thực hiện<textarea rows={5} maxLength={4000} value={draft.notes} onChange={e=>update({notes:e.target.value})} placeholder="Ghi nhận biện pháp đã thực hiện, khó khăn và cách xử lý (không nêu tên học sinh)."/></label><label>Đánh giá hiệu quả và hướng điều chỉnh<textarea rows={5} maxLength={4000} value={draft.review} onChange={e=>update({review:e.target.value})} placeholder="Ví dụ: Hoạt động nhóm giúp học sinh tham gia tự tin hơn; cần điều chỉnh thời lượng."/></label>
          <div className="action-attachments"><h3><Paperclip size={17}/> Tệp đính kèm trong ghi chú</h3><p className="action-muted">Chỉ dùng hình minh họa, tài liệu giáo dục không định danh. PNG/JPG/WEBP/PDF ≤ 5 MB. Lưu kế hoạch trước khi tải tệp.</p><label className="action-upload"> <UploadCloud size={17}/> {uploading?'Đang tải tệp...':'Thêm ảnh hoặc PDF'}<input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" disabled={!selected||dirty||uploading} onChange={uploadAttachment} hidden/></label>{!selected&&<p className="action-muted">Hãy lưu kế hoạch lần đầu để bật tải tệp.</p>}{dirty&&selected&&<p className="action-muted">Hãy lưu chỉnh sửa trước khi thêm hoặc gỡ tệp.</p>}
          <div className="action-file-grid">{(draft.attachments||[]).map(a=><div className="action-file" key={a.path}><AttachmentThumb attachment={a} url={attachmentUrls[a.path]} onOpen={previewAttachment}/><strong title={a.name}>{a.name}</strong><small>{formatSize(a.size)}</small><div><button type="button" onClick={()=>previewAttachment(a)}><Download size={14}/> {isImage(a)?'Xem ảnh lớn':'Mở PDF'}</button><button type="button" disabled={dirty||uploading} onClick={()=>deleteAttachment(a)} aria-label={'Xóa '+a.name}><Trash2 size={14}/></button></div></div>)}</div></div></div>
      </div><aside className="action-editor-side"><div className="action-panel"><h2><BookOpen size={19}/> Thư viện biện pháp</h2><p className="action-muted">Gợi ý giáo dục để tham khảo, không phải chẩn đoán hay chỉ định. Nhấn để đưa vào checklist; giáo viên tự đánh giá tính phù hợp.</p><div className="action-search action-library-search"><Search size={16}/><input aria-label="Tìm biện pháp" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Tìm biện pháp..."/></div><div className="action-library-tabs">{LIBRARY_GROUPS.map(g=><button type="button" key={g} className={libraryGroup===g?'chosen':''} onClick={()=>setLibraryGroup(g)}>{g}</button>)}</div>{!libraryItems.length&&<p className="action-muted">Không tìm thấy biện pháp phù hợp.</p>}{libraryItems.map(a=><div key={a.id} className="action-library-item"><small>{a.group}</small><strong>{a.title}</strong><p>{a.detail}</p><span className="action-source">Nguồn tham khảo chung: {a.source}</span><button type="button" disabled={draft.tasks.some(t=>t.text===a.title)||draft.tasks.length>=LIMITS.tasks} onClick={()=>addTask(a.title,{tags:[a.group]})}>{draft.tasks.some(t=>t.text===a.title)?<><Check size={15}/> Đã thêm</>:<><Plus size={15}/> Thêm vào kế hoạch</>}</button></div>)}</div></aside></div>
    </>}
    {lightbox&&<ImageModal url={lightbox.url} name={lightbox.name} onClose={()=>setLightbox(null)}/>}
    <p className="action-disclaimer">TICare Action hỗ trợ lập kế hoạch giáo dục, không chẩn đoán hoặc đề xuất điều trị. Kế hoạch chỉ được lưu khi nhấn “Lưu thay đổi”.</p>
  </section>;
}
