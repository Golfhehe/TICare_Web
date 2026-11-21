import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getSession = vi.fn();
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: (...a) => getSession(...a) } } }));
import { callApi } from './api';

const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

describe('callApi', () => {
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } }); });
  afterEach(() => vi.unstubAllGlobals());

  it('sends JSON with bearer token and returns data', async () => {
    const f = vi.fn(async () => jsonRes({ answer: 'x' }));
    vi.stubGlobal('fetch', f);
    const r = await callApi('/api/ask', { question: 'q' });
    expect(r).toEqual({ ok: true, status: 200, data: { answer: 'x' }, error: null });
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ question: 'q' });
  });

  it('omits Authorization when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const f = vi.fn(async () => jsonRes({}));
    vi.stubGlobal('fetch', f);
    await callApi('/x', {});
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('maps HTTP errors to ok:false with server message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ error: 'Hết lượt' }, 429)));
    const r = await callApi('/x', {});
    expect(r).toMatchObject({ ok: false, status: 429, error: 'Hết lượt' });
  });

  it('non-JSON error body gives a generic message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 500 })));
    const r = await callApi('/x', {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/500/);
  });

  it('never throws on network failure or timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fail'); }));
    expect(await callApi('/x', {})).toMatchObject({ ok: false, status: 0 });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('t', 'TimeoutError'); }));
    const r = await callApi('/x', {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/quá lâu/);
  });

  it('survives getSession failure', async () => {
    getSession.mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({})));
    expect((await callApi('/x', {})).ok).toBe(true);
  });
});
