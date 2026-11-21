// Pure model helpers for TICare Action plans (stored in action_plans.plan jsonb).
import { uid } from '../lib/uid.js';

export const LIMITS = { title: 120, tasks: 40, taskText: 500, tags: 5, tagLen: 24, attachments: 15 };
export const STATUSES = { draft: 'Bản nháp', active: 'Đang thực hiện', done: 'Đã hoàn thành' };

export const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export function todayLocal(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

/** True only for a real calendar date in YYYY-MM-DD form. */
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const cleanDate = (s) => (isValidDate(s) ? s : '');

/** Whole days from `today` to `date` (negative = past). null when date invalid. */
export function daysUntil(date, today = todayLocal()) {
  if (!isValidDate(date) || !isValidDate(today)) return null;
  const a = Date.parse(today + 'T00:00:00Z');
  const b = Date.parse(date + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  const seen = new Set();
  for (const t of tags) {
    const v = clean(t).replace(/\s+/g, ' ').slice(0, LIMITS.tagLen).trim();
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

export function safeTask(t) {
  if (!t || typeof t !== 'object') return null;
  const text = clean(t.text).slice(0, LIMITS.taskText);
  if (!text) return null;
  return {
    id: String(t.id || uid()),
    text,
    done: !!t.done,
    tags: normalizeTags(t.tags),
    start: cleanDate(t.start),
    due: cleanDate(t.due)
  };
}

export const freshPlan = () => ({
  title: '', caseTag: '', goal: '', classLevel: 'Tiểu học', startDate: todayLocal(),
  endDate: '', status: 'draft', tasks: [], notes: '', attachments: [], review: '',
  focus: 'Tạo môi trường học tập tôn trọng, linh hoạt và an toàn.'
});

/** Sanitize a plan (new or legacy, possibly garbage) into the canonical shape. */
export function safeData(x) {
  x = x && typeof x === 'object' ? x : {};
  return {
    title: clean(x.title).slice(0, LIMITS.title), caseTag: clean(x.caseTag).slice(0, 40), goal: clean(x.goal).slice(0, 2000),
    classLevel: clean(x.classLevel).slice(0, 80), startDate: cleanDate(x.startDate), endDate: cleanDate(x.endDate),
    status: ['draft', 'active', 'done'].includes(x.status) ? x.status : 'draft',
    focus: clean(x.focus).slice(0, 500), notes: clean(x.notes).slice(0, 4000),
    attachments: (Array.isArray(x.attachments) ? x.attachments : []).slice(0, LIMITS.attachments)
      .filter(a => a && typeof a.path === 'string' && typeof a.name === 'string')
      .map(a => ({ path: a.path, name: a.name.slice(0, 120), type: String(a.type ?? '').slice(0, 80), size: Number(a.size) || 0 })),
    review: clean(x.review).slice(0, 4000),
    tasks: (Array.isArray(x.tasks) ? x.tasks : []).slice(0, LIMITS.tasks).map(safeTask).filter(Boolean)
  };
}

export function progressOf(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  return list.length ? Math.round(100 * list.filter(t => t && t.done).length / list.length) : 0;
}

export function allTags(tasks) {
  const set = new Map();
  for (const t of Array.isArray(tasks) ? tasks : []) for (const g of t?.tags || []) set.set(g.toLowerCase(), g);
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}

export function filterByTag(tasks, tag) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!tag || tag === 'all') return list;
  const k = String(tag).toLowerCase();
  return list.filter(t => (t.tags || []).some(g => g.toLowerCase() === k));
}
