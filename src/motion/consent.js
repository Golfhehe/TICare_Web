export const CONSENT_KEY = 'ticare-motion-consent-v1';

/** True when this device already confirmed the Motion consent. Storage errors => ask every time. */
export function hasMotionConsent() {
  try { return !!localStorage.getItem(CONSENT_KEY); } catch { return false; }
}

export function saveMotionConsent(date = new Date()) {
  try { localStorage.setItem(CONSENT_KEY, date.toISOString().slice(0, 10)); return true; } catch { return false; }
}
