/* Методика под цель и порядок упражнений в дне (решения владельца, 24 ноября 2026): rules.ts, разбор и источники — docs/03, раздел 15.
   С днями «День 1…N» по проценту от расчётного максимума идёт только базовое в силовой роли: сила по запасу, поддержание, лёгкий день.
   Всё остальное, в том числе базовое в «Массе», — по независимой двойной прогрессии с диапазоном по типу упражнения: многосуставные 6–10,
   изоляция 8–12. Волны 77–82–87 нет. Максимум в истории упражнения — по подходам (решение владельца, 24 ноября 2026).
   С таблицей дней эталона всё считается как в эталоне. Числа — на примерных данных из data/. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ref, plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { AUTO } from '../src/core/goals.ts';
import { DAY_H, DAY_L, DAY_M } from '../src/core/strength.ts';
import { HOLD, ORDER, REST, TYPE, appRange, appRules, byPct, dayOrder, logMax, restOf } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, Item, ProgEntry, ProgSlots, SetRec, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; program?: unknown };
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedRaw = (): Raw => readJson('data/config.json');
const docs = (): { date: string }[] => readJson('data/workouts.json');
const seedW = (): Workout[] => Core.sortW(docs().map(d => Core.fromDoc(d.date, d)));
/** настройка примерного профиля; у жима лежа — роль `goal` */
function cfgWith(goal?: string, more?: (r: Raw) => void): Cfg {
  const r = seedRaw();
  if (goal) r.ex.bench = Object.assign({}, r.ex.bench, { goal });
  if (more) more(r);
  return Core.mergeCfg(r);
}
/* последняя тренировка примерного журнала — понедельник 10 ноября, день 1: жим лежа 4 × 3 по 95 кг на 87% */
const NEXT = '2025-11-17', LATER = '2025-11-24';
const benchOf = (W: Workout[], cfg: Cfg, date = NEXT) => Core.plan(W, cfg, 'mon', date).items.find(i => i.ex === 'bench')!;
const sh = (it: Item) => plain({ cyc: it.cyc, range: it.range, w: it.sets.map(s => s.w) });
/** журнал примерного профиля и ещё одна тренировка дня 1 с жимом лежа */
function plus(it: Partial<Item> & { sets: SetRec[] }): Workout[] {
  const bench = Object.assign({ ex: 'bench', range: null, cyc: null, note: '', skip: false, rir: null }, it) as Item;
  return Core.sortW(seedW().concat([{ id: NEXT, date: NEXT, slot: 'mon', note: '', open: false, items: [bench] }]));
}
const x4 = (w: number, r: number, q?: number): SetRec[] => [{ w, r }, { w, r }, { w, r }, q == null ? { w, r } : { w, r, q }];
const BASE = ['bench', 'leg_press', 'pullup'];

test('с таблицей дней эталона всё как в эталоне: базовые идут волной, у остальных диапазон от 8', () => {
  assert.equal(appRules(), false);
  const W = seedW(), cfg = Core.mergeCfg(seedRaw()), RW = Ref.sortW(docs().map(d => Ref.fromDoc(d.date, d))), RC = Ref.mergeCfg(seedRaw());
  for (const id of BASE) assert.ok(byPct(cfg, id), id);
  for (const sl of ['mon', 'wed', 'fri']) assert.deepEqual(plain(Core.plan(W, cfg, sl, NEXT)), plain(Ref.plan(RW, RC, sl, NEXT)), sl);
  assert.deepEqual(sh(benchOf(W, cfg)), { cyc: { pct: 77, reps: 5 }, range: null, w: [85, 85, 85, 85] }, 'волна пошла по кругу: 77% × 5');
  assert.deepEqual(Core.rangeOf(W, cfg, 'pec_fly'), [8, 12]);
});

