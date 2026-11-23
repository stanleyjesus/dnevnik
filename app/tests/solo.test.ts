/* Сила в одном базовом (решение владельца, 19 ноября 2026; в эталоне этого режима нет). Выбранное базовое идёт три дня в неделю:
   тяжёлый день «сила по запасу» первым в своём дне и лёгкие дни первыми в остальных тренировках. Остальные базовые — раз в неделю,
   на поддержании или по своей волне; дня «на массу», как в пауэрбилдинге, нет; подсобка целится на два подхода ниже рабочей зоны.
   Числа на примерных данных — те же, что в docs/04, раздел 3.3б. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { STRONG } from '../src/core/strength.ts';
import { withStarter } from '../src/core/starter.ts';
import type { Cfg, ExDef, ProgSlots, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; program?: unknown };
type Built = ReturnType<typeof Core.buildProgram>;
const seedRaw = (): Raw => readJson('data/config.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
const LIFTS = ['bench', 'leg_press', 'pullup'];
const total = (pr: Built) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const loads = (pr: Built) => Core.SLOTS.map(sl => pr.after.load[sl.id]);
const span = (cfg: Cfg, pr: Built) => { const v = Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => pr.after.pv[m.id] || 0); return Core.fmt(Math.min(...v), 1) + '–' + Core.fmt(Math.max(...v), 1); };
const titles = (pr: Built) => pr.notes.map(n => n.t);
const daysOf = (pr: Built, id: string) => Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)).map(sl => sl.id);
const liftSets = (pr: Built, ids: string[]) => Core.SLOTS.flatMap(sl => pr.slots[sl.id]).filter(e => ids.includes(e.ex)).reduce((a, e) => a + (Core.isLight(pr.cfg, e.ex) ? Core.lightOf(pr.cfg, e.ex).sets : Core.waveSetsAvg(pr.cfg, e.ex)), 0);
/* начало дня: всё, что стоит до последнего базового или лёгкого дня, вместе с ним */
const head = (cfg: Cfg, day: { ex: string }[]) => { const L = day.map(e => e.ex); return L.slice(0, L.reduce((n, id, i) => ['base', 'light'].includes(Core.kindOf(cfg, id)) ? i + 1 : n, 0)); };
const heads = (pr: Built) => Core.SLOTS.map(sl => head(pr.cfg, pr.slots[sl.id]));
/* так программу принимает экран (acceptProgram): справочник с новыми упражнениями, отметки базовых, дни программы */
function accepted(raw: Raw, pr: Built, extra: Record<string, unknown>): Raw {
  const r = plain(raw); Object.assign(r.ex, plain(pr.create));
  for (const [id, g] of Object.entries(pr.goals)) { if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  const slots: ProgSlots = {}; for (const sl of Core.SLOTS) slots[sl.id] = pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, since: '2099-01-01', made: '2025-11-12', slots }, extra);
  return r;
}
/* общее для любой сборки режима: одно базовое на силе по запасу и первым в своём дне, лёгкие дни в остальных тренировках, остальные базовые раз в неделю, дня «на массу» нет */
function shape(cfg: Cfg, pr: Built, x: string, o: { others?: 'hold' | 'grow'; light?: number } = {}) {
  const others = o.others || 'hold', nLight = o.light == null ? 2 : o.light, lid = x + '_light', rest = LIFTS.filter(id => id !== x && Core.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === id)));
  assert.equal(pr.strength, true); assert.equal(pr.focus, x); assert.equal(pr.others, others); assert.equal(pr.prio, '');
  assert.equal(pr.name, 'Сила: ' + Core.exName(cfg, x).toLowerCase());
  assert.equal(pr.goals[x], 'auto', 'выбранное базовое — на силе по запасу');
  for (const id of rest) assert.equal(pr.goals[id], others === 'hold' ? 'hold' : null, id + ': ' + (others === 'hold' ? 'поддержание' : 'своя волна'));
  const home = daysOf(pr, x), light = daysOf(pr, lid);
  assert.equal(home.length, 1, 'тяжёлый день один'); assert.equal(pr.slots[home[0]][0].ex, x, 'тяжёлый день — первым упражнением');
  assert.equal(light.length, nLight, 'лёгких дней: ' + light.join(', ')); assert.ok(!light.includes(home[0]), 'лёгкий день в день тяжёлого');
  if (nLight) { assert.equal(pr.cfg.ex[lid].of, x); assert.deepEqual(plain(Core.lightOf(pr.cfg, lid)), { pct: 78, reps: 4, sets: 3 }, 'лёгкий день 3 × 4 на 78%'); }
  const wv = Core.waveOf(pr.cfg, x); assert.ok(wv.auto && wv.sets(4) === 4, '4 × 4 по запасу');
  assert.equal(liftSets(pr, [x, lid]), 4 + 3 * nLight, 'подходов движения в неделю');
  for (const id of rest) { assert.equal(daysOf(pr, id).length, 1, id + ': раз в неделю'); assert.equal(daysOf(pr, id + '_light').length, 0, id + ': лёгкого дня у остальных базовых нет'); }
  /* лёгкий день, поставленный сборкой, стоит первым; тот, что был в программе раньше, остаётся на своём месте.
     Остальные базовые сборка не двигает: они стоят там, где их поставил атлет (как в пауэрбилдинге) */
  for (const d of light) { const at = pr.slots[d].findIndex(e => e.ex === lid); assert.ok(at === 0 || !pr.slots[d][at].isNew, Core.SLOT[d].n + ': новый лёгкий день стоит не первым'); }
  for (const sl of Core.SLOTS) assert.ok(!pr.slots[sl.id].some(e => e.pin), sl.n + ': закреплённого упражнения «на массу» в этом режиме нет');
  assert.ok(!pr.notes.some(n => (n.t + n.x).includes('undefined')), 'в заметках «undefined»: ' + JSON.stringify(pr.notes.filter(n => (n.t + n.x).includes('undefined'))));
  assert.ok(!titles(pr).some(t => t.startsWith('Третий день') || t.startsWith('Второй день')), 'заметки пауэрбилдинга в силовом режиме: ' + titles(pr).join(' | '));
  /* основные мышцы выбранного базового работают в каждой тренировке: в «один день в неделю» они не попадают */
  const mains = Object.keys(cfg.ex[x].m || {}).filter(m => cfg.ex[x].m[m] >= 1).map(m => Core.MUSCLE[m].n.toLowerCase()), once = titles(pr).find(t => t.startsWith('Один день в неделю')) || '';
  if (nLight) for (const m of mains) assert.ok(!once.includes(m), 'мышца выбранного базового названа «один день в неделю»: ' + once);
  for (const m of Core.MUSCLES.filter(v => cfg.ignore[v.id])) assert.ok(!(pr.after.pv[m.id] > 0) || LIFTS.some(id => (cfg.ex[id].m[m.id] || 0) > 0), m.n + ' вне расчёта получила подходы подсобки');
}

