/* Цели «Силы» и «Гибрида» (решение владельца, 24 ноября 2026, пункт 8 вопросов сборки; docs/03, раздел 15.4; docs/04, раздел 3.3в).
   С днями «День N» «базовое» — роль в программе: по проценту идёт только цель — одно упражнение из списка или «Пауэрлифтерская тройка».
   Под «Силой» остальные базовые справочника — обычные многосуставные по двойной прогрессии, под «Гибридом» — как ставит переключатель.
   Цели, которой нет в справочнике, сборка берёт из встроенного. Числа на примерных данных — те же, что в docs/04, раздел 3.3в. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { DAY_H, DAY_L, DAY_M, ISO, ISO_LIGHT, TARGETS, TRIAD, TRIAD_DAYS } from '../src/core/strength.ts';
import { asStored, canTarget, isoLift, programRoles, targetIds, targetName, targetOf, triadIds } from '../src/core/rules.ts';
import { STARTER_GEAR } from '../src/core/starter.ts';
import { forceMode, lostMode, mixText, modeAfter, modeKey, soloText, triadOk } from '../src/ui/goal.ts';
import type { BuildOpts, Cfg, ExDef, ProgSlots, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; gear?: Record<string, { n: string; step: number }>; program?: Record<string, unknown> };
type Built = ReturnType<typeof Core.buildProgram>;
const seedRaw = (): Raw => readJson('data/config.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const loads = (pr: Built) => Core.SLOTS.map(sl => pr.after.load[sl.id]);
const total = (pr: Built) => loads(pr).reduce((a, b) => a + b, 0);
const span = (pr: Built, ms: string[]) => { const v = ms.map(m => pr.after.pv[m] || 0); return Core.fmt(Math.min(...v), 1) + '–' + Core.fmt(Math.max(...v), 1); };
const tracked = (cfg: Cfg) => Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id);
const titles = (pr: Built) => pr.notes.map(n => n.t);
const daysWith = (pr: Built, id: string) => Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)).map(sl => sl.id);
const STRONG80: BuildOpts = { strength: true, budget: 80 }, TRI: BuildOpts = { strength: true, triad: true, budget: 80 };
/* общее для любой сборки: лимиты атлета не нарушены, в днях — только упражнения справочника сборки */
function sound(pr: Built, budget: number) {
  assert.ok(total(pr) <= budget + 0.01, 'подходов больше лимита недели: ' + total(pr));
  assert.deepEqual(Core.ruleBreaks(pr.cfg, pr.after), [], 'лимиты атлета нарушены');
  for (const sl of Core.SLOTS) for (const e of pr.slots[sl.id]) assert.ok(pr.cfg.ex[e.ex], 'упражнения нет в справочнике сборки: ' + e.ex);
}
/* так программу принимает экран (acceptProgram): новые упражнения — со своим снарядом, отметки, дни; сила и тройка — в программе */
function acceptAs(raw: Raw, pr: Built, since: string): Raw {
  const r = plain(raw);
  for (const [id, def] of Object.entries(plain(pr.create))) if (!r.ex[id]) { const g = def.gear; if (g && STARTER_GEAR[g] && !(r.gear && r.gear[g])) { r.gear = r.gear || {}; r.gear[g] = plain(STARTER_GEAR[g]); } r.ex[id] = def; }
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  const slots: ProgSlots = {}; for (const sl of Core.SLOTS) slots[sl.id] = pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', since, made: since, slots }, pr.strength ? { strength: true, lean: true } : {}, pr.triad ? { triad: pr.triad.slice() } : {}, pr.dropped.length ? { drop: pr.dropped.slice() } : {});
  return r;
}

