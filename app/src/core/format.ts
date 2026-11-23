/* Числа и русские окончания для текстов.
   Перенесено из reference/src/core.js: тела функций без изменений. */

/* ---------- formatting ---------- */
export const fmt = (v: number | null | undefined, dp = 2) => { if (v == null || isNaN(v)) return '–'; const s = (+v).toFixed(dp); return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s; };
export const pct = (a: number, b: number) => b ? (a / b - 1) * 100 : 0;
export const signed = (v: number, dp = 0) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), dp);
export const plural = (n: number, f: string[]) => { const a = Math.abs(n) % 100, b = a % 10; return f[(a > 10 && a < 20) ? 2 : b === 1 ? 0 : (b >= 2 && b <= 4) ? 1 : 2]; };
export const nSets = (v: number) => { const n = +(+v).toFixed(1); return fmt(n, 1) + ' ' + (Number.isInteger(n) ? plural(n, ['подход', 'подхода', 'подходов']) : 'подхода'); };
export const list = (a: (string | number)[]) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1];
