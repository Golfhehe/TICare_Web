-- TICare LOCAL seed data (synthetic, no real users). Applied by `npx supabase db reset`.
-- NEVER run on production.
--
-- Test accounts (local only) — password for all: TICare@2026
--   admin@ticare.test     role admin   "Quản trị TICare"
--   gv.lan@ticare.test    role member  "Cô Lan (GV lớp 2)"
--   gv.minh@ticare.test   role member  "Thầy Minh (GV lớp 1)"
-- Emails sent locally (confirm / reset password) are visible at http://localhost:55324

-- ============================================================ auth users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('TICare@2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.name), now() - interval '60 days', now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@ticare.test',   'Quản trị TICare'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'gv.lan@ticare.test',  'Cô Lan (GV lớp 2)'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'gv.minh@ticare.test', 'Thầy Minh (GV lớp 1)')
) as u(id, email, name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u where u.email like '%@ticare.test';

-- profiles are created by the on_auth_user_created trigger; promote the admin
update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';

-- ============================================================ community posts
insert into public.posts (id, author_id, title, body, category, status, created_at) values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
  'Học sinh nháy mắt nhiều trong giờ kiểm tra, tôi nên làm gì?',
  'Lớp 2 của tôi có một em thường nháy mắt và hắng giọng nhiều hơn khi làm bài kiểm tra. Tôi không muốn nhắc trước lớp. Các thầy cô đã thử cách nào để giảm áp lực cho học sinh trong giờ kiểm tra?',
  'Tình huống lớp học','published', now() - interval '2 days'),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003',
  'Tic là gì? Tóm tắt ngắn cho giáo viên mới',
  'Tic là những cử động hoặc âm thanh lặp lại, đột ngột, không theo nhịp. Phần lớn tic ở trẻ em giảm dần theo thời gian. Giáo viên không chẩn đoán; vai trò của chúng ta là quan sát, tạo môi trường an toàn và phối hợp với gia đình. Nguồn: CDC, NHS.',
  'Kiến thức về tic','published', now() - interval '5 days'),
 ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002',
  'Bộ thẻ tình huống "Tôn trọng sự khác biệt" cho lớp 1–3',
  'Tôi soạn 12 thẻ tình huống giúp học sinh luyện cách phản ứng tôn trọng khi bạn có hành vi khác biệt. Mỗi thẻ có câu hỏi thảo luận và gợi ý hoạt động nhóm 10 phút.',
  'Tài nguyên giáo dục','published', now() - interval '7 days'),
 ('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000003',
  'Kinh nghiệm trao đổi với phụ huynh lần đầu',
  'Tôi bắt đầu bằng những điểm mạnh của con, sau đó mô tả quan sát cụ thể (thời điểm, bối cảnh), tránh dùng từ chẩn đoán. Phụ huynh hợp tác hơn hẳn so với lần trước.',
  'Kinh nghiệm chia sẻ','published', now() - interval '9 days'),
 ('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000002',
  'Bài viết đã bị ẩn do vi phạm (dữ liệu mẫu)',
  'Bài này mô phỏng trường hợp admin đã ẩn sau khi xử lý báo cáo. Tác giả vẫn thấy bài nhưng không thể tự khôi phục.',
  'Tình huống lớp học','hidden', now() - interval '12 days'),
 ('b0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000003',
  'Bài viết tác giả đã xoá (dữ liệu mẫu)',
  'Bài này mô phỏng trường hợp tác giả đã xoá mềm (status = removed).',
  'Kinh nghiệm chia sẻ','removed', now() - interval '14 days');

-- filler posts to exercise paging / "load more" (> 20 published posts)
insert into public.posts (author_id, title, body, category, status, created_at)
select case when g % 2 = 0 then 'a0000000-0000-4000-8000-000000000002'::uuid else 'a0000000-0000-4000-8000-000000000003'::uuid end,
  'Ghi chú lớp học số ' || g,
  'Nội dung mẫu số ' || g || ': chia sẻ một hoạt động ngắn giúp lớp học hòa nhập và giảm áp lực cho học sinh.',
  (array['Kiến thức về tic','Tài nguyên giáo dục','Tình huống lớp học','Kinh nghiệm chia sẻ'])[1 + g % 4],
  'published', now() - (g || ' days')::interval - interval '15 days'
