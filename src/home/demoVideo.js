const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Validate the demo video URL (VITE_DEMO_VIDEO_URL). Only https is accepted.
 * Returns {kind:'file', src} for .mp4/.webm, {kind:'youtube', src} (nocookie embed) or null.
 */
export function parseDemoVideo(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.has(host)) {
    const parts = u.pathname.split('/').filter(Boolean);
    let id = null;
    if (host === 'youtu.be') id = parts[0];
    else if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') id = parts[1];
    return id && YT_ID.test(id) ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: 'file', src: u.href };
  return null;
}
