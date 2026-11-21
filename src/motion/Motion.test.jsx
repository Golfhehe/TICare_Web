import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ---- fake MediaPipe: a person whose left wrist shakes at 4 Hz after 8 s, scripted by the number of frames processed ----
const fake = vi.hoisted(() => ({ frame: 0, shakeFrom: 240 }));
vi.mock('@mediapipe/tasks-vision', () => {
  const makePts = k => {
    const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    pts[11] = { x: 0.4, y: 0.4, visibility: 1 }; pts[12] = { x: 0.6, y: 0.4, visibility: 1 };
    pts[0] = { x: 0.5, y: 0.3, visibility: 1 };
    const shake = k >= fake.shakeFrom ? 0.05 * Math.sin(2 * Math.PI * 4 * (k / 30)) : 0;
    const jitter = ((k * 7919) % 13) / 13 * 0.0004;
    pts[15] = { x: 0.3 + shake + jitter, y: 0.5, visibility: 1 }; pts[16] = { x: 0.7, y: 0.5 + jitter, visibility: 1 };
    return pts;
  };
  return {
    PoseLandmarker: { POSE_CONNECTIONS: [], createFromOptions: async () => ({ detectForVideo: () => ({ landmarks: [makePts(fake.frame++)] }), close() {} }) },
    FaceLandmarker: { FACE_LANDMARKS_FACE_OVAL: [], FACE_LANDMARKS_LEFT_EYE: [], FACE_LANDMARKS_RIGHT_EYE: [], FACE_LANDMARKS_LIPS: [], createFromOptions: async () => ({ detectForVideo: () => ({ faceLandmarks: [], faceBlendshapes: [] }), close() {} }) },
    FilesetResolver: { forVisionTasks: async () => ({}) },
    DrawingUtils: class { drawConnectors() {} drawLandmarks() {} },
  };
});

import Motion from './Motion';

let vfc = null;
const ctx2d = { clearRect() {}, fillRect() {} };
async function pump(frames, t0 = 0) {
  for (let k = 0; k < frames; k++) {
    const cb = vfc; vfc = null;
    if (!cb) throw new Error('no frame callback scheduled at frame ' + k);
    await act(async () => { cb(1000 + (t0 + k) * 33, { mediaTime: (t0 + k + 1) / 30 }); });
  }
}

beforeEach(() => {
  fake.frame = 0; vfc = null; localStorage.clear(); localStorage.setItem('ticare-motion-consent-v1', '2026-01-01');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx2d);
  HTMLVideoElement.prototype.requestVideoFrameCallback = function (cb) { vfc = cb; return 1; };
  HTMLVideoElement.prototype.cancelVideoFrameCallback = function () { vfc = null; };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
  URL.createObjectURL = vi.fn(() => 'blob:fake'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); delete HTMLVideoElement.prototype.requestVideoFrameCallback; });

describe('Motion: video test mode + real alert', () => {
  it('rejects a non mp4/webm file with a clear message and does not start', async () => {
    render(<Motion active />);
    fireEvent.click(screen.getByRole('tab', { name: /Kiểm thử bằng video/ }));
    const input = document.querySelector('input[type=file]');
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'a.mov', { type: 'video/quicktime' })] } }); });
    expect(await screen.findByText(/Chỉ nhận video định dạng MP4 hoặc WebM/)).toBeInTheDocument();
  });

  it('shows the purpose of video mode and, on a 4 Hz wrist shake, raises a role=alert banner and lists the event', async () => {
    render(<Motion active />);
    fireEvent.click(screen.getByRole('tab', { name: /Kiểm thử bằng video/ }));
    expect(screen.getByText(/thử thuật toán/)).toBeInTheDocument();
    const input = document.querySelector('input[type=file]');
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'mau.webm', { type: 'video/webm' })] } }); });
    await waitFor(() => expect(vfc).toBeTruthy());
    await pump(240);                                     // 8 s calm: no alert
    expect(screen.queryByRole('alert')).toBeNull();
    await pump(60, 240);                                 // 2 s of shaking
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Cổ tay trái');
    expect(banner).toHaveTextContent('Kết quả quan sát, không phải chẩn đoán');
  });
});

describe('Motion: camera lifecycle (T4.1)', () => {
  function fakeStream() {
    const track = { stop: vi.fn(), onended: null };
    return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } };
  }
  const setMedia = gum => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: gum, enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {} } }); };

  it('stops every track when the page is left (active=false)', async () => {
    const { track, stream } = fakeStream();
    setMedia(vi.fn().mockResolvedValue(stream));
    const { rerender } = render(<Motion active />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Bật camera/ })); });
    await waitFor(() => expect(vfc).toBeTruthy());
    expect(track.stop).not.toHaveBeenCalled();
    rerender(<Motion active={false} />);
    expect(track.stop).toHaveBeenCalled();
    expect(vfc).toBeNull();
  });

  it('shows a reconnect button when the camera is unplugged', async () => {
    const { track, stream } = fakeStream();
    setMedia(vi.fn().mockResolvedValue(stream));
    render(<Motion active />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Bật camera/ })); });
    await waitFor(() => expect(vfc).toBeTruthy());
    await act(async () => { track.onended(); });
    expect(await screen.findByText(/Camera đã bị ngắt kết nối \(rút cáp USB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kết nối lại/ })).toBeInTheDocument();
  });

  it('maps getUserMedia errors to specific guidance', async () => {
    setMedia(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotReadableError' })));
    render(<Motion active />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Bật camera/ })); });
    expect(await screen.findByText(/đang được ứng dụng khác sử dụng/)).toBeInTheDocument();
  });

  it('falls back to the default camera when the remembered device is gone, and forgets it', async () => {
    localStorage.setItem('ticare.motion.camera', 'gone-device');
    const { stream } = fakeStream();
    const gum = vi.fn().mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'OverconstrainedError' })).mockResolvedValueOnce(stream);
    setMedia(gum);
    render(<Motion active />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Bật camera/ })); });
    expect(await screen.findByText(/Đang dùng camera mặc định/)).toBeInTheDocument();
    expect(gum.mock.calls[0][0].video.deviceId).toEqual({ exact: 'gone-device' });
    expect(localStorage.getItem('ticare.motion.camera')).toBeNull();
  });
});

describe('Motion: consent gate (T6.4)', () => {
  const setMedia = gum => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: gum, enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {} } }); };

  it('does not call getUserMedia before consent; after confirming all 3 items it proceeds and remembers', async () => {
    localStorage.clear();
    const gum = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotReadableError' }));
    setMedia(gum);
    render(<Motion active />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Bật camera/ })); });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(gum).not.toHaveBeenCalled();
    const go = screen.getByRole('button', { name: /Đồng ý và tiếp tục/ });
    expect(go).toBeDisabled();
    screen.getAllByRole('checkbox').forEach(c => fireEvent.click(c));
    expect(go).toBeEnabled();
    await act(async () => { fireEvent.click(go); });
    await waitFor(() => expect(gum).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('ticare-motion-consent-v1')).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling the gate never starts the camera', async () => {
    localStorage.clear();
    const gum = vi.fn();
    setMedia(gum);
    render(<Motion active />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Bật camera/ })); });
    fireEvent.click(await screen.findByRole('button', { name: /Để sau/ }));
    expect(gum).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
