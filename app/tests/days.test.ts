/* Дни программы «День 1…N» и их число в неделе — 2, 3 или 4 (решения владельца, 19 ноября 2026; в эталоне дней три, и это дни недели).
   Пока приложение не выбрало дни, таблица — как в эталоне: на ней идут все остальные тесты. Здесь — то, что видит атлет:
   дни без привязки к дням недели, сборка программы на два и на четыре дня, прежние записи. Числа на примерных данных — те же,
   что в docs/04, раздел 3.7. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson, Ref } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { DAYS, DAY_COUNTS, DAY_IDS, awayDays, dayNo, daysOf, dayStale, useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { RULES } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, ProgSlots, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; program?: unknown };
type Built = ReturnType<typeof Core.buildProgram>;
const seedRaw = (): Raw => readJson('data/config.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
const LIFTS = ['bench', 'leg_press', 'pullup'];
/* проверка идёт с днями «День 1…n» и возвращает таблицу эталона: её ждут остальные проверки файла */
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const ids = () => Core.SLOTS.map(sl => sl.id);
const loads = (pr: Built) => Core.SLOTS.map(sl => pr.after.load[sl.id]);
const total = (pr: Built) => loads(pr).reduce((a, b) => a + b, 0);
const span = (cfg: Cfg, pr: Built) => { const v = Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => pr.after.pv[m.id] || 0); return Core.fmt(Math.min(...v), 1) + '–' + Core.fmt(Math.max(...v), 1); };
const titles = (pr: Built) => pr.notes.map(n => n.t);
const daysWith = (pr: Built, id: string) => Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)).map(sl => sl.id);
/* так программу принимает экран (acceptProgram): справочник с новыми упражнениями, отметки базовых, дни программы — только выбранные,
   базовые, которыми программа пожертвовала из-за числа дней */
