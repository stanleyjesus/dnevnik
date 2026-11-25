/* Правила приложения, которых в эталоне нет (решения владельца, 23 ноября 2026): rules.ts.
   Они действуют с днями «День 1…N» — так приложение открывает любой профиль. С таблицей дней эталона всё считается как в эталоне.
   Числа на примерных данных — те же, что в docs/04 (разделы 3.2 и 3.7). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ref, plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { ADDS } from '../src/core/adapt.ts';
import { LIB } from '../src/core/program.ts';
import { EVEN, RDL_M, REST, TIMES, TIME_EX, appRules, fillTop, inTime, isRdl, moreTime, restOf, restWords } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, MuscleMap, ProgSlots, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef> };
type Built = ReturnType<typeof Core.buildProgram>;
const OLD: MuscleMap = { hams: 1, glutes: 1, erectors: 1 };
/* с днями «День N» хват — половина подхода предплечьям в тягах и становых (вывод 2 аудита, решение владельца 25 ноября 2026; audit.test.ts) */
const GRIP = (m: MuscleMap): MuscleMap => Object.assign({}, m, { forearms: 0.5 }), RDL_A = GRIP(RDL_M);
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedRaw = (): Raw => readJson('data/config.json'), p2Raw = (): Raw => readJson('data/config.p2.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
/* справочник так, как его читает приложение: с днями «День N» (предплечья вне расчёта — вывод 2 аудита). Не вызывать внутри withDays */
const appCfg = (raw: Parameters<typeof Core.mergeCfg>[0]): Cfg => withDays(3, () => Core.mergeCfg(raw));
const total = (pr: Built) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const spanOf = (pr: Built, ids: string[]) => { const v = ids.map(m => pr.after.pv[m] || 0); return Core.fmt(Math.min(...v), 1) + '–' + Core.fmt(Math.max(...v), 1); };
const has = (pr: Built, id: string) => Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)).length;
const noteOf = (pr: Built, re: RegExp) => pr.notes.find(n => re.test(n.t));
const rdlOf = () => (ADDS.find(a => a.key === 'rdl')!.def as ExDef).m, libOf = () => LIB.find(L => L.id === 'x_rdl')!.def.m;

test('с таблицей дней эталона румынская тяга — как в эталоне: разгибатели в ней основные', () => {
  assert.equal(appRules(), false);
  assert.deepEqual(plain(Core.mergeCfg(p2Raw()).ex.rdl.m), OLD, 'сохранённый справочник');
  for (const name of ['Румынская тяга', 'Румынская тяга с гантелями', 'Тяга на прямых ногах', 'Становая тяга']) assert.deepEqual(plain(Core.guessEx(name)), plain(Ref.guessEx(name)), name);
  assert.deepEqual([plain(rdlOf()), plain(libOf())], [OLD, OLD], 'поправка «добавь румынскую тягу» и румынская тяга в списке сборки — как в reference/src/core.js');
  assert.deepEqual(plain(Core.mergeCfg(withStarter(null)).ex.rdl.m), OLD, 'встроенный справочник');
});

test('с днями «День N» в румынской тяге и тяге на прямых ногах разгибатели помогают; становая и гуд морнинг — как были, у тяг — хват', () => withDays(3, () => {
  assert.equal(appRules(), true);
  for (const name of ['Румынская тяга', 'Румынская тяга с гантелями', 'Тяга на прямых ногах', 'Мёртвая тяга со штангой', 'RDL']) {
    assert.ok(isRdl(name), name);
    assert.deepEqual(plain(Core.guessEx(name)!.m), RDL_A, name);
  }
  for (const name of ['Гуд морнинг', 'Гиперэкстензия']) { assert.ok(!isRdl(name), name); assert.deepEqual(plain(Core.guessEx(name)), plain(Ref.guessEx(name)), name); }
  assert.ok(!isRdl('Становая тяга')); assert.deepEqual(plain(Core.guessEx('Становая тяга')!.m), GRIP(plain(Ref.guessEx('Становая тяга')!.m)), 'становая — как была, с хватом');
  assert.deepEqual(plain(rdlOf()), RDL_A, 'поправка «добавь румынскую тягу»'); assert.deepEqual(plain(libOf()), RDL_A, 'румынская тяга в списке сборки');
  /* встроенный справочник: румынские тяги помогают, становая — нет */
  const st = Core.mergeCfg(withStarter(null)).ex;
  assert.deepEqual([plain(st.rdl.m), plain(st.db_rdl.m), plain(st.deadlift.m)], [RDL_A, RDL_A, GRIP(OLD)]);
}));

test('сохранённый справочник: румынская тяга с картой прежнего правила читается по-новому, своя карта атлета и хранилище не меняются', () => withDays(3, () => {
  const raw = p2Raw(); raw.ex.mine = { n: 'Румынская тяга на одной ноге', pat: 'hinge', m: { hams: 1, glutes: 0.5, erectors: 1 } };
  const before = JSON.stringify(raw), cfg = Core.mergeCfg(raw);
  assert.deepEqual(plain(cfg.ex.rdl.m), RDL_A);
  assert.deepEqual(plain(cfg.ex.mine.m), { hams: 1, glutes: 0.5, erectors: 1 }, 'карту, которую атлет поменял сам, дневник не трогает');
  assert.deepEqual(plain(cfg.ex.back_ext.m), plain(raw.ex.back_ext.m), 'гиперэкстензия — как была');
  assert.equal(JSON.stringify(raw), before, 'справочник в хранилище переписан');
  assert.deepEqual([cfg.ex.rdl.n, cfg.ex.rdl.pat], [raw.ex.rdl.n, raw.ex.rdl.pat], 'остальные поля упражнения — как были');
}));

