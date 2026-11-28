/* Вес по ходу тренировки (просьба владельца, 28 ноября 2026; docs/03, раздел 25): rules.ts, LIVE, liveOf, liveSets; на экране — ui/live.ts.
   Подход на нижней границе диапазона или ниже (с поправкой на запас) — следующим подходам вес легче по Эпли, на повтор выше нижней границы;
   легче верха на 2 повтора и больше — тяжелее, на середину диапазона; вес, вписанный атлетом, и записанные подходы не меняются */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { LIVE, liveOf, liveSets, rirOf } from '../src/core/rules.ts';
import type { SetRec, Workout } from '../src/core/types.ts';

function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
const S = (w: number | null, r: number | null, q?: number): SetRec => q == null ? { w, r } : { w, r, q };

test('вес по ходу тренировки: что подход говорит следующим', () => {
  assert.deepEqual(LIVE, { buf: 1, high: 2 });
  /* пример владельца: 8–12, запас по методике 1. 40 × 8 с запасом 1 — нижняя граница: по Эпли 52 кг, на 9 повторов с запасом 1 — 39, вниз до шага 37.5 */
  assert.deepEqual(liveOf(S(40, 8, 1), [8, 12], 1, 2.5), { w: 37.5, dir: -1 });
  /* с запасом 0 это как 7 повторов: тоже легче; запас не отмечен — как по методике, то же, что с запасом 1 */
  assert.deepEqual(liveOf(S(40, 8, 0), [8, 12], 1, 2.5), { w: 37.5, dir: -1 });
  assert.deepEqual(liveOf(S(40, 8), [8, 12], 1, 2.5), { w: 37.5, dir: -1 });
  /* 6 повторов в отказ — по Эпли 48 кг, на 9 с запасом 1 — 36, вниз до шага 35 */
  assert.deepEqual(liveOf(S(40, 6, 0), [8, 12], 1, 2.5), { w: 35, dir: -1 });
  /* 9 повторов с запасом 1 и 8 с запасом 2 — в диапазоне: ничего не меняется */
  assert.equal(liveOf(S(40, 9, 1), [8, 12], 1, 2.5), null);
  assert.equal(liveOf(S(40, 8, 2), [8, 12], 1, 2.5), null);
  /* со свободным весом запас по методике 2: 80 × 6 с запасом 1 в 6–10 — это как 5; на 7 с запасом 2 — 75.9, вниз до 75 */
  assert.deepEqual(liveOf(S(80, 6, 1), [6, 10], 2, 2.5), { w: 75, dir: -1 });
  /* легче верха на 2 и больше: 20 × 14 с запасом 1 — на середину диапазона (10 с запасом 1) по Эпли 21.95, вниз до шага 20 — но не меньше чем на шаг вверх */
  assert.deepEqual(liveOf(S(20, 14, 1), [8, 12], 1, 2.5), { w: 22.5, dir: 1 });
  assert.deepEqual(liveOf(S(20, 25, 1), [8, 12], 1, 2.5), { w: 25, dir: 1 });
  assert.equal(liveOf(S(20, 13, 1), [8, 12], 1, 2.5), null);
  /* нечем считать: нет повторов, нет веса, вес не больше шага */
  assert.equal(liveOf(S(40, null), [8, 12], 1, 2.5), null);
  assert.equal(liveOf(S(null, 6), [8, 12], 1, 2.5), null);
  assert.equal(liveOf(S(2.5, 5, 0), [8, 12], 1, 2.5), null);
});

