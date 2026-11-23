/* Оценка времени тренировки.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { isCycle, isLight } from './config.ts';
import { lightOf, waveSetsAvg } from './goals.ts';
import type { Cfg, ExDef, TplItem } from './types.ts';

/* minutes a workout takes: a warm-up, a minute to set up each exercise (three more to warm up a percentage lift), every set and the rest after it */
export const REST_OPTS = [60, 90, 120, 150, 180];
export function estMinutes(cfg: Cfg, items: TplItem[], rest?: number | null, leftOnly?: boolean) {
  rest = rest || cfg.rest || 120;
  let sec = 0, any = false;
  for (const it of items) {
    if (it.skip) continue;
    const ex = cfg.ex[it.ex] || {} as ExDef, wave = isCycle(cfg, it.ex), light = isLight(cfg, it.ex);
    const all = it.sets ? it.sets.filter(x => !x.warm && !x.skip) : null;
    const n = all ? (leftOnly ? all.filter(x => x.r == null).length : all.length) : light ? lightOf(cfg, it.ex).sets : wave ? waveSetsAvg(cfg, it.ex) : (+it.n! || 0);
    if (!n) continue;
    const started = leftOnly && all && all.some(x => x.r != null);
    sec += (started ? 0 : 60 + (wave ? 180 : 0)) + n * ((wave || light ? 25 : 40) + (wave ? rest + 60 : ex.uni ? rest / 2 : rest));
    any = true;
  }
  return any ? (sec + (leftOnly ? 0 : 300)) / 60 : 0;
}
export const fmtDur = (min: number) => { const m = Math.max(5, Math.round(min / 5) * 5); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : ''); };
export const fmtRest = (sec: number) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