test('примерные данные, жим лежа, лимит 80: тяжёлый день и два лёгких, остальные базовые на поддержании, 79 подходов, мышцы 8–10.5', () => {
  const cfg = Core.mergeCfg(seedRaw()), pr = Core.buildProgram(seedW(), cfg, { focus: 'bench', strength: true, budget: 80 });
  shape(cfg, pr, 'bench');
  /* лёгкие дни встали первыми. Жим ногами на поддержании остался там, где его поставил атлет, — в среду после разгибаний ног: о перестановке сборка не говорит */
  assert.deepEqual(heads(pr), [['bench'], ['bench_light', 'leg_ext', 'leg_press'], ['bench_light', 'pullup']]);
  assert.ok(!titles(pr).some(t => t.includes('— первым упражнением')), 'остальные базовые сборка не двигает: ' + titles(pr).join(' | '));
  assert.deepEqual(Object.keys(pr.create).filter(id => id.endsWith('_light')), ['bench_light']);
  assert.equal(total(pr), 79); assert.deepEqual(loads(pr), [26, 29, 24]); assert.equal(span(cfg, pr), '8–10.5');
  assert.equal(liftSets(pr, ['bench', 'bench_light', 'leg_press', 'pullup']), 16, 'базовых подходов: 10 жима и по 3 на поддержании');
  assert.equal(Core.fmtDur(Core.SLOTS.reduce((a, sl) => a + Core.estMinutes(pr.cfg, pr.slots[sl.id], cfg.rest), 0) / 3), '1 ч 30 мин');
  /* сила и масса: у груди сила — 4 тяжёлых подхода целиком и 6 лёгких за половину */
  assert.equal((pr.after.ps || {}).chest, 7);
  /* новыми помечены только лёгкие дни, которых не было; сам жим стоял в программе */
  for (const sl of Core.SLOTS) for (const e of pr.slots[sl.id]) if (e.ex === 'bench_light') assert.equal(e.isNew, true); else if (e.ex === 'bench') assert.ok(!e.isNew);
  const n = pr.notes.find(v => v.t === 'Сила: Жим лежа — три раза в неделю');
  assert.ok(n, titles(pr).join(' | '));
  assert.ok(n!.x!.includes('Тяжёлый день — в понедельник: 4 × 4') && n!.x!.includes('Лёгкие дни — в среду и в пятницу: 3 × 4 на 78%') && n!.x!.includes('Всего 10 подходов движения в неделю'), String(n!.x));
  assert.ok(n!.x!.includes('что 10 лучше 7, надёжно не показано') && n!.x!.includes('тренерское правило') && n!.x!.includes('Дня «на массу», как в пауэрбилдинге, здесь нет'), String(n!.x));
  assert.ok(titles(pr).includes('Жим ногами и Подтягивания — поддержание'), titles(pr).join(' | '));
  const sub = pr.notes.find(v => v.t.startsWith('Подсобка — '));
  assert.equal(sub && sub.t, 'Подсобка — от 8 до 10.5 подходов на мышцу');
  assert.ok(sub!.x!.includes('в 8 подходов в неделю вместо 10') && sub!.x!.includes('Всего 79 подходов при лимите 80'), String(sub!.x));
});

