# TICare — Database (Supabase)

## Cấu trúc
| File | Vai trò |
|---|---|
| `migrations/20261116000000_baseline.sql` | Toàn bộ schema production (dựng lại từ snapshot 2026-11-16). **Đã có trên production.** |
| `migrations/20261116000100_core_gaps.sql` | Migration 002. **Đã chạy trên production ngày 2026-11-16.** |
| `migrations/20261118000000_community_files_owner_read.sql` | Migration 003: cho chủ file đọc/xoá file của mình trong `community-files` (để dọn file khi đăng bài lỗi). **Chưa chạy trên production.** |
| `migrations/20261118000100_education_v3.sql` | Migration 004: `education_resources` thêm `tags`, `reviewed_by`, `reviewed_at`, `review_note`; policy tác giả xoá học liệu chưa duyệt; bảng `ai_usage` + hàm `consume_ai_quota` (hạn mức AI). **Chưa chạy trên production.** |
| `migrations/20261118000200_motion_sessions.sql` | Migration 005: bảng `motion_sessions` (phiên Motion Insight đã lưu: chỉ số tổng hợp, không video, RLS chủ sở hữu). **Chưa chạy trên production.** |
| `seed.sql` | Dữ liệu **giả lập** cho local: 3 tài khoản test, 26 bài, bình luận, báo cáo, kế hoạch Action, học liệu, 2 phiên Motion mẫu. Không bao giờ chạy trên production. |
| `config.toml` | Cấu hình Supabase local (cổng 553xx, để không trùng với project Supabase local khác trên máy). |
| `snapshot_production_part*.csv` | Snapshot cấu trúc production dùng để dựng baseline. |
| `.local/` | (git-ignored) nơi đặt dump production nếu sau này cần. |

## Chạy local (Docker)
```powershell
npm run db:start     # khởi động Supabase local trong Docker (lần đầu tải image)
npm run db:reset     # xoá DB local, chạy lại toàn bộ migrations + seed.sql
npm run test:rls     # kiểm tra 33 tình huống phân quyền (RLS) bằng 3 tài khoản test (chạy lại nhiều lần được; hạn mức AI tích luỹ theo ngày, db:reset để về 0)
npm run dev          # app ở http://localhost:5173 (.env.local trỏ vào http://127.0.0.1:55321)
npm run db:stop      # tắt Supabase local (dữ liệu được giữ)
```
- Studio (xem/sửa bảng): http://127.0.0.1:55323
- Hộp thư email test (xác nhận đăng ký, quên mật khẩu): http://127.0.0.1:55324
- Tài khoản test: xem đầu file `seed.sql`.

## Sửa schema
1. Tạo migration mới: `npx supabase migration new <ten_ngan>`. Viết SQL **idempotent** (`drop policy if exists`, `add column if not exists`...).
2. Áp vào local: `npx supabase migration up` (hoặc `npm run db:reset` để làm lại từ đầu).
3. Chạy `npm run test:rls`, `npm test`, thử trên app. Thêm tình huống mới vào `scripts/rls-smoke.mjs` nếu migration đổi quyền.
4. Commit migration cùng code dùng nó.

## Đẩy lên production (người dùng tự chạy, cần mật khẩu database)
Lần đầu, liên kết project và đánh dấu các migration **đã có sẵn** trên production:
```powershell
npx supabase link --project-ref <project-ref>
npx supabase migration repair --status applied 20261116000000 20261116000100
```
Mỗi lần đẩy:
```powershell
npx supabase db push --dry-run   # xem trước migration nào sẽ chạy
npx supabase db push             # áp các migration chưa có lên production
```
Không dùng `db push` cho `seed.sql`. Không chạy `db reset --linked` (xoá dữ liệu production).

> **Thứ tự triển khai bắt buộc:** chạy `db push` (migration 003, 004, 005) **trước** khi deploy code Đợt 2 lên Vercel.
> Code mới đọc các cột `education_resources.tags/review_note/reviewed_at` và gọi `consume_ai_quota`; deploy code trước khi có migration sẽ làm tab Học liệu/Quản trị lỗi 400.
> Sau đó đặt `GEMINI_API_KEY` (không tiền tố `VITE_`) trong Vercel → Settings → Environment Variables rồi redeploy.
