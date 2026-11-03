
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const live = Boolean(url && key);

export const supabase = live
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "ticare-auth"
      }
    })
  : null;

if (!live) {
  console.error(
    "TICare: Thiếu cấu hình Supabase trên Vercel."
  );
}
