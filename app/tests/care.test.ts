/* Что беречь и дни подряд (решения владельца, 25 ноября 2026, пункты 2 и 6 разбора «Чего не хватает сборке программы»): rules.ts — ZONES, careOf, stopOf, pairsOf, pairSplit.
   Встроенный справочник, профиль без записей. С таблицей дней эталона ничего из этого не действует. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { PAIR_GROUPS, careList, careOf, dayGap, dayPlaces, pairClash, pairList, pairsOf, stopOf, zonesOf } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, ProgSlots } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; care?: string[]; pairs?: string[]; program?: unknown };
type Built = ReturnType<typeof Core.buildProgram>;
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const starter = (extra?: Partial<Raw>): Raw => Object.assign(withStarter(null) as Raw, extra || {});
const ids = (pr: Built) => [...new Set(Core.SLOTS.flatMap(sl => pr.slots[sl.id].map(e => e.ex)))];
const total = (pr: Built) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const noteOf = (pr: Built, re: RegExp) => pr.notes.find(n => re.test(n.t));
const mainsIn = (pr: Built, d: string) => new Set(pr.slots[d].flatMap(e => Object.entries(pr.cfg.ex[e.ex].m || {}).filter(x => x[1] >= 1 && !pr.cfg.ignore[x[0]]).map(x => x[0])));
const daysOf = (pr: Built, m: string) => Core.SLOTS.filter(sl => ((pr.after.day[sl.id] || {})[m] || 0) >= 2 - 0.01).length;
/* так программу принимает экран (acceptProgram), как в rules.test.ts */
function acceptAs(raw: Raw, pr: Built, since: string): Cfg {
  const r = plain(raw) as Raw; Object.assign(r.ex, plain(pr.create));
  const slots: ProgSlots = {}; for (const id of Object.keys(pr.slots)) slots[id] = pr.slots[id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', prio: pr.prio, budget: pr.budget, since, made: since, slots }, pr.strength ? { strength: true, lean: true } : {}, pr.triad ? { triad: pr.triad.slice() } : {});
  return Core.mergeCfg(r);
}

test('что беречь: места по названию упражнения — тренерская таблица; без отметок и с таблицей дней эталона пилюль нет', () => {
  assert.deepEqual(['Жим лежа', 'Французский жим лежа', 'Жим гантелей лежа', 'Приседания со штангой', 'Жим ногами', 'Становая тяга', 'Бицепс со штангой стоя', 'Жим лежа узким хватом', 'Горизонтальная тяга Т-бар', 'Вертикальная тяга в тренажере'].map(zonesOf),
    [['shoulder'], ['elbow'], [], ['lowback', 'hip', 'knee'], ['knee'], ['lowback', 'hip'], ['wrist'], ['shoulder', 'elbow', 'wrist'], ['lowback'], []]);
  assert.deepEqual(careList(['knee', 'x', 'shoulder', 'knee']), ['shoulder', 'knee'], 'только известные, без повторов, по порядку таблицы');
  assert.deepEqual(careList('knee'), []);
  const raw = starter({ care: ['knee', 'lowback'] });
  assert.deepEqual(Core.mergeCfg(raw).care, ['lowback', 'knee']);
  assert.equal(Core.mergeCfg(starter()).care, undefined, 'ничего не отмечено — поля нет, настройка как у эталона');
  assert.deepEqual(careOf(Core.mergeCfg(raw), 'squat'), [], 'с таблицей дней эталона пилюль нет');
  withDays(3, () => {
    const cfg = Core.mergeCfg(raw);
    assert.deepEqual([careOf(cfg, 'squat'), careOf(cfg, 'leg_press'), careOf(cfg, 'bench'), careOf(cfg, 'x_legext', { n: 'Разгибания ног' })], [['lowback', 'knee'], ['knee'], [], ['knee']]);
    assert.deepEqual(careOf(Core.mergeCfg(starter()), 'squat'), [], 'ничего не отмечено — пилюль нет');
  });
});

test('больное место ничего не убирает: программа та же, что без отметок, у её упражнений — пилюли', () => withDays(3, () => {
  for (const opts of [{ time: 90 }, { focus: 'squat', others: 'plain' }] as BuildOpts[]) {
    const a = Core.buildProgram([], Core.mergeCfg(starter()), opts), b = Core.buildProgram([], Core.mergeCfg(starter({ care: ['knee', 'shoulder'] })), opts);
    assert.deepEqual(plain(b.slots), plain(a.slots), JSON.stringify(opts));
    assert.ok(ids(b).some(id => careOf(b.cfg, id).includes('knee')), 'в программе есть упражнение с пилюлей «Колено»');
  }
}));

test('стоп-упражнение сборка не ставит, в заменах не предлагает, а в программе меняет на замену на те же мышцы', () => withDays(3, () => {
  const raw = starter(); raw.ex.squat.stop = true; raw.ex.leg_ext.stop = true; raw.ex.chest_press.stop = true;
  const cfg = Core.mergeCfg(raw), stop = stopOf(cfg);
  assert.deepEqual([stop('squat'), stop('bench'), stop('x_legext', { n: 'Разгибания ног в тренажере' }), stop('x_legext', { n: 'Разгибания ног' })], [true, false, true, false], 'типовое с тем же названием — тоже стоп');
  for (const opts of [{}, { time: 90 }, { prio: 'legs', time: 60 }, { strength: true, triad: true }] as BuildOpts[]) {
    const pr = Core.buildProgram([], cfg, opts), got = ids(pr);
    assert.ok(!got.includes('leg_ext') && !got.includes('chest_press'), JSON.stringify(opts) + ': ' + got.join());
    if (!opts.triad) assert.ok(!got.includes('squat'), JSON.stringify(opts) + ': приседания');
  }
  assert.ok(ids(Core.buildProgram([], cfg, { strength: true, triad: true })).includes('squat'), 'цель «Силы» атлет выбрал сам — она остаётся');
  const sw = Core.swapsFor(cfg, 'hack_squat', []);
  assert.ok(!sw.same.concat(sw.near).some(x => ['squat', 'leg_ext'].includes(x.id)), 'в заменах стоп-упражнений нет');
  /* программа принята без стоп-отметок, потом жим в тренажёре на грудь стал стоп-упражнением: сборка ставит вместо него замену с пометкой */
  const plainRaw = starter(), pr0 = Core.buildProgram([], Core.mergeCfg(plainRaw), { time: 90 });
  assert.ok(ids(pr0).includes('chest_press'));
  const acc = plain(acceptAs(plainRaw, pr0, '2025-11-20')) as unknown as Raw; acc.ex.chest_press.stop = true;
  const cfg2 = Core.mergeCfg(acc), pr = Core.buildProgram([], cfg2, { time: 90 });
  assert.ok(!ids(pr).includes('chest_press'));
  const was = Core.SLOTS.flatMap(sl => pr.slots[sl.id].filter(e => e.was === 'chest_press'));
  assert.ok(was.length > 0, 'замена помечена «вместо»');
  assert.ok(noteOf(pr, /^Жим в тренажере на грудь → /), pr.notes.map(n => n.t).join(' | '));
}));

test('дни подряд: пары соседних дней по кругу, от трёх дней; места дней в неделе — сутки между днями подряд', () => {
  assert.deepEqual(pairList(['mon-wed', 'mon-wed', 'wed-wed', 'x', 3, 'fri-mon']), ['mon-wed', 'fri-mon']);
  const cfg = Core.mergeCfg(starter({ pairs: ['mon-wed', 'fri-mon'] }));
  assert.deepEqual(pairsOf(cfg, Core.SLOTS), [], 'с таблицей дней эталона дней подряд нет');
  withDays(3, () => {
    const c = Core.mergeCfg(starter({ pairs: ['mon-wed'] }));
    assert.deepEqual(pairsOf(c, Core.SLOTS), [['mon', 'wed']]);
    assert.deepEqual(dayPlaces(c, Core.SLOTS), { mon: 1, wed: 2, fri: 5 });
    assert.deepEqual([dayGap(c, Core.SLOTS, 'mon', 'wed'), dayGap(c, Core.SLOTS, 'wed', 'fri'), dayGap(c, Core.SLOTS, 'fri', 'mon')], [1, 3, 3]);
    assert.deepEqual(pairsOf(Core.mergeCfg(starter({ pairs: ['mon-wed', 'wed-fri', 'fri-mon'] })), Core.SLOTS), [], 'все дни подряд не бывают');
    assert.deepEqual(pairsOf(Core.mergeCfg(starter({ pairs: ['mon-fri'] })), Core.SLOTS), [], 'не соседние дни');
  });
  withDays(2, () => assert.deepEqual(pairsOf(Core.mergeCfg(starter({ pairs: ['mon-wed'] })), Core.SLOTS), [], 'при двух днях пар нет'));
  withDays(4, () => assert.deepEqual(dayPlaces(Core.mergeCfg(starter({ pairs: ['mon-wed', 'fri-d4'] })), Core.SLOTS), { mon: 1, wed: 2, fri: 5, d4: 6 }));
});

test('дни подряд: мышца основная только в одном из двух, у каждой — два дня в неделе, без выбранного времени объём тот же, со временем — сколько влезает; сразу после «Принять» — та же программа', () => {
  const groups = PAIR_GROUPS.flat();
  for (const [n, pairs, time] of [[3, ['mon-wed'], 90], [3, ['fri-mon'], 60], [4, ['mon-wed', 'fri-d4'], 75], [4, ['mon-wed', 'wed-fri', 'fri-d4'], 75], [3, ['wed-fri'], 0]] as [number, string[], number][]) withDays(n, () => {
    const label = n + ' дня, ' + pairs.join(' ') + ', ' + time, raw = starter({ pairs }), cfg = Core.mergeCfg(raw);
    const pr = Core.buildProgram([], cfg, { time }), base = Core.buildProgram([], Core.mergeCfg(starter()), { time });
    const links = pairsOf(cfg, Core.SLOTS);
    for (const [a, b] of links) { const A = mainsIn(pr, a), B = mainsIn(pr, b); assert.deepEqual([...A].filter(m => B.has(m)), [], label + ': в днях ' + a + ' и ' + b); }
    assert.deepEqual(pairClash(links, d => pr.slots[d].map(e => e.ex), m => (pr.cfg.ex[m] || { m: {} }).m, pr.cfg.ignore), []);
    for (const m of groups) if (!cfg.ignore[m]) assert.ok(daysOf(pr, m) >= 2, label + ': ' + m + ' — один день');
    /* без выбранного времени объём тот же; со временем — сколько влезает: разминка в днях пары короче, а день вне пары берёт все мышцы (разминка во времени, 25 ноября 2026) */
    if (!time) assert.ok(Math.abs(total(pr) - total(base)) <= 3, label + ': ' + total(pr) + ' подходов против ' + total(base));
    else for (const sl of Core.SLOTS) assert.ok(Core.estMinutes(pr.cfg, pr.slots[sl.id]) <= time + 2.5, label + ': ' + sl.id + ' не влезает');
    const say = noteOf(pr, /^Дни подряд: /);
    assert.ok(say && !noteOf(pr, /в обоих/), label);
    assert.equal(say!.x!.includes('Подходов со временем на тренировку может выйти больше или меньше'), !!time && Core.SLOTS.some(sl => !links.some(l => l.includes(sl.id))), label + ': ' + say!.x);
    const again = Core.buildProgram([], acceptAs(raw, pr, '2025-11-20'), { time });
    assert.equal(again.same, true, label + ': после «Принять»');
  });
});

test('три дня подряд из трёх: разнести мышцы нельзя — дни как без отметки, с заметкой; с таблицей дней эталона отметка не действует', () => {
  withDays(3, () => {
    const a = Core.buildProgram([], Core.mergeCfg(starter()), { time: 90 }), b = Core.buildProgram([], Core.mergeCfg(starter({ pairs: ['mon-wed', 'wed-fri'] })), { time: 90 });
    assert.deepEqual(plain(b.slots), plain(a.slots));
    assert.match(noteOf(b, /^Дни подряд: 1–2, 2–3 — мышцы в обоих днях/)!.x!, /три дня подряд/i);
  });
  const a = Core.buildProgram([], Core.mergeCfg(starter()), {}), b = Core.buildProgram([], Core.mergeCfg(starter({ pairs: ['mon-wed'] })), {});
  assert.deepEqual(plain(b.slots), plain(a.slots));
  assert.ok(!noteOf(b, /подряд/));
});
