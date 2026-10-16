# Đưa TICare lên Internet (Windows 10) — hướng dẫn từng bước

## 1. Chuẩn bị

- Một tài khoản GitHub: https://github.com
- Một tài khoản Vercel: https://vercel.com (đăng nhập bằng GitHub)
- Một tài khoản Supabase: https://supabase.com
- Tùy chọn: OpenAI API key để chạy chatbot AI thật (có thể phát sinh phí); Tavily API key nếu muốn tra cứu web.

**Không gửi API key hoặc mật khẩu cho người khác.** Không đặt OPENAI_API_KEY trong mã React, biến `VITE_` hoặc repository.

## 2. Cấu hình Supabase — để đăng ký, đăng nhập, bài đăng hoạt động trên nhiều máy

1. Tạo một project Supabase mới.
2. Vào **SQL Editor** → New query → dán nội dung `supabase/schema.sql` → Run (chỉ dùng cho project mới, xem lại các chính sách trước khi dùng công khai).
3. Vào **Project Settings → API Keys** và lấy **Project URL** cùng **publishable key** (hoặc anon key). Không lấy service_role.
4. Vào **Authentication → Providers → Email**, bật Email provider; cấu hình yêu cầu xác nhận email theo nhu cầu.
5. Sau khi Vercel cấp URL, vào **Authentication → URL Configuration** đặt Site URL thành `https://<ten-web>.vercel.app`, thêm cùng URL vào Redirect URLs.

> Khi Supabase chưa được cấu hình, web dùng localStorage để trình diễn trên một trình duyệt, KHÔNG có tài khoản chung hay dữ liệu cộng đồng giữa các máy.

## 3. Đưa mã nguồn lên GitHub (không cần VS Code)

1. Giải nén ZIP `TICare_Web_Online_Ready.zip`.
2. Vào GitHub → **New repository** → đặt tên `ticare-web` → Create repository.
3. Trong repository → **Add file → Upload files**. Tải lên **nội dung bên trong thư mục TICare_Web** (đảm bảo `package.json` nằm ở gốc repo). Nếu giao diện GitHub không hỗ trợ kéo nguyên thư mục, dùng GitHub Desktop hoặc Git trên Windows.
4. Tuyệt đối không upload `.env.local`, `node_modules`, khóa bí mật.

## 4. Triển khai Vercel

1. Vercel → **Add New → Project** → Import repository `ticare-web`.
2. Framework Preset: **Vite**; Build Command: `npm run build`; Output Directory: `dist`.
3. Trong **Environment Variables** điền:
   - `VITE_SUPABASE_URL` = URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = publishable/anon key
   - `OPENAI_API_KEY` = khóa API OpenAI, chỉ dùng server-side (nếu có)
   - `OPENAI_MODEL` = `gpt-4.1-mini` (tùy chọn)
   - `TAVILY_API_KEY` = khóa Tavily (tùy chọn)
   - **KHÔNG** điền `VITE_ASSISTANT_API_URL`: trên Vercel, chatbot gọi `/api/ask` cùng tên miền.
4. Bấm **Deploy**, chờ build xong. Vercel sẽ cấp đường dẫn `https://...vercel.app`.
5. Quay lại Supabase cấu hình Site URL như bước 2. Nếu chỉnh biến môi trường, bấm **Redeploy**.

## 5. Kiểm thử sau triển khai

- Mở URL trên hai trình duyệt hoặc hai máy khác nhau.
- Tạo tài khoản A và B bằng hai email khác nhau, xác nhận email nếu bật.
- Đăng bài từ A → kiểm tra B có nhìn thấy bài không → B bình luận → A tải lại trang để thấy bình luận.
- Bật camera và cho phép truy cập. Camera cần HTTPS, nên dùng URL Vercel. Không thử camera với học sinh thật khi chưa có sự đồng ý và quy trình bảo vệ quyền riêng tư.
- Gửi câu hỏi vào chatbot. Nếu chưa có `OPENAI_API_KEY`, chatbot sẽ hiển thị **câu trả lời mẫu**, không phải AI thật.

## 6. Giới hạn và an toàn

- Motion Insight chỉ mô tả tín hiệu chuyển động, không phát hiện/chẩn đoán tic; kết quả có thể sai.
- Dữ liệu cộng đồng và xác thực Supabase dùng thật khi cấu hình, nhưng chưa có quy trình kiểm duyệt, chống spam, quét tệp độc hại và giới hạn truy cập ở cấp triển khai hoàn chỉnh.
- API chatbot yêu cầu đăng nhập khi có Supabase. Chưa có rate limiting phân tán hoặc hạn mức theo tài khoản; **không mở chatbot API trả phí rộng rãi trước khi đặt quota/bảo vệ chống lạm dụng**.
- Không tải dữ liệu cá nhân, hình ảnh học sinh, tài liệu nhạy cảm lên cộng đồng.
- Nếu website công khai cho nhiều người, cần hoàn thiện kiểm duyệt, điều khoản và chính sách riêng tư trước khi dùng thực tế.

## 7. Chạy trên Windows 10

Mở CMD ở thư mục có `package.json`:

```cmd
npm install
npm run dev
```

Mở địa chỉ được hiển thị, thường là `http://localhost:5173`.
