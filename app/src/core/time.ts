/* Оценка времени тренировки.
   Перенесено из reference/src/core.js: тела функций без изменений, кроме подхода базового на двойной прогрессии (rules.ts, решение владельца 24 ноября 2026)
   и отдыха с днями «День N»: его дневник ставит упражнению сам (rules.ts, restOf; просьба владельца, 25 ноября 2026), а оценка идёт по темпу атлета (pace.ts). */
import { isCycle, isLight } from './config.ts';
import { appRules, byPct, freshFor, PACE, restOf, WARM, warmSets } from './rules.ts';
import { lightOf, waveSetsAvg } from './goals.ts';
import type { Cfg, ExDef, TplItem } from './types.ts';

/* minutes a workout takes: a warm-up, a minute to set up each exercise (three more to warm up a percentage lift), every set and the rest after it.
   (в эталоне нет) с днями «День N» вместо трёх минут у базового — разминочные подходы по типу упражнения (rules.ts, WARM) */
export const REST_OPTS = [60, 90, 120, 150, 180];
/* own — (в эталоне нет) оценка по формуле, без поправки на темп атлета: от неё темп и считается (pace.ts) */
export function estMinutes(cfg: Cfg, items: TplItem[], rest?: number | null, leftOnly?: boolean, own?: boolean) {
  rest = rest || cfg.rest || 120;
  let sec = 0, any = false;
  const app = appRules(), warm = new Set<string>();                    // (в эталоне нет) мышцы, которые в этой тренировке уже работали: им разминка не нужна
  for (const it of items) {
    if (it.skip) continue;
    const ex = cfg.ex[it.ex] || {} as ExDef, wave = isCycle(cfg, it.ex), light = isLight(cfg, it.ex);
    const all = it.sets ? it.sets.filter(x => !x.warm && !x.skip) : null;
    const n = all ? (leftOnly ? all.filter(x => x.r == null).length : all.length) : light ? lightOf(cfg, it.ex).sets : wave ? waveSetsAvg(cfg, it.ex) : (+it.n! || 0);
    const fresh = app && freshFor(ex.m, warm);
    if (app && (all ? all.length : n)) for (const [m, c] of Object.entries(ex.m || {})) if (c > 0) warm.add(m);
    if (!n) continue;
    const started = leftOnly && all && all.some(x => x.r != null);
    const r = app ? restOf(cfg, it.ex) * (ex.uni ? 0.5 : 1) : wave ? rest + 60 : ex.uni ? rest / 2 : rest;   // (в эталоне нет) с днями «День N» отдых — по упражнению, а не один на всех
    /* (в эталоне нет) с днями «День N» разминочные подходы — по типу упражнения (rules.ts, WARM; решение владельца, 25 ноября 2026) */
    const setup = app ? 60 + warmSets(cfg, it.ex, fresh) * WARM.sec : 60 + (wave ? 180 : 0);
    sec += (started ? 0 : setup) + n * ((byPct(cfg, it.ex) || light ? 25 : 40) + r);   // (в эталоне нет) у базового на двойной прогрессии подход — 40 с, как у подсобки
    any = true;
  }
  return any ? (sec + (leftOnly ? 0 : 300)) / 60 * (appRules() && !own ? PACE.k : 1) : 0;   // (в эталоне нет) с днями «День N» — по темпу атлета (rules.ts, PACE)
}
export const fmtDur = (min: number) => { const m = Math.max(5, Math.round(min / 5) * 5); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : ''); };
export const fmtRest = (sec: number) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