test('разгибатели вне расчёта: сборка не убирает румынскую тягу, подходов разгибателям не выделяет — им достаются только косвенные', () => {
  const week = Core.buildProgram([], Core.mergeCfg(p2Raw()), {});
  assert.equal(has(week, 'rdl'), 0, 'таблица дней эталона: тяги в программе нет, как в эталоне');
  assert.equal(week.after.pv.erectors || 0, 0);
  withDays(3, () => {
    const cfg = Core.mergeCfg(p2Raw());
    assert.ok(cfg.ignore.erectors, 'у второго профиля разгибатели вне расчёта');
    for (const [W, raw, opts] of [[[], p2Raw, {}], [[], p2Raw, { prio: 'legs' }], [seedW(), seedRaw, {}], [seedW(), seedRaw, { prio: 'legs' }], [[], () => withStarter(null), {}]] as [Workout[], () => Raw, BuildOpts][]) {
      const c = Core.mergeCfg(raw()), pr = Core.buildProgram(W, c, opts);
      for (const sl of Core.SLOTS) for (const e of pr.slots[sl.id]) {
        if (Core.isCycle(pr.cfg, e.ex) || Core.isLight(pr.cfg, e.ex)) continue;
        for (const [m, k] of Object.entries(pr.cfg.ex[e.ex].m || {})) assert.ok(!(c.ignore[m] && k >= 1), Core.exName(pr.cfg, e.ex) + ': мышца вне расчёта — основная (' + m + ')');
      }
      if (raw === p2Raw && !opts.prio) assert.equal(has(pr, 'rdl'), 1, 'румынская тяга из справочника осталась в программе');
    }
  });
});

test('приоритет «Ноги и ягодицы» на примерных данных добирает свою долю: 91 подход, приоритет 15–16 (без правила — 86 и 11.3–12)', () => {
  const W = seedW(), legs = ['quads', 'hams', 'glutes'];
  const week = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { prio: 'legs' });
  assert.deepEqual([total(week), spanOf(week, legs)], [86, '11.3–12'], 'таблица дней эталона — как в эталоне');
  withDays(3, () => {
    const cfg = Core.mergeCfg(seedRaw()), pr = Core.buildProgram(W, cfg, { prio: 'legs' });
    assert.deepEqual([total(pr), spanOf(pr, legs)], [91, '15–16']);
    /* румынская тяга в программе; с 25 ноября 2026 во втором дне её два подхода забрал ягодичный мост — одно упражнение вместо двух (вывод 8 аудита) */
    assert.equal(has(pr, 'x_rdl'), 1, 'румынская тяга в программе');
    assert.ok(pr.notes.some(n => n.t === 'Одно упражнение вместо двух') || pr.slots.wed.some(e => e.ex === 'x_thrust' && e.n === 5), pr.notes.map(n => n.t).join(' | '));
  });
});

test('в один день сборка не ставит второе упражнение с теми же мышцами: подходы прибавляются в том, что уже стоит', () => {
  const sameM = (a: MuscleMap, b: MuscleMap) => JSON.stringify(Object.entries(a).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b).filter(x => x[1] > 0).sort());
  for (const n of [2, 3, 4]) withDays(n, () => {
    const cfg = Core.mergeCfg(withStarter(null));
    for (const opts of [{}, { prio: 'legs' }, { prio: 'back' }, { budget: 70 }, { focus: 'bench' }, { strength: true }, { focus: 'bench', strength: true }] as BuildOpts[]) {
      const pr = Core.buildProgram([], cfg, opts);
      for (const sl of Core.SLOTS) {
        const L = pr.slots[sl.id].filter(e => e.n && !pr.cfg.ex[e.ex].uni);
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) assert.ok(!sameM(pr.cfg.ex[L[i].ex].m || {}, pr.cfg.ex[L[j].ex].m || {}), n + ' дня, ' + JSON.stringify(opts) + ', ' + sl.n + ': ' + L[i].ex + ' и ' + L[j].ex);
      }
    }
  });
  /* на встроенном списке с приоритетом ног без этого правила в один день вставали две румынские тяги и две горизонтальные тяги: 87 подходов, приоритет 15–20 (docs/04, раздел 3.8) */
  /* с 25 ноября 2026 в «Массе» с мышцами в приоритете базовые справочника с нуля сами не встают; предплечья вне расчёта (вывод 2 аудита): 79 подходов */
  withDays(3, () => { const pr = Core.buildProgram([], Core.mergeCfg(withStarter(null)), { prio: 'legs' }); assert.deepEqual([total(pr), spanOf(pr, ['quads', 'hams', 'glutes'])], [79, '15–15.5']); });
});

