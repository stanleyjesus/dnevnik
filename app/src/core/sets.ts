/* Арифметика одного подхода: расчётный максимум, запас, вклад в объём.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import type { Item, SetRec } from './types.ts';

/* ---------- per-set maths ---------- */
export const work = (it: Item) => it.skip ? [] : it.sets.filter(s => s.r! > 0 && !s.warm && !s.skip);
export const e1 = (w: number, r: number) => r <= 1 ? w : w * (1 + r / 30);                      // Epley
export const topSet = (sets: SetRec[]) => sets.reduce((t, s) => (s.w! > t.w! || (s.w === t.w && s.r! > t.r!)) ? s : t, sets[0]);
/* reps normalised to the method's reserve (one rep unless the profile says otherwise): 10 reps with 3 in reserve count as 12 */
export let TARGET = 1;
export const setTarget = (v: number) => { TARGET = v >= 0 && v <= 4 ? Math.round(v) : 1; };
export const effReps = (s: SetRec) => s.r! + (s.q == null ? 0 : s.q - TARGET);
export const bestSet = (sets: SetRec[]) => sets.reduce((t, s) => e1(s.w!, effReps(s)) > e1(t.w!, effReps(t)) ? s : t, sets[0]);
/* reps in reserve: logged, or for wave sets estimated from the percentage (Epley) */
export const estRir = (pct: number, reps: number) => Math.round(30 * (100 / pct - 1) - reps);
export const setRir = (s: SetRec, it: Item) => s.q != null ? s.q : it.cyc && it.cyc.pct ? estRir(it.cyc.pct, s.r!) : null;
export const EASY = 3;                                              // a set this far from failure counts as half a set for muscle volume
export const setVol = (s: SetRec, it: Item) => { const q = setRir(s, it); return q != null && q >= EASY ? 0.5 : 1; };