test('список целей: восемь упражнений и тройка; цель ищется в справочнике по id и по названию, а нет её там — берётся из встроенного', () => {
  assert.deepEqual(TARGETS, ['bench', 'squat', 'leg_press', 'pullup', 'deadlift', 'hip_thrust', 'ohp', 'barbell_curl']);
  assert.deepEqual([TRIAD, TRIAD_DAYS], [['squat', 'bench', 'deadlift'], 3]);
  const cfg = Core.mergeCfg(seedRaw());
  assert.deepEqual(targetIds(cfg), TARGETS, 'в примерных данных у целей те же id, что во встроенном; приседаний и становой в справочнике нет');
  assert.deepEqual([cfg.ex.deadlift, targetName(cfg, 'deadlift'), targetName(cfg, 'bench')], [undefined, 'Становая тяга', 'Жим лежа']);
  assert.deepEqual([canTarget(cfg, 'deadlift'), canTarget(cfg, 'bench'), canTarget(cfg, 'bench_light'), canTarget(cfg, 'nope'), canTarget(cfg, null)], [true, true, false, false, false]);
  /* своя становая под своим id — та же цель */
  const raw = seedRaw(); raw.ex.my_dl = { n: 'Становая тяга', pat: 'hinge', m: { hams: 1, glutes: 1, erectors: 0.5 }, gear: 'barbell' };
  const own = Core.mergeCfg(raw);
  assert.deepEqual([targetOf(own, 'deadlift'), triadIds(own)], ['my_dl', ['squat', 'bench', 'my_dl']]);
});

test('пауэрлифтерская тройка, три дня, лимит 80: каждое движение — тяжёлый день 3 × 4 и лёгкий 3 × 8; в каждом дне один тяжёлый и один лёгкий; 26 / 24 / 24 подхода, мышцы 8–10.5', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(3, () => {
    const pr = Core.buildProgram(W, cfg, TRI);
    sound(pr, 80);
    assert.deepEqual([loads(pr), total(pr), span(pr, tracked(cfg))], [[26, 24, 24], 74, '8–10.5']);
    assert.deepEqual([pr.name, pr.triad, pr.focus, pr.strength], ['Сила: пауэрлифтерская тройка', ['squat', 'bench', 'deadlift'], null, true]);
    /* приседаний и становой в справочнике нет: сборка взяла их из встроенного, на штанге */
    assert.deepEqual([pr.create.squat.n, pr.create.squat.gear, pr.create.deadlift.n, pr.create.deadlift.gear], ['Приседания со штангой', 'barbell', 'Становая тяга', 'barbell']);
    /* день начинается тяжёлым днём одного движения, за ним — лёгкий день другого */
    assert.deepEqual(Core.SLOTS.map(sl => pr.slots[sl.id].slice(0, 2).map(e => e.ex + ':' + Core.kindOf(pr.cfg, e.ex))), [['bench:base', 'squat_light:light'], ['squat:base', 'deadlift_light:light'], ['deadlift:base', 'bench_light:light']]);
    for (const sl of Core.SLOTS) assert.equal(pr.slots[sl.id].filter(e => ['base', 'light'].includes(Core.kindOf(pr.cfg, e.ex))).length, 2, sl.n);
    /* подходы движения — от роли («Новая схема», 24 ноября 2026): 3 в тяжёлый день, 3 в лёгкий, всего 6; лёгкий день 3 × 8 на 75% с запасом около 2 считается целым */
    for (const id of TRIAD) {
      assert.deepEqual([Core.waveOf(pr.cfg, id).sets(4), plain(Core.waveOf(pr.cfg, id).pct), plain(Core.lightOf(pr.cfg, id + '_light'))], [DAY_H.sets, { 4: 83 }, DAY_L], id);
      for (const sl of Core.SLOTS) for (const e of pr.slots[sl.id]) if (e.ex === id || e.ex === id + '_light') assert.equal(e.n, undefined, id + ': подходы не от роли');
    }
    assert.deepEqual([pr.after.ps.chest, pr.after.ps.quads], [6, 6]);
    assert.deepEqual(pr.goals, { squat: 'auto', bench: 'auto', deadlift: 'auto' });
    /* остальные базовые справочника — обычные упражнения: жим ногами сборка убрала (квадрицепсу хватает приседаний), подтягивания — по двойной прогрессии */
    assert.deepEqual(['leg_press', 'pullup'].map(id => [pr.cfg.ex[id].mode, pr.cfg.ex[id].stored]), [[undefined, 'cycle'], [undefined, 'cycle']]);
    assert.deepEqual([daysWith(pr, 'leg_press'), daysWith(pr, 'pullup')], [[], ['fri']]);
    assert.ok(pr.notes.find(n => n.t === 'Убрано из программы')!.x!.startsWith('Жим ногами (день 2)'), titles(pr).join(' | '));
    for (const t of ['Тройка: Приседания со штангой, Жим лежа и Становая тяга — каждое два раза в неделю', 'Подтягивания — по двойной прогрессии', 'Приседания со штангой — в программу в день 2', 'Становая тяга — в программу в день 3']) assert.ok(titles(pr).includes(t), t + ' | ' + titles(pr).join(' | '));
    /* справочник профиля сборка не трогает */
    assert.deepEqual([cfg.ex.squat, cfg.ex.leg_press.mode], [undefined, 'cycle']);
  });
});