test('с днями «День N» диапазон — по типу упражнения: многосуставные и базовые 6–10, изоляция 8–12, ширина от шага снаряда', () => withDays(3, () => {
  const W = seedW(), cfg = Core.mergeCfg(seedRaw()), range = (id: string) => Core.rangeOf(W, cfg, id);
  for (const id of BASE.concat(['incline_db', 'lat_pulldown', 'tbar_row'])) assert.deepEqual(range(id), [6, 10], id);
  for (const id of ['pec_fly', 'leg_ext', 'leg_curl_lying', 'barbell_curl', 'tri_pushdown']) assert.deepEqual(range(id), [8, 12], id);
  /* шаг снаряда больше 11% от рабочего веса — диапазон шире: после прибавки веса нижняя граница по силам */
  for (const id of ['hammer', 'tri_overhead']) assert.deepEqual(range(id), [8, 13], id);
  /* махи с лёгкими гантелями: шаг 2 кг — большой процент от веса, ширина упирается в восемь повторов */
  assert.deepEqual(range('lat_raise_db'), [8, 16]);
  /* ширина — шаг веса в % от рабочего веса / 2.5: не уже 4 повторов, не шире 8 */
  const ex = (more: Partial<ExDef>): ExDef => Object.assign({ n: 'Упражнение', m: {} }, more);
  assert.deepEqual(appRange(ex({ pat: 'h_push' }), null, 100, 2.5), [TYPE.compound.lo, TYPE.compound.lo + TYPE.compound.w]);
  assert.deepEqual(appRange(ex({ pat: 'iso' }), null, 50, 2.5), [TYPE.iso.lo, TYPE.iso.lo + TYPE.iso.w]);
  assert.deepEqual(appRange(ex({ pat: 'iso' }), null, 5, 2.5), [8, 16]);
  assert.deepEqual(appRange(ex({ mode: 'cycle' }), null, 0, 2.5), [6, 10], 'базовое — многосуставное');
  /* свой диапазон остаётся: прошлый, если он начинается не с 8 (8 всем давало прежнее правило), или lo–hi справочника */
  assert.deepEqual(appRange(ex({ pat: 'iso' }), [12, 20], 10, 2), [12, 20]);
  assert.deepEqual(appRange(ex({ pat: 'iso' }), [8, 12], 10, 2), [8, 16], 'прежний 8–12 — по типу и по шагу');
  assert.deepEqual(appRange(ex({ pat: 'iso', lo: 10, hi: 20 }), [8, 12], 10, 2), [10, 20]);
  assert.deepEqual(Core.rangeOf([], Core.mergeCfg(withStarter(null)), 'lat_raise'), [10, 20], 'махи встроенного справочника — 10–20');
}));

test('«Масса»: базовое идёт по двойной прогрессии, четыре подхода; первый раз — от расчётного максимума последних подходов', () => withDays(3, () => {
  const W = seedW(), cfg = cfgWith();
  assert.ok(!byPct(cfg, 'bench'));
  /* 95 кг × 3 на 87% — запас около одного повтора: максимум по Эпли 95 × (1 + 4/30) ≈ 107.7 кг.
     Середина 6–10 с запасом 1 — 8 повторов и ещё один: 107.7 / (1 + 9/30) ≈ 82.8, вниз до шага штанги — 82.5 */
  const last = W.filter(w => w.items.some(i => i.ex === 'bench')).pop()!.items.find(i => i.ex === 'bench')!;
  assert.equal(Core.fmt(logMax(last, cfg.rir)!, 1), '107.7');
  assert.deepEqual(sh(benchOf(W, cfg)), { cyc: null, range: [6, 10], w: [82.5, 82.5, 82.5, 82.5] });
}));

test('двойная прогрессия независимая: каждый подход идёт от своего прошлого подхода', () => withDays(3, () => {
  const W = plus({ range: [6, 10], sets: [{ w: 82.5, r: 10 }, { w: 82.5, r: 9 }, { w: 82.5, r: 6 }, { w: 82.5, r: 5 }] });
  /* верх диапазона — плюс шаг, внутри — тот же вес, ниже нижней границы — минус шаг */
  assert.deepEqual(sh(benchOf(W, cfgWith(), LATER)), { cyc: null, range: [6, 10], w: [85, 82.5, 82.5, 80] });
}));