function acceptAs(raw: Raw, pr: Built, since: string, extra: Record<string, unknown> = {}): Cfg {
  const r = plain(raw); Object.assign(r.ex, plain(pr.create));
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  const slots: ProgSlots = {}; for (const id of Object.keys(pr.slots)) slots[id] = pr.slots[id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', since, made: since, slots }, pr.dropped.length ? { drop: pr.dropped.slice() } : {}, extra);
  return Core.mergeCfg(r);
}
/* сколько дней в неделе дают мышце два подхода и больше — так считает правило «мышца минимум в два дня» */
const trainedDays = (pr: Built, m: string) => Core.SLOTS.filter(sl => ((pr.after.day[sl.id] || {})[m] || 0) >= 2 - 0.01).length;
const pinned = (pr: Built) => Core.SLOTS.flatMap(sl => pr.slots[sl.id].filter(e => e.pin).map(e => sl.id + ':' + e.ex));
/* общее для любой сборки на N дней: заняты все дни, лимиты не нарушены, заметки без дней недели и без «undefined» */
function sound(cfg: Cfg, pr: Built, budget: number) {
  assert.deepEqual(Object.keys(pr.slots).sort(), ids().slice().sort(), 'дни программы — только выбранные');
  for (const sl of Core.SLOTS) assert.ok(pr.slots[sl.id].length > 0, sl.n + ' пуст');
  assert.ok(total(pr) <= budget + 0.01, 'подходов больше лимита недели: ' + total(pr));
  assert.deepEqual(Core.ruleBreaks(pr.cfg, pr.after), [], 'лимиты атлета нарушены');
  for (const sl of Core.SLOTS) for (const m of Core.MUSCLES) assert.ok(((pr.after.day[sl.id] || {})[m.id] || 0) <= cfg.caps.day + 0.01, sl.n + ', ' + m.n + ': больше лимита на мышцу за тренировку');
  const text = pr.notes.map(n => n.t + ' ' + (n.x || '')).join('\n');
  assert.ok(!/понедельник|сред[ауы]|пятниц|\((пн|ср|пт)\)|undefined/i.test(text), 'в заметках день недели или «undefined»: ' + (text.match(/.{0,40}(понедельник|сред[ауы]|пятниц|\((пн|ср|пт)\)|undefined).{0,40}/i) || [''])[0]);
  for (const sl of Core.SLOTS) for (const e of pr.slots[sl.id]) assert.ok(pr.cfg.ex[e.ex], 'упражнения нет в справочнике сборки: ' + e.ex);
}

test('пока приложение не выбрало дни, таблица дней — как в эталоне', () => {
  assert.deepEqual(plain(Core.SLOTS), plain(Ref.SLOTS)); assert.deepEqual(Object.keys(Core.SLOT), ['mon', 'wed', 'fri']);
  assert.deepEqual(plain(DAYS), { week: true, n: 3 });
});

test('дни 1…N: имена без дней недели, прежние идентификаторы, в SLOT — все четыре дня; возврат к таблице эталона', () => {
  assert.deepEqual(DAY_COUNTS, [2, 3, 4]); assert.deepEqual(DAY_IDS, ['mon', 'wed', 'fri', 'd4']);
  for (const [n, pos] of [[2, [1, 4]], [3, [1, 3, 5]], [4, [1, 2, 4, 5]]] as [number, number[]][]) withDays(n, () => {
    assert.deepEqual(plain(DAYS), { week: false, n });
    assert.deepEqual(ids(), DAY_IDS.slice(0, n));
    assert.deepEqual(Core.SLOTS.map(sl => sl.n), DAY_IDS.slice(0, n).map((_, i) => 'День ' + (i + 1)));
    assert.deepEqual(Core.SLOTS.map(sl => sl.s), Core.SLOTS.map(sl => sl.n), 'короткое имя дня — то же');
    assert.deepEqual(Core.SLOTS.map(sl => sl.dow), pos, 'места дней в неделе');
    assert.deepEqual(Object.keys(Core.SLOT), DAY_IDS, 'день, которого нет в неделе, остаётся в таблице имён: его записи читаются');
    assert.equal(Core.SLOT.fri.n, 'День 3'); assert.equal(Core.SLOT.d4.n, 'День 4');
    for (const sl of Core.SLOTS) assert.equal(Core.SLOT[sl.id], sl, 'в SLOT и в SLOTS — один и тот же день');
  });
  assert.deepEqual(plain(Core.SLOTS), plain(Ref.SLOTS)); assert.ok(!('d4' in Core.SLOT)); assert.equal(DAYS.week, true);
});

test('число дней из настройки профиля: 2, 3 или 4; нет поля или оно негодное — три', () => {
  assert.deepEqual([{ days: 2 }, { days: 3 }, { days: 4 }, {}, null, undefined, { days: 1 }, { days: 5 }, { days: 0 }, { days: 'два' as unknown as number }, { days: 2.4 }].map(daysOf), [2, 3, 4, 3, 3, 3, 3, 3, 3, 3, 2]);
  assert.deepEqual(['mon', 'wed', 'fri', 'd4', 'sat'].map(dayNo), [1, 2, 3, 4, 0]);
});

test('следующий день и дата: без дней недели — день 1 и сегодня; с таблицей эталона — как в эталоне', () => {
  const W = seedW(), last = W[W.length - 1], mk = (slot: string, date: string, open = false): Workout => Object.assign(plain(last), { id: date, date, slot, open });
  for (const today of ['2025-11-17', '2025-11-20', '2025-11-23']) {
    assert.equal(Core.nextSlot([], today), Ref.nextSlot([], today), 'таблица эталона, пустой дневник, ' + today);
    for (const sl of ['mon', 'wed', 'fri']) assert.equal(Core.nextDate(sl, today, W), Ref.nextDate(sl, today, W), 'таблица эталона, дата, ' + sl + ', ' + today);
    withDays(3, () => {
      assert.equal(Core.nextSlot([], today), 'mon', 'пустой дневник начинается с дня 1 в любой день недели');
      for (const sl of ['mon', 'wed', 'fri']) assert.equal(Core.nextDate(sl, today, W), today, 'тренировка — сегодня');
      assert.equal(Core.nextDate('wed', today, W.concat(mk('mon', today))), Core.addDays(today, 1), 'сегодняшняя уже записана — завтра');
      assert.equal(Core.nextDate('wed', today, W.concat(mk('mon', today, true))), today, 'идущая тренировка день не занимает');
    });
  }
  /* дни идут по кругу; день, которого в неделе больше нет, возвращает к дню 1 */
  withDays(2, () => { assert.equal(Core.nextSlot([mk('mon', '2025-11-17')]), 'wed'); assert.equal(Core.nextSlot([mk('wed', '2025-11-17')]), 'mon'); assert.equal(Core.nextSlot([mk('fri', '2025-11-17')]), 'mon'); });
  withDays(4, () => { assert.equal(Core.nextSlot([mk('fri', '2025-11-17')]), 'd4'); assert.equal(Core.nextSlot([mk('d4', '2025-11-17')]), 'mon'); });
});

test('три дня с номерами: сборки те же, что с днями недели, — меняются только слова в заметках', () => {
  /* сверяются только дни: правила приложения, которых нет в эталоне (rules.ts), здесь выключены — их держит tests/rules.test.ts */
  RULES.on = false;
  try { threeDays(); } finally { RULES.on = true; }
});
function threeDays() {
  const sets: [string, Cfg, Workout[]][] = [['примерные данные', Core.mergeCfg(seedRaw()), seedW()], ['с нуля на встроенном списке', Core.mergeCfg(withStarter(null)), []]];
  const modes: BuildOpts[] = [{}, { prio: 'legs' }, { budget: 70 }, { focus: 'bench' }, { focus: 'pullup', others: 'grow' }, { strength: true, budget: 80 }, { focus: 'leg_press', strength: true, budget: 80 }];
  for (const [name, cfg, W] of sets) for (const opts of modes) {
    const week = Core.buildProgram(W, cfg, opts), days = withDays(3, () => { const pr = Core.buildProgram(W, cfg, opts); sound(cfg, pr, +(opts.budget || cfg.caps.week)); return pr; });
    const what = name + ', ' + JSON.stringify(opts);
    assert.deepEqual(plain(days.slots), plain(week.slots), what + ': дни программы');
    assert.deepEqual(plain([days.goals, days.create, days.after, days.name, days.same]), plain([week.goals, week.create, week.after, week.name, week.same]), what);
    /* единственная разница в числе заметок — строка эталона о лёгком дне с «undefined × 8–12»: с днями «День N» её нет */
    assert.equal(days.notes.length, week.notes.filter(n => !(n.x || '').includes('undefined')).length, what + ': число заметок');
  }
  const pb = withDays(3, () => Core.buildProgram(seedW(), Core.mergeCfg(seedRaw()), { focus: 'bench' }));
  assert.ok(titles(pb).includes('Второй раз в неделю — в день 3: Жим лежа — лёгкий день') && titles(pb).some(t => t.startsWith('День на массу — в день 2: ')), titles(pb).join(' | '));
}

test('два дня, примерные данные: в «Массе» базовое из дня 3 переезжает в день 2 — дни 36 и 31 подходов, мышцы 7.5–10; в «Гибриде» в тренировке одно базовое — третье уходит с заметкой, каким жертвовать, выбирает атлет', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(2, () => {
    /* в «Массе» базовые идут по двойной прогрессии, и жертвовать ими незачем (решение владельца, 24 ноября 2026, пункт 8):
       подтягивания из дня 3 встают в день 2 после жима ногами и помечены переносом, а не новым упражнением */
    const pr = Core.buildProgram(W, cfg, {});
    sound(cfg, pr, 100);
    assert.deepEqual(loads(pr), [36, 31]); assert.equal(span(cfg, pr), '7.5–10');
    assert.deepEqual([daysWith(pr, 'bench'), daysWith(pr, 'leg_press'), daysWith(pr, 'pullup'), pr.dropped, pr.dropFrom], [['mon'], ['wed'], ['wed'], [], []]);
    const up = pr.slots.wed.find(e => e.ex === 'pullup')!;
    assert.deepEqual([up.isNew, up.from], [true, 'fri']);
    const m = pr.notes.find(v => v.t === 'Подтягивания — в день 2');
    assert.ok(m && m.x!.includes('Дней в неделе стало меньше') && !titles(pr).some(t => t.startsWith('Не в программе')), titles(pr).join(' | '));
    /* списка «Без базового» в «Массе» нет, и выбор из него не действует */
    const mass = Core.buildProgram(W, cfg, { drop: ['bench'] });
    assert.deepEqual([mass.dropped, daysWith(mass, 'bench'), loads(mass)], [[], ['mon'], [36, 31]]);
    /* «Гибрид» вокруг жима лежа: лишнее по правилу — базовое из дня вне недели (подтягивания); в днях остаётся то базовое, что в них стояло (решение владельца, 23 ноября 2026) */
    const pb = Core.buildProgram(W, cfg, { focus: 'bench' });
    sound(cfg, pb, 100);
    assert.deepEqual([loads(pb), span(cfg, pb)], [[36, 32], '7.5–10.5']);
    assert.deepEqual([daysWith(pb, 'bench'), daysWith(pb, 'leg_press'), daysWith(pb, 'pullup')], [['mon'], ['wed'], []]);
    assert.deepEqual([pb.dropped, pb.dropFrom], [['pullup'], ['leg_press', 'pullup']], 'цель «Гибрида» в списке «Без базового» не стоит');
    const n = pb.notes.find(v => v.t === 'Не в программе: Подтягивания');
    assert.ok(n && n.x!.startsWith('Базовых три, а дней два: в тренировке одно базовое') && n.x!.includes('«Без базового»'), titles(pb).join(' | '));
    assert.ok(!titles(pb).some(t => t.startsWith('Подтягивания — в день ')), titles(pb).join(' | '));
    /* атлет жертвует жимом ногами: подтягивания встают в день 2 вместо него и помечены переносом из дня 3 */
    const mine = Core.buildProgram(W, cfg, { focus: 'bench', drop: ['leg_press'] });
    sound(cfg, mine, 100);
    assert.deepEqual([loads(mine), span(cfg, mine)], [[35, 32], '7.5–10.5']);
    assert.deepEqual([daysWith(mine, 'bench'), daysWith(mine, 'pullup'), daysWith(mine, 'leg_press'), mine.dropped], [['mon'], ['wed'], [], ['leg_press']]);
    const pu = mine.slots.wed.find(e => e.ex === 'pullup')!;
    assert.deepEqual([pu.isNew, pu.from], [true, 'fri']);
    const k = mine.notes.find(v => v.t === 'Подтягивания — в день 2');
    assert.ok(k && k.x!.includes('Дней в неделе стало меньше') && titles(mine).includes('Не в программе: Жим ногами'), titles(mine).join(' | '));
    /* приоритетным не жертвуют: в списке его нет, и выбор его не убирает */
    const pp = Core.buildProgram(W, cfg, { focus: 'pullup', drop: ['pullup'] });
    sound(cfg, pp, 100);
    assert.deepEqual([pp.dropFrom, daysWith(pp, 'pullup').length, pp.dropped.length], [['bench', 'leg_press'], 1, 1]);
  });
});

