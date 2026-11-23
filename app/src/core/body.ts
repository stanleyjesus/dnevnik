/* Вес тела.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { dnum } from './dates.ts';
import type { BodyRec } from './types.ts';

/* ---------- body weight ---------- */
export function bodyRate(body: BodyRec[]) {
  if (body.length < 3) return null;
  const last = body[body.length - 1], pts = body.filter(b => dnum(last.date) - dnum(b.date) <= 35);
  if (pts.length < 3 || dnum(pts[pts.length - 1].date) - dnum(pts[0].date) < 10) return null;
  const xs = pts.map(p => dnum(p.date)), ys = pts.map(p => p.kg), n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
  const perWeek = sxx ? sxy / sxx * 7 : 0;
  return { perWeek, pctWeek: perWeek / last.kg * 100, n, days: xs[n - 1] - xs[0] };
}
