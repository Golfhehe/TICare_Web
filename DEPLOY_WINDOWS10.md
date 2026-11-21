# Đưa TICare lên Internet (Vercel + Supabase)

Production hiện dùng: mã nguồn trên GitHub → Vercel tự build → Supabase cho tài khoản/dữ liệu.
**Không gửi API key hoặc mật khẩu cho người khác.** Không đặt `GEMINI_API_KEY` trong mã React, biến `VITE_` hoặc repository.

## 1. Cập nhật database production (làm TRƯỚC khi deploy code mới)
Các thay đổi database nằm trong `supabase/migrations/`. Xem bảng trạng thái trong [supabase/README.md](supabase/README.md).
Lần đầu (một lần duy nhất), trong PowerShell tại thư mục dự án:
```powershell
npx supabase login
npx supabase link --project-ref <project-ref>          # nhập mật khẩu database khi được hỏi
npx supabase migration repair --status applied 20261116000000 20261116000100
```
Mỗi lần có migration mới:
```powershell
npx supabase db push --dry-run    # xem migration nào sẽ chạy
npx supabase db push
```
- `<project-ref>` nằm trong URL dashboard: `https://supabase.com/dashboard/project/<project-ref>`.
- Không bao giờ chạy `seed.sql` hay `db reset --linked` trên production.
- Nếu project Supabase bị tạm dừng (gói miễn phí để lâu không dùng), bấm *Restore* trong dashboard trước.

## 2. Cấu hình Vercel
**Settings → Environment Variables** (Production và Preview):
| Biến | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | publishable/anon key (không dùng service_role) |
| `GEMINI_API_KEY` | khoá Google Gemini (server-side) |
| `GEMINI_MODEL` | tuỳ chọn, mặc định `gemini-2.5-flash` |
| `TAVILY_API_KEY` | tuỳ chọn |
| `VITE_DEMO_VIDEO_URL` | tuỳ chọn, video giới thiệu trang chủ |

Không điền `VITE_ASSISTANT_API_URL` (chatbot gọi `/api/ask` cùng tên miền). **Đổi biến môi trường xong phải Redeploy.**

## 3. Cấu hình Supabase Auth
**Authentication → URL Configuration**: Site URL = `https://<ten-web>.vercel.app`; thêm cùng URL (và URL preview nếu cần) vào Redirect URLs để email xác nhận/đặt lại mật khẩu mở đúng trang.

## 4. Đưa code lên
Đẩy nhánh lên GitHub; Vercel tự build. Nên đẩy lên một nhánh riêng trước để Vercel tạo bản *Preview*, kiểm tra xong mới gộp vào nhánh chính.
Thứ tự an toàn: **migration (mục 1) → biến môi trường (mục 2) → code (mục 4)**.

## 5. Kiểm thử sau triển khai
Dùng checklist phát hành trong `NOTE.md` §11. Tối thiểu:
- Hai tài khoản thường + một admin: đăng bài, bình luận, sửa/xoá đúng quyền, báo cáo → admin xử lý.
- Education: gửi học liệu → admin từ chối có ghi chú / duyệt → hiện ở Học liệu chia sẻ; Studio tạo bằng AI và bằng mẫu, xuất `.pptx` mở được.
- Action: tạo kế hoạch, nhiệm vụ có hạn, đính kèm ảnh.
- Motion (cần HTTPS): camera laptop + USB, lắc tay 15 giây ở độ nhạy thấp nhất có cảnh báo, ngồi yên 2 phút không cảnh báo nhầm, lưu phiên và mở lại.
- Chatbot: câu trả lời AI, và câu hỏi chẩn đoán/thuốc được từ chối an toàn.
- Mở DevTools → Console: ghi lại các cảnh báo *Content-Security-Policy (Report-Only)* nếu có; khi không còn cảnh báo có thể đổi header trong `vercel.json` từ `Content-Security-Policy-Report-Only` sang `Content-Security-Policy`.

## 6. Giới hạn và an toàn
- Motion Insight chỉ mô tả tín hiệu chuyển động, không chẩn đoán; không lưu video.
- Chưa có quét tệp độc hại cho tệp tải lên; giới hạn loại/dung lượng tệp do bucket Supabase kiểm soát.
- Hạn mức AI: 50 lượt chatbot và 20 lượt Studio mỗi tài khoản mỗi ngày (bảng `ai_usage`).
- Trước khi dùng rộng rãi: rà soát trang *Quyền riêng tư & đồng thuận*, quy trình xin phép nhà trường/phụ huynh, và thời hạn lưu trữ dữ liệu.