test('заметка называет настоящую причину: при свободных подходах не советует увеличить лимит недели', () => {
  const W = seedW();
  /* таблица дней эталона: как в эталоне — причина берётся из первой попытки */
  const ref = Ref.buildProgram(W, Ref.mergeCfg(seedRaw()), { prio: 'legs' }), week = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { prio: 'legs' });
  assert.deepEqual(plain(week.notes), plain(ref.notes));
  withDays(2, () => {
    /* два дня, лимит 80: занято 68 — мешают девять упражнений в дне */
    const pr = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { budget: 80 }), n = noteOf(pr, /^Нагрузка поровну/)!;
    assert.equal(total(pr), 68);
    assert.ok(n.x!.includes('грудь выше не поднять — в каждой тренировке уже по девять упражнений. Поэтому уровень общий, но ниже. Лимит недели тут ни при чём: занято 68 подходов из 80. Поможет ещё один тренировочный день.'), String(n.x));
    assert.ok(!/увеличь лимит|не хватает лимита|Лимита \d+ подходов в неделю не хватает/.test(n.x!), String(n.x));
    /* второй профиль, приоритет «Грудь и плечи», лимит 70: занято 50 — мешает лимит на мышцу за тренировку */
    const ch = Core.buildProgram([], Core.mergeCfg(p2Raw()), { prio: 'chest', budget: 70 }), c = noteOf(ch, /^Приоритет/)!;
    assert.equal(total(ch), 50);
    assert.ok(c.x!.includes('грудь выше не поднять — упражнения на неё уже по пять подходов или упираются в лимит 11 подходов на мышцу за тренировку. Уровни ниже, пропорция та же. Лимит недели тут ни при чём: занято 50 подходов из 70.'), String(c.x));
    /* следующему уровню и правда не хватает лимита — так и сказано: «Верх тела» с лимитом 60 (с предплечьями вне расчёта лимита 70 уже хватает) */
    const up = Core.buildProgram([], Core.mergeCfg(p2Raw()), { prio: 'upper', budget: 60 }), u = noteOf(up, /^Приоритет/)!;
    assert.ok(u.x!.includes('Лимита 60 подходов в неделю не хватает') && u.x!.includes('увеличь лимит недели'), String(u.x));
  });
  withDays(3, () => {
    /* упражнений мало, а дни не заполнены: поможет ещё одно упражнение в справочнике */
    const raw = p2Raw(); delete raw.ex.chest_press;
    const pr = Core.buildProgram([], Core.mergeCfg(raw), { prio: 'chest' }), n = noteOf(pr, /^Приоритет/)!;
    assert.ok(n.x!.includes('грудь выше не поднять — упражнения на неё уже по пять подходов или упираются в лимит 11 подходов на мышцу за тренировку. Уровни ниже, пропорция та же. Лимит недели тут ни при чём: занято ' + Core.nSets(total(pr)) + ' из 100. Поможет ещё одно упражнение на эту мышцу в справочнике.'), String(n.x));
  });
});

test('сборка, где все мышцы в рабочей зоне: о причине ничего не сказано', () => withDays(3, () => {
  const cfg: Cfg = Core.mergeCfg(seedRaw()), pr = Core.buildProgram(seedW(), cfg, {});
  assert.ok(noteOf(pr, /^(Все мышцы в рабочей зоне|Нагрузка поровну)/), pr.notes.map(n => n.t).join(' | '));
  assert.ok(!pr.notes.some(n => /ни при чём/.test(n.x || '')));
}));

test('группа «Плечи» в приоритете: три пучка дельт без груди, в полтора раза выше остальных — 15–15.5 при остальных 10–12.5', () => {
  const g = ['delt_front', 'delt_mid', 'delt_rear'], W = seedW();
  assert.deepEqual(plain(Core.PRIOS.find(x => x.id === 'delts')), { id: 'delts', n: 'Плечи', m: g });
  assert.deepEqual(Core.PRIOS.map(x => x.id), ['legs', 'glutes', 'upper', 'back', 'chest', 'delts', 'arms'], 'плечи — сразу за грудью и плечами');
  /* группы эталона — те же */
  assert.deepEqual(plain(Core.PRIOS.filter(x => x.id !== 'delts')), plain(Ref.PRIOS));
  const check = (pr: Built, cfg: Cfg, prio: string, rest: string, sets: number) => {
    const others = Core.MUSCLES.map(m => m.id).filter(m => !cfg.ignore[m] && !g.includes(m));
    assert.deepEqual([spanOf(pr, g), spanOf(pr, others), total(pr)], [prio, rest, sets]);
    assert.equal(pr.name, 'Приоритет: плечи'); assert.deepEqual(Core.ruleBreaks(pr.cfg, pr.after), []);
    assert.ok(noteOf(pr, /^Приоритет — /)!.x!.startsWith('Приоритетные мышцы (передние дельты, средние дельты и задние дельты) получают примерно в полтора раза больше остальных'));
  };
  { const cfg = Core.mergeCfg(seedRaw()); check(Core.buildProgram(W, cfg, { prio: 'delts' }), cfg, '15–15.3', '9.7–12.8', 100); }
  withDays(3, () => { const cfg = Core.mergeCfg(seedRaw()); check(Core.buildProgram(W, cfg, { prio: 'delts' }), cfg, '15–15.5', '10–12.5', 92); });
});

