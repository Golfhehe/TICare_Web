import { daysUntil, todayLocal } from './planModel.js';

export const DUE_SOON_DAYS = 3;

/**
 * plans: rows {id,title,status,plan}. Returns items sorted by date:
 * {planId, planTitle, kind:'task'|'plan', taskId?, text, date, days}
 * - overdue: undone task with due < today; active plan with endDate < today
 * - dueSoon: same but 0..3 days ahead
 * Tasks of done plans are ignored.
 */
export function summarizeDue(plans, today = todayLocal()) {
  const overdue = [];
  const dueSoon = [];
  const push = (item) => {
    if (item.days < 0) overdue.push(item);
    else if (item.days <= DUE_SOON_DAYS) dueSoon.push(item);
  };
  for (const p of Array.isArray(plans) ? plans : []) {
    if (!p || !p.id || p.status === 'done') continue;
    const plan = p.plan || {};
    const planTitle = p.title || plan.title || '';
    if (p.status === 'active') {
      const days = daysUntil(plan.endDate, today);
      if (days !== null) push({ planId: p.id, planTitle, kind: 'plan', text: planTitle, date: plan.endDate, days });
    }
    for (const t of Array.isArray(plan.tasks) ? plan.tasks : []) {
      if (!t || t.done) continue;
      const days = daysUntil(t.due, today);
      if (days !== null) push({ planId: p.id, planTitle, kind: 'task', taskId: t.id, text: t.text || '', date: t.due, days });
    }
  }
  const byDate = (a, b) => a.date.localeCompare(b.date);
  return { overdue: overdue.sort(byDate), dueSoon: dueSoon.sort(byDate) };
}

export const dueLabel = (days) => days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Hôm nay' : `Còn ${days} ngày`;