test('два дня: у пауэрбилдинга отдельного дня на массу нет — упражнение стоит в лёгком дне; у силы лёгкий день в другом дне', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(2, () => {
    const pb = Core.buildProgram(W, cfg, { focus: 'bench' });
    sound(cfg, pb, 100);
    assert.deepEqual(loads(pb), [36, 32]); assert.equal(span(cfg, pb), '7.5–10.5');
    assert.deepEqual(pb.dropped, ['pullup'], 'третье базовое ушло, приоритетное осталось');
    assert.deepEqual([daysWith(pb, 'bench'), daysWith(pb, 'bench_light')], [['mon'], ['wed']]);
    assert.equal(pb.slots.wed[0].ex, 'bench_light', 'лёгкий день — первым');
    assert.deepEqual(pinned(pb).map(v => v.split(':')[0]), ['wed'], 'закреплённое упражнение на массу одно, и оно в лёгком дне');
    const m = pb.notes.find(v => v.t.startsWith('Масса — вместе с лёгким днём, в день 2: '));
    assert.ok(m && titles(pb).includes('Второй раз в неделю — в день 2: Жим лежа — лёгкий день'), titles(pb).join(' | '));
    /* «Сила: жим лежа»: тяжёлый и лёгкий день — в разных тренировках, среднего дня при двух днях нет. Другие базовые справочника под «Силой» —
       обычные упражнения (решение владельца, 24 ноября 2026, пункт 8): жертвовать нечем, подтягивания из дня 3 переехали в день 2 */
    const solo = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
    sound(cfg, solo, 80);
    assert.deepEqual([loads(solo), span(cfg, solo)], [[38, 29], '7.5–12']);
    assert.deepEqual([daysWith(solo, 'bench'), daysWith(solo, 'bench_light'), daysWith(solo, 'bench_mid')], [['mon'], ['wed'], []]); assert.deepEqual(pinned(solo), []);
    assert.deepEqual([daysWith(solo, 'leg_press'), daysWith(solo, 'pullup'), solo.dropped, solo.dropFrom], [['wed'], ['wed'], [], []]);
    assert.ok(['Сила: Жим лежа — два раза в неделю', 'Подтягивания — в день 2', 'Подтягивания и Жим ногами — по двойной прогрессии'].every(t => titles(solo).includes(t)), titles(solo).join(' | '));
    /* у изоляции в силовой роли дня два — тяжёлый 3 × 6 и лёгкий 3 × 10, тоже в разных тренировках */
    const curl = Core.buildProgram(W, cfg, { focus: 'barbell_curl', strength: true, budget: 80 });
    sound(cfg, curl, 80);
    assert.deepEqual([daysWith(curl, 'barbell_curl'), daysWith(curl, 'barbell_curl_light'), curl.dropped], [['wed'], ['mon'], []]);
    assert.ok(titles(curl).includes('Сила: Бицепс со штангой стоя — два раза в неделю'), titles(curl).join(' | '));
  });
});