test('тройка — только с трёх дней: при двух её нет в списке, «Сила» по кнопке — первое упражнение списка; «Все базовые» с днями «День N» не предлагаются', () => {
  const lifts = TARGETS.slice();
  assert.deepEqual([triadOk(), forceMode(['bench']), lostMode('s', ['bench']), lostMode('s', []), modeAfter('s', [])], [false, 's', false, true, 'even'], 'таблица дней эталона: как раньше');
  withDays(2, () => {
    assert.deepEqual([triadOk(), forceMode(lifts), lostMode('p', lifts), modeAfter('p', lifts)], [false, 's:bench', true, 's:bench']);
    assert.deepEqual([lostMode('s', lifts), modeAfter('s', lifts)], [true, 's:bench'], 'силовой режим «все базовые», принятый раньше, остаётся «Силой»');
  });
  for (const n of [3, 4]) withDays(n, () => {
    assert.deepEqual([triadOk(), forceMode(lifts), lostMode('p', lifts), lostMode('s', lifts), modeAfter('s', lifts)], [true, 'p', false, true, 'p'], n + ' дня');
    assert.deepEqual([lostMode('s:deadlift', lifts), lostMode('s:nope', lifts), modeAfter('s:nope', lifts), lostMode('l:nope', lifts), modeAfter('l:nope', lifts)], [false, true, 'p', true, 'even'], n + ' дня');
  });
  /* под «Силой» с днями «День N» переключателя «Остальные базовые» нет: на лимит по времени он не влияет */
  withDays(3, () => assert.deepEqual([modeKey({ focus: 's:bench', others: 'grow' }), modeKey({ focus: 'p', others: 'grow' }), modeKey({ focus: 'l:bench', others: 'grow' })], ['s:bench', 'p', 'l:bench|grow']));
  assert.equal(modeKey({ focus: 's:bench', others: 'grow' }), 's:bench|grow');
});

