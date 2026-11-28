/* Встроенный справочник упражнений (src/core/starter.ts): состав, снаряды, согласие со справочниками примерных данных и с чтением названий,
   и то, что свой справочник профиля он не трогает. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKENDS, plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { exKey, fillStarter, STARTER, STARTER_GEAR, STARTER_OWN, starterGear, starterMissing, starterOf, withStarter } from '../src/core/starter.ts';
import { loadProfile } from '../src/data/load.ts';
import type { ExDef } from '../src/core/types.ts';

const ids = Object.keys(STARTER), fresh = () => Core.mergeCfg(withStarter(null));
const sameMap = (a: Record<string, number>, b: Record<string, number>) => assert.deepEqual(Object.entries(a).sort(), Object.entries(b).sort());

test('состав: 34 упражнения основного набора и 44 распространённых, названия не повторяются', () => {
  assert.equal(STARTER_OWN, 34);
  assert.equal(ids.length, 78);   // до 28 ноября 2026 — 63: добавлено 15 (просьба владельца, пункты 7–9)
  assert.equal(new Set(ids.map(id => exKey(STARTER[id].n))).size, ids.length, 'два упражнения с одним названием');
  for (const id of ids) {
    const e = STARTER[id];
    assert.ok(e.n && e.n.length <= 80, id + ': название');
    assert.ok(Core.PATTERNS.some(p => p.id === e.pat), id + ': тип движения ' + e.pat);
    assert.ok(Object.keys(e.m).every(m => Core.MUSCLE[m] && (e.m[m] === 1 || e.m[m] === 0.5)), id + ': мышцы только из списка, 1 или 0.5');
    assert.ok(Object.values(e.m).some(v => v === 1), id + ': нет основной мышцы');
    if (e.lo != null || e.hi != null) assert.ok(e.lo! >= 8 && e.hi! > e.lo!, id + ': диапазон от 8 и по возрастанию');   // нижняя граница не меньше 8 — правило владельца
  }
});

test('каждое упражнение лежит на снаряде: «без снаряда» пусто, шаг берётся от снаряда', () => {
  const cfg = fresh();
  assert.equal(Object.keys(cfg.ex).length, 78);
  for (const id of ids) {
    const g = Core.gearOf(cfg, id);
    assert.notEqual(g, Core.NO_GEAR, STARTER[id].n + ' — без снаряда');
    assert.equal(g, STARTER[id].gear, id + ': снаряд');
    assert.ok(cfg.gear[g], id + ': снаряда ' + g + ' нет в профиле');
    assert.equal(Core.isCycle(cfg, id) ? cfg.ex[id].round : cfg.ex[id].step, cfg.gear[g].step, id + ': шаг не от снаряда');
  }
  assert.deepEqual(plain(cfg.gear.g_pullup), { n: 'Подтягивания', step: 1, own: true });
  assert.deepEqual(Core.gearList(cfg).map(g => g.id), ['machine', 'cable', 'barbell', 'dumbbell', 'g_pullup']);
});

test('базовые основного набора — по волне, остальные — двойная прогрессия', () => {
  const cfg = fresh();
  assert.deepEqual(ids.filter(id => Core.isCycle(cfg, id)), ['bench', 'leg_press', 'pullup']);
  assert.ok(ids.every(id => !Core.isLight(cfg, id)));
});

test('распространённые упражнения: дневник читает из названия те же мышцы и тот же тип движения', () => {
  for (const id of ids.slice(STARTER_OWN)) {
    const g = Core.guessEx(STARTER[id].n);
    assert.ok(g, STARTER[id].n + ': название не прочитано');
    assert.equal(g!.pat, STARTER[id].pat, STARTER[id].n + ': тип движения');
    sameMap(g!.m, STARTER[id].m);
    assert.ok(!g!.uni && !STARTER[id].uni, STARTER[id].n + ': не одна сторона');
  }
});

test('справочники примерных данных входят в основной набор встроенного списка: те же мышцы, тип движения, стороны; снаряды — как разложены во втором профиле', () => {
  const sets: [string, Record<string, ExDef>, boolean][] = [['примерные данные, первый профиль', readJson('data/config.json').ex, false], ['примерные данные, второй профиль', readJson('data/config.p2.stored.json').ex, true]];
  for (const p of readJson('data/later.json').profiles) if (p.config) sets.push(['дневник неделей позже, ' + p.id, p.config.ex, p.id !== 'me']);
  let seen = 0;
  for (const [title, ex, placed] of sets) for (const [id, e] of Object.entries(ex)) {
    if (e.mode === 'light') continue;
    const s = STARTER[id];
    assert.ok(s, title + ': ' + e.n + ' (' + id + ') нет во встроенном списке');
    assert.ok(ids.indexOf(id) < STARTER_OWN, id + ' стоит не в основном наборе');
    sameMap(s.m, e.m);
    assert.equal(s.pat, e.pat, id + ': тип движения');
    assert.equal(!!s.uni, !!e.uni, id + ': стороны');
    if (placed && e.gear) assert.equal(s.gear, e.gear, title + ': ' + e.n + ' — другой снаряд');
    seen++;
  }
  assert.ok(seen >= 123);
  /* в первом профиле базовые идут по волне — и здесь тоже */
  const me: Record<string, ExDef> = readJson('data/config.json').ex;
  for (const id of Object.keys(me)) assert.equal(STARTER[id].mode === 'cycle', me[id].mode === 'cycle', id + ': прогрессия');
});

