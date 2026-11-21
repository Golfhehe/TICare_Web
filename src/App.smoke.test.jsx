// Smoke test: the whole app renders without Supabase configured and every main page opens without crashing.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: null, live: false }));
// jsdom has no media pipeline; Motion calls load()/pause() on its <video> during cleanup.
window.HTMLMediaElement.prototype.load = () => {};
window.HTMLMediaElement.prototype.pause = () => {};

const { default: App } = await import('./App.jsx');

describe('App smoke (no Supabase)', () => {
  it('renders the home page', () => {
    render(<App />);
    expect(document.body.textContent).toMatch(/không thay thế chẩn đoán/i);
  });

  it('opens every main page from the sidebar without crashing', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    const nav = screen.getAllByRole('navigation')[0];
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const b of buttons) fireEvent.click(b);
    expect(screen.queryByText(/Đã có lỗi khi hiển thị trang/i)).toBeNull();
    errors.mockRestore();
  });
});