test('баланс движений не считается: с днями «День N» нет замечания «В программе нет …» и поправок «добавь румынскую тягу / жим над головой» ради него', () => {
  const later = readJson('data/later.json').profiles[0];
  const cases: [string, Workout[], Raw][] = [['примерные данные', seedW(), seedRaw()], ['неделей позже', Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d))), later.config]];
  const look = (W: Workout[], raw: Raw) => {
    const c0 = Core.mergeCfg(raw), cfg = c0.start ? c0 : Object.assign({}, c0, { start: Core.mondayOf(W[0].date) });
    const ins = Core.insights({ workouts: W, cfg, body: [], today: '2025-11-12' } as Parameters<typeof Core.insights>[0]);
    const adds = Core.additions(W, cfg, Core.planned(W, cfg));
    return { bal: ins.filter(i => i.cat === 'Баланс').map(i => i.title), adds: Core.SLOTS.flatMap(sl => adds[sl.id].map(a => a.a.key)) };
  };
  for (const [name, W, raw] of cases) {
    const week = look(W, raw);
    assert.ok(week.bal.includes('В программе нет вертикального жима и тяги с наклоном'), name + ': таблица дней эталона — как в эталоне');
    assert.ok(week.adds.includes('rdl') && week.adds.includes('ohp'), name + ': ' + week.adds.join(', '));
    withDays(3, () => {
      const app = look(W, raw);
      assert.ok(!app.bal.some(t => t.startsWith('В программе нет')), name + ': ' + app.bal.join(' | '));
      assert.ok(!app.adds.includes('rdl') && !app.adds.includes('ohp'), name + ': ' + app.adds.join(', '));
      assert.ok(app.adds.includes('rear'), name + ': поправки по объёму мышц остаются');
      /* разница сторон — не баланс движений: замечание остаётся (процент — от максимума по подходам, он с днями «День N» свой) */
      const side = (l: string[]) => l.map(t => t.replace(/ на [\d.]+%$/, ''));
      assert.deepEqual(side(app.bal), side(week.bal.filter(t => !t.startsWith('В программе нет'))), name);
    });
  }
});

/* ---------- отдых между подходами дневник ставит упражнению сам (просьба владельца, 25 ноября 2026) ---------- */

test('отдых между подходами — по упражнению: тяжёлый день 5 мин, лёгкий день и тяжёлый день изоляции 3 мин, многосуставные со штангой 2 мин 30 с, остальные 2 мин', () => {
  assert.deepEqual(REST, { heavy: 300, light: 180, free: 150, other: 120, iso: 120 });
  assert.deepEqual([300, 180, 150, 120].map(restWords), ['5 мин', '3 мин', '2 мин 30 с', '2 мин']);
  const cfg = Core.mergeCfg(withStarter(null));
  withDays(3, () => {
    const bench = Core.buildProgram([], cfg, { focus: 'bench', strength: true }), curl = Core.buildProgram([], cfg, { focus: 'barbell_curl', strength: true });
    const of = (pr: Built, ids: string[]) => ids.map(id => restOf(pr.cfg, id));
    /* цель «Силы»: тяжёлый день и лёгкий; у изоляции в силовой роли тяжёлый день — 3 × 6 на 79%, отдых как у лёгкого */
    assert.deepEqual([of(bench, ['bench', 'bench_light']), of(curl, ['barbell_curl', 'barbell_curl_light'])], [[300, 180], [180, 180]]);
    /* остальное — по типу упражнения: штанга и тяга от пола с гантелями — 2 мин 30 с, тренажёр, блок, гантели, вес тела и изоляция — 2 мин; ягодичный мост и гиперэкстензия — не «свободный вес» */
    assert.deepEqual(of(bench, ['squat', 'rdl', 'db_rdl', 'ohp', 'leg_press', 'pullup', 'db_ohp', 'hip_thrust', 'back_ext', 'lat_raise', 'skullcrusher']), [150, 150, 150, 150, 120, 120, 120, 120, 120, 120, 120]);
    /* время тренировки берёт отдых упражнения, а не профиля: с отдыхом профиля 1:00 и 3:00 — одно и то же */
    const items = [{ ex: 'squat', n: 3 }, { ex: 'lat_raise', n: 3 }], fast = Core.mergeCfg(withStarter(null)); fast.rest = 60;
    assert.equal(Math.round(Core.estMinutes(cfg, items) * 60), 300 + 2 * 60 + 3 * (40 + 150) + 3 * (40 + 120));
    assert.deepEqual([Core.estMinutes(fast, items), Core.estMinutes(cfg, items, 180)], [Core.estMinutes(cfg, items), Core.estMinutes(cfg, items)]);
    /* у пары сторон отдых между сторонами — половина */
    assert.equal(Math.round(Core.estMinutes(cfg, [{ ex: 'wrist_db_r', n: 2 }]) * 60), 300 + 60 + 2 * (40 + 60));
  });
  /* с таблицей дней эталона — отдых профиля, как в эталоне */
  const ref = Core.mergeCfg(withStarter(null));
  assert.notEqual(Core.estMinutes(ref, [{ ex: 'squat', n: 3 }], 60), Core.estMinutes(ref, [{ ex: 'squat', n: 3 }], 180));
  assert.equal(Math.round(Core.estMinutes(ref, [{ ex: 'squat', n: 3 }], 90) * 60), 300 + 60 + 3 * (40 + 90));
});