test('четыре дня, примерные данные: новый день заполнен, длинные дни разгружены — 21 / 23 / 22 / 21, мышцы 10–12', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(4, () => {
    const pr = Core.buildProgram(W, cfg, {});
    sound(cfg, pr, 100);
    assert.deepEqual(loads(pr), [21, 23, 22, 21]); assert.equal(span(cfg, pr), '10–12');
    assert.ok(!pr.slots.d4.some(e => LIFTS.includes(e.ex)), 'в четвёртом дне базового нет: их три');
    const n = pr.notes.find(v => v.t === 'Дни выровнены по длине');
    assert.ok(n && n.x!.includes('(день 2 → день 4)') && n.x!.includes('объём за неделю тот же'), JSON.stringify(n));
    /* переездом названо только то, что стояло в другом дне */
    const moved = n!.x!.split('. ')[0].split(', ').map(v => v.replace(/ \(день \d → день \d\)$/, '')), carried = pr.notes.find(v => v.t === 'Перенесено на другой день');
    assert.deepEqual(moved, ['Жим гантелей под углом 45', 'Вертикальная тяга в тренажере', 'Бицепс Bayesian curl']);
    for (const name of moved) { assert.ok(Core.SLOTS.some(sl => pr.cur[sl.id].some(e => Core.exName(cfg, e.ex) === name)), name + ' в программе не стоял'); assert.ok(!carried || !carried.x!.includes(name + ' ('), name + ' назван перенесённым ради частоты'); }
    /* названные в заметке упражнения помечены переносом, а не новым упражнением */
    for (const name of moved) { const e = pr.slots.d4.find(x => Core.exName(cfg, x.ex) === name); assert.ok(e && e.isNew && e.from, name + ': не помечено переносом'); }
    /* дальше выравнивать незачем: дни отличаются не больше чем на три подхода (раздел 3.2, пункт 5) */
    assert.ok(Math.max(...loads(pr)) - Math.min(...loads(pr)) <= 3, String(loads(pr)));
  });
});

test('четыре дня: новое упражнение, переставленное выравниванием, — «Новое в день 4», а не переезд; изменение подходов у переехавшего названо отдельно', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(4, () => {
    /* на примерных данных с приоритетом «Ноги и ягодицы» это ягодичный мост: сборка поставила его в день 1, выравнивание перенесло в день 4 */
    const legs = Core.buildProgram(W, cfg, { prio: 'legs' });
    sound(cfg, legs, 100);
    const n = legs.notes.find(v => v.t === 'Дни выровнены по длине');
    assert.ok(titles(legs).includes('Новое в день 4: Ягодичный мост') && !(n && n.x!.includes('Ягодичный мост')), titles(legs).join(' | '));
    const thrust = legs.slots.d4.find(e => e.ex === 'x_thrust');
    assert.ok(thrust && thrust.isNew && !thrust.from, 'новое упражнение помечено переносом');
    /* «объём за неделю тот же» — про переезд; если та же сборка изменила у переехавшего упражнения число подходов, это названо отдельно
       (на примерных данных — у «Силы: жим лежа»: разгибания ног из дня 3) */
    const solo = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
    for (const pr of [legs, solo]) for (const e of pr.slots.d4) if (e.from && e.chg) { const nt = pr.notes.find(v => v.t === (e.chg! > 0 ? 'Прибавлены подходы' : 'Убраны подходы')); assert.ok(nt && nt.x!.includes(Core.exName(cfg, e.ex) + ' (день 4)'), Core.exName(cfg, e.ex) + ': изменение подходов не названо'); }
    assert.ok(solo.slots.d4.some(e => e.from && e.chg), 'на примерных данных у переехавшего упражнения меняется число подходов');
  });
});

test('четыре дня: у пауэрбилдинга день на массу один и не в день силовой работы; сила в одном движении — три дня из четырёх; у тройки каждое движение — тяжёлый и лёгкий день', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  withDays(4, () => {
    const pb = Core.buildProgram(W, cfg, { focus: 'bench' });
    sound(cfg, pb, 100);
    assert.deepEqual(loads(pb), [23, 23, 21, 22]); assert.equal(span(cfg, pb), '10–13');
    assert.deepEqual([daysWith(pb, 'bench'), daysWith(pb, 'bench_light')], [['mon'], ['d4']], 'лёгкий день — самый дальний от тяжёлого');
    assert.deepEqual(pinned(pb).map(v => v.split(':')[0]), ['fri'], 'день на массу один: не тяжёлый и не лёгкий');
    assert.ok(titles(pb).some(t => t.startsWith('День на массу — в день 3: ')) && titles(pb).includes('Второй раз в неделю — в день 4: Жим лежа — лёгкий день'), titles(pb).join(' | '));
    const solo = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
    sound(cfg, solo, 80);
    assert.deepEqual(loads(solo), [19, 18, 20, 19]); assert.equal(span(cfg, solo), '8–13');
    /* «Новая схема»: за тяжёлым днём по кругу — лёгкий (день 3), за ним средний (день 4); день 2 — без движения */
    assert.deepEqual([daysWith(solo, 'bench'), daysWith(solo, 'bench_light'), daysWith(solo, 'bench_mid')], [['mon'], ['fri'], ['d4']]);
    assert.ok(titles(solo).includes('Сила: Жим лежа — три раза в неделю'));
    /* «Сила: пауэрлифтерская тройка» (пункт 8): приседаний и становой в справочнике нет — сборка добавила их из встроенного */
    const tri = Core.buildProgram(W, cfg, { strength: true, triad: true, budget: 80 });
    sound(cfg, tri, 80);
    assert.deepEqual(loads(tri), [19, 19, 18, 18]); assert.equal(span(cfg, tri), '8–10.5');
    assert.deepEqual(tri.triad, ['squat', 'bench', 'deadlift']);
    for (const id of tri.triad!) { const h = daysWith(tri, id), l = daysWith(tri, id + '_light'); assert.equal(h.length, 1, id); assert.equal(l.length, 1, id + '_light'); assert.notEqual(h[0], l[0], id + ': тяжёлый и лёгкий день в одной тренировке'); }
  });
});

