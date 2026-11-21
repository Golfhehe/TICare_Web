import React,{useState,useEffect,useRef,useCallback} from 'react';
import {ClipboardList,HeartHandshake,LayoutDashboard,ScanEye,UsersRound,Bot,GraduationCap,HandHeart,Settings,Search,Plus,Menu,X,LogIn,LogOut,UserRound,FileText,Paperclip,MessageCircle,Bookmark,Flag,Send,ArrowRight,ArrowLeft,CheckCircle2,ShieldCheck,BookOpen,Camera,CameraOff,Activity,AlertTriangle,Download,ExternalLink,ChevronRight,Trash2,Heart,Info,Eye,Lock,Clock,UploadCloud,LoaderCircle,RefreshCcw,Bell,BellRing} from 'lucide-react';
import{LESSONS,SOURCES,SUGGESTIONS,QUESTION_BANK,TOPIC_GROUPS}from './data';import{supabase,live}from './supabase';
import Action from './Action';import Assistant from './assistant/Assistant';
import MyResources from './education/MyResources';import ReviewPanel from './education/ReviewPanel';
import{ageLabel as eduAgeLabel,kindLabel as eduKindLabel,kindIcon as eduKindIcon,openResource as eduOpenResource}from'./education/resourceUtils';import{EDU_TAGS,tagLabel}from'./lib/eduTags';
const EducationStudio=React.lazy(()=>import('./EducationStudio.jsx'));
import Modal from'./components/Modal';import Privacy from'./pages/Privacy';import Home from'./home/Home';import Motion from'./motion/Motion';import{mutate}from'./lib/db';import{uid}from'./lib/uid';import{authErrorMessage}from'./lib/authErrors';
const NAV=[{id:'home',label:'Tổng quan',icon:LayoutDashboard},{id:'motion',label:'Quan sát vận động',icon:ScanEye},{id:'community',label:'Cộng đồng giáo dục',icon:UsersRound},{id:'assistant',label:'Trợ lý thông tin AI',icon:Bot},{id:'education',label:'TICare Education',icon:GraduationCap},{id:'action',label:'TICare Action',icon:ClipboardList}];
const fmt=t=>new Date(t).toLocaleDateString('vi-VN');
function App(){const[page,setPage]=useState('home'),[drawer,setDrawer]=useState(false),[user,setUser]=useState(null),[authOpen,setAuthOpen]=useState(false),[toast,setToast]=useState(''),[posts,setPosts]=useState([]),[saved,setSaved]=useState([]),[role,setRole]=useState('member'),[profile,setProfile]=useState(null),[profileOpen,setProfileOpen]=useState(false),[communityView,setCommunityView]=useState('all'),[loading,setLoading]=useState(false),[assistantSeed,setAssistantSeed]=useState(null),[actionSeed,setActionSeed]=useState(null);
const [resetOpen, setResetOpen] = useState(false);
useEffect(() => {
  if (!supabase) {
    setUser(null);
    return;
  }

  let mounted = true;

  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setAuthOpen(false);
        setResetOpen(true);
      }
    });


  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);

// Hồ sơ và danh sách đã lưu phụ thuộc vào tài khoản đang đăng nhập.
useEffect(() => {
  let valid = true;
  setRole('member');
  setProfile(null);
  setSaved([]);
  if (!supabase || !user?.id) return;
  async function loadAccountData() {
    const [profile, favorites] = await Promise.all([
      supabase.from('profiles').select('id,role,display_name').eq('id', user.id).maybeSingle(),
      supabase.from('saved_posts').select('post_id').eq('user_id', user.id)
    ]);
    if (!valid) return;
    if (profile.error) console.error('Lỗi tải quyền:', profile.error);
    if (favorites.error) console.error('Lỗi tải bài đã lưu:', favorites.error);
    setRole(profile.data?.role === 'admin' ? 'admin' : 'member');
    setProfile(profile.data || null);
    setSaved((favorites.data || []).map(item => item.post_id));
  }
  loadAccountData();
  return () => { valid = false; };
}, [user?.id]);
const[motionRunning,setMotionRunning]=useState(false),[motionEvents,setMotionEvents]=useState([]),[motionPanel,setMotionPanel]=useState(false),[motionStopToken,setMotionStopToken]=useState(0);
const onMotionEvent=useCallback((entry)=>{setMotionEvents(old=>[entry,...old].slice(0,30));setMotionPanel(false)},[]);
const toastTimer=useRef(null);const notify=(m)=>{setToast(m);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4200)};
const go=(p)=>{setPage(p);setDrawer(false);window.scrollTo({top:0,behavior:'smooth'})};const goTo=(p,seed)=>{if(p==='assistant')setAssistantSeed(typeof seed==='string'?seed:null);if(p==='action')setActionSeed(seed&&typeof seed==='object'?seed:null);go(p)};

const signOut = async () => {
  if (!supabase) {
    notify("Hệ thống xác thực chưa được kết nối.");
    return;
  }

  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setMotionStopToken(t => t + 1);
    setUser(null);
    if(page==='admin') setPage('community');
    notify("Đã đăng xuất thành công.");
  } catch (error) {
    console.error("TICare signOut:", error);
    notify("Không thể đăng xuất: " + error.message);
  }
};

const requireAuth = () => {
  if (user && supabase) return true;
  setAuthOpen(true);
  notify('Hãy đăng nhập để sử dụng tính năng cộng đồng.');
  return false;
};