test('свой справочник профиля не трогается; пустой получает список целиком и свой снаряд', () => {
  const mine = { start: '2025-09-08', ex: { a: { n: 'Своё', m: { chest: 1 } } } };
  assert.equal(withStarter(mine), mine);
  const empty: { start: string; method: string; ex: Record<string, ExDef>; gear: Record<string, { n?: string; step?: number }> } = { start: '2025-11-10', method: '', ex: {}, gear: { g_x: { n: 'Гиря', step: 4 }, dumbbell: { step: 1 } } };
  const got = withStarter(empty);
  assert.notEqual(got, empty);
  assert.deepEqual(empty.ex, {}, 'исходная настройка изменена');
  assert.equal(got.start, '2025-11-10');
  assert.deepEqual(Object.keys(got.ex), ids);
  assert.deepEqual(got.gear, { g_pullup: { n: 'Подтягивания', step: 1 }, g_x: { n: 'Гиря', step: 4 }, dumbbell: { step: 1 } });
  assert.deepEqual(Object.keys(withStarter(null).ex!), ids);
  /* копия, а не сам список: правка профиля его не меняет */
  got.ex.bench.n = 'другое'; got.ex.bench.m.chest = 0.5; got.gear.g_pullup.step = 5;
  assert.equal(STARTER.bench.n, 'Жим лежа'); assert.equal(STARTER.bench.m.chest, 1); assert.equal(STARTER.db_bench.m.chest, 1); assert.equal(STARTER_GEAR.g_pullup.step, 1);
});

