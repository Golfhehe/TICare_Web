import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cameraErrorMessage, openCamera, loadSavedCamera, saveCamera } from './cameraErrors';

const err = name => Object.assign(new Error(name), { name });

describe('cameraErrorMessage', () => {
  it.each([
    ['NotAllowedError', 'quyền'],
    ['NotFoundError', 'Không tìm thấy camera'],
    ['NotReadableError', 'đang được ứng dụng khác'],
    ['OverconstrainedError', 'không còn kết nối'],
  ])('%s gives specific guidance', (name, snippet) => {
    expect(cameraErrorMessage(err(name))).toContain(snippet);
  });
  it('falls back to the error message', () => {
    expect(cameraErrorMessage(new Error('boom'))).toBe('boom');
    expect(cameraErrorMessage(null)).toMatch(/camera/);
  });
});

describe('openCamera', () => {
  it('uses the exact remembered device', async () => {
    const gum = vi.fn().mockResolvedValue('S');
    const r = await openCamera({ getUserMedia: gum }, 'dev1');
    expect(r).toEqual({ stream: 'S', usedFallback: false });
    expect(gum.mock.calls[0][0].video.deviceId).toEqual({ exact: 'dev1' });
  });
  it('falls back to the default camera when the remembered one is gone', async () => {
    const gum = vi.fn().mockRejectedValueOnce(err('OverconstrainedError')).mockResolvedValueOnce('DEFAULT');
    const r = await openCamera({ getUserMedia: gum }, 'gone');
    expect(r).toEqual({ stream: 'DEFAULT', usedFallback: true });
    expect(gum.mock.calls[1][0].video.deviceId).toBeUndefined();
  });
  it('does not mask permission errors', async () => {
    const gum = vi.fn().mockRejectedValue(err('NotAllowedError'));
    await expect(openCamera({ getUserMedia: gum }, 'dev1')).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(gum).toHaveBeenCalledTimes(1);
  });
});

describe('saved camera', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips and clears', () => {
    expect(loadSavedCamera()).toBe('');
    saveCamera('abc');
    expect(loadSavedCamera()).toBe('abc');
    saveCamera('');
    expect(loadSavedCamera()).toBe('');
  });
  it('never throws when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadSavedCamera()).toBe('');
    spy.mockRestore();
  });
});
