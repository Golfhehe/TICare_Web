import { supabase } from '../supabase';

export const AGES = [
  { id: 'mam_non', label: 'Mầm non' }, { id: 'lop_1', label: 'Lớp 1' },
  { id: 'lop_2', label: 'Lớp 2' }, { id: 'lop_3', label: 'Lớp 3' },
];
export const ageLabel = id => AGES.find(a => a.id === id)?.label || id;
export const kindLabel = k => (k === 'scratch' ? 'Scratch' : k === 'slide' ? 'Slide' : k === 'link' ? 'Trò chơi online' : 'Tài liệu');
export const kindIcon = k => (k === 'scratch' ? '🧩' : k === 'link' ? '🎮' : '📂');
export const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối' };

/** Open an external link, or a 60 s signed URL for a stored file. */
export async function openResource(r, notify) {
  if (r.kind === 'link') {
    if (!r.external_url?.startsWith('https://')) { notify('Liên kết không hợp lệ.'); return; }
    window.open(r.external_url, '_blank', 'noopener,noreferrer');
    return;
  }
  const { data, error } = await supabase.storage.from('education-resources').createSignedUrl(r.storage_path, 60);
  if (error) { notify('Không thể mở học liệu: ' + error.message); return; }
  // The user gesture has passed after the await; an anchor click is more reliable than window.open.
  const a = document.createElement('a');
  a.href = data.signedUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}
