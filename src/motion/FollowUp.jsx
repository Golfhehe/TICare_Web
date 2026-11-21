import React from 'react';
import { Bot, ClipboardList } from 'lucide-react';

/** "Ask the assistant" / "Create an Action plan" from a session result. The summary is already de-identified. */
export default function FollowUp({ summary, onAskAssistant, onCreatePlan, disabled = false }) {
  if (!onAskAssistant && !onCreatePlan) return null;
  return <div className="mi-followup">
    <p className="mi-muted">Bước tiếp theo (chỉ gửi mô tả khái quát, không kèm mã học sinh, ghi chú hay thời điểm cụ thể):</p>
    <div className="mi-save-actions">
      {onAskAssistant && <button type="button" className="btn btn-outline" disabled={disabled} onClick={() => onAskAssistant(summary.question)}><Bot size={16} /> Hỏi trợ lý về quan sát này</button>}
      {onCreatePlan && <button type="button" className="btn btn-outline" disabled={disabled} onClick={() => onCreatePlan(summary.plan)}><ClipboardList size={16} /> Tạo kế hoạch Action</button>}
    </div>
  </div>;
}
