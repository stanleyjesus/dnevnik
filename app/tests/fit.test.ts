/* Лимит недели от времени на тренировку (функция 41 в docs/05; решение владельца, 19 ноября 2026; в эталоне этого нет).
   Атлет называет время на одну тренировку — дневник берёт самый большой лимит недели, при котором самая длинная тренировка
   собранной программы укладывается. Время сравнивается так, как оно показано в заголовке дня: с округлением до 5 минут.
   Числа на примерных данных — те же, что в docs/04, раздел 2: первая таблица — с таблицей дней эталона (там в дне девять упражнений, как в эталоне),
   вторая — с днями «День 1…3», как в приложении. Сам список на экране проверяет сценарий «программа: время на тренировку». */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { TIMES, fitBudget, shown, timeOf } from '../src/ui/fit.ts';
import { useDays } from '../src/core/days.ts';
import type { BuildOpts, Workout } from '../src/core/types.ts';

const LIMITS = [40, 50, 60, 70, 80, 90, 100];
const table = (t: Record<number, number>) => (b: number) => t[b];

test('время сравнивается так, как оно показано в заголовке дня: округление до 5 минут', () => {
  for (const m of [2, 3, 58, 62, 63, 87.4, 87.5, 92.4, 92.5, 107, 118]) assert.equal(Core.fmtDur(shown(m)), Core.fmtDur(m), m + ' мин');
  assert.deepEqual([2, 62, 63, 92, 93, 107, 108].map(shown), [5, 60, 65, 90, 95, 105, 110]);
});

test('список времени — от часа до двух с шагом 15 минут; нет настройки — не ограничено', () => {
  assert.deepEqual(TIMES, [60, 75, 90, 105, 120]);
  assert.equal(timeOf(null), 0); assert.equal(timeOf(undefined), 0); assert.equal(timeOf({}), 0);
  assert.equal(timeOf({ time: 90 }), 90); assert.equal(timeOf({ time: 0 }), 0); assert.equal(timeOf({ time: -15 }), 0);
  assert.equal(timeOf({ time: 'полтора часа' as unknown as number }), 0);
});

test('берётся самый большой лимит, при котором самая длинная тренировка укладывается', () => {
  const longest = table({ 40: 63, 50: 69, 60: 79, 70: 88, 80: 101, 90: 107, 100: 115 });
  assert.deepEqual(fitBudget(LIMITS, longest, 75), { budget: 50, fits: true, min: 69 });
  assert.deepEqual(fitBudget(LIMITS, longest, 90), { budget: 70, fits: true, min: 88 });
  assert.deepEqual(fitBudget(LIMITS, longest, 105), { budget: 90, fits: true, min: 107 }, '107 минут показаны как 1 ч 45 — значит, укладывается');
  assert.deepEqual(fitBudget(LIMITS, longest, 120), { budget: 100, fits: true, min: 115 });
  assert.deepEqual(fitBudget(LIMITS.slice().reverse(), longest, 90).budget, 70, 'порядок списка лимитов не важен');
});

test('не укладывается ни один лимит: самый малый и честное «не помещается»', () => {
  const longest = table({ 40: 63, 50: 69, 60: 79, 70: 88, 80: 101, 90: 107, 100: 115 });
  assert.deepEqual(fitBudget(LIMITS, longest, 60), { budget: 40, fits: false, min: 63 });
});

test('длительность не обязана расти с лимитом: больший лимит, который укладывается, не пропускается', () => {
  /* числа условные. На примерных данных спад есть только на минуту (дневник неделей позже, «Сила: подтягивания», отдых 2:00: 99.5 мин при лимите 80 и 98.5 при 90),
     на экране обе — 1 ч 40, и на выбор лимита он не влияет; правило держит эта таблица */
  const longest = table({ 40: 59, 50: 72, 60: 80, 70: 92, 80: 101, 90: 103, 100: 101 });
  assert.equal(fitBudget(LIMITS, longest, 100).budget, 100);
  assert.equal(fitBudget(LIMITS, longest, 90).budget, 70);
});

test('сборки-примерки идут сверху вниз и только пока ответ не найден', () => {
  const asked: number[] = [], longest = (b: number) => { asked.push(b); return b + 10; };
  fitBudget(LIMITS, longest, 120);
  assert.deepEqual(asked, [100]);
  asked.length = 0; fitBudget(LIMITS, longest, 90);
  assert.deepEqual(asked, [100, 90, 80]);
  asked.length = 0; fitBudget(LIMITS, longest, 30);
  assert.deepEqual(asked, [100, 90, 80, 70, 60, 50, 40], 'каждый лимит спрошен один раз, даже когда не подошёл ни один');
});