test('сила в одном движении, становая тяга, три дня, лимит 80: тяжёлый, лёгкий и средний день, мышцы цели 13–14 — в полтора раза выше остальных 8–10; другие базовые — обычные упражнения', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW(), aim = ['hams', 'glutes'];
  withDays(3, () => {
    const pr = Core.buildProgram(W, cfg, Object.assign({ focus: 'deadlift' }, STRONG80));
    sound(pr, 80);
    assert.deepEqual([loads(pr), total(pr), pr.name, pr.focus, pr.strength, pr.triad], [[23, 29, 26], 78, 'Сила: становая тяга', 'deadlift', true, null]);
    /* «Новая схема» (24 ноября 2026): за тяжёлым днём по кругу — лёгкий, за ним — средний: неделя 6–4–8 повторов */
    assert.deepEqual([daysWith(pr, 'deadlift'), daysWith(pr, 'deadlift_light'), daysWith(pr, 'deadlift_mid')], [['wed'], ['fri'], ['mon']]);
    assert.deepEqual([span(pr, aim), span(pr, tracked(cfg).filter(m => !aim.includes(m)))], ['13–14', '8–10']);
    assert.deepEqual([Object.keys(pr.create).slice(0, 3), pr.goals], [['deadlift', 'deadlift_light', 'deadlift_mid'], { deadlift: 'auto' }]);
    assert.deepEqual([pr.create.deadlift_mid, plain(Core.lightOf(pr.cfg, 'deadlift_mid')), plain(Core.lightOf(pr.cfg, 'deadlift_light'))], [{ n: 'Становая тяга — средний день', mode: 'light', of: 'deadlift', mid: true, pat: 'hinge', m: pr.create.deadlift.m }, DAY_M, DAY_L]);
    assert.equal(pr.notes.find(n => n.t === 'Сила: Становая тяга — три раза в неделю')!.x!.split('. ').slice(0, 4).join('. '), 'Тяжёлый день — в день 2: 3 × 4 одним весом, вес решает запас в последнем подходе. Лёгкий день — в день 3: 3 × 8 на 75%; средний — в день 1: 3 × 6 на 79%. Во всех днях запас около 2 повторов, вес идёт за тяжёлым днём сам. Всего 9 подходов движения в неделю');
    assert.deepEqual(['bench', 'leg_press', 'pullup'].map(id => pr.cfg.ex[id].mode), [undefined, undefined, undefined]);
    for (const t of ['Сила: Становая тяга — три раза в неделю', 'Мышцы цели — от 13 до 14, остальные — от 8 до 10 подходов в неделю', 'Жим лежа, Жим ногами и Подтягивания — по двойной прогрессии', 'Становая тяга — в программу в день 2']) assert.ok(titles(pr).includes(t), t + ' | ' + titles(pr).join(' | '));
    const why = pr.notes.find(n => n.t.endsWith('— по двойной прогрессии'))!.x!;
    assert.ok(why.startsWith('Под «Силой» по проценту идёт только цель. Остальные базовые — обычные многосуставные: 6–10 повторов с запасом 1'), why);
    assert.ok(!titles(pr).some(t => t.startsWith('Не в программе')), 'под «Силой» базовыми не жертвуют');
  });
});

test('все восемь движений «Силы», три дня, лимит 80: подходы по дням, мышцы цели и остальные, самая длинная тренировка — как в docs/04, раздел 3.3в', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW(), ms = tracked(cfg);
  const want: Record<string, [number, number[], string, string, string]> = {
    bench: [78, [27, 26, 25], '13–13', '8–10.5', '1 ч 30 мин'],
    squat: [76, [25, 25, 26], '12–12', '8–10', '1 ч 30 мин'],
    leg_press: [78, [25, 28, 25], '14–14', '8–10', '1 ч 40 мин'],
    pullup: [78, [29, 28, 21], '12–12', '8–11', '1 ч 30 мин'],
    deadlift: [78, [23, 29, 26], '13–14', '8–10', '1 ч 40 мин'],
    hip_thrust: [77, [23, 27, 27], '11.5–11.5', '8–10', '1 ч 35 мин'],
    ohp: [77, [23, 29, 25], '14–14', '8–10.5', '1 ч 40 мин'],
    barbell_curl: [80, [26, 29, 25], '14–14', '8–10', '1 ч 40 мин']
  };
  withDays(3, () => {
    for (const t of TARGETS) {
      const pr = Core.buildProgram(W, cfg, Object.assign({ focus: t }, STRONG80));
      sound(pr, 80);
      const aims = Object.keys(pr.cfg.ex[t].m).filter(m => pr.cfg.ex[t].m[m] === 1 && ms.includes(m));
      const longest = Core.fmtDur(Math.max(...Core.SLOTS.map(sl => Core.estMinutes(pr.cfg, pr.slots[sl.id]))));
      assert.deepEqual([total(pr), loads(pr), span(pr, aims), span(pr, ms.filter(m => !aims.includes(m))), longest], want[t], t);
      assert.deepEqual([daysWith(pr, t).length, daysWith(pr, t + '_light').length, daysWith(pr, t + '_mid').length], t === 'barbell_curl' ? [1, 1, 0] : [1, 1, 1], t + ': тяжёлый, лёгкий и средний день; у изоляции среднего нет');
    }
  });
});

