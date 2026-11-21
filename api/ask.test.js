// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, { clientIp } from './ask.js';

function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.body = o; return res; };
  return res;
}
const req = (body, { method = 'POST', auth = 'Bearer tok', headers = {} } = {}) =>
  ({ method, body, headers: { ...(auth ? { authorization: auth } : {}), ...headers } });
const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const geminiOk = () => jsonRes({ candidates: [{ content: { parts: [{ text: 'Xin chào, đây là câu trả lời.' }] } }] });
const Q = { question: 'Giáo viên nên làm gì khi học sinh có tic trong giờ học?' };

let calls;
function mockFetch({ auth = () => jsonRes({ id: 'u1' }), rpc = () => jsonRes(true), gemini = geminiOk, usage = () => jsonRes([{ count: 3 }]) } = {}) {
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

describe('api/ask', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:55321';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon';
    process.env.GEMINI_API_KEY = 'gk';
    delete process.env.GEMINI_MODEL;
    delete process.env.TAVILY_API_KEY;
    delete process.env.TICARE_DEMO_CODE;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('405 for non-POST', async () => {
    mockFetch();
    const res = makeRes(); await handler(req(Q, { method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it.each([
    ['too short', { question: 'ab' }],
    ['too long', { question: 'x'.repeat(1001) }],
    ['not a string', { question: 42 }],
    ['history too long', { ...Q, history: Array.from({ length: 9 }, () => ({ role: 'user', content: 'a' })) }],
    ['history item too long', { ...Q, history: [{ role: 'user', content: 'x'.repeat(1201) }] }],
    ['no body', undefined],
  ])('400 on invalid input (%s) before any network call', async (_n, body) => {
    mockFetch();
    const res = makeRes(); await handler(req(body), res);
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('401 without bearer token and without demo code', async () => {
    mockFetch();
    const res = makeRes(); await handler(req(Q, { auth: null }), res);
    expect(res.statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('401 with a wrong demo code', async () => {
    process.env.TICARE_DEMO_CODE = 'correct-demo-code-1234';
    mockFetch();
    const res = makeRes(); await handler(req(Q, { auth: null, headers: { 'x-ticare-demo-code': 'wrong' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('503 when GEMINI_API_KEY is missing, without consuming quota', async () => {
    delete process.env.GEMINI_API_KEY;
    mockFetch();
    const res = makeRes(); await handler(req(Q), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/mẫu/);
    expect(calls.some(c => c.url.includes('/rpc/consume_ai_quota'))).toBe(false);
  });

  it('429 when the daily quota is exhausted, without calling Gemini', async () => {
    mockFetch({ rpc: () => jsonRes(false) });
    const res = makeRes(); await handler(req(Q), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/lượt/);
    expect(calls.some(c => c.url.includes('generativelanguage'))).toBe(false);
  });

  it('200 on success with sources/remaining, key header and p_limit=50', async () => {
    mockFetch();
    const res = makeRes();
    await handler(req({ ...Q, history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.answer).toContain('câu trả lời');
    expect(res.body.sources).toEqual([]);
    expect(res.body.remaining).toBe(47);
    const rpc = calls.find(c => c.url.includes('/rpc/consume_ai_quota'));
    expect(JSON.parse(rpc.init.body)).toEqual({ p_kind: 'chat', p_limit: 50 });
    const g = calls.find(c => c.url.includes('generativelanguage'));
    expect(g.init.headers['x-goog-api-key']).toBe('gk');
    const body = JSON.parse(g.init.body);
    expect(body.contents).toHaveLength(3);
    expect(body.contents[1].role).toBe('model');
    expect(body.systemInstruction.parts[0].text).toMatch(/không chẩn đoán/i);
  });

  it('200 with remaining null when usage lookup fails (best effort)', async () => {
    mockFetch({ usage: () => jsonRes({}, 500) });
    const res = makeRes(); await handler(req(Q), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.remaining).toBeNull();
  });

  it.each([[429, /429/], [403, /403/]])('502 with a Vietnamese message on Gemini %i', async (status, re) => {
    mockFetch({ gemini: () => jsonRes({ error: { status: 'X' } }, status) });
    const res = makeRes(); await handler(req(Q), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(re);
    expect(res.body.error).toMatch(/Gemini/);
  });

  it('demo code path works without Supabase calls', async () => {
    process.env.TICARE_DEMO_CODE = 'correct-demo-code-1234';
    mockFetch();
    const res = makeRes();
    await handler(req(Q, { auth: null, headers: { 'x-ticare-demo-code': 'correct-demo-code-1234', 'x-vercel-forwarded-for': '9.9.9.9' } }), res);
    expect(res.statusCode).toBe(200);
    expect(calls.every(c => c.url.includes('generativelanguage'))).toBe(true);
  });

  it('demo code is rate limited per IP from x-vercel-forwarded-for, not the spoofable x-forwarded-for', async () => {
    process.env.TICARE_DEMO_CODE = 'correct-demo-code-1234';
    mockFetch();
    const send = async (xff) => {
      const res = makeRes();
      await handler(req(Q, { auth: null, headers: { 'x-ticare-demo-code': 'correct-demo-code-1234', 'x-vercel-forwarded-for': '8.8.8.8', 'x-forwarded-for': xff } }), res);
      return res.statusCode;
    };
    const codes = [];
    for (let i = 0; i < 9; i++) codes.push(await send('spoof-' + i));
    expect(codes.slice(0, 8).every(c => c === 200)).toBe(true);
    expect(codes[8]).toBe(429);
  });

  it('clientIp precedence', () => {
    expect(clientIp({ headers: { 'x-vercel-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' }, socket: { remoteAddress: '4.4.4.4' } })).toBe('1.1.1.1');
    expect(clientIp({ headers: { 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' }, socket: { remoteAddress: '4.4.4.4' } })).toBe('2.2.2.2');
    expect(clientIp({ headers: { 'x-forwarded-for': '3.3.3.3' }, socket: { remoteAddress: '4.4.4.4' } })).toBe('4.4.4.4');
  });
});