test('примерные данные: лимит по времени на настоящих сборках — «Равномерно», гибрид, сила; отдых 2 минуты и полторы', () => {
  const cfg = Core.mergeCfg(readJson('data/config.json'));
  const W: Workout[] = Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
  const cases: [string, BuildOpts, number, Record<number, number | null>][] = [
    ['Равномерно, отдых 2:00', {}, 120, { 60: null, 75: 50, 90: 70, 105: 80, 120: 100 }],
    ['Равномерно, отдых 1:30', {}, 90, { 60: 50, 75: 70, 90: 80, 105: 100, 120: 100 }],
    ['Равномерно, отдых 3:00', {}, 180, { 60: null, 75: null, 90: 50, 105: 60, 120: 70 }],
    ['Гибрид: жим лежа, отдых 2:00', { focus: 'bench' }, 120, { 60: 40, 75: 50, 90: 70, 105: 90, 120: 100 }],
    ['Сила: все базовые, отдых 2:00', { strength: true }, 120, { 60: 40, 75: 60, 90: 70, 105: 100, 120: 100 }],
    ['Сила: жим лежа, отдых 2:00', { focus: 'bench', strength: true }, 120, { 60: 40, 75: 50, 90: 70, 105: 100, 120: 100 }]
  ];
  for (const [name, opts, rest, want] of cases) {
    const memo: Record<number, number> = {};
    const longest = (b: number) => memo[b] ?? (memo[b] = (pr => Math.max(...Core.SLOTS.map(sl => Core.estMinutes(pr.cfg, pr.slots[sl.id], rest))))(Core.buildProgram(W, cfg, Object.assign({ budget: b }, opts))));
    for (const t of TIMES) {
      const f = fitBudget(LIMITS, longest, t);
      assert.equal(f.fits ? f.budget : null, want[t], name + ', время ' + t);
      if (!f.fits) { assert.equal(f.budget, 40, name + ': не помещается — самый малый лимит'); assert.ok(shown(longest(40)) > t); continue; }
      assert.ok(shown(longest(f.budget)) <= t, name + ': самая длинная тренировка длиннее названного времени');
      for (const b of LIMITS.filter(v => v > f.budget)) assert.ok(shown(longest(b)) > t, name + ', время ' + t + ': лимит ' + b + ' тоже укладывается, а выбран ' + f.budget);
    }
  }
});

test('дни «День 1…3»: сборка сама укладывает каждый день во время, поэтому лимит по времени — лимит профиля, а с большим временем в дне не меньше упражнений', () => {
  /* решение владельца 23 ноября 2026: упражнений в дне — от времени на тренировку. Числа — в docs/04, раздел 2, вторая таблица; на экране их проверяет сценарий
     «программа: время на тренировку». Пара: подходов в неделю и упражнений в самом полном дне (стороны в паре — два упражнения) */
  useDays(3, false);
  try {
    const W: Workout[] = Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
    const cases: [string, BuildOpts, number, Record<number, [number, number]>][] = [
      ['Равномерно, отдых 2:00', {}, 120, { 60: [45, 7], 75: [62, 9], 90: [77, 9], 105: [87, 11], 120: [87, 11] }],
      ['Равномерно, отдых 1:30', {}, 90, { 60: [55, 9], 75: [76, 9], 90: [87, 11], 105: [87, 11], 120: [87, 11] }],
      ['Равномерно, отдых 3:00', {}, 180, { 60: [35, 5], 75: [45, 7], 90: [58, 8], 105: [70, 9], 120: [80, 9] }],
      /* в 2 ч подходов на один меньше, чем в 1 ч 45 мин: уровень мышц тот же (10–12.5), раскладка другая — подходы ушли с дельт к груди */
      ['Гибрид: жим лежа, отдых 2:00', { focus: 'bench' }, 120, { 60: [46, 8], 75: [64, 9], 90: [79, 10], 105: [90, 12], 120: [89, 11] }],
      /* пункт 8 (решение владельца, 24 ноября 2026): под «Силой» — тройка или одно упражнение, по проценту идёт только цель, остальные базовые — обычные упражнения */
      /* «Новая схема» (решение владельца, 24 ноября 2026): тяжёлый день 3 × 4, лёгкий 3 × 8 и идёт в объём целиком — подсобке нужно меньше подходов */
      ['Сила: пауэрлифтерская тройка, отдых 2:00', { strength: true, triad: true }, 120, { 60: [49, 8], 75: [63, 9], 90: [73, 10], 105: [74, 10], 120: [74, 12] }],
      /* в 1 ч 45 мин подходов на три меньше, чем в 1 ч 30 мин: уровень мышц тот же, раскладка другая — в день 1 встала румынская тяга */
      ['Сила: жим лежа, отдых 2:00', { focus: 'bench', strength: true }, 120, { 60: [52, 9], 75: [68, 9], 90: [79, 10], 105: [76, 11], 120: [76, 11] }],
      ['Сила: становая тяга, отдых 2:00', { focus: 'deadlift', strength: true }, 120, { 60: [52, 9], 75: [68, 9], 90: [78, 10], 105: [78, 10], 120: [78, 10] }]
    ];
    for (const [name, opts, rest, want] of cases) {
      const cfg = Core.mergeCfg(readJson('data/config.json')); cfg.rest = rest;
      for (const t of TIMES) {
        const memo: Record<number, ReturnType<typeof Core.buildProgram>> = {}, at = (b: number) => memo[b] ?? (memo[b] = Core.buildProgram(W, cfg, Object.assign({ budget: b, time: t }, opts)));
        const longest = (b: number) => Math.max(...Core.SLOTS.map(sl => Core.estMinutes(at(b).cfg, at(b).slots[sl.id])));
        const f = fitBudget(LIMITS, longest, t), pr = at(f.budget);
        assert.deepEqual([f.fits, f.budget], [true, 100], name + ', время ' + t + ': укладывается лимит профиля');
        assert.ok(Core.SLOTS.every(sl => shown(Core.estMinutes(pr.cfg, pr.slots[sl.id])) <= t), name + ', время ' + t + ': тренировка длиннее названного времени');
        assert.deepEqual([+Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0).toFixed(1), Math.max(...Core.SLOTS.map(sl => pr.slots[sl.id].length))], want[t], name + ', время ' + t);
      }
    }
  } finally { useDays(null, true); }
});
