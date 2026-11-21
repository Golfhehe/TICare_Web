import { describe, it, expect } from 'vitest';
import { poseSnapshot, poseDisplacement, faceLevels, faceDisplacement } from './features';

// Builds 33 landmarks; only 0, 11, 12, 15, 16 matter. `scale` shrinks the whole person (distance from camera).
function pose({ dx = 0, dy = 0, scale = 1, lw = [-0.2, 0.2], rw = [0.2, 0.2], vis = {} } = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const put = (i, x, y) => { pts[i] = { x: 0.5 + dx + x * scale, y: 0.4 + dy + y * scale, visibility: vis[i] ?? 1 }; };
  put(11, -0.1, 0); put(12, 0.1, 0);
  put(0, 0, -0.15);
  put(15, lw[0], lw[1]); put(16, rw[0], rw[1]);
  return pts;
}
const snap = (pts, t) => poseSnapshot(pts, 1, t);

describe('poseSnapshot', () => {
  it('needs both shoulders visible (>= 0.5)', () => {
    expect(snap(pose({ vis: { 11: 0.3 } }), 0)).toBeNull();
    expect(snap(pose(), 0)).not.toBeNull();
  });
  it('drops a landmark with visibility < 0.5 but keeps the others', () => {
    const s = snap(pose({ vis: { 15: 0.2 } }), 0);
    expect(s.left).toBeNull();
    expect(s.right).not.toBeNull();
  });
  it('rejects a person that is too small', () => {
    expect(snap(pose({ scale: 0.1 }), 0)).toBeNull();
  });
});

describe('poseDisplacement', () => {
  it('whole-body translation gives ~0 on every channel but a non-zero trunk', () => {
    const d = poseDisplacement(snap(pose(), 0), snap(pose({ dx: 0.03, dy: -0.01 }), 1 / 30));
    for (const v of Object.values(d.channels)) expect(v).toBeCloseTo(0, 6);
    expect(d.trunk).toBeGreaterThan(0.1);
  });
  it('is invariant to distance from the camera (normalized by shoulder width)', () => {
    const near = poseDisplacement(snap(pose({ scale: 1 }), 0), snap(pose({ scale: 1, lw: [-0.2, 0.25] }), 1 / 30));
    const far = poseDisplacement(snap(pose({ scale: 0.5 }), 0), snap(pose({ scale: 0.5, lw: [-0.2, 0.25] }), 1 / 30));
    expect(near.channels.left).toBeGreaterThan(0);
    expect(far.channels.left).toBeCloseTo(near.channels.left, 5);
  });
  it('a wrist moving while the torso stays still shows up on that wrist only', () => {
    const d = poseDisplacement(snap(pose(), 0), snap(pose({ lw: [-0.2, 0.3] }), 1 / 30));
    expect(d.channels.left).toBeGreaterThan(0.2);
    expect(d.channels.right).toBeCloseTo(0, 6);
    expect(d.channels.head).toBeCloseTo(0, 6);
  });
  it('skips stalled frames and missing snapshots', () => {
    expect(poseDisplacement(snap(pose(), 0), snap(pose(), 1))).toBeNull();
    expect(poseDisplacement(null, snap(pose(), 0))).toBeNull();
  });
  it('omits a channel when its landmark is hidden in either frame', () => {
    const d = poseDisplacement(snap(pose(), 0), snap(pose({ vis: { 16: 0.1 } }), 1 / 30));
    expect('right' in d.channels).toBe(false);
    expect('left' in d.channels).toBe(true);
  });
});

describe('face levels', () => {
  const face = scores => ({ faceBlendshapes: [{ categories: Object.entries(scores).map(([categoryName, score]) => ({ categoryName, score })) }] });
  it('computes blink/face levels and their change', () => {
    const a = faceLevels(face({ eyeBlinkLeft: 0.1, eyeBlinkRight: 0.2, jawOpen: 0.05 }));
    const b = faceLevels(face({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.2, jawOpen: 0.05 }));
    expect(a.blink).toBe(0.2);
    expect(faceDisplacement(a, b).blink).toBeCloseTo(0.7);
    expect(faceDisplacement(a, b).face).toBeCloseTo(0);
    expect(faceLevels(null)).toBeNull();
    expect(faceDisplacement(null, b)).toEqual({});
  });
});
