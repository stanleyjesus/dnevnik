/* Цели упражнений и волны базовых.
   Перенесено из reference/src/core.js: тела функций без изменений, кроме методики под цель с днями «День N» (rules.ts, решение владельца 24 ноября 2026). */
import { isLight, kindOf, LIGHT } from './config.ts';
import { appGoal, appRules, HOLD } from './rules.ts';
import { EASY, estRir } from './sets.ts';
import type { Cfg, ExDef, Goal, PctMap, Range, Workout } from './types.ts';

/* what the athlete wants from one exercise. It sets the rep range of a double-progression exercise and the wave of a percentage lift */
export const GOALS: Record<string, Goal> = { mass: { n: 'масса', lo: 8, w: 4 }, both: { n: 'сила и масса', lo: 6, w: 4 }, strength: { n: 'приоритет силы' }, hold: { n: 'поддержание' }, auto: { n: 'сила по запасу' } };
/* the mark counts only where it means something: a wave for a percentage lift, 8–12 or 6–10 for a multi-joint accessory, nothing for isolation */
export const goalOf = (cfg: Cfg, id: string) => {
  if (appRules()) return appGoal(cfg.ex[id]);                        // (в эталоне нет) в приложении отметка — только роль базового: сила по запасу или поддержание; диапазон — по типу упражнения
  const g = (cfg.ex[id] || {} as ExDef).goal, k = kindOf(cfg, id);
  if (!g) return null;
  if (k === 'base') return g === 'strength' || g === 'hold' || g === 'auto' ? g : null;
  if (k === 'compound') return g === 'strength' ? 'both' : g === 'mass' || g === 'both' ? g : null;
  return null;
};
export const goalName = (cfg: Cfg, id: string) => { const g = goalOf(cfg, id); return g ? GOALS[g].n : ''; };
/* lower bound from the goal, width from the athlete's own rule (weight step in % / 2.5), never narrower than the goal's minimum */
export const goalRange = (goal: string, w: number, step: number): Range => { const g = GOALS[goal], k = Math.min(8, Math.max(g.w!, w > 0 ? Math.round(step / w * 100 / 2.5) : 0)); return [g.lo!, g.lo! + k]; };
/* the heavy wave for the priority lift: up to doubles at 92.5%, the maximum grows once per cycle.
   A lift on «поддержание» keeps the usual wave with one set fewer and a frozen maximum */
export const WAVE_S: { pct: PctMap; sets: Record<number, number>; inc: number } = { pct: { 5: 77.5, 4: 82.5, 3: 87.5, 2: 92.5 }, sets: { 5: 4, 4: 4, 3: 4, 2: 3 }, inc: 2.5 };
/* «сила по запасу»: the same four sets of four every week with one weight, and the reserve of the last set decides the next week —
   two or more: one step up, one: the same weight, none or a set not closed: 5% down. The weight starts at 83% of the maximum,
   which leaves about two reps in the last set. Its second day is three sets of four at 78%: three to four reps in reserve. */
export const AUTO = { pct: 83, reps: 4, sets: 4, aim: 2, down: 5 };
export const LIGHT_A = { pct: 78, reps: 4, sets: 3 };
export function waveOf(cfg: Cfg, id: string) {
  /* (в эталоне нет) в приложении волны нет: базовое по проценту идёт силой по запасу или на поддержании — 3 × 4 на 83% от максимума, который не растёт */
  if (appRules()) { const hold = goalOf(cfg, id) === 'hold', S = hold ? HOLD : AUTO; return { strong: false, hold, auto: !hold, keep: true, pct: { [S.reps]: S.pct } as PctMap, order: [S.reps], sets: (_r: number) => S.sets, inc: 0, perCycle: false }; }
  const g = goalOf(cfg, id), strong = g === 'strength', hold = g === 'hold', auto = g === 'auto', pct = auto ? { [AUTO.reps]: AUTO.pct } : strong ? WAVE_S.pct : cfg.cycle.pct;
  return { strong, hold, auto, keep: strong || hold || auto, pct, order: Object.keys(pct).map(Number).sort((a, b) => b - a),
    sets: (r: number) => auto ? AUTO.sets : strong ? (WAVE_S.sets[r] || 4) : hold ? Math.max(2, cfg.cycle.sets - 1) : cfg.cycle.sets, inc: auto ? 0 : strong ? WAVE_S.inc : hold ? 0 : cfg.cycle.inc, perCycle: strong };
}
/* the light day follows its lift: 3 × 5 at 75% beside a wave, 3 × 4 at 78% beside «сила по запасу» */
export const lightOf = (cfg: Cfg, id: string) => appRules() ? LIGHT_A : goalOf(cfg, isLight(cfg, id) ? (cfg.ex[id] || {} as ExDef).of! : id) === 'auto' ? LIGHT_A : LIGHT;
export const cycleVol = (cfg: Cfg, id: string) => {
  if (isLight(cfg, id)) { const L = lightOf(cfg, id); return estRir(L.pct, L.reps) >= EASY ? 0.5 : 1; }
  const e = Object.entries(waveOf(cfg, id).pct);
  return e.length ? e.reduce((a, x) => a + (estRir(+x[1], +x[0]) >= EASY ? 0.5 : 1), 0) / e.length : 1;
};
export const waveSetsAvg = (cfg: Cfg, id: string) => { const wv = waveOf(cfg, id); return wv.order.length ? wv.order.reduce((a, r) => a + wv.sets(r), 0) / wv.order.length : cfg.cycle.sets; };
/* the accepted programme stands in for a day until the first workout of that day is done under it */
export const progPending = (cfg: Cfg, slot: string, w?: Workout | null) => { const P = cfg && cfg.program; return !!(P && P.slots && Array.isArray(P.slots[slot]) && P.slots[slot].length && (!w || w.date < P.since)); };
