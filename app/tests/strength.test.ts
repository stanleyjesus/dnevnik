/* Силовой режим сборки (решение владельца, 19 ноября 2026; в эталоне его нет): каждое базовое программы идёт два раза в неделю —
   тяжёлый день «сила по запасу» первым в своём дне и лёгкий день в другой день недели, — а подсобка целится на два подхода
   ниже рабочей зоны. Без базовых в программе режим ничего не значит. Числа на примерных данных — те же, что в docs/04, раздел 3.3а. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { STRONG } from '../src/core/strength.ts';
import { withStarter } from '../src/core/starter.ts';
import type { Cfg, ExDef, ProgSlots, Slot, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; zones?: { min: number; opt: number; high: number }; program?: unknown };
const seedRaw = (): Raw => readJson('data/config.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
const total = (pr: { after: { load: Record<string, number> } }) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const span = (cfg: Cfg, pr: { after: { pv: Record<string, number> } }) => { const v = Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => pr.after.pv[m.id] || 0); return Core.fmt(Math.min(...v), 1) + '–' + Core.fmt(Math.max(...v), 1); };
const kinds = (cfg: Cfg, slots: ProgSlots) => Core.SLOTS.map(sl => slots[sl.id].map(e => Core.kindOf(cfg, e.ex)));
const liftSets = (cfg: Cfg, slots: ProgSlots) => Core.SLOTS.flatMap(sl => slots[sl.id]).reduce((a, e) => a + (Core.isLight(cfg, e.ex) ? Core.lightOf(cfg, e.ex).sets : Core.isCycle(cfg, e.ex) ? Core.waveSetsAvg(cfg, e.ex) : 0), 0);
const titles = (pr: { notes: { t: string }[] }) => pr.notes.map(n => n.t);
/* общее для любой сборки режима: базовые первыми, у каждого лёгкий день в другой день, всё на силе по запасу, заметки без «undefined» */
function shape(cfg: Cfg, pr: ReturnType<typeof Core.buildProgram>, lifts: string[]) {
  assert.equal(pr.strength, true); assert.equal(pr.name, 'Сила: базовые два раза в неделю');
  assert.equal(pr.focus, null); assert.equal(pr.prio, ''); assert.equal(pr.others, null);
  assert.deepEqual(plain(pr.goals), Object.fromEntries(lifts.map(id => [id, 'auto'])));
  for (const id of lifts) {
    const home: Slot[] = Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)), light: Slot[] = Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id + '_light'));
    assert.equal(home.length, 1, id + ': тяжёлый день один'); assert.equal(light.length, 1, id + ': лёгкий день один');
    assert.notEqual(home[0].id, light[0].id, id + ': лёгкий день в тот же день, что и тяжёлый');
    assert.equal(pr.cfg.ex[id + '_light'].of, id); assert.equal(pr.cfg.ex[id + '_light'].mode, 'light');
    assert.deepEqual(plain(Core.lightOf(pr.cfg, id + '_light')), { pct: 78, reps: 4, sets: 3 }, id + ': лёгкий день 3 × 4 на 78%');
    const wv = Core.waveOf(pr.cfg, id); assert.ok(wv.auto && wv.sets(4) === 4, id + ': 4 × 4 по запасу');
  }
  for (const k of kinds(pr.cfg, pr.slots)) {
    const lastLift = Math.max(k.lastIndexOf('base'), k.lastIndexOf('light')), firstRest = k.findIndex(x => x !== 'base' && x !== 'light');
    assert.ok(firstRest < 0 || lastLift < firstRest, 'базовые и лёгкие дни стоят не первыми: ' + k.join(','));
    assert.ok(k.lastIndexOf('base') < 0 || k.indexOf('light') < 0 || k.lastIndexOf('base') < k.indexOf('light'), 'лёгкий день стоит раньше тяжёлого базового: ' + k.join(','));
  }
  assert.equal(liftSets(pr.cfg, pr.slots), lifts.length * 7, 'базовых подходов в неделю: по 4 тяжёлых и 3 лёгких на упражнение');
  assert.ok(!pr.notes.some(n => (n.t + n.x).includes('undefined')), 'в заметках «undefined»: ' + JSON.stringify(pr.notes.filter(n => (n.t + n.x).includes('undefined'))));
  assert.ok(titles(pr).some(t => t.startsWith('Сила: ') && t.endsWith(' — два раза в неделю')), titles(pr).join(' | '));
  for (const m of Core.MUSCLES.filter(x => cfg.ignore[x.id])) assert.ok(!(pr.after.pv[m.id] > 0) || lifts.some(id => (cfg.ex[id].m[m.id] || 0) > 0), m.n + ' вне расчёта получила подходы подсобки');
}