test('вес по ходу тренировки: веса подходов упражнения', () => {
  const R: [number, number] = [8, 12], no = [false, false, false];
  /* подход 1 на нижней границе — подходам 2 и 3 вес легче */
  assert.deepEqual(liveSets([S(40, 8, 1), S(40, null), S(40, null)], [40, 40, 40], no, R, 1, 2.5), { w: [40, 37.5, 37.5], why: { i: 0, w: 37.5, dir: -1 } });
  /* подход 2 тем весом в диапазоне — поправка остаётся, третий тоже легче */
  assert.deepEqual(liveSets([S(40, 8, 1), S(37.5, 10, 1), S(37.5, null)], [40, 40, 40], no, R, 1, 2.5), { w: [40, 37.5, 37.5], why: { i: 0, w: 37.5, dir: -1 } });
  /* подход 2 опять на нижней границе — третий ещё легче, причина — подход 2 */
  assert.deepEqual(liveSets([S(40, 8, 1), S(37.5, 7, 1), S(37.5, null)], [40, 40, 40], no, R, 1, 2.5), { w: [40, 37.5, 35], why: { i: 1, w: 35, dir: -1 } });
  /* вес подхода 3 вписал атлет — не трогаем */
  assert.deepEqual(liveSets([S(40, 8, 1), S(40, null), S(42.5, null)], [40, 40, 40], [false, false, true], R, 1, 2.5).w, [40, 37.5, 42.5]);
  /* подход исправлен на 10 повторов — веса возвращаются к плану, строки нет */
  assert.deepEqual(liveSets([S(40, 10, 1), S(37.5, null), S(37.5, null)], [40, 40, 40], no, R, 1, 2.5), { w: [40, 40, 40], why: null });
  /* план уже легче поправки (веса по подходам убывают) — вес не меняется и строки нет */
  assert.deepEqual(liveSets([S(40, 8, 1), S(37.5, null), S(35, null)], [40, 37.5, 35], no, R, 1, 2.5), { w: [40, 37.5, 35], why: null });
  /* подход легче верха — следующим вес тяжелее, но не легче плана */
  assert.deepEqual(liveSets([S(20, 15, 1), S(20, null), S(25, null)], [20, 20, 25], no, R, 1, 2.5), { w: [20, 22.5, 25], why: { i: 0, w: 22.5, dir: 1 } });
  /* веса в плане нет: подход 1 атлет взвесил сам, следующие получают его вес, а после поправки — её */
  assert.deepEqual(liveSets([S(40, 10, 1), S(null, null), S(null, null)], [null, null, null], [true, false, false], R, 1, 2.5), { w: [40, 40, 40], why: null });
  assert.deepEqual(liveSets([S(40, 8, 1), S(null, null), S(null, null)], [null, null, null], [true, false, false], R, 1, 2.5), { w: [40, 37.5, 37.5], why: { i: 0, w: 37.5, dir: -1 } });
  /* записанные подходы не меняются, даже когда подход перед ними дал поправку */
  assert.deepEqual(liveSets([S(40, 8, 1), S(40, 6, 0), S(40, null)], [40, 40, 40], no, R, 1, 2.5).w, [40, 40, 35]);
});

test('вес по ходу тренировки на примерных данных: план дня 1, подход на нижней границе', () => withDays(3, () => {
  const W = seedW(), cfg = Core.mergeCfg(readJson('data/config.json'));
  const it = Core.plan(W, cfg, 'mon', '2025-11-19').items.find(x => x.ex === 'leg_curl_seated')!, step = Core.stepOf(W, cfg, it.ex);
  assert.deepEqual([it.range, it.sets.map(s => s.w), step, rirOf(cfg, it.ex)], [[8, 12], [37.5, 37.5, 35, 35], 2.5, 1]);
  /* 37.5 × 8 с запасом 1: по Эпли 48.75, на 9 с запасом 1 — 36.6, вниз до 35. Второй подход — 35 вместо 37.5, третий и четвёртый по плану и так 35 */
  const sets = it.sets.map((s, i) => i ? S(s.w, null) : S(s.w, 8, 1));
  assert.deepEqual(liveSets(sets, it.sets.map(s => s.w), sets.map(() => false), it.range!, rirOf(cfg, it.ex), step), { w: [37.5, 35, 35, 35], why: { i: 0, w: 35, dir: -1 } });
}));