test('примерные данные, жим ногами и подтягивания: лёгкие дни встают первыми в двух других тренировках', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  const lp = Core.buildProgram(W, cfg, { focus: 'leg_press', strength: true, budget: 80 });
  /* так дни стоят у атлета: жим ногами в среду — вторым, после разгибаний ног */
  assert.deepEqual(Core.SLOTS.map(sl => head(cfg, lp.cur[sl.id])), [['bench'], ['leg_ext', 'leg_press'], ['pullup']]);
  shape(cfg, lp, 'leg_press');
  assert.deepEqual(heads(lp), [['leg_press_light', 'bench'], ['leg_press'], ['leg_press_light', 'pullup']]);
  assert.ok(titles(lp).includes('Жим ногами — первым упражнением в среду'), 'жим ногами стоял вторым — сказано, что он переехал вперёд');
  assert.equal(total(lp), 80); assert.deepEqual(loads(lp), [29, 28, 23]); assert.equal(span(cfg, lp), '8–10');
  /* разгибания ног сборка из среды убирает, и жим ногами оказался бы первым и без перестановки. Поэтому ещё одна сборка — на программе,
     где перед жимом ногами стоит тяга, которая в среде остаётся: жим ногами обязан встать перед ней */
  const raw2 = seedRaw(), was = Core.buildProgram(W, Core.mergeCfg(plain(raw2)), { manual: true }).cur;
  const slots: ProgSlots = {}; for (const sl of Core.SLOTS) slots[sl.id] = was[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  slots.wed.unshift(slots.wed.splice(slots.wed.findIndex(e => e.ex === 'tbar_row'), 1)[0]);
  const cfg2 = Core.mergeCfg(Object.assign(raw2, { program: { name: 'Тяга перед жимом ногами', since: '2099-01-01', made: '2025-11-12', slots } }));
  const lp2 = Core.buildProgram(W, cfg2, { focus: 'leg_press', strength: true, budget: 80 });
  assert.deepEqual(head(cfg2, lp2.cur.wed), ['tbar_row', 'leg_ext', 'leg_press']);
  shape(cfg2, lp2, 'leg_press');
  assert.ok(lp2.slots.wed.some(e => e.ex === 'tbar_row'), 'тяга из среды ушла: первое место жима ногами ничего не доказывает');
  assert.ok(titles(lp2).includes('Жим ногами — первым упражнением в среду'));
  const pu = Core.buildProgram(W, cfg, { focus: 'pullup', strength: true, budget: 80 });
  shape(cfg, pu, 'pullup');
  /* подтягивания и так стояли первыми; жим ногами здесь на поддержании, и сборка его не двигает: он остаётся после разгибаний ног */
  assert.deepEqual(heads(pu), [['pullup_light', 'bench'], ['pullup_light', 'leg_ext', 'leg_press'], ['pullup']]);
  assert.ok(!titles(pu).some(t => t.includes('— первым упражнением')), 'переставлять было нечего: ' + titles(pu).join(' | '));
  assert.equal(total(pu), 79); assert.deepEqual(loads(pu), [27, 28, 24]); assert.equal(span(cfg, pu), '8–10.5');
});
/* базовые и лёгкие дни в начале дня */
function pr0(pr: Built, slot: string) { return pr.slots[slot].filter(e => ['base', 'light'].includes(Core.kindOf(pr.cfg, e.ex))).map(e => e.ex); }