test('числа режима: подсобка на два подхода ниже рабочей зоны, лимит недели по умолчанию 80, одно базовое на силу — три дня в неделю', () => {
  assert.deepEqual(plain(STRONG), { under: 2, budget: 80, days: 3 });
});

test('примерные данные, лимит 80: по одному тяжёлому и одному лёгкому базовому в день, подсобка 7.8–11.5, всего 80 подходов', () => {
  const cfg = Core.mergeCfg(seedRaw()), pr = Core.buildProgram(seedW(), cfg, { strength: true, budget: 80 });
  shape(cfg, pr, ['bench', 'leg_press', 'pullup']);
  assert.deepEqual(Core.SLOTS.map(sl => pr.slots[sl.id].slice(0, 2).map(e => e.ex)), [['bench', 'leg_press_light'], ['leg_press', 'pullup_light'], ['pullup', 'bench_light']]);
  assert.deepEqual(Object.keys(pr.create).filter(id => id.endsWith('_light')).sort(), ['bench_light', 'leg_press_light', 'pullup_light']);
  assert.equal(total(pr), 80); assert.equal(span(cfg, pr), '7.8–11.5');
  assert.deepEqual(Core.SLOTS.map(sl => pr.after.load[sl.id]), [28, 27, 25]);
  assert.deepEqual(Core.SLOTS.map(sl => Core.fmtDur(Core.estMinutes(pr.cfg, pr.slots[sl.id], cfg.rest))), ['1 ч 35 мин', '1 ч 35 мин', '1 ч 30 мин']);
  assert.ok(titles(pr).includes('Жим ногами — первым упражнением в среду'), 'жим ногами стоял вторым — сказано, что он переехал вперёд');
  assert.ok(titles(pr).includes('Лёгкие дни: Жим лежа — в пятницу, Жим ногами — в понедельник, Подтягивания — в среду'));
  const sub = pr.notes.find(n => n.t.startsWith('Подсобка — '));
  assert.equal(sub && sub.t, 'Подсобка — от 7.8 до 11.5 подходов на мышцу');
  assert.ok(sub!.x!.includes('в 8 подходов в неделю вместо 10') && sub!.x!.includes('Всего 80 подходов при лимите 80'), String(sub!.x));
  /* сила и масса: у груди сила — 4 тяжёлых подхода жима целиком и 3 лёгких за половину */
  assert.equal((pr.after.ps || {}).chest, 5.5);
});

test('примерные данные, другие лимиты: 60 → 60 подходов и 5.8–8.8; 70 → 70 и 7.5–9.8; 100 → 81 и 7.8–10.8 — выше своей цели подсобка не идёт', () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  for (const [budget, sets, range] of [[60, 60, '5.8–8.8'], [70, 70, '7.5–9.8'], [100, 81, '7.8–10.8']] as [number, number, string][]) {
    const pr = Core.buildProgram(W, cfg, { strength: true, budget });
    shape(cfg, pr, ['bench', 'leg_press', 'pullup']);
    assert.equal(total(pr), sets, 'лимит ' + budget); assert.equal(span(cfg, pr), range, 'лимит ' + budget);
    assert.ok(total(pr) <= budget + 0.01);
  }
  const low = Core.buildProgram(W, cfg, { strength: true, budget: 60 }), n = low.notes.find(x => x.t.startsWith('Подсобка — ') || x.t.startsWith('Не дотянуты'));
  assert.ok(n && (n.t.startsWith('Не дотянуты') || n.x!.includes('не хватает лимита 60 подходов в неделю')), JSON.stringify(n));
});

test('с нуля на встроенном списке: базовые встают сами, у каждого тяжёлый и лёгкий день', () => {
  const cfg = Core.mergeCfg(withStarter(null)), pr = Core.buildProgram([], cfg, { strength: true, budget: STRONG.budget });
  shape(cfg, pr, ['bench', 'leg_press', 'pullup']);
  assert.deepEqual(Core.SLOTS.map(sl => pr.slots[sl.id].slice(0, 2).map(e => e.ex)), [['bench', 'leg_press_light'], ['leg_press', 'pullup_light'], ['pullup', 'bench_light']]);
  assert.ok(total(pr) <= 80.01);
  for (const m of Core.MUSCLES.filter(x => !cfg.ignore[x.id])) assert.ok((pr.after.pv[m.id] || 0) >= 8 - 0.75, m.n + ': ' + pr.after.pv[m.id]);
  for (const sl of Core.SLOTS) assert.ok(pr.slots[sl.id].every(e => e.isNew), sl.n + ': в программе с нуля всё новое');
});