test('чего профилю не хватает и куда положить упражнение без снаряда', () => {
  const me: Record<string, ExDef> = readJson('data/config.json').ex;
  const missing = starterMissing(me);
  assert.deepEqual(missing, ids.filter(id => !me[id]));
  assert.ok(ids.slice(STARTER_OWN).every(id => missing.includes(id)), 'распространённых упражнений у первого профиля нет ни одного');
  /* то же упражнение под своим id и с «ё» в названии — не «не хватает» */
  assert.ok(!starterMissing({ x_1: { n: 'подъём  на носки СТОЯ' } }).includes('calf_standing'));
  assert.deepEqual(starterMissing(null), ids);
  assert.equal(starterOf('bench', 'как угодно'), 'bench');
  assert.equal(starterOf('x_1', 'Румынская тяга'), 'rdl');
  assert.equal(starterOf('x_1', 'Фермерская прогулка'), null);
  assert.equal(starterGear('bench', 'Жим лежа'), 'barbell');
  assert.equal(starterGear('x_1', 'Бабочка'), 'machine');
  assert.equal(starterGear('x_1', 'Фермерская прогулка'), null);
  /* типовые упражнения сборки, которые она сама добавляет в справочник */
  assert.equal(starterGear('x_raise', 'Махи в стороны'), 'dumbbell');
  assert.equal(starterGear('x_calf', 'Подъёмы на носки'), 'machine');
  assert.equal(starterGear('x_abs', 'Пресс'), 'machine');
  /* в первом профиле без снаряда лежат шесть упражнений — каждому список знает место */
  const cfg = Core.mergeCfg({ ex: me }), loose = Object.keys(cfg.ex).filter(id => Core.gearOf(cfg, id) === Core.NO_GEAR);
  assert.ok(loose.length > 0 && loose.every(id => !!starterGear(id, cfg.ex[id].n)), 'остаются без места: ' + loose.filter(id => !starterGear(id, cfg.ex[id].n)).join(', '));
});

test('копия первой версии: справочник дополняется встроенным — шесть упражнений на снаряды, пятьдесят пять новых, своё не меняется (решение владельца, 25 ноября 2026)', () => {
  const raw = readJson('data/config.json'), before = JSON.stringify(raw);
  const f = fillStarter(raw), got = f.raw!;
  assert.equal(JSON.stringify(raw), before, 'исходная настройка изменена');
  assert.deepEqual(f.sorted, ['bench', 'leg_press', 'pullup', 'pec_fly', 'bayesian_curl', 'abs']);
  assert.equal(f.added.length, 55);
  assert.deepEqual(f.added, starterMissing(raw.ex));
  /* свои упражнения на месте и такие же: меняется только снаряд у тех, что лежали «без снаряда», и уходят шаг и округление, которые не читаются */
  for (const [id, e] of Object.entries(raw.ex as Record<string, ExDef>)) {
    const x = Object.assign({}, got.ex[id]), y = Object.assign({}, e);
    if (f.sorted.includes(id)) { assert.equal(x.gear, STARTER[id].gear, id + ': снаряд'); delete x.gear; delete y.step; delete y.round; }
    assert.deepEqual(x, y, id + ': своё упражнение изменилось');
  }
  for (const id of f.added) assert.deepEqual(got.ex[id], STARTER[id], id);
  assert.deepEqual(got.gear, { g_pullup: { n: 'Подтягивания', step: 1 } });
  /* после загрузки — как у нового профиля: 78 упражнений, «без снаряда» пусто, подтягивания с шагом 1 кг */
  const cfg = Core.mergeCfg(got);
  assert.equal(Object.keys(cfg.ex).length, 78);
  assert.deepEqual(Object.keys(cfg.ex).filter(id => Core.gearOf(cfg, id) === Core.NO_GEAR), []);
  for (const id of ids) assert.equal(Core.gearOf(cfg, id), STARTER[id].gear, id + ': снаряд');
  assert.equal(cfg.ex.pullup.round, 1);
  /* второй раз дополнять нечего: та же настройка, тот же объект */
  const again = fillStarter(got);
  assert.equal(again.raw, got); assert.deepEqual([again.sorted, again.added], [[], []]);
});

