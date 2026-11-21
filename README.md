# TICare Web

Nền tảng tiếng Việt hỗ trợ giáo viên và nhà trường **quan sát — tìm hiểu — lập kế hoạch — triển khai hoạt động giáo dục** cho học sinh có biểu hiện tic.
TICare là công cụ giáo dục và quan sát, **không chẩn đoán và không thay thế đánh giá của chuyên gia y tế**.

> Triển khai lên Internet: xem [DEPLOY_WINDOWS10.md](DEPLOY_WINDOWS10.md). Database và quy trình migration: xem [supabase/README.md](supabase/README.md).

## Phân hệ
| Phân hệ | Chức năng chính |
|---|---|
| **Motion Insight** | Camera laptop/USB hoặc video kiểm thử; MediaPipe Pose + Face chạy trên trình duyệt (không gửi hình ảnh đi). Bộ phát hiện sự kiện theo kênh (đầu, cổ tay, chớp mắt, cơ mặt), độ nhạy, cảnh báo (banner, âm thanh, thông báo), lưu phiên (chỉ số liệu), lịch sử, xuất CSV/PNG. |
| **Action** | Kế hoạch hỗ trợ: nhiệm vụ có tag, ngày bắt đầu/hạn, tiến độ, nhắc hạn, ghi chú, đính kèm có xem trước ảnh, thư viện 22 biện pháp có nguồn. |
| **Education** | Bài học, slide, trò chơi, Góc đồng hành; học liệu chia sẻ có tag; *Học liệu của tôi*; *Quản trị* duyệt/từ chối; **Studio** tạo bài giảng bằng mẫu hoặc AI, kiểm tra nội dung trước khi xuất PowerPoint. |
| **Community** | Bài viết, bình luận, lưu bài, báo cáo vi phạm, sửa/xoá theo quyền, quản trị báo cáo. |
| **Chatbot** | Hỏi đáp qua Google Gemini (`/api/ask`), giới hạn 50 lượt/ngày/tài khoản; tự chuyển về câu trả lời mẫu (offline) khi chưa đăng nhập, hết lượt hoặc AI chưa cấu hình. |
| **Quản trị** | Xử lý báo cáo (lưu người/thời điểm xử lý), duyệt học liệu. Quyền admin được kiểm soát bằng RLS trong Supabase, không chỉ ẩn nút. |
| **TICtag** | Chưa triển khai (định hướng giai đoạn sau). Học liệu đã có trường `tags` để chuẩn bị. |

## Chạy trên máy (Windows 10/11)
Cần Node.js 20+ và Docker Desktop (cho database local).
```powershell
npm install
npm run db:start        # Supabase local trong Docker (lần đầu tải image)
npm run db:reset        # tạo DB từ supabase/migrations + dữ liệu mẫu supabase/seed.sql
copy .env.example .env.local
# điền VITE_SUPABASE_URL=http://127.0.0.1:55321 và VITE_SUPABASE_ANON_KEY (lấy bằng: npx supabase status)
npm run dev             # http://localhost:5173
```
- Tài khoản test (chỉ local): xem đầu file `supabase/seed.sql`.
- Studio xem bảng: http://127.0.0.1:55323 · Hộp thư email test: http://127.0.0.1:55324
- Thử AI ở local: điền `GEMINI_API_KEY` vào `.env.local` rồi chạy lại `npm run dev` (plugin `devApi` của Vite chạy các hàm trong `api/`).
- Không có Supabase (để trống 2 biến `VITE_SUPABASE_*`): vẫn xem được giao diện, bài học mẫu, Motion và câu trả lời mẫu; các chức năng cần tài khoản (đăng bài, lưu phiên, kế hoạch, học liệu) không hoạt động.

## Kiểm thử
```powershell
npm run lint            # ESLint
npm test                # Vitest: unit + component + API (mock)
npm run build
npm run test:rls        # 33 tình huống phân quyền trên Supabase local
```
CI (`.github/workflows/ci.yml`) chạy toàn bộ các lệnh trên, kể cả `test:rls` với Supabase trong Docker.

## Biến môi trường
| Biến | Nơi dùng | Ghi chú |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | trình duyệt | Công khai theo thiết kế Supabase. **Không** dùng service_role. |
| `VITE_DEMO_VIDEO_URL` | trình duyệt | Tuỳ chọn. https tới .mp4/.webm hoặc link YouTube cho video giới thiệu trang chủ. |
| `VITE_ASSISTANT_API_URL` | trình duyệt | Tuỳ chọn, mặc định `/api/ask`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | server (`api/`) | **Không** đặt tiền tố `VITE_`. Model mặc định `gemini-2.5-flash`. |
| `TAVILY_API_KEY` | server | Tuỳ chọn, tìm nguồn trong cdc.gov, nhs.uk, who.int, tourette.org. |
| `TICARE_DEMO_CODE` | server | Tuỳ chọn (≥ 16 ký tự): mã thử chatbot không cần tài khoản, giới hạn theo IP. |

## Cấu trúc
```
api/                 Hàm serverless Vercel: ask.js (chatbot), education-generate.js (Studio), _lib/ (xác thực + hạn mức)
src/App.jsx          Khung ứng dụng, điều hướng, Community, Education, Admin
src/home/            Trang chủ, video demo
src/motion/          Motion Insight: detector.js (thuật toán), Motion.jsx, lịch sử phiên, đồng thuận
src/action/ + Action.jsx   TICare Action
src/education/ + EducationStudio.jsx   Học liệu của tôi, Quản trị học liệu, Studio
src/assistant/       Chatbot
src/components/      Modal dùng chung
src/pages/Privacy.jsx      Quyền riêng tư & đồng thuận
src/lib/             Tiện ích: db (mutate), uid, api, authErrors, lessonCheck, eduTags
supabase/            migrations/, seed.sql (dữ liệu giả lập), config.toml, README.md
scripts/             rls-smoke.mjs (test phân quyền), db-pull.ps1 (kéo dump production, tuỳ chọn)
```

## Giới hạn cần nói rõ
- Motion Insight mô tả tín hiệu chuyển động, **không xác định tic, mức độ hay loại tic**. Thuật toán đã kiểm chứng bằng tín hiệu tổng hợp; cần kiểm thử thêm với camera thật, nhiều góc quay và video có nhãn.
- Chỉ phân tích một người trong khung hình; kết quả có thể sai khi bị che, đổi góc, ánh sáng yếu hoặc máy chạy dưới 12 khung hình/giây.
- Không kết nối trực tiếp camera IP/RTSP của lớp học; chỉ camera trình duyệt nhận được (laptop, USB, webcam ảo).
- Nội dung AI (Chatbot, Studio) là bản nháp tham khảo, giáo viên phải kiểm tra trước khi sử dụng.
- Trước khi dùng với học sinh thật: cần sự đồng ý của nhà trường/phụ huynh và rà soát trang *Quyền riêng tư & đồng thuận* theo quy định bảo vệ dữ liệu cá nhân hiện hành.