test('лёгкий день, который у базового уже есть, остаётся на месте; остальным он добавляется', () => {
  const raw = seedRaw(), W = seedW(), pb = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { focus: 'bench' });
  /* принятый пауэрбилдинг вокруг жима лежа: в справочнике и в программе есть его лёгкий день */
  const r2 = plain(raw); Object.assign(r2.ex, plain(pb.create));
  for (const [id, g] of Object.entries(pb.goals)) { if (g) r2.ex[id].goal = g; else delete r2.ex[id].goal; }
  const slots: ProgSlots = {}; for (const sl of Core.SLOTS) slots[sl.id] = pb.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r2.program = { name: pb.name, focus: 'bench', others: 'hold', since: '2099-01-01', made: '2025-11-12', slots };
  const cfg = Core.mergeCfg(r2), was = Core.SLOTS.find(sl => slots[sl.id].some(e => e.ex === 'bench_light'))!.id;
  const pr = Core.buildProgram(W, cfg, { strength: true, budget: 80 });
  shape(cfg, pr, ['bench', 'leg_press', 'pullup']);
  assert.equal(Core.SLOTS.find(sl => pr.slots[sl.id].some(e => e.ex === 'bench_light'))!.id, was, 'лёгкий день жима переехал');
  assert.ok(!titles(pr).some(t => t.startsWith('Убрано: ')), 'лёгкий день убран: ' + titles(pr).join(' | '));
  assert.deepEqual(Object.keys(pr.create).filter(id => id.endsWith('_light')).sort(), ['leg_press_light', 'pullup_light'], 'заведены только недостающие лёгкие дни');
  assert.ok(titles(pr).some(t => t.startsWith('Лёгкие дни: ') && !t.includes('Жим лежа')), titles(pr).join(' | '));
});

test('два базовых в программе: оба дважды в неделю, лёгкий день не в день своего тяжёлого', () => {
  const raw = seedRaw(); delete raw.ex.pullup.mode;                    // подтягивания — обычное упражнение двойной прогрессии
  const cfg = Core.mergeCfg(raw), pr = Core.buildProgram(seedW(), cfg, { strength: true, budget: 80 });
  shape(cfg, pr, ['bench', 'leg_press']);
  assert.ok(Core.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === 'pullup' && e.n)) || !Core.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === 'pullup')), 'подтягивания остались подсобкой с числом подходов или убраны сборкой');
});

test('один тренировочный день: лёгкий день поставить некуда — сборка говорит об этом, а не обещает два раза в неделю молча', () => {
  const raw = plain(withStarter<Raw>(null));
  const slots: ProgSlots = { mon: [{ ex: 'bench' }, { ex: 'row_machine', n: 3 }, { ex: 'leg_ext', n: 3 }], wed: [], fri: [] };
  const cfg = Core.mergeCfg(Object.assign(raw, { program: { name: 'Один день', since: '2099-01-01', made: '2025-11-19', slots } }));
  const pr = Core.buildProgram([], cfg, { strength: true, budget: 80 });
  assert.equal(pr.strength, true);
  assert.deepEqual(plain(pr.goals), { bench: 'auto' });
  assert.ok(!Core.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === 'bench_light')), 'лёгкий день встал в день тяжёлого или в пустой день');
  assert.deepEqual(Object.keys(pr.create).filter(id => id.endsWith('_light')), []);
  const n = pr.notes.find(x => x.t.startsWith('Без лёгкого дня'));
  assert.equal(n && n.t, 'Без лёгкого дня: Жим лежа');
  assert.ok(pr.slots.wed.length === 0 && pr.slots.fri.length === 0, 'пустые дни сборка не занимает: тренировочных дней атлет выбрал один');
});

test('без базовых в программе режим ничего не значит: сборка та же, что «Равномерно»', () => {
  const raw = readJson('data/config.p2.stored.json'), cfg = Core.mergeCfg(plain(raw));
  for (const budget of [60, 80]) {
    const a = Core.buildProgram([], cfg, { strength: true, budget }), b = Core.buildProgram([], cfg, { budget });
    assert.equal(a.strength, false); assert.equal(a.name, 'Равномерно на всё тело');
    assert.deepEqual(plain([a.slots, a.notes, a.goals, a.create]), plain([b.slots, b.notes, b.goals, b.create]));
  }
});