test('дополнение встроенным не трогает выбор атлета, лёгкий день, полный справочник и настройку без упражнений', () => {
  assert.deepEqual(fillStarter(null), { raw: null, sorted: [], added: [] });
  const none = { start: '2025-11-10', ex: {} };
  assert.equal(fillStarter(none).raw, none, 'без упражнений встроенный список подставит загрузка профиля');
  const full = withStarter(null);
  assert.equal(fillStarter(full).raw, full, 'полный справочник, выгруженный приложением, — без изменений');
  const raw = { ex: {
    bench: { n: 'Жим лежа', m: { chest: 1 }, mode: 'cycle', gear: 'none', round: 5 },            // «без снаряда» выбрал атлет
    bench_light: { n: 'Жим лежа — лёгкий день', m: { chest: 1 }, mode: 'light', of: 'bench' },
    pec_fly: { n: 'Бабочка', m: { chest: 1 }, gear: 'g_old', step: 5 },                             // свой снаряд, которого больше нет: лежит по названию — «без снаряда»
    leg_press: { n: 'Жим ногами', m: { quads: 1 }, mode: 'cycle', gear: 'g_sled' },                  // свой снаряд остаётся
    x_1: { n: 'Фермерская прогулка', m: { forearms: 1 } },                                             // встроенный список его не знает
    x_2: { n: 'Тяга гантели в наклоне одной рукой', m: { upper_back: 1 } }                             // лежит по названию на гантели
  } as Record<string, ExDef>, gear: { g_sled: { n: 'Платформа', step: 10 } } };
  const f = fillStarter(raw), got = f.raw!;
  assert.deepEqual(f.sorted, ['pec_fly']);
  assert.equal(got.ex.pec_fly.gear, 'machine'); assert.equal(got.ex.pec_fly.step, undefined);
  assert.deepEqual(got.ex.bench, raw.ex.bench); assert.deepEqual(got.ex.bench_light, raw.ex.bench_light); assert.deepEqual(got.ex.leg_press, raw.ex.leg_press);
  assert.deepEqual(got.ex.x_1, raw.ex.x_1); assert.deepEqual(got.ex.x_2, raw.ex.x_2);
  assert.ok(!f.added.includes('bench') && !f.added.includes('leg_press') && !f.added.includes('pec_fly'));
  assert.equal(f.added.length, 75);
  assert.deepEqual(got.gear, { g_sled: { n: 'Платформа', step: 10 }, g_pullup: { n: 'Подтягивания', step: 1 } });
});

for (const b of BACKENDS) test('пустое хранилище (' + b.name + '): профиль считается со встроенным списком, в хранилище ничего не пишется', async () => {
  const s = await b.open(), got = await loadProfile(s, 'me');
  assert.equal(got.cfgRaw, null);
  assert.equal(Object.keys(got.cfg.ex).length, 78);
  assert.deepEqual(await s.list('config'), []);
});

test('программа с нуля на встроенном списке: «Равномерно» собирает три дня из своих упражнений', () => {
  const cfg = fresh(), t0 = Date.now(), pr = Core.buildProgram([], cfg, {}), ms = Date.now() - t0;
  for (const sl of Core.SLOTS) assert.ok(pr.slots[sl.id].length >= 4, sl.n + ': упражнений ' + pr.slots[sl.id].length);
  assert.deepEqual(Object.keys(pr.create), [], 'сборка взяла типовые упражнения, хотя список полон');
  const used = [...new Set(Core.SLOTS.flatMap(sl => pr.slots[sl.id].map(e => e.ex)))];
  assert.ok(used.every(id => STARTER[id] && !STARTER[id].uni), 'в программе — только упражнения из списка, без односторонних');
  const total = Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0), tracked = Core.MUSCLES.filter(m => !cfg.ignore[m.id]);
  assert.ok(total <= cfg.caps.week + 0.01, 'подходов ' + total);
  for (const m of tracked) assert.ok((pr.after.pv[m.id] || 0) >= cfg.zones.opt - 0.75 && (pr.after.pv[m.id] || 0) <= cfg.zones.opt + 4, m.n + ': ' + pr.after.pv[m.id]);
  for (const m of Core.MUSCLES.filter(x => cfg.ignore[x.id])) assert.equal(pr.after.pv[m.id] || 0, 0, m.n + ' вне расчёта — ноль');
  assert.ok(ms < 5000, 'сборка шла ' + ms + ' мс');
});
