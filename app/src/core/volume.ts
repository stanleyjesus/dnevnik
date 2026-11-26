/* Недельный объём по мышцам и зоны.
   Перенесено из reference/src/core.js: тела функций без изменений, кроме подписи splitText с днями «День N» (решение владельца, 26 ноября 2026). */
import { MUSCLES, PATTERNS } from './catalog.ts';
import { weekNo } from './dates.ts';
import { fmt } from './format.ts';
import { appRules } from './rules.ts';
import { setVol, work } from './sets.ts';
import type { Cfg, Volume, WeekInfo, Workout, Zones } from './types.ts';

/* ---------- weekly volume per muscle: direct set = 1, indirect = its coefficient (0.5) ---------- */
export function volume(workouts: Workout[], cfg: Cfg) {
  const out: Volume = {};
  for (const w of workouts) {
    const k = weekNo(w.date, cfg.start!);
    /* s: the part of m that comes from the lifts done by percentages — strength work */
    const o = out[k] || (out[k] = { m: {}, s: {}, detail: {}, pat: {}, sets: 0, n: 0, unknown: [] });
    let any = false;
    for (const it of w.items) {
      const ws = work(it), n = ws.length;
      if (!n) continue;
      any = true;
      const ex = cfg.ex[it.ex], f = ex && ex.uni ? 0.5 : 1, eff = ws.reduce((a, s) => a + setVol(s, it), 0);
      o.sets += n * f;
      if (!ex || !ex.m || !Object.keys(ex.m).length) { if (!o.unknown.includes(it.ex)) o.unknown.push(it.ex); continue; }
      if (ex.pat) o.pat[ex.pat] = (o.pat[ex.pat] || 0) + n * f;
      for (const [m, c] of Object.entries(ex.m)) {
        if (!c) continue;
        o.m[m] = (o.m[m] || 0) + eff * c * f;
        if (it.cyc) o.s[m] = (o.s[m] || 0) + eff * c * f;
        const d = o.detail[m] || (o.detail[m] = {});
        const e = d[it.ex] || (d[it.ex] = { ex: it.ex, n: 0, eff: 0, c, v: 0 });
        e.n += n * f; e.eff += eff * f; e.v += eff * c * f;
      }
    }
    if (any) o.n++;
  }
  return out;
}
export const zone = (v: number, z: Zones) => v <= 0 ? 'none' : v < z.min ? 'low' : v < z.opt ? 'base' : v <= z.high ? 'opt' : 'high';
export const ZONE: Record<string, { n: string; sev: string }> = {
  none: { n: 'нет нагрузки', sev: 'crit' }, low: { n: 'мало', sev: 'serious' }, base: { n: 'ниже рабочей зоны', sev: 'warn' },
  opt: { n: 'рабочая зона', sev: 'good' }, high: { n: 'выше зоны', sev: 'over' }
};
export function avgVolume(vol: Volume, ref: WeekInfo[]) {
  const avg: Record<string, number> = {}, avgS: Record<string, number> = {};
  for (const m of MUSCLES) {
    avg[m.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].m[m.id]) || 0), 0) / ref.length : 0;
    avgS[m.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].s && vol[w.no].s[m.id]) || 0), 0) / ref.length : 0;
  }
  const pat: Record<string, number> = {};
  for (const p of PATTERNS) pat[p.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].pat[p.id]) || 0), 0) / ref.length : 0;
  return { avg, avgS, pat };
}
/* how a total splits into work for mass and strength work, rounded so that the two add up to the shown total */
/* (в эталоне нет) с днями «День N» рядом с общим числом — только подходы силы: «11.5 (сила 5.5)» (решение владельца, 26 ноября 2026):
   «масса» читалась как «только эти подходы растят мышцу», а растят все подходы с малым запасом (docs/03, раздел 3) */
export const splitText = (total: number, strong: number) => { const r1 = (x: number) => Math.round(x * 10) / 10; return strong >= 0.05 ? (appRules() ? 'сила ' + fmt(r1(strong), 1) : 'масса ' + fmt(Math.max(0, r1(r1(total) - r1(strong))), 1) + ' · сила ' + fmt(r1(strong), 1)) : ''; };
