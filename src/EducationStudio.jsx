import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, WandSparkles, Download, ShieldCheck, CheckCircle2, AlertTriangle, Save, Presentation, ArrowLeft, ArrowRight, LoaderCircle, Sparkles, CircleAlert } from 'lucide-react';
import { supabase } from './supabase';
import { checkLesson, hasErrors } from './lib/lessonCheck';
import './education-studio.css';

const SAMPLE_TOPICS = [
  {match:/trêu chọc|bắt nạt|chế giễu/i,title:'Lớp học không trêu chọc',focus:'Không trêu chọc và biết tìm sự hỗ trợ từ giáo viên'},
  {match:/giúp đỡ|đồng hành|bạn bè/i,title:'Chúng mình cùng giúp đỡ',focus:'Biết đề nghị giúp đỡ một cách tôn trọng'},
  {match:/lời nói|tử tế|giao tiếp/i,title:'Lời nói tử tế',focus:'Lựa chọn câu nói thân thiện và tôn trọng'},
  {match:/tic|khác biệt|hòa nhập|hoà nhập/i,title:'Tôn trọng sự khác biệt',focus:'Không phán xét các khác biệt về hành vi hoặc vận động'}
];
const CONFIRMS=['Nội dung phù hợp độ tuổi của lớp.','Đã soát chính tả và cách diễn đạt.','Không có nội dung nhạy cảm hay thông tin nhận diện trẻ.','Nội dung khớp mục tiêu bài học.'];
const gradeLabels={mam_non:'Mầm non',lop_1:'Lớp 1',lop_2:'Lớp 2',lop_3:'Lớp 3'};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const normalizeSlide=x=>({
  title:String(x?.title||'Tiêu đề bài học').slice(0,110),
  body:String(x?.body||'').slice(0,550),
  prompt:String(x?.prompt||'').slice(0,300),
  emoji:String(x?.emoji||'🌱').slice(0,8)
});
const normalizeLesson=x=>({
  title:String(x?.title||'Bài học mới').slice(0,120),
  objective:String(x?.objective||'Giáo dục sự tôn trọng và hòa nhập').slice(0,500),
  slides:(Array.isArray(x?.slides)?x.slides:[]).slice(0,10).map(normalizeSlide)
});
function generateTemplate(topic,grade,duration,slideCount,objective){
  const match=SAMPLE_TOPICS.find(x=>x.match.test(topic));
  const title=topic.trim()||match?.title||'Tôn trọng sự khác biệt';
  const focus=objective.trim()||match?.focus||'Biết tôn trọng và hỗ trợ bạn bè trong lớp học';
  const examples=[
    ['🌈','Mỗi bạn đều có điều đặc biệt','Các bạn trong lớp có thể khác nhau về sở thích, cách học và cách thể hiện.','Điều gì khiến lớp mình trở nên đa dạng?'],
    ['🤝','Tôn trọng là gì?','Lắng nghe, nói lời tử tế và không lấy khác biệt của bạn làm trò đùa.','Em sẽ nói gì để bạn cảm thấy được tôn trọng?'],
    ['🌱','Cùng suy nghĩ về một tình huống','Khi một bạn có cử động khác biệt, các bạn khác tò mò. Chúng mình không trêu chọc và có thể hỏi cô giáo khi chưa hiểu.','Nếu chứng kiến bạn bị trêu chọc, em sẽ làm gì?'],
    ['💬','Lời nói tử tế','“Mình chơi cùng nhé”, “Bạn cần mình giúp không?” là những lời nói dễ thương.','Em có thể nghĩ thêm một lời nói tử tế không?'],
    ['🧩','Hoạt động nhóm','Từng nhóm chọn một cách giúp mọi bạn đều được tham gia trò chơi hoặc học tập.','Nếu bạn không muốn nói trước lớp, nhóm có thể làm gì?'],
    ['🌻','Điều nên làm','Tôn trọng, hỗ trợ và báo cho giáo viên khi có hành vi bắt nạt. Không công khai chuyện riêng tư của bạn.','Cả lớp sẽ thống nhất quy tắc nào?'],
    ['💚','Thông điệp của chúng mình','Không ai cần phải giống nhau để được đối xử tử tế.','Hôm nay em học được điều gì?'],
    ['🎉','Cùng thực hành','Nói một câu tích cực với bạn, cùng chơi hoặc giúp đỡ khi bạn đồng ý.','Mỗi bạn chọn một hành động nhỏ để thực hiện trong tuần.']
  ];
  const n=clamp(Number(slideCount)||8,5,10);
  const slides=[{title,body:`${gradeLabels[grade]||'Tiểu học'} • ${duration} phút\nMục tiêu: ${focus}`,prompt:'Hôm nay chúng ta sẽ cùng khám phá điều gì?',emoji:'💚'}];
  for(let i=0;i<n-2;i++){const e=examples[i%examples.length];slides.push({emoji:e[0],title:e[1],body:e[2],prompt:e[3]});}
  slides.push({title:'Cùng nhớ nhé!',body:'Tôn trọng sự khác biệt • Nói lời tử tế • Không trêu chọc • Nhờ người lớn hỗ trợ khi cần.',prompt:'Em muốn mang điều gì từ bài học vào lớp?',emoji:'🌈'});
  return {title,objective:focus,slides};
}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem('ticare_edu_studio_draft_v3')||'null');return x?.slides?normalizeLesson(x):null;}catch{return null;}}
export default function EducationStudio({user,notify=()=>{},openAuth=()=>{}}){
  const [topic,setTopic]=useState('Tôn trọng sự khác biệt');
  const [grade,setGrade]=useState('lop_2');
  const [duration,setDuration]=useState(25);
  const [count,setCount]=useState(8);
  const [objective,setObjective]=useState('Biết tôn trọng sự khác biệt, không trêu chọc và sẵn sàng hỗ trợ bạn bè.');
  const [lesson,setLesson]=useState(loadLocal);
  const [current,setCurrent]=useState(0);
  const [source,setSource]=useState('draft');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  const [ticks,setTicks]=useState([false,false,false,false]);
  const issues=useMemo(()=>lesson?checkLesson(lesson):[],[lesson]);
  const blocked=hasErrors(issues);
  const approved=ticks.every(Boolean)&&!blocked;
  const resetTicks=()=>setTicks([false,false,false,false]);
  useEffect(()=>{if(lesson)setCurrent(i=>Math.max(0,Math.min(i,lesson.slides.length-1)));},[lesson?.slides?.length]);
  function makeTemplate(){setLesson(generateTemplate(topic,grade,duration,count,objective));setSource('template');setCurrent(0);resetTicks();setStatus('Đã tạo bản nháp theo mẫu biên soạn, không sử dụng API AI.');}
  async function generateAI(){
    if(!user){openAuth();return;}
    if(!consent){setStatus('Vui lòng xác nhận yêu cầu không chứa thông tin riêng tư của trẻ.');return;}
    if(topic.trim().length<4||topic.length>140||objective.length>500){setStatus('Chủ đề phải từ 4–140 ký tự, mục tiêu tối đa 500 ký tự.');return;}
    setBusy(true);setStatus('Đang gửi yêu cầu đến Studio AI...');
    try{
      if(!supabase)throw Error('Chưa cấu hình Supabase.');
      const {data,error}=await supabase.auth.getSession();
      if(error||!data.session?.access_token)throw Error('Vui lòng đăng nhập lại.');
      const res=await fetch('/api/education-generate',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${data.session.access_token}`},
        body:JSON.stringify({topic:topic.trim(),grade,duration:Number(duration),slideCount:Number(count),objective:objective.trim()})
      });
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(payload.error||`API đang không sẵn sàng (${res.status}).`);
      const clean=normalizeLesson(payload.lesson);
      if(clean.slides.length<5)throw Error('Bài giảng AI không đủ nội dung để xem trước.');
      setLesson(clean);setCurrent(0);setSource('ai');resetTicks();
      setStatus('AI đã tạo bản nháp. Giáo viên cần đọc, chỉnh sửa và xác nhận trước khi xuất.'+(Number.isInteger(payload.remaining)?` Hôm nay bạn còn ${payload.remaining} lượt AI.`:''));
    }catch(e){setStatus(`${e.message} Bạn có thể chọn “Tạo bằng mẫu” để tiếp tục.`);}
    finally{setBusy(false);}
  }
  function changeSlide(k,value){setLesson(old=>({...old,slides:old.slides.map((s,i)=>i!==current?s:{...s,[k]:value})}));resetTicks();}
  function persist(){if(!lesson)return;try{localStorage.setItem('ticare_edu_studio_draft_v3',JSON.stringify(lesson));setStatus('Đã lưu bản nháp trên trình duyệt này, không đồng bộ Supabase.');}catch{setStatus('Không thể lưu bản nháp trên thiết bị này.');}}
  async function exportPPTX(){
    if(!lesson||!approved){setStatus(blocked?'Còn lỗi cần sửa trước khi xuất (xem bảng kiểm tra).':'Hãy tick đủ 4 mục xác nhận trước khi xuất.');return;}
    setBusy(true);
    try{
      const {default:PptxGenJS}=await import('pptxgenjs');
      const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='TICare Education';pptx.subject='Bài học giáo dục hòa nhập';pptx.title=lesson.title;
      for(let i=0;i<lesson.slides.length;i++){
        const page=lesson.slides[i];const s=pptx.addSlide();s.background={color:'F1FAF8'};
        s.addShape(pptx.ShapeType.roundRect,{x:.46,y:.48,w:12.42,h:6.58,rectRadius:.2,fill:{color:'FFFFFF'},line:{color:'D8EEE9',width:1.1}});
        s.addShape(pptx.ShapeType.rect,{x:.46,y:.48,w:.18,h:6.58,line:{color:'0C9F88'},fill:{color:'0C9F88'}});
        s.addText('TICare Education',{x:.92,y:.78,w:7,h:.3,fontFace:'Arial',fontSize:13,bold:true,color:'09806E',margin:0});
        s.addText(page.emoji||'🌱',{x:.92,y:1.38,w:1.8,h:.8,fontFace:'Arial',fontSize:35,margin:0});
        s.addText(page.title,{x:.92,y:2.43,w:11.3,h:.72,fontFace:'Arial',fontSize:Math.min(30,page.title.length>48?23:30),bold:true,color:'103D45',margin:0,breakLine:false});
        s.addText(page.body,{x:.92,y:3.45,w:11.1,h:1.58,fontFace:'Arial',fontSize:page.body.length>260?16:20,color:'355A60',margin:0,breakLine:false});
        if(page.prompt)s.addText('💬 '+page.prompt,{x:.92,y:5.68,w:11.1,h:.54,fontFace:'Arial',fontSize:14,italic:true,color:'087B72',margin:0});
        s.addText(`${i+1} / ${lesson.slides.length}  •  Học liệu tham khảo, giáo viên kiểm duyệt`,{x:.92,y:6.62,w:11.2,h:.22,fontSize:9,color:'738B90',margin:0});
      }
      await pptx.writeFile({fileName:`TICare_Education_${Date.now()}.pptx`});
      notify('Đã xuất PowerPoint.');
    }catch(e){setStatus('Không thể xuất PowerPoint: '+e.message);}finally{setBusy(false);}
  }
  const slide=lesson?.slides?.[current];
  return <section className="edu-studio">
    <div className="edu-studio-top"><div><span className="edu-studio-eyebrow"><Sparkles size={15}/> TICARE EDUCATION STUDIO</span><h2>Từ ý tưởng thành bài giảng</h2><p>Nhập yêu cầu, nhận bản nháp, sửa từng trang và xuất PowerPoint chỉnh sửa được.</p></div><span className="edu-studio-mode">AI tùy chọn · Mẫu luôn sẵn</span></div>
    <div className="edu-studio-layout">
      <div className="edu-studio-panel">
        <h3><WandSparkles size={18}/> Thiết lập bài giảng</h3>
        <label>Chủ đề<input value={topic} maxLength={140} onChange={e=>setTopic(e.target.value)} placeholder="Ví dụ: Tôn trọng sự khác biệt"/></label>
        <div className="edu-studio-double"><label>Độ tuổi<select value={grade} onChange={e=>setGrade(e.target.value)}>{Object.entries(gradeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Thời lượng<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[15,25,35].map(v=><option key={v} value={v}>{v} phút</option>)}</select></label></div>
        <label>Số slide<select value={count} onChange={e=>setCount(Number(e.target.value))}>{[6,8,10].map(v=><option key={v} value={v}>{v} slide</option>)}</select></label>
        <label>Mục tiêu giáo dục<textarea value={objective} maxLength={500} onChange={e=>setObjective(e.target.value)} rows={3}/></label>
        <label className="edu-studio-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Tôi xác nhận yêu cầu AI không chứa tên, hình ảnh hoặc thông tin sức khỏe nhận diện được của trẻ.</span></label>
        <div className="edu-studio-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={generateAI}>{busy?<LoaderCircle className="spin" size={17}/>:<WandSparkles size={17}/>} AI tạo bản nháp</button><button type="button" className="btn btn-outline" disabled={busy} onClick={makeTemplate}><BookOpen size={17}/> Tạo bằng mẫu</button></div>
        <p className="edu-studio-muted">Nếu API chưa cấu hình hoặc hết hạn mức, nút “Tạo bằng mẫu” vẫn hoạt động. Không gửi dữ liệu sang AI khi dùng mẫu.</p>
        {status&&<div className="edu-studio-status" role="status">{status}</div>}
      </div>
      <div className="edu-studio-panel edu-studio-preview">
        <div className="edu-studio-preview-head"><h3><Presentation size={18}/> Xem trước & chỉnh sửa</h3>{lesson&&<span>{source==='ai'?'Bản nháp AI':source==='template'?'Mẫu biên soạn':'Bản nháp đã lưu'}</span>}</div>
        {!lesson?<div className="edu-studio-empty"><Presentation size={34}/><b>Chưa có bản nháp</b><p>Tạo từ mẫu hoặc kết nối AI để thử Studio.</p></div>:<>
          <div className="edu-studio-slide" aria-label="Xem trước trang trình chiếu"><small>TICare Education · {gradeLabels[grade]}</small><div className="edu-studio-emoji">{slide.emoji}</div><h3>{slide.title}</h3><p>{slide.body}</p>{slide.prompt&&<blockquote>{slide.prompt}</blockquote>}</div>
          <div className="edu-studio-navigation"><button type="button" disabled={current===0} onClick={()=>setCurrent(n=>n-1)}><ArrowLeft size={16}/> Trước</button><b>Trang {current+1}/{lesson.slides.length}</b><button type="button" disabled={current===lesson.slides.length-1} onClick={()=>setCurrent(n=>n+1)}>Tiếp <ArrowRight size={16}/></button></div>
          <div className="edu-studio-editor"><label>Tiêu đề slide<input value={slide.title} onChange={e=>changeSlide('title',e.target.value)} maxLength={110}/></label><label>Nội dung<textarea value={slide.body} onChange={e=>changeSlide('body',e.target.value)} rows={3} maxLength={550}/></label><label>Câu hỏi gợi mở<input value={slide.prompt} onChange={e=>changeSlide('prompt',e.target.value)} maxLength={300}/></label></div>
          <div className="edu-studio-check" aria-label="Kiểm tra trước khi xuất">
            <h4><ShieldCheck size={16}/> Kiểm tra trước khi xuất</h4>
            {issues.length===0?<p className="edu-studio-check-ok"><CheckCircle2 size={15}/> Không phát hiện vấn đề tự động. Bạn vẫn cần đọc lại nội dung.</p>:<ul className="edu-studio-issues">{issues.map((x,i)=><li key={i} className={'edu-studio-issue '+x.level}><CircleAlert size={15}/><span><b>{x.level==='error'?'Lỗi':'Lưu ý'}{x.slide?' · Slide '+x.slide:''}:</b> {x.message}</span>{x.slide&&<button type="button" onClick={()=>setCurrent(x.slide-1)}>Đến slide</button>}</li>)}</ul>}
            <div className="edu-studio-confirms">{CONFIRMS.map((label,i)=><label key={i} className="edu-studio-consent"><input type="checkbox" checked={ticks[i]} onChange={e=>setTicks(t=>t.map((v,j)=>j===i?e.target.checked:v))}/><span>{label}</span></label>)}</div>
            {blocked?<p className="edu-studio-muted" role="status">Cần sửa hết các lỗi trước khi xuất PowerPoint.</p>:!ticks.every(Boolean)&&<p className="edu-studio-muted">Tick đủ 4 mục để bật nút xuất. Sửa nội dung sẽ xoá các dấu tick.</p>}
          </div>
          <div className="edu-studio-actions"><button className="btn btn-outline" type="button" onClick={persist}><Save size={16}/> Lưu bản nháp</button><button className="btn btn-primary" type="button" disabled={!approved||busy} onClick={exportPPTX}><Download size={16}/> Xuất PowerPoint</button></div>
        </>}
      </div>
    </div>
    <p className="edu-studio-disclaimer"><ShieldCheck size={15}/> Studio tạo học liệu giáo dục tham khảo, không đưa ra chẩn đoán hay đánh giá học sinh. Giáo viên chịu trách nhiệm kiểm duyệt trước khi sử dụng.</p>
  </section>;
}