test('остальные базовые «растут как раньше»: своя волна, 18 базовых подходов', () => {
  const cfg = Core.mergeCfg(seedRaw()), pr = Core.buildProgram(seedW(), cfg, { focus: 'bench', others: 'grow', strength: true, budget: 80 });
  shape(cfg, pr, 'bench', { others: 'grow' });
  assert.equal(liftSets(pr, ['bench', 'bench_light', 'leg_press', 'pullup']), 18);
  assert.equal(total(pr), 79); assert.deepEqual(loads(pr), [28, 28, 23]); assert.equal(span(cfg, pr), '8–10.3');
  assert.ok(!titles(pr).some(t => t.endsWith('— поддержание')), titles(pr).join(' | '));
});

test('другие лимиты: 100 → 81 подход и 8–10.5 — выше своей цели подсобка не идёт; 60 → 60 и 6.5–9', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  for (const [budget, sets, range] of [[100, 81, '8–10.5'], [60, 60, '6.5–9']] as [number, number, string][]) {
    const pr = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget });
    shape(cfg, pr, 'bench');
    assert.equal(total(pr), sets, 'лимит ' + budget); assert.equal(span(cfg, pr), range, 'лимит ' + budget);
    assert.ok(total(pr) <= budget + 0.01);
  }
});

test('отличие от пауэрбилдинга: там два дня движения и день «на массу», здесь три дня и без него', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  const pb = Core.buildProgram(W, cfg, { focus: 'bench' }), so = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
  assert.equal(pb.strength, false); assert.equal(pb.name, 'Пауэрбилдинг: жим лежа');
  assert.equal(daysOf(pb, 'bench_light').length, 1); assert.ok(Core.SLOTS.some(sl => pb.slots[sl.id].some(e => e.pin)), 'в пауэрбилдинге есть закреплённое упражнение третьего дня');
  assert.equal(liftSets(pb, ['bench', 'bench_light']), 7); assert.equal(liftSets(so, ['bench', 'bench_light']), 10);
  assert.equal(daysOf(so, 'bench_light').length, 2);
});

test('с нуля на встроенном списке: выбранное базовое встаёт в понедельник, лёгкие дни — в среду и пятницу', () => {
  const cfg = Core.mergeCfg(withStarter(null));
  for (const [x, order] of [['bench', ['bench', 'leg_press', 'pullup']], ['pullup', ['pullup', 'bench', 'leg_press']]] as [string, string[]][]) {
    const pr = Core.buildProgram([], cfg, { focus: x, strength: true, budget: STRONG.budget });
    shape(cfg, pr, x);
    assert.deepEqual(Core.SLOTS.map(sl => pr0(pr, sl.id)), [[order[0]], [x + '_light', order[1]], [x + '_light', order[2]]]);
    assert.ok(total(pr) <= 80.01);
    for (const m of Core.MUSCLES.filter(v => !cfg.ignore[v.id])) assert.ok((pr.after.pv[m.id] || 0) >= 8 - 0.75, m.n + ': ' + pr.after.pv[m.id]);
    for (const sl of Core.SLOTS) assert.ok(pr.slots[sl.id].every(e => e.isNew), sl.n + ': в программе с нуля всё новое');
  }
  const pr = Core.buildProgram([], cfg, { focus: 'bench', strength: true, budget: STRONG.budget });
  assert.equal(total(pr), 66); assert.equal(span(cfg, pr), '7.5–13');
});