test('«Сила»: базовое в силовой роли — тяжёлый день 3 × 4 одним весом на 83%, вес решает запас в последнем подходе', () => withDays(3, () => {
  const W = seedW(), cfg = cfgWith('auto');
  assert.ok(byPct(cfg, 'bench'));
  /* «Новая схема» (решение владельца, 24 ноября 2026): тяжёлый день — 3 × 4 на 83%, а не 4 × 4 */
  assert.deepEqual([DAY_H, AUTO.aim, AUTO.down], [{ pct: 83, reps: 4, sets: 3 }, 2, 5]);
  /* максимум — 95 / 0.87 ≈ 109.2 кг; 83% — 90.6, до шага штанги — 90 */
  assert.deepEqual(sh(benchOf(W, cfg)), { cyc: { pct: DAY_H.pct, reps: DAY_H.reps }, range: null, w: [90, 90, 90] });
  /* в журнале — прежние 4 × 4: запас последнего подхода решает так же */
  const next = (sets: SetRec[]) => benchOf(plus({ cyc: { pct: AUTO.pct, reps: AUTO.reps }, tm: 108.43, sets }), cfg, LATER).sets.map(s => s.w);
  assert.deepEqual([next(x4(90, 4, 3)), next(x4(90, 4, 2)), next(x4(90, 4, 1)), next(x4(90, 4, 0))].map(w => w[0]), [92.5, 92.5, 90, 85], 'запас 2 и больше — плюс шаг, 1 — тот же вес, 0 — минус 5%');
  assert.deepEqual(next([{ w: 90, r: 4 }, { w: 90, r: 4 }, { w: 90, r: 4 }, { w: 90, r: 3, q: 0 }]), [85, 85, 85], 'подход не закрыт — минус 5%');
  assert.deepEqual(next([{ w: 90, r: 4 }, { w: 90, r: 4 }, { w: 90, r: 4, q: 2 }]).length, 3, 'после 3 × 4 — снова три подхода');
  /* прежняя отметка «приоритет силы» (тяжёлая волна) читается как сила по запасу */
  assert.deepEqual(sh(benchOf(W, cfgWith('strength'))), sh(benchOf(W, cfg)));
}));

test('«Сила»: лёгкий день — 3 × 8 на 75%, средний — 3 × 6 на 79%, поддержание — 3 × 4 на 83% от максимума, который не растёт', () => withDays(3, () => {
  const W = seedW();
  assert.deepEqual([DAY_L, DAY_M], [{ pct: 75, reps: 8, sets: 3 }, { pct: 79, reps: 6, sets: 3 }]);
  const cfg = cfgWith('auto', r => {
    r.ex.bench_light = { n: 'Жим лежа — лёгкий день', mode: 'light', of: 'bench', pat: 'h_push', m: r.ex.bench.m };
    r.ex.bench_mid = { n: 'Жим лежа — средний день', mode: 'light', of: 'bench', mid: true, pat: 'h_push', m: r.ex.bench.m };
  });
  assert.deepEqual(sh(Core.makeItem(W, cfg, 'bench_light', 'wed', '2025-11-19')), { cyc: { pct: DAY_L.pct, reps: DAY_L.reps }, range: null, w: [82.5, 82.5, 82.5] }, '75% от 109.2 кг — 81.9, до шага штанги — 82.5');
  assert.deepEqual(sh(Core.makeItem(W, cfg, 'bench_mid', 'fri', '2025-11-21')), { cyc: { pct: DAY_M.pct, reps: DAY_M.reps }, range: null, w: [87.5, 87.5, 87.5] }, '79% от 109.2 кг — 86.3, до шага штанги — 87.5');
  /* запас по Эпли во всех трёх днях — около двух повторов */
  assert.deepEqual([DAY_H, DAY_M, DAY_L].map(d => Core.estRir(d.pct, d.reps)), [2, 2, 2]);
  const hold = cfgWith('hold');
  assert.deepEqual(sh(benchOf(W, hold)), { cyc: { pct: HOLD.pct, reps: HOLD.reps }, range: null, w: [90, 90, 90] });
  const held = plus({ cyc: { pct: HOLD.pct, reps: HOLD.reps }, tm: 109.2, sets: [{ w: 90, r: 4 }, { w: 90, r: 4 }, { w: 90, r: 4 }] });
  assert.deepEqual(sh(benchOf(held, hold, LATER)).w, [90, 90, 90], 'вес прежний');
}));

