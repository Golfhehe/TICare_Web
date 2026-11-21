import { describe, it, expect } from 'vitest';
import { authErrorMessage } from './authErrors.js';

describe('authErrorMessage', () => {
  it.each([
    [{ message: 'Invalid login credentials' }, /không chính xác/],
    [{ message: 'Email not confirmed' }, /chưa xác nhận email/],
    [{ message: 'User already registered' }, /đã được đăng ký/],
    [{ message: 'email rate limit exceeded' }, /quá nhiều yêu cầu/],
    [{ message: 'x', code: 'over_email_send_rate_limit' }, /quá nhiều yêu cầu/],
    [{ message: 'x', status: 429 }, /quá nhiều yêu cầu/],
    [{ message: 'Password should be at least 8 characters' }, /Mật khẩu chưa đáp ứng/],
    [{ message: 'x', code: 'weak_password' }, /Mật khẩu chưa đáp ứng/],
    [{ message: 'Failed to fetch' }, /paused/],
    [{ message: 'TypeError: NetworkError when attempting to fetch resource' }, /paused/],
  ])('maps %o', (err, re) => {
    expect(authErrorMessage(err)).toMatch(re);
  });
  it('passes through unknown and local messages', () => {
    expect(authErrorMessage(new Error('Hai mật khẩu không khớp.'))).toBe('Hai mật khẩu không khớp.');
  });
  it('handles empty', () => {
    expect(authErrorMessage(undefined)).toBe('Đã xảy ra lỗi.');
  });
});
