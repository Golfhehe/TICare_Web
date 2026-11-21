import { describe, it, expect } from 'vitest';
import { parseDemoVideo } from './demoVideo';

describe('parseDemoVideo', () => {
  it('accepts https mp4/webm files (query allowed)', () => {
    expect(parseDemoVideo('https://cdn.example.com/a/demo.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/a/demo.mp4' });
    expect(parseDemoVideo('https://x.org/demo.WEBM?token=1')).toMatchObject({ kind: 'file' });
  });
  it('converts YouTube links to the nocookie embed', () => {
    const want = { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' };
    expect(parseDemoVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(want);
    expect(parseDemoVideo('https://youtu.be/dQw4w9WgXcQ?t=5')).toEqual(want);
    expect(parseDemoVideo('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual(want);
    expect(parseDemoVideo('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toEqual(want);
  });
  it('rejects unsafe or unknown inputs', () => {
    for (const bad of ['javascript:alert(1)', 'http://x.org/a.mp4', 'data:video/mp4;base64,AAAA', 'https://evil.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short', 'https://x.org/page.html',
      'https://user:pw@x.org/a.mp4', '', '   ', undefined, null, 42, 'not a url']) {
      expect(parseDemoVideo(bad)).toBeNull();
    }
  });
});