test('изоляция в силовой роли, бицепс со штангой: два дня — тяжёлый 3 × 6 на 79% по запасу и лёгкий 3 × 10 на 71%; бицепс 14, остальные 8–10', () => {
  assert.deepEqual([ISO, ISO_LIGHT], [{ pct: 79, reps: 6, sets: 3, days: 2 }, { pct: 71, reps: 10, sets: 3 }]);
  const raw = seedRaw(), cfg = Core.mergeCfg(plain(raw)), W = seedW();
  assert.equal(isoLift(cfg, 'barbell_curl'), false, 'с таблицей дней эталона изоляции в силовой роли нет');
  withDays(3, () => {
    const pr = Core.buildProgram(W, cfg, Object.assign({ focus: 'barbell_curl' }, STRONG80));
    sound(pr, 80);
    assert.deepEqual([loads(pr), total(pr), pr.name], [[26, 29, 25], 80, 'Сила: бицепс со штангой стоя']);
    assert.deepEqual([daysWith(pr, 'barbell_curl'), daysWith(pr, 'barbell_curl_light')], [['wed'], ['mon']]);
    assert.deepEqual([span(pr, ['biceps']), span(pr, tracked(cfg).filter(m => m !== 'biceps'))], ['14–14', '8–10']);
    assert.deepEqual([isoLift(pr.cfg, 'barbell_curl'), isoLift(pr.cfg, 'barbell_curl_light'), isoLift(pr.cfg, 'bench'), isoLift(cfg, 'barbell_curl')], [true, true, false, false]);
    assert.ok(titles(pr).includes('Сила: Бицепс со штангой стоя — два раза в неделю'), titles(pr).join(' | '));
    /* принятая программа: в день 2 — тяжёлый день 3 × 6 на 79%, в день 1 — лёгкий 3 × 10 на 71% */
    const acc = Core.mergeCfg(acceptAs(raw, pr, '2025-11-13'));
    const heavy = Core.plan(W, acc, 'wed', '2025-11-17').items.find(it => it.ex === 'barbell_curl')!, light = Core.plan(W, acc, 'mon', '2025-11-17').items.find(it => it.ex === 'barbell_curl_light')!;
    assert.deepEqual([heavy.sets.length, plain(heavy.cyc)], [3, { pct: 79, reps: 6 }]);
    assert.deepEqual([light.sets.length, plain(light.cyc)], [3, { pct: 71, reps: 10 }]);
    /* на примерных данных дни выходят разными весами — 30 и 27.5 кг; при прежних 79% и 74% разница была меньше шага штанги (docs/04, раздел 3.3в) */
    assert.deepEqual([heavy.sets.map(x => x.w), light.sets.map(x => x.w)], [[30, 30, 30], [27.5, 27.5, 27.5]]);
    /* «Гибрид» вокруг изоляции — тоже 3 × 6; вокруг базового — 3 × 4 */
    assert.ok(mixText(3, true).includes('3 × 6') && mixText(3).includes('3 × 4'));
  });
  assert.equal(soloText(2, true), 'Оно идёт в каждой тренировке: тяжёлый день 3 × 6 с весом по запасу и лёгкий день.');
  assert.equal(soloText(3, true), 'Оно идёт два дня из трёх: тяжёлый день 3 × 6 с весом по запасу и лёгкий день.');
  assert.equal(soloText(4, true), 'Оно идёт два дня из четырёх: тяжёлый день 3 × 6 с весом по запасу и лёгкий день.');
  /* не изоляция: с днями «День N» — тяжёлый, лёгкий и средний день */
  withDays(3, () => assert.deepEqual([soloText(2), soloText(3), soloText(4)], ['Оно идёт в каждой тренировке: тяжёлый день 3 × 4 с весом по запасу и лёгкий день.', 'Оно идёт в каждой тренировке: тяжёлый день 3 × 4 с весом по запасу, лёгкий и средний.', 'Оно идёт три дня из четырёх: тяжёлый день 3 × 4 с весом по запасу, лёгкий и средний.']));
});