from generate_series(1, 20) as g;

-- ============================================================ comments, saved, reports
insert into public.comments (post_id, author_id, body, created_at) values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003',
  'Tôi cho phép học sinh ngồi gần cửa và có thể xin ra ngoài 1–2 phút mà không cần giải thích. Hiệu quả khá tốt.', now() - interval '1 day'),
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
  'Gợi ý thêm: tăng thời gian làm bài và giảm số câu trên một trang.', now() - interval '20 hours'),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',
  'Cảm ơn thầy, bản tóm tắt rất dễ hiểu.', now() - interval '4 days');

insert into public.saved_posts (user_id, post_id) values
 ('a0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002'),
 ('a0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004');

insert into public.reports (post_id, reporter_id, reason, status, handled_by, handled_at, created_at) values
 ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003',
  'Báo cáo mẫu đang chờ xử lý: kiểm tra giúp nguồn của bộ thẻ.', 'pending', null, null, now() - interval '1 day'),
 ('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000003',
  'Bài có thể chứa thông tin nhận diện học sinh.', 'reviewed',
  'a0000000-0000-4000-8000-000000000001', now() - interval '11 days', now() - interval '12 days');

-- ============================================================ TICare Action
insert into public.action_plans (id, owner_id, title, status, plan, created_at, updated_at) values
 ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
  'Giảm áp lực trong giờ kiểm tra – HS-A lớp 2', 'active',
  jsonb_build_object(
    'title','Giảm áp lực trong giờ kiểm tra – HS-A lớp 2', 'caseTag','HS-A', 'classLevel','Lớp 2',
    'goal','Học sinh hoàn thành bài kiểm tra trong trạng thái thoải mái, không bị chú ý tiêu cực từ bạn bè.',
    'focus','Tạo môi trường học tập tôn trọng, linh hoạt và an toàn.',
    'startDate', to_char(current_date - 10, 'YYYY-MM-DD'), 'endDate', to_char(current_date + 2, 'YYYY-MM-DD'),
    'status','active', 'notes','Đã trao đổi với phụ huynh ngày đầu tuần. Theo dõi thêm 2 tuần.', 'review','',
    'attachments','[]'::jsonb,
    'tasks', jsonb_build_array(
      jsonb_build_object('id','t1','text','Bố trí chỗ ngồi gần cửa','done',true),
      jsonb_build_object('id','t2','text','Thống nhất tín hiệu xin nghỉ ngắn','done',true),
      jsonb_build_object('id','t3','text','Tổ chức bài học "Tôn trọng sự khác biệt"','done',false),
      jsonb_build_object('id','t4','text','Họp xem lại kế hoạch với tổ chuyên môn','done',false))),
  now() - interval '10 days', now() - interval '1 day'),
 ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',
  'Kế hoạch giáo dục hòa nhập học kỳ II', 'draft',
  jsonb_build_object('title','Kế hoạch giáo dục hòa nhập học kỳ II','caseTag','Lớp 2A','classLevel','Lớp 2',
    'goal','Xây dựng chuỗi 4 bài học về sự đồng cảm.','focus','Tạo môi trường học tập tôn trọng, linh hoạt và an toàn.',
    'startDate', to_char(current_date, 'YYYY-MM-DD'), 'endDate','', 'status','draft', 'notes','', 'review','',
    'attachments','[]'::jsonb, 'tasks','[]'::jsonb),
  now() - interval '2 days', now() - interval '2 days'),
 ('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003',
  'Hỗ trợ HS-B thích nghi đầu năm lớp 1', 'done',
  jsonb_build_object('title','Hỗ trợ HS-B thích nghi đầu năm lớp 1','caseTag','HS-B','classLevel','Lớp 1',
    'goal','Học sinh tham gia hoạt động nhóm ít nhất 3 lần/tuần.','focus','Tạo môi trường học tập tôn trọng, linh hoạt và an toàn.',
    'startDate', to_char(current_date - 60, 'YYYY-MM-DD'), 'endDate', to_char(current_date - 5, 'YYYY-MM-DD'),
    'status','done', 'notes','', 'review','Mục tiêu đạt được sau 6 tuần.', 'attachments','[]'::jsonb,
    'tasks', jsonb_build_array(jsonb_build_object('id','t1','text','Ghép cặp bạn đồng hành','done',true))),
  now() - interval '60 days', now() - interval '5 days');

