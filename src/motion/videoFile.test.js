import { describe, it, expect } from 'vitest';
import { validateVideoFile } from './videoFile';

const f = (name, type, size) => ({ name, type, size });
describe('validateVideoFile', () => {
  it('accepts mp4 and webm up to 200 MB', () => {
    expect(validateVideoFile(f('a.mp4', 'video/mp4', 1000))).toBeNull();
    expect(validateVideoFile(f('a.webm', 'video/webm', 200 * 1024 * 1024))).toBeNull();
  });
  it('rejects other formats, oversize and empty files with a clear message', () => {
    expect(validateVideoFile(f('a.mov', 'video/quicktime', 1000))).toMatch(/MP4 hoặc WebM/);
    expect(validateVideoFile(f('a.pdf', 'application/pdf', 1000))).toMatch(/MP4 hoặc WebM/);
    expect(validateVideoFile(f('a.mp4', 'video/mp4', 200 * 1024 * 1024 + 1))).toMatch(/200 MB/);
    expect(validateVideoFile(f('a.mp4', 'video/mp4', 0))).toMatch(/rỗng/);
    expect(validateVideoFile(null)).toBeTruthy();
  });
  it('trusts the extension when the browser gives no MIME type', () => {
    expect(validateVideoFile(f('clip.MP4', '', 5))).toBeNull();
  });
});