test('цели нет в справочнике: сборка берёт её из встроенного вместе со снарядом — подтягивания на своём снаряде с шагом 1 кг; справочник профиля не меняется', () => {
  const raw = seedRaw(); delete raw.ex.pullup;
  const cfg = Core.mergeCfg(raw), W = seedW().map(w => Object.assign({}, w, { items: w.items.filter(it => it.ex !== 'pullup') }));
  withDays(3, () => {
    const pr = Core.buildProgram(W, cfg, Object.assign({ focus: 'pullup' }, STRONG80));
    sound(pr, 80);
    assert.deepEqual([pr.create.pullup.gear, pr.create.pullup.mode, plain(pr.cfg.gear.g_pullup), cfg.gear.g_pullup, cfg.ex.pullup], ['g_pullup', 'cycle', { n: 'Подтягивания', step: 1, own: true }, undefined, undefined]);
    assert.deepEqual([Core.stepOf(W, pr.cfg, 'pullup'), daysWith(pr, 'pullup'), daysWith(pr, 'pullup_light'), daysWith(pr, 'pullup_mid'), loads(pr)], [1, ['fri'], ['mon'], ['wed'], [29, 28, 21]]);
    assert.ok(titles(pr).includes('Подтягивания — в программу в день 3') && titles(pr).includes('Сила: Подтягивания — три раза в неделю'), titles(pr).join(' | '));
    /* принятая программа: подтягивания и их снаряд — в справочнике, шаг тот же */
    const acc = Core.mergeCfg(acceptAs(raw, pr, '2025-11-13'));
    assert.deepEqual([acc.ex.pullup.gear, acc.gear.g_pullup.step, Core.stepOf(W, acc, 'pullup')], ['g_pullup', 1, 1]);
  });
});

test('лёгкий и средний день новой цели — 75% и 79% от расчётного максимума с первой недели; «не легче самого лёгкого веса в журнале» — только там, где в вес входит тело', () => {
  const raw = seedRaw(); delete raw.ex.pullup;
  const W = seedW().map(w => Object.assign({}, w, { items: w.items.filter(it => it.ex !== 'pullup') }));
  /* одна тяжёлая тренировка цели, которой раньше не было: 3 × 4 одним весом, запас 2 в последнем подходе */
  const heavy = (ex: string, kg: number, slot: string) => Core.fromDoc('2025-11-12', { date: '2025-11-12', slot, items: [{ ex, cyc: '83/4', sets: [1, 1, 2].map(q => kg + 'x4@' + q).join(' ') }] });
  withDays(3, () => {
    const dl = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'deadlift' }, STRONG80));
    const a1 = Core.mergeCfg(acceptAs(raw, dl, '2025-11-12')), W1 = Core.sortW(W.concat(heavy('deadlift', 120, 'fri')));
    const l1 = Core.planLight(W1, a1, 'deadlift_light', null), m1 = Core.planLight(W1, a1, 'deadlift_mid', null);
    assert.deepEqual([Core.fmt(l1.tm!, 1), l1.w, l1.sets, l1.reps], ['144.6', 107.5, 3, 8], 'становая: 120 / 0.83 = 144.6, 75% — 108.5, до шага штанги — 107.5 кг, хотя легче 120 её ещё не записывали');
    assert.deepEqual([m1.w, m1.sets, m1.reps], [115, 3, 6], 'средний день: 79% от 144.6 — 114.2, до шага штанги — 115 кг');
    /* без подтягиваний в справочнике тяжёлый день становой — день 3, за ним по кругу лёгкий (день 1) и средний (день 2) */
    assert.deepEqual([daysWith(dl, 'deadlift'), daysWith(dl, 'deadlift_light'), daysWith(dl, 'deadlift_mid')], [['fri'], ['mon'], ['wed']]);
    assert.equal(Core.plan(W1, a1, 'mon', '2025-11-17').items.find(it => it.ex === 'deadlift_light')!.sets[0].w, 107.5, 'в плане дня — тот же вес');
    assert.equal(Core.plan(W1, a1, 'wed', '2025-11-19').items.find(it => it.ex === 'deadlift_mid')!.sets[0].w, 115);
    const pu = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'pullup' }, STRONG80));
    const a2 = Core.mergeCfg(acceptAs(raw, pu, '2025-11-12')), W2 = Core.sortW(W.concat(heavy('pullup', 80, 'fri')));
    const l2 = Core.planLight(W2, a2, 'pullup_light', null), m2 = Core.planLight(W2, a2, 'pullup_mid', null);
    assert.deepEqual([Core.fmt(l2.tm!, 1), l2.w, m2.w], ['96.4', 80, 80], 'подтягивания: 75% — 72 кг и 79% — 76 кг, но в вес входит тело, и легче 80 их не записывали');
  });
});

