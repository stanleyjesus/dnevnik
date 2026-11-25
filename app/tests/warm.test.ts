/* Разминка по типу упражнения (решение владельца, 25 ноября 2026; docs/03, раздел 17): сколько разминочных подходов и какие — rules.ts, WARM, warmSets,
   WARM_STEPS, warmPlan; оценка времени (time.ts) считает те же подходы, карточка упражнения в тренировке показывает раскладку (ui/warmup.ts).
   Только с днями «День N»; с таблицей дней эталона — три минуты разминки базового, как в эталоне (method.test.ts) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { WARM, WARM_STEPS, freshFor, warmPlan, warmSets } from '../src/core/rules.ts';
import type { Cfg, Workout } from '../src/core/types.ts';

function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
/* разминочные подходы дня по порядку упражнений — так же, как их считает оценка времени */
function dayWarm(cfg: Cfg, ids: string[]) {
  const seen = new Set<string>();
  return ids.map(id => { const m = cfg.ex[id].m || {}, n = warmSets(cfg, id, freshFor(m, seen)); for (const [k, c] of Object.entries(m)) if (c > 0) seen.add(k); return n; });
}

test('разминка: сколько подходов — по типу упражнения и по тому, работала ли уже его мышца', () => withDays(3, () => {
  assert.deepEqual([WARM, WARM_STEPS], [{ heavy: 4, light: 2, free: 2, first: 1, sec: 90 }, { 1: [[70, 5]], 2: [[50, 6], [80, 3]], 4: [[40, 6], [60, 4], [75, 2], [90, 1]] }]);
  const cfg = Core.mergeCfg(withStarter(null) as never), pr = Core.buildProgram([], cfg, { focus: 'bench', strength: true, budget: 80 });
  /* тяжёлый день — 4, лёгкий день — 2, даже когда мышца уже работала */
  assert.deepEqual([warmSets(pr.cfg, 'bench', false), warmSets(pr.cfg, 'bench_light', false)], [4, 2]);
  /* базовое на двойной прогрессии — 2; первое на мышцу со штангой — 2, в тренажёре и с гантелями — 1; мышца уже работала — 0 */
  assert.deepEqual(['bench', 'squat', 'chest_press', 'db_bench', 'lat_raise'].map(id => warmSets(cfg, id, true)), [2, 2, 1, 1, 1]);
  assert.deepEqual(['squat', 'chest_press', 'lat_raise'].map(id => warmSets(cfg, id, false)), [0, 0, 0]);
  /* на примерных данных, день 1: жим — 2, тяга и бицепс бедра — по 1, трицепс и молотки — 0: трицепс помогал в жиме, бицепс — в тяге */
  const sample = Core.mergeCfg(readJson('data/config.json')), W = seedW(), date = Core.addDays(W[W.length - 1].date, 1);
  const items = Core.plan(W, sample, 'mon', date).items;
  assert.deepEqual([items.map(it => it.ex), dayWarm(sample, items.map(it => it.ex))], [['bench', 'lat_pulldown', 'leg_curl_seated', 'lat_raise_machine', 'tri_overhead', 'hammer'], [2, 1, 1, 1, 0, 0]]);
  /* оценка времени: на каждый разминочный подход — 1 мин 30 с сверх минуты на подготовку упражнения */
  const one = (ids: string[]) => Core.estMinutes(sample, ids.map(ex => ({ ex, sets: [{ w: 20, r: null }] })));
  assert.equal(Math.round((one(['lat_pulldown', 'leg_curl_seated']) - one(['lat_pulldown'])) * 60), 60 + 90 + 40 + 120, 'второе упражнение на свою мышцу — с одним разминочным подходом');
  assert.equal(Math.round((one(['lat_pulldown', 'hammer']) - one(['lat_pulldown'])) * 60), 60 + 40 + 120, 'бицепс уже работал в тяге — без разминки');
}));

test('раскладка разминки: доли первого рабочего веса, вес вниз до шага снаряда; без веса — доли, с весом тела — полегче', () => withDays(3, () => {
  const cfg = Core.mergeCfg(withStarter(null) as never), w = (L: ReturnType<typeof warmPlan>) => L.map(x => [x.w, x.r]);
  assert.deepEqual(w(warmPlan(cfg, 'bench', 4, 100, 2.5)), [[40, 6], [60, 4], [75, 2], [90, 1]], 'тяжёлый день, 100 кг');
  assert.deepEqual(w(warmPlan(cfg, 'squat', 2, 60, 2.5)), [[30, 6], [47.5, 3]], '80% от 60 — 48, вниз до шага штанги');
  assert.deepEqual(w(warmPlan(cfg, 'chest_press', 1, 50, 2.5)), [[35, 5]]);
  assert.deepEqual(w(warmPlan(cfg, 'lat_raise', 2, 6, 2)), [[2, 6], [4, 3]], 'гантели — вес одной');
  assert.deepEqual(w(warmPlan(cfg, 'lat_raise', 2, 2, 2)), [], 'легче шага не бывает — разминки нет');
  assert.deepEqual(w(warmPlan(cfg, 'leg_ext', 2, 10, 5)), [[5, 6]], 'одинаковый вес — один подход');
  assert.deepEqual(plain(warmPlan(cfg, 'squat', 2, null, 2.5)), [{ pct: 50, r: 6, w: null }, { pct: 80, r: 3, w: null }], 'вес не задан — доли рабочего');
  assert.deepEqual(w(warmPlan(cfg, 'pullup', 2, 85, 1)), [[null, 6], [null, 3]], 'в вес входит тело — полегче');
  assert.deepEqual(warmPlan(cfg, 'bench', 0, 100, 2.5), []);
}));
