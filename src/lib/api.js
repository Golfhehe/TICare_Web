import { supabase } from '../supabase';

async function sessionToken() {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch { return null; }
}

/** POST JSON to our API. Never throws: returns { ok, status, data, error } with a Vietnamese error message. */
export async function callApi(path, body, { timeoutMs = 30000 } = {}) {
  try {
    const token = await sessionToken();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, status: res.status, data, error: null };
    return { ok: false, status: res.status, data, error: data?.error || `Máy chủ trả về lỗi (HTTP ${res.status}).` };
  } catch (e) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return { ok: false, status: 0, data: null, error: timeout ? 'Máy chủ phản hồi quá lâu. Hãy thử lại sau.' : 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.' };
  }
}
