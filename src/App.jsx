import React,{useState,useEffect,useRef,useCallback} from 'react';
import {HeartHandshake,LayoutDashboard,ScanEye,UsersRound,Bot,GraduationCap,HandHeart,Settings,Search,Plus,Menu,X,LogIn,LogOut,UserRound,FileText,Paperclip,MessageCircle,Bookmark,Flag,Send,ArrowRight,ArrowLeft,CheckCircle2,ShieldCheck,BookOpen,Camera,CameraOff,Activity,AlertTriangle,Download,ExternalLink,ChevronRight,Trash2,Heart,Info,Eye,Lock,Globe,Clock,UploadCloud,Filter,LoaderCircle,RefreshCcw,Bell,BellRing} from 'lucide-react';
import{SEED_POSTS,LESSONS,SOURCES,SUGGESTIONS,QUESTION_BANK,TOPIC_GROUPS,localAnswer}from './data';import{supabase,live}from './supabase';
const NAV=[{id:'home',label:'Tổng quan',icon:LayoutDashboard},{id:'motion',label:'Quan sát vận động',icon:ScanEye},{id:'community',label:'Cộng đồng giáo dục',icon:UsersRound},{id:'assistant',label:'Trợ lý thông tin AI',icon:Bot},{id:'education',label:'TICare Education',icon:GraduationCap}];
const uid=()=>crypto.randomUUID();const fmt=t=>new Date(t).toLocaleDateString('vi-VN');const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};const store=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function App(){const[page,setPage]=useState('home'),[drawer,setDrawer]=useState(false),[user,setUser]=useState(null),[authOpen,setAuthOpen]=useState(false),[toast,setToast]=useState(''),[posts,setPosts]=useState([]),[saved,setSaved]=useState([]),[role,setRole]=useState('member'),[profile,setProfile]=useState(null),[profileOpen,setProfileOpen]=useState(false),[communityView,setCommunityView]=useState('all'),[loading,setLoading]=useState(false);
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
const notify=(m)=>{setToast(m);setTimeout(()=>setToast(''),4200)};
const go=(p)=>{setPage(p);setDrawer(false);window.scrollTo({top:0,behavior:'smooth'})};

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
  try {
    const { data, error } = await supabase.from('posts').insert({
      author_id: user.id,
      title: payload.title,
      body: payload.body,
      category: payload.category
    }).select().single();
    if (error) throw error;
    if (file) {
      const path = `${user.id}/${data.id}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const upload = await supabase.storage.from('community-files').upload(path, file, { upsert: false });
      if (upload.error) throw upload.error;
      const attachment = await supabase.from('post_attachments').insert({
        post_id: data.id, storage_path: path, filename: file.name,
        mime_type: file.type, size_bytes: file.size
      });
      if (attachment.error) throw attachment.error;
    }
    await loadPosts();
    notify('Đăng bài thành công!');
    return true;
  } catch (error) {
    console.error('Đăng bài:', error);
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
  const { error } = await supabase.from('posts').update({
    title: payload.title.trim(), body: payload.body.trim(), category: payload.category
  }).eq('id', id).eq('author_id', user.id).eq('status','published');
  if (error) { notify('Không thể sửa bài: ' + error.message); return false; }
  await loadPosts(); notify('Đã cập nhật bài viết.'); return true;
}

async function updateProfile(displayName) {
  if (!requireAuth()) return false;
  const clean = displayName.trim();
  if (!clean || clean.length > 60) { notify('Tên hiển thị phải từ 1 đến 60 ký tự.'); return false; }
  const { error } = await supabase.from('profiles').update({ display_name: clean }).eq('id', user.id);
  if (error) { notify('Không thể sửa tên: ' + error.message); return false; }
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
  const result = already
    ? await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', id)
    : await supabase.from('saved_posts').insert({ user_id: user.id, post_id: id });
  if (result.error) { notify('Lỗi lưu bài: ' + result.error.message); return; }
  setSaved(old => already ? old.filter(x => x !== id) : [...old, id]);
  notify(already ? 'Đã bỏ lưu bài viết.' : 'Đã lưu bài viết vào tài khoản.');
}

async function removePost(id) {
  if (!requireAuth()) return;
  if (!window.confirm('Xóa bài viết này?')) return;
  const { error } = await supabase.from('posts').update({status:'removed'}).eq('id', id).eq('author_id',user.id).eq('status','published');
  if (error) { notify('Không thể xóa bài: ' + error.message); return; }
  await loadPosts();
  notify('Đã xóa bài viết.');
}
const navItems = role === 'admin'
  ? [...NAV, { id: 'admin', label: 'Quản trị báo cáo', icon: ShieldCheck }]
  : NAV;
const current = navItems.find(n => n.id === page);
return <div className="app"><aside className={'sidebar '+(drawer?'open':'')}><div className="brand" onClick={()=>go('home')}><div className="brand-icon"><HeartHandshake size={24}/></div><div><b>TICare<span>.</span></b><small>HIỂU ĐÚNG ĐỂ ĐỒNG HÀNH</small></div></div><div className="side-label">KHÔNG GIAN LÀM VIỆC</div><nav>{navItems.map(n=><button key={n.id} className={'nav-link '+(page===n.id?'active':'')} onClick={()=>go(n.id)}><n.icon size={19}/><span>{n.label}</span>{page===n.id&&<span className="active-dot"/>}</button>)}</nav><div className="side-bottom"><div className="privacy-note"><ShieldCheck size={20}/><div><b>Tôn trọng sự khác biệt</b><small>Không chẩn đoán y tế. Không lưu video camera mặc định.</small></div></div><div className="sidebar-version">TICare • Cộng đồng giáo dục</div></div></aside>{drawer&&<div className="shade" onClick={()=>setDrawer(false)}/>}
<div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setDrawer(true)}><Menu size={22}/></button><div className="breadcrumbs"><span>Không gian TICare</span><ChevronRight size={15}/><strong>{current?.label}</strong></div><div className="top-actions">{motionRunning&&<button className="btn btn-outline small" onClick={()=>go('motion')}><Camera size={15}/> Đang quan sát</button>}<button className="icon-button" title="Thông báo Motion Insight" onClick={()=>setMotionPanel(v=>!v)}><Bell size={19}/>{motionEvents.length>0&&<span className="motion-count">{motionEvents.length}</span>}</button><span className={'mode-pill '+(live?'online':'')}><span className="status-dot"/>{live?'Đã cấu hình Supabase':'Chưa cấu hình Supabase'}</span>{user?<><button className="icon-button" title="Hồ sơ cá nhân" onClick={()=>setProfileOpen(true)}><UserRound size={19}/></button><button className="account" onClick={signOut}><UserRound size={17}/><span>{profile?.display_name||user.user_metadata?.display_name||user.email?.split('@')[0]}</span><LogOut size={15}/></button></>:<button className="btn btn-outline small" onClick={()=>setAuthOpen(true)}><LogIn size={16}/> Đăng nhập</button>}</div></header>
<main className="main">{page==='home'&&<Home go={go} posts={posts}/ >}<div className={page==='motion'?'motion-page is-visible':'motion-page'} style={{display:page==='motion'?'block':'none'}}><Motion onRunningChange={setMotionRunning} onMotionEvent={onMotionEvent} stopToken={motionStopToken}/></div>{page==='community'&&<Community posts={posts} user={user} initialView={communityView} onPost={addPost} onComment={addComment} onReport={reportPost} onRemove={removePost} onEditPost={updatePost} onOpenProfile={()=>setProfileOpen(true)} requireAuth={requireAuth} saved={saved} onToggleSave={toggleSaved} loading={loading} notify={notify}/ >}{page==='admin'&&role==='admin'&&<AdminPanel notify={notify} onRefreshPosts={loadPosts}/ >}{page==='assistant'&&<Assistant user={user} notify={notify}/ >}{page==='education'&&<Education user={user} role={role} notify={notify} openAuth={()=>setAuthOpen(true)}/>}</main>{motionPanel&&<section className="motion-notification-panel"><div className="motion-notification-head"><b>Thông báo Motion Insight</b><button className="icon-button" onClick={()=>setMotionPanel(false)} aria-label="Đóng thông báo"><X size={17}/></button></div>{motionEvents.length===0?<p>Chưa có thông báo trong phiên này.</p>:<>{motionEvents.map(e=><div className={"motion-event "+e.level} key={e.id}><strong>Ghi nhận chuyển động lặp lại · {e.channel||'Tín hiệu'}</strong><small>{new Date(e.time).toLocaleTimeString('vi-VN')} · {e.frequency} chu kỳ/phút (ước tính)</small><p>Chỉ là tín hiệu thử nghiệm, không xác định tic hoặc bệnh lý.</p></div>)}<button className="btn btn-outline small" onClick={()=>setMotionEvents([])}>Xóa lịch sử phiên</button></>}</section>}<footer className="footer">© 2026 TICare · Nền tảng thông tin và hỗ trợ giáo viên · Không thay thế đánh giá chuyên môn y tế</footer></div><nav className="mobile-bottom-nav" aria-label="Điều hướng TICare trên điện thoại">{NAV.map(n=><button type="button" key={n.id} className={page===n.id?"active":""} onClick={()=>go(n.id)} aria-current={page===n.id?"page":undefined}><n.icon size={20}/><span>{n.id==="home"?"Trang chủ":n.id==="motion"?"Motion":n.id==="community"?"Cộng đồng":n.id==="assistant"?"Chatbot":"Education"}</span></button>)}</nav>{authOpen&&<AuthModal onClose={()=>setAuthOpen(false)} onSuccess={u=>{setUser(u);setAuthOpen(false);notify('Đăng nhập thành công!')}} notify={notify}/ >}{profileOpen&&user&&<ProfileModal profile={profile} user={user} posts={posts} saved={saved} onClose={()=>setProfileOpen(false)} onUpdate={updateProfile} onGoMyPosts={()=>{setProfileOpen(false);setCommunityView('mine');go('community');}}/>}{resetOpen&&<ResetPasswordModal onClose={()=>setResetOpen(false)} notify={notify}/>}{toast&&<div className="toast"><Info size={18}/>{toast}<button onClick={()=>setToast('')}><X size={16}/></button></div>}</div>}
function Heading({eyebrow,title,desc,action}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{desc&&<p>{desc}</p>}</div>{action}</div>}
function Home({go,posts}){return <><div className="hero"><div className="hero-content"><span className="hero-tag"><span className="glow-dot"/> NỀN TẢNG GIÁO DỤC HÒA NHẬP</span><h1>Hiểu đúng để<br/><em>đồng hành tốt hơn.</em></h1><p>TICare kết nối công nghệ, tri thức và sự thấu cảm — hỗ trợ giáo viên tạo nên một lớp học nơi mỗi sự khác biệt đều được tôn trọng.</p><div className="hero-buttons"><button className="btn btn-mint" onClick={()=>go('assistant')}>Khám phá trợ lý AI <ArrowRight size={17}/></button><button className="btn btn-ghost" onClick={()=>go('motion')}>Thử camera <ScanEye size={17}/></button></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="heart-core"><HeartHandshake size={70} strokeWidth={1.4}/></div><div className="floating f1"><BookOpen size={19}/> Kiến thức</div><div className="floating f2"><UsersRound size={19}/> Cộng đồng</div><div className="floating f3"><Activity size={19}/> Công nghệ</div></div></div><div className="section-row"><div><h2>Khám phá TICare</h2><p>Mọi công cụ cần thiết, trong một không gian thống nhất.</p></div></div><div className="feature-grid">{[{id:'motion',icon:ScanEye,color:'teal',title:'Quan sát vận động',desc:'Camera nhận diện điểm khớp và mô tả tín hiệu chuyển động lặp lại.'},{id:'community',icon:UsersRound,color:'blue',title:'Cộng đồng giáo dục',desc:'Chia sẻ bài viết, tài liệu và kinh nghiệm hỗ trợ học sinh.'},{id:'assistant',icon:Bot,color:'violet',title:'Trợ lý thông tin AI',desc:'Tra cứu, diễn giải tiếng Việt và dẫn nguồn kiến thức về tic.'},{id:'education',icon:GraduationCap,color:'amber',title:'TICare Education',desc:'Bài học, tình huống lớp học và hướng dẫn giáo dục hòa nhập.'}].map(x=><button className="feature-card" key={x.id} onClick={()=>go(x.id)}><div className={'feature-icon '+x.color}><x.icon size={24}/></div><h3>{x.title}</h3><p>{x.desc}</p><span>Khám phá <ArrowRight size={15}/></span></button>)}</div><div className="home-lower"><div className="panel"><div className="panel-title"><h3>Bài viết mới từ cộng đồng</h3><button className="link-button" onClick={()=>go('community')}>Xem tất cả <ArrowRight size={15}/></button></div>{posts.slice(0,3).map(p=><div className="compact-post" key={p.id}><span className="post-category">{p.category}</span><b>{p.title}</b><small>{p.author} · {fmt(p.created_at)}</small></div>)}</div><div className="panel tip-panel"><div className="tip-icon"><Heart size={24}/></div><h3>Một lời nhắc nhỏ</h3><p>Không phải mọi chuyển động lặp lại đều là tic. Một công cụ quan sát chỉ có thể hỗ trợ mô tả chuyển động — không thể thay thế đánh giá của chuyên gia.</p><button className="link-button" onClick={()=>go('education')}>Tìm hiểu thêm <ArrowRight size={15}/></button></div></div></>}

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
    const text = error?.message || "Đã xảy ra lỗi.";

    if (/invalid login credentials/i.test(text)) {
      return "Email hoặc mật khẩu không chính xác.";
    }

    if (/email not confirmed/i.test(text)) {
      return "Tài khoản chưa xác nhận email. Hãy kiểm tra hộp thư.";
    }

    if (/user already registered/i.test(text)) {
      return "Email này đã được đăng ký. Hãy đăng nhập hoặc đặt lại mật khẩu.";
    }

    if (/password should be|weak password/i.test(text)) {
      return "Mật khẩu chưa đáp ứng yêu cầu bảo mật.";
    }

    if (/rate limit|too many requests|over_email_send_rate_limit/i.test(text)) {
      return "Bạn đã thực hiện quá nhiều yêu cầu. Hãy thử lại sau.";
    }

    if (/failed to fetch|networkerror|network request failed/i.test(text)) {
      return "Không thể kết nối Supabase. Hãy kiểm tra kết nối mạng và cấu hình website.";
    }

    return text;
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
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal auth-modal">
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

        <h2>
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
            <label>
              Tên hiển thị
              <input
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

          <label>
            Địa chỉ email
            <input
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
            <label>
              Mật khẩu
              <input
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
            <label>
              Xác nhận mật khẩu
              <input
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
      </div>
    </div>
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
    <div className="modal-backdrop">
      <div className="modal auth-modal">
        <div className="auth-logo">
          <Lock size={28} />
        </div>

        <h2>Đặt lại mật khẩu</h2>
        <p>Hãy tạo mật khẩu mới cho tài khoản TICare.</p>

        <form className="form-stack" onSubmit={submit}>
          <label>
            Mật khẩu mới
            <input
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

          <label>
            Xác nhận mật khẩu mới
            <input
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
      </div>
    </div>
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
              <button className="icon-button" title="Sửa bài" onClick={()=>setEditing(p)}><FileText size={17}/></button>
              <button className="icon-button danger" title="Xóa bài" onClick={()=>onRemove(p.id)}><Trash2 size={17}/></button>
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
  return <div className="modal-backdrop"><div className="modal compose-modal">
    <button className="close" onClick={onClose} disabled={busy}><X/></button>
    <h2>Chỉnh sửa bài viết</h2><p>Chỉ bạn mới có thể chỉnh sửa bài viết này.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Tiêu đề<input required minLength={3} maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Chủ đề<select value={category} onChange={e=>setCategory(e.target.value)}>{['Kiến thức về tic','Tài nguyên giáo dục','Tình huống lớp học','Kinh nghiệm chia sẻ'].map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Nội dung<textarea required minLength={5} maxLength={20000} rows={8} value={body} onChange={e=>setBody(e.target.value)}/></label>
      <p className="small-text muted">Tệp đính kèm hiện có được giữ nguyên.</p>
      <button className="btn btn-primary full" disabled={busy}>{busy?'Đang lưu...':'Lưu thay đổi'} <CheckCircle2 size={17}/></button>
    </form>
  </div></div>;
}

function ProfileModal({profile,user,posts,saved,onClose,onUpdate,onGoMyPosts}) {
  const [name,setName]=useState(profile?.display_name||user.user_metadata?.display_name||'');
  const [busy,setBusy]=useState(false);
  async function save(e){e.preventDefault();if(busy)return;setBusy(true);try{if(await onUpdate(name))onClose()}finally{setBusy(false)}}
  const myCount=posts.filter(p=>p.author_id===user.id).length;
  return <div className="modal-backdrop"><div className="modal auth-modal">
    <button className="close" onClick={onClose}><X size={20}/></button>
    <div className="auth-logo"><UserRound size={25}/></div><h2>Hồ sơ của tôi</h2>
    <p className="small-text muted">Tài khoản: {user.email}</p>
    <div style={{display:'flex',gap:12,margin:'16px 0'}}>
      <div className="panel" style={{flex:1,textAlign:'center',padding:12}}><b>{myCount}</b><div className="small-text muted">Bài đã đăng</div></div>
      <div className="panel" style={{flex:1,textAlign:'center',padding:12}}><b>{saved.length}</b><div className="small-text muted">Bài đã lưu</div></div>
    </div>
    <form className="form-stack" onSubmit={save}><label>Tên hiển thị<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
      <button className="btn btn-primary full" disabled={busy}>{busy?'Đang lưu...':'Lưu tên hiển thị'}</button></form>
    <button className="btn btn-outline full" style={{marginTop:12}} onClick={onGoMyPosts}>Xem bài viết của tôi <ArrowRight size={17}/></button>
    <p className="small-text muted" style={{marginTop:14}}>TICare chỉ hiển thị tên công khai, không công bố email của bạn trên bài viết.</p>
  </div></div>;
}

function ComposeModal({onClose,onPost,loading}){const[title,setTitle]=useState(''),[body,setBody]=useState(''),[category,setCategory]=useState('Tài nguyên giáo dục'),[file,setFile]=useState(null);async function submit(e){e.preventDefault();if(!title.trim()||!body.trim())return;const ok=await onPost({title:title.trim(),body:body.trim(),category},file);if(ok)onClose()}return <div className="modal-backdrop"><div className="modal compose-modal"><button className="close" onClick={onClose}><X/></button><h2>Chia sẻ cùng cộng đồng</h2><p>Những tài liệu nhỏ có thể tạo nên thay đổi lớn.</p><form onSubmit={submit} className="form-stack"><label>Tiêu đề<input required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Đặt tiêu đề dễ hiểu..."/></label><label>Chủ đề<select value={category} onChange={e=>setCategory(e.target.value)}>{['Kiến thức về tic','Tài nguyên giáo dục','Tình huống lớp học','Kinh nghiệm chia sẻ'].map(x=><option key={x}>{x}</option>)}</select></label><label>Nội dung<textarea required rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Chia sẻ bài học, hoạt động, kinh nghiệm... (không đăng dữ liệu riêng tư của học sinh)"/></label><label className="file-input"><Paperclip size={18}/> {file?file.name:'Đính kèm PDF, DOCX, PPTX hoặc ảnh'}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files[0]||null)}/></label><div className="muted small-text">Giới hạn tệp: 8 MB. Không tải thông tin riêng tư của học sinh. Bài đăng công khai sau khi gửi.</div><button disabled={loading} className="btn btn-primary full">{loading?'Đang đăng...':'Đăng bài viết'} <Send size={16}/></button></form></div></div>}
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
    const {error}=await supabase.from('comments').update({body:editBody.trim()}).eq('id',c.id).eq('author_id',user.id);
    if(error)notify('Không thể sửa bình luận: '+error.message);
    else{setEditId(null);await loadComments();notify('Đã sửa bình luận.');}
    setBusyId(null);
  }
  async function deleteComment(c){
    if(!user||c.author_id!==user.id||!window.confirm('Xóa bình luận của bạn?'))return;
    setBusyId(c.id);
    const {error}=await supabase.from('comments').delete().eq('id',c.id).eq('author_id',user.id);
    if(error)notify('Không thể xóa bình luận: '+error.message);
    else{await loadComments();notify('Đã xóa bình luận.');}
    setBusyId(null);
  }
  async function download(){
    if(!post.attachment?.storage_path)return;
    const {data,error}=await supabase.storage.from('community-files').createSignedUrl(post.attachment.storage_path,60);
    if(error){notify('Không thể mở tài liệu: '+error.message);return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }
  return <div className="modal-backdrop"><div className="modal post-modal">
    <button className="close" onClick={onClose}><X/></button>
    <span className="post-category">{post.category}</span><h2>{post.title}</h2>
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
        <input maxLength={3000} value={text} onChange={e=>setText(e.target.value)} placeholder="Viết bình luận tôn trọng và tích cực..."/>
        <button className="btn btn-primary" disabled={!text.trim()||sending}><Send size={16}/></button>
      </form>
    </div>
  </div></div>;
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
  return <div className="modal-backdrop"><div className="modal report-modal">
    <button className="close" onClick={onClose}><X/></button><h2>Báo cáo nội dung</h2>
    <p>Báo cáo sẽ được quản trị viên xem xét, không tự động xóa bài.</p>
    <div className="report-target">{post.title}</div>
    <div className="form-stack"><label>Lý do báo cáo<select value={reason} onChange={e=>setReason(e.target.value)}>
      {reasons.map(x=><option key={x}>{x}</option>)}
    </select></label>
    <button className="btn btn-primary full" disabled={busy} onClick={sendReport}>{busy?'Đang gửi...':'Gửi báo cáo'} <Flag size={16}/></button></div>
  </div></div>;
}

function AdminPanel({notify,onRefreshPosts}) {
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
        const {error}=await supabase.from('posts').update({status}).eq('id',item.post_id);
        if(error)throw error;
      }
      if(action==='hide'||action==='dismiss'){
        const {error}=await supabase.from('reports')
          .update({status:action==='hide'?'reviewed':'dismissed'}).eq('id',item.id);
        if(error)throw error;
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

function Assistant({user,notify}){const[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false),[showTopics,setShowTopics]=useState(true);const bottom=useRef(null);useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages,busy]);function ask(q){if(!q.trim()||busy)return;setQuestion('');const result=localAnswer(q);setMessages(p=>[...p,{role:'user',text:q},{role:'assistant',text:result.answer,sources:result.sources||[],mode:'demo',topic:result.topic,note:result.note}]);}return <><Heading eyebrow="THƯ VIỆN TRI THỨC · DEMO OFFLINE" title="Trợ lý kiến thức TICare" desc="Khám phá câu trả lời được biên soạn sẵn về tic và giáo dục hòa nhập. Không dùng API trả phí, không chẩn đoán."/><div className="assistant-shell"><div className="chat-main"><div className="chat-top"><div className="chat-avatar"><Bot size={22}/></div><div><b>TICare Knowledge Assistant</b><small>Thư viện trả lời theo chủ đề · Không phải AI trực tuyến</small></div><span className="chat-tag"><ShieldCheck size={13}/> Chế độ demo miễn phí</span></div><div style={{padding:'12px 18px',borderBottom:'1px solid #e2e8f0',display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><span style={{fontSize:13,color:'#475569'}}>15 chủ đề kiến thức, không cần API key hoặc mật khẩu.</span><button type="button" className="btn btn-outline small" onClick={()=>setShowTopics(v=>!v)}>{showTopics?'Ẩn danh sách câu hỏi':'Hiện danh sách câu hỏi'}</button></div>{showTopics&&<div style={{padding:'14px 18px',borderBottom:'1px solid #e2e8f0',maxHeight:245,overflowY:'auto'}}>{TOPIC_GROUPS.map(group=><div key={group.title} style={{marginBottom:12}}><b style={{display:'block',fontSize:13,marginBottom:7}}>{group.title}</b><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{group.ids.map(id=>{const t=QUESTION_BANK.find(x=>x.id===id);return t?<button key={id} type="button" className="btn btn-outline small" onClick={()=>ask(t.examples[0])} style={{whiteSpace:'normal',textAlign:'left'}}>{t.title}</button>:null})}</div></div>)}</div>}<div className="chat-history">{messages.length===0&&<div className="chat-welcome"><div className="big-bot"><Bot size={34}/></div><h2>Chào mừng đến thư viện TICare!</h2><p>Chọn câu hỏi mẫu hoặc nhập câu hỏi theo chủ đề. Đây là bản minh họa nội dung biên soạn, không tạo câu trả lời bằng AI.</p><div className="suggestions">{SUGGESTIONS.slice(0,6).map(s=><button key={s} onClick={()=>ask(s)}>{s}<ArrowRight size={14}/></button>)}</div></div>}{messages.map((m,i)=><div className={'chat-bubble-row '+m.role} key={i}>{m.role==='assistant'&&<div className="tiny-bot"><Bot size={17}/></div>}<div className={'chat-bubble '+m.role}><div className="chat-text" style={{whiteSpace:'pre-line'}}>{m.text}</div>{m.role==='assistant'&&<><div className="sources"><b><BookOpen size={15}/> Nguồn đọc thêm (không tra cứu trực tiếp)</b>{m.sources?.map((s,j)=><a key={j} href={s.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{s.name||s.title||s.url}</a>)}</div><div className="answer-note">● Câu trả lời mẫu · {m.topic?m.topic+' · ':''}{m.note}</div></>}</div></div>)}<div ref={bottom}/></div><form className="chat-input" onSubmit={e=>{e.preventDefault();ask(question)}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Hỏi về tic, giáo dục hòa nhập, Motion Insight..."/><button disabled={!question.trim()} className="btn btn-primary"><Send size={18}/></button></form><div className="chat-disclaimer"><Info size={14}/> Trợ lý này hoạt động bằng thư viện câu trả lời mẫu, không gọi AI trực tuyến và không truy cập Internet. AI thực sự là hướng phát triển tương lai.</div></div><aside className="chat-side"><div className="panel"><h3>Nguyên tắc trả lời</h3><div className="principle"><CheckCircle2 size={17}/> Thông tin giáo dục bằng tiếng Việt</div><div className="principle"><CheckCircle2 size={17}/> Nguồn để tự đọc thêm</div><div className="principle"><CheckCircle2 size={17}/> Không chẩn đoán</div><div className="principle"><CheckCircle2 size={17}/> Không phân tích camera</div></div><div className="panel"><h3>Thư viện nguồn</h3>{SOURCES.map(s=><a className="source-link" href={s.url} key={s.url} target="_blank" rel="noreferrer"><BookOpen size={17}/><span>{s.name}</span><ExternalLink size={13}/></a>)}</div></aside></div></>}
// Motion Insight: các kênh tín hiệu kỹ thuật độc lập, KHÔNG phải bộ phân loại tic.
const MOTION_CHANNELS = [
  {id:'body',label:'Toàn thân (33 điểm)',color:'#14b8a6'},
  {id:'head',label:'Đầu / cổ',color:'#0d9488'},
  {id:'shoulder',label:'Vai',color:'#6366f1'},
  {id:'left',label:'Tay trái',color:'#f59e0b'},
  {id:'right',label:'Tay phải',color:'#ec4899'},
  {id:'blink',label:'Chớp mắt',color:'#06b6d4'},
  {id:'face',label:'Cơ mặt / hàm',color:'#a855f7'}
];

function motionFrequency(samples, sensitivity=60) {
  if(samples.length<17) return null;
  // Mẫu cách nhau ~100ms, thời gian thực được dùng để tính chu kỳ.
  const values=samples.map(s=>s.value);
  const smoothed=values.map((_,i)=>{
    const a=Math.max(0,i-1),b=Math.min(values.length-1,i+1);
    return values.slice(a,b+1).reduce((x,y)=>x+y,0)/(b-a+1);
  });
  const sorted=[...smoothed].sort((x,y)=>x-y);
  const amp=sorted[Math.floor(sorted.length*.9)]-sorted[Math.floor(sorted.length*.1)];
  const minAmp=.075-(sensitivity/100)*.065; // 0.01 ... 0.075 (tín hiệu chuẩn hóa)
  if(amp<minAmp) return null;
  const avg=smoothed.reduce((x,y)=>x+y,0)/smoothed.length;
  const peaks=[];
  for(let i=2;i<smoothed.length-2;i++) {
    const t=samples[i].t;
    if(smoothed[i]>avg+amp*.13 && smoothed[i]>=smoothed[i-1] && smoothed[i]>smoothed[i+1] &&
      (!peaks.length || t-samples[peaks.at(-1)].t>.38)) peaks.push(i);
  }
  if(peaks.length<3) return null;
  const durations=peaks.slice(1).map((id,j)=>samples[id].t-samples[peaks[j]].t);
  const mean=durations.reduce((x,y)=>x+y,0)/durations.length;
  if(mean<.38||mean>3.2) return null;
  const cv=Math.sqrt(durations.reduce((x,y)=>x+(y-mean)**2,0)/durations.length)/mean;
  if(cv>(.27+sensitivity*.003)) return null;
  return +Math.min(155,60/mean).toFixed(1);
}

function Motion({onRunningChange,onMotionEvent,stopToken}) {
  const video=useRef(null),canvas=useRef(null),poseModel=useRef(null),faceModel=useRef(null);
  const mediaStream=useRef(null),frame=useRef(null),active=useRef(false),fileUrl=useRef(null);
  const samples=useRef({}),series=useRef([]),lastAt=useRef(0),startedAt=useRef(0),previousPose=useRef(null);
  const activeLevel=useRef({}),lastNotify=useRef({}),callbacks=useRef({});
  const [running,setRunning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [source,setSource]=useState('camera'),[persons,setPersons]=useState(0),[faceAvailable,setFaceAvailable]=useState(false);
  const [elapsed,setElapsed]=useState(0),[status,setStatus]=useState('Chưa có dữ liệu'),[measurements,setMeasurements]=useState({});
  const [sensitivity,setSensitivity]=useState(60),[threshold,setThreshold]=useState(20);
  const [holdSeconds,setHoldSeconds]=useState(2),[cooldownSeconds,setCooldownSeconds]=useState(20);
  const [sound,setSound]=useState(true),[desktopNotice,setDesktopNotice]=useState(false);
  const [overlay,setOverlay]=useState(null),[snapshot,setSnapshot]=useState([]);
  const [chartChannel,setChartChannel]=useState('head');
  const [showAllPoints,setShowAllPoints]=useState(true);
  callbacks.current={onRunningChange,onMotionEvent,sensitivity,threshold,holdSeconds,cooldownSeconds,sound,desktopNotice};

  function clearModels(){
    try{poseModel.current?.close()}catch{}
    try{faceModel.current?.close()}catch{}
    poseModel.current=null;faceModel.current=null;
  }
  const stop=useCallback(()=>{
    active.current=false;
    if(frame.current)cancelAnimationFrame(frame.current);
    frame.current=null;
    mediaStream.current?.getTracks().forEach(t=>t.stop());mediaStream.current=null;
    if(video.current){video.current.pause();video.current.srcObject=null;video.current.removeAttribute('src');video.current.load()}
    if(fileUrl.current){URL.revokeObjectURL(fileUrl.current);fileUrl.current=null}
    clearModels();setRunning(false);callbacks.current.onRunningChange?.(false);
    setPersons(0);setStatus('Đã dừng');
  },[]);
  useEffect(()=>()=>stop(),[stop]);
  useEffect(()=>{if(stopToken>0)stop()},[stopToken,stop]);
  useEffect(()=>{if(!overlay)return;const id=setTimeout(()=>setOverlay(null),7500);return()=>clearTimeout(id)},[overlay]);

  function beep(){
    if(!callbacks.current.sound)return;
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)return;
      const a=new AudioCtx(),o=a.createOscillator(),g=a.createGain();
      o.type='sine';o.frequency.value=660;g.gain.value=.035;
      o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.23);
      o.onended=()=>a.close();
    }catch(e){console.debug('Âm báo bị trình duyệt chặn',e)}
  }
  function emit(channel,frequency){
    const item={id:crypto.randomUUID(),channel,frequency,time:Date.now(),level:'warning'};
    callbacks.current.onMotionEvent?.(item);
    setOverlay(item);beep();
    if(callbacks.current.desktopNotice && document.hidden && 'Notification' in window && Notification.permission==='granted'){
      try{new Notification('TICare: tín hiệu chuyển động lặp lại',{body:`${channel} · ${frequency} chu kỳ/phút (ước tính). Không kết luận tic.`})}catch{}
    }
  }
  function inspectSignal(id,frequency,now){
    const cfg=callbacks.current;
    if(frequency===null||frequency<cfg.threshold){delete activeLevel.current[id];return}
    if(!activeLevel.current[id]){activeLevel.current[id]=now;return}
    if(now-activeLevel.current[id] >= cfg.holdSeconds*1000 && now-(lastNotify.current[id]??-Infinity)>=cfg.cooldownSeconds*1000){
      lastNotify.current[id]=now;activeLevel.current[id]=now;
      emit(MOTION_CHANNELS.find(x=>x.id===id)?.label||id,frequency);
    }
  }
  function getSignals(pts,face){
    const signal={};
    if(pts?.[11]&&pts?.[12]&&pts?.[23]&&pts?.[24]){
      const mid=(i,j)=>({x:(pts[i].x+pts[j].x)/2,y:(pts[i].y+pts[j].y)/2});
      const shoulders=mid(11,12),hips=mid(23,24);
      const scale=Math.max(.065,Math.hypot(shoulders.x-hips.x,shoulders.y-hips.y));
      const v=i=>pts[i]?.visibility===undefined||pts[i].visibility>.45;
      // Gộp năng lượng dịch chuyển tương đối của 33 điểm (RMS), KHÔNG nhân tọa độ.
      const normalized=pts.map(p=>({x:(p.x-hips.x)/scale,y:(p.y-hips.y)/scale,visibility:p.visibility??1}));
      if(previousPose.current){
        let sum=0,n=0;
        for(let i=0;i<normalized.length;i++){
          const old=previousPose.current[i],cur=normalized[i];
          if(old && old.visibility>.45 && cur.visibility>.45){
            sum+=(cur.x-old.x)**2+(cur.y-old.y)**2;n++;
          }
        }
        if(n>=12)signal.body=Math.sqrt(sum/n);
      }
      previousPose.current=normalized;
      // Tương quan so với thân người, giảm ảnh hưởng chuyển động chung của camera.
      if(v(0))signal.head=(pts[0].x-shoulders.x)/scale;
      if(v(11)&&v(12))signal.shoulder=(pts[11].y-pts[12].y)/scale;
      if(v(15)&&v(13))signal.left=(pts[15].y-pts[13].y)/scale;
      if(v(16)&&v(14))signal.right=(pts[16].y-pts[14].y)/scale;
    }
    if(!pts)previousPose.current=null;
    const shapes=face?.faceBlendshapes?.[0]?.categories;
    if(shapes?.length){
      const get=n=>shapes.find(c=>c.categoryName===n)?.score||0;
      signal.blink=Math.max(get('eyeBlinkLeft'),get('eyeBlinkRight'));
      signal.face=Math.max(get('jawOpen'),get('browDownLeft'),get('browDownRight'),get('mouthFrownLeft'),get('mouthFrownRight'));
    }
    return signal;
  }
  async function start(upload){
    if(busy)return;
    stop();setBusy(true);setError('');setOverlay(null);setSnapshot([]);
    samples.current={};series.current=[];previousPose.current=null;activeLevel.current={};lastNotify.current={};lastAt.current=0;
    try{
      const {PoseLandmarker,FaceLandmarker,FilesetResolver,DrawingUtils}=await import('@mediapipe/tasks-vision');
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
      poseModel.current=await PoseLandmarker.createFromOptions(vision,{
        baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},
        runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minTrackingConfidence:.5
      });
      try{
        faceModel.current=await FaceLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},
          runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true
        });
        setFaceAvailable(true);
      }catch(e){console.warn('Không tải được mô hình khuôn mặt, tiếp tục phân tích tư thế',e);setFaceAvailable(false)}
      if(upload){
        if(!upload.type.startsWith('video/'))throw Error('Vui lòng chọn tệp video hợp lệ.');
        if(upload.size>100*1024*1024)throw Error('Video thử nghiệm tối đa 100 MB.');
        fileUrl.current=URL.createObjectURL(upload);
        video.current.src=fileUrl.current;
        setSource('video');
      }else{
        if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera yêu cầu HTTPS và trình duyệt hỗ trợ.');
        mediaStream.current=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
        video.current.srcObject=mediaStream.current;
        setSource('camera');
      }
      await video.current.play();
      const draw=new DrawingUtils(canvas.current.getContext('2d'));
      active.current=true;setRunning(true);callbacks.current.onRunningChange?.(true);
      startedAt.current=performance.now();
      let lastTimestamp=-1;
      const loop=()=>{
        if(!active.current || !video.current)return;
        const v=video.current,c=canvas.current;
        if(v.ended){setStatus('Video đã phát hết');stop();return}
        if(v.readyState>=2 && v.videoWidth>0 && v.currentTime!==lastTimestamp){
          lastTimestamp=v.currentTime;
          const now=performance.now();
          if(now-lastAt.current>=100){
            lastAt.current=now;
            c.width=v.videoWidth;c.height=v.videoHeight;
            const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
            const pose=poseModel.current.detectForVideo(v,now);
            const pts=pose.landmarks?.[0];setPersons(pose.landmarks?.length||0);
            if(pts){
              draw.drawConnectors(pts,PoseLandmarker.POSE_CONNECTIONS,{color:'#75e4cf',lineWidth:2});
              if(showAllPointsRef.current)draw.drawLandmarks(pts,{color:'#faffff',fillColor:'#0e9e86',radius:2});
            }
            let face=null;
            if(faceModel.current){
              try{
                face=faceModel.current.detectForVideo(v,now);
                if(face?.faceLandmarks?.[0] && showAllPointsRef.current){
                  draw.drawConnectors(face.faceLandmarks[0],FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,{color:'#7dd3fc',lineWidth:1});
                  draw.drawConnectors(face.faceLandmarks[0],FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,{color:'#7dd3fc',lineWidth:1});
                  draw.drawConnectors(face.faceLandmarks[0],FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,{color:'#7dd3fc',lineWidth:1});
                  draw.drawConnectors(face.faceLandmarks[0],FaceLandmarker.FACE_LANDMARKS_LIPS,{color:'#7dd3fc',lineWidth:1});
                  draw.drawConnectors(face.faceLandmarks[0],FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,{color:'#7dd3fc',lineWidth:1});
                  draw.drawConnectors(face.faceLandmarks[0],FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,{color:'#7dd3fc',lineWidth:1});
                }
              }catch(e){console.debug('Tạm bỏ qua khung hình khuôn mặt',e)}
            }
            const vals=getSignals(pts,face),t=(now-startedAt.current)/1000;
            const current={};
            for(const ch of MOTION_CHANNELS){
              const value=vals[ch.id];
              if(!Number.isFinite(value)){delete samples.current[ch.id];inspectSignal(ch.id,null,now);continue}
              const arr=samples.current[ch.id]||[];
              arr.push({t,value});while(arr.length && t-arr[0].t>7)arr.shift();
              samples.current[ch.id]=arr;
              const f=motionFrequency(arr,callbacks.current.sensitivity);
              current[ch.id]=f;
              inspectSignal(ch.id,f,now);
            }
            series.current.push({t,...vals});
            if(series.current.length>900)series.current.shift();
            setMeasurements(current);
            setSnapshot(series.current.slice(-70));
            setElapsed(Math.round(t));
            setStatus(Object.values(current).some(x=>x!==null)?'Đang ghi nhận chu kỳ chuyển động':'Đang phân tích / chưa có chu kỳ ổn định');
          }
        }
        frame.current=requestAnimationFrame(loop);
      };
      frame.current=requestAnimationFrame(loop);
    
} catch (e) {
  console.error("TICare Motion Insight startup error:", e);

  const detail =
    e?.message ||
    e?.name ||
    String(e) ||
    "Lỗi không xác định";

  stop();
  setError("Không thể khởi động: " + detail);
}

    finally{setBusy(false)}
  }
  const showAllPointsRef=useRef(showAllPoints);showAllPointsRef.current=showAllPoints;
  async function enableDesktop(){
    if(!('Notification' in window)){setError('Trình duyệt không hỗ trợ thông báo hệ thống.');return}
    const result=await Notification.requestPermission();setDesktopNotice(result==='granted');
    if(result!=='granted')setError('Chưa cấp quyền thông báo hệ thống. Cảnh báo trong TICare vẫn hoạt động.');
  }
  function downloadCsv(){
    if(!series.current.length)return;
    const lines=['giay,body,head,shoulder,left,right,blink,face',...series.current.map(r=>[r.t.toFixed(2),...MOTION_CHANNELS.map(ch=>Number.isFinite(r[ch.id])?r[ch.id].toFixed(4):'')].join(','))];
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ticare-motion-signals.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  const chartData=snapshot.filter(p=>Number.isFinite(p[chartChannel]));
  const values=chartData.map(p=>p[chartChannel]);
  const low=Math.min(...values,0),high=Math.max(...values,1);
  const points=chartData.map((p,i)=>`${16+(i/Math.max(1,chartData.length-1))*668},${130-((p[chartChannel]-low)/Math.max(.01,high-low))*106}`).join(' ');
  function downloadChart(){
    if(!chartData.length)return;
    const label=MOTION_CHANNELS.find(x=>x.id===chartChannel)?.label||chartChannel;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="190" viewBox="0 0 720 190"><rect width="720" height="190" rx="12" fill="#0a2733"/><text x="18" y="22" fill="white" font-size="15">TICare Motion Insight — ${label}</text><polyline fill="none" stroke="#6ee7d3" stroke-width="3" points="${points}"/><text x="18" y="174" fill="#aac6cb" font-size="11">Tín hiệu thử nghiệm • không xác định tic • không phải dữ liệu y tế</text></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='ticare-bieu-do.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  const top=Object.entries(measurements).filter(([,f])=>f!==null).sort((a,b)=>b[1]-a[1])[0];
  return <div className="mi-v2">
    <Heading eyebrow="MOTION INSIGHT · PHÂN TÍCH CHUYỂN ĐỘNG" title="Không gian quan sát" desc="Phân tích tín hiệu tại thiết bị. Đo chuyển động lặp lại, không xác định tic hay bệnh lý."/>
    <div className="mi-v2-top">
      <div className="mi-v2-stat"><span>Trạng thái</span><strong>{running?'Đang quan sát':'Sẵn sàng'}</strong><small>{status}</small></div>
      <div className="mi-v2-stat"><span>Thời lượng</span><strong>{elapsed} giây</strong><small>Phiên hiện tại</small></div>
      <div className="mi-v2-stat"><span>Tín hiệu nổi bật</span><strong>{top?`${top[1]} chu kỳ/phút`:'—'}</strong><small>{top?MOTION_CHANNELS.find(x=>x.id===top[0])?.label:'Chưa đủ dữ liệu'}</small></div>
    </div>
    <div className="mi-v2-layout">
      <section className="mi-v2-main">
        <div className="mi-v2-camera">
          <div className="mi-v2-camera-top"><span className={'mi-v2-live '+(running?'on':'')}><span/> {running?'CAMERA / VIDEO ĐANG CHẠY':'CHƯA BẬT NGUỒN'}</span><span><ShieldCheck size={14}/> Xử lý cục bộ</span></div>
          <div className="mi-v2-stage">
            {!running&&<div className="mi-v2-placeholder"><div className="mi-v2-target"><ScanEye size={45}/></div><b>Motion Insight</b><h2>Sẵn sàng quan sát</h2><p>Bật webcam USB hoặc chọn một video thử nghiệm được phép sử dụng.</p><span>Phân tích chuyển động, không chẩn đoán tic</span></div>}
            <video ref={video} playsInline muted autoPlay style={{display:running?'block':'none'}}/>
            <canvas ref={canvas} style={{display:running?'block':'none'}}/>
            {running&&<div className="mi-v2-stamp"><Activity size={15}/> {persons?`${persons} người được nhận diện`:'Đang tìm người trong khung hình'}</div>}
            {overlay&&<div role="alert" className="mi-v2-alert"><div className="mi-v2-alert-icon"><BellRing size={26}/></div><div><strong>GHI NHẬN CHUYỂN ĐỘNG LẶP LẠI</strong><p>{overlay.channel} · khoảng {overlay.frequency} chu kỳ/phút</p><small>Thông báo kỹ thuật, không kết luận về tic</small></div><button type="button" onClick={()=>setOverlay(null)} aria-label="Đóng cảnh báo"><X size={18}/></button></div>}
          </div>
          {error&&<div className="mi-v2-error"><AlertTriangle size={17}/>{error}</div>}
          <div className="mi-v2-controls">
            <button type="button" className="btn btn-primary" onClick={()=>start()} disabled={busy}>{busy?'Đang tải mô hình...':running?'Khởi động lại camera':'Bật camera USB'} <Camera size={17}/></button>
            {running&&<button type="button" className="btn btn-outline" onClick={stop}><CameraOff size={17}/> Dừng</button>}
            <label className="mi-v2-upload"><UploadCloud size={17}/> Tải video thử<input type="file" accept="video/*" onChange={e=>{const f=e.target.files?.[0];if(f)start(f);e.target.value=''}}/></label>
          </div>
        </div>
        <div className="mi-v2-panel">
          <div className="mi-v2-heading"><div><h3><Activity size={18}/> Biểu đồ tín hiệu</h3><p>Đường tín hiệu tương đối trong vài giây gần nhất; không phải biểu đồ chẩn đoán.</p></div><div className="mi-v2-exports"><button type="button" onClick={downloadChart} disabled={!chartData.length}><Download size={15}/> SVG</button><button type="button" onClick={downloadCsv} disabled={!series.current.length}><Download size={15}/> CSV</button></div></div>
          <div className="mi-v2-tabs">{MOTION_CHANNELS.map(ch=><button type="button" key={ch.id} className={chartChannel===ch.id?'active':''} onClick={()=>setChartChannel(ch.id)}>{ch.label}</button>)}</div>
          <div className="mi-v2-graph"><svg viewBox="0 0 700 155" preserveAspectRatio="none" aria-label="Biểu đồ tín hiệu chuyển động"><g stroke="#dceee9" strokeWidth="1">{[25,60,95,130].map(y=><line key={y} x1="0" x2="700" y1={y} y2={y}/>)}</g>{chartData.length>2&&<polyline points={points} fill="none" stroke={MOTION_CHANNELS.find(x=>x.id===chartChannel)?.color||'#0d9488'} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}</svg>{chartData.length<3&&<span>Chưa có dữ liệu cho kênh này</span>}</div>
          <div className="mi-v2-channels">{MOTION_CHANNELS.map(ch=><div key={ch.id}><span style={{background:ch.color}}/><label>{ch.label}</label><strong>{measurements[ch.id]===null||measurements[ch.id]===undefined?'—':`${measurements[ch.id]} /phút`}</strong></div>)}</div>
        </div>
      </section>
      <aside className="mi-v2-sidebar">
        <div className="mi-v2-panel mi-v2-settings">
          <h3><Settings size={18}/> Cấu hình quan sát</h3>
          <p>Điều chỉnh ngưỡng thử nghiệm, không phải ngưỡng y khoa.</p>
          <div className="mi-v2-setting"><div><label>Độ nhạy phân tích</label><strong>{sensitivity}%</strong></div><input type="range" min="10" max="100" step="5" value={sensitivity} onChange={e=>setSensitivity(+e.target.value)}/></div>
          <div className="mi-v2-setting"><div><label>Báo khi vượt tần suất</label><strong>{threshold} chu kỳ/phút</strong></div><input type="range" min="10" max="100" step="5" value={threshold} onChange={e=>setThreshold(+e.target.value)}/></div>
          <div className="mi-v2-setting"><div><label>Duy trì tín hiệu</label><strong>{holdSeconds} giây</strong></div><input type="range" min="1" max="10" step="1" value={holdSeconds} onChange={e=>setHoldSeconds(+e.target.value)}/></div>
          <div className="mi-v2-setting"><div><label>Giãn cách giữa hai lần báo</label><strong>{cooldownSeconds} giây</strong></div><input type="range" min="10" max="120" step="5" value={cooldownSeconds} onChange={e=>setCooldownSeconds(+e.target.value)}/></div>
          <label className="mi-v2-toggle"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/><span><b>Âm báo</b><small>Phát tiếng ngắn khi có cảnh báo</small></span></label>
          <label className="mi-v2-toggle"><input type="checkbox" checked={desktopNotice} onChange={e=>e.target.checked?enableDesktop():setDesktopNotice(false)}/><span><b>Thông báo trình duyệt</b><small>Khi tab đang ở nền, nếu được cấp quyền</small></span></label>
          <label className="mi-v2-toggle"><input type="checkbox" checked={showAllPoints} onChange={e=>setShowAllPoints(e.target.checked)}/><span><b>Hiển thị điểm mốc</b><small>Điểm khớp cơ thể và đường viền mắt</small></span></label>
        </div>
        <div className="mi-v2-panel mi-v2-safety"><h3><ShieldCheck size={18}/> Bảo vệ người dùng</h3><p>Camera và video được phân tích trên thiết bị. TICare không tự lưu video. Chỉ sử dụng video được cho phép và không gắn tín hiệu với danh tính học sinh.</p><p>{faceAvailable?'Đã tải mô hình phân tích khuôn mặt.':'Nếu mô hình khuôn mặt không tải được, hệ thống vẫn xử lý các kênh tư thế.'}</p></div>
      </aside>
    </div>
  </div>;
}

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
  const [uploadOpen,setUploadOpen]=useState(false);
  const [uploadBusy,setUploadBusy]=useState(false);
  const [upTitle,setUpTitle]=useState('');
  const [upDesc,setUpDesc]=useState('');
  const [upAge,setUpAge]=useState('lop_1');
  const [upKind,setUpKind]=useState('slide');
  const [upFile,setUpFile]=useState(null);
  const [upUrl,setUpUrl]=useState('');
  const [showAll,setShowAll]=useState(false);
  const [resError,setResError]=useState('');
  const ageLabel=id=>ED_AGES.find(a=>a.id===id)?.label||id;
  const ageMatches=id=>age==='all'||id===age||id==='all';
  const loadResources=useCallback(async()=>{
    if(!supabase){setResError('Chưa kết nối Supabase.');return;}
    setResLoading(true);setResError('');
    const {data,error}=await supabase.from('education_resources')
      .select('id,title,description,audience,kind,storage_path,external_url,status,author_id,created_at')
      .order('created_at',{ascending:false}).limit(150);
    if(error){setResError('Không tải được học liệu: '+error.message);}
    else setResources(data||[]);
    setResLoading(false);
  },[]);
  useEffect(()=>{if(tab==='library')loadResources()},[tab,loadResources,user?.id]);
  async function uploadResource(e){
    e.preventDefault();if(uploadBusy)return;
    if(!user){openAuth?.();return;}
    const title=upTitle.trim(),desc=upDesc.trim();
    if(!title){notify('Nhập tên học liệu.');return;}
    if(!supabase){notify('Chưa kết nối Supabase.');return;}
    let safeUrl=null, path=null;
    if(upKind==='link'){
      try{const parsed=new URL(upUrl.trim());if(parsed.protocol!=='https:')throw Error();safeUrl=parsed.href;}
      catch{notify('Liên kết phải bắt đầu bằng https://');return;}
    }else{
      const allowed={slide:['pptx','pdf'],scratch:['sb3'],document:['pdf','pptx']};
      const ext=upFile?.name?.split('.').pop()?.toLowerCase();
      if(!upFile||!allowed[upKind]?.includes(ext)){notify('Chọn đúng định dạng: PPTX/PDF hoặc Scratch SB3.');return;}
      if(upFile.size>10*1024*1024){notify('Tệp tối đa 10 MB.');return;}
      path=`${user.id}/${uid()}.${ext}`;
    }
    setUploadBusy(true);
    try{
      if(path){
        const result=await supabase.storage.from('education-resources').upload(path,upFile,{upsert:false,contentType:upKind==='scratch'?'application/octet-stream':upFile.type||'application/octet-stream'});
        if(result.error)throw result.error;
      }
      const {error}=await supabase.from('education_resources').insert({title,description:desc,audience:upAge,kind:upKind,storage_path:path,external_url:safeUrl,author_id:user.id,status:'pending'});
      if(error)throw error;
      notify('Đã gửi học liệu! Admin sẽ duyệt trước khi công khai.');
      setUploadOpen(false);setUpTitle('');setUpDesc('');setUpFile(null);setUpUrl('');
      await loadResources();
    }catch(err){
      if(path)await supabase.storage.from('education-resources').remove([path]);
      notify('Không thể tải học liệu: '+(err.message||'Có lỗi xảy ra'));
    }finally{setUploadBusy(false);}
  }
  async function openResource(r){
    if(r.kind==='link'){
      if(!r.external_url?.startsWith('https://')){notify('Liên kết không hợp lệ.');return;}
      window.open(r.external_url,'_blank','noopener,noreferrer');return;
    }
    const {data,error}=await supabase.storage.from('education-resources').createSignedUrl(r.storage_path,60);
    if(error){notify('Không thể mở học liệu: '+error.message);return;}
    // User gesture has passed after await; anchor is preferable to window.open here.
    const a=document.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
  }
  async function decideResource(r,approved){
    if(role!=='admin')return;
    const {error}=await supabase.from('education_resources').update({status:approved?'approved':'rejected'}).eq('id',r.id);
    if(error)notify('Không thể duyệt: '+error.message);
    else{notify(approved?'Đã duyệt học liệu.':'Đã từ chối học liệu.');loadResources();}
  }
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
  const visibleResources=resources.filter(r=>ageMatches(r.audience)&&((r.status==='approved')||(user&&r.author_id===user.id)||(role==='admin'&&showAll)));
  return <div className="edu-v3">
    <Heading eyebrow="TICARE EDUCATION · MẦM NON & LỚP 1–3" title="Học cách thấu hiểu, cùng nhau trưởng thành" desc="Bài học ngắn, trò chơi tương tác và học liệu có thể sử dụng ngay trong lớp. Nội dung giáo dục, không đánh giá sức khỏe học sinh."/>
    <div className="edu-v3-hero"><div><span className="edu-v3-kicker">💚 THƯ VIỆN HỌC TẬP TÍCH CỰC</span><h2>Mỗi khác biệt đều xứng đáng được tôn trọng.</h2><p>Khám phá hoạt động, cùng chơi, cùng học và chia sẻ tài liệu dạy học.</p></div><div className="edu-v3-hero-art" aria-hidden="true">🌈<span>🌱</span></div></div>
    <div className="edu-v3-tabs" role="tablist" aria-label="Các phần TICare Education">
      {[['lessons','Bài học'],['slides','Slide mẫu'],['games','Trò chơi'],['library','Học liệu chia sẻ'],['guidance','Góc đồng hành']].map(([id,label])=><button type="button" role="tab" aria-selected={tab===id} className={tab===id?'active':''} key={id} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    {tab!=='guidance'&&<div className="edu-v3-filters"><span>Độ tuổi:</span><div>{[{id:'all',label:'Tất cả'},...ED_AGES].map(x=><button type="button" key={x.id} className={age===x.id?'active':''} onClick={()=>setAge(x.id)}>{x.label}</button>)}</div></div>}
    {tab==='lessons'&&<div className="edu-v3-grid">{LESSONS.map((l,i)=><button className="edu-v3-tile" key={l.id} onClick={()=>setLesson(l)}><span className="edu-v3-tile-icon">{['🌼','🤝','🌱','🌈'][i%4]}</span><span className="edu-v3-tag">BÀI HỌC · {l.time}</span><b>{l.title}</b><p>{l.description}</p><span className="edu-v3-tile-action">Đọc bài học <ArrowRight size={15}/></span></button>)}</div>}
    {tab==='slides'&&<div className="edu-v3-grid">{ED_SLIDES.filter(s=>ageMatches(s.age)).map(s=><article className="edu-v3-tile" key={s.id}><span className="edu-v3-tile-icon">📊</span><span className="edu-v3-tag">{ageLabel(s.age)} · {s.pages.length} slide</span><b>{s.title}</b><p>{s.desc}</p><button className="btn btn-primary" onClick={()=>{setSlide(s);setSlideIndex(0);}}>Xem và tải PPTX <ArrowRight size={16}/></button></article>)}</div>}
    {tab==='games'&&<div className="edu-v3-grid">{ED_GAMES.filter(g=>ageMatches(g.age)).map(g=><article className="edu-v3-tile" key={g.id}><span className="edu-v3-tile-icon">{g.icon}</span><span className="edu-v3-tag">{ageLabel(g.age)} · {g.minutes} phút</span><b>{g.title}</b><p>{g.desc}</p><button className="btn btn-primary" onClick={()=>startGame(g)}>Chơi thử <ArrowRight size={16}/></button></article>)}</div>}
    {tab==='library'&&<><div className="edu-v3-library-head"><div><h2>Học liệu chia sẻ</h2><p>Nhận bài giảng PPTX/PDF, dự án Scratch SB3 và liên kết trò chơi. Học liệu mới sẽ được duyệt trước khi hiển thị công khai.</p></div><button className="btn btn-primary" onClick={()=>user?setUploadOpen(true):openAuth?.()}><UploadCloud size={17}/> Đăng học liệu</button></div>
      {role==='admin'&&<label className="edu-v3-admin-toggle"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Hiển thị cả học liệu chờ duyệt và đã từ chối</label>}
      {resError&&<p className="edu-v3-error" role="alert">{resError}</p>}
      {resLoading?<p>Đang tải học liệu...</p>:visibleResources.length===0?<div className="edu-v3-empty"><BookOpen size={35}/><b>Chưa có học liệu phù hợp</b><p>Ông có thể chia sẻ bài giảng hoặc trò chơi Scratch đầu tiên!</p></div>:<div className="edu-v3-grid">{visibleResources.map(r=><article className="edu-v3-tile" key={r.id}><span className="edu-v3-tile-icon">{r.kind==='scratch'?'🧩':r.kind==='link'?'🎮':'📂'}</span><span className="edu-v3-tag">{ageLabel(r.audience)} · {r.kind==='scratch'?'Scratch':r.kind==='slide'?'Slide':r.kind==='link'?'Trò chơi online':'Tài liệu'}</span><b>{r.title}</b><p>{r.description||'Học liệu dành cho lớp học.'}</p>{r.status!=='approved'&&<span className="edu-v3-status">{r.status==='pending'?'Chờ duyệt':'Đã từ chối'}</span>}<button className="btn btn-outline" type="button" onClick={()=>openResource(r)}><Download size={16}/> {r.kind==='link'?'Mở trang trò chơi':'Mở / tải học liệu'}</button>{role==='admin'&&r.status==='pending'&&<div className="edu-v3-review"><button type="button" onClick={()=>decideResource(r,true)}>Duyệt</button><button type="button" onClick={()=>decideResource(r,false)}>Từ chối</button></div>}</article>)}</div>}
    </>}
    {tab==='guidance'&&<Support embedded/>}
    {lesson&&<div className="modal-backdrop"><div className="modal lesson-modal"><button className="close" onClick={()=>setLesson(null)} aria-label="Đóng"><X/></button><span className="post-category">{lesson.type} · {lesson.time}</span><h2>{lesson.title}</h2><p>{lesson.description}</p><div className="lesson-content">{lesson.content}</div><div className="auth-hint"><Info size={16}/> Giáo viên điều chỉnh nội dung theo độ tuổi lớp học.</div></div></div>}
    {slide&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSlide(null)}><div className="modal edu-v3-modal"><button className="close" type="button" onClick={()=>setSlide(null)} aria-label="Đóng"><X/></button><span className="edu-v3-tag">SLIDE {slideIndex+1}/{slide.pages.length}</span><div className="edu-v3-slide"><span>{slide.pages[slideIndex].emoji}</span><h2>{slide.pages[slideIndex].title}</h2><p>{slide.pages[slideIndex].body}</p></div><div className="edu-v3-modal-actions"><button className="btn btn-outline" type="button" disabled={slideIndex===0} onClick={()=>setSlideIndex(i=>i-1)}>Trước</button><button className="btn btn-outline" type="button" disabled={slideIndex===slide.pages.length-1} onClick={()=>setSlideIndex(i=>i+1)}>Tiếp</button><button className="btn btn-primary" type="button" onClick={exportSlides}><Download size={16}/> Tải PPTX</button></div></div></div>}
    {game&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setGame(null)}><div className="modal edu-v3-modal"><button className="close" type="button" aria-label="Đóng" onClick={()=>setGame(null)}><X/></button>{gameIndex>=game.questions.length?<div className="edu-v3-game-done"><span>🎉</span><h2>Hoàn thành!</h2><p>Em đã trả lời đúng {gameScore}/{game.questions.length} câu.</p><button className="btn btn-primary" onClick={()=>startGame(game)}>Chơi lại</button></div>:<><span className="edu-v3-tag">CÂU {gameIndex+1}/{game.questions.length} · {game.title}</span><div className="edu-v3-progress"><span style={{width:`${(gameIndex+1)/game.questions.length*100}%`}}/></div><h2 className="edu-v3-question">{game.questions[gameIndex].q}</h2><div className="edu-v3-answers">{game.questions[gameIndex].answers.map((a,i)=><button key={i} type="button" disabled={gameAnswer!==null} className={gameAnswer!==null?(i===game.questions[gameIndex].correct?'correct':i===gameAnswer?'incorrect':''):''} onClick={()=>chooseAnswer(i)}>{a}</button>)}</div>{gameAnswer!==null&&<div className="edu-v3-feedback" role="status"><b>{gameAnswer===game.questions[gameIndex].correct?'Chính xác! 💚':'Cùng học thêm nhé 🌱'}</b><p>{game.questions[gameIndex].explain}</p><button className="btn btn-primary" type="button" onClick={nextQuestion}>{gameIndex===game.questions.length-1?'Xem kết quả':'Câu tiếp theo'} <ArrowRight size={16}/></button></div>}</>}</div></div>}
    {uploadOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&!uploadBusy&&setUploadOpen(false)}><div className="modal edu-v3-modal"><button type="button" className="close" onClick={()=>setUploadOpen(false)} aria-label="Đóng" disabled={uploadBusy}><X/></button><h2>Chia sẻ học liệu</h2><p>Chỉ đăng tài liệu có quyền chia sẻ. Không đưa tên, hình ảnh hoặc hồ sơ sức khỏe của trẻ vào học liệu.</p><form className="form-stack" onSubmit={uploadResource}><label>Tên học liệu<input required maxLength={120} value={upTitle} onChange={e=>setUpTitle(e.target.value)}/></label><label>Giới thiệu ngắn<textarea maxLength={500} rows={3} value={upDesc} onChange={e=>setUpDesc(e.target.value)}/></label><label>Độ tuổi<select value={upAge} onChange={e=>setUpAge(e.target.value)}>{ED_AGES.map(a=><option value={a.id} key={a.id}>{a.label}</option>)}</select></label><label>Loại học liệu<select value={upKind} onChange={e=>{setUpKind(e.target.value);setUpFile(null);setUpUrl('')}}><option value="slide">Bài giảng PPTX / PDF</option><option value="scratch">Dự án Scratch .sb3</option><option value="document">Tài liệu PDF / PPTX</option><option value="link">Liên kết trò chơi online (HTTPS)</option></select></label>{upKind==='link'?<label>Liên kết HTTPS<input type="url" required value={upUrl} onChange={e=>setUpUrl(e.target.value)} placeholder="https://scratch.mit.edu/projects/..."/></label>:<label>Chọn tệp (tối đa 10 MB)<input type="file" required accept={upKind==='scratch'?'.sb3':'.pdf,.pptx'} onChange={e=>setUpFile(e.target.files?.[0]||null)}/></label>}<button className="btn btn-primary full" type="submit" disabled={uploadBusy}>{uploadBusy?'Đang gửi...':'Gửi chờ duyệt'} <UploadCloud size={17}/></button></form></div></div>}
  </div>;
}
function Support({embedded=false}){const[open,setOpen]=useState(0);const situations=[{q:'Khi học sinh có cử động lặp lại trong giờ học?',a:'Giữ thái độ bình tĩnh, tránh gây chú ý không cần thiết hoặc yêu cầu học sinh cố ngừng cử động. Không suy đoán nguyên nhân hay tự chẩn đoán. Nếu có lo ngại, trao đổi riêng một cách tôn trọng và phối hợp với gia đình, bộ phận hỗ trợ phù hợp.'},{q:'Khi học sinh khác trêu chọc hoặc bắt chước?',a:'Can thiệp để chấm dứt hành vi trêu chọc; nhắc lại nguyên tắc tôn trọng khác biệt cho cả lớp. Tránh nêu tên, công khai thông tin sức khỏe hoặc biến một học sinh thành ví dụ minh họa khi chưa có sự đồng ý phù hợp.'},{q:'Khi giáo viên cần trao đổi với phụ huynh?',a:'Nói về những quan sát cụ thể và ảnh hưởng đến việc học thay vì đưa ra kết luận bệnh lý. Hỏi gia đình về những hỗ trợ phù hợp, tôn trọng quyền riêng tư và khuyến khích tìm chuyên gia khi cần.'},{q:'Khi chưa chắc thông tin trên Internet có đáng tin?',a:'Ưu tiên tài liệu từ các tổ chức y tế uy tín như CDC hoặc NHS, xem ngày cập nhật và đối chiếu nhiều nguồn. Trợ lý TICare có thể hỗ trợ tìm hiểu, nhưng không thay thế chuyên gia.'}];return <>{!embedded&&<Heading eyebrow="HỖ TRỢ GIÁO VIÊN" title="Góc đồng hành" desc="Một số gợi ý ứng xử trong môi trường học đường — tôn trọng, riêng tư và lấy học sinh làm trung tâm."/>}<div className="support-layout"><div><div className="section-row"><div><h2>Tình huống thường gặp</h2><p>Chọn tình huống để xem hướng tham khảo.</p></div></div><div className="accordion">{situations.map((s,i)=><div className={'accordion-item '+(open===i?'expanded':'')} key={i}><button onClick={()=>setOpen(open===i?-1:i)}><span className="q-number">0{i+1}</span><b>{s.q}</b><ChevronRight size={19}/></button>{open===i&&<p>{s.a}</p>}</div>)}</div></div><aside className="panel support-aside"><div className="side-panel-icon"><HandHeart size={26}/></div><h3>Nguyên tắc 3T</h3><div className="three-t"><b>Tìm hiểu</b><p>Ưu tiên kiến thức đáng tin cậy.</p></div><div className="three-t"><b>Tôn trọng</b><p>Không phán xét, không tiết lộ riêng tư.</p></div><div className="three-t"><b>Tương trợ</b><p>Phối hợp gia đình và chuyên gia khi cần.</p></div><a className="btn btn-outline full" href="https://www.cdc.gov/tourette-syndrome/" target="_blank" rel="noreferrer">Đọc nguồn CDC <ExternalLink size={15}/></a></aside></div></>}
export default App;
