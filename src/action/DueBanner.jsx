import React, { useMemo } from 'react';
import { BellRing, X } from 'lucide-react';
import { summarizeDue, dueLabel } from './dueSummary.js';
import '../action.css';

/**
 * Props: plans (rows) or summary ({overdue,dueSoon}); onOpen(planId);
 * optional onEnableNotify (shows the button) and onDismiss.
 */
export default function DueBanner({ plans, summary, onOpen, onEnableNotify, onDismiss }) {
  const s = useMemo(() => summary || summarizeDue(plans || []), [summary, plans]);
  if (!s.overdue.length && !s.dueSoon.length) return null;
  const row = (it, i, cls) => (
    <li key={`${it.planId}-${it.taskId || 'plan'}-${i}`} className={cls}>
      <button type="button" onClick={() => onOpen && onOpen(it.planId)}>
        {it.kind === 'task' ? `${it.text} · ${it.planTitle}` : `Kế hoạch: ${it.planTitle}`}
      </button>
      <span>{dueLabel(it.days)}</span>
    </li>
  );
  return (
    <div className="action-deadlines" role="status">
      <div>
        <BellRing size={20} />
        <strong>{s.overdue.length ? `${s.overdue.length} quá hạn` : ''}{s.overdue.length && s.dueSoon.length ? ' · ' : ''}{s.dueSoon.length ? `${s.dueSoon.length} sắp đến hạn` : ''}</strong>
        {onEnableNotify && <button type="button" className="action-notify-toggle" onClick={onEnableNotify}>Bật nhắc trên trình duyệt</button>}
        {onDismiss && <button type="button" className="action-deadline-close" onClick={onDismiss} aria-label="Ẩn nhắc hạn"><X size={16} /></button>}
      </div>
      {s.overdue.length > 0 && <><h4 className="action-due-head overdue">Quá hạn</h4><ul>{s.overdue.slice(0, 6).map((it, i) => row(it, i, 'overdue'))}</ul></>}
      {s.dueSoon.length > 0 && <><h4 className="action-due-head">Sắp đến hạn</h4><ul>{s.dueSoon.slice(0, 6).map((it, i) => row(it, i, ''))}</ul></>}
      <small>Nhắc hạn trong ứng dụng. Thông báo hệ thống chỉ hoạt động khi TICare đang mở.</small>
    </div>
  );
}
