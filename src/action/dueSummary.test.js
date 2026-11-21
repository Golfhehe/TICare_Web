import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { summarizeDue } from './dueSummary.js';
import { notifyDueOncePerDay } from './dueNotify.js';

const T = '2026-11-18';
const plan = (id, status, endDate, tasks = []) => ({ id, title: 'P' + id, status, plan: { endDate, tasks } });

describe('summarizeDue', () => {
  it('classifies undone tasks by due date', () => {
    const r = summarizeDue([plan('1', 'draft', '', [
      { id: 'a', text: 'late', done: false, due: '2026-11-17' },
      { id: 'b', text: 'today', done: false, due: '2026-11-18' },
      { id: 'c', text: 'soon', done: false, due: '2026-11-21' },
      { id: 'd', text: 'far', done: false, due: '2026-11-22' },
      { id: 'e', text: 'done', done: true, due: '2026-11-01' },
      { id: 'f', text: 'nodue', done: false }
    ])], T);
    expect(r.overdue.map(i => i.taskId)).toEqual(['a']);
    expect(r.dueSoon.map(i => i.taskId)).toEqual(['b', 'c']);
    expect(r.dueSoon[0]).toMatchObject({ planId: '1', days: 0, kind: 'task' });
  });
  it('uses endDate only for active plans; ignores done plans', () => {
    const r = summarizeDue([
      plan('1', 'active', '2026-11-10'), plan('2', 'draft', '2026-11-10'), plan('3', 'done', '2026-11-10', [{ id: 'x', text: 't', due: '2026-11-01' }]),
      plan('4', 'active', '2026-11-20')
    ], T);
    expect(r.overdue.map(i => i.planId)).toEqual(['1']);
    expect(r.dueSoon.map(i => i.planId)).toEqual(['4']);
  });
  it('handles empty and malformed input', () => {
    expect(summarizeDue(null, T)).toEqual({ overdue: [], dueSoon: [] });
    expect(summarizeDue([null, {}, { id: '1', status: 'active', plan: null }, { id: '2', plan: { tasks: 'x' } }], T)).toEqual({ overdue: [], dueSoon: [] });
  });
  it('sorts by date', () => {
    const r = summarizeDue([plan('1', 'draft', '', [{ id: 'a', text: 'a', due: '2026-11-10' }, { id: 'b', text: 'b', due: '2026-11-05' }])], T);
    expect(r.overdue.map(i => i.taskId)).toEqual(['b', 'a']);
  });
});

describe('notifyDueOncePerDay', () => {
  const summary = { overdue: [{}], dueSoon: [] };
  let ctor;
  beforeEach(() => {
    localStorage.clear();
    ctor = vi.fn();
    ctor.permission = 'granted';
    vi.stubGlobal('Notification', ctor);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends once per day', () => {
    expect(notifyDueOncePerDay('u', summary, T)).toBe(true);
    expect(notifyDueOncePerDay('u', summary, T)).toBe(false);
    expect(notifyDueOncePerDay('u', summary, '2026-11-19')).toBe(true);
    expect(ctor).toHaveBeenCalledTimes(2);
  });
  it('does nothing without permission or items', () => {
    ctor.permission = 'default';
    expect(notifyDueOncePerDay('u', summary, T)).toBe(false);
    ctor.permission = 'granted';
    expect(notifyDueOncePerDay('u', { overdue: [], dueSoon: [] }, T)).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });
});