test('смена способа: после двойной прогрессии максимум берётся из её подходов, план идёт с весов журнала', () => withDays(3, () => {
  const W = plus({ range: [6, 10], sets: [{ w: 85, r: 8 }, { w: 85, r: 8 }, { w: 85, r: 7 }, { w: 85, r: 7 }] });
  /* лучший подход — 85 × 8 с запасом по методике профиля (1): 85 × (1 + 9/30) = 110.5 кг; 83% — 91.7, до шага штанги — 92.5 */
  assert.equal(logMax(W.find(w => w.date === NEXT)!.items[0], 1), 110.5);
  assert.deepEqual(sh(benchOf(W, cfgWith('auto'), LATER)), { cyc: { pct: 83, reps: 4 }, range: null, w: [92.5, 92.5, 92.5] });
  assert.deepEqual(sh(benchOf(W, cfgWith('hold'), LATER)).w, [92.5, 92.5, 92.5]);
  /* отмеченный запас — вместо запаса по методике: 85 × 8 с запасом 2 — 85 × (1 + 10/30) ≈ 113.3 кг */
  assert.equal(Core.fmt(logMax({ ex: 'bench', range: [6, 10], cyc: null, note: '', skip: false, rir: null, sets: [{ w: 85, r: 8, q: 2 }, { w: 85, r: 8 }] }, 1)!, 1), '113.3');
}));

test('максимум в истории — по подходам: лучший подход по Эпли от повторов плюс запас, у всех упражнений; веса плана прежние', () => {
  /* после 4 × 3 по 95 кг на 87%: неделя 77% — 4 × 5 по 85 кг с запасом 2, неделя 82% — 4 × 4 по 90 кг с запасом 3, 3, 2, 1.
     Вес больше, повторы плюс запас те же (7): по подходам максимум растёт, а «вес / процент» показывал спад */
  const mk = (date: string, items: Item[]): Workout => ({ id: date, date, slot: 'mon', note: '', open: false, items });
  const it = (ex: string, sets: SetRec[], cyc: Item['cyc'] = null): Item => ({ ex, cyc, range: null, sets, note: '', skip: false, rir: null });
  const W = Core.sortW(seedW().concat([
    mk(NEXT, [it('bench', [85, 85, 85, 85].map(w => ({ w, r: 5, q: 2 })), { pct: 77, reps: 5 }), it('pec_fly', [{ w: 40, r: 12, q: 1 }, { w: 40, r: 10, q: 2 }, { w: 40, r: 9 }])]),
    mk(LATER, [it('bench', [{ w: 90, r: 4, q: 3 }, { w: 90, r: 4, q: 3 }, { w: 90, r: 4, q: 2 }, { w: 90, r: 4, q: 1 }], { pct: 82, reps: 4 })])
  ]));
  const look = (cfg: Cfg) => ({
    bench: Core.sessions(W, cfg, 'bench').slice(-3).map(s => [+s.metric.toFixed(2), +s.tm!.toFixed(2), s.best.w + ' × ' + s.best.r + (s.best.q != null ? ' r' + s.best.q : '')]),
    fly: +Core.sessions(W, cfg, 'pec_fly').pop()!.metric.toFixed(2),
    index: (([a, b]) => +(b.idx / a.idx).toFixed(4))(Core.strengthIndex(W, cfg).slice(-2)),
    auto: (c => [c.w, +c.tm!.toFixed(2)])(Core.planCycle(W, cfgWith('auto'), 'bench', '2025-12-01'))
  });
  /* таблица дней эталона: у подходов по проценту — вес / процент (сохранённый tm), у остальных — повторы плюс запас сверх целевого 1 */
  assert.deepEqual(look(Core.mergeCfg(seedRaw())), {
    bench: [[109.2, 109.2, '95 × 3'], [110.39, 110.39, '85 × 5 r2'], [109.76, 109.76, '90 × 4 r3']],
    fly: 56, index: 0.9943, auto: [90, 109.76]
  });
  withDays(3, () => assert.deepEqual(look(Core.mergeCfg(seedRaw())), {
    /* 95 × 3 без отмеченного запаса — запас по проценту: 87% и 3 повтора — около 1, 95 × (1 + 4/30) ≈ 107.7; 85 × (1 + 7/30) ≈ 104.8; 90 × (1 + 7/30) = 111 */
    bench: [[107.67, 109.2, '95 × 3'], [104.83, 110.39, '85 × 5 r2'], [111, 109.76, '90 × 4 r3']],
    /* 40 × 12 с запасом 1: 40 × (1 + 13/30) ≈ 57.3 */
    fly: 57.33,
    /* индекс силы — от того же максимума: 111 / 104.83 ≈ 1.0588 */
    index: 1.0588,
    /* расчётный максимум плана (tm) прежний: сила по запасу после 82% — 109.76 × 83% ≈ 91.1, до шага штанги — 90 */
    auto: [90, 109.76]
  }));
  /* поправки ищут рекорд по тому же максимуму. «Неделей позже»: жим ногами 175 × 5 на 77% с запасом 2, 2, 1, 0 — по подходам 175 × (1 + 7/30) ≈ 215.8,
     а рекорд 222 (180 × 4 на 82%, запас по проценту — 3) был три тренировки назад; по «вес / процент» это был бы рекорд 227.3. Плато — по тренду
     четырёх недель (решение владельца, 26 ноября 2026, plateau.test.ts): через неделю после среды десятой недели план предлагает «Плато»: −10% */
  const later = readJson('data/later.json').profiles[0], LW: Workout[] = Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  withDays(3, () => {
    const cfg = Core.mergeCfg(later.config), s = Core.exStats(LW, cfg, 'leg_press', Core.program(LW, cfg))!;
    assert.deepEqual([s.status, s.sincePR, s.pr.date, +s.pr.metric.toFixed(1), +s.last.metric.toFixed(1), +s.last.tm!.toFixed(1)], ['flat', 3, '2025-10-22', 222, 215.8, 227.3]);
    const p = Core.adapt(LW, cfg, 'wed', '2025-11-26').props.find(x => x.ex === 'leg_press')!;
    assert.deepEqual([p.tag, p.sets.map(x => x.w)], ['Плато', [157.5, 157.5, 157.5, 157.5]]);
  });
});

