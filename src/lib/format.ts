export function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/** A price without paise when it's a whole amount, e.g. ₹1,500 rather than ₹1,500.00. */
export function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatWeekday(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

/** "Today", "Tomorrow", or a short weekday and date. */
export function formatRelativeDay(iso: string, now: Date = new Date()) {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
