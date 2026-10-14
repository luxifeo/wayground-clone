// Who is "the same student" without accounts: same name (case / spacing insensitive) or same device.

const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Random id the browser keeps in localStorage; anything else is ignored. */
export const cleanDeviceId = (v) => (typeof v === 'string' && DEVICE_RE.test(v) ? v : null);

/** Display name as stored: NFC, trimmed, single spaces. */
export const cleanName = (n) => String(n || '').normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, 40);

/** Names that count as the same student ("Lan  Anh" = "lan anh"). Diacritics still matter (Lê ≠ Lệ). */
export const nameKey = (n) => cleanName(n).toLowerCase();

/** Looser key used only to flag look-alike names ("Le Huy Bach" ~ "lehuybach" ~ "Lê Huy Bách"). */
export const looseNameKey = (n) => nameKey(n).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/[^\p{L}\p{N}]/gu, '');

/** Device matching can be turned off for shared computers. */
export const deviceLockOn = (settings) => settings?.deviceLock !== false;

/** True when the participant row belongs to the student identified by name / device. */
export function sameStudent(row, { name, deviceId }, settings) {
  return nameKey(row.name) === nameKey(name) || (!!deviceId && deviceLockOn(settings) && row.device_id === deviceId);
}

/**
 * Flags for the report: other participants on the same device under another name,
 * and look-alike names that are not treated as the same student.
 */
export function suspectFlags(rows) {
  const flags = new Map();
  for (const p of rows) {
    const sameDevice = p.device_id ? rows.filter((o) => o.id !== p.id && o.device_id === p.device_id && nameKey(o.name) !== nameKey(p.name)) : [];
    const similarName = rows.filter((o) => o.id !== p.id && nameKey(o.name) !== nameKey(p.name) && looseNameKey(o.name) && looseNameKey(o.name) === looseNameKey(p.name));
    if (sameDevice.length || similarName.length) {
      const names = (list) => [...new Map(list.map((o) => [nameKey(o.name), o.name])).values()];
      flags.set(p.id, { sameDevice: names(sameDevice), similarName: names(similarName) });
    }
  }
  return flags;
}
