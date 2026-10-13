const LANG_NAMES: Record<string, string> = {
  en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी', ta: 'தமிழ்', te: 'తెలుగు', ml: 'മലയാളം',
};
export const LANGUAGES = ['en', 'kn', 'hi', 'ta', 'te', 'ml'];
export const langName = (code?: string) => (code ? LANG_NAMES[code] || code : '—');

export const DAYS: { key: import('../api/types').Day; short: string; label: string }[] = [
  { key: 'MONDAY', short: 'M', label: 'Mon' },
  { key: 'TUESDAY', short: 'T', label: 'Tue' },
  { key: 'WEDNESDAY', short: 'W', label: 'Wed' },
  { key: 'THURSDAY', short: 'T', label: 'Thu' },
  { key: 'FRIDAY', short: 'F', label: 'Fri' },
  { key: 'SATURDAY', short: 'S', label: 'Sat' },
  { key: 'SUNDAY', short: 'S', label: 'Sun' },
];

/** Local date as yyyy-mm-dd (not UTC). */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Backend LocalDateTime strings have no zone; parse them as local time. */
export function parseLocal(s?: string): Date | null {
  if (!s) return null;
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}

export function fmtTime(s?: string): string {
  const d = parseLocal(s);
  if (!d) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ').toLowerCase();
}

/** "09:30:00" → "9:30 am" */
export function fmtClock(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

export function fmtDate(s?: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const d = parseLocal(s);
  return d ? d.toLocaleDateString('en-GB', opts) : '—';
}

export function relativeDay(s?: string): string {
  const d = parseLocal(s);
  if (!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Inbox-style timestamp: "4:08 pm" today, "Yesterday", or "12 Sep". */
export function fmtWhen(s?: string): string {
  const d = parseLocal(s);
  if (!d) return '';
  const rel = relativeDay(s);
  if (rel === 'Today') return fmtTime(s);
  if (rel === 'Yesterday') return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');

export function pct(n?: number, digits = 0): string {
  if (n === undefined || n === null) return '—';
  const s = n.toFixed(digits);
  return (n > 0 ? '+' : '') + s + '%';
}

export function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed', WAITING: 'Waiting', IN_CONSULT: 'With doctor', SEEN: 'Seen',
  NO_SHOW: 'No-show', CANCELLED: 'Cancelled',
};
export const BOOKED_BY_LABEL: Record<string, string> = { SILETRY: 'Siletry', FRONT_DESK: 'Front desk', WALK_IN: 'Walk-in' };

export function addDays(iso: string, n: number): string {
  const d = parseLocal(iso)!;
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
