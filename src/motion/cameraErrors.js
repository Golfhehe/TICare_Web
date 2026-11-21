// Maps getUserMedia / camera failures to specific Vietnamese guidance.
export function cameraErrorMessage(err) {
  const name = err?.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Trình duyệt chưa được cấp quyền dùng camera. Bấm biểu tượng ổ khóa/camera cạnh thanh địa chỉ, chọn "Cho phép" camera cho trang này rồi bấm Bật camera lại.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Không tìm thấy camera. Hãy cắm camera USB (hoặc bật camera laptop), kiểm tra dây cáp rồi bấm Bật camera lại.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Camera đang được ứng dụng khác sử dụng (Zoom, Meet, Teams, tab khác...) hoặc bị lỗi. Hãy đóng ứng dụng đó, rút và cắm lại camera USB rồi thử lại.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Camera đã chọn không hỗ trợ cấu hình yêu cầu hoặc không còn kết nối. Hãy chọn camera khác trong danh sách hoặc dùng camera mặc định.';
    case 'TypeError':
      return 'Không thể mở camera. Camera chỉ hoạt động trên HTTPS hoặc localhost.';
    default:
      return err?.message || 'Không thể khởi động camera.';
  }
}
export const CAMERA_LOST_MESSAGE = 'Camera đã bị ngắt kết nối (rút cáp USB hoặc thiết bị bị tắt). Dữ liệu đã ghi được giữ lại. Cắm lại camera rồi bấm "Kết nối lại".';

// getUserMedia with a remembered deviceId; fall back to the default camera when that device is gone.
// Returns { stream, usedFallback }.
export async function openCamera(mediaDevices, deviceId) {
  const base = { width: { ideal: 640 }, height: { ideal: 480 } };
  const fallback = { video: { ...base, facingMode: 'user' }, audio: false };
  if (!deviceId) return { stream: await mediaDevices.getUserMedia(fallback), usedFallback: false };
  try {
    const stream = await mediaDevices.getUserMedia({ video: { ...base, deviceId: { exact: deviceId } }, audio: false });
    return { stream, usedFallback: false };
  } catch (e) {
    if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError', 'DevicesNotFoundError'].includes(e?.name)) throw e;
  }
  return { stream: await mediaDevices.getUserMedia(fallback), usedFallback: true };
}

const KEY = 'ticare.motion.camera';
export function loadSavedCamera() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function saveCamera(deviceId) {
  try { if (deviceId) localStorage.setItem(KEY, deviceId); else localStorage.removeItem(KEY); } catch { /* storage may be blocked */ }
}
