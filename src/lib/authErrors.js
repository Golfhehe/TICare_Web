// Maps Supabase Auth / network errors to Vietnamese messages. Unknown messages pass through.
export function authErrorMessage(error) {
  const text = String(error?.message || error || '');
  const code = String(error?.code || '');
  const hay = `${text} ${code}`;

  if (/invalid login credentials|invalid_credentials/i.test(hay)) return 'Email hoặc mật khẩu không chính xác.';
  if (/email not confirmed|email_not_confirmed/i.test(hay)) return 'Tài khoản chưa xác nhận email. Hãy kiểm tra hộp thư (cả thư mục Spam).';
  if (/user already registered|user_already_exists/i.test(hay)) return 'Email này đã được đăng ký. Hãy đăng nhập hoặc đặt lại mật khẩu.';
  if (/rate limit|too many requests|over_email_send_rate_limit|over_request_rate_limit|status.?429/i.test(hay) || error?.status === 429) {
    return 'Bạn đã thực hiện quá nhiều yêu cầu. Hãy đợi vài phút rồi thử lại.';
  }
  if (/password should be|weak.?password/i.test(hay)) return 'Mật khẩu chưa đáp ứng yêu cầu bảo mật (cần tối thiểu 8 ký tự, nên có chữ và số).';
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|authretryablefetcherror/i.test(hay)) {
    return 'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng, hoặc project Supabase có thể đang tạm dừng (paused).';
  }
  return text || 'Đã xảy ra lỗi.';
}