/* ---------- упражнений в дне — от времени на тренировку (решение владельца, 23 ноября 2026) ---------- */

test('время сравнивается так, как оно показано в заголовке дня; следующее время — следующий пункт списка', () => {
  assert.deepEqual(TIMES, [60, 75, 90, 105, 120, 135, 150]);   // до 2 ч 30 мин — просьба владельца, 25 ноября 2026
  assert.deepEqual([102.4, 102.5, 107.4, 107.5].map(m => inTime(m, 105)), [true, true, true, false], '107 минут показаны как 1 ч 45 мин — укладываются');
  assert.deepEqual([60, 75, 90, 105, 120, 135, 150, 45].map(moreTime), [75, 90, 105, 120, 135, 150, 0, 60]);
});

test('с таблицей дней эталона время сборку не меняет: в дне девять упражнений, как в эталоне', () => {
  const W = seedW(), cfg = Core.mergeCfg(seedRaw());
  for (const opts of [{}, { prio: 'legs' }, { focus: 'bench' }] as BuildOpts[])
    assert.deepEqual(plain(Core.buildProgram(W, cfg, Object.assign({ time: 120 }, opts))), plain(Core.buildProgram(W, cfg, opts)), JSON.stringify(opts));
});

test('с днями «День N» и выбранным временем день заполняется до этого времени, а не до девяти упражнений: два дня, 2 ч — десять упражнений в дне, у каждой мышцы два дня, и так от 1 ч 15 мин', () => withDays(2, () => {
  const W = seedW(), cfg = Core.mergeCfg(seedRaw()), dayEx = (pr: Built) => Math.max(...Core.SLOTS.map(sl => pr.slots[sl.id].length));
  const mins = (pr: Built) => Core.SLOTS.map(sl => Core.fmtDur(Core.estMinutes(pr.cfg, pr.slots[sl.id])));
  const twoDays = (pr: Built) => Core.MUSCLES.filter(m => !cfg.ignore[m.id]).every(m => Core.SLOTS.filter(sl => (pr.after.day[sl.id][m.id] || 0) >= 2 - 0.01).length >= 2);
  /* без времени — как было: девять мест в дне, и второй день достался не всем. В «Массе» базовыми не жертвуют (пункт 8, 24 ноября 2026): подтягивания стоят в дне 2 вместе с жимом ногами */
  const free = Core.buildProgram(W, cfg, {});
  assert.deepEqual([total(free), dayEx(free), mins(free)], [68, 9, ['1 ч 50 мин', '1 ч 55 мин']]);
  assert.ok(noteOf(free, /^Один день в неделю/)!.x!.includes('в каждой тренировке уже по девять упражнений'));
  /* два часа: десять упражнений в дне, тренировки не длиннее, второй день — у всех мышц. Дальше грудь не растёт: в базовом подходов столько, сколько их,
     во втором упражнении — пять (MAX_SETS), третьему места нет — в тренировке десять упражнений; поэтому от 2 ч до 2 ч 30 мин программа та же */
  const two = Core.buildProgram(W, cfg, { time: 120 });
  assert.deepEqual([total(two), dayEx(two), mins(two)], [68, 10, ['1 ч 50 мин', '1 ч 50 мин']]);
  assert.ok(twoDays(two) && !noteOf(two, /^Один день в неделю/), two.notes.map(n => n.t).join(' | '));
  /* больше времени — больше упражнений и подходов; каждая тренировка укладывается; второй день у каждой мышцы — от 1 ч 15 мин (с предплечьями вне расчёта, вывод 2 аудита) */
  const rows = TIMES.map(t => { const pr = Core.buildProgram(W, cfg, { time: t }); assert.ok(Core.SLOTS.every(sl => inTime(Core.estMinutes(pr.cfg, pr.slots[sl.id]), t)), t + ': ' + mins(pr)); return [t, total(pr), dayEx(pr), twoDays(pr)]; });
  assert.deepEqual(rows, [[60, 33, 7, false], [75, 41, 9, true], [90, 46, 10, true], [105, 64, 10, true], [120, 68, 10, true], [135, 68, 10, true], [150, 68, 10, true]]);
}));

