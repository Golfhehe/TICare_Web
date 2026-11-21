import React, { useEffect, useState } from 'react';
import { ArrowRight, ScanEye, ClipboardList, UsersRound, Bot, GraduationCap, HeartHandshake, BookOpen, Activity, Heart, History, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import DueBanner from '../action/DueBanner';
import DemoVideo from './DemoVideoBlock';

const fmt = t => new Date(t).toLocaleDateString('vi-VN');

const STEPS = [
  { n: 1, id: 'motion', icon: ScanEye, title: 'Quan sát', tool: 'Motion', desc: 'Quan sát chuyển động trong lớp bằng camera hoặc video mẫu, ngay trên trình duyệt.' },
  { n: 2, id: 'motion', icon: History, title: 'Ghi nhận', tool: 'Lịch sử phiên', desc: 'Lưu số liệu tổng hợp của phiên và xem lại diễn biến theo thời gian.' },
  { n: 3, id: 'assistant', icon: Bot, title: 'Tìm hiểu', tool: 'Chatbot', desc: 'Hỏi trợ lý AI có dẫn nguồn, hoặc học hỏi kinh nghiệm từ cộng đồng.', extra: { id: 'community', label: 'Cộng đồng' } },
  { n: 4, id: 'action', icon: ClipboardList, title: 'Lập kế hoạch', tool: 'Action', desc: 'Lên kế hoạch hoạt động giáo dục, giao việc, đặt hạn và theo dõi tiến độ.' },
  { n: 5, id: 'education', icon: GraduationCap, title: 'Học liệu', tool: 'Education', desc: 'Bài học, trò chơi và tài liệu giúp cả lớp hiểu và tôn trọng sự khác biệt.' },
];

export default function Home({ go, goTo, posts = [], user }) {
  const [plans, setPlans] = useState([]);
  const nav = (id, seed) => (goTo ? goTo(id, seed) : go(id));

  useEffect(() => {
    let alive = true;
    setPlans([]);
    if (!supabase || !user?.id) return undefined;
    supabase.from('action_plans').select('id,title,status,plan').eq('owner_id', user.id)
      .then(({ data, error }) => { if (alive && !error) setPlans(data || []); });
    return () => { alive = false; };
  }, [user?.id]);

  return <>
    <div className="hero">
      <div className="hero-content">
        <span className="hero-tag"><span className="glow-dot" /> HỖ TRỢ GIÁO VIÊN · HỌC SINH CÓ TIC TRONG LỚP HỌC</span>
        <h1>Hiểu tic trong lớp học<br /><em>để đồng hành đúng cách.</em></h1>
        <p>TICare hỗ trợ giáo viên quan sát — tìm hiểu — lập kế hoạch — triển khai hoạt động giáo dục; không thay thế chẩn đoán hoặc điều trị y khoa.</p>
        <div className="hero-buttons">
          <button type="button" className="btn btn-mint" onClick={() => nav('motion')}>Bắt đầu quan sát <ScanEye size={17} /></button>
          <button type="button" className="btn btn-ghost" onClick={() => nav('assistant')}>Hỏi trợ lý AI <ArrowRight size={17} /></button>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="heart-core"><HeartHandshake size={70} strokeWidth={1.4} /></div><div className="floating f1"><BookOpen size={19} /> Kiến thức</div><div className="floating f2"><UsersRound size={19} /> Cộng đồng</div><div className="floating f3"><Activity size={19} /> Công nghệ</div></div>
    </div>

    {user && <DueBanner plans={plans} onOpen={id => nav('action', { openPlanId: id })} />}

    <div className="section-row"><div><h2>Quy trình 5 bước</h2><p>Từ quan sát trong lớp đến hoạt động giáo dục cụ thể.</p></div></div>
    <ol className="home-steps">
      {STEPS.map(s => <li key={s.n}>
        <button type="button" className="home-step" onClick={() => nav(s.id)}>
          <span className="home-step-num">{s.n}</span><s.icon size={22} />
          <b>{s.title}</b><small className="home-step-tool">{s.tool}</small>
          <span className="home-step-desc">{s.desc}</span>
          <span className="home-step-go">Mở <ArrowRight size={14} /></span>
        </button>
        {s.extra && <button type="button" className="link-button home-step-extra" onClick={() => nav(s.extra.id)}><UsersRound size={14} /> {s.extra.label}</button>}
      </li>)}
    </ol>

    <div className="home-media">
      <DemoVideo />
      <section className="panel home-limit" aria-labelledby="home-limit-title">
        <h2 id="home-limit-title"><ShieldCheck size={20} /> Giới hạn y khoa</h2>
        <p>TICare không chẩn đoán và không thay thế đánh giá của bác sĩ hay chuyên gia. Kết quả quan sát chỉ mô tả chuyển động để giáo viên trao đổi với gia đình và chuyên gia.</p>
        <p>Camera được xử lý trên trình duyệt, không lưu video; hãy xin phép nhà trường và phụ huynh trước khi quan sát.</p>
        <button type="button" className="link-button" onClick={() => go('privacy')}>Quyền riêng tư &amp; đồng thuận <ArrowRight size={15} /></button>
      </section>
    </div>

    <div className="home-lower">
      <div className="panel"><div className="panel-title"><h3>Bài viết mới từ cộng đồng</h3><button type="button" className="link-button" onClick={() => go('community')}>Xem tất cả <ArrowRight size={15} /></button></div>
        {posts.slice(0, 3).map(p => <div className="compact-post" key={p.id}><span className="post-category">{p.category}</span><b>{p.title}</b><small>{p.author} · {fmt(p.created_at)}</small></div>)}
      </div>
      <div className="panel tip-panel"><div className="tip-icon"><Heart size={24} /></div><h3>Một lời nhắc nhỏ</h3><p>Không phải mọi chuyển động lặp lại đều là tic. Một công cụ quan sát chỉ có thể hỗ trợ mô tả chuyển động — không thể thay thế đánh giá của chuyên gia.</p><button type="button" className="link-button" onClick={() => go('education')}>Tìm hiểu thêm <ArrowRight size={15} /></button></div>
    </div>
  </>;
}
