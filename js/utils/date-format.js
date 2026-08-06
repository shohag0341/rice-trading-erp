// Shared date formatting helpers. The whole app displays dates as DD-MM-YY
// (e.g. 06-08-26) instead of the browser-default DD/MM/YYYY.
//
// Usage:
//   import { formatDate, formatDateTime } from './utils/date-format.js';
//   formatDate('2026-08-06')       -> '06-08-26'
//   formatDateTime(someTimestamp)  -> '06-08-26, 02:15 PM'

/**
 * Formats a date-only value (e.g. a Postgres `date` column like '2026-08-06',
 * or a full timestamp) as 'DD-MM-YY'.
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatDate(dateInput) {
    if (!dateInput) return '-';

    // Plain 'YYYY-MM-DD' strings are parsed directly (no Date object / no
    // timezone conversion involved) so the displayed day never shifts.
    const isoMatch = String(dateInput).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, yyyy, mm, dd] = isoMatch;
        return `${dd}-${mm}-${yyyy.slice(-2)}`;
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
}

/**
 * Formats a full timestamp (e.g. created_at) as 'DD-MM-YY, hh:mm AM/PM'.
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatDateTime(dateInput) {
    if (!dateInput) return '-';

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${formatDate(dateInput)}, ${time}`;
}

