/* Выводы аудита методики (решение владельца, 25 ноября 2026): rules.ts, strength.ts, plan.ts, program.ts, adapt.ts; разбор и источники — docs/03, раздел 16.
   Всё — с днями «День 1…N»; с таблицей дней эталона — как в эталоне. Числа — на встроенном справочнике и на примерных данных из data/. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { DAY_L, DL_LIGHT, ISO_LIGHT } from '../src/core/strength.ts';
import { HEAVY, MANY_EX, RIR_CHECK, byPct, heavyStep, lightShift, rirOf, stretchOf } from '../src/core/rules.ts';
import type { BuildOpts, ExDef, ItemDoc, ProgSlots, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; ignore?: Record<string, number>; rir?: number; program?: Record<string, unknown> };
type Built = ReturnType<typeof Core.buildProgram>;
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedRaw = (): Raw => readJson('data/config.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
const starter = (): Raw => plain(withStarter(null)) as unknown as Raw;
const ids = (pr: Built) => [...new Set(Core.SLOTS.flatMap(sl => pr.slots[sl.id].map(e => e.ex)))];
const daysWith = (pr: Built, id: string) => Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)).map(sl => sl.id);
const STRONG80: BuildOpts = { strength: true, budget: 80 };
/* так программу принимает экран (acceptProgram), коротко: новые упражнения, отметки, дни */
function acceptAs(raw: Raw, pr: Built, since: string): Raw {
  const r = plain(raw);
  for (const [id, def] of Object.entries(plain(pr.create))) if (!r.ex[id]) r.ex[id] = def;
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  const slots: ProgSlots = {}; for (const sl of Core.SLOTS) slots[sl.id] = pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', since, made: since, slots }, pr.strength ? { strength: true, lean: true } : {});
  return r;
}
const one = (date: string, slot: string, item: ItemDoc) => Core.fromDoc(date, { date, slot, items: [item] });

test('предплечья вне расчёта по умолчанию, хват — половина подхода в тягах, подтягиваниях, становой и сгибаниях на бицепс; ягодицы в приседаниях — основные', () => {
  const ref = Core.mergeCfg(starter());
  assert.equal(ref.ignore.forearms, undefined, 'с таблицей дней эталона предплечья в расчёте, как в эталоне');
  assert.deepEqual(ref.ex.squat.m, { quads: 1, glutes: 0.5 });
  withDays(3, () => {
    const c = Core.mergeCfg(starter());
    assert.deepEqual(Object.keys(c.ignore).sort(), ['abs', 'calves', 'erectors', 'forearms']);
    for (const id of ['pullup', 'lat_pulldown', 'pulldown_cable', 'row_machine', 'seated_row', 'barbell_row', 'db_row', 'tbar_row', 'deadlift', 'rdl', 'db_rdl', 'barbell_curl', 'db_curl', 'cable_curl', 'preacher_curl'])
      assert.equal(c.ex[id].m.forearms, 0.5, id);
    for (const id of ['leg_curl_lying', 'leg_curl_seated', 'tri_pushdown', 'bench', 'squat']) assert.equal(c.ex[id].m.forearms, undefined, id);
    assert.deepEqual([c.ex.squat.m, c.ex.leg_press.m, c.ex.hack_squat.m], [{ quads: 1, glutes: 1 }, { quads: 1, glutes: 0.5 }, { quads: 1, glutes: 0.5 }], 'жим ногами и гакк — как были');
    /* своя карта атлета и предплечья, включённые в расчёт, — как записано */
    const r = starter(); r.ex.lat_pulldown = Object.assign({}, r.ex.lat_pulldown, { m: { lats: 1, biceps: 1 } }); r.ignore = { forearms: 0 };
    const own = Core.mergeCfg(r);
    assert.deepEqual([own.ex.lat_pulldown.m, own.ignore.forearms], [{ lats: 1, biceps: 1 }, undefined]);
    /* новое упражнение по названию — с той же картой */
    assert.deepEqual([Core.guessEx('Тяга гантели одной рукой')!.m.forearms, Core.guessEx('Приседания с паузой')!.m.glutes], [0.5, 1]);
  });
});

