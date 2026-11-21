export const ASSISTANT_LIMIT_NOTE = 'TICare Chatbot hỗ trợ tìm hiểu, không chẩn đoán và không thay thế chuyên gia.';

/** Short reason shown next to the "offline sample answer" label. */
export function offlineReason(result) {
  if (result.status === 401) return 'Chưa đăng nhập';
  if (result.status === 429) return 'Hết lượt hôm nay';
  if (result.status === 503) return 'AI chưa được cấu hình';
  if (result.status === 0) return 'Không kết nối được máy chủ';
  return 'AI tạm thời không phản hồi';
}
