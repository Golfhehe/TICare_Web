import { describe, it, expect } from 'vitest';
import { safeData, safeTask, normalizeTags, daysUntil, isValidDate, progressOf, allTags, filterByTag } from './planModel.js';

const legacy = {
  title: 'Kế hoạch cũ', caseTag: 'Nhóm A', goal: 'g', classLevel: 'Tiểu học', startDate: '2026-11-01', endDate: '2026-12-01',
  status: 'active', focus: 'f', notes: 'n', review: 'r',
  tasks: [{ id: 't1', text: 'Việc 1', done: true }, { id: 't2', text: 'Việc 2', done: false }]
};

describe('safeData', () => {
  it('opens a legacy plan (no tags/start/due, no attachments)', () => {
    const d = safeData(legacy);
    expect(d.tasks).toEqual([
      { id: 't1', text: 'Việc 1', done: true, tags: [], start: '', due: '' },
      { id: 't2', text: 'Việc 2', done: false, tags: [], start: '', due: '' }
    ]);
    expect(d.attachments).toEqual([]);
    expect(d.title).toBe('Kế hoạch cũ');
    expect(d.status).toBe('active');
  });
  it('keeps new task fields (tags, start, due) and is idempotent', () => {
    const p = { ...legacy, tasks: [{ id: 'a', text: 'X', done: false, tags: ['Lớp 2', 'Gia đình'], start: '2026-11-02', due: '2026-11-10' }] };
    const d = safeData(p);
    expect(d.tasks[0]).toEqual({ id: 'a', text: 'X', done: false, tags: ['Lớp 2', 'Gia đình'], start: '2026-11-02', due: '2026-11-10' });
    expect(safeData(d)).toEqual(d);
  });
  it('survives garbage input', () => {
    for (const g of [null, undefined, 5, 'x', [], { tasks: 'no', attachments: 7 }, { tasks: [null, 3, {}, { text: '   ' }], attachments: [null, 1, { path: 1 }] }]) {
      const d = safeData(g);
      expect(d.tasks).toEqual([]);
      expect(d.attachments).toEqual([]);
      expect(d.status).toBe('draft');
      expect(d.title).toBe('');
    }
  });
  it('rejects invalid dates and wrong types', () => {
    const d = safeData({ startDate: '2026-02-30', endDate: 'abc', tasks: [{ text: 'a', due: '2026-13-01', start: 20261101, tags: 'x' }] });
    expect(d.startDate).toBe('');
    expect(d.endDate).toBe('');
    expect(d.tasks[0]).toMatchObject({ due: '', start: '', tags: [] });
  });
  it('enforces length limits', () => {
    const d = safeData({
      title: 'a'.repeat(500),
      tasks: Array.from({ length: 60 }, (_, i) => ({ id: i, text: 'z'.repeat(900), tags: ['q'.repeat(60)] })),
      attachments: Array.from({ length: 30 }, (_, i) => ({ path: 'p' + i, name: 'n'.repeat(300), type: null }))
    });
    expect(d.title).toHaveLength(120);
    expect(d.tasks).toHaveLength(40);
    expect(d.tasks[0].text).toHaveLength(500);
    expect(d.tasks[0].tags[0]).toHaveLength(24);
    expect(d.attachments).toHaveLength(15);
    expect(d.attachments[0].name).toHaveLength(120);
    expect(d.attachments[0].type).toBe('');
    expect(JSON.stringify(d).length).toBeLessThan(250 * 1024);
  });
});

describe('normalizeTags', () => {
  it('trims, dedupes case-insensitively, caps at 5 and 24 chars', () => {
    expect(normalizeTags([' a ', 'A', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(normalizeTags(['x'.repeat(30)])[0]).toHaveLength(24);
    expect(normalizeTags([1, null, '', '  '])).toEqual([]);
    expect(normalizeTags('abc')).toEqual([]);
  });
});

describe('dates and progress', () => {
  it('validates dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-2-1')).toBe(false);
  });
  it('daysUntil', () => {
    expect(daysUntil('2026-11-20', '2026-11-18')).toBe(2);
    expect(daysUntil('2026-11-17', '2026-11-18')).toBe(-1);
    expect(daysUntil('', '2026-11-18')).toBeNull();
  });
  it('progress = % done', () => {
    expect(progressOf([])).toBe(0);
    expect(progressOf([{ done: true }, { done: false }, { done: false }])).toBe(33);
    expect(progressOf(safeData(legacy).tasks)).toBe(50);
  });
  it('tag filter and tag list', () => {
    const tasks = [safeTask({ text: 'a', tags: ['Lớp 2'] }), safeTask({ text: 'b', tags: ['Gia đình', 'lớp 2'] }), safeTask({ text: 'c' })];
    expect(filterByTag(tasks, 'Lớp 2').map(t => t.text)).toEqual(['a', 'b']);
    expect(filterByTag(tasks, 'all')).toHaveLength(3);
    expect(allTags(tasks)).toHaveLength(2);
  });
});
