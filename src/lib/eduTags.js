// Tags for shared Education resources. Ids must match ^[a-z0-9-]{2,30}$ (also stored in education_resources.tags).
export const EDU_TAG_GROUPS = { 'chu-de': 'Chủ đề', 'ky-nang': 'Kỹ năng', 'hinh-thuc': 'Hình thức' };

export const EDU_TAGS = [
  { id: 'ton-trong', label: 'Tôn trọng khác biệt', group: 'chu-de' },
  { id: 'hoa-nhap', label: 'Hòa nhập lớp học', group: 'chu-de' },
  { id: 'chong-treu-choc', label: 'Không trêu chọc', group: 'chu-de' },
  { id: 'cam-xuc', label: 'Nhận biết cảm xúc', group: 'chu-de' },
  { id: 'giao-tiep', label: 'Giao tiếp tử tế', group: 'ky-nang' },
  { id: 'hop-tac', label: 'Làm việc nhóm', group: 'ky-nang' },
  { id: 'binh-tinh', label: 'Giữ bình tĩnh', group: 'ky-nang' },
  { id: 'nho-giup-do', label: 'Biết nhờ giúp đỡ', group: 'ky-nang' },
  { id: 'tro-choi', label: 'Trò chơi', group: 'hinh-thuc' },
  { id: 'hoat-dong-nhom', label: 'Hoạt động nhóm', group: 'hinh-thuc' },
  { id: 'truc-quan', label: 'Hình ảnh trực quan', group: 'hinh-thuc' },
  { id: 'phieu-bai-tap', label: 'Phiếu bài tập', group: 'hinh-thuc' },
];

export const MAX_TAGS = 5;
export const TAG_ID_RE = /^[a-z0-9-]{2,30}$/;
const KNOWN = new Map(EDU_TAGS.map(t => [t.id, t]));

export const tagLabel = id => KNOWN.get(id)?.label || id;

/** Keep only known, unique ids, at most MAX_TAGS. */
export function sanitizeTags(ids) {
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (typeof id === 'string' && KNOWN.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}