test('с нуля на встроенном списке: при двух днях третье базовое в «Массе» встаёт вторым, а в «Гибриде» уходит с заметкой; при четырёх — четвёртый день без базового', () => {
  const cfg = Core.mergeCfg(withStarter(null));
  withDays(2, () => {
    /* в «Массе» жертвовать нечем (пункт 8): базовых больше, чем дней, — третье встаёт вторым в день 1 */
    const pr = Core.buildProgram([], cfg, {});
    sound(cfg, pr, 100);
    assert.deepEqual([pr.slots.mon[0].ex, pr.slots.wed[0].ex, daysWith(pr, 'pullup'), pr.dropped], ['bench', 'leg_press', ['mon'], []]);
    assert.ok(titles(pr).includes('Базовые — первыми в своих днях: Жим лежа (день 1), Жим ногами (день 2), Подтягивания (день 1, вторым)'), titles(pr).join(' | '));
    /* в «Гибриде» с нуля лишнее — последнее по списку; вторым базовое не встаёт (решение владельца, 23 ноября 2026) */
    const pb = Core.buildProgram([], cfg, { focus: 'bench' });
    sound(cfg, pb, 100);
    assert.deepEqual([pb.slots.mon[0].ex, daysWith(pb, 'leg_press'), daysWith(pb, 'pullup'), pb.dropped], ['bench', ['wed'], [], ['pullup']]);
    for (const sl of Core.SLOTS) assert.equal(pb.slots[sl.id].filter(e => LIFTS.includes(e.ex)).length, 1, sl.n + ': базовых не одно');
    assert.ok(titles(pb).includes('Базовые — первыми в своих днях: Жим лежа (день 1), Жим ногами (день 2)') && titles(pb).includes('Не в программе: Подтягивания'), titles(pb).join(' | '));
    /* атлет жертвует жимом ногами: подтягивания — в дне 2 */
    const mine = Core.buildProgram([], cfg, { focus: 'bench', drop: ['leg_press'] });
    sound(cfg, mine, 100);
    assert.deepEqual([mine.slots.mon[0].ex, daysWith(mine, 'pullup'), daysWith(mine, 'leg_press'), mine.dropped], ['bench', ['wed'], [], ['leg_press']]);
  });
  withDays(4, () => {
    const pr = Core.buildProgram([], cfg, {});
    sound(cfg, pr, 100);
    assert.deepEqual(Core.SLOTS.map(sl => pr.slots[sl.id][0].ex).slice(0, 3), LIFTS);
    assert.ok(!pr.slots.d4.some(e => LIFTS.includes(e.ex)));
    const l = loads(pr); assert.ok(Math.max(...l) - Math.min(...l) <= 4, 'дни разной длины: ' + l.join(' / '));
  });
});

test('дней стало меньше после принятой программы: в «Гибриде» базовое из её третьего дня уходит с заметкой; принятая программа помнит, чем пожертвовала, и при тех же днях его не возвращает, а «Масса» возвращает; базовое, которое атлет убрал сам, не возвращается', () => {
  const raw = seedRaw(), W = seedW(), PB: BuildOpts = { focus: 'bench' }, three = Core.buildProgram(W, Core.mergeCfg(plain(raw)), PB);
  /* программа на три дня вокруг жима лежа принята давно, тренировки по ней идут: её базовое из дня 3 при двух днях лишнее */
  const cfg3 = acceptAs(raw, three, '2025-09-02');
  const two = withDays(2, () => {
    const pr = Core.buildProgram(W, cfg3, PB);
    sound(cfg3, pr, 100);
    assert.ok(titles(pr).includes('Не в программе: Подтягивания') && !titles(pr).some(t => t.startsWith('Подтягивания — в день ')), titles(pr).join(' | '));
    assert.deepEqual(pr.dropped, ['pullup']);
    return pr;
  });
  /* новая программа на два дня принята: подтягиваниями она пожертвовала, и сразу после принятия сборка предлагает то же.
     Справочник — тот, что остался после первой программы: в нём и упражнения, которые она добавила */
  const raw3 = plain(raw); Object.assign(raw3.ex, plain(three.create));
  const cfg2 = acceptAs(raw3, two, '2025-11-13');
  assert.deepEqual(cfg2.program!.drop, ['pullup']);
  withDays(2, () => {
    const pr = Core.buildProgram(W, cfg2, PB);
    assert.deepEqual([daysWith(pr, 'pullup'), pr.dropped, pr.same], [[], ['pullup'], true]);
    /* атлет передумал и жертвует жимом ногами: подтягивания встают в день 2 вместо него */
    const swap = Core.buildProgram(W, cfg2, Object.assign({ drop: ['leg_press'] }, PB));
    sound(cfg2, swap, 100);
    assert.deepEqual([daysWith(swap, 'pullup'), daysWith(swap, 'leg_press'), swap.dropped], [['wed'], [], ['leg_press']]);
    const n = swap.notes.find(v => v.t === 'Подтягивания — в день 2');
    assert.ok(n && n.x!.includes('выбрано другое') && !n.x!.includes('стало больше'), titles(swap).join(' | '));
    /* атлет перешёл на «Массу»: там базовыми не жертвуют (пункт 8), и подтягивания вернулись */
    const mass = Core.buildProgram(W, cfg2, {});
    sound(cfg2, mass, 100);
    assert.deepEqual([daysWith(mass, 'pullup'), mass.dropped, mass.dropFrom], [['mon'], [], []]);
    const b = mass.notes.find(v => v.t === 'Подтягивания — в день 1');
    assert.ok(b && b.x!.includes('В «Массе» базовые идут по двойной прогрессии'), titles(mass).join(' | '));
  });
  /* атлет принял программу на два дня без подтягиваний сам, не жертвуя ими из-за числа дней: сборка их не возвращает и при трёх днях */
  const mine = acceptAs(raw3, Object.assign({}, two, { dropped: [] }), '2025-11-13');
  withDays(3, () => { for (const opts of [PB, {}]) assert.equal(daysWith(Core.buildProgram(W, mine, opts), 'pullup').length, 0, JSON.stringify(opts) + ': базовое, которое атлет убрал сам, вернулось'); });
});

test('базовое, которое атлет сам поставил в оба дня, считается одним: лишнего нет, и оно не пропадает из обоих дней', () => {
  const raw = seedRaw(), W = seedW(), PB: BuildOpts = { focus: 'bench' }, three = Core.buildProgram(W, Core.mergeCfg(plain(raw)), PB);
  const raw3 = plain(raw); Object.assign(raw3.ex, plain(three.create));
  const two = withDays(2, () => Core.buildProgram(W, acceptAs(raw, three, '2025-09-02'), PB));
  /* «Гибрид» на два дня без подтягиваний, и в день 1 атлет руками добавил жим ногами после жима лежа */
  const mon = two.slots.mon.slice(), at = mon.findIndex(e => e.ex === 'bench') + 1;
  assert.ok(at > 0);
  mon.splice(at, 0, { ex: 'leg_press' });
  const cfg = acceptAs(raw3, Object.assign({}, two, { dropped: [], slots: Object.assign({}, two.slots, { mon }) }), '2025-11-13');
  withDays(2, () => {
    const pr = Core.buildProgram(W, cfg, PB);
    assert.deepEqual([pr.dropped, daysWith(pr, 'bench'), daysWith(pr, 'leg_press'), daysWith(pr, 'pullup')], [[], ['mon'], ['mon', 'wed'], []]);
    assert.ok(!titles(pr).some(t => t.startsWith('Не в программе')), titles(pr).join(' | '));
  });
});

