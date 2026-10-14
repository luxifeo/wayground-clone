// Random id for this browser, so the server can count a student's attempts even when they change name.
// It identifies nothing about the device itself. Kept in localStorage and a cookie (either may be cleared).

const KEY = 'wg_device';

const readCookie = () => document.cookie.split('; ').find((c) => c.startsWith(`${KEY}=`))?.slice(KEY.length + 1) || null;

// getRandomValues also works on plain http (LAN IPs), unlike crypto.randomUUID
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

export function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  id = id || readCookie() || newId();
  try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
  document.cookie = `${KEY}=${id}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  return id;
}