test('сборка не ставит сгибания кистей и берёт растянутые варианты: сгибания ног сидя раньше лёжа, трицепс из-за головы выше в замене', () => {
  withDays(3, () => {
    const c = Core.mergeCfg(starter()), pr = Core.buildProgram([], c, { budget: 100 }), got = ids(pr);
    assert.ok(!got.some(id => (pr.cfg.ex[id].m.forearms || 0) >= 1), 'упражнения, где предплечья основные, сборка не ставит: ' + got.join(', '));
    assert.equal(pr.after.pv.forearms > 0, true, 'косвенная работа хвата остаётся');
    assert.ok(got.includes('leg_curl_seated') && !got.includes('leg_curl_lying'), 'бицепс бедра — сидя: ' + got.join(', '));
    assert.deepEqual([stretchOf(c.ex.leg_curl_seated), stretchOf(c.ex.tri_overhead), stretchOf(c.ex.leg_curl_lying), stretchOf(c.ex.tri_pushdown)], [1, 1, 0, 0]);
    assert.equal(Core.swapsFor(c, 'leg_curl_lying').same[0].id, 'leg_curl_seated');
    assert.equal(Core.swapsFor(c, 'tri_pushdown').same[0].id, 'tri_overhead');
  });
  assert.equal(stretchOf(Core.mergeCfg(starter()).ex.leg_curl_seated), 0, 'с таблицей дней эталона порядок прежний');
});

test('«Гибрид»: остальные базовые как подсобка — двойная прогрессия; «Поддержание» — выбором', () => {
  const raw = seedRaw(), W = seedW();
  withDays(3, () => {
    const plainB = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench', others: 'plain', budget: 100 });
    const hold = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench', others: 'hold', budget: 100 });
    assert.deepEqual([plainB.others, hold.others], ['plain', 'hold']);
    const a = Core.mergeCfg(acceptAs(raw, plainB, '2025-11-12')), b = Core.mergeCfg(acceptAs(raw, hold, '2025-11-12'));
    assert.deepEqual([byPct(a, 'bench'), byPct(a, 'leg_press'), byPct(a, 'pullup')], [true, false, false], 'в силовой роли — только цель');
    assert.deepEqual([byPct(b, 'leg_press'), byPct(b, 'pullup')], [true, true]);
  });
});

test('«Сила: <движение>» — два дня, тяжёлый и лёгкий, без среднего; лёгкий день становой — 3 × 6 на 79%, у изоляции — 3 × 10 на 71%', () => {
  const raw = seedRaw(), W = seedW();
  withDays(3, () => {
    for (const f of ['deadlift', 'bench', 'squat', 'barbell_curl']) {
      const pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: f }, STRONG80));
      assert.deepEqual([daysWith(pr, f).length, daysWith(pr, f + '_light').length, daysWith(pr, f + '_mid').length, !!pr.create[f + '_mid']], [1, 1, 0, false], f);
    }
    const dl = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'deadlift' }, STRONG80));
    const cu = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'barbell_curl' }, STRONG80));
    const be = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'bench' }, STRONG80));
    assert.deepEqual([plain(Core.lightOf(dl.cfg, 'deadlift_light')), plain(Core.lightOf(cu.cfg, 'barbell_curl_light')), plain(Core.lightOf(be.cfg, 'bench_light'))], [DL_LIGHT, ISO_LIGHT, DAY_L]);
    assert.deepEqual(DL_LIGHT, { pct: 79, reps: 6, sets: 3 });
    const tri = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { strength: true, triad: true, budget: 80 });
    assert.deepEqual([plain(Core.lightOf(tri.cfg, 'deadlift_light')), plain(Core.lightOf(tri.cfg, 'squat_light'))], [DL_LIGHT, DAY_L], 'в тройке — так же');
  });
});