test('с выбранным временем заметка называет время: что не поместилось и какое время поможет', () => {
  const W = seedW(), cfg = appCfg(seedRaw());
  withDays(3, () => {
    const n = noteOf(Core.buildProgram(W, cfg, { time: 75 }), /^Нагрузка поровну/)!;
    assert.ok(n.x!.includes('грудь, задние дельты, бицепс и квадрицепс выше не поднять — в 1 ч 15 мин на тренировку больше не помещается. Поэтому уровень общий, но ниже. Лимит недели тут ни при чём: занято 68 подходов из 100. Поможет ещё один тренировочный день или время на тренировку от 1 ч 30 мин.'), String(n.x));
    /* два с половиной часа — последний пункт списка: больше времени не советуется */
    const top = noteOf(Core.buildProgram(W, cfg, { time: 150 }), /^Нагрузка поровну/);
    assert.ok(!top || !top.x!.includes('время на тренировку от'), String(top && top.x));
  });
  withDays(2, () => {
    /* уровень ниже ради второго дня: так и сказано (на примерных данных — с приоритетом «Руки») */
    const n = noteOf(Core.buildProgram(W, cfg, { prio: 'arms', time: 90 }), /^Приоритет/)!;
    assert.ok(n.x!.includes('уровнем выше у части мышц (квадрицепс) остался бы один день в неделю, а в 1 ч 30 мин на тренировку не помещается и то и другое. Уровни ниже, пропорция та же. Лимит недели тут ни при чём: занято 46 подходов из 100. Поможет ещё один тренировочный день или время на тренировку от 1 ч 45 мин.'), String(n.x));
  });
});

/* Время заполняется подходами, «Масса» без базовых с нуля, не больше десяти упражнений в тренировке (решения владельца, 25 ноября 2026; rules.ts, fillTop и TIME_EX).
   Числа — встроенный справочник, профиль без записей, три дня, отдых 2:00; те же — в docs/04, раздел 3.8, правило 7 */
const places = (pr: Built, sl: string) => pr.slots[sl].reduce((a, e) => a + (pr.cfg.ex[e.ex].uni ? 0.5 : 1), 0);
const lifts = (pr: Built) => [...new Set(Core.SLOTS.flatMap(sl => pr.slots[sl.id].filter(e => Core.isCycle(pr.cfg, e.ex)).map(e => e.ex)))];
/* так программу принимает экран (acceptProgram), как в days.test.ts */
function acceptAs(raw: Raw, pr: Built, since: string): Cfg {
  const r = plain(raw) as Raw & { program?: unknown }; Object.assign(r.ex, plain(pr.create));
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  const slots: ProgSlots = {}; for (const id of Object.keys(pr.slots)) slots[id] = pr.slots[id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', prio: pr.prio, budget: pr.budget, since, made: since, slots }, pr.strength ? { strength: true, lean: true } : {}, pr.triad ? { triad: pr.triad.slice() } : {});
  return Core.mergeCfg(r);
}

test('потолок заполнения времени: верх рабочей зоны, а с приоритетом — пока он в полтора раза выше', () => {
  assert.deepEqual([fillTop({ high: 20 }, false, 1.5), fillTop({ high: 20 }, true, 1.5)], [18, 12]);
  assert.deepEqual(TIME_EX, { day: 10, muscle: 2, prio: 3, next: 3 });
});

test('с выбранным временем время заполняется подходами: уровень выше 10, пока дни укладываются во время и неделя — в лимит', () => withDays(3, () => {
  const raw = withStarter(null) as Raw, cfg = Core.mergeCfg(plain(raw)), tracked = Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id), rest = tracked.filter(m => m !== 'glutes');
  /* «Масса», ягодицы в приоритете: без времени — до 10 (приоритет 15), как было; с 2 ч — до 12 (приоритет 18) */
  const free = Core.buildProgram([], cfg, { prio: 'glutes' }), two = Core.buildProgram([], cfg, { prio: 'glutes', time: 120 });
  assert.deepEqual([total(free), spanOf(free, rest)], [68, '10–14']);
  assert.deepEqual([total(two), spanOf(two, rest), spanOf(two, ['glutes'])], [85, '12–14.5', '20–20']);
  assert.ok(Core.SLOTS.every(sl => inTime(Core.estMinutes(two.cfg, two.slots[sl.id]), 120)));
  assert.ok(noteOf(two, /^Приоритет/)!.x!.includes('Время на тренировку заполнено подходами: общий уровень поднят с 10 до 12 подходов в неделю, у приоритета — до 18, пока каждая тренировка укладывается в 2 ч. Выше не поднимается: у приоритета потолок 18 подходов, и с остальными выше 12 он перестал бы быть в полтора раза больше.'));
  /* «Равномерно», 2 ч: до 14 — выше не даёт лимит недели. До выравнивания дней по длине (просьба владельца, 25 ноября 2026; rules.ts, EVEN) было 84 подхода
     и уровень 12: первый день упирался во время, пока в третьем оставалось 30 минут, а уровнем выше верх спины уходил от остальных */
  const even = Core.buildProgram([], cfg, { time: 120 });
  assert.deepEqual([total(even), spanOf(even, tracked)], [99, '14–17']);
  assert.ok(noteOf(even, /^Все мышцы в рабочей зоне/)!.x!.includes('общий уровень поднят с 10 до 14 подходов в неделю, пока каждая тренировка укладывается в 2 ч. Выше не даёт лимит 100 подходов в неделю.'));
  /* под «Силой» подсобка по-прежнему ниже рабочей зоны: время подходами не заполняется */
  const str = Core.buildProgram([], cfg, { focus: 'bench', strength: true, time: 120 });
  assert.ok(!str.notes.some(n => /заполнено подходами/.test(n.x || '')) && spanOf(str, tracked.filter(m => !['chest'].includes(m))) === '8–11', spanOf(str, tracked));
  /* сразу после «Принять» сборка предлагает ту же программу */
  for (const opts of [{ prio: 'glutes', time: 120 }, { time: 120 }] as BuildOpts[]) {
    const pr = Core.buildProgram([], cfg, opts), again = Core.buildProgram([], acceptAs(raw, pr, '2025-11-20'), opts);
    assert.deepEqual([again.same, total(again)], [true, total(pr)], JSON.stringify(opts));
  }
}));

