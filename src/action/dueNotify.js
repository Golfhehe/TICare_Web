import { todayLocal } from './planModel.js';

const key = (userId) => `ticare-action-notified-${userId || 'anon'}`;

export const notificationsSupported = () => typeof Notification !== 'undefined';
export const notificationsGranted = () => notificationsSupported() && Notification.permission === 'granted';

/** Ask permission; only call from a click handler. */
export async function requestNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

/** Send at most one browser notification per local day. Returns true if sent. */
export function notifyDueOncePerDay(userId, summary, today = todayLocal()) {
  const o = summary?.overdue?.length || 0;
  const s = summary?.dueSoon?.length || 0;
  if (!(o + s) || !notificationsGranted()) return false;
  try {
    if (localStorage.getItem(key(userId)) === today) return false;
    localStorage.setItem(key(userId), today);
  } catch { return false; }
  try {
    const body = `${o ? `${o} mục quá hạn` : ''}${o && s ? ', ' : ''}${s ? `${s} mục sắp đến hạn` : ''}.`;
    new Notification('TICare Action · Nhắc thời hạn', { body, tag: 'ticare-action-due' });
    return true;
  } catch { return false; }
}
