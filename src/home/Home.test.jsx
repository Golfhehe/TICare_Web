import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Home from './Home';
import DemoVideo from './DemoVideoBlock';

describe('Home', () => {
  it('shows the 5-step workflow and each step navigates', () => {
    const goTo = vi.fn();
    render(<Home go={vi.fn()} goTo={goTo} posts={[]} user={null} />);
    expect(screen.getByText(/không thay thế chẩn đoán hoặc điều trị y khoa/)).toBeInTheDocument();
    const steps = screen.getAllByRole('button').filter(b => b.classList.contains('home-step'));
    expect(steps).toHaveLength(5);
    fireEvent.click(steps[3]);
    expect(goTo).toHaveBeenCalledWith('action', undefined);
  });

  it('privacy link goes to the privacy page', () => {
    const go = vi.fn();
    render(<Home go={go} posts={[]} user={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Quyền riêng tư/ }));
    expect(go).toHaveBeenCalledWith('privacy');
  });
});

describe('DemoVideo', () => {
  it('shows an honest placeholder without a valid URL', () => {
    render(<DemoVideo url="javascript:alert(1)" />);
    expect(screen.getByText('Video minh hoạ đang được chuẩn bị')).toBeInTheDocument();
    expect(document.querySelector('iframe,video')).toBeNull();
  });
  it('renders <video> for mp4 and a nocookie iframe for YouTube', () => {
    const { unmount } = render(<DemoVideo url="https://cdn.example.com/d.mp4" />);
    const v = document.querySelector('video');
    expect(v).toHaveAttribute('controls'); expect(v).toHaveAttribute('preload', 'none');
    unmount();
    render(<DemoVideo url="https://youtu.be/dQw4w9WgXcQ" />);
    const f = screen.getByTitle('Video minh hoạ TICare');
    expect(f).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(f).toHaveAttribute('loading', 'lazy');
  });
});
