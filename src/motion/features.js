// Turns MediaPipe landmarks into per-frame displacement channels for the detector.
// All distances are normalized by shoulder width, and the shoulder-midpoint motion is subtracted so that moving the
// whole body (or leaning toward the camera) does not look like a head/hand movement.
export const VISIBILITY_MIN = 0.5;
const MIN_SHOULDER = 0.04; // in frame-height units; below this the person is too small/far to measure
const MAX_GAP_S = 0.3;      // longer than this since the previous frame = stalled, skip the displacement

const NOSE = 0, L_SHOULDER = 11, R_SHOULDER = 12, L_WRIST = 15, R_WRIST = 16;

/** Landmark snapshot in frame-height units (x scaled by aspect so that distances are isotropic). */
export function poseSnapshot(pts, aspect = 1, t = 0) {
  const vis = i => pts?.[i] && (pts[i].visibility === undefined || pts[i].visibility >= VISIBILITY_MIN);
  if (!vis(L_SHOULDER) || !vis(R_SHOULDER)) return null;
  const P = i => (vis(i) ? { x: pts[i].x * aspect, y: pts[i].y } : null);
  const a = P(L_SHOULDER), b = P(R_SHOULDER);
  const width = Math.hypot(a.x - b.x, a.y - b.y);
  if (width < MIN_SHOULDER) return null;
  return { t, width, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, nose: P(NOSE), left: P(L_WRIST), right: P(R_WRIST) };
}

/** Displacement features between two snapshots. Returns { channels, trunk } or null when not comparable. */
export function poseDisplacement(prev, cur) {
  if (!prev || !cur) return null;
  const gap = cur.t - prev.t;
  if (!(gap > 0) || gap > MAX_GAP_S) return null;
  const scale = (prev.width + cur.width) / 2;
  const mdx = cur.mid.x - prev.mid.x, mdy = cur.mid.y - prev.mid.y;
  const rel = key => {
    if (!prev[key] || !cur[key]) return undefined;
    return Math.hypot(cur[key].x - prev[key].x - mdx, cur[key].y - prev[key].y - mdy) / scale;
  };
  const channels = {};
  for (const [ch, key] of [['head', 'nose'], ['left', 'left'], ['right', 'right']]) {
    const v = rel(key);
    if (v !== undefined) channels[ch] = v;
  }
  return { channels, trunk: Math.hypot(mdx, mdy) / scale };
}

/** Blendshape levels from a FaceLandmarker result (same definitions as the previous Motion version). */
export function faceLevels(face) {
  const shapes = face?.faceBlendshapes?.[0]?.categories;
  if (!shapes?.length) return null;
  const get = n => shapes.find(c => c.categoryName === n)?.score || 0;
  return {
    blink: Math.max(get('eyeBlinkLeft'), get('eyeBlinkRight')),
    face: Math.max(get('jawOpen'), get('browDownLeft'), get('browDownRight'), get('mouthFrownLeft'), get('mouthFrownRight')),
  };
}

/** Per-frame change of the face levels (absolute). */
export function faceDisplacement(prev, cur) {
  if (!prev || !cur) return {};
  return { blink: Math.abs(cur.blink - prev.blink), face: Math.abs(cur.face - prev.face) };
}