-- ============================================================ TICare Education (link resources: no storage files needed)
insert into public.education_resources (author_id, title, description, audience, kind, external_url, status, created_at, tags, reviewed_by, reviewed_at, review_note) values
 ('a0000000-0000-4000-8000-000000000002','Video: Hiểu về tic cho học sinh nhỏ','Video hoạt hình ngắn giải thích tic bằng ngôn ngữ phù hợp trẻ em.','lop_1','link','https://www.nhs.uk/conditions/tics/','approved', now() - interval '20 days', '{ton-trong,truc-quan}', 'a0000000-0000-4000-8000-000000000001', now() - interval '19 days', null),
 ('a0000000-0000-4000-8000-000000000003','Tài liệu CDC về hội chứng Tourette','Tổng quan dành cho giáo viên và phụ huynh.','lop_3','link','https://www.cdc.gov/tourette-syndrome/','approved', now() - interval '18 days', '{hoa-nhap,binh-tinh}', 'a0000000-0000-4000-8000-000000000001', now() - interval '17 days', null),
 ('a0000000-0000-4000-8000-000000000002','Trò chơi "Bạn khác, mình tôn trọng"','Trò chơi thẻ hình cho mầm non.','mam_non','link','https://example.org/tro-choi-ton-trong','approved', now() - interval '15 days', '{tro-choi,ton-trong,chong-treu-choc}', 'a0000000-0000-4000-8000-000000000001', now() - interval '14 days', null),
 ('a0000000-0000-4000-8000-000000000003','Slide bài học đồng cảm (chờ duyệt)','Học liệu mẫu đang chờ admin duyệt.','lop_2','link','https://example.org/slide-dong-cam','pending', now() - interval '1 days', '{cam-xuc,hoat-dong-nhom}', null, null, null),
 ('a0000000-0000-4000-8000-000000000002','Liên kết không phù hợp (đã từ chối)','Học liệu mẫu đã bị từ chối.','lop_2','link','https://example.org/khong-phu-hop','rejected', now() - interval '6 days', '{giao-tiep}', 'a0000000-0000-4000-8000-000000000001', now() - interval '5 days', 'Trang này chưa có nội dung giáo dục phù hợp lứa tuổi. Bạn vui lòng bổ sung nguồn tham khảo rồi gửi lại.');

-- ============================================================ Motion Insight: 2 saved sessions of gv.lan (synthetic, no real names)
insert into public.motion_sessions (id, owner_id, label, source, started_at, duration_s, settings, events, series, note, created_at) values
 ('d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','HS-A lớp 2','camera', now() - interval '3 days', 60,
  '{"sensitivity":60,"holdSeconds":2,"cooldownSeconds":20}'::jsonb,
  '[{"t":12.4,"channel":"left","intensity":9.8,"duration":420},{"t":13.1,"channel":"left","intensity":7.2,"duration":260},{"t":41.0,"channel":"head","intensity":5.1,"duration":180}]'::jsonb,
  (select jsonb_agg(jsonb_build_object('t', s, 'head', round((0.004 + case when s = 41 then 0.03 else 0 end)::numeric, 4),
      'left', round((0.005 + case when s in (12,13) then 0.04 else 0 end)::numeric, 4),
      'right', 0.004, 'blink', 0.01, 'face', 0.012) order by s) from generate_series(0, 59) s),
  'Phiên mẫu: quan sát giờ làm bài.', now() - interval '3 days'),
 ('d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','HS-B video thử','video', now() - interval '1 day', 30,
  '{"sensitivity":40,"holdSeconds":2,"cooldownSeconds":20}'::jsonb,
  '[]'::jsonb,
  (select jsonb_agg(jsonb_build_object('t', s, 'head', 0.003, 'left', 0.004, 'right', 0.004, 'blink', 0.008, 'face', 0.01) order by s) from generate_series(0, 29) s),
  null, now() - interval '1 day');