async function loadPosts() {
  if (!supabase) { setPosts([]); return; }
  const { data, error } = await supabase
    .from('posts')
    .select('*,post_attachments(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.error(error); notify('Lỗi tải bài viết: ' + error.message); return; }
  const ids = [...new Set((data || []).map(p => p.author_id).filter(Boolean))];
  let names = {};
  if (ids.length) {
    const result = await supabase.from('profiles').select('id,display_name').in('id', ids);
    if (result.error) console.warn('Không tải được tên tác giả:', result.error);
    names = Object.fromEntries((result.data || []).map(p => [p.id, p.display_name]));
  }
  setPosts((data || []).map(p => ({
    ...p,
    author: names[p.author_id] || 'Thành viên',
    attachment: p.post_attachments?.[0] || null
  })));
}
useEffect(() => { if (supabase) loadPosts(); else setPosts([]); }, []);

async function addPost(payload, file) {
  if (!requireAuth()) return false;
  if (file && file.size > 8 * 1024 * 1024) {
    notify('Tệp đính kèm không được vượt quá 8 MB.');
    return false;
  }
  setLoading(true);
  let createdPostId = null, uploadedPath = null;
  try {
    const { data, error } = await supabase.from('posts').insert({
      author_id: user.id,
      title: payload.title,
      body: payload.body,
      category: payload.category
    }).select().single();
    if (error) throw error;
    createdPostId = data.id;
    if (file) {
      const path = `${user.id}/${data.id}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      uploadedPath = path;
      const upload = await supabase.storage.from('community-files').upload(path, file, { upsert: false });
      if (upload.error) throw upload.error;
      const attachment = await supabase.from('post_attachments').insert({
        post_id: data.id, storage_path: path, filename: file.name,
        mime_type: file.type, size_bytes: file.size
      });
      if (attachment.error) throw attachment.error;
    }
    createdPostId = null; uploadedPath = null; // post is complete: never roll back after this point
    await loadPosts();
    notify('Đăng bài thành công!');
    return true;
  } catch (error) {
    console.error('Đăng bài:', error);
    // Roll back so a retry does not create a duplicate post / orphan file.
    if (uploadedPath) {
      try { const r = await supabase.storage.from('community-files').remove([uploadedPath]); if (r.error) console.warn('Dọn file lỗi:', r.error); } catch (e) { console.warn('Dọn file lỗi:', e); }
    }
    if (createdPostId) {
      try { const r = await supabase.from('posts').delete().eq('id', createdPostId); if (r.error) console.warn('Dọn bài lỗi:', r.error); } catch (e) { console.warn('Dọn bài lỗi:', e); }
    }
    notify('Không thể đăng bài: ' + error.message);
    return false;
  } finally { setLoading(false); }
}

async function updatePost(id, payload) {
  if (!requireAuth()) return false;
  const old = posts.find(p => p.id === id);
  if (!old || old.author_id !== user.id || old.status !== 'published') {
    notify('Chỉ sửa được bài đang công khai của chính bạn.'); return false;
  }
  try {
    await mutate(supabase.from('posts').update({
      title: payload.title.trim(), body: payload.body.trim(), category: payload.category
    }).eq('id', id).eq('author_id', user.id).eq('status','published'));
  } catch (error) { notify('Không thể sửa bài: ' + error.message); return false; }
  await loadPosts(); notify('Đã cập nhật bài viết.'); return true;
}

async function updateProfile(displayName) {
  if (!requireAuth()) return false;
  const clean = displayName.trim();
  if (!clean || clean.length > 60) { notify('Tên hiển thị phải từ 1 đến 60 ký tự.'); return false; }
  try {
    await mutate(supabase.from('profiles').update({ display_name: clean }).eq('id', user.id));
  } catch (error) { notify('Không thể sửa tên: ' + error.message); return false; }
  setProfile(old => ({ ...old, display_name: clean }));
  await loadPosts();
  notify('Đã cập nhật tên hiển thị.'); return true;
}

async function addComment(id, body) {
  if (!requireAuth()) return false;
  if (!body.trim() || body.length > 3000) return false;
  const { error } = await supabase.from('comments').insert({
    post_id: id, author_id: user.id, body: body.trim()
  });
  if (error) { notify('Không thể bình luận: ' + error.message); return false; }
  notify('Đã gửi bình luận.');
  return true;
}

async function reportPost(id, reason) {
  if (!requireAuth()) return false;
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id, post_id: id, reason
  });
  if (error) { notify('Không thể gửi báo cáo: ' + error.message); return false; }
  notify('Báo cáo đã được gửi tới quản trị viên.');
  return true;
}

async function toggleSaved(id) {
  if (!requireAuth()) return;
  const already = saved.includes(id);
  try {
    if (already) await mutate(supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', id), { key: 'post_id' });
    else { const result = await supabase.from('saved_posts').insert({ user_id: user.id, post_id: id }); if (result.error) throw result.error; }
  } catch (error) { notify('Lỗi lưu bài: ' + error.message); return; }
  setSaved(old => already ? old.filter(x => x !== id) : [...old, id]);
  notify(already ? 'Đã bỏ lưu bài viết.' : 'Đã lưu bài viết vào tài khoản.');
}

async function removePost(id) {
  if (!requireAuth()) return;
  if (!window.confirm('Xóa bài viết này?')) return;
  try {
    await mutate(supabase.from('posts').update({status:'removed'}).eq('id', id).eq('author_id',user.id).eq('status','published'));
  } catch (error) { notify('Không thể xóa bài: ' + error.message); return; }
  await loadPosts();
  notify('Đã xóa bài viết.');
}
const navItems = role === 'admin'
  ? [...NAV, { id: 'admin', label: 'Quản trị báo cáo', icon: ShieldCheck }]
  : NAV;
const current = navItems.find(n => n.id === page) || (page === 'privacy' ? { label: 'Quyền riêng tư & đồng thuận' } : undefined);
return <div className={'app'+(motionRunning?' motion-running':'')}><aside className={'sidebar '+(drawer?'open':'')}><button type="button" className="brand" aria-label="TICare — về trang chủ" onClick={()=>go('home')}><div className="brand-icon"><HeartHandshake size={24}/></div><div><b><span className="brand-tic">TIC</span>are<span>.</span></b><small>HIỂU ĐÚNG ĐỂ ĐỒNG HÀNH</small></div></button><div className="side-label">KHÔNG GIAN LÀM VIỆC</div><nav>{navItems.map(n=><button key={n.id} className={'nav-link '+(page===n.id?'active':'')} onClick={()=>go(n.id)}><n.icon size={19}/><span>{n.label}</span>{page===n.id&&<span className="active-dot"/>}</button>)}</nav><div className="side-bottom"><div className="privacy-note"><ShieldCheck size={20}/><div><b>Tôn trọng sự khác biệt</b><small>Không chẩn đoán y tế. Không lưu video camera mặc định.</small></div></div><button type="button" className="side-privacy-link" onClick={()=>go('privacy')}>Quyền riêng tư &amp; đồng thuận</button><div className="sidebar-version">TICare • Cộng đồng giáo dục</div></div></aside>{drawer&&<div className="shade" aria-hidden="true" onClick={()=>setDrawer(false)}/>}
<div className="workspace"><header className="topbar"><button type="button" className="icon-button mobile-menu" aria-label="Mở menu điều hướng" aria-expanded={drawer} onClick={()=>setDrawer(true)}><Menu size={22}/></button><div className="breadcrumbs"><span>Không gian <b className="brand-tic">TIC</b>are</span><ChevronRight size={15}/><strong>{current?.label}</strong></div><div className="top-actions">{motionRunning&&<button className="btn btn-outline small" onClick={()=>go('motion')}><Camera size={15}/> Đang quan sát</button>}<button type="button" className="icon-button" title="Thông báo Motion Insight" aria-label={'Thông báo Motion Insight'+(motionEvents.length?' ('+motionEvents.length+' mới)':'')} aria-expanded={motionPanel} onClick={()=>setMotionPanel(v=>!v)}><Bell size={19}/>{motionEvents.length>0&&<span className="motion-count">{motionEvents.length}</span>}</button><span className={'mode-pill '+(live?'online':'')}><span className="status-dot"/>{live?'Đã cấu hình Supabase':'Chưa cấu hình Supabase'}</span>{user?<><button type="button" className="icon-button" title="Hồ sơ cá nhân" aria-label="Hồ sơ cá nhân" onClick={()=>setProfileOpen(true)}><UserRound size={19}/></button><button type="button" className="account" aria-label="Đăng xuất" onClick={signOut}><UserRound size={17}/><span>{profile?.display_name||user.user_metadata?.display_name||user.email?.split('@')[0]}</span><LogOut size={15}/></button></>:<button className="btn btn-outline small" onClick={()=>setAuthOpen(true)}><LogIn size={16}/> Đăng nhập</button>}</div></header>
<main className="main">{page==='home'&&<Home go={go} goTo={goTo} posts={posts} user={user}/>}<div className={page==='motion'?'motion-page is-visible':'motion-page'} style={{display:page==='motion'?'block':'none'}}><Motion active={page==='motion'} user={user} notify={notify} openAuth={()=>setAuthOpen(true)} onRunningChange={setMotionRunning} onMotionEvent={onMotionEvent} stopToken={motionStopToken} onAskAssistant={q=>goTo('assistant',q)} onCreatePlan={p=>goTo('action',p)} onOpenPrivacy={()=>go('privacy')}/></div>{page==='community'&&<Community posts={posts} user={user} initialView={communityView} onPost={addPost} onComment={addComment} onReport={reportPost} onRemove={removePost} onEditPost={updatePost} onOpenProfile={()=>setProfileOpen(true)} requireAuth={requireAuth} saved={saved} onToggleSave={toggleSaved} loading={loading} notify={notify}/ >}{page==='privacy'&&<Privacy go={go}/>}{page==='admin'&&role==='admin'&&<AdminPanel notify={notify} user={user} onRefreshPosts={loadPosts}/ >}{page==='assistant'&&<Assistant user={user} notify={notify} seed={assistantSeed} onSeedUsed={()=>setAssistantSeed(null)}/ >}{page==='education'&&<Education user={user} role={role} notify={notify} openAuth={()=>setAuthOpen(true)}/>}
{page==='action'&&<Action user={user} notify={notify} openAuth={()=>setAuthOpen(true)} seed={actionSeed} onSeedUsed={()=>setActionSeed(null)}/>}</main>{motionPanel&&<section className="motion-notification-panel"><div className="motion-notification-head"><b>Thông báo Motion Insight</b><button className="icon-button" onClick={()=>setMotionPanel(false)} aria-label="Đóng thông báo"><X size={17}/></button></div>{motionEvents.length===0?<p>Chưa có thông báo trong phiên này.</p>:<>{motionEvents.map(e=><div className={"motion-event "+e.level} key={e.id}><strong>Phát hiện cử động · {e.channel||'Tín hiệu'}</strong><small>{new Date(e.time).toLocaleTimeString('vi-VN')} · {e.detail}</small><p>Kết quả quan sát, không phải chẩn đoán.</p></div>)}<button className="btn btn-outline small" onClick={()=>setMotionEvents([])}>Xóa lịch sử phiên</button></>}</section>}<footer className="footer">© 2026 TICare · Nền tảng thông tin và hỗ trợ giáo viên · Không thay thế đánh giá chuyên môn y tế · <button type="button" className="footer-link" onClick={()=>go('privacy')}>Quyền riêng tư &amp; đồng thuận</button></footer></div><nav className="mobile-bottom-nav" aria-label="Điều hướng TICare trên điện thoại">{NAV.map(n=><button type="button" key={n.id} className={page===n.id?"active":""} onClick={()=>go(n.id)} aria-current={page===n.id?"page":undefined}><n.icon size={20}/><span>{n.id==="home"?"Trang chủ":n.id==="motion"?"Motion":n.id==="community"?"Cộng đồng":n.id==="assistant"?"Chatbot":n.id==="action"?"Action":"Học liệu"}</span></button>)}</nav>{authOpen&&<AuthModal onClose={()=>setAuthOpen(false)} onSuccess={u=>{setUser(u);setAuthOpen(false);notify('Đăng nhập thành công!')}} notify={notify}/ >}{profileOpen&&user&&<ProfileModal profile={profile} user={user} posts={posts} saved={saved} onClose={()=>setProfileOpen(false)} onUpdate={updateProfile} onGoMyPosts={()=>{setProfileOpen(false);setCommunityView('mine');go('community');}}/>}{resetOpen&&<ResetPasswordModal onClose={()=>setResetOpen(false)} notify={notify}/>}{toast&&<div className="toast"><Info size={18}/>{toast}<button type="button" onClick={()=>setToast('')} aria-label="Đóng thông báo"><X size={16}/></button></div>}</div>}
function Heading({eyebrow,title,desc,action}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{desc&&<p>{desc}</p>}</div>{action}</div>}

function AuthModal({ onClose, onSuccess, notify, initialTab = "login" }) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function changeTab(next) {
    setTab(next);
    setMessage("");
    setSuccess(false);
    setPassword("");
    setConfirmPassword("");
  }

  function getErrorMessage(error) {
    return authErrorMessage(error);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      if (!supabase) {
        throw new Error(
          "Hệ thống tài khoản chưa được cấu hình. Vui lòng liên hệ quản trị viên TICare."
        );
      }

      const cleanEmail = email.trim().toLowerCase();

      if (tab === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo: window.location.origin + "/"
          }
        );

        if (error) throw error;

        setSuccess(true);
        setMessage(
          "Nếu email có tài khoản, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu. Hãy kiểm tra cả thư mục Spam."
        );
        return;
      }

      if (tab === "register") {
        if (!name.trim()) {
          throw new Error("Vui lòng nhập tên hiển thị.");
        }

        if (password.length < 8) {
          throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");
        }

        if (password !== confirmPassword) {
          throw new Error("Hai mật khẩu không khớp.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: name.trim()
            },
            emailRedirectTo: window.location.origin + "/"
          }
        });

        if (error) throw error;

        if (data.session && data.user) {
          onSuccess(data.user);
          return;
        }

        setSuccess(true);
        setPassword("");
        setConfirmPassword("");
        setMessage(
          "Yêu cầu đăng ký đã được tiếp nhận. Nếu cần xác nhận email, hãy mở liên kết được gửi tới hộp thư trước khi đăng nhập."
        );
        return;
      }

      if (tab === "login") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

        if (error) throw error;

        if (!data.user || !data.session) {
          throw new Error(
            "Không nhận được phiên đăng nhập hợp lệ."
          );
        }

        onSuccess(data.user);
      }
    } catch (error) {
      console.error("TICare Auth:", error);
      setSuccess(false);
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} dismissible={!busy} className="auth-modal" labelledBy="auth-title">
        <button
          type="button"
          className="close"
          onClick={onClose}
          disabled={busy}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>

        <div className="auth-logo">
          <HeartHandshake size={28} />
        </div>

        <h2 id="auth-title">
          {tab === "register"
            ? "Tạo tài khoản TICare"
            : tab === "forgot"
              ? "Khôi phục mật khẩu"
              : "Chào mừng trở lại"}
        </h2>

        <p>
          {tab === "register"
            ? "Tham gia cộng đồng giáo dục và lan tỏa sự thấu hiểu."
            : tab === "forgot"
              ? "Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu."
              : "Đăng nhập để tiếp tục đồng hành cùng TICare."}
        </p>

        {tab !== "forgot" && (
          <div className="tab-switch">
            <button
              type="button"
              className={tab === "login" ? "selected" : ""}
              onClick={() => changeTab("login")}
              disabled={busy}
            >
              Đăng nhập
            </button>

            <button
              type="button"
              className={tab === "register" ? "selected" : ""}
              onClick={() => changeTab("register")}
              disabled={busy}
            >
              Đăng ký
            </button>
          </div>
        )}

        <form onSubmit={submit} className="form-stack">
          {tab === "register" && (
            <label htmlFor="auth-name">
              Tên hiển thị
              <input
                id="auth-name"
                required
                maxLength={60}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tên của bạn"
                autoComplete="nickname"
                disabled={busy}
              />
            </label>
          )}

          <label htmlFor="auth-email">
            Địa chỉ email
            <input
              id="auth-email"
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoComplete="email"
              disabled={busy}
            />
          </label>

          {tab !== "forgot" && (
            <label htmlFor="auth-password">
              Mật khẩu
              <input
                id="auth-password"
                required
                minLength={tab === "register" ? 8 : undefined}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={
                  tab === "register"
                    ? "Tối thiểu 8 ký tự"
                    : "Nhập mật khẩu"
                }
                autoComplete={
                  tab === "register"
                    ? "new-password"
                    : "current-password"
                }
                disabled={busy}
              />
            </label>
          )}

          {tab === "register" && (
            <label htmlFor="auth-confirm">
              Xác nhận mật khẩu
              <input
                id="auth-confirm"
                required
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                disabled={busy}
              />
            </label>
          )}

          {message && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: success ? "#ecfdf5" : "#fef2f2",
                color: success ? "#047857" : "#b91c1c",
                fontSize: "14px",
                lineHeight: 1.6
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary full"
            disabled={busy || !live}
          >
            {busy
              ? "Đang xử lý..."
              : tab === "register"
                ? "Tạo tài khoản"
                : tab === "forgot"
                  ? "Gửi email khôi phục"
                  : "Đăng nhập"}

            {busy
              ? <LoaderCircle className="spin" size={17} />
              : <ArrowRight size={17} />}
          </button>

          {tab === "login" && (
            <button
              type="button"
              className="link-button"
              onClick={() => changeTab("forgot")}
              disabled={busy}
              style={{ justifyContent: "center" }}
            >
              Quên mật khẩu?
            </button>
          )}

          {tab === "forgot" && (
            <button
              type="button"
              className="link-button"
              onClick={() => changeTab("login")}
              disabled={busy}
              style={{ justifyContent: "center" }}
            >
              <ArrowLeft size={16} />
              Quay lại đăng nhập
            </button>
          )}
        </form>

        <div className="auth-hint">
          <ShieldCheck size={16} />
          {live
            ? "Tài khoản được xác thực bằng Supabase Auth."
            : "Hệ thống tài khoản tạm thời không khả dụng."}
        </div>
    </Modal>
  );
}

function ResetPasswordModal({ onClose, notify }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    if (password.length < 8) {
      setMessage("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Hai mật khẩu không khớp.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      if (!supabase) {
        throw new Error("Không thể kết nối hệ thống xác thực.");
      }

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      setPassword("");
      setConfirmPassword("");
      notify("Đổi mật khẩu thành công.");
      onClose();
    } catch (error) {
      console.error("TICare reset password:", error);
      setMessage(error.message || "Không thể đổi mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} dismissible={false} className="auth-modal" labelledBy="reset-title">
        <div className="auth-logo">
          <Lock size={28} />
        </div>

        <h2 id="reset-title">Đặt lại mật khẩu</h2>
        <p>Hãy tạo mật khẩu mới cho tài khoản TICare.</p>

        <form className="form-stack" onSubmit={submit}>
          <label htmlFor="reset-password">
            Mật khẩu mới
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              disabled={busy}
            />
          </label>

          <label htmlFor="reset-confirm">
            Xác nhận mật khẩu mới
            <input
              id="reset-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              disabled={busy}
            />
          </label>

          {message && (
            <p role="alert" style={{ color: "#b91c1c" }}>
              {message}
            </p>
          )}

          <button
            className="btn btn-primary full"
            type="submit"
            disabled={busy}
          >
            {busy ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
            <ShieldCheck size={17} />
          </button>
        </form>
    </Modal>
  );
}

function Community({ posts, user, initialView,  onPost, onComment, onReport, onRemove, onEditPost, onOpenProfile, requireAuth, saved, onToggleSave, loading, notify }) {
  const [filter,setFilter] = useState('Tất cả');
  const [query,setQuery] = useState('');
  const [view,setView] = useState(initialView || 'all');
  const [sort,setSort] = useState('newest');
  const [shown,setShown] = useState(10);
  const [compose,setCompose] = useState(false);
  const [editing,setEditing] = useState(null);
  const [selected,setSelected] = useState(null);
  const [report,setReport] = useState(null);
  const categories = ['Tất cả','Kiến thức về tic','Tài nguyên giáo dục','Tình huống lớp học','Kinh nghiệm chia sẻ'];
  useEffect(()=>{setShown(10)},[filter,query,view,sort]);
  useEffect(()=>setView(initialView||'all'),[initialView]);
  useEffect(()=>{if(!user && view!=='all')setView('all')},[user,view]);
  const visible=posts.filter(p=>
    (view==='all'||(view==='saved'&&saved.includes(p.id))||(view==='mine'&&user&&p.author_id===user.id))&&
    (filter==='Tất cả'||p.category===filter)&&
    `${p.title} ${p.body} ${p.author}`.toLowerCase().includes(query.toLowerCase())
  ).sort((a,b)=>sort==='newest'?new Date(b.created_at)-new Date(a.created_at):new Date(a.created_at)-new Date(b.created_at));
  const pageItems=visible.slice(0,shown);
  const changeView=v=>{if(v!=='all'&&!requireAuth())return;setView(v)};
  return <>
    <Heading eyebrow="KHÔNG GIAN CHIA SẺ" title="Cộng đồng TICare"
      desc="Kết nối giáo viên, chia sẻ tài liệu và câu chuyện giáo dục hòa nhập."
      action={<button className="btn btn-primary" onClick={()=>{if(requireAuth())setCompose(true)}}><Plus size={18}/> Viết bài mới</button>}/>
    <div className="community-layout"><div>
      <div className="panel" style={{marginBottom:16,padding:18,borderRadius:16}}>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',justifyContent:'space-between'}}>
          <div><b style={{fontSize:17}}>Cùng chia sẻ điều hữu ích</b><p className="small-text muted" style={{margin:'6px 0 0'}}>Bắt đầu từ kiến thức đúng và những trải nghiệm tích cực.</p></div>
          <button className="btn btn-outline small" onClick={()=>{if(requireAuth())onOpenProfile()}}><UserRound size={16}/> Hồ sơ của tôi</button>
        </div>
      </div>
      <div className="community-toolbar" style={{flexWrap:'wrap',gap:12}}>
        <div className="search-field"><Search size={18}/><input aria-label="Tìm bài viết" placeholder="Tìm bài viết, chủ đề, tác giả..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <label className="small-text muted" style={{display:'flex',alignItems:'center',gap:8}}>Sắp xếp
          <select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select>
        </label>
      </div>
      <div className="filter-pills" style={{margin:'12px 0 14px',flexWrap:'wrap'}}>
        <button className={view==='all'?'on':''} onClick={()=>changeView('all')}><UsersRound size={15}/> Tất cả</button>
        <button className={view==='saved'?'on':''} onClick={()=>changeView('saved')}><Bookmark size={15}/> Đã lưu ({saved.length})</button>
        <button className={view==='mine'?'on':''} onClick={()=>changeView('mine')}><FileText size={15}/> Bài của tôi</button>
      </div>
      <div className="filter-pills" style={{marginBottom:18,flexWrap:'wrap'}}>
        {categories.map(c=><button key={c} className={filter===c?'on':''} onClick={()=>setFilter(c)}>{c}</button>)}
      </div>
      <div className="small-text muted" style={{marginBottom:12}}>Hiển thị {Math.min(shown,visible.length)} / {visible.length} bài phù hợp</div>
      <div className="posts-list">
        {visible.length===0&&<div className="empty">{view==='mine'?'Bạn chưa có bài đăng phù hợp.':view==='saved'?'Chưa có bài đã lưu phù hợp.':'Chưa tìm thấy bài viết phù hợp.'}</div>}
        {pageItems.map(p=><article className="post-card" key={p.id}>
          <div className="post-head"><div className="avatar">{(p.author||'T')[0].toUpperCase()}</div>
            <div><b>{p.author||'Thành viên'}</b><small>{fmt(p.created_at)} · <span className="post-category">{p.category}</span></small></div>
            {user&&p.author_id===user.id&&<div style={{display:'flex',gap:4,marginLeft:'auto'}}>
              <button type="button" className="icon-button" title="Sửa bài" aria-label="Sửa bài" onClick={()=>setEditing(p)}><FileText size={17}/></button>
              <button type="button" className="icon-button danger" title="Xóa bài" aria-label="Xóa bài" onClick={()=>onRemove(p.id)}><Trash2 size={17}/></button>
            </div>}
          </div>
          <h3>{p.title}</h3><p className="post-preview">{p.body}</p>
          {p.attachment&&<div className="attachment"><Paperclip size={16}/>{p.attachment.filename||p.attachment.name}</div>}
          <div className="post-actions" style={{flexWrap:'wrap'}}>
            <button onClick={()=>setSelected(p)}><MessageCircle size={17}/> Bình luận</button>
            <button onClick={()=>onToggleSave(p.id)}><Bookmark size={17} fill={saved.includes(p.id)?'currentColor':'none'}/> {saved.includes(p.id)?'Đã lưu':'Lưu bài'}</button>
            <button onClick={()=>{if(requireAuth())setReport(p)}}><Flag size={17}/> Báo cáo</button>
            <button className="readmore" onClick={()=>setSelected(p)}>Đọc tiếp <ArrowRight size={16}/></button>
          </div>
        </article>)}
        {shown<visible.length&&<div style={{textAlign:'center',margin:'18px 0 10px'}}>
          <button className="btn btn-outline" onClick={()=>setShown(n=>n+10)}>Xem thêm 10 bài <ChevronRight size={17}/></button>
        </div>}
      </div>
    </div>
    <aside className="community-aside">
      <div className="panel"><div className="side-panel-icon"><UsersRound size={22}/></div><h3>Góc cộng đồng</h3>
        <p>Một nơi để học hỏi và cùng xây dựng lớp học tôn trọng sự khác biệt.</p>
        <div className="stat-row"><b>{posts.length}</b><span>bài đã tải</span></div>
        {user&&<><button className="link-button" onClick={()=>changeView('mine')}><FileText size={16}/> Bài viết của tôi</button><button className="link-button" onClick={()=>changeView('saved')}><Bookmark size={16}/> Bài đã lưu</button></>}
      </div>
      <div className="panel rule-panel"><h3><ShieldCheck size={18}/> Nguyên tắc chia sẻ</h3>
        <p>Không đăng danh tính, hình ảnh hoặc thông tin sức khỏe riêng tư của học sinh khi chưa có sự cho phép phù hợp.</p>
        <p>Chia sẻ kiến thức có nguồn, không tự chẩn đoán hay kỳ thị người khác.</p>
      </div>
    </aside></div>
    {compose&&<ComposeModal onClose={()=>setCompose(false)} onPost={onPost} loading={loading}/>}
    {editing&&<EditPostModal post={editing} onClose={()=>setEditing(null)} onSave={onEditPost}/>}
    {selected&&<PostModal post={posts.find(p=>p.id===selected.id)||selected} user={user} onClose={()=>setSelected(null)} onComment={onComment} requireAuth={requireAuth} notify={notify}/>}
    {report&&<ReportModal post={report} onClose={()=>setReport(null)} onSubmit={onReport}/>}
  </>;
}

function EditPostModal({post,onClose,onSave}) {
  const [title,setTitle]=useState(post.title);
  const [body,setBody]=useState(post.body);
  const [category,setCategory]=useState(post.category);
  const [busy,setBusy]=useState(false);
  async function submit(e) {
    e.preventDefault();if(busy)return;setBusy(true);
    try {if(await onSave(post.id,{title,body,category}))onClose()}
    finally {setBusy(false)}
  }
  return <Modal onClose={onClose} dismissible={!busy} className="compose-modal" labelledBy="edit-post-title">
    <button className="close" onClick={onClose} disabled={busy} aria-label="Đóng"><X/></button>
    <h2 id="edit-post-title">Chỉnh sửa bài viết</h2><p>Chỉ bạn mới có thể chỉnh sửa bài viết này.</p>
    <form className="form-stack" onSubmit={submit}>
      <label htmlFor="edit-post-input">Tiêu đề<input id="edit-post-input" required minLength={3} maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label htmlFor="edit-post-cat">Chủ đề<select id="edit-post-cat" value={category} onChange={e=>setCategory(e.target.value)}>{['Kiến thức về tic','Tài nguyên giáo dục','Tình huống lớp học','Kinh nghiệm chia sẻ'].map(c=><option key={c}>{c}</option>)}</select></label>
      <label htmlFor="edit-post-body">Nội dung<textarea id="edit-post-body" required minLength={5} maxLength={20000} rows={8} value={body} onChange={e=>setBody(e.target.value)}/></label>
      <p className="small-text muted">Tệp đính kèm hiện có được giữ nguyên.</p>
      <button className="btn btn-primary full" disabled={busy}>{busy?'Đang lưu...':'Lưu thay đổi'} <CheckCircle2 size={17}/></button>
    </form>
  </Modal>;
}

function ProfileModal({profile,user,posts,saved,onClose,onUpdate,onGoMyPosts}) {
  const [name,setName]=useState(profile?.display_name||user.user_metadata?.display_name||'');
  const [busy,setBusy]=useState(false);
  async function save(e){e.preventDefault();if(busy)return;setBusy(true);try{if(await onUpdate(name))onClose()}finally{setBusy(false)}}
  const myCount=posts.filter(p=>p.author_id===user.id).length;
  return <Modal onClose={onClose} className="auth-modal" labelledBy="profile-title">
    <button className="close" onClick={onClose} aria-label="Đóng"><X size={20}/></button>
    <div className="auth-logo"><UserRound size={25}/></div><h2 id="profile-title">Hồ sơ của tôi</h2>
    <p className="small-text muted">Tài khoản: {user.email}</p>
    <div style={{display:'flex',gap:12,margin:'16px 0'}}>
      <div className="panel" style={{flex:1,textAlign:'center',padding:12}}><b>{myCount}</b><div className="small-text muted">Bài đã đăng</div></div>
      <div className="panel" style={{flex:1,textAlign:'center',padding:12}}><b>{saved.length}</b><div className="small-text muted">Bài đã lưu</div></div>
    </div>
    <form className="form-stack" onSubmit={save}><label htmlFor="profile-name">Tên hiển thị<input id="profile-name" required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
      <button className="btn btn-primary full" disabled={busy}>{busy?'Đang lưu...':'Lưu tên hiển thị'}</button></form>
    <button className="btn btn-outline full" style={{marginTop:12}} onClick={onGoMyPosts}>Xem bài viết của tôi <ArrowRight size={17}/></button>
    <p className="small-text muted" style={{marginTop:14}}>TICare chỉ hiển thị tên công khai, không công bố email của bạn trên bài viết.</p>
  </Modal>;
}

function ComposeModal({onClose,onPost,loading}){const[title,setTitle]=useState(''),[body,setBody]=useState(''),[category,setCategory]=useState('Tài nguyên giáo dục'),[file,setFile]=useState(null);async function submit(e){e.preventDefault();if(!title.trim()||!body.trim())return;const ok=await onPost({title:title.trim(),body:body.trim(),category},file);if(ok)onClose()}return <Modal onClose={onClose} className="compose-modal" labelledBy="compose-title"><button className="close" onClick={onClose} aria-label="Đóng"><X/></button><h2 id="compose-title">Chia sẻ cùng cộng đồng</h2><p>Những tài liệu nhỏ có thể tạo nên thay đổi lớn.</p><form onSubmit={submit} className="form-stack"><label htmlFor="compose-title-input">Tiêu đề<input id="compose-title-input" required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Đặt tiêu đề dễ hiểu..."/></label><label htmlFor="compose-cat">Chủ đề<select id="compose-cat" value={category} onChange={e=>setCategory(e.target.value)}>{['Kiến thức về tic','Tài nguyên giáo dục','Tình huống lớp học','Kinh nghiệm chia sẻ'].map(x=><option key={x}>{x}</option>)}</select></label><label htmlFor="compose-body">Nội dung<textarea id="compose-body" required rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Chia sẻ bài học, hoạt động, kinh nghiệm... (không đăng dữ liệu riêng tư của học sinh)"/></label><label className="file-input"><Paperclip size={18}/> {file?file.name:'Đính kèm PDF, DOCX, PPTX hoặc ảnh'}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files[0]||null)}/></label><div className="muted small-text">Giới hạn tệp: 8 MB. Không tải thông tin riêng tư của học sinh. Bài đăng công khai sau khi gửi.</div><button disabled={loading} className="btn btn-primary full">{loading?'Đang đăng...':'Đăng bài viết'} <Send size={16}/></button></form></Modal>}
function PostModal({post,user,onClose,onComment,requireAuth,notify}) {
  const [text,setText]=useState('');
  const [comments,setComments]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [editId,setEditId]=useState(null);
  const [editBody,setEditBody]=useState('');
  const [busyId,setBusyId]=useState(null);
  async function loadComments() {
    if(!supabase){setLoading(false);return}
    setLoading(true);
    const {data,error}=await supabase.from('comments').select('id,author_id,body,created_at')
      .eq('post_id',post.id).order('created_at',{ascending:true}).limit(300);
    if(error){notify('Không thể tải bình luận: '+error.message);setLoading(false);return}
    const ids=[...new Set((data||[]).map(x=>x.author_id).filter(Boolean))];
    let names={};
    if(ids.length){const r=await supabase.from('profiles').select('id,display_name').in('id',ids);names=Object.fromEntries((r.data||[]).map(p=>[p.id,p.display_name]))}
    setComments((data||[]).map(c=>({...c,author:names[c.author_id]||'Thành viên'})));
    setLoading(false);
  }
  useEffect(()=>{loadComments()},[post.id]);
  async function submit(e){e.preventDefault();if(!text.trim()||sending||!requireAuth())return;setSending(true);
    try{if(await onComment(post.id,text.trim())){setText('');await loadComments()}}finally{setSending(false)}}
  async function saveComment(c){
    if(!user||c.author_id!==user.id||!editBody.trim())return;
    setBusyId(c.id);
    try{await mutate(supabase.from('comments').update({body:editBody.trim()}).eq('id',c.id).eq('author_id',user.id));
      setEditId(null);await loadComments();notify('Đã sửa bình luận.');
    }catch(error){notify('Không thể sửa bình luận: '+error.message);}
    setBusyId(null);
  }
  async function deleteComment(c){
    if(!user||c.author_id!==user.id||!window.confirm('Xóa bình luận của bạn?'))return;
    setBusyId(c.id);
    try{await mutate(supabase.from('comments').delete().eq('id',c.id).eq('author_id',user.id));
      await loadComments();notify('Đã xóa bình luận.');
    }catch(error){notify('Không thể xóa bình luận: '+error.message);}
    setBusyId(null);
  }
  async function download(){
    if(!post.attachment?.storage_path)return;
    const {data,error}=await supabase.storage.from('community-files').createSignedUrl(post.attachment.storage_path,60);
    if(error){notify('Không thể mở tài liệu: '+error.message);return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }
  return <Modal onClose={onClose} className="post-modal" labelledBy="post-modal-title">
    <button className="close" onClick={onClose} aria-label="Đóng"><X/></button>
    <span className="post-category">{post.category}</span><h2 id="post-modal-title">{post.title}</h2>
    <div className="byline">{post.author} · {fmt(post.created_at)}</div>
    <div className="post-full">{post.body}</div>
    {post.attachment&&<button className="attachment attachment-button" onClick={download}><Download size={17}/>{post.attachment.filename||post.attachment.name}</button>}
    <div className="comment-section"><h3>Bình luận ({comments.length})</h3>
      {loading?<p>Đang tải bình luận...</p>:comments.length===0?<p>Chưa có bình luận nào.</p>:
        comments.map(c=><div className="comment" key={c.id} style={{padding:'12px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
            <span><b>{c.author}</b> <small> · {fmt(c.created_at)}</small></span>
            {user&&c.author_id===user.id&&<div style={{display:'flex',gap:8}}>
              <button type="button" className="link-button" onClick={()=>{setEditId(c.id);setEditBody(c.body)}} disabled={busyId===c.id}><FileText size={14}/> Sửa</button>
              <button type="button" className="link-button" onClick={()=>deleteComment(c)} disabled={busyId===c.id}><Trash2 size={14}/> Xóa</button>
            </div>}
          </div>
          {editId===c.id?<div className="form-stack" style={{marginTop:8}}>
            <textarea rows={3} maxLength={3000} value={editBody} onChange={e=>setEditBody(e.target.value)}/>
            <div style={{display:'flex',gap:8}}><button className="btn btn-primary small" onClick={()=>saveComment(c)} disabled={!editBody.trim()||busyId===c.id}>Lưu</button><button className="btn btn-outline small" onClick={()=>setEditId(null)}>Hủy</button></div>
          </div>:<p style={{whiteSpace:'pre-wrap'}}>{c.body}</p>}
        </div>)}
      <form onSubmit={submit} className="comment-form">
        <input aria-label="Viết bình luận" maxLength={3000} value={text} onChange={e=>setText(e.target.value)} placeholder="Viết bình luận tôn trọng và tích cực..."/>
        <button className="btn btn-primary" disabled={!text.trim()||sending} aria-label="Gửi bình luận"><Send size={16}/></button>
      </form>
    </div>
  </Modal>;
}

function ReportModal({post,onClose,onSubmit}) {
  const [reason,setReason] = useState('Thông tin sai lệch hoặc thiếu nguồn');
  const [busy,setBusy] = useState(false);
  const reasons = ['Thông tin sai lệch hoặc thiếu nguồn','Tiết lộ thông tin cá nhân học sinh','Nội dung xúc phạm, kỳ thị','Spam hoặc quảng cáo','Vi phạm khác'];
  async function sendReport() {
    setBusy(true);
    try {const ok = await onSubmit(post.id,reason);if(ok)onClose();}
    finally {setBusy(false);}
  }
  return <Modal onClose={onClose} dismissible={!busy} className="report-modal" labelledBy="report-title">
    <button className="close" onClick={onClose} aria-label="Đóng"><X/></button><h2 id="report-title">Báo cáo nội dung</h2>
    <p>Báo cáo sẽ được quản trị viên xem xét, không tự động xóa bài.</p>
    <div className="report-target">{post.title}</div>
    <div className="form-stack"><label htmlFor="report-reason">Lý do báo cáo<select id="report-reason" value={reason} onChange={e=>setReason(e.target.value)}>
      {reasons.map(x=><option key={x}>{x}</option>)}
    </select></label>
    <button className="btn btn-primary full" disabled={busy} onClick={sendReport}>{busy?'Đang gửi...':'Gửi báo cáo'} <Flag size={16}/></button></div>
  </Modal>;
}

function AdminPanel({notify,user,onRefreshPosts}) {
  const [items,setItems]=useState([]);
  const [busy,setBusy]=useState(null);
  const [filter,setFilter]=useState('pending');
  const [loading,setLoading]=useState(true);
  const [limit,setLimit]=useState(15);
  const [query,setQuery]=useState('');
  useEffect(()=>{setLimit(15)},[filter,query]);
  async function reload(){
    setLoading(true);
    const {data,error}=await supabase.from('reports')
      .select('id,post_id,reporter_id,reason,status,created_at,posts(id,title,body,status)')
      .order('created_at',{ascending:false}).limit(500);
    if(error)notify('Không thể tải báo cáo: '+error.message);
    else setItems(data||[]);
    setLoading(false);
  }
  useEffect(()=>{reload()},[]);
  async function handle(item,action){
    setBusy(item.id);
    try{
      if(action==='hide'||action==='restore'){
        const status=action==='hide'?'hidden':'published';
        await mutate(supabase.from('posts').update({status}).eq('id',item.post_id));
      }
      if(action==='hide'||action==='dismiss'){
        await mutate(supabase.from('reports')
          .update({status:action==='hide'?'reviewed':'dismissed',handled_by:user.id,handled_at:new Date().toISOString()}).eq('id',item.id));
      }
      await reload();await onRefreshPosts();
      notify(action==='hide'?'Đã ẩn bài và xử lý báo cáo.':action==='restore'?'Đã khôi phục bài viết.':'Đã bác bỏ báo cáo.');
    }catch(e){console.error(e);notify('Không thể xử lý: '+e.message)}finally{setBusy(null)}
  }
  const counts={pending:items.filter(x=>x.status==='pending').length,reviewed:items.filter(x=>x.status==='reviewed').length,dismissed:items.filter(x=>x.status==='dismissed').length};
  const visible=items.filter(x=>(filter==='all'||x.status===filter)&&`${x.posts?.title||''} ${x.reason}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <Heading eyebrow="DÀNH CHO QUẢN TRỊ VIÊN" title="Kiểm duyệt cộng đồng"
      desc="Quản lý báo cáo và quyết định ẩn hoặc khôi phục bài viết. Lịch sử vẫn được giữ lại."/>
    <div className="panel" style={{marginBottom:18}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
        <div className="stat-row" style={{flex:1,minWidth:110}}><b>{counts.pending}</b><span>Chờ xử lý</span></div>
        <div className="stat-row" style={{flex:1,minWidth:110}}><b>{counts.reviewed}</b><span>Đã xử lý</span></div>
        <div className="stat-row" style={{flex:1,minWidth:110}}><b>{counts.dismissed}</b><span>Đã bác bỏ</span></div>
      </div>
      <div className="search-field" style={{marginBottom:12}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm theo tiêu đề, lý do báo cáo..."/></div>
      <div className="filter-pills" style={{display:'flex',flexWrap:'wrap',alignItems:'center'}}>
        <button className={filter==='pending'?'on':''} onClick={()=>setFilter('pending')}>Đang chờ</button>
        <button className={filter==='reviewed'?'on':''} onClick={()=>setFilter('reviewed')}>Đã xử lý</button>
        <button className={filter==='dismissed'?'on':''} onClick={()=>setFilter('dismissed')}>Đã bác bỏ</button>
        <button className={filter==='all'?'on':''} onClick={()=>setFilter('all')}>Tất cả</button>
        <button className="btn btn-outline small" onClick={reload}><RefreshCcw size={16}/> Làm mới</button>
      </div>
    </div>
    {loading&&<div className="panel">Đang tải báo cáo...</div>}
    {!loading&&visible.length===0&&<div className="panel">Không có báo cáo phù hợp.</div>}
    {!loading&&visible.slice(0,limit).map(item=><article className="post-card" key={item.id} style={{marginBottom:16}}>
      <div className="post-head"><div className="avatar"><Flag size={18}/></div><div>
        <b>{item.posts?.title||'Bài viết không còn tồn tại'}</b>
        <small>{fmt(item.created_at)} · {item.status==='pending'?'Đang chờ':item.status==='reviewed'?'Đã xử lý':'Đã bác bỏ'}</small>
      </div></div>
      <p><b>Lý do:</b> {item.reason}</p>
      {item.posts&&<><p className="post-preview">{item.posts.body}</p><p className="small-text muted">Trạng thái bài: {item.posts.status==='hidden'?'Đang ẩn':item.posts.status==='published'?'Công khai':item.posts.status}</p>
        <div className="post-actions" style={{flexWrap:'wrap'}}>
          {item.posts.status==='published'&&<button disabled={!!busy} onClick={()=>{if(window.confirm('Ẩn bài viết này khỏi cộng đồng?'))handle(item,'hide')}}><Eye size={16}/> Ẩn bài & xử lý</button>}
          {item.posts.status==='hidden'&&<button disabled={!!busy} onClick={()=>{if(window.confirm('Khôi phục bài công khai?'))handle(item,'restore')}}><RefreshCcw size={16}/> Khôi phục bài</button>}
          {item.status==='pending'&&<button disabled={!!busy} onClick={()=>handle(item,'dismiss')}><CheckCircle2 size={16}/> Bác bỏ báo cáo</button>}
        </div></>}
    </article>)}
    {!loading&&limit<visible.length&&<div style={{textAlign:'center',marginBottom:20}}><button className="btn btn-outline" onClick={()=>setLimit(n=>n+15)}>Xem thêm 15 báo cáo</button></div>}
    <div className="panel rule-panel"><p><ShieldCheck size={17}/> Chỉ admin mới có quyền thao tác. Báo cáo được giữ với trạng thái để phục vụ kiểm tra sau này.</p></div>
  </>;
}

const ED_AGES=[{id:'mam_non',label:'Mầm non'},{id:'lop_1',label:'Lớp 1'},{id:'lop_2',label:'Lớp 2'},{id:'lop_3',label:'Lớp 3'}];
const ED_GAMES=[
  {id:'kindness',title:'Lời nói tử tế',age:'mam_non',minutes:5,icon:'💚',desc:'Chọn cách cư xử thân thiện với bạn bè.',questions:[
    {q:'Khi bạn làm rơi bút, em sẽ...',answers:['Giúp bạn nhặt bút','Cười chê bạn','Giấu bút của bạn'],correct:0,explain:'Giúp đỡ người khác là hành động tử tế.'},
    {q:'Khi một bạn có cử động khác với mình, em nên...',answers:['Bắt chước bạn','Tôn trọng và không trêu chọc','Chỉ trỏ, cười đùa'],correct:1,explain:'Ai cũng xứng đáng được tôn trọng, dù có những khác biệt.'},
    {q:'Khi bạn muốn chơi cùng nhóm, em có thể...',answers:['Mời bạn tham gia','Đuổi bạn đi','Làm ngơ để bạn buồn'],correct:0,explain:'Lời mời thân thiện giúp mọi người cảm thấy được chào đón.'}
  ]},
  {id:'classmate',title:'Bạn sẽ làm gì?',age:'lop_2',minutes:8,icon:'🌻',desc:'Trò chơi tình huống về sự tôn trọng trong lớp.',questions:[
    {q:'Em thấy một bạn bị trêu chọc vì cử động lặp lại. Em nên làm gì?',answers:['Hùa theo cho vui','Can ngăn và báo người lớn đáng tin cậy','Quay video đăng lên mạng'],correct:1,explain:'Không trêu chọc hoặc ghi hình chia sẻ; hãy hỗ trợ bạn một cách tôn trọng.'},
    {q:'Bạn xin thêm ít thời gian để hoàn thành bài. Em nên...',answers:['Nói bạn lười biếng','Làm bài hộ bạn','Tôn trọng sự hỗ trợ mà giáo viên sắp xếp'],correct:2,explain:'Mỗi bạn có thể cần cách học phù hợp với mình.'},
    {q:'Khi chưa hiểu vì sao bạn có cử động khác thường, em nên...',answers:['Tự kết luận bạn mắc bệnh','Không suy đoán và cư xử bình thường','Hỏi cả lớp xem ai biết'],correct:1,explain:'Không nên tự suy đoán hoặc công khai chuyện riêng của người khác.'}
  ]},
  {id:'helping',title:'Bàn tay giúp bạn',age:'lop_1',minutes:5,icon:'🤝',desc:'Học cách giúp bạn qua những tình huống gần gũi.',questions:[
    {q:'Bạn chưa tìm thấy hộp bút. Em nên...',answers:['Giúp bạn tìm','Cười bạn','Giấu hộp bút'],correct:0,explain:'Giúp bạn tìm đồ là hành động tử tế.'},
    {q:'Bạn có cách nói hoặc cử động khác mình. Em sẽ...',answers:['Trêu bạn','Tôn trọng và lắng nghe','Bắt chước bạn'],correct:1,explain:'Mỗi người có đặc điểm riêng và xứng đáng được tôn trọng.'}
  ]},
  {id:'respect-choices',title:'Lựa chọn tôn trọng',age:'lop_3',minutes:8,icon:'🌟',desc:'Tập ứng xử khi gặp tình huống về sự khác biệt.',questions:[
    {q:'Một bạn bị trêu chọc vì biểu hiện khác với mọi người. Em sẽ...',answers:['Cùng cười','Nhờ giáo viên giúp và không trêu chọc','Đăng chuyện lên mạng'],correct:1,explain:'Can thiệp an toàn, không công khai thông tin của bạn.'},
    {q:'Khi bạn cần cách học khác để tham gia bài học, em nên...',answers:['Tôn trọng sự sắp xếp của giáo viên','Cho rằng bạn được thiên vị','Không chơi với bạn'],correct:0,explain:'Sự hỗ trợ phù hợp giúp mọi người có cơ hội học tập công bằng.'}
  ]}
];
const ED_SLIDES=[
  {id:'kindness-slides',title:'Lớp học của những lời tử tế',age:'mam_non',desc:'Bộ slide đơn giản cho hoạt động 10 phút.',pages:[
    {title:'Lời nói tử tế',body:'Hôm nay chúng mình học cách quan tâm và tôn trọng bạn bè.',emoji:'💚'},
    {title:'Mỗi bạn là một bông hoa',body:'Chúng mình có thể khác nhau, nhưng ai cũng đáng quý.',emoji:'🌼'},
    {title:'Khi bạn gặp khó khăn',body:'Hãy hỏi: “Mình có thể giúp bạn không?”',emoji:'🤝'},
    {title:'Cùng chọn lời nói đẹp',body:'“Mình chơi cùng nhé!” · “Cảm ơn bạn!” · “Bạn làm tốt lắm!”',emoji:'🌈'},
    {title:'Lời hứa của lớp mình',body:'Không trêu chọc. Biết lắng nghe. Sẵn sàng giúp đỡ.',emoji:'⭐'}
  ]},
  {id:'respect-slides',title:'Tôn trọng sự khác biệt',age:'lop_2',desc:'Bộ slide tình huống cho lớp 1–3.',pages:[
    {title:'Ai cũng có điểm khác biệt',body:'Sự khác biệt không phải lý do để chê cười người khác.',emoji:'🌍'},
    {title:'Một số cử động không chủ ý',body:'Có những cử động một người không dễ tự kiểm soát. Chúng ta không tự đoán nguyên nhân.',emoji:'🫶'},
    {title:'Tình huống lớp học',body:'Nếu thấy một bạn bị bắt chước, trêu chọc, em sẽ làm gì?',emoji:'💬'},
    {title:'Cách giúp bạn',body:'Dừng việc trêu chọc, cư xử tôn trọng và tìm sự hỗ trợ từ giáo viên.',emoji:'🤝'},
    {title:'Thông điệp',body:'Hiểu sự khác biệt – tôn trọng mỗi người – cùng nhau học tốt.',emoji:'✨'}
  ]},
  {id:'help-slides',title:'Chúng mình cùng giúp nhau',age:'lop_1',desc:'5 trang ngắn, hình ảnh và câu dễ nhớ.',pages:[
    {title:'Cùng nhau đến lớp',body:'Mỗi bạn là một phần quan trọng của lớp mình.',emoji:'🏫'},
    {title:'Một việc tốt nhỏ',body:'Hỏi bạn: “Mình giúp được gì không?”',emoji:'💛'},
    {title:'Biết lắng nghe',body:'Không cười chê khi bạn có điều khác biệt.',emoji:'👂'},
    {title:'Cùng hợp tác',body:'Rủ bạn cùng chơi và học bài.',emoji:'🤝'},
    {title:'Thông điệp',body:'Tử tế với mọi người, mỗi ngày.',emoji:'⭐'}
  ]},
  {id:'class3-slides',title:'Lớp học không trêu chọc',age:'lop_3',desc:'5 trang cho hoạt động thảo luận lớp 3.',pages:[
    {title:'Một lớp học thân thiện',body:'Ai cũng có quyền được học tập an toàn và tôn trọng.',emoji:'🌻'},
    {title:'Sự khác biệt là bình thường',body:'Chúng ta không kết luận nguyên nhân cử động của người khác.',emoji:'🌈'},
    {title:'Khi chứng kiến trêu chọc',body:'Không hùa theo, không quay video chia sẻ.',emoji:'🛑'},
    {title:'Cách hỗ trợ',body:'An ủi bạn và tìm thầy cô đáng tin cậy.',emoji:'🤝'},
    {title:'Lời hứa của cả lớp',body:'Tôn trọng – Lắng nghe – Giúp đỡ.',emoji:'💚'}
  ]}
];

function Education({user,role='member',notify,openAuth}){
  const [tab,setTab]=useState('lessons');
  const [age,setAge]=useState('all');
  const [lesson,setLesson]=useState(null);
  const [game,setGame]=useState(null);
  const [gameIndex,setGameIndex]=useState(0);
  const [gameAnswer,setGameAnswer]=useState(null);
  const [gameScore,setGameScore]=useState(0);
  const [slide,setSlide]=useState(null);
  const [slideIndex,setSlideIndex]=useState(0);
  const [resources,setResources]=useState([]);
  const [resLoading,setResLoading]=useState(false);
  const [tagFilter,setTagFilter]=useState('all');
  const [resError,setResError]=useState('');
  const ageLabel=eduAgeLabel;
  const ageMatches=id=>age==='all'||id===age||id==='all';
  const loadResources=useCallback(async()=>{
    if(!supabase){setResError('Chưa kết nối Supabase.');return;}
    setResLoading(true);setResError('');
    const {data,error}=await supabase.from('education_resources')
      .select('id,title,description,audience,kind,storage_path,external_url,status,author_id,created_at,tags')
      .eq('status','approved').order('created_at',{ascending:false}).limit(150);
    if(error){setResError('Không tải được học liệu: '+error.message);}
    else setResources(data||[]);
    setResLoading(false);
  },[]);
  useEffect(()=>{if(tab==='library')loadResources()},[tab,loadResources,user?.id]);
  const openResource=r=>eduOpenResource(r,notify);
  function startGame(g){setGame(g);setGameIndex(0);setGameScore(0);setGameAnswer(null);}
  function chooseAnswer(i){if(gameAnswer!==null)return;setGameAnswer(i);if(i===game.questions[gameIndex].correct)setGameScore(s=>s+1);}
  function nextQuestion(){setGameAnswer(null);setGameIndex(i=>i+1);}
  async function exportSlides(){
    if(!slide)return;
    try{
      const {default:PptxGenJS}=await import('pptxgenjs');
      const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='TICare Education';pptx.subject='Tài liệu giáo dục hòa nhập';pptx.title=slide.title;
      for(const p of slide.pages){
        const s=pptx.addSlide();s.background={color:'F3FBF8'};
        s.addShape(pptx.ShapeType.roundRect,{x:0.65,y:0.65,w:12.05,h:6.2,rectRadius:0.2,fill:{color:'FFFFFF'},line:{color:'DCEFE8'}});
        s.addText('TICare Education',{x:1,y:0.95,w:9,h:0.35,fontSize:14,bold:true,color:'00866F',margin:0});
        s.addText(p.emoji,{x:1,y:1.58,w:2.2,h:1.2,fontSize:50,margin:0});
        s.addText(p.title,{x:1,y:3.08,w:11,h:0.8,fontSize:32,bold:true,color:'12433E',margin:0,breakLine:false});
        s.addText(p.body,{x:1,y:4.2,w:10.9,h:1.55,fontSize:22,color:'425C59',margin:0,breakLine:false});
        s.addText('Tôn trọng sự khác biệt • Không dùng để chẩn đoán',{x:1,y:6.1,w:10.9,h:0.3,fontSize:10,color:'79938E',margin:0});
      }
      await pptx.writeFile({fileName:'TICare_'+slide.id+'.pptx'});
    }catch(err){notify('Không xuất được PPTX: '+err.message);}
  }
  const visibleResources=resources.filter(r=>ageMatches(r.audience)&&(tagFilter==='all'||(r.tags||[]).includes(tagFilter)));
  return <div className="edu-v3">
    <Heading eyebrow="TICARE EDUCATION · MẦM NON & LỚP 1–3" title="Học cách thấu hiểu, cùng nhau trưởng thành" desc="Bài học ngắn, trò chơi tương tác và học liệu có thể sử dụng ngay trong lớp. Nội dung giáo dục, không đánh giá sức khỏe học sinh."/>
    <div className="edu-v3-hero"><div><span className="edu-v3-kicker">💚 THƯ VIỆN HỌC TẬP TÍCH CỰC</span><h2>Mỗi khác biệt đều xứng đáng được tôn trọng.</h2><p>Khám phá hoạt động, cùng chơi, cùng học và chia sẻ tài liệu dạy học.</p></div><div className="edu-v3-hero-art" aria-hidden="true">🌈<span>🌱</span></div></div>
    <div className="edu-v3-tabs" role="tablist" aria-label="Các phần TICare Education" onKeyDown={e=>{const k=e.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(k))return;const tabs=[...e.currentTarget.querySelectorAll('[role=tab]')];const i=tabs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const n=k==='Home'?0:k==='End'?tabs.length-1:(i+(k==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click()}}>
      {[['lessons','Bài học'],['slides','Slide mẫu'],['games','Trò chơi'],['library','Học liệu chia sẻ'],['guidance','Góc đồng hành'],['studio','Studio'],['mine','Học liệu của tôi'],...(role==='admin'?[['review','Quản trị']]:[])].map(([id,label])=><button type="button" role="tab" id={'edu-tab-'+id} aria-selected={tab===id} tabIndex={tab===id?0:-1} className={tab===id?'active':''} key={id} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    {['lessons','slides','games','library'].includes(tab)&&<div className="edu-v3-filters"><span>Độ tuổi:</span><div>{[{id:'all',label:'Tất cả'},...ED_AGES].map(x=><button type="button" key={x.id} className={age===x.id?'active':''} onClick={()=>setAge(x.id)}>{x.label}</button>)}</div></div>}
    {tab==='lessons'&&<div className="edu-v3-grid">{LESSONS.map((l,i)=><button className="edu-v3-tile" key={l.id} onClick={()=>setLesson(l)}><span className="edu-v3-tile-icon">{['🌼','🤝','🌱','🌈'][i%4]}</span><span className="edu-v3-tag">BÀI HỌC · {l.time}</span><b>{l.title}</b><p>{l.description}</p><span className="edu-v3-tile-action">Đọc bài học <ArrowRight size={15}/></span></button>)}</div>}
    {tab==='slides'&&<div className="edu-v3-grid">{ED_SLIDES.filter(s=>ageMatches(s.age)).map(s=><article className="edu-v3-tile" key={s.id}><span className="edu-v3-tile-icon">📊</span><span className="edu-v3-tag">{ageLabel(s.age)} · {s.pages.length} slide</span><b>{s.title}</b><p>{s.desc}</p><button className="btn btn-primary" onClick={()=>{setSlide(s);setSlideIndex(0);}}>Xem và tải PPTX <ArrowRight size={16}/></button></article>)}</div>}
    {tab==='games'&&<div className="edu-v3-grid">{ED_GAMES.filter(g=>ageMatches(g.age)).map(g=><article className="edu-v3-tile" key={g.id}><span className="edu-v3-tile-icon">{g.icon}</span><span className="edu-v3-tag">{ageLabel(g.age)} · {g.minutes} phút</span><b>{g.title}</b><p>{g.desc}</p><button className="btn btn-primary" onClick={()=>startGame(g)}>Chơi thử <ArrowRight size={16}/></button></article>)}</div>}
    {tab==='library'&&<><div className="edu-v3-library-head"><div><h2>Học liệu chia sẻ</h2><p>Bài giảng PPTX/PDF, dự án Scratch SB3 và liên kết trò chơi đã được quản trị viên duyệt. Lọc theo độ tuổi và thẻ phân loại.</p></div><button className="btn btn-primary" onClick={()=>user?setTab('mine'):openAuth?.()}><UploadCloud size={17}/> Gửi học liệu</button></div>
      <div className="edu-v3-filters"><span>Thẻ:</span><div><button type="button" className={tagFilter==='all'?'active':''} onClick={()=>setTagFilter('all')}>Tất cả</button>{EDU_TAGS.map(t=><button type="button" key={t.id} className={tagFilter===t.id?'active':''} onClick={()=>setTagFilter(t.id)}>{t.label}</button>)}</div></div>
      {resError&&<p className="edu-v3-error" role="alert">{resError}</p>}
      {resLoading?<p>Đang tải học liệu...</p>:visibleResources.length===0?<div className="edu-v3-empty"><BookOpen size={35}/><b>Chưa có học liệu phù hợp</b><p>Thử đổi bộ lọc, hoặc chia sẻ bài giảng đầu tiên của bạn!</p></div>:<div className="edu-v3-grid">{visibleResources.map(r=><article className="edu-v3-tile" key={r.id}><span className="edu-v3-tile-icon">{eduKindIcon(r.kind)}</span><span className="edu-v3-tag">{ageLabel(r.audience)} · {eduKindLabel(r.kind)}</span><b>{r.title}</b><p>{r.description||'Học liệu dành cho lớp học.'}</p>{r.tags?.length>0&&<div className="edu-v3-chips">{r.tags.map(t=><span key={t}>{tagLabel(t)}</span>)}</div>}<button className="btn btn-outline" type="button" onClick={()=>openResource(r)}><Download size={16}/> {r.kind==='link'?'Mở trang trò chơi':'Mở / tải học liệu'}</button></article>)}</div>}
    </>}
    {tab==='guidance'&&<Support embedded/>}
    {tab==='studio'&&<React.Suspense fallback={<p className="edu-v3-studio-loading">Đang tải Studio...</p>}><EducationStudio user={user} notify={notify} openAuth={openAuth}/></React.Suspense>}
    {tab==='mine'&&<MyResources user={user} notify={notify} openAuth={openAuth}/>}
    {tab==='review'&&role==='admin'&&<ReviewPanel user={user} role={role} notify={notify}/>}
    {lesson&&<Modal onClose={()=>setLesson(null)} className="lesson-modal" labelledBy="lesson-title"><button className="close" onClick={()=>setLesson(null)} aria-label="Đóng"><X/></button><span className="post-category">{lesson.type} · {lesson.time}</span><h2 id="lesson-title">{lesson.title}</h2><p>{lesson.description}</p><div className="lesson-content">{lesson.content}</div><div className="auth-hint"><Info size={16}/> Giáo viên điều chỉnh nội dung theo độ tuổi lớp học.</div></Modal>}
    {slide&&<Modal onClose={()=>setSlide(null)} className="edu-v3-modal" labelledBy="slide-title"><button className="close" type="button" onClick={()=>setSlide(null)} aria-label="Đóng"><X/></button><span className="edu-v3-tag">SLIDE {slideIndex+1}/{slide.pages.length}</span><div className="edu-v3-slide"><span>{slide.pages[slideIndex].emoji}</span><h2 id="slide-title">{slide.pages[slideIndex].title}</h2><p>{slide.pages[slideIndex].body}</p></div><div className="edu-v3-modal-actions"><button className="btn btn-outline" type="button" disabled={slideIndex===0} onClick={()=>setSlideIndex(i=>i-1)}>Trước</button><button className="btn btn-outline" type="button" disabled={slideIndex===slide.pages.length-1} onClick={()=>setSlideIndex(i=>i+1)}>Tiếp</button><button className="btn btn-primary" type="button" onClick={exportSlides}><Download size={16}/> Tải PPTX</button></div></Modal>}
    {game&&<Modal onClose={()=>setGame(null)} className="edu-v3-modal" title={'Trò chơi: '+game.title}><button className="close" type="button" aria-label="Đóng" onClick={()=>setGame(null)}><X/></button>{gameIndex>=game.questions.length?<div className="edu-v3-game-done"><span>🎉</span><h2>Hoàn thành!</h2><p>Em đã trả lời đúng {gameScore}/{game.questions.length} câu.</p><button className="btn btn-primary" onClick={()=>startGame(game)}>Chơi lại</button></div>:<><span className="edu-v3-tag">CÂU {gameIndex+1}/{game.questions.length} · {game.title}</span><div className="edu-v3-progress"><span style={{width:`${(gameIndex+1)/game.questions.length*100}%`}}/></div><h2 className="edu-v3-question">{game.questions[gameIndex].q}</h2><div className="edu-v3-answers">{game.questions[gameIndex].answers.map((a,i)=><button key={i} type="button" disabled={gameAnswer!==null} className={gameAnswer!==null?(i===game.questions[gameIndex].correct?'correct':i===gameAnswer?'incorrect':''):''} onClick={()=>chooseAnswer(i)}>{a}</button>)}</div>{gameAnswer!==null&&<div className="edu-v3-feedback" role="status"><b>{gameAnswer===game.questions[gameIndex].correct?'Chính xác! 💚':'Cùng học thêm nhé 🌱'}</b><p>{game.questions[gameIndex].explain}</p><button className="btn btn-primary" type="button" onClick={nextQuestion}>{gameIndex===game.questions.length-1?'Xem kết quả':'Câu tiếp theo'} <ArrowRight size={16}/></button></div>}</>}</Modal>}
  </div>;
}
function Support({embedded=false}){const[open,setOpen]=useState(0);const situations=[{q:'Khi học sinh có cử động lặp lại trong giờ học?',a:'Giữ thái độ bình tĩnh, tránh gây chú ý không cần thiết hoặc yêu cầu học sinh cố ngừng cử động. Không suy đoán nguyên nhân hay tự chẩn đoán. Nếu có lo ngại, trao đổi riêng một cách tôn trọng và phối hợp với gia đình, bộ phận hỗ trợ phù hợp.'},{q:'Khi học sinh khác trêu chọc hoặc bắt chước?',a:'Can thiệp để chấm dứt hành vi trêu chọc; nhắc lại nguyên tắc tôn trọng khác biệt cho cả lớp. Tránh nêu tên, công khai thông tin sức khỏe hoặc biến một học sinh thành ví dụ minh họa khi chưa có sự đồng ý phù hợp.'},{q:'Khi giáo viên cần trao đổi với phụ huynh?',a:'Nói về những quan sát cụ thể và ảnh hưởng đến việc học thay vì đưa ra kết luận bệnh lý. Hỏi gia đình về những hỗ trợ phù hợp, tôn trọng quyền riêng tư và khuyến khích tìm chuyên gia khi cần.'},{q:'Khi chưa chắc thông tin trên Internet có đáng tin?',a:'Ưu tiên tài liệu từ các tổ chức y tế uy tín như CDC hoặc NHS, xem ngày cập nhật và đối chiếu nhiều nguồn. Trợ lý TICare có thể hỗ trợ tìm hiểu, nhưng không thay thế chuyên gia.'}];return <>{!embedded&&<Heading eyebrow="HỖ TRỢ GIÁO VIÊN" title="Góc đồng hành" desc="Một số gợi ý ứng xử trong môi trường học đường — tôn trọng, riêng tư và lấy học sinh làm trung tâm."/>}<div className="support-layout"><div><div className="section-row"><div><h2>Tình huống thường gặp</h2><p>Chọn tình huống để xem hướng tham khảo.</p></div></div><div className="accordion">{situations.map((s,i)=><div className={'accordion-item '+(open===i?'expanded':'')} key={i}><button type="button" id={'acc-btn-'+i} aria-expanded={open===i} aria-controls={'acc-panel-'+i} onClick={()=>setOpen(open===i?-1:i)}><span className="q-number">0{i+1}</span><b>{s.q}</b><ChevronRight size={19}/></button>{open===i&&<p id={'acc-panel-'+i} role="region" aria-labelledby={'acc-btn-'+i}>{s.a}</p>}</div>)}</div></div><aside className="panel support-aside"><div className="side-panel-icon"><HandHeart size={26}/></div><h3>Nguyên tắc 3T</h3><div className="three-t"><b>Tìm hiểu</b><p>Ưu tiên kiến thức đáng tin cậy.</p></div><div className="three-t"><b>Tôn trọng</b><p>Không phán xét, không tiết lộ riêng tư.</p></div><div className="three-t"><b>Tương trợ</b><p>Phối hợp gia đình và chuyên gia khi cần.</p></div><a className="btn btn-outline full" href="https://www.cdc.gov/tourette-syndrome/" target="_blank" rel="noreferrer">Đọc nguồn CDC <ExternalLink size={15}/></a></aside></div></>}
export default App;
