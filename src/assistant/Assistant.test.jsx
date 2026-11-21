import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const callApi = vi.fn();
vi.mock('../lib/api', () => ({ callApi: (...a) => callApi(...a) }));
import Assistant from './Assistant';
import { ASSISTANT_LIMIT_NOTE } from './assistantText';

const type = (q) => fireEvent.change(screen.getByLabelText('Câu hỏi'), { target: { value: q } });
const send = () => fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));

describe('Assistant', () => {
  beforeEach(() => { callApi.mockReset(); Element.prototype.scrollIntoView = vi.fn(); });

  it('shows the fixed limit sentence and no contradictory future-AI claim', () => {
    render(<Assistant user={null} notify={() => {}} />);
    expect(screen.getByText(ASSISTANT_LIMIT_NOTE)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/hướng phát triển tương lai/);
  });

  it('success: shows AI answer, safe external sources and remaining count', async () => {
    callApi.mockResolvedValue({ ok: true, status: 200, error: null, data: { answer: 'Dòng 1\nDòng 2 <b>x</b>', sources: [{ name: 'CDC', url: 'https://www.cdc.gov/x' }, { name: 'bad', url: 'javascript:alert(1)' }], remaining: 41 } });
    render(<Assistant user={{ id: 'u' }} notify={() => {}} />);
    type('Giáo viên nên làm gì khi có tic?'); send();
    expect(await screen.findByText(/Dòng 2/)).toBeTruthy();
    expect(callApi.mock.calls[0][1]).toMatchObject({ question: 'Giáo viên nên làm gì khi có tic?', history: [] });
    const link = within(document.querySelector('.chat-bubble.assistant')).getByRole('link', { name: /CDC/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByText('bad')).toBeNull();
    expect(screen.getByText(/Hôm nay còn 41 lượt/)).toBeTruthy();
    expect(document.querySelector('.chat-text b')).toBeNull(); // rendered as text, not HTML
  });

  it('failure: falls back to the sample answer with an offline label and reason', async () => {
    callApi.mockResolvedValue({ ok: false, status: 401, data: null, error: 'Vui lòng đăng nhập' });
    render(<Assistant user={null} notify={() => {}} />);
    type('Tic là gì?'); send();
    expect(await screen.findByText(/Câu trả lời mẫu \(offline\) · Chưa đăng nhập/)).toBeTruthy();
  });

  it('disables send while loading, then shows the 503 reason', async () => {
    let resolve; callApi.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<Assistant user={{ id: 'u' }} notify={() => {}} />);
    type('Tic là gì?'); send();
    expect(await screen.findByText(/Đang trả lời/)).toBeTruthy();
    type('câu hỏi khác nữa'); expect(screen.getByLabelText('Gửi câu hỏi').disabled).toBe(true);
    resolve({ ok: false, status: 503, data: null, error: 'x' });
    expect(await screen.findByText(/AI chưa được cấu hình/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Đang trả lời/)).toBeNull());
  });

  it('seed fills the input once without sending', () => {
    const used = vi.fn();
    render(<Assistant user={null} notify={() => {}} seed="Câu hỏi điền sẵn" onSeedUsed={used} />);
    expect(screen.getByLabelText('Câu hỏi').value).toBe('Câu hỏi điền sẵn');
    expect(callApi).not.toHaveBeenCalled();
    expect(used).toHaveBeenCalledTimes(1);
  });
});
