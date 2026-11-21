// Must match the installed @mediapipe/tasks-vision version (package-lock.json); see constants.test.js.
export const MEDIAPIPE_VERSION = '0.10.35';
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
export const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const DISCLAIMER = 'Kết quả quan sát, không phải chẩn đoán';

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const SENSITIVITY_MIN = 20;
export const SENSITIVITY_MAX = 100;
export const SENSITIVITY_DEFAULT = 50;
export const MAX_EVENTS = 2000;
export const MAX_SERIES_ROWS = 3000;
export const MAX_SESSION_SECONDS = 14400;

// Technical signal channels, NOT a tic classifier.
export const MOTION_CHANNELS = [
  { id: 'head', label: 'Đầu / cổ', color: '#0d9488' },
  { id: 'left', label: 'Cổ tay trái', color: '#f59e0b' },
  { id: 'right', label: 'Cổ tay phải', color: '#ec4899' },
  { id: 'blink', label: 'Chớp mắt', color: '#0891b2' },
  { id: 'face', label: 'Cơ mặt / hàm', color: '#a855f7' },
];
export const channelLabel = id => MOTION_CHANNELS.find(c => c.id === id)?.label || id;
