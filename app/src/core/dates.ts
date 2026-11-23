/* Даты: номера дней без часовых поясов, недели программы.
   Перенесено из reference/src/core.js: тела функций без изменений. */

/* ---------- dates (day numbers, timezone-free) ---------- */
export const dnum = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
export const dstr = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
export const dow = (s: string) => new Date(dnum(s) * 864e5).getUTCDay();
export const addDays = (s: string, k: number) => dstr(dnum(s) + k);
export const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MON3 = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const DOW2 = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const fmtDate = (s: string, long?: boolean) => { const [, m, d] = s.split('-').map(Number); return d + ' ' + (long ? MONTHS : MON3)[m - 1]; };
export const fmtDay = (s: string) => DOW2[dow(s)] + ', ' + fmtDate(s, true);
export const fmtDM = (s: string) => s.slice(8, 10) + '.' + s.slice(5, 7);
export const mondayOf = (s: string) => addDays(s, -((dow(s) + 6) % 7));
export const weekNo = (date: string, start: string) => Math.floor((dnum(date) - dnum(start)) / 7) + 1;
export const weekRange = (no: number, start: string) => { const a = addDays(start, (no - 1) * 7); return [a, addDays(a, 6)]; };
