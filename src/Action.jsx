import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, CheckCircle2, CalendarDays, NotebookPen, Trash2, Printer, Save, BookOpen, ArrowLeft, ShieldCheck, Search, AlertTriangle, Pencil, Check, X, Clock, ClipboardCheck, BellRing, Image as ImageIcon, Paperclip, Download, Tag, UploadCloud, CalendarClock } from 'lucide-react';
import { supabase } from './supabase';
import './action.css';

// Dữ liệu mẫu chỉ là gợi ý giáo dục, không phải chỉ định điều trị.
const LIBRARY = [
  { id: 'respect', group: 'Môi trường lớp học', title: 'Thiết lập quy tắc tôn trọng khác biệt', detail: 'Thống nhất cách nói chuyện tử tế, không trêu chọc hoặc bắt chước những biểu hiện khác biệt.' },
  { id: 'privacy', group: 'Môi trường lớp học', title: 'Trao đổi riêng tư và tôn trọng', detail: 'Hỏi về những điều giúp việc học thuận lợi hơn; không yêu cầu công khai thông tin sức khỏe.' },
  { id: 'time', group: 'Điều chỉnh học tập', title: 'Linh hoạt thời gian và nhiệm vụ', detail: 'Cân nhắc chia nhiệm vụ thành các phần nhỏ hoặc cho thêm thời gian khi có nhu cầu thực tế.' },
  { id: 'participation', group: 'Điều chỉnh học tập', title: 'Đa dạng cách tham gia hoạt động', detail: 'Cho phép tham gia bằng nói, viết hoặc hoạt động nhóm phù hợp với điều kiện lớp.' },
  { id: 'support', group: 'Phối hợp', title: 'Thống nhất phương án hỗ trợ', detail: 'Trao đổi với gia đình và bộ phận hỗ trợ của trường khi cần, theo nguyên tắc bảo mật.' },
  { id: 'review', group: 'Đánh giá', title: 'Đánh giá lại hoạt động sau một thời gian', detail: 'Ghi nhận những thay đổi trong trải nghiệm học tập và mức độ tham gia; tránh đánh giá sức khỏe từ camera.' },
  { id: 'anti-bullying', group: 'Môi trường lớp học', title: 'Can thiệp khi có trêu chọc', detail: 'Dừng hành vi trêu chọc, nhắc quy tắc lớp và hỗ trợ người bị ảnh hưởng mà không công khai thông tin riêng.' },
  { id: 'class-activity', group: 'Giáo dục hòa nhập', title: 'Hoạt động về lời nói tử tế', detail: 'Thảo luận tình huống giả định, luyện cách nói tôn trọng với bạn bè khác biệt.' },
  { id: 'safe-space', group: 'Môi trường lớp học', title: 'Thiết lập kênh trao đổi kín', detail: 'Thống nhất một cách để học sinh bày tỏ nhu cầu hỗ trợ riêng tư với giáo viên.' },
  { id: 'breaks', group: 'Điều chỉnh học tập', title: 'Cho phép nghỉ ngắn khi phù hợp', detail: 'Xem xét nghỉ giải lao ngắn hoặc thay đổi nhịp hoạt động nếu giúp học sinh tham gia tốt hơn.' },
  { id: 'assignments', group: 'Điều chỉnh học tập', title: 'Chia bài tập thành các bước', detail: 'Dùng hướng dẫn ngắn, nhiệm vụ rõ ràng và phản hồi theo từng phần.' },
  { id: 'flex-assessment', group: 'Điều chỉnh học tập', title: 'Đa dạng cách hoàn thành bài', detail: 'Cho phép trình bày bằng nói hoặc viết theo mục tiêu môn học khi có thể.' },
  { id: 'peer-respect', group: 'Giáo dục hòa nhập', title: 'Bài học tôn trọng sự khác biệt', detail: 'Sử dụng tranh, thẻ tình huống và trò chơi về sự đồng cảm, không đưa học sinh cụ thể làm ví dụ.' },
  { id: 'seat', group: 'Điều chỉnh học tập', title: 'Lựa chọn chỗ ngồi phù hợp', detail: 'Thảo luận kín về bố trí chỗ ngồi giúp dễ tập trung, không tạo cảm giác bị tách biệt.' },
  { id: 'communication', group: 'Phối hợp', title: 'Chuẩn bị buổi trao đổi với gia đình', detail: 'Tập trung vào quan sát về việc học và nhu cầu hỗ trợ, tránh suy đoán y tế.' },
  { id: 'feedback', group: 'Đánh giá', title: 'Lấy phản hồi về trải nghiệm lớp học', detail: 'Hỏi về mức độ thoải mái, tham gia và kết quả của biện pháp giáo dục, không đoán tình trạng sức khỏe.' },
  { id: 'followup', group: 'Đánh giá', title: 'Đặt lịch xem lại kế hoạch', detail: 'Thống nhất mốc xem lại sau một khoảng thời gian phù hợp để điều chỉnh biện pháp.' }
];
const fresh = () => ({
  title: '', caseTag: '', goal: '', classLevel: 'Tiểu học', startDate: todayLocal(),
  endDate: '', status: 'draft', tasks: [], notes: '', attachments: [], review: '',
  focus: 'Tạo môi trường học tập tôn trọng, linh hoạt và an toàn.'
});
const statuses = {draft:'Bản nháp', active:'Đang thực hiện', done:'Đã hoàn thành'};
const todayLocal = () => { const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const daysUntil = (date) => {if(!date)return null; const now=new Date(todayLocal()+'T00:00:00');const end=new Date(date+'T00:00:00');return Math.round((end-now)/86400000);};
const shortDate = (s) => s ? new Date(s+'T00:00:00').toLocaleDateString('vi-VN') : 'Chưa đặt';
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const safeData = (x) => ({
  title: clean(x.title).slice(0,120), caseTag: clean(x.caseTag).slice(0,40), goal: clean(x.goal).slice(0,2000),
  classLevel: clean(x.classLevel).slice(0,80), startDate: x.startDate || '', endDate: x.endDate || '',
  status: ['draft','active','done'].includes(x.status) ? x.status : 'draft',
  focus: clean(x.focus).slice(0,500), notes: clean(x.notes).slice(0,4000), attachments: (Array.isArray(x.attachments)?x.attachments:[]).slice(0,15).filter(a=>typeof a.path==='string'&&typeof a.name==='string').map(a=>({path:a.path,name:a.name.slice(0,120),type:String(a.type||'').slice(0,80),size:Number(a.size)||0})), review: clean(x.review).slice(0,4000),
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
  const [attachmentUrls,setAttachmentUrls] = useState({});
  const [uploading,setUploading] = useState(false);
  const [libraryGroup,setLibraryGroup] = useState('Tất cả');
  const [notifyEnabled,setNotifyEnabled] = useState(false);
  const [reminderDismissed,setReminderDismissed] = useState(false);


  useEffect(() => {
    let alive = true;
    setPlans([]); setSelected(null);setDraft(fresh());setDirty(false);setView('list');setAttachmentUrls({});setReminderDismissed(false);
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
    `${p.title||''} ${p.plan?.caseTag||''}`.toLowerCase().includes(query.toLowerCase())
  ),[plans,filter,query]);
  const counts = useMemo(()=>({total:plans.length,active:plans.filter(p=>p.status==='active').length,done:plans.filter(p=>p.status==='done').length}),[plans]);
  const reminders = useMemo(()=>plans.filter(p=>p.status!=='done'&&p.plan?.endDate&&daysUntil(p.plan.endDate)<=3).sort((a,b)=>a.plan.endDate.localeCompare(b.plan.endDate)),[plans]);
  const completion = draft.tasks.length ? Math.round(100*draft.tasks.filter(t=>t.done).length/draft.tasks.length) : 0;
  const update = (patch)=>{setDraft(v=>({...v,...patch}));setDirty(true);};
  const show = (p) => {setAttachmentUrls({});setSelected(p.id);setDraft({...fresh(),...p.plan,title:p.title,status:p.status});setDirty(false);setError('');setView('edit');};
  const create = () => {setAttachmentUrls({});setSelected(null);setDraft(fresh());setDirty(true);setError('');setView('edit');};
  const back = ()=>{if(dirty && !window.confirm('Thay đổi chưa lưu sẽ bị mất. Quay lại?'))return;setView('list');setDirty(false);setSelected(null);setError('');};
  const addTask = (text) => {
    const val=clean(text);
    if (!val || draft.tasks.length>=40)return;
    update({tasks:[...draft.tasks,{id:crypto.randomUUID(),text:val.slice(0,500),done:false}]});
    setNewTask('');
  };

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
    if(!('Notification' in window)){notify('Trình duyệt không hỗ trợ thông báo hệ thống. Nhắc hạn vẫn hiển thị trong TICare.');return;}
    const perm=await Notification.requestPermission();
    setNotifyEnabled(perm==='granted');
    notify(perm==='granted'?'Đã bật nhắc hạn khi TICare đang mở.':'Chưa cấp quyền thông báo; nhắc hạn vẫn hiện trên trang.');
  }
  useEffect(()=>{
    if(!notifyEnabled||!user?.id||!reminders.length||document.hidden||Notification.permission!=='granted')return;
    const key=`ticare-action-alert-${user.id}-${todayLocal()}`;
    if(sessionStorage.getItem(key))return;
    sessionStorage.setItem(key,'1');
    try{new Notification('TICare Action · Nhắc thời hạn',{body:`Có ${reminders.length} kế hoạch sắp đến hạn hoặc quá hạn.`,tag:'ticare-action-deadline'});}catch(e){console.warn(e);}
  },[notifyEnabled,user?.id,reminders]);

  async function previewAttachment(a){
    if(!supabase||!user?.id||!selected)return;
    const external=!a.type.startsWith('image/');
    const newTab=external?window.open('about:blank','_blank'):null;
    try{
      const {data,error}=await supabase.storage.from('action-notes').createSignedUrl(a.path,600);
      if(error)throw error;
      setAttachmentUrls(old=>({...old,[a.path]:data.signedUrl}));
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
    const path=`${user.id}/${selected}/${crypto.randomUUID()}.${ext}`;
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
    const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(data.title)}</title><style>body{font:15px/1.65 Arial,sans-serif;max-width:800px;margin:35px auto;color:#19383a}h1{color:#087c70;font-size:26px}h2{font-size:18px;margin-top:25px;border-bottom:1px solid #bddcd6}.meta{color:#50666a}li{padding:4px 0}.note{white-space:pre-wrap;background:#f1f8f5;padding:12px;border-radius:8px}@media print{body{margin:15mm}}</style></head><body><h1>${escape(data.title)}</h1><p class="meta">${escape(data.classLevel)} · ${escape(shortDate(data.startDate))} – ${escape(shortDate(data.endDate))} · ${escape(statuses[data.status])}</p><p class="meta">Mã kế hoạch/nhóm: ${escape(data.caseTag||'Không gắn nhãn')}</p><h2>Mục tiêu</h2><div class="note">${escape(data.goal||'Chưa ghi')}</div><h2>Định hướng hỗ trợ</h2><div class="note">${escape(data.focus)}</div><h2>Danh sách công việc</h2><ul>${data.tasks.map(t=>`<li>${t.done?'☑':'☐'} ${escape(t.text)}</li>`).join('')||'<li>Chưa có</li>'}</ul><h2>Ghi chú thực hiện</h2><div class="note">${escape(data.notes||'Chưa ghi')}</div><h2>Tệp tham khảo</h2><ul>${data.attachments.map(a=>`<li>${escape(a.name)}</li>`).join('')||'<li>Không có</li>'}</ul><h2>Đánh giá & điều chỉnh</h2><div class="note">${escape(data.review||'Chưa ghi')}</div><p class="meta">TICare Action — tài liệu hỗ trợ giáo dục, không phải kết luận y tế. Không đưa thông tin định danh hoặc sức khỏe học sinh vào kế hoạch.</p></body></html>`;
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
    {!reminderDismissed&&reminders.length>0&&<div className="action-deadlines" role="status"><div><BellRing size={20}/><strong>{reminders.length} kế hoạch cần chú ý thời hạn</strong><button type="button" className="action-notify-toggle" onClick={enableDeadlineAlerts}>Bật thông báo trình duyệt</button><button type="button" className="action-deadline-close" onClick={()=>setReminderDismissed(true)} aria-label="Ẩn nhắc hạn"><X size={16}/></button></div><ul>{reminders.slice(0,5).map(p=><li key={p.id}><button type="button" onClick={()=>show(p)}>{p.title}</button><span>{daysUntil(p.plan.endDate)<0?`Quá hạn ${-daysUntil(p.plan.endDate)} ngày`:daysUntil(p.plan.endDate)===0?'Hôm nay':`Còn ${daysUntil(p.plan.endDate)} ngày`}</span></li>)}</ul><small>Nhắc hạn trong ứng dụng. Thông báo hệ thống chỉ hoạt động khi TICare đang mở; không gửi khi đã đóng trang.</small></div>}
    {error&&<div className="action-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Đóng lỗi"><X size={16}/></button></div>}
    {view==='list'?<>
      <div className="action-stats"><div><strong>{counts.total}</strong><span>Tổng kế hoạch</span></div><div><strong>{counts.active}</strong><span>Đang thực hiện</span></div><div><strong>{counts.done}</strong><span>Đã hoàn thành</span></div></div>
      <div className="action-toolbar"><div className="action-search"><Search size={17}/><input aria-label="Tìm kế hoạch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc nhãn kế hoạch..."/></div><select aria-label="Lọc trạng thái" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="active">Đang thực hiện</option><option value="done">Hoàn thành</option></select><button className="action-primary" onClick={create}><Plus size={17}/> Tạo kế hoạch</button></div>
      {loading?<div className="action-empty">Đang tải kế hoạch...</div>:!visible.length?<div className="action-empty"><ClipboardList size={36}/><h3>{plans.length?'Không có kế hoạch phù hợp':'Chưa có kế hoạch nào'}</h3><p>Tạo một kế hoạch đầu tiên để bắt đầu đồng hành.</p><button className="action-primary" onClick={create}><Plus size={17}/> Tạo kế hoạch mới</button></div>:<div className="action-plan-grid">{visible.map(p=>{const tasks=p.plan?.tasks||[];const progress=tasks.length?Math.round(100*tasks.filter(t=>t.done).length/tasks.length):0;return <button className="action-plan-card" key={p.id} onClick={()=>show(p)}><div className="action-card-head"><span className={'action-status '+p.status}>{statuses[p.status]||'Bản nháp'}</span><span className="action-date"><Clock size={13}/> {new Date(p.updated_at).toLocaleDateString('vi-VN')}</span></div><h3>{p.title}</h3>{p.plan?.caseTag&&<span className="action-case-tag"><Tag size={12}/>{p.plan.caseTag}</span>}<p>{p.plan?.goal||'Chưa thêm mục tiêu'}</p><div className="action-progress"><span style={{width:progress+'%'}}/></div><small>{tasks.filter(t=>t.done).length}/{tasks.length} công việc · {progress}%</small>{p.plan?.endDate&&<span className={daysUntil(p.plan.endDate)<0&&p.status!=='done'?'action-due overdue':'action-due'}><CalendarClock size={13}/> {daysUntil(p.plan.endDate)<0&&p.status!=='done'?'Quá hạn · ':'Đến hạn · '}{shortDate(p.plan.endDate)}</span>}</button>})}</div>}
    </>:<>
      <div className="action-editor-head"><button className="action-back" type="button" onClick={back}><ArrowLeft size={17}/> Danh sách</button><div className="action-editor-actions">{selected&&<button className="action-danger" onClick={remove} disabled={saving}><Trash2 size={16}/> Xóa</button>}<button className="action-soft" onClick={printPlan}><Printer size={16}/> In / PDF</button><button className="action-primary" onClick={save} disabled={saving}><Save size={17}/>{saving?'Đang lưu...':dirty?'Lưu thay đổi':'Đã lưu'}</button></div></div>
      <div className="action-editor-grid"><div className="action-editor-main">
        <div className="action-panel"><h2><Pencil size={20}/> Thông tin kế hoạch</h2><label>Tên kế hoạch<input maxLength={120} value={draft.title} onChange={e=>update({title:e.target.value})} placeholder="Ví dụ: Xây dựng lớp học tôn trọng sự khác biệt"/></label><label>Mã/nhãn kế hoạch (không ghi tên học sinh)<input maxLength={40} value={draft.caseTag||''} onChange={e=>update({caseTag:e.target.value})} placeholder="Ví dụ: Nhóm A · Lớp 2"/></label><label>Mục tiêu giáo dục<textarea rows={3} maxLength={2000} value={draft.goal} onChange={e=>update({goal:e.target.value})} placeholder="Nêu mục tiêu học tập và môi trường lớp học, không nhập thông tin sức khỏe cá nhân"/></label><div className="action-field-row"><label>Cấp học / bối cảnh<input value={draft.classLevel} maxLength={80} onChange={e=>update({classLevel:e.target.value})}/></label><label>Trạng thái<select value={draft.status} onChange={e=>update({status:e.target.value})}>{Object.entries(statuses).map(([v,k])=><option value={v} key={v}>{k}</option>)}</select></label></div><div className="action-field-row"><label>Bắt đầu<input type="date" value={draft.startDate} onChange={e=>update({startDate:e.target.value})}/></label><label>Hạn hoàn thành / đánh giá<input type="date" value={draft.endDate} onChange={e=>update({endDate:e.target.value})}/></label></div><label>Định hướng hỗ trợ<textarea rows={3} maxLength={500} value={draft.focus} onChange={e=>update({focus:e.target.value})}/></label></div>
        <div className="action-panel"><h2><ClipboardCheck size={20}/> Công việc cần thực hiện <span className="action-count">{completion}%</span></h2><div className="action-progress"><span style={{width:completion+'%'}}/></div><div className="action-task-list">{draft.tasks.map(t=><div key={t.id} className="action-task"><input type="checkbox" aria-label={'Hoàn thành '+t.text} checked={t.done} onChange={e=>update({tasks:draft.tasks.map(x=>x.id===t.id?{...x,done:e.target.checked}:x)})}/><span className={t.done?'completed':''}>{t.text}</span><button type="button" title="Xóa công việc" onClick={()=>update({tasks:draft.tasks.filter(x=>x.id!==t.id)})}><X size={16}/></button></div>)}{!draft.tasks.length&&<p className="action-muted">Chưa có công việc. Chọn biện pháp gợi ý hoặc tự thêm.</p>}</div><div className="action-task-add"><input value={newTask} maxLength={500} onChange={e=>setNewTask(e.target.value)} placeholder="Thêm công việc cần làm" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTask(newTask)}}}/><button type="button" onClick={()=>addTask(newTask)}><Plus size={16}/> Thêm</button></div></div>
        <div className="action-panel"><h2><NotebookPen size={20}/> Nhật ký & đánh giá</h2><label>Ghi chú quá trình thực hiện<textarea rows={5} maxLength={4000} value={draft.notes} onChange={e=>update({notes:e.target.value})} placeholder="Ghi nhận biện pháp đã thực hiện, khó khăn và cách xử lý (không nêu tên học sinh)."/></label><label>Đánh giá hiệu quả và hướng điều chỉnh<textarea rows={5} maxLength={4000} value={draft.review} onChange={e=>update({review:e.target.value})} placeholder="Ví dụ: Hoạt động nhóm giúp học sinh tham gia tự tin hơn; cần điều chỉnh thời lượng."/></label>
          <div className="action-attachments"><h3><Paperclip size={17}/> Tệp đính kèm trong ghi chú</h3><p className="action-muted">Chỉ dùng hình minh họa, tài liệu giáo dục không định danh. PNG/JPG/WEBP/PDF ≤ 5 MB. Lưu kế hoạch trước khi tải tệp.</p><label className="action-upload"> <UploadCloud size={17}/> {uploading?'Đang tải tệp...':'Thêm ảnh hoặc PDF'}<input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" disabled={!selected||dirty||uploading} onChange={uploadAttachment} hidden/></label>{!selected&&<p className="action-muted">Hãy lưu kế hoạch lần đầu để bật tải tệp.</p>}{dirty&&selected&&<p className="action-muted">Hãy lưu chỉnh sửa trước khi thêm hoặc gỡ tệp.</p>}
          <div className="action-file-grid">{(draft.attachments||[]).map(a=><div className="action-file" key={a.path}>{a.type.startsWith('image/')&&attachmentUrls[a.path]?<img src={attachmentUrls[a.path]} alt={'Ảnh minh họa: '+a.name} loading="lazy"/>:<div className="action-file-placeholder"><ImageIcon size={28}/><span>{a.type.startsWith('image/')?'Nhấn Xem để tải ảnh':'Tài liệu PDF'}</span></div>}<strong title={a.name}>{a.name}</strong><div><button type="button" onClick={()=>previewAttachment(a)}><Download size={14}/> {a.type.startsWith('image/')?'Xem ảnh':'Mở PDF'}</button><button type="button" disabled={dirty||uploading} onClick={()=>deleteAttachment(a)} aria-label={'Xóa '+a.name}><Trash2 size={14}/></button></div></div>)}</div></div></div>
      </div><aside className="action-editor-side"><div className="action-panel"><h2><BookOpen size={19}/> Thư viện biện pháp</h2><p className="action-muted">Nhấn để đưa biện pháp vào checklist; giáo viên tự đánh giá tính phù hợp.</p><div className="action-library-tabs">{['Tất cả',...new Set(LIBRARY.map(a=>a.group))].map(g=><button type="button" key={g} className={libraryGroup===g?'chosen':''} onClick={()=>setLibraryGroup(g)}>{g}</button>)}</div>{LIBRARY.filter(a=>libraryGroup==='Tất cả'||a.group===libraryGroup).map(a=><div key={a.id} className="action-library-item"><small>{a.group}</small><strong>{a.title}</strong><p>{a.detail}</p><button type="button" disabled={draft.tasks.some(t=>t.text===a.title)||draft.tasks.length>=40} onClick={()=>addTask(a.title)}>{draft.tasks.some(t=>t.text===a.title)?<><Check size={15}/> Đã thêm</>:<><Plus size={15}/> Thêm vào kế hoạch</>}</button></div>)}</div></aside></div>
    </>}
    <p className="action-disclaimer">TICare Action hỗ trợ lập kế hoạch giáo dục, không chẩn đoán hoặc đề xuất điều trị. Kế hoạch chỉ được lưu khi nhấn “Lưu thay đổi”.</p>
  </section>;
}