test('сборка ставит роль базовых по цели: «Масса» — двойная прогрессия, «Сила» — по проценту только цель, «Гибрид» — цель по запасу, остальные на поддержании', () => withDays(3, () => {
  const W = seedW(), cfg = Core.mergeCfg(seedRaw());
  const roles = (o: BuildOpts) => { const pr = Core.buildProgram(W, cfg, o); return BASE.map(id => [pr.goals[id] ?? null, byPct(pr.cfg, id)]); };
  assert.deepEqual(roles({}), BASE.map(() => [null, false]), '«Масса»: базовых по проценту нет');
  assert.deepEqual(roles({ focus: 'bench' }), [['auto', true], ['hold', true], ['hold', true]]);
  assert.deepEqual(roles({ focus: 'bench', others: 'grow' }), BASE.map(() => ['auto', true]), '«Остальные растут» — сила по запасу раз в неделю');
  /* пункт 8 (решение владельца, 24 ноября 2026): под «Силой» по проценту идёт только цель, остальные базовые справочника — обычные упражнения */
  assert.deepEqual(roles({ focus: 'bench', strength: true }), [['auto', true], [null, false], [null, false]], '«Сила: жим лежа»');
  assert.deepEqual(roles({ strength: true, triad: true }), [['auto', true], [null, false], [null, false]], '«Сила: пауэрлифтерская тройка»: из базовых справочника в тройке только жим лежа');
  /* прежний силовой режим «все базовые» в логике остался — его держит таблица дней эталона; с днями «День N» экран его не предлагает */
  assert.deepEqual(roles({ strength: true }), BASE.map(() => ['auto', true]));
}));

test('программа вокруг одного базового, принятая с «Растут как раньше»: остальные базовые читаются как сила по запасу, хранилище не меняется', () => {
  const raw = seedRaw();
  raw.ex.bench = Object.assign({}, raw.ex.bench, { goal: 'auto' });
  raw.program = { name: 'Пауэрбилдинг: жим лежа', focus: 'bench', others: 'grow', slots: { mon: [{ ex: 'bench' }], wed: [{ ex: 'leg_press' }], fri: [{ ex: 'pullup' }] } };
  const before = JSON.stringify(raw);
  assert.deepEqual(BASE.map(id => Core.goalOf(Core.mergeCfg(raw), id)), ['auto', null, null], 'таблица дней эталона: остальные — по волне, как в эталоне');
  withDays(3, () => assert.deepEqual(BASE.map(id => Core.goalOf(Core.mergeCfg(raw), id)), ['auto', 'auto', 'auto']));
  raw.program = Object.assign({}, raw.program, { others: 'hold' });
  withDays(3, () => assert.deepEqual(BASE.map(id => Core.goalOf(Core.mergeCfg(raw), id)), ['auto', null, null], 'без «растут» отметки не появляются'));
  raw.program = Object.assign({}, raw.program, { others: 'grow' });
  assert.equal(JSON.stringify(raw), before, 'настройка в хранилище переписана');
});

