// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from './education-generate.js';

const VALID = { topic: 'Tôn trọng sự khác biệt', grade: 'lop_2', duration: 25, slideCount: 6, objective: 'Không trêu chọc' };

function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.body = o; return res; };
  return res;
}
const req = (body, { method = 'POST', auth = 'Bearer tok' } = {}) =>
  ({ method, body, headers: auth ? { authorization: auth } : {} });
const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const geminiOk = n => jsonRes({ candidates: [{ content: { parts: [{ text: JSON.stringify({
  title: 'T', objective: 'O',
  slides: Array.from({ length: n }, (_, i) => ({ title: `S${i}`, body: 'b'.repeat(900), prompt: 'p', emoji: '🌱' })),
}) }] } }] });

let calls;
function mockFetch({ auth = () => jsonRes({ id: 'u1' }), rpc = () => jsonRes(true), gemini = () => geminiOk(6), usage = () => jsonRes([{ count: 3 }]) } = {}) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('/auth/v1/user')) return auth();
    if (u.includes('/rpc/consume_ai_quota')) return rpc();
    if (u.includes('/rest/v1/ai_usage')) return usage();
    if (u.includes('generativelanguage.googleapis.com')) return gemini();
    throw new Error('unexpected fetch ' + u);
  }));
}

describe('api/education-generate', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:55321';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon';
    process.env.GEMINI_API_KEY = 'gk';
    delete process.env.GEMINI_MODEL;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('405 for non-POST', async () => {
    mockFetch();
    const res = makeRes(); await handler(req(VALID, { method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it.each([
    ['short topic', { ...VALID, topic: 'abc' }],
    ['bad grade', { ...VALID, grade: 'lop_9' }],
    ['bad duration', { ...VALID, duration: 20 }],
    ['bad slideCount', { ...VALID, slideCount: 7 }],
    ['long objective', { ...VALID, objective: 'x'.repeat(501) }],
    ['no body', undefined],
  ])('400 on invalid input (%s) before any network call', async (_n, body) => {
    mockFetch();
    const res = makeRes(); await handler(req(body), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('401 without bearer token', async () => {
    mockFetch();
    const res = makeRes(); await handler(req(VALID, { auth: null }), res);
    expect(res.statusCode).toBe(401);
  });

  it('401 when Supabase rejects the token', async () => {
    mockFetch({ auth: () => jsonRes({ msg: 'bad' }, 401) });
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(401);
  });

  it('503 when GEMINI_API_KEY is missing, without consuming quota', async () => {
    delete process.env.GEMINI_API_KEY;
    mockFetch();
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(503);
    expect(calls.some(c => c.url.includes('/rpc/'))).toBe(false);
  });

  it('429 when quota is exhausted, Gemini not called', async () => {
    mockFetch({ rpc: () => jsonRes(false) });
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(429);
    expect(calls.some(c => c.url.includes('generativelanguage'))).toBe(false);
  });

  it('200 on success: normalized lesson, hard-coded quota limit, key in header', async () => {
    mockFetch();
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lesson.slides).toHaveLength(6);
    expect(res.body.lesson.slides[0].body.length).toBe(550);
    expect(res.body.remaining).toBe(17);
    const rpc = calls.find(c => c.url.includes('/rpc/consume_ai_quota'));
    expect(JSON.parse(rpc.init.body)).toEqual({ p_kind: 'studio', p_limit: 20 });
    const g = calls.find(c => c.url.includes('generativelanguage'));
    expect(g.url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(g.init.headers['x-goog-api-key']).toBe('gk');
    const sent = JSON.parse(g.init.body);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.generationConfig.responseSchema.properties.slides).toBeTruthy();
  });

  it('502 with Vietnamese message when Gemini fails', async () => {
    mockFetch({ gemini: () => jsonRes({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429) });
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/Gemini/);
  });

  it('502 when Gemini returns too few slides', async () => {
    mockFetch({ gemini: () => geminiOk(2) });
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(502);
  });

  it('500 on invalid GEMINI_MODEL', async () => {
    process.env.GEMINI_MODEL = 'a/b?x';
    mockFetch();
    const res = makeRes(); await handler(req(VALID), res);
    expect(res.statusCode).toBe(500);
  });
});
