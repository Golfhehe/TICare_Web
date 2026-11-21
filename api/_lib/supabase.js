// Server-side Supabase helpers for Vercel functions. Uses the CALLER's JWT only (never a service-role key),
// so RLS and the SECURITY DEFINER quota function decide what is allowed.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function config() {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new HttpError(503, 'Chưa cấu hình Supabase trên máy chủ (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).');
  return { url, key };
}

/** Bearer token -> { user, token }. Throws HttpError(401) when missing/invalid, 503 when Supabase is unreachable. */
export async function getUser(req) {
  const token = String(req.headers?.authorization || '').match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Vui lòng đăng nhập để sử dụng tính năng này.');
  const { url, key } = config();
  let res;
  try {
    res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, 'Không thể xác minh đăng nhập qua Supabase lúc này.');
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.');
  if (!res.ok) throw new HttpError(503, 'Không thể xác minh đăng nhập qua Supabase lúc này.');
  const user = await res.json().catch(() => null);
  if (!user?.id) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
  return { user, token };
}

/** Atomically consume one unit of daily AI quota. Returns true if allowed, false if the limit is reached. */
export async function consumeQuota(token, kind, limit) {
  const { url, key } = config();
  let res;
  try {
    res = await fetch(`${url}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_kind: kind, p_limit: limit }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, 'Không thể kiểm tra hạn mức sử dụng lúc này.');
  }
  if (!res.ok) throw new HttpError(503, 'Không thể kiểm tra hạn mức sử dụng lúc này.');
  return (await res.json().catch(() => false)) === true;
}

/** Best-effort count already used today (RLS: own rows only). Returns null if unavailable. */
export async function usedToday(token, kind) {
  try {
    const { url, key } = config();
    const day = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${url}/rest/v1/ai_usage?select=count&kind=eq.${encodeURIComponent(kind)}&day=eq.${day}`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Number(rows?.[0]?.count ?? 0);
  } catch { return null; }
}
