import React from 'react';
import { ShieldCheck } from 'lucide-react';

const PRIVACY_SECTIONS = [
  { h: 'Camera và video', items: [
    'TICare không lưu video hoặc ảnh từ camera. Hình ảnh được xử lý ngay trên trình duyệt của bạn và không được tải lên máy chủ.',
    'Trước lần dùng camera hoặc video đầu tiên trên mỗi thiết bị, bạn sẽ được yêu cầu xác nhận đã có sự đồng ý của nhà trường/phụ huynh. Hãy xin phép trước khi quan sát học sinh bằng camera.',
  ] },
  { h: 'Phiên quan sát Motion', items: [
    'Chỉ khi giáo viên bấm Lưu, hệ thống mới lưu số liệu tổng hợp của phiên (thời lượng, sự kiện, biểu đồ) vào tài khoản của bạn.',
    'Mỗi phiên gắn với mã do bạn tự đặt. Không dùng tên thật hoặc thông tin nhận diện của học sinh làm mã phiên.',
  ] },
  { h: 'Kế hoạch Action và tệp đính kèm', items: [
    'Kế hoạch TICare Action và tệp đính kèm là riêng tư theo tài khoản; tài khoản khác không đọc được.',
    'Chỉ đính kèm hình minh hoạ hoặc tài liệu giáo dục không định danh học sinh.',
  ] },
  { h: 'Cộng đồng giáo dục', items: [
    'Bài viết và bình luận trong Cộng đồng công khai cho người đọc. Không đăng thông tin nhận diện học sinh (tên, ảnh, lớp, hồ sơ sức khỏe).',
  ] },
  { h: 'Chatbot và Studio (dịch vụ AI)', items: [
    'Câu hỏi bạn gửi tới Chatbot hoặc Studio được chuyển tới dịch vụ AI (Google Gemini) để tạo câu trả lời. Không nhập thông tin nhận diện trẻ.',
  ] },
  { h: 'Xoá dữ liệu', items: [
    'Bạn có thể tự xoá phiên Motion đã lưu, kế hoạch Action và bài viết của mình ngay trong ứng dụng.',
    'Muốn xoá tài khoản, hãy liên hệ quản trị viên TICare của trường.',
  ] },
  { h: 'Giới hạn y khoa', items: [
    'TICare hỗ trợ giáo viên quan sát, tìm hiểu, lập kế hoạch và triển khai hoạt động giáo dục. TICare không chẩn đoán và không thay thế đánh giá hoặc điều trị y khoa.',
  ] },
];

export default function Privacy({ go }) {
  return (
    <div className="privacy-page">
      <div className="page-heading"><div>
        <div className="eyebrow">QUYỀN RIÊNG TƯ</div>
        <h1>Quyền riêng tư &amp; đồng thuận</h1>
        <p>Dữ liệu nào được xử lý, lưu ở đâu và bạn kiểm soát nó như thế nào.</p>
      </div></div>
      <div className="privacy-grid">
        {PRIVACY_SECTIONS.map((s, n) => (
          <section className="panel" key={s.h} aria-labelledby={'pv-' + n}>
            <h2 id={'pv-' + n}>{s.h}</h2>
            <ul>{s.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        ))}
      </div>
      <p className="small-text muted privacy-law"><ShieldCheck size={15} /> Việc thu thập và sử dụng dữ liệu liên quan đến trẻ em cần tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành (Nghị định 13/2023/NĐ-CP) và quy định của nhà trường.</p>
      {go && <button type="button" className="btn btn-outline" onClick={() => go('home')}>Về trang chủ</button>}
    </div>
  );
}
