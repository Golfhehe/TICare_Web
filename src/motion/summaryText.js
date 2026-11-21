import { channelLabel } from './constants';
import { summarize } from './sessionData';

// Pure helpers for T5.3. They only use GENERAL facts (which channels had events, rough duration, event count).
// They must never include the student code/label, the session note, or any timestamp.

const durationPhrase = (s) => {
  const sec = Math.max(0, Math.round(Number(s) || 0));
  if (sec < 60) return 'dưới 1 phút';
  return `khoảng ${Math.round(sec / 60)} phút`;
};

const joinVi = (items) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' và ' + items[items.length - 1]);

/** @param {{events?: Array<{channel:string,intensity?:number,duration?:number}>, durationS?: number}} session */
export function buildObservationSummary({ events = [], durationS = 0 } = {}) {
  const sum = summarize(events, durationS);
  const top = Object.entries(sum.byChannel).sort((a, b) => b[1].count - a[1].count).slice(0, 2).map(([id]) => channelLabel(id).toLowerCase());
  const behaviour = top.length ? `cử động lặp lại ở ${joinVi(top)}` : 'cử động lặp lại';
  const text = sum.total
    ? `Phiên quan sát kéo dài ${durationPhrase(durationS)}, ghi nhận ${sum.total} sự kiện chuyển động, nhiều nhất ở ${joinVi(top)}.`
    : `Phiên quan sát kéo dài ${durationPhrase(durationS)}, chưa ghi nhận sự kiện chuyển động nổi bật.`;
  const question = `${text} Trong lớp học, khi quan sát thấy học sinh có ${behaviour} thì giáo viên nên hỗ trợ thế nào?`;
  const goal = `Hỗ trợ học sinh trong lớp học sau một phiên quan sát. ${text} Mục tiêu: tạo môi trường học tập tôn trọng, linh hoạt; giáo viên theo dõi và điều chỉnh cách hỗ trợ. Kết quả quan sát, không phải chẩn đoán.`;
  return { text, question, goal, plan: { title: 'Kế hoạch hỗ trợ sau quan sát', goal } };
}
