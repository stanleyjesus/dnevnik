/* Неделя по шаблонам дней: подходы по мышцам и лимиты атлета.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { MUSCLES, SLOTS } from './catalog.ts';
import { nSets } from './format.ts';
import { isCycle, isLight } from './config.ts';
import { cycleVol, lightOf, progPending, waveSetsAvg } from './goals.ts';
import { dayStale } from './days.ts';
import type { Cfg, Week, Workout } from './types.ts';

/* where a week of day templates breaks the athlete's limits */
export function ruleBreaks(cfg: Cfg, T: Tally) {
  const out: string[] = [], total = SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0), caps = cfg.caps;
  if (total > caps.week + 0.01) out.push('В неделю ' + nSets(+total.toFixed(1)) + ' при лимите ' + caps.week);
  for (const sl of SLOTS) for (const m of MUSCLES) { const v = (T.day[sl.id] || {} as Record<string, number>)[m.id] || 0; if (v > caps.day + 0.01) out.push(sl.n + ': ' + m.n.toLowerCase() + ' — ' + nSets(+v.toFixed(1)) + ' при лимите ' + caps.day + ' за тренировку'); }
  return out;
}
/* weekly sets per muscle, movement type and day for a set of day templates {slot: {items}} */
export function tally(cfg: Cfg, t: Week) {
  /* ps: the part of pv that comes from the lifts done by percentages — strength work; the rest of pv is work for mass */
  const pv: Record<string, number> = {}, ps: Record<string, number> = {}, pp: Record<string, number> = {}, prim: Record<string, boolean> = {}, load: Record<string, number> = {}, day: Record<string, Record<string, number>> = {};
  for (const sl of SLOTS) {
    load[sl.id] = 0; day[sl.id] = {};
    const w = t[sl.id];
    if (!w) continue;
    for (const it of w.items) {
      const ex = cfg.ex[it.ex], wave = isCycle(cfg, it.ex), light = isLight(cfg, it.ex);
      const n = light ? lightOf(cfg, it.ex).sets : wave ? waveSetsAvg(cfg, it.ex) : it.sets ? it.sets.filter(x => !x.warm).length : (+it.n! || 0);
      const heavy = !!(wave || light || it.cyc), f = ex && ex.uni ? 0.5 : 1, k = heavy ? cycleVol(cfg, it.ex) : 1;
      load[sl.id] += n * f;
      if (!ex) continue;
      if (ex.pat) pp[ex.pat] = (pp[ex.pat] || 0) + n * f;
      for (const [m, c] of Object.entries(ex.m || {})) { pv[m] = (pv[m] || 0) + n * c * f * k; if (heavy) ps[m] = (ps[m] || 0) + n * c * f * k; day[sl.id][m] = (day[sl.id][m] || 0) + n * c * f * k; if (c >= 1) prim[m] = true; }
    }
  }
  return { t, pv, ps, pp, prim, load, day };
}
/* the programme as it stands: the latest finished workout of each day, or the accepted programme where it has not been trained yet */
export function planned(workouts: Workout[], cfg: Cfg) {
  const t: Week = {};
  for (const w of workouts) if (!w.open && w.slot && w.items.length && !dayStale(cfg, w.slot, w)) t[w.slot] = w;   // дни «День N»: запись дня, которого нет в принятой программе, сделанная до неё, шаблоном не служит
  for (const sl of SLOTS) if (progPending(cfg, sl.id, t[sl.id] as Workout)) t[sl.id] = { prog: true, items: cfg.program!.slots[sl.id].filter(e => cfg.ex[e.ex]).map(e => ({ ex: e.ex, n: e.n || 0 })) };
  return tally(cfg, t);
}

export type Tally = ReturnType<typeof tally>;
