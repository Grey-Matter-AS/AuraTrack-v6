// Local calendar dates. Never use toISOString() for a calendar day: it gives the UTC date, which is
// yesterday or tomorrow near midnight. Never use new Date('YYYY-MM-DD'): it is read as UTC midnight.
const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' of the local calendar day
export function localDateKey(value = Date.now()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 'YYYY-MM' of the local calendar month
export function localMonthKey(value = Date.now()) {
  return localDateKey(value).slice(0, 7);
}

// 'YYYY-MM-DD' → Date at local midnight (invalid input gives an invalid Date)
export function parseLocalDate(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(NaN);
}

export function startOfLocalDay(value = Date.now()) {
  const d = new Date(value instanceof Date ? value.getTime() : value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDay(value = Date.now()) {
  const d = new Date(value instanceof Date ? value.getTime() : value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// Local date offset by whole days (calendar-safe across daylight-saving changes)
export function addLocalDays(value, days) {
  const d = new Date(value instanceof Date ? value.getTime() : value);
  d.setDate(d.getDate() + days);
  return d;
}

// Value for a datetime-local field: local wall-clock time, 'YYYY-MM-DDTHH:MM'
export function localDateTimeInputValue(value = Date.now()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date part of file names: the local date
export function dateStamp(value = Date.now()) {
  return localDateKey(value);
}
