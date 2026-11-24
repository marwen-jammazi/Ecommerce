import AppError from './AppError.js';

const DAY = 24 * 60 * 60 * 1000;

// must look like +01:00 (Tunisia). Used for day/week/month boundaries.
export const tzOffset = () => process.env.DASHBOARD_TZ_OFFSET || '+01:00';

function offsetMs() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(tzOffset());
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3])) * 60000;
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const s = String(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? `${s}T00:00:00${tzOffset()}` : s);
  if (Number.isNaN(d.getTime())) throw new AppError(`Invalid date: ${s}`, 400);
  // a date-only "to" includes that whole day
  return dateOnly && endOfDay ? new Date(d.getTime() + DAY) : d;
}

// returns [from, to) plus the previous period of the same length
export function parseRange(query) {
  const to = parseDate(query.to, true) || new Date();
  const from = parseDate(query.from) || new Date(to.getTime() - 30 * DAY);
  if (from >= to) throw new AppError('"from" must be before "to"', 400);
  if (to - from > 366 * DAY) throw new AppError('Range too large (max 366 days)', 400);
  const length = to - from;
  return { from, to, prevFrom: new Date(from.getTime() - length), prevTo: from };
}

const localDay = () => new Date(Date.now() + offsetMs()).toISOString().slice(0, 10);

export function startOfToday() {
  return new Date(`${localDay()}T00:00:00${tzOffset()}`);
}

export function startOfWeek() {
  const dow = new Date(Date.now() + offsetMs()).getUTCDay(); // 0 = Sunday
  return new Date(startOfToday().getTime() - ((dow + 6) % 7) * DAY); // Monday
}

export function startOfMonth() {
  return new Date(`${localDay().slice(0, 7)}-01T00:00:00${tzOffset()}`);
}