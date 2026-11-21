import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Modal from '../components/Modal';

const ITEMS = [
  'Tôi đã có sự đồng ý của nhà trường và/hoặc phụ huynh trước khi quan sát học sinh bằng camera hoặc video.',
  'Tôi hiểu kết quả chỉ là mô tả quan sát chuyển động, không phải chẩn đoán y khoa.',
  'Tôi sẽ không ghi tên thật của học sinh vào mã phiên.',
];

export default function ConsentGate({ onConfirm, onCancel, onOpenPrivacy }) {
  const [checked, setChecked] = useState([false, false, false]);
  const all = checked.every(Boolean);
  return (
    <Modal onClose={onCancel} className="auth-modal consent-modal" labelledBy="consent-title">
      <div className="auth-logo"><ShieldCheck size={26} /></div>
      <h2 id="consent-title">Xác nhận trước khi quan sát</h2>
      <p>Camera và video được xử lý ngay trên trình duyệt; TICare không lưu hình ảnh. Vui lòng xác nhận cả ba mục để tiếp tục.</p>
      <div className="form-stack">
        {ITEMS.map((t, i) => (
          <label key={i} className="consent-item" htmlFor={'consent-' + i}>
            <input id={'consent-' + i} type="checkbox" checked={checked[i]} onChange={e => setChecked(c => c.map((v, j) => (j === i ? e.target.checked : v)))} />
            <span>{t}</span>
          </label>
        ))}
        {onOpenPrivacy && <button type="button" className="link-button" onClick={onOpenPrivacy}>Đọc trang Quyền riêng tư &amp; đồng thuận</button>}
        <button type="button" className="btn btn-primary full" disabled={!all} onClick={onConfirm}>Đồng ý và tiếp tục</button>
        <button type="button" className="btn btn-outline full" onClick={onCancel}>Để sau</button>
      </div>
    </Modal>
  );
}