test('средний день — только у «Силы: <движение>»: в «Гибриде» он уходит с заметкой, а программа с двумя лёгкими днями, принятая до «Новой схемы», получает лёгкий и средний', () => {
  const raw = seedRaw(), W = seedW();
  withDays(3, () => {
    const dl = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'deadlift' }, STRONG80)), r = acceptAs(raw, dl, '2025-11-13');
    /* «Гибрид» вокруг той же становой: лёгкий день остаётся, среднего нет */
    const mix = Core.buildProgram(W, Core.mergeCfg(plain(r)), { focus: 'deadlift' });
    sound(mix, 100);
    assert.deepEqual([daysWith(mix, 'deadlift').length, daysWith(mix, 'deadlift_light').length, daysWith(mix, 'deadlift_mid')], [1, 1, []]);
    const gone = mix.notes.find(n => n.t === 'Убрано: Становая тяга — средний день');
    assert.equal(gone && gone.x, 'Средний день есть только у упражнения, выбранного целью «Силы».', titles(mix).join(' | '));
    /* программа «Силы» с двумя лёгкими днями (так её собирали до 24 ноября 2026): лёгкий день, что идёт вторым после тяжёлого, становится средним */
    const old = plain(r); delete old.ex.deadlift_mid;
    const slots = (old.program as { slots: ProgSlots }).slots;
    for (const id of Object.keys(slots)) slots[id] = slots[id].map(e => e.ex === 'deadlift_mid' ? { ex: 'deadlift_light' } : e);
    const again = Core.buildProgram(W, Core.mergeCfg(old), Object.assign({ focus: 'deadlift' }, STRONG80));
    sound(again, 80);
    assert.deepEqual([daysWith(again, 'deadlift'), daysWith(again, 'deadlift_light'), daysWith(again, 'deadlift_mid'), again.create.deadlift_mid && again.create.deadlift_mid.mid], [['wed'], ['fri'], ['mon'], true]);
    assert.ok(again.slots.mon.find(e => e.ex === 'deadlift_mid')!.isNew, 'средний день помечен новым');
  });
});

test('«Гибрид» вокруг цели, которой нет в справочнике: приседания по запасу и лёгкий день, остальные базовые на поддержании, третье базовое уходит — в тренировке одно базовое', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(3, () => {
    const pr = Core.buildProgram(W, cfg, { focus: 'squat', budget: 100 });
    sound(pr, 100);
    assert.deepEqual([loads(pr), total(pr), span(pr, tracked(cfg)), pr.name], [[30, 31, 30], 91, '10–13', 'Пауэрбилдинг: приседания со штангой']);
    assert.deepEqual([daysWith(pr, 'squat'), daysWith(pr, 'squat_light'), pr.dropped, pr.goals], [['fri'], ['mon'], ['pullup'], { bench: 'hold', leg_press: 'hold', squat: 'auto' }]);
    assert.deepEqual(['bench', 'leg_press'].map(id => pr.cfg.ex[id].mode), ['cycle', 'cycle'], 'под «Гибридом» остальные базовые — по проценту, как ставит переключатель');
    for (const t of ['Не в программе: Подтягивания', 'Приседания со штангой — в программу в день 3', 'Жим лежа и Жим ногами — поддержание']) assert.ok(titles(pr).includes(t), t + ' | ' + titles(pr).join(' | '));
  });
});