test('после принятого пауэрбилдинга: его лёгкий день остаётся на месте, добавляется один новый, закреплённое упражнение больше не закреплено', () => {
  const raw = seedRaw(), W = seedW(), pb = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench' });
  const cfg = Core.mergeCfg(accepted(raw, pb, { focus: 'bench', others: 'hold' })), was = daysOf(pb, 'bench_light')[0];
  const pr = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
  shape(cfg, pr, 'bench');
  assert.ok(daysOf(pr, 'bench_light').includes(was), 'прежний лёгкий день переехал');
  assert.deepEqual(Object.keys(pr.create).filter(id => id.endsWith('_light')), [], 'лёгкий день уже есть в справочнике');
  for (const sl of Core.SLOTS) for (const e of pr.slots[sl.id]) if (e.ex === 'bench_light') assert.equal(!!e.isNew, sl.id !== was, sl.n + ': новым помечен только добавленный лёгкий день');
});

test('после принятого силового режима: лёгкие дни остальных базовых уходят, у выбранного их становится два', () => {
  const raw = seedRaw(), W = seedW(), all = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { strength: true, budget: 80 });
  const cfg = Core.mergeCfg(accepted(raw, all, { focus: '', others: '', strength: true, lean: true, budget: 80 }));
  const pr = Core.buildProgram(W, cfg, { focus: 'leg_press', strength: true, budget: 80 });
  shape(cfg, pr, 'leg_press');
  assert.ok(titles(pr).includes('Убрано: Жим лежа — лёгкий день') && titles(pr).includes('Убрано: Подтягивания — лёгкий день'), titles(pr).join(' | '));
  assert.ok(daysOf(pr, 'leg_press_light').includes(daysOf(all, 'leg_press_light')[0]), 'прежний лёгкий день жима ногами переехал');
});

test('после принятой «Силы в одном базовом» другие режимы оставляют базовому один лёгкий день: гибрид — дальний от тяжёлого и день «на массу», силовой — по одному каждому, «Равномерно» — ни одного', () => {
  const raw = seedRaw(), W = seedW(), so = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench', strength: true, budget: 80 });
  const cfg = Core.mergeCfg(accepted(raw, so, { focus: 'bench', others: 'hold', strength: true, lean: true, budget: 80 }));
  assert.deepEqual(daysOf(so, 'bench_light'), ['wed', 'fri']);
  const pb = Core.buildProgram(W, cfg, { focus: 'bench' });
  assert.equal(pb.name, 'Пауэрбилдинг: жим лежа'); assert.equal(pb.strength, false);
  assert.deepEqual(daysOf(pb, 'bench_light'), ['fri'], 'остаётся лёгкий день, самый дальний от понедельника');
  assert.ok(titles(pb).includes('Убрано: Жим лежа — лёгкий день в среду'), titles(pb).join(' | '));
  assert.ok(pb.slots.wed.some(e => e.pin), 'в среду — закреплённое упражнение на массу');
  const all = Core.buildProgram(W, cfg, { strength: true, budget: 80 });
  for (const id of LIFTS) assert.equal(daysOf(all, id + '_light').length, 1, id + ': один лёгкий день');
  assert.deepEqual(daysOf(all, 'bench_light'), ['fri']);
  const even = Core.buildProgram(W, cfg, {});
  assert.ok(!Core.SLOTS.some(sl => even.slots[sl.id].some(e => Core.isLight(even.cfg, e.ex))), 'в «Равномерно» лёгких дней нет');
  assert.equal(titles(even).filter(t => t === 'Убрано: Жим лежа — лёгкий день').length, 1, 'об убранном лёгком дне сказано один раз, хотя стоял он в двух днях');
  const other = Core.buildProgram(W, cfg, { focus: 'pullup', strength: true, budget: 80 });
  shape(cfg, other, 'pullup');
  assert.equal(daysOf(other, 'bench_light').length, 0, 'лёгкие дни прежнего базового ушли');
  const again = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
  shape(cfg, again, 'bench');
  assert.deepEqual(daysOf(again, 'bench_light'), ['wed', 'fri']); assert.ok(!Core.SLOTS.some(sl => again.slots[sl.id].some(e => e.ex === 'bench_light' && e.isNew)), 'оба лёгких дня уже стояли: новыми они не помечены');
});

