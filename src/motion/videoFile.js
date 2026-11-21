import { MAX_VIDEO_BYTES } from './constants';

// Returns a Vietnamese error string, or null when the file is acceptable (mp4/webm, <= 200 MB).
export function validateVideoFile(file) {
  if (!file) return 'Chưa chọn tệp video.';
  const name = (file.name || '').toLowerCase();
  const okType = file.type === 'video/mp4' || file.type === 'video/webm' || (!file.type && /\.(mp4|webm)$/.test(name));
  if (!okType) return 'Chỉ nhận video định dạng MP4 hoặc WebM. Hãy chuyển đổi tệp rồi thử lại.';
  if (file.size > MAX_VIDEO_BYTES) return `Video quá lớn (${(file.size / 1048576).toFixed(0)} MB). Tối đa 200 MB.`;
  if (file.size === 0) return 'Tệp video rỗng.';
  return null;
}