/* Дни выравниваются по длине тренировки (просьба владельца, 25 ноября 2026; rules.ts, EVEN): с днями «День N» — при любом числе дней и по оценке времени.
   Пример владельца — встроенный справочник, профиль без записей, «Сила: жим лежа», три дня, 2 ч, отдых 2:00: было 29 / 16 / 13 подходов, 1 ч 40 мин, 55 и 45 мин */
const minutes = (pr: Built) => Core.SLOTS.map(sl => Core.estMinutes(pr.cfg, pr.slots[sl.id]));
test('дни выравниваются по длине: «Сила: жим лежа», три дня, 2 ч — 1 ч 10 мин, 1 ч 15 мин и 1 ч 10 мин; подходов и объёма мышц столько же, сразу после «Принять» — та же программа', () => withDays(3, () => {
  const raw = withStarter(null) as Raw, cfg = Core.mergeCfg(plain(raw)), tracked = Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id), opts: BuildOpts = { focus: 'bench', strength: true, time: 120, budget: 100 };
  const pr = Core.buildProgram([], cfg, opts);
  assert.deepEqual([Core.SLOTS.map(sl => pr.after.load[sl.id]), total(pr)], [[18, 21, 19], 58]);
  /* отдых — по упражнению (rules.ts, REST): у тяжёлого дня жима 5 мин, у лёгкого 3 мин — в днях с ними подходов меньше */
  assert.deepEqual(minutes(pr).map(m => Core.fmtDur(m)), ['1 ч 10 мин', '1 ч 15 мин', '1 ч 10 мин']);
  /* уровень мышц тот же, что до выравнивания: под «Силой» подсобка 8, грудь — мышца цели — 12 (выбор владельца 25 ноября 2026: время подходами не заполняется) */
  assert.deepEqual([spanOf(pr, ['chest']), spanOf(pr, tracked.filter(m => m !== 'chest'))], ['12–12', '8–11']);
  for (const m of tracked) assert.ok(Core.SLOTS.filter(sl => ((pr.after.day[sl.id] || {})[m] || 0) >= 2 - 0.01).length >= 2, m + ': меньше двух дней в неделю');
  const again = Core.buildProgram([], acceptAs(raw, pr, '2025-11-20'), opts);
  assert.deepEqual([again.same, total(again)], [true, 58]);
}));

/* на примерах — каждая цель так, как её собирает экран («Гибрид» — с остальными базовыми «как подсобка»). Это не обещание для любых данных: выравнивание
   останавливается, когда переносить нечего — в коротком дне уже девять упражнений (с выбранным временем — десять) или переезд нарушил бы лимиты */
test('дни выравниваются по длине при любом числе дней и в любой цели: самый длинный день не дольше самого короткого больше чем на 10 минут', () => {
  assert.deepEqual(EVEN, { min: 10 });
  const sets: [string, Cfg, Workout[]][] = [['встроенный справочник', appCfg(withStarter(null)), []], ['примерные данные', appCfg(seedRaw()), seedW()]];
  for (const n of [2, 3, 4]) withDays(n, () => {
    for (const [name, cfg, W] of sets) for (const opts of [{}, { prio: 'legs' }, { focus: 'bench', others: 'plain' }, { focus: 'bench', strength: true }, { focus: 'squat', strength: true }, { strength: true, triad: true }] as BuildOpts[]) for (const time of [0, 120]) {
      if (opts.triad && n < 3) continue;
      const pr = Core.buildProgram(W, cfg, Object.assign({ time }, opts)), m = minutes(pr);
      assert.ok(Math.max(...m) - Math.min(...m) <= EVEN.min, n + ' дня, ' + name + ', ' + JSON.stringify(opts) + ', ' + time + ': ' + m.map(v => v.toFixed(1)).join(' / '));
    }
  });
});