test('два тренировочных дня: лёгкий день один, и сборка так и говорит — «два раза в неделю»; пустой день не занимается', () => {
  const raw = plain(withStarter<Raw>(null));
  const slots: ProgSlots = { mon: [{ ex: 'bench' }, { ex: 'row_machine', n: 3 }, { ex: 'leg_ext', n: 3 }], wed: [{ ex: 'leg_press' }, { ex: 'pulldown', n: 3 }], fri: [] };
  const cfg = Core.mergeCfg(Object.assign(raw, { program: { name: 'Два дня', since: '2099-01-01', made: '2025-11-19', slots } }));
  const pr = Core.buildProgram([], cfg, { focus: 'bench', strength: true, budget: 80 });
  shape(cfg, pr, 'bench', { light: 1 });
  assert.deepEqual(daysOf(pr, 'bench_light'), ['wed']); assert.equal(pr.slots.fri.length, 0);
  const n = pr.notes.find(v => v.t === 'Сила: Жим лежа — два раза в неделю');
  assert.ok(n && n.x!.includes('Лёгкий день — в среду: 3 × 4') && n.x!.includes('Всего 7 подходов движения в неделю') && !n.x!.includes('надёжно не показано'), JSON.stringify(titles(pr)));
});

test('один тренировочный день: лёгкий день поставить некуда — сборка говорит об этом', () => {
  const raw = plain(withStarter<Raw>(null));
  const slots: ProgSlots = { mon: [{ ex: 'bench' }, { ex: 'row_machine', n: 3 }, { ex: 'leg_ext', n: 3 }], wed: [], fri: [] };
  const cfg = Core.mergeCfg(Object.assign(raw, { program: { name: 'Один день', since: '2099-01-01', made: '2025-11-19', slots } }));
  const pr = Core.buildProgram([], cfg, { focus: 'bench', strength: true, budget: 80 });
  shape(cfg, pr, 'bench', { light: 0 });
  assert.deepEqual(Object.keys(pr.create).filter(id => id.endsWith('_light')), []);
  assert.ok(titles(pr).includes('Без лёгкого дня: Жим лежа'), titles(pr).join(' | '));
  assert.ok(pr.slots.wed.length === 0 && pr.slots.fri.length === 0);
});

test('базовое, которое не считается по процентам: режим не включается, собирается «Равномерно»', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  const a = Core.buildProgram(W, cfg, { focus: 'lat_raise_machine', strength: true, budget: 80 }), b = Core.buildProgram(W, cfg, { focus: 'нет такого', strength: true, budget: 80 });
  const all = Core.buildProgram(W, cfg, { strength: true, budget: 80 });
  for (const pr of [a, b]) { assert.equal(pr.focus, null); assert.equal(pr.name, all.name); assert.deepEqual(plain(pr.slots), plain(all.slots)); }
});