test('принятая программа: роли читаются из неё, а хранилище не переписывается; сразу после «Принять» сборка та же; «Масса» читает справочник, как он сохранён', () => {
  const raw = seedRaw(), W = seedW();
  const r = withDays(3, () => acceptAs(raw, Core.buildProgram(W, Core.mergeCfg(plain(raw)), TRI), '2025-11-13')), saved = JSON.stringify(r);
  assert.deepEqual([r.program!.strength, r.program!.triad, r.ex.leg_press.mode, r.ex.squat.mode], [true, ['squat', 'bench', 'deadlift'], 'cycle', undefined], 'в справочнике роли нет');
  /* с таблицей дней эталона ролей нет: справочник — как сохранён */
  const ref = Core.mergeCfg(plain(r));
  assert.deepEqual([programRoles(ref.program), ref.ex.leg_press.mode, ref.ex.squat.mode], [null, 'cycle', undefined]);
  withDays(3, () => {
    const cfg = Core.mergeCfg(plain(r));
    assert.deepEqual(programRoles(cfg.program), { on: ['squat', 'bench', 'deadlift'], plain: true });
    assert.deepEqual(['squat', 'bench', 'deadlift', 'leg_press', 'pullup'].map(id => [cfg.ex[id].mode, cfg.ex[id].stored]), [['cycle', ''], ['cycle', undefined], ['cycle', ''], [undefined, 'cycle'], [undefined, 'cycle']]);
    const st = asStored(cfg);
    assert.deepEqual([st.ex.leg_press.mode, st.ex.squat.mode, 'stored' in st.ex.leg_press, cfg.ex.leg_press.mode], ['cycle', undefined, false, undefined], 'asStored — копия, cfg не трогает');
    /* план дня 1: тяжёлый жим 3 × 4 на 83%, лёгкий день приседаний 3 × 8 на 75%, остальное — по типу упражнения */
    const items = Core.plan(W, cfg, 'mon', '2025-11-17').items;
    assert.deepEqual(items.slice(0, 2).map(it => [it.ex, it.sets.length, plain(it.cyc)]), [['bench', 3, { pct: 83, reps: 4 }], ['squat_light', 3, { pct: 75, reps: 8 }]]);
    assert.deepEqual(items.find(it => it.ex === 'lat_pulldown')!.range, [6, 10]);
    const pull = Core.plan(W, cfg, 'fri', '2025-11-21').items.find(it => it.ex === 'pullup')!;
    assert.deepEqual([pull.cyc || null, pull.range, pull.sets.length], [null, [6, 10], 4], 'подтягивания под «Силой» — обычное многосуставное, четыре подхода');
    const again = Core.buildProgram(W, cfg, TRI);
    assert.deepEqual([again.same, loads(again)], [true, [26, 24, 24]]);
    /* «Масса»: роли сняты, базовые справочника — снова базовые (по двойной прогрессии 6–10), приседания, добавленные тройкой, — обычное упражнение */
    const mass = Core.buildProgram(W, cfg, {});
    assert.deepEqual([mass.same, mass.cfg.ex.leg_press.mode, mass.cfg.ex.pullup.mode, mass.cfg.ex.squat.mode], [false, 'cycle', 'cycle', undefined]);
    /* «Гибрид» вокруг жима: цель по запасу, остальные базовые справочника — на поддержании (жима ногами в программе тройки нет); лёгкие дни тройки уходят */
    const pb = Core.buildProgram(W, cfg, { focus: 'bench' });
    assert.deepEqual([pb.cfg.ex.bench.mode, pb.cfg.ex.pullup.mode, plain(pb.goals), daysWith(pb, 'squat_light'), daysWith(pb, 'deadlift_light')], ['cycle', 'cycle', { bench: 'auto', pullup: 'hold' }, [], []]);
  });
  assert.equal(JSON.stringify(r), saved, 'принятая программа изменилась от чтения');
});
