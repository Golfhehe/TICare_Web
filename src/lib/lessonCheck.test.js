import { checkLesson, hasErrors } from './lessonCheck';

const slide = (o = {}) => ({ title: 'Tôn trọng', body: 'Chúng mình cùng lắng nghe nhau.', prompt: 'Em sẽ nói gì?', emoji: '🌱', ...o });
const lesson = (n = 6, patch) => ({ title: 'Bài', objective: 'Mục tiêu', slides: Array.from({ length: n }, () => slide()).map((s, i) => (patch && patch.i === i ? { ...s, ...patch.s } : s)) });

describe('checkLesson', () => {
  it('clean lesson has no issues', () => {
    expect(checkLesson(lesson(6))).toEqual([]);
  });
  it('fewer than 5 slides is an error for the whole lesson', () => {
    const r = checkLesson(lesson(4));
    expect(r).toContainEqual(expect.objectContaining({ slide: null, level: 'error' }));
    expect(hasErrors(r)).toBe(true);
  });
  it('missing title/body are errors on that slide (1-based)', () => {
    const r = checkLesson(lesson(6, { i: 2, s: { title: '  ', body: '' } }));
    expect(r.filter(x => x.slide === 3 && x.level === 'error')).toHaveLength(2);
  });
  it('email and phone numbers are errors', () => {
    const r1 = checkLesson(lesson(6, { i: 0, s: { body: 'Liên hệ co.lan@truong.edu.vn nhé' } }));
    expect(r1.some(x => x.slide === 1 && x.level === 'error' && /email/.test(x.message))).toBe(true);
    const r2 = checkLesson(lesson(6, { i: 1, s: { prompt: 'Gọi 0912 345 678 ngay' } }));
    expect(r2.some(x => x.slide === 2 && x.level === 'error' && /điện thoại/.test(x.message))).toBe(true);
  });
  it('years and short numbers are not phone numbers', () => {
    expect(checkLesson(lesson(6, { i: 0, s: { body: 'Năm 2026, lớp 2A có 30 bạn.' } }))).toEqual([]);
  });
  it('medical wording is only a warning', () => {
    const r = checkLesson(lesson(6, { i: 4, s: { body: 'Không dùng thuốc hay điều trị tại lớp.' } }));
    const w = r.filter(x => x.slide === 5);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe('warn');
    expect(hasErrors(r)).toBe(false);
  });
  it('long body (>450) warns', () => {
    const r = checkLesson(lesson(6, { i: 0, s: { body: 'a'.repeat(451) } }));
    expect(r).toEqual([expect.objectContaining({ slide: 1, level: 'warn' })]);
    expect(checkLesson(lesson(6, { i: 0, s: { body: 'a'.repeat(450) } }))).toEqual([]);
  });
  it('handles null/garbage input', () => {
    expect(hasErrors(checkLesson(null))).toBe(true);
    expect(() => checkLesson({ slides: [null, 5] })).not.toThrow();
  });
});
