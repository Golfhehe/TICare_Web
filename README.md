> **ĐƯA LÊN INTERNET:** Xem [DEPLOY_WINDOWS10.md](DEPLOY_WINDOWS10.md) để đưa TICare lên Vercel + Supabase, có đăng ký/đăng nhập và dữ liệu chung. Backend AI serverless tại `api/ask.js` chạy cùng Vercel khi có OPENAI_API_KEY.

# TICare Web — bản demo phát triển 1.0

Nền tảng hỗ trợ giáo viên về tic, với giao diện tiếng Việt, gồm:

- **A** Quan sát vận động: webcam, MediaPipe Pose Landmarker chạy ngay trên trình duyệt, phân tích tín hiệu dao động tương đối của đầu và đưa ra ước lượng chu kỳ mang tính thử nghiệm. Không chẩn đoán tic.
- **B** Cộng đồng: bảng tin, tìm kiếm/lọc, đăng bài, bình luận, lưu bài, báo cáo, tệp đính kèm; đăng ký/đăng nhập.
- **C** Trợ lý thông tin: giao diện chat, câu hỏi gợi ý, nguồn CDC/NHS; backend AI và tìm kiếm giới hạn tên miền là tùy chọn.
- **D** Giáo dục hòa nhập: bài học và tình huống mẫu.
- **F** Góc đồng hành: tình huống và định hướng ứng xử. (Trong thiết kế trước đây phần này từng gọi là E.)

## 1. Chạy ngay trên Windows 10 / 11

Cài Node.js LTS (v20+), mở PowerShell trong thư mục `TICare_Web`:

```powershell
npm install
npm run dev
```

Mở địa chỉ được Vite hiển thị, thường là **http://localhost:5173**. Không cần Supabase hay API key để thử giao diện.

**Lưu ý:** webcam yêu cầu quyền camera và internet để tải thư viện MediaPipe/mô hình lần đầu. Mở trên `localhost` hoặc HTTPS. Camera không gửi hình ảnh lên backend của TICare.

## 2. Chế độ demo (mặc định)

Nếu không có biến môi trường Supabase, bài viết, bình luận, báo cáo và tài khoản demo được lưu bằng `localStorage` **chỉ trong trình duyệt hiện tại**. Đây không phải đăng nhập bảo mật: mật khẩu demo nằm trong localStorage. **Không dùng mật khẩu thật.** Không có chia sẻ bài đăng giữa các máy. Tệp nhỏ (<= 1,5 MB) được lưu dạng Data URL; bộ nhớ trình duyệt có giới hạn. Các bài mẫu có nhãn demo.

Chatbot trả lời bằng một số câu mẫu đã biên soạn sẵn, kèm liên kết đọc thêm. **Nó không truy cập Internet trực tiếp trong chế độ demo.**

## 3. Kết nối Supabase để dùng tài khoản và bài đăng thật

1. Tạo project trên https://supabase.com.
2. Mở SQL Editor và chạy `supabase/schema.sql` trên project mới. **Hãy kiểm tra các policy trước khi triển khai công khai.**
3. Sao chép `.env.example` thành `.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` (publishable/anon key, không dùng service role).
4. Chạy lại `npm run dev`.
5. Trong Authentication, cấu hình email confirmation / Site URL / Redirect URLs cho môi trường của ông.

Trong chế độ Supabase, việc đăng bài và tệp dùng backend thật. Chức năng bình luận cho bài do người dùng tạo sử dụng database. **Các bài mẫu là nội dung minh họa, không thể bình luận lên database.** Các nút Lưu bài hiện lưu cục bộ trên trình duyệt. Bảng admin kiểm duyệt chưa được triển khai đầy đủ.

## 4. Kết nối chatbot AI và tìm kiếm web

Cần có API key riêng (có thể phát sinh chi phí):
- `OPENAI_API_KEY`: dịch vụ tạo câu trả lời.
- `TAVILY_API_KEY`: tùy chọn, tìm kiếm nguồn trong `cdc.gov`, `nhs.uk`, `tourette.org`.

Trên PowerShell, chạy backend ở một cửa sổ khác (ví dụ):

```powershell
$env:OPENAI_API_KEY="YOUR_KEY"
$env:TAVILY_API_KEY="YOUR_KEY"
$env:ALLOWED_ORIGIN="http://localhost:5173"
npm run server
```

Đặt `VITE_ASSISTANT_API_URL=http://localhost:8787` trong `.env.local`, khởi động lại frontend. **Không** đưa key vào biến bắt đầu bằng `VITE_`, không commit `.env.local` lên Git.

Backend hiện là bản tích hợp tối thiểu: chưa có xác thực người gọi, rate limiting, cache, crawling toàn văn, kiểm chứng trích dẫn ở cấp đoạn và giám sát chi phí. Nếu backend không sẵn sàng, giao diện tự chuyển về câu trả lời mẫu và có thông báo rõ ràng. Không triển khai backend này công khai trước khi bổ sung bảo vệ.

## 5. Build / triển khai

```powershell
npm run build
npm run preview
```

Thư mục `dist/` có thể đưa lên Vercel (framework Vite). Camera cần HTTPS. Backend Node hiện tại phải được triển khai riêng trên môi trường hỗ trợ Node server hoặc chuyển thành serverless function. Supabase cần cấu hình URL của site khi deploy.

## 6. Những giới hạn cần nói trung thực với BGK

- Đây là **bản demo phát triển**, không phải hệ thống đã được kiểm định y tế hay hoàn chỉnh cho trường học.
- Camera chỉ thử nghiệm mô tả chuyển động lặp lại của **một người đầu tiên**, dù MediaPipe có thể hiển thị tối đa 3 bộ điểm khớp. Có thể sai khi người di chuyển, thay đổi góc nhìn hoặc bị che khuất.
- Camera không xác định tic, không xác định học sinh mắc bệnh, không suy luận cảm xúc.
- Chế độ demo không đồng bộ cộng đồng giữa các máy; tài khoản demo không an toàn để sử dụng thật.
- Tài liệu D/F là nội dung minh họa; nên được rà soát trước khi đưa vào lớp học.
- Bản live chatbot cần kiểm thử kỹ độ chính xác nguồn và an toàn thông tin.
- Cần kiểm soát upload, spam, kiểm duyệt nội dung và dữ liệu cá nhân trước khi công khai cho nhiều người dùng.

## 7. Cấu trúc

- `src/App.jsx` — các trang và tương tác.
- `src/style.css` — thiết kế giao diện.
- `src/data.js` — nội dung mẫu, gợi ý chat.
- `src/supabase.js` — kết nối dữ liệu tùy chọn.
- `server/index.js` — backend AI tùy chọn.
- `supabase/schema.sql` — bảng dữ liệu và RLS cơ bản.
- `.env.example` — cấu hình tham khảo.