test('недельный объём: базовое на двойной прогрессии — масса и полные подходы, по проценту — сила', () => {
  const ref = Core.planned(seedW(), Core.mergeCfg(seedRaw())), r2 = (v: number | undefined) => v == null ? v : Math.round(v * 100) / 100;
  const chest = Core.mergeCfg(seedRaw()).ex.bench.m.chest;
  withDays(3, () => {
    const W = seedW(), mass = Core.planned(W, cfgWith()), auto = Core.planned(W, cfgWith('auto'));
    /* в эталоне жим лежа идёт волной: его четыре подхода — сила, и каждый за долю (cycleVol); в «Массе» они — полные подходы на массу */
    assert.deepEqual([r2(mass.pv.chest), r2(mass.ps.chest)], [r2(ref.pv.chest - ref.ps.chest + 4 * chest), undefined]);
    /* 3 × 4 на 83% — запас около двух повторов: подход считается целым; подходов на один меньше, чем на двойной прогрессии */
    assert.deepEqual([r2(auto.pv.chest), r2(auto.ps.chest)], [r2(mass.pv.chest - chest), 3 * chest]);
  });
});

test('время подхода: у базового на двойной прогрессии — 40 секунд, как у подсобки; разминка — по типу упражнения; отдых с днями «День N» — по упражнению', () => {
  const ref = Core.estMinutes(Core.mergeCfg(seedRaw()), [{ ex: 'bench' }]);
  /* эталон: пять минут на разминку всей тренировки, минута на упражнение и три — на разминку базового, четыре подхода по 25 секунд и отдых 2:00 + минута */
  assert.equal(Math.round(ref * 60), 300 + 60 + 180 + 4 * (25 + 120 + 60));
  withDays(3, () => {
    /* отдых ставит дневник (просьба владельца, 25 ноября 2026; rules.ts, REST): в «Массе» жим — многосуставное, на примерных данных без снаряда — 2 мин;
       тяжёлый день силовой роли — 5 мин (выбор владельца тем же днём) */
    assert.equal(Math.round(Core.estMinutes(cfgWith(), [{ ex: 'bench' }]) * 60), 300 + 60 + 180 + 4 * (40 + REST.other), 'четыре подхода по 40 секунд и отдых многосуставного');
    /* разминочные подходы по типу упражнения (решение владельца, 25 ноября 2026; rules.ts, WARM): у базового на двойной прогрессии два по 1 мин 30 с — те же три минуты,
       перед тяжёлым днём — четыре */
    assert.equal(Math.round(Core.estMinutes(cfgWith('auto'), [{ ex: 'bench' }]) * 60), 300 + 60 + 4 * 90 + 3 * (25 + REST.heavy), 'сила по запасу: 3 × 4, отдых тяжёлого дня');
    assert.deepEqual([restOf(cfgWith(), 'bench'), restOf(cfgWith('auto'), 'bench'), REST], [120, 300, { heavy: 300, light: 180, free: 150, other: 120, iso: 120 }]);
  });
});