test('тяжёлый день: запас от 4 — сразу несколько шагов, не больше 10%; шаг больше 5% веса — сначала повторы; не закрыл на 3 × 5 — на повтор назад', () => {
  assert.deepEqual(heavyStep(200, 2.5, 4, 4, 'up', 7), { w: 220, reps: 4, verdict: 'up', steps: 8 }, 'жим ногами: 10 шагов по запасу, но не больше 10% — 8');
  assert.deepEqual(heavyStep(100, 2.5, 4, 4, 'up', 5), { w: 107.5, reps: 4, verdict: 'up', steps: 3 }, 'запас 5: три повтора сверх двух — по 2.5%');
  assert.deepEqual(heavyStep(100, 2.5, 4, 4, 'up', 2), { w: 102.5, reps: 4, verdict: 'up', steps: 1 });
  assert.deepEqual(heavyStep(100, 2.5, 4, 4, 'up', null), { w: 102.5, reps: 4, verdict: 'up', steps: 1 }, 'запас не отмечен — шаг, как раньше');
  assert.deepEqual(heavyStep(100, 2.5, 4, 4, 'hold', 1), { w: 100, reps: 4, verdict: 'hold', steps: 0 });
  assert.deepEqual(heavyStep(100, 2.5, 4, 4, 'down', 0), { w: 95, reps: 4, verdict: 'down', steps: -1 });
  assert.deepEqual([heavyStep(30, 2.5, 4, 4, 'up', 2), heavyStep(30, 2.5, 5, 4, 'up', 2), heavyStep(30, 2.5, 6, 4, 'up', 2)].map(x => [x.w, x.reps, x.verdict]),
    [[30, 5, 'reps'], [30, 6, 'reps'], [32.5, 4, 'up']], 'бицепс 30 кг, шаг 8%: 3 × 4 → 3 × 5 → 3 × 6, потом шаг');
  assert.deepEqual(heavyStep(30, 2.5, 5, 4, 'down', 0), { w: 30, reps: 4, verdict: 'back', steps: 0 });
  assert.equal(HEAVY.max, 0.1);
  /* в плане: жим лежа под «Силой», 3 × 4 по 100 кг, запас в последнем подходе 6 */
  const raw = seedRaw(), W = seedW();
  withDays(3, () => {
    const pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'bench' }, STRONG80)), acc = Core.mergeCfg(acceptAs(raw, pr, '2025-11-12'));
    const sl = daysWith(pr, 'bench')[0], W1 = Core.sortW(W.concat(one('2025-11-12', sl, { ex: 'bench', cyc: '83/4', sets: '100x4@1 100x4@2 100x4@6' })));
    const c = Core.planCycle(W1, acc, 'bench', '2025-11-17');
    assert.deepEqual([c.w, c.reps, c.verdict, c.steps], [110, 4, 'up', 4]);
  });
});