test('выравнивание дней: подход переезжает в то же упражнение или в упражнение с теми же мышцами другого дня — и это названо одной заметкой, а не прибавкой и убавкой', () => {
  const cfg = appCfg(seedRaw()), named = (pr: Built, name: string) => [/^Прибавлены подходы/, /^Убраны подходы/].every(t => { const v = noteOf(pr, t); return !v || !v.x!.includes(name); });
  withDays(3, () => {
    const pr = Core.buildProgram(seedW(), cfg, { prio: 'legs' });
    const n = noteOf(pr, /^Дни выровнены по длине/)!;
    assert.ok(n.x!.startsWith('Бицепс бедра сидя в тренажере → Бицепс бедра на тренажере лежа на животе (день 1 → день 3, 1 подход). Упражнение или подход переезжает из самого длинного дня в самый короткий, пока разница между ними больше 10 минут: объём за неделю тот же, меняется только день.'), String(n.x));
    assert.deepEqual([pr.slots.mon.find(e => e.ex === 'leg_curl_seated')!.n, pr.slots.fri.find(e => e.ex === 'leg_curl_lying')!.n], [3, 4]);
    assert.ok(named(pr, 'Бицепс бедра'), pr.notes.map(v => v.t + ': ' + v.x).join(' | '));
  });
  /* подход ушёл в новое упражнение: его называет заметка «Новое …», у прежнего упражнения в итоге столько подходов, сколько было, — ни переезда, ни прибавки */
  withDays(2, () => {
    const pr = Core.buildProgram(seedW(), cfg, { prio: 'legs' });
    assert.ok(!noteOf(pr, /^Дни выровнены по длине/) && named(pr, 'Разгибания ног') && pr.slots.wed.find(e => e.ex === 'leg_ext')!.n === 3, pr.notes.map(v => v.t + ': ' + v.x).join(' | '));
    assert.ok(pr.notes.some(v => v.t === 'Новое в день 1: Разгибания ног в тренажере'), pr.notes.map(v => v.t).join(' | '));
  });
});

test('«Масса»: базовые справочника с нуля сами не встают — ни с мышцами в приоритете, ни «Всем поровну»; «Гибрид» и «Сила» — как были', () => withDays(3, () => {
  const cfg = Core.mergeCfg(withStarter(null));
  for (const prio of ['', 'glutes', 'legs', 'arms']) {
    const pr = Core.buildProgram([], cfg, prio ? { prio } : {});
    assert.deepEqual(lifts(pr), [], prio || 'Всем поровну');
    assert.ok(!noteOf(pr, /^Базовые — первыми/), prio || 'Всем поровну');
  }
  assert.deepEqual(lifts(Core.buildProgram([], cfg, { focus: 'bench' })), ['bench', 'leg_press', 'pullup']);
  assert.deepEqual(lifts(Core.buildProgram([], cfg, { strength: true, triad: true })), ['squat', 'bench', 'deadlift']);
  /* ягодицы в приоритете: первыми в каждом дне — упражнения на ягодицы */
  const pr = Core.buildProgram([], cfg, { prio: 'glutes', time: 120 });
  for (const sl of Core.SLOTS) assert.ok((pr.cfg.ex[pr.slots[sl.id][0].ex].m.glutes || 0) >= 1, sl.n + ': ' + pr.slots[sl.id][0].ex);
  /* базовое, которое в программе уже стоит, остаётся: с таблицей дней эталона и в программе не с нуля сборка его не убирает */
  const W = seedW(), seed = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { prio: 'glutes' });
  assert.ok(lifts(seed).length > 0);
}));

test('с выбранным временем в тренировке не больше десяти упражнений, на мышцу — не больше двух (у приоритета трёх); без времени — девять, как было', () => {
  const cfg = appCfg(withStarter(null));
  for (const n of [2, 3, 4]) withDays(n, () => {
    for (const opts of [{}, { prio: 'glutes' }, { prio: 'legs' }, { focus: 'bench' }, { focus: 'bench', strength: true }, { strength: true, triad: true }] as BuildOpts[]) for (const time of [60, 90, 120]) {
      if (opts.triad && n < 3) continue;
      const pr = Core.buildProgram([], cfg, Object.assign({ time }, opts)), prio = opts.prio ? Core.PRIOS.find(g => g.id === opts.prio)!.m : [];
      const what = n + ' дня, ' + JSON.stringify(opts) + ', ' + time;
      for (const sl of Core.SLOTS) {
        assert.ok(places(pr, sl.id) <= TIME_EX.day, what + ', ' + sl.n + ': ' + places(pr, sl.id) + ' упражнений');
        for (const m of Core.MUSCLES) if (!cfg.ignore[m.id]) {
          const k = pr.slots[sl.id].filter(e => (pr.cfg.ex[e.ex].m[m.id] || 0) >= 1 && !pr.cfg.ex[e.ex].uni).length;
          assert.ok(k <= (prio.includes(m.id) ? TIME_EX.prio : TIME_EX.muscle), what + ', ' + sl.n + ', ' + m.n + ': ' + k + ' упражнений');
        }
      }
    }
    for (const sl of Core.SLOTS) assert.ok(places(Core.buildProgram([], cfg, {}), sl.id) <= 9, n + ' дня без времени');
  });
  /* было: 2 ч, ягодицы — 14–15 упражнений в дне, три из четырёх по два подхода; стало — по десять, по два подхода — не больше половины (решение владельца, 25 ноября 2026)
     (до выводов аудита 14 из 30; с предплечьями вне расчёта — 15 из 30: их места заняли другие упражнения, по два подхода — в основном третий день, второй для каждой мышцы) */
  withDays(3, () => {
    const pr = Core.buildProgram([], cfg, { prio: 'glutes', time: 120 }), all = Core.SLOTS.flatMap(sl => pr.slots[sl.id]);
    assert.deepEqual(Core.SLOTS.map(sl => places(pr, sl.id)), [10, 10, 10]);
    assert.ok(all.filter(e => e.n === 2).length * 2 <= all.length, all.filter(e => e.n === 2).length + ' из ' + all.length);
  });
});