test('прежние записи при другом числе дней не меняются и читаются: день 3 остаётся днём 3, объём и прогресс те же, его запись — шаблон этого дня', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW(), before = JSON.stringify(W);
  const start = Object.assign({}, cfg, { start: Core.mondayOf(W[0].date) });
  const stats = () => plain(Core.allStats(W, start)).map(v => Object.assign({}, v, { active: undefined }));
  const vol = plain(Core.volume(W, start)), base = stats(), mon = plain(Core.currentSlots(W, start).mon);
  const lastFri = W.filter(w => w.slot === 'fri').pop()!;
  assert.ok(lastFri && Core.program(W, start).has('pullup'), 'в записях есть третий день с подтягиваниями');
  for (const n of [2, 4]) withDays(n, () => {
    assert.equal(Core.SLOT.fri.n, 'День 3');
    assert.deepEqual(plain(Core.volume(W, start)), vol, 'объём по неделям при ' + n + ' днях');
    assert.deepEqual(stats(), base, 'прогресс упражнений при ' + n + ' днях');
    assert.deepEqual(plain(Core.currentSlots(W, start).mon), mon, 'день 1 при ' + n + ' днях');
    const p = Core.plan(W, start, 'fri', '2025-11-21');
    assert.equal(p.template, lastFri.id, 'запись дня 3 читается как его шаблон'); assert.deepEqual(p.items.map(it => it.ex), lastFri.items.map(it => it.ex));
  });
  /* при двух днях упражнения, оставшиеся только в записи дня 3, в программе уже не числятся; разгибания ног стоят и в дне 2 — они числятся */
  withDays(2, () => { const prog = Core.program(W, start); for (const id of ['pullup', 'pec_fly', 'bayesian_curl']) assert.ok(!prog.has(id), id + ' числится в программе'); assert.ok(prog.has('bench') && prog.has('leg_press')); assert.ok(lastFri.items.some(it => it.ex === 'leg_ext') && prog.has('leg_ext'), 'упражнение, которое стоит и в дне 2, из программы выпало'); });
  /* неделя полная, когда тренировок столько, сколько дней в неделе */
  const extra = Object.assign(plain(W[W.length - 1]), { id: '2025-11-11', date: '2025-11-11', slot: 'wed' }), W2 = Core.sortW(W.concat(extra as Workout));
  const thisWeek = () => Core.weeksInfo(W2, start, '2025-11-12').weeks.find(w => w.current)!;
  assert.deepEqual([thisWeek().count, thisWeek().complete], [2, false], 'таблица эталона: три дня, двух тренировок мало');
  withDays(2, () => assert.equal(thisWeek().complete, true, 'два дня: двух тренировок хватает'));
  withDays(4, () => assert.equal(thisWeek().complete, false, 'четыре дня: двух тренировок мало'));
  assert.equal(JSON.stringify(W), before, 'записи изменились');
});

test('дней стало больше после программы, принятой на меньшее число: прежняя запись вернувшегося дня шаблоном не служит, базовое стоит один раз', () => {
  const raw = seedRaw(), W = seedW(), PB: BuildOpts = { focus: 'bench' };
  /* «Гибрид» вокруг жима лежа на два дня: в тренировке одно базовое, подтягивания ушли из программы */
  const two = withDays(2, () => Core.buildProgram(W, Core.mergeCfg(plain(raw)), PB));
  assert.deepEqual([daysWith2(two, 'pullup'), two.dropped], [[], ['pullup']], 'при двух днях подтягивания ушли из программы');
  const cfg2 = acceptAs(raw, two, '2025-11-11');
  assert.deepEqual([Object.keys(cfg2.program!.slots), cfg2.program!.drop], [['mon', 'wed'], ['pullup']]);
  const lastFri = W.filter(w => w.slot === 'fri').pop()!;
  for (const n of [3, 4]) withDays(n, () => {
    assert.equal(dayStale(cfg2, 'fri', lastFri), true);
    assert.deepEqual(plain(Core.currentSlots(W, cfg2).fri), [], n + ' дня: день 3 пуст — его запись сделана до принятой программы');
    assert.equal(Core.plan(W, cfg2, 'fri', '2025-11-21').template, null); assert.deepEqual(Core.plan(W, cfg2, 'fri', '2025-11-21').items, []);
    assert.ok(!Core.program(W, cfg2).has('pec_fly'), 'упражнение старой пятницы числится в программе');
    const pr = Core.buildProgram(W, cfg2, PB);
    sound(cfg2, pr, 100);
    for (const id of LIFTS) assert.equal(daysWith(pr, id).length, 1, n + ' дня, ' + id + ': базовое стоит ' + daysWith(pr, id).join(', '));
    /* подтягивания, которыми программа пожертвовала при двух днях, вернулись — в день без другого базового */
    assert.deepEqual(daysWith(pr, 'pullup'), ['fri'], 'подтягивания вернулись на отдельный день');
    assert.equal(pr.slots.fri[0].ex, 'pullup'); assert.deepEqual([pr.slots.fri[0].isNew, pr.slots.fri[0].from, pr.dropped], [true, undefined, []]);
    const back = pr.notes.find(v => v.t === 'Подтягивания — в день 3');
    assert.ok(back && back.x!.includes('Дней в неделе стало больше'), titles(pr).join(' | '));
  });
  /* новая тренировка дня 3, сделанная уже при принятой программе, — снова его шаблон */
  const again = Object.assign(plain(lastFri), { id: '2025-11-14', date: '2025-11-14' }) as Workout, W3 = Core.sortW(W.concat(again));
  withDays(3, () => { assert.equal(dayStale(cfg2, 'fri', again), false); assert.equal(Core.plan(W3, cfg2, 'fri', '2025-11-21').template, '2025-11-14'); });
  /* с таблицей дней эталона правило не действует: там дней всегда три */
  assert.equal(dayStale(cfg2, 'fri', lastFri), false);
  /* четыре → три → четыре: четвёртый день возвращается пустым и заполняется заново, базовые стоят по одному разу */
  const four = withDays(4, () => Core.buildProgram(W, Core.mergeCfg(plain(raw)), {})), cfg4 = acceptAs(raw, four, '2025-11-11');
  const three = withDays(3, () => { const pr = Core.buildProgram(W, cfg4, {}); sound(cfg4, pr, 100); return pr; }), cfg3 = acceptAs(plain(readJson('data/config.json')), three, '2025-11-13');
  withDays(4, () => { const pr = Core.buildProgram(W, cfg3, {}); sound(cfg3, pr, 100); for (const id of LIFTS) assert.equal(daysWith(pr, id).length, 1, id); });
});
/* то же, что daysWith, но для сборки, сделанной при другом числе дней: смотрит все дни программы */
function daysWith2(pr: Built, id: string) { return Object.keys(pr.slots).filter(d => pr.slots[d].some(e => e.ex === id)); }