test('лёгкий день слушает запас: два раза подряд 4 и больше — на шаг выше, 0 — на шаг ниже, не дальше двух шагов; вес, поправленный руками, сдвиг снимает', () => {
  assert.deepEqual([lightShift([]), lightShift([{ off: 0, rz: 4, closed: true }]), lightShift([{ off: 0, rz: 4, closed: true }, { off: 0, rz: 5, closed: true }])].map(x => [x.steps, x.move]), [[0, 0], [0, 0], [1, 1]]);
  assert.deepEqual([lightShift([{ off: 0, rz: 5, closed: true }, { off: 1, rz: 5, closed: true }]), lightShift([{ off: 1, rz: 0, closed: true }]), lightShift([{ off: 1, rz: 3, closed: false }]), lightShift([{ off: 2, rz: 6, closed: true }, { off: 2, rz: 6, closed: true }])].map(x => [x.steps, x.move]),
    [[1, 0], [0, -1], [0, -1], [2, 0]], 'после шага вверх — снова два раза; не дальше двух шагов');
  const raw = seedRaw(), W = seedW();
  withDays(3, () => {
    const pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), Object.assign({ focus: 'bench' }, STRONG80)), acc = Core.mergeCfg(acceptAs(raw, pr, '2025-11-12'));
    const hs = daysWith(pr, 'bench')[0], ls = daysWith(pr, 'bench_light')[0];
    const W1 = Core.sortW(W.concat(one('2025-11-12', hs, { ex: 'bench', cyc: '83/4', sets: '100x4@2 100x4@2 100x4@2' })));
    const L0 = Core.planLight(W1, acc, 'bench_light', null), tm = +L0.tm!.toFixed(2);
    assert.deepEqual([L0.w, L0.steps, L0.move], [90, 0, 0], '75% от 120.5 — 90 кг');
    const light = (date: string, w: number, q: number, withTm = true) => one(date, ls, Object.assign({ ex: 'bench_light', cyc: '75/8', sets: [2, 2, q].map(x => w + 'x8@' + x).join(' ') }, withTm ? { tm } : {}));
    const W2 = Core.sortW(W1.concat(light('2025-11-13', 90, 4), light('2025-11-14', 90, 5)));
    const L1 = Core.planLight(W2, acc, 'bench_light', null);
    assert.deepEqual([L1.w, L1.steps, L1.move], [92.5, 1, 1]);
    const W3 = Core.sortW(W2.concat(light('2025-11-15', 92.5, 3)));
    assert.deepEqual([Core.planLight(W3, acc, 'bench_light', null).w, Core.planLight(W3, acc, 'bench_light', null).move], [92.5, 0], 'сдвиг держится');
    const W4 = Core.sortW(W3.concat(light('2025-11-16', 92.5, 0)));
    assert.deepEqual([Core.planLight(W4, acc, 'bench_light', null).w, Core.planLight(W4, acc, 'bench_light', null).move], [90, -1]);
    const W5 = Core.sortW(W2.concat(light('2025-11-15', 85, 3, false)));
    assert.equal(Core.planLight(W5, acc, 'bench_light', null).w, 90, 'вес, поправленный руками, — снова доля от максимума');
  });
});

test('запас 2 в многосуставных со свободным весом: штанга, кроме моста и гиперэкстензии, и тяги от пола с гантелями; профиль с запасом 2 — как раньше', () => {
  const ref = Core.mergeCfg(starter());
  assert.equal(rirOf(ref, 'squat'), 1, 'с таблицей дней эталона — запас профиля');
  withDays(3, () => {
    const c = Core.mergeCfg(starter()), two = Object.keys(c.ex).filter(id => rirOf(c, id) === 2).sort();
    assert.deepEqual(two, ['barbell_row', 'bench', 'close_grip_bench', 'db_rdl', 'deadlift', 'incline_bench', 'ohp', 'rdl', 'squat', 'tbar_row'].filter(id => c.ex[id]).sort());
    assert.deepEqual(['hip_thrust', 'back_ext', 'leg_press', 'lat_pulldown', 'barbell_curl', 'db_bench', 'pullup', 'lunge'].map(id => rirOf(c, id)), [1, 1, 1, 1, 1, 1, 1, 1]);
    const r = starter(); r.rir = 2;
    const c2 = Core.mergeCfg(r);
    assert.deepEqual([rirOf(c2, 'squat'), rirOf(c2, 'leg_press')], [2, 2]);
    /* первый вес от названного максимума: в приседаниях с запасом 2, в жиме ногами — с запасом 1 */
    const r3 = starter(); r3.ex.squat = Object.assign({}, r3.ex.squat, { max: 100 }); r3.ex.leg_ext = Object.assign({}, r3.ex.leg_ext, { max: 100 });
    const c3 = Core.mergeCfg(r3);
    assert.deepEqual([Core.startWeight([], c3, 'squat', [8, 12]), Core.startWeight([], c3, 'leg_ext', [8, 12])], [70, 72.5], '100 / (1 + (10 + 2) / 30) = 71.4 → 70; 100 / (1 + 11 / 30) = 73.2 → 72.5');
  });
});

