import React, { useEffect, useRef } from 'react';
import { FileText, File as FileIcon, Image as ImageIcon, X } from 'lucide-react';

import { isImage } from './files.js';

/** Thumbnail for image attachments (lazy), icon + name + size for other files. */
export default function AttachmentThumb({ attachment: a, url, onOpen }) {
  if (isImage(a)) {
    return url
      ? <button type="button" className="action-thumb" onClick={() => onOpen(a)} aria-label={'Xem ảnh lớn: ' + a.name}>
          <img src={url} alt={'Ảnh minh họa: ' + a.name} loading="lazy" decoding="async" />
        </button>
      : <div className="action-file-placeholder"><ImageIcon size={28} /><span>Đang tải ảnh...</span></div>;
  }
  const pdf = a.type === 'application/pdf' || /\.pdf$/i.test(a.name);
  return (
    <div className="action-file-placeholder">
      {pdf ? <FileText size={30} /> : <FileIcon size={30} />}
      <span>{pdf ? 'Tài liệu PDF' : 'Tệp đính kèm'}</span>
    </div>
  );
}

/** Full-size image viewer: close button, Esc, backdrop click. */
export function ImageModal({ url, name, onClose }) {
  const btn = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    btn.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="action-modal" role="dialog" aria-modal="true" aria-label={'Xem ảnh ' + name} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="action-modal-body">
        <button type="button" ref={btn} className="action-modal-close" onClick={onClose} aria-label="Đóng ảnh"><X size={20} /></button>
        <img src={url} alt={'Ảnh minh họa: ' + name} />
        <p>{name}</p>
      </div>
    </div>
  );
}