test('дней стало меньше, а приоритетное базовое стояло в убранном дне: тяжёлый и лёгкий день — в разных тренировках, и сказано, что оно переехало', () => {
  const raw = seedRaw(), W = seedW(), pb3 = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'pullup' });
  assert.deepEqual([daysWith(pb3, 'pullup'), daysWith(pb3, 'pullup_light')], [['fri'], ['mon']]);
  const cfg3 = acceptAs(raw, pb3, '2025-11-11');
  withDays(2, () => {
    for (const opts of [{ focus: 'pullup' }, { focus: 'pullup', others: 'grow' }, { focus: 'pullup', strength: true, budget: 80 }] as BuildOpts[]) {
      const pr = Core.buildProgram(W, cfg3, opts), heavy = daysWith(pr, 'pullup'), light = daysWith(pr, 'pullup_light');
      sound(cfg3, pr, +(opts.budget || 100));
      assert.equal(heavy.length, 1); assert.equal(light.length, 1);
      assert.notEqual(heavy[0], light[0], JSON.stringify(opts) + ': тяжёлый и лёгкий день в одной тренировке');
      assert.ok(titles(pr).some(t => t.startsWith('Подтягивания — в день ')) && !titles(pr).some(t => t.startsWith('Подтягивания — в программу')), titles(pr).join(' | '));
    }
  });
});

test('«Сейчас» при меньшем числе дней — вся нынешняя неделя: день, которого в неделе больше нет, в ней посчитан, пока его не заменила принятая программа', () => {
  const raw = seedRaw(), cfg = Core.mergeCfg(plain(raw)), W = seedW(), week = Core.buildProgram(W, cfg, {});
  const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(3)]));
  assert.equal(week.away, 0); assert.deepEqual(awayDays(W, cfg), [], 'с таблицей дней эталона таких дней нет');
  assert.equal(Core.buildProgram(W, cfg, { manual: true }).same, true);
  /* «Сейчас» при трёх днях «День N»: с днями приложения неделя считается по его методике (базовое в «Массе» — подсобка, rules.ts), поэтому сравнение — с ней */
  const three = withDays(3, () => Core.buildProgram(W, cfg, {}));
  const two = withDays(2, () => {
    const away = awayDays(W, cfg), pr = Core.buildProgram(W, cfg, {});
    assert.deepEqual(away.map(d => d.id), ['fri']); assert.ok(away[0].items.some(e => e.ex === 'pullup'));
    assert.deepEqual(round(pr.before.pv), round(three.before.pv), '«Сейчас» по мышцам — как при трёх днях');
    assert.deepEqual(round(pr.before.ps), round(three.before.ps));
    assert.equal(pr.away, three.before.load.fri, 'подходы дня 3 названы отдельно');
    assert.equal(pr.before.load.mon + pr.before.load.wed + pr.away, three.before.load.mon + three.before.load.wed + three.before.load.fri);
    const manual = Core.buildProgram(W, cfg, { manual: true });
    assert.equal(manual.away, pr.away);
    assert.deepEqual(round(manual.after.pv), round(Core.progTally(cfg, manual.cur).pv), 'в правке вручную «станет» — только выбранные дни');
    assert.notDeepEqual(round(manual.after.pv), round(manual.before.pv));
    /* пока в дне вне недели что-то стоит, неделя из выбранных дней — уже другая программа: «Принять» доступна и в правке вручную */
    assert.equal(manual.same, false); assert.equal(pr.same, false);
    return pr;
  });
  /* программа на два дня принята: третий день заменён, считать его больше не из чего */
  const cfg2 = acceptAs(raw, two, '2025-11-11');
  withDays(2, () => { assert.deepEqual(awayDays(W, cfg2), []); assert.equal(Core.buildProgram(W, cfg2, {}).away, 0); assert.equal(Core.buildProgram(W, cfg2, { manual: true }).same, true); });
  /* запись дня 3, сделанная уже при программе на два дня, — снова день вне недели: неделя та же, но сборка «совпадающей» себя не называет,
     иначе подсказка звала бы принять программу при выключенной кнопке */
  const late = Object.assign(plain(W.filter(w => w.slot === 'fri').pop()!), { id: '2025-11-15', date: '2025-11-15' }) as Workout, WL = Core.sortW(W.concat(late));
  withDays(2, () => {
    const pr = Core.buildProgram(WL, cfg2, {}), sig = (S: ProgSlots) => ids().map(d => (S[d] || []).map(e => e.ex + ':' + (e.n || '')).join(',')).join('|');
    assert.deepEqual(awayDays(WL, cfg2).map(d => d.id), ['fri']); assert.ok(pr.away > 0);
    if (sig(pr.slots) === sig(pr.cur)) assert.equal(pr.same, false, 'дни недели те же, но в «Сейчас» есть день вне недели');
    assert.equal(Core.buildProgram(WL, cfg2, { manual: true }).same, false);
  });
  /* атлет после принятой программы на три дня сам убрал базовое из дня 3: действует его запись, и базовое не возвращается */
  const cfg3 = acceptAs(raw, week, '2025-09-02'), noPull = W.map(w => w.slot === 'fri' && w.date >= '2025-11-02' ? Object.assign(plain(w), { items: w.items.filter(it => it.ex !== 'pullup') }) as Workout : w);
  withDays(2, () => { const pr = Core.buildProgram(noPull, cfg3, {}); assert.equal(daysWith(pr, 'pullup').length, 0, 'базовое, которое атлет убрал из дня сам, вернулось'); });
});

