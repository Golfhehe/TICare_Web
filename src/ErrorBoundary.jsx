import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('TICare ErrorBoundary:', error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const box = { maxWidth: 480, margin: '12vh auto', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' };
    const btn = { margin: 6, padding: '10px 18px', borderRadius: 8, border: '1px solid #888', background: '#fff', cursor: 'pointer', fontSize: 15 };
    return (
      <div role="alert" style={box}>
        <h2>Đã có lỗi khi hiển thị trang</h2>
        <p>Dữ liệu của bạn trên máy chủ không bị ảnh hưởng. Hãy tải lại trang; nếu lỗi lặp lại, hãy báo cho quản trị viên.</p>
        <button type="button" style={btn} onClick={() => window.location.reload()}>Tải lại trang</button>
        <button type="button" style={btn} onClick={() => { window.location.href = '/'; }}>Về trang chủ</button>
      </div>
    );
  }
}