test('принятая программа: в понедельник тяжёлый жим 4 × 4 на 83%, в среду и пятницу — лёгкий день 3 × 4 на 78% первым; добавки плана не включены', () => {
  const raw = seedRaw(), W = seedW(), pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench', strength: true, budget: 80 });
  const cfg = Core.mergeCfg(accepted(raw, pr, { focus: 'bench', others: 'hold', since: '2025-11-12', budget: pr.budget, strength: true, lean: true }));
  Core.setTarget(cfg.rir);
  const day = (slot: string) => { const a = Core.adapt(W, cfg, slot, Core.nextDate(slot, '2025-11-12', W)); return { a, items: Core.applyAdapt(a, a.off0).items }; };
  const mon = day('mon'), wed = day('wed'), fri = day('fri');
  assert.equal(mon.items[0].ex, 'bench'); assert.deepEqual(plain(mon.items[0].cyc), { pct: 83, reps: 4 }); assert.equal(mon.items[0].sets.length, 4);
  /* в плане дня порядок тот же, что в программе: лёгкий день первым, жим ногами в среду — после разгибаний ног, где его поставил атлет */
  for (const [d, first] of [[wed, ['bench_light', 'leg_ext', 'leg_press']], [fri, ['bench_light', 'pullup']]] as [typeof wed, string[]][]) {
    const next = first[first.length - 1];
    assert.deepEqual(d.items.slice(0, first.length).map(it => it.ex), first);
    assert.deepEqual(plain(d.items[0].cyc), { pct: 78, reps: 4 }); assert.equal(d.items[0].sets.length, 3);
    assert.equal(d.items[first.length - 1].sets.length, 3, next + ': на поддержании три подхода');
    assert.ok(d.items[0].sets[0].w! > 0 && d.items[0].sets[0].w! < mon.items[0].sets[0].w!, 'лёгкий день легче тяжёлого: ' + d.items[0].sets[0].w + ' против ' + mon.items[0].sets[0].w);
  }
  assert.equal(wed.items[0].sets[0].w, fri.items[0].sets[0].w, 'оба лёгких дня идут от одного максимума');
  for (const d of [mon, wed, fri]) assert.equal(d.a.adds.filter(v => !d.a.off0[v.key]).length, 0, 'добавки плана включены сами');
  /* добавок в этой программе нет вовсе, поэтому то же смотрится на поправках «+подход»: они есть, и ни одна не включена сама */
  const more = [mon, wed, fri].map(d => d.a.props.filter(p => p.sets.length > d.a.base.items[p.idx].sets.length).map(p => !!d.a.off0[p.key]));
  assert.ok(more.some(v => v.length > 0), 'поправок «+подход» нет ни в одном дне: проверять нечего');
  assert.ok(more.every(v => v.every(off => off)), 'поправка «+подход» включена сама: ' + JSON.stringify(more));
});

test('дневник неделей позже: 80 подходов, 10 подходов жима в неделю, мышцы 8–11; у жима ногами квадрицепс не назван «один день в неделю» — и при лимите 50, когда два подхода и больше у него только в среду', () => {
  const p = readJson('data/later.json').profiles.find((v: { id: string }) => v.id === 'me');
  const W: Workout[] = Core.sortW(p.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d))), cfg = Core.mergeCfg(p.config);
  const pr = Core.buildProgram(W, cfg, { focus: 'bench', strength: true, budget: 80 });
  shape(cfg, pr, 'bench');
  assert.equal(total(pr), 80); assert.deepEqual(loads(pr), [28, 28, 24]); assert.equal(span(cfg, pr), '8–11');
  for (const x of ['leg_press', 'pullup']) shape(cfg, Core.buildProgram(W, cfg, { focus: x, strength: true, budget: 80 }), x);
  /* при лимите 80 у квадрицепса два дня с двумя подходами и больше, и правило «основная мышца выбранного базового не названа» ничего не решает.
     При лимите 50 такой день один — день тяжёлого жима ногами: лёгкие дни идут в объём за половину. Здесь правило и работает (проверяет его shape) */
  const low = Core.buildProgram(W, cfg, { focus: 'leg_press', strength: true, budget: 50 });
  assert.deepEqual(Core.SLOTS.filter(sl => ((low.after.day[sl.id] || {}).quads || 0) >= 2 - 0.01).map(sl => sl.id), ['wed'], 'квадрицепс при лимите 50: два подхода и больше не только в среду');
  shape(cfg, low, 'leg_press');
});
