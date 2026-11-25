/* Онбординг (решение владельца, 25 ноября 2026): оценка стартового веса по похожему упражнению (src/core/rules.ts, KIN и kinMax).
   Пока упражнения нет в журнале и для него ничего не названо, дневник берёт названный вес упражнения той же семьи со штангой
   или гантелями и переносит максимум долей из таблицы. Тренажёры и блоки не оцениваются. С таблицей дней эталона оценки нет.
   Сам мастер — экран: его проходит сценарий «онбординг» (scripts/scenarios.mjs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { KIN, kinMax, kinOf } from '../src/core/rules.ts';
import { STARTER, withStarter } from '../src/core/starter.ts';
import type { ExDef, Workout } from '../src/core/types.ts';

function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
/* встроенный справочник с названными весами: { id: { max } } или { id: { work, workR } } */
const cfgWith = (named: Record<string, Partial<ExDef>>) => {
  const raw = withStarter(null);
  for (const [id, v] of Object.entries(named)) Object.assign(raw.ex![id], v);
  return Core.mergeCfg(raw);
};
const start = (cfg: ReturnType<typeof cfgWith>, id: string, W: Workout[] = []) => plain(Core.startOf(W, cfg, id));

test('семьи: только штанга и гантели из встроенного справочника, первое в семье — доля 1, остальные легче', () => {
  for (const [fam, ks] of Object.entries(KIN)) {
    const ids = Object.keys(ks);
    assert.equal(ks[ids[0]], 1, fam + ': первое в семье — доля 1');
    assert.equal(STARTER[ids[0]].gear, 'barbell', fam + ': первое в семье — со штангой');
    for (const id of ids) {
      assert.ok(STARTER[id], fam + ': ' + id + ' нет во встроенном справочнике');
      assert.ok(['barbell', 'dumbbell'].includes(STARTER[id].gear!), fam + ': ' + STARTER[id].n + ' — не штанга и не гантели');
      assert.ok(ks[id] > 0 && ks[id] <= 1, fam + ': ' + id + ' — доля от 0 до 1');
      assert.ok(STARTER[id].gear !== 'dumbbell' || ks[id] <= 0.5, fam + ': ' + id + ' — гантель считается на одну руку');
    }
  }
  /* упражнение в одной семье, не больше */
  const all = Object.values(KIN).flatMap(ks => Object.keys(ks));
  assert.equal(new Set(all).size, all.length);
});

test('пример владельца: жим лежа 100 кг на раз — жим гантелей лёжа с 30 кг на гантель', () => withDays(3, () => {
  const cfg = cfgWith({ bench: { max: 100 } });
  assert.equal(Core.knownMax(cfg, 'db_bench'), 40);                 // 100 × 0.4: две гантели вместе ≈ 83% штанги, с запасом вниз
  assert.deepEqual(start(cfg, 'db_bench'), { w: 30, src: 'est', of: 'bench' });   // 40 / (1 + (8 + 2) / 30) = 30 (запас 2 в многосуставных со свободным весом), шаг гантели 2 кг
  assert.deepEqual(start(cfg, 'incline_db'), { w: 24, src: 'est', of: 'bench' }); // 33 / 1.33 = 24.75 → 24
  assert.deepEqual(start(cfg, 'db_ohp'), { w: 18, src: 'est', of: 'bench' });     // 25 / 1.33 = 18.75 → 18
  assert.deepEqual(start(cfg, 'incline_bench'), { w: 60, src: 'est', of: 'bench' });   // 80 / 1.33 = 60 (шаг штанги 2.5)
  assert.equal(Core.startOf([], cfg, 'bench')!.src, 'max', 'своё названное — не оценка');
}));

test('рабочий вес с повторами тоже источник: приседания 100 × 8 — выпады с гантелями 20 кг', () => withDays(3, () => {
  const cfg = cfgWith({ squat: { work: 100, workR: 8 } });
  assert.equal(Core.knownMax(cfg, 'lunge'), 26.667);                // 100 × (1 + (8 + 2) / 30) = 133.3 (запас 2 в приседаниях, вывод 10 аудита), × 0.2
  assert.deepEqual(start(cfg, 'lunge'), { w: 20, src: 'est', of: 'squat' });
}));

test('тренажёры, блоки и другие семьи не оцениваются', () => withDays(3, () => {
  const cfg = cfgWith({ bench: { max: 100 }, squat: { max: 140 } });
  for (const id of ['chest_press', 'pec_fly', 'cable_fly', 'leg_press', 'hack_squat', 'lat_pulldown', 'rdl', 'barbell_row', 'skullcrusher']) {
    assert.equal(start(cfg, id), null, STARTER[id].n);
    assert.equal(Core.knownMax(cfg, id), null, STARTER[id].n);
  }
  assert.equal(kinOf(cfg, 'chest_press'), null);
}));

test('из нескольких названных берётся меньшая оценка; своё названное важнее оценки', () => withDays(3, () => {
  const cfg = cfgWith({ bench: { max: 100 }, close_grip_bench: { max: 99 } });   // узкий 99 — это жим 110: оценка выше, берётся жим
  assert.deepEqual(start(cfg, 'db_bench'), { w: 30, src: 'est', of: 'bench' });
  assert.deepEqual(kinMax(cfg, 'db_bench', x => Core.knownMax(cfg, x, true)), { max: 40, of: 'bench' });
  const own = cfgWith({ bench: { max: 100 }, db_bench: { work: 26 } });
  assert.deepEqual(start(own, 'db_bench'), { w: 26, src: 'work' });
}));

test('оценка только от тяжёлого к лёгкому: жим гантелей сидя не оценивает жим лежа и жим гантелей лежа', () => withDays(3, () => {
  const cfg = cfgWith({ db_ohp: { max: 25 } });
  for (const id of ['bench', 'db_bench', 'incline_db', 'ohp']) assert.equal(start(cfg, id), null, STARTER[id].n);
  const peer = cfgWith({ db_curl: { max: 20 } });                    // доли равны: молотки — тот же вес, что сгибания с гантелями
  assert.deepEqual(kinMax(peer, 'hammer', x => Core.knownMax(peer, x, true)), { max: 20, of: 'db_curl' });
  assert.equal(kinMax(peer, 'barbell_curl', x => Core.knownMax(peer, x, true)), null);
}));

test('упражнение уже в журнале — оценки нет, веса берутся из журнала', () => withDays(3, () => {
  const cfg = cfgWith({ bench: { max: 100 } });
  const W = [{ id: '2026-11-20', date: '2026-11-20', slot: 'mon', note: '', open: false, items: [{ ex: 'db_bench', sets: [{ w: 28, r: 9 }] }] }] as unknown as Workout[];
  assert.equal(start(cfg, 'db_bench', W), null);
}));

test('с таблицей дней эталона оценки нет: известные веса считаются как в эталоне', () => {
  const cfg = cfgWith({ bench: { max: 100 } });
  assert.equal(Core.knownMax(cfg, 'db_bench'), null);
  assert.equal(start(cfg, 'db_bench'), null);
  assert.equal(kinMax(cfg, 'db_bench', x => Core.knownMax(cfg, x, true)), null);
});

test('упражнение профиля узнаётся по названию встроенного справочника', () => withDays(3, () => {
  const raw = withStarter(null);
  raw.ex!.my_db = Object.assign({}, raw.ex!.db_bench); delete raw.ex!.db_bench;   // то же упражнение под своим id
  raw.ex!.bench.max = 100;
  const cfg = Core.mergeCfg(raw);
  assert.deepEqual(start(cfg, 'my_db'), { w: 30, src: 'est', of: 'bench' });
}));