test('пустой день принятой программы остаётся пустым: прежняя запись дня поверх программы не возвращается', () => {
  const raw = seedRaw(), W = seedW();
  /* «Гибрид» вокруг жима лежа на два дня: подтягиваниями программа пожертвовала */
  const two = withDays(2, () => Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench' }));
  /* так программу записывает экран, когда при трёх днях принята правка вручную, а третий день в ней пуст */
  const cfg = acceptAs(raw, two, '2025-11-11'); cfg.program!.slots.fri = [];
  const lastFri = W.filter(w => w.slot === 'fri').pop()!;
  withDays(3, () => {
    assert.equal(dayStale(cfg, 'fri', lastFri), true);
    const cur = Core.currentSlots(W, cfg);
    assert.deepEqual(plain(cur.fri), []);
    /* подтягиваниями программа на два дня пожертвовала, а прежняя запись дня 3 с ними поверх программы не возвращается */
    assert.equal(Core.SLOTS.filter(sl => cur[sl.id].some(e => e.ex === 'pullup')).length, 0, 'подтягивания вернулись с прежней записью дня 3');
    assert.deepEqual(Core.ruleBreaks(cfg, Core.progTally(cfg, cur)), []);
    /* запись, сделанная в день, с которого программа действует, или позже, — уже по ней */
    assert.equal(dayStale(cfg, 'fri', { date: '2025-11-11' }), false); assert.equal(dayStale(cfg, 'fri', { date: '2025-11-10' }), true);
  });
  assert.equal(dayStale(cfg, 'fri', lastFri), false, 'с таблицей дней эталона пустой день программы возвращает запись дня, как в артефакте');
});

test('два дня и приоритет: первое предложение не слабее того, что та же сборка даёт сразу после принятия', () => {
  const later = readJson('data/later.json').profiles[0];
  const sets: [string, Raw, Workout[], string][] = [['примерные данные', seedRaw(), seedW(), '2025-11-13'], ['второй профиль', readJson('data/config.p2.stored.json'), [], '2025-11-13'],
    ['дневник неделей позже', later.config, Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d))), '2025-11-18']];
  for (const [name, raw, W, since] of sets) for (const prio of ['legs', 'back', 'arms']) withDays(2, () => {
    const opts: BuildOpts = { prio, budget: 100 }, cfg = Core.mergeCfg(plain(raw)), pr = Core.buildProgram(W, cfg, opts);
    sound(cfg, pr, 100);
    const again = Core.buildProgram(W, acceptAs(raw, pr, since, { prio, budget: 100 }), opts);
    assert.ok(total(again) - total(pr) < 3, name + ', ' + prio + ': после принятия та же сборка даёт ' + total(again) + ' подходов вместо ' + total(pr));
  });
});

test('выравнивание дней не лишает мышцу тренировочного дня молча: у кого день один, та названа в заметке', () => {
  const sets: [string, Cfg, Workout[]][] = [['примерные данные', Core.mergeCfg(seedRaw()), seedW()], ['пустой профиль', Core.mergeCfg(withStarter(null)), []], ['второй профиль', Core.mergeCfg(readJson('data/config.p2.stored.json')), []]];
  /* «Сила»: одно движение и пауэрлифтерская тройка (пункт 8); тройки при двух днях нет */
  const modes: BuildOpts[] = [{}, { prio: 'legs', budget: 90 }, { prio: 'back', budget: 90 }, { prio: 'chest' }, { focus: 'pullup' }, { focus: 'bench' }, { focus: 'leg_press', strength: true, budget: 80 }, { focus: 'deadlift', strength: true, budget: 80 }, { focus: 'barbell_curl', strength: true, budget: 100 }];
  for (const n of [2, 4]) for (const [name, cfg, W] of sets) for (const opts of n === 4 ? modes.concat([{ strength: true, triad: true, budget: 80 }]) : modes) withDays(n, () => {
    const pr = Core.buildProgram(W, cfg, opts), once = (pr.notes.find(v => v.t.startsWith('Один день в неделю: ')) || { t: '' }).t;
    const own = pr.strength && pr.focus ? pr.cfg.ex[pr.focus].m || {} : {};   // у силы в одном движении его мышцы работают в каждой тренировке
    for (const m of Core.MUSCLES) {
      if (cfg.ignore[m.id] || (own[m.id] || 0) >= 1 || (pr.after.pv[m.id] || 0) < 4 || trainedDays(pr, m.id) >= 2) continue;
      assert.ok(once.includes(m.n.toLowerCase()), n + ' дня, ' + name + ', ' + JSON.stringify(opts) + ': у мышцы «' + m.n + '» один тренировочный день, а в заметке её нет: ' + once);
    }
  });
});

test('дневник неделей позже: два и четыре дня собираются без нарушений лимитов', () => {
  const p = readJson('data/later.json').profiles.find((v: { id: string }) => v.id === 'me');
  const W: Workout[] = Core.sortW(p.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d))), cfg = Core.mergeCfg(p.config);
  const modes: [BuildOpts, number][] = [[{}, 100], [{ focus: 'bench' }, 100], [{ focus: 'bench', strength: true, budget: 80 }, 80], [{ focus: 'barbell_curl', strength: true, budget: 80 }, 80], [{ prio: 'legs' }, 100]];
  withDays(2, () => { for (const [opts, b] of modes) sound(cfg, Core.buildProgram(W, cfg, opts), b); assert.deepEqual(loads(Core.buildProgram(W, cfg, {})), [36, 31]); });
  withDays(4, () => {
    for (const [opts, b] of modes.concat([[{ strength: true, triad: true, budget: 80 }, 80]])) sound(cfg, Core.buildProgram(W, cfg, opts), b);
    assert.deepEqual(loads(Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 })), [21, 18, 20, 19]);
    assert.deepEqual(loads(Core.buildProgram(W, cfg, { strength: true, triad: true, budget: 80 })), [19, 19, 18, 18]);
  });
});
