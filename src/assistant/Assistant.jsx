import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Bot, CheckCircle2, ExternalLink, Info, LoaderCircle, Send, ShieldCheck } from 'lucide-react';
import { QUESTION_BANK, SOURCES, SUGGESTIONS, TOPIC_GROUPS, localAnswer } from '../data';
import { callApi } from '../lib/api';
import { ASSISTANT_LIMIT_NOTE, offlineReason } from './assistantText';

const MAX_Q = 1000;

function Sources({ list, title }) {
  if (!list?.length) return null;
  return <div className="sources"><b><BookOpen size={15} /> {title}</b>{list.map((s, j) => <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />{s.name || s.title || s.url}</a>)}</div>;
}

export default function Assistant({ user, notify, seed = null, onSeedUsed }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showTopics, setShowTopics] = useState(true);
  const bottom = useRef(null);
  const busyRef = useRef(false);
  const seedUsed = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => {
    if (!seed) { seedUsed.current = null; return; }
    if (typeof seed === 'string' && seedUsed.current !== seed) {
      seedUsed.current = seed;
      setQuestion(seed.slice(0, MAX_Q));
      onSeedUsed?.();
    }
  }, [seed, onSeedUsed]);

  async function ask(raw) {
    const q = String(raw || '').trim().slice(0, MAX_Q);
    if (q.length < 3 || busyRef.current) return;
    busyRef.current = true;
    const history = messages.filter(m => m.mode !== 'offline' && m.text).slice(-8).map(m => ({ role: m.role, content: m.text.slice(0, 1200) }));
    setQuestion('');
    setMessages(p => [...p, { role: 'user', text: q }]);
    setBusy(true);
    const result = await callApi(import.meta.env.VITE_ASSISTANT_API_URL || '/api/ask', { question: q, history });
    let reply;
    if (result.ok && typeof result.data?.answer === 'string' && result.data.answer.trim()) {
      reply = { role: 'assistant', mode: 'live', text: result.data.answer, sources: Array.isArray(result.data.sources) ? result.data.sources.filter(s => /^https?:\/\//i.test(s?.url || '')) : [], remaining: Number.isFinite(result.data.remaining) ? result.data.remaining : null };
    } else {
      const local = localAnswer(q);
      reply = { role: 'assistant', mode: 'offline', text: local.answer, sources: local.sources || [], topic: local.topic, note: local.note, reason: offlineReason(result) };
    }
    setMessages(p => [...p, reply]);
    setBusy(false);
    busyRef.current = false;
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">TRỢ LÝ KIẾN THỨC · AI + THƯ VIỆN MẪU</div><h1>Trợ lý kiến thức TICare</h1><p>Hỏi về tic và giáo dục hòa nhập trong lớp học. Đăng nhập để dùng trợ lý AI (tối đa 50 lượt mỗi ngày); khi chưa đăng nhập hoặc AI không khả dụng, trợ lý dùng câu trả lời mẫu có sẵn.</p></div></div>
    <div className="assistant-shell"><div className="chat-main">
      <div className="chat-top"><div className="chat-avatar"><Bot size={22} /></div><div><b>TICare Knowledge Assistant</b><small>{user ? 'Đã đăng nhập · AI + câu trả lời mẫu dự phòng' : 'Chưa đăng nhập · dùng câu trả lời mẫu'}</small></div><span className="chat-tag"><ShieldCheck size={13} /> Không chẩn đoán</span></div>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><span style={{ fontSize: 13, color: '#475569' }}>15 chủ đề câu hỏi mẫu, chọn để gửi ngay.</span><button type="button" className="btn btn-outline small" onClick={() => setShowTopics(v => !v)}>{showTopics ? 'Ẩn danh sách câu hỏi' : 'Hiện danh sách câu hỏi'}</button></div>
      {showTopics && <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', maxHeight: 245, overflowY: 'auto' }}>{TOPIC_GROUPS.map(group => <div key={group.title} style={{ marginBottom: 12 }}><b style={{ display: 'block', fontSize: 13, marginBottom: 7 }}>{group.title}</b><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{group.ids.map(id => { const t = QUESTION_BANK.find(x => x.id === id); return t ? <button key={id} type="button" className="btn btn-outline small" disabled={busy} onClick={() => ask(t.examples[0])} style={{ whiteSpace: 'normal', textAlign: 'left' }}>{t.title}</button> : null; })}</div></div>)}</div>}
      <div className="chat-history" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><div className="big-bot"><Bot size={34} /></div><h2>Chào mừng đến trợ lý TICare!</h2><p>Chọn câu hỏi mẫu hoặc nhập câu hỏi của bạn. Trợ lý giúp tìm hiểu thông tin chung và gợi ý cách hỗ trợ trong lớp học.</p><div className="suggestions">{SUGGESTIONS.slice(0, 6).map(s => <button key={s} type="button" onClick={() => ask(s)}>{s}<ArrowRight size={14} /></button>)}</div></div>}
        {messages.map((m, i) => <div className={'chat-bubble-row ' + m.role} key={i}>{m.role === 'assistant' && <div className="tiny-bot"><Bot size={17} /></div>}<div className={'chat-bubble ' + m.role}>
          <div className="chat-text" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          {m.role === 'assistant' && m.mode === 'live' && <><Sources list={m.sources} title="Nguồn tham khảo" /><div className="answer-note">● Trả lời bằng AI{m.remaining !== null ? ` · Hôm nay còn ${m.remaining} lượt` : ''}</div></>}
          {m.role === 'assistant' && m.mode === 'offline' && <><Sources list={m.sources} title="Nguồn đọc thêm (không tra cứu trực tiếp)" /><div className="answer-note">● Câu trả lời mẫu (offline) · {m.reason}{m.topic ? ' · ' + m.topic : ''}</div></>}
        </div></div>)}
        {busy && <div className="chat-bubble-row assistant" role="status"><div className="tiny-bot"><Bot size={17} /></div><div className="chat-bubble assistant"><LoaderCircle size={14} className="spin" style={{ verticalAlign: '-2px', marginRight: 6 }} />Đang trả lời…</div></div>}
        <div ref={bottom} />
      </div>
      <form className="chat-input" onSubmit={e => { e.preventDefault(); ask(question); }}><input aria-label="Câu hỏi" maxLength={MAX_Q} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Hỏi về tic, giáo dục hòa nhập, Motion Insight..." /><button type="submit" aria-label="Gửi câu hỏi" disabled={busy || question.trim().length < 3} className="btn btn-primary"><Send size={18} /></button></form>
      <div className="chat-disclaimer"><Info size={14} /> {ASSISTANT_LIMIT_NOTE}</div>
    </div>
    <aside className="chat-side"><div className="panel"><h3>Nguyên tắc trả lời</h3><div className="principle"><CheckCircle2 size={17} /> Thông tin giáo dục bằng tiếng Việt</div><div className="principle"><CheckCircle2 size={17} /> Nguồn để tự đọc thêm</div><div className="principle"><CheckCircle2 size={17} /> Không chẩn đoán</div><div className="principle"><CheckCircle2 size={17} /> Không phân tích camera</div></div><div className="panel"><h3>Thư viện nguồn</h3>{SOURCES.map(s => <a className="source-link" href={s.url} key={s.url} target="_blank" rel="noopener noreferrer"><BookOpen size={17} /><span>{s.name}</span><ExternalLink size={13} /></a>)}</div></aside></div>
  </>;
}