/* ---------- порядок упражнений в дне (решение владельца, 24 ноября 2026, вопрос сборки 13; docs/03, раздел 15.3) ---------- */
type Built = ReturnType<typeof Core.buildProgram>;
const ids = (L: ProgEntry[]) => L.map(e => e.ex);
const orderNote = (pr: Built) => pr.notes.filter(n => n.t.startsWith('Порядок упражнений')).map(n => n.t);
/* так программу принимает экран (acceptProgram) */
function acceptAs(raw: Raw, pr: Built, since: string): Cfg {
  const r = plain(raw); Object.assign(r.ex, plain(pr.create));
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  const slots: ProgSlots = {}; for (const id of Object.keys(pr.slots)) slots[id] = pr.slots[id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', prio: pr.prio, budget: pr.budget, since, made: since, slots }, pr.strength ? { strength: true, lean: true } : {}, pr.dropped.length ? { drop: pr.dropped.slice() } : {});
  return Core.mergeCfg(r);
}

test('порядок в дне: пример из разбора — базовое первым, многосуставное до изоляции, два упражнения на трицепс не подряд', () => {
  const cfg = Core.mergeCfg(withStarter(null)), mains = (e: ProgEntry) => Object.entries(cfg.ex[e.ex].m || {}).filter(x => x[1] >= 1).map(x => x[0]);
  const tier = (e: ProgEntry) => { const k = Core.kindOf(cfg, e.ex); return k === 'base' ? ORDER.base : k === 'light' ? ORDER.light : ORDER.rest + (k === 'iso' ? 1 : 0); };
  const day = ['bench', 'tri_pushdown', 'skullcrusher', 'lat_pulldown', 'pec_fly', 'barbell_curl'].map(ex => ({ ex })), put = dayOrder(day, tier, mains, () => null);
  assert.deepEqual(put.map(e => cfg.ex[e.ex].n), ['Жим лежа', 'Вертикальная тяга в тренажере', 'Трицепс с косичкой на блоке', 'Бабочка', 'Французский жим лежа', 'Бицепс со штангой стоя']);
  assert.equal(dayOrder(put, tier, mains, () => null), put, 'расставленный день остаётся как есть');
  /* два упражнения на трицепс не развести, если в дне больше нет изоляции: порядок остаётся прежним */
  const two = ['bench', 'skullcrusher', 'tri_pushdown'].map(ex => ({ ex }));
  assert.deepEqual(ids(dayOrder(two, tier, mains, () => null)), ['bench', 'skullcrusher', 'tri_pushdown']);
  /* правая и левая сторона — одно упражнение: стоят рядом, даже если между ними было другое */
  const side = (e: ProgEntry) => e.ex.startsWith('w') ? 'кисть' : null, wm = (e: ProgEntry) => e.ex.startsWith('w') ? ['forearms'] : mains(e);
  assert.deepEqual(ids(dayOrder(['w_r', 'barbell_curl', 'w_l', 'lat_pulldown'].map(ex => ({ ex })), e => e.ex === 'lat_pulldown' ? ORDER.rest : ORDER.rest + 1, wm, side)), ['lat_pulldown', 'w_r', 'w_l', 'barbell_curl']);
});

test('порядок в дне: сборка расставляет дни черновика, заметка называет дни, где переставлено прежнее', () => withDays(3, () => {
  const W = seedW(), raw = seedRaw(), pr = Core.buildProgram(W, Core.mergeCfg(raw), {});
  /* день 2 начинался с разгибаний ног — изоляции перед жимом ногами на те же мышцы; теперь первым базовое, разгибания — после многосуставных */
  assert.deepEqual(ids(pr.cur.wed).slice(0, 2), ['leg_ext', 'leg_press']);
  assert.deepEqual(ids(pr.slots.wed), ['leg_press', 'incline_db', 'tbar_row', 'x_thrust', 'x_ohp', 'leg_ext', 'barbell_curl', 'x_rear', 'lat_raise_db']);   // сгибаний кистей нет: предплечья вне расчёта (вывод 2 аудита)
  /* румынская тяга и сгибания ног на бицепс бедра не подряд: между ними жим над головой */
  assert.deepEqual(ids(pr.slots.mon), ['bench', 'lat_pulldown', 'x_rdl', 'x_ohp', 'leg_curl_seated', 'lat_raise_machine', 'tri_overhead', 'x_rear']);
  assert.deepEqual(orderNote(pr), ['Порядок упражнений: день 2'], 'в днях 1 и 3 прежние упражнения стоят в прежнем порядке, новое отмечено «новое»');
  assert.ok(!pr.same);
  /* после «Принять» сборка совпадает с принятой и ничего не переставляет */
  const again = Core.buildProgram(W, acceptAs(raw, pr, '2025-11-12'), {});
  assert.ok(again.same, 'сразу после «Принять» сборка предлагает другую программу'); assert.deepEqual(orderNote(again), []);
  /* мышцы в приоритете — сразу после базового, раньше многосуставных на другие мышцы */
  const arms = Core.buildProgram(W, Core.mergeCfg(raw), { prio: 'arms' });
  assert.deepEqual(ids(arms.slots.mon).slice(0, 4), ['bench', 'tri_overhead', 'hammer', 'lat_pulldown']);
  assert.deepEqual(ids(arms.slots.fri).slice(0, 4), ['pullup', 'tri_pushdown', 'bayesian_curl', 'x_thrust']);
  /* гибрид: упражнение на массу — сразу после базового своего дня; лёгкий день жима — раньше базового на поддержании */
  const pb = Core.buildProgram(W, Core.mergeCfg(raw), { focus: 'bench' }), mass = Core.SLOTS.find(sl => pb.slots[sl.id].some(e => e.pin))!;
  assert.deepEqual(ids(pb.slots[mass.id]).slice(0, 2), ['leg_press', 'incline_db']);
  assert.deepEqual(ids(pb.slots.fri).slice(0, 2), ['bench_light', 'pullup']);
  /* «Вручную» порядок атлета */
  const hand = Core.buildProgram(W, Core.mergeCfg(raw), { manual: true });
  assert.deepEqual(Core.SLOTS.map(sl => ids(hand.slots[sl.id])), Core.SLOTS.map(sl => ids(hand.cur[sl.id])));
}));

test('порядок в дне при любой цели и любом числе дней: ступени по порядку, стороны рядом, после «Принять» то же; с таблицей дней эталона порядок не трогается', () => {
  const later = readJson('data/later.json').profiles[0];
  const sets: [string, Raw, Workout[], string][] = [['примерные данные', seedRaw(), seedW(), '2025-11-12'], ['второй профиль', readJson('data/config.p2.stored.json'), [], '2025-11-12'],
    ['дневник неделей позже', later.config, Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d))), '2025-11-19']];
  const modes: BuildOpts[] = [{}, { prio: 'legs' }, { prio: 'arms' }, { focus: 'bench' }, { strength: true, budget: 80 }, { focus: 'bench', strength: true, budget: 80 }, { time: 105 }];
  for (const n of [2, 3, 4]) for (const [name, raw, W, since] of sets) for (const opts of modes) withDays(n, () => {
    const pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), opts), c = pr.cfg, at = n + ' дня, ' + name + ', ' + JSON.stringify(opts);
    for (const sl of Core.SLOTS) {
      /* движение цели (тяжёлый или лёгкий день), остальные базовые, лёгкие дни силового режима, потом всё остальное */
      const L = pr.slots[sl.id], rank = L.map(e => { const k = Core.kindOf(c, e.ex); return pr.focus && (e.ex === pr.focus || e.ex === pr.focus + '_light') ? 0 : k === 'base' ? 1 : k === 'light' ? 2 : 3; });
      assert.ok(rank.every((r, i) => !i || r >= rank[i - 1]), at + ', ' + sl.s + ': базовое и лёгкий день не первыми — ' + ids(L).join());
      for (let i = 0; i < L.length; i++) if (c.ex[L[i].ex].uni) {
        const j = L.findIndex((e, x) => x !== i && c.ex[e.ex].uni && JSON.stringify(c.ex[e.ex].m) === JSON.stringify(c.ex[L[i].ex].m));
        assert.ok(j < 0 || Math.abs(j - i) === 1, at + ', ' + sl.s + ': стороны упражнения не рядом — ' + ids(L).join());
      }
    }
    const again = Core.buildProgram(W, acceptAs(raw, pr, since), opts);
    assert.deepEqual(orderNote(again), [], at + ': после «Принять» сборка снова переставляет');
    assert.deepEqual(Core.SLOTS.map(sl => ids(again.slots[sl.id]).filter(id => ids(pr.slots[sl.id]).includes(id)).join()), Core.SLOTS.map(sl => ids(pr.slots[sl.id]).filter(id => ids(again.slots[sl.id]).includes(id)).join()), at + ': после «Принять» порядок другой');
  });
  const pr = Core.buildProgram(seedW(), Core.mergeCfg(seedRaw()), {});
  assert.deepEqual(orderNote(pr), []); assert.deepEqual(ids(pr.slots.wed).slice(0, 2), ['leg_ext', 'leg_press'], 'с таблицей дней эталона — порядок эталона');
});

test('подпись объёма: с днями «День N» в скобках — только подходы силы, с таблицей дней эталона — «масса … · сила …»', () => {
  /* решение владельца, 26 ноября 2026: «11.5 (сила 5.5)» — растят мышцу все подходы, а не только «масса» (docs/03, раздел 3) */
  withDays(3, () => assert.deepEqual([Core.splitText(11.5, 5.5), Core.splitText(8, 0), Core.splitText(12.04, 6.04)], ['сила 5.5', '', 'сила 6']));
  assert.equal(Core.splitText(11.5, 5.5), 'масса 6 · сила 5.5');
});
