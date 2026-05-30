// Centralised date formatter — DD/MM/YY across the app
// Accepts:
//   - YYYY-MM-DD (ISO date strings used in <input type="date">)
//   - ISO datetime strings (from new Date().toISOString())
//   - Date objects
// Returns "" for empty / invalid input so the UI never shows "Invalid Date".
export const formatDateDDMMYY = (input) => {
  if (!input) return '';
  let d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'string') {
    // Pure YYYY-MM-DD (no time) — parse as local date to avoid TZ shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [y, m, day] = input.split('-').map(n => parseInt(n, 10));
      d = new Date(y, m - 1, day);
    } else {
      d = new Date(input);
    }
  } else {
    return '';
  }
  if (!d || isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

// Inclusive range check on YYYY-MM-DD strings (used for invoice export filter).
// from / to may be empty — open-ended ranges supported.
export const isWithinRange = (dateStr, from, to) => {
  if (!dateStr) return !from && !to;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
};
