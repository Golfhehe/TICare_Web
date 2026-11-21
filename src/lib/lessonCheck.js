// Pure pre-export checks for a Studio lesson. Returns [{ slide: number|null, level: 'error'|'warn', message }].
// slide is 1-based (null = whole lesson). Errors block PowerPoint export; warnings only ask for care.
export const MIN_SLIDES = 5;
export const MAX_BODY = 450;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?<![\d.])\+?\d(?:[\s.-]?\d){8,}(?![\d])/;
const MEDICAL_RE = /chẩn đoán|bệnh|thuốc|điều trị|rối loạn/gi;

const txt = v => (typeof v === 'string' ? v : '');

export function checkLesson(lesson) {
  const out = [];
  const slides = Array.isArray(lesson?.slides) ? lesson.slides : [];
  if (slides.length < MIN_SLIDES) {
    out.push({ slide: null, level: 'error', message: `Bài học cần ít nhất ${MIN_SLIDES} slide (hiện có ${slides.length}).` });
  }
  const personal = (n, where, text) => {
    if (EMAIL_RE.test(text)) out.push({ slide: n, level: 'error', message: `${where} có địa chỉ email. Hãy xoá thông tin cá nhân.` });
    if (PHONE_RE.test(text)) out.push({ slide: n, level: 'error', message: `${where} có số điện thoại. Hãy xoá thông tin cá nhân.` });
  };
  personal(null, 'Tiêu đề hoặc mục tiêu bài học', `${txt(lesson?.title)}\n${txt(lesson?.objective)}`);
  slides.forEach((s, i) => {
    const n = i + 1;
    const title = txt(s?.title).trim(), body = txt(s?.body).trim(), prompt = txt(s?.prompt);
    if (!title) out.push({ slide: n, level: 'error', message: 'Thiếu tiêu đề.' });
    if (!body) out.push({ slide: n, level: 'error', message: 'Thiếu nội dung.' });
    personal(n, 'Slide', `${title}\n${body}\n${prompt}`);
    const hits = [...new Set((`${title}\n${body}\n${prompt}`.match(MEDICAL_RE) || []).map(x => x.toLowerCase()))];
    if (hits.length) {
      out.push({ slide: n, level: 'warn', message: `Có từ ngữ y khoa (${hits.join(', ')}). Hãy diễn đạt thận trọng, không mang tính chẩn đoán hay điều trị.` });
    }
    if (body.length > MAX_BODY) {
      out.push({ slide: n, level: 'warn', message: `Nội dung dài ${body.length} ký tự (> ${MAX_BODY}), khó đọc với trẻ nhỏ. Nên rút gọn.` });
    }
  });
  return out;
}

export const hasErrors = issues => issues.some(x => x.level === 'error');