test('свои границы зон: цель подсобки — на два подхода ниже начала рабочей зоны, но не ниже минимума', () => {
  const raw = seedRaw(); raw.zones = { min: 5, opt: 9, high: 18 };
  const pr = Core.buildProgram(seedW(), Core.mergeCfg(raw), { strength: true, budget: 80 }), n = pr.notes.find(x => x.t.startsWith('Подсобка — '));
  assert.ok(n && n.x!.includes('в 7 подходов в неделю вместо 9'), JSON.stringify(n));
  const tight = seedRaw(); tight.zones = { min: 9, opt: 10, high: 20 };
  const p2 = Core.buildProgram(seedW(), Core.mergeCfg(tight), { strength: true, budget: 100 }), n2 = p2.notes.find(x => x.t.startsWith('Подсобка — ') || x.t.startsWith('Не дотянуты'));
  assert.ok(n2 && (n2.t.startsWith('Не дотянуты') || n2.x!.includes('в 9 подходов в неделю вместо 10')), JSON.stringify(n2));
});

test('принятая программа: план дня — тяжёлое базовое 4 × 4 на 83% и чужой лёгкий день 3 × 4 на 78%; добавки плана не включены', () => {
  const raw = seedRaw(), W = seedW(), pr = Core.buildProgram(W, Core.mergeCfg(plain(raw)), { strength: true, budget: 80 });
  /* так программу принимает экран (acceptProgram) */
  const r2 = plain(raw); Object.assign(r2.ex, plain(pr.create));
  for (const [id, g] of Object.entries(pr.goals)) { if (g) r2.ex[id].goal = g; else delete r2.ex[id].goal; }
  const slots: ProgSlots = {}; for (const sl of Core.SLOTS) slots[sl.id] = pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r2.program = { name: pr.name, focus: '', others: '', since: '2025-11-12', made: '2025-11-12', slots, budget: pr.budget, strength: true, lean: true };
  const cfg = Core.mergeCfg(r2), want: Record<string, [string, string]> = { mon: ['bench', 'leg_press_light'], wed: ['leg_press', 'pullup_light'], fri: ['pullup', 'bench_light'] };
  Core.setTarget(cfg.rir);
  for (const sl of Core.SLOTS) {
    const date = Core.nextDate(sl.id, '2025-11-12', W), a = Core.adapt(W, cfg, sl.id, date), items = Core.applyAdapt(a, a.off0).items;
    assert.deepEqual(items.slice(0, 2).map(it => it.ex), want[sl.id], sl.n);
    assert.deepEqual(plain(items[0].cyc), { pct: 83, reps: 4 }); assert.equal(items[0].sets.length, 4);
    assert.deepEqual(plain(items[1].cyc), { pct: 78, reps: 4 }); assert.equal(items[1].sets.length, 3);
    assert.ok(items[0].sets[0].w! > 0 && items[0].sets.every(s => s.w === items[0].sets[0].w), 'тяжёлый день — одним весом');
    assert.equal(a.adds.filter(x => !a.off0[x.key]).length, 0, sl.n + ': добавки плана включены сами');
  }
  /* лёгкий день идёт от максимума своего базового: 78% против 83% */
  const mon = Core.applyAdapt(Core.adapt(W, cfg, 'mon', Core.nextDate('mon', '2025-11-12', W)), {}).items, wed = Core.applyAdapt(Core.adapt(W, cfg, 'wed', Core.nextDate('wed', '2025-11-12', W)), {}).items;
  assert.ok(mon[1].sets[0].w! < wed[0].sets[0].w!, 'лёгкий день жима ногами легче тяжёлого: ' + mon[1].sets[0].w + ' против ' + wed[0].sets[0].w);
});

test('дневник неделей позже: 80 подходов при лимите 80, 21 базовый, подсобка 7.8–11.5', () => {
  const p = readJson('data/later.json').profiles.find((x: { id: string }) => x.id === 'me');
  const W: Workout[] = Core.sortW(p.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d))), cfg = Core.mergeCfg(p.config), pr = Core.buildProgram(W, cfg, { strength: true, budget: 80 });
  shape(cfg, pr, ['bench', 'leg_press', 'pullup']);
  assert.equal(total(pr), 80); assert.equal(span(cfg, pr), '7.8–11.5');
  assert.deepEqual(Core.SLOTS.map(sl => pr.slots[sl.id].slice(0, 2).map(e => e.ex)), [['bench', 'leg_press_light'], ['leg_press', 'pullup_light'], ['pullup', 'bench_light']]);
});