test('проверка запаса: журнал старше четырёх недель, за четыре недели отказа в изоляции не было — поправка на последнее изолирующее упражнение дня, её заметка', () => {
  const raw = seedRaw(), W = seedW();
  withDays(3, () => {
    const cfg = Core.mergeCfg(plain(raw)), A = Core.adapt(W, cfg, 'mon', '2025-11-17'), p = A.props.find(x => x.tag === 'Проверка запаса')!;
    assert.ok(p, 'поправка есть');
    assert.equal(A.props.filter(x => x.ex === p.ex).length, 1, 'одна поправка на упражнение');
    assert.equal(Core.kindOf(cfg, p.ex), 'iso');
    assert.ok(!cfg.ex[p.ex].uni, 'не одна сторона');
    assert.deepEqual(p.sets.map(s => s.w), A.base.items[p.idx].sets.map(s => s.w), 'веса — по правилу');
    const on = Core.applyAdapt(A, null), off = Core.applyAdapt(A, { [p.key]: true });
    assert.deepEqual([on.items[p.idx].note, off.items[p.idx].note], [RIR_CHECK.note, '']);
    /* отказ в изоляции за последние четыре недели — проверки нет; журнал моложе четырёх недель — тоже */
    const W2 = Core.sortW(W.concat(one('2025-11-12', 'wed', { ex: p.ex, sets: '20x12@0' })));
    assert.ok(!Core.adapt(W2, cfg, 'mon', '2025-11-17').props.some(x => x.tag === 'Проверка запаса'));
    assert.ok(!Core.adapt(W.filter(w => w.date < '2025-09-30'), cfg, 'mon', '2025-10-01').props.some(x => x.tag === 'Проверка запаса'));
  });
  assert.ok(!Core.adapt(W, Core.mergeCfg(plain(raw)), 'mon', '2025-11-17').props.some(x => x.tag === 'Проверка запаса'), 'с таблицей дней эталона — нет');
});

test('без выбранного времени в дне от шести упражнений два упражнения на одну мышцу сливаются в одно, когда баланс недели от этого не хуже; с временем и с таблицей дней эталона — нет', () => {
  const W = seedW(), raw = seedRaw();
  const twin = (r: Raw) => { const p = r.program as { slots: ProgSlots }; p.slots.mon = p.slots.mon.map(e => e.ex === 'tri_overhead' ? { ex: e.ex, n: 2 } : e).concat([{ ex: 'tri_pushdown', n: 2 }]); return r; };
  const fold = (pr: Built) => pr.notes.find(n => n.t === 'Одно упражнение вместо двух');
  withDays(3, () => {
    const pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { budget: 100 });
    const acc = acceptAs(raw, pr, '2025-11-19');
    assert.ok((acc.program as { slots: ProgSlots }).slots.mon.length >= MANY_EX, 'день 1 длинный');
    const pr2 = Core.buildProgram(W, Core.mergeCfg(twin(plain(acc))), { budget: 100 }), mon = pr2.slots.mon;
    assert.ok(fold(pr2), 'заметка о слиянии');
    assert.ok(!mon.some(e => e.ex === 'tri_pushdown'), 'второе упражнение на трицепс ушло из дня 1');
    assert.equal(mon.find(e => e.ex === 'tri_overhead')!.n! >= 3, true, 'его подходы — в растянутом варианте');
    assert.ok(pr2.after.pv.triceps >= pr.after.pv.triceps - 0.01, 'трицепс получает не меньше');
    assert.ok(!fold(Core.buildProgram(W, Core.mergeCfg(twin(plain(acc))), { budget: 100, time: 90 })), 'с выбранным временем — правила времени, слияния нет');
  });
  const pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { budget: 100 });
  assert.ok(!fold(Core.buildProgram(W, Core.mergeCfg(twin(acceptAs(raw, pr, '2025-11-19'))), { budget: 100 })), 'с таблицей дней эталона — как в эталоне');
});
