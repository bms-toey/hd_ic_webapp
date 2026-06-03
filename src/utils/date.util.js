/** Returns today as YYYY-MM-DD string. */
export const todayStr = () => new Date().toISOString().slice(0, 10);

/** Converts YYYY-MM-DD to DD/MM/BBBB (Thai Buddhist year). */
export function thDate(d) {
  if (!d || d === '-') return '-';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${parseInt(y) + 543}`;
}

/** Days difference between two YYYY-MM-DD strings (b - a). */
export const diffDays = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86_400_000);

/** Extract YYYY-MM from a date string. */
export const monthOf = (d) => (d ? d.slice(0, 7) : '');
