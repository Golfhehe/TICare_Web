import { describe, it, expect, vi, afterEach } from 'vitest';
import { uid } from './uid.js';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('uid', () => {
  it('returns a UUID v4', () => {
    expect(uid()).toMatch(V4);
  });
  it('falls back when crypto.randomUUID is undefined', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 255; return a; } });
    const id = uid();
    expect(id).toMatch(V4);
  });
  it('fallback values are unique with real getRandomValues', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });
});
