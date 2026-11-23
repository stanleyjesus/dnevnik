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
import { RDL_M, appRules, isRdl } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, MuscleMap, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef> };
type Built = ReturnType<typeof Core.buildProgram>;
const OLD: MuscleMap = { hams: 1, glutes: 1, erectors: 1 };
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedRaw = (): Raw => readJson('data/config.json'), p2Raw = (): Raw => readJson('data/config.p2.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
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

test('с днями «День N» в румынской тяге и тяге на прямых ногах разгибатели помогают; становая и гуд морнинг — как были', () => withDays(3, () => {
  assert.equal(appRules(), true);
  for (const name of ['Румынская тяга', 'Румынская тяга с гантелями', 'Тяга на прямых ногах', 'Мёртвая тяга со штангой', 'RDL']) {
    assert.ok(isRdl(name), name);
    assert.deepEqual(plain(Core.guessEx(name)!.m), RDL_M, name);
  }
  for (const name of ['Становая тяга', 'Гуд морнинг', 'Гиперэкстензия']) { assert.ok(!isRdl(name), name); assert.deepEqual(plain(Core.guessEx(name)), plain(Ref.guessEx(name)), name); }
  assert.deepEqual(plain(rdlOf()), RDL_M, 'поправка «добавь румынскую тягу»'); assert.deepEqual(plain(libOf()), RDL_M, 'румынская тяга в списке сборки');
  /* встроенный справочник: румынские тяги помогают, становая — нет */
  const st = Core.mergeCfg(withStarter(null)).ex;
  assert.deepEqual([plain(st.rdl.m), plain(st.db_rdl.m), plain(st.deadlift.m)], [RDL_M, RDL_M, OLD]);
}));

test('сохранённый справочник: румынская тяга с картой прежнего правила читается по-новому, своя карта атлета и хранилище не меняются', () => withDays(3, () => {
  const raw = p2Raw(); raw.ex.mine = { n: 'Румынская тяга на одной ноге', pat: 'hinge', m: { hams: 1, glutes: 0.5, erectors: 1 } };
  const before = JSON.stringify(raw), cfg = Core.mergeCfg(raw);
  assert.deepEqual(plain(cfg.ex.rdl.m), RDL_M);
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

test('приоритет «Ноги и ягодицы» на примерных данных добирает свою долю: 100 подходов, приоритет 15–15.7 (без правила — 86 и 11.3–12)', () => {
  const W = seedW(), legs = ['quads', 'hams', 'glutes'];
  const week = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { prio: 'legs' });
  assert.deepEqual([total(week), spanOf(week, legs)], [86, '11.3–12'], 'таблица дней эталона — как в эталоне');
  withDays(3, () => {
    const cfg = Core.mergeCfg(seedRaw()), pr = Core.buildProgram(W, cfg, { prio: 'legs' });
    assert.deepEqual([total(pr), spanOf(pr, legs)], [100, '15–15.7']);
    assert.equal(has(pr, 'x_rdl'), 2, 'румынская тяга — в двух днях');
  });
});

test('в один день сборка не ставит второе упражнение с теми же мышцами: подходы прибавляются в том, что уже стоит', () => {
  const sameM = (a: MuscleMap, b: MuscleMap) => JSON.stringify(Object.entries(a).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b).filter(x => x[1] > 0).sort());
  for (const n of [2, 3, 4]) withDays(n, () => {
    const cfg = Core.mergeCfg(withStarter(null));
    for (const opts of [{}, { prio: 'legs' }, { prio: 'back' }, { budget: 70 }, { focus: 'bench' }] as BuildOpts[]) {
      const pr = Core.buildProgram([], cfg, opts);
      for (const sl of Core.SLOTS) {
        const L = pr.slots[sl.id].filter(e => e.n && !pr.cfg.ex[e.ex].uni);
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) assert.ok(!sameM(pr.cfg.ex[L[i].ex].m || {}, pr.cfg.ex[L[j].ex].m || {}), n + ' дня, ' + JSON.stringify(opts) + ', ' + sl.n + ': ' + L[i].ex + ' и ' + L[j].ex);
      }
    }
  });
  /* на встроенном списке с приоритетом ног без этого правила две румынские тяги по два подхода занимали два места в дне: 74 подхода, приоритет 12–13.3 */
  withDays(3, () => { const pr = Core.buildProgram([], Core.mergeCfg(withStarter(null)), { prio: 'legs' }); assert.deepEqual([total(pr), spanOf(pr, ['quads', 'hams', 'glutes'])], [91, '14.7–17.8']); });
});

test('заметка называет настоящую причину: при свободных подходах не советует увеличить лимит недели', () => {
  const W = seedW();
  /* таблица дней эталона: как в эталоне — причина берётся из первой попытки */
  const ref = Ref.buildProgram(W, Ref.mergeCfg(seedRaw()), { prio: 'legs' }), week = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { prio: 'legs' });
  assert.deepEqual(plain(week.notes), plain(ref.notes));
  withDays(2, () => {
    /* два дня, лимит 80: занято 69 — мешают девять упражнений в дне */
    const pr = Core.buildProgram(W, Core.mergeCfg(seedRaw()), { budget: 80 }), n = noteOf(pr, /^Нагрузка поровну/)!;
    assert.equal(total(pr), 69);
    assert.ok(n.x!.includes('грудь и предплечья выше не поднять — в каждой тренировке уже по девять упражнений. Поэтому уровень общий, но ниже. Лимит недели тут ни при чём: занято 69 подходов из 80. Поможет ещё один тренировочный день.'), String(n.x));
    assert.ok(!/увеличь лимит|не хватает лимита|Лимита \d+ подходов в неделю не хватает/.test(n.x!), String(n.x));
    /* второй профиль, приоритет «Грудь и плечи», лимит 70: занято 52 */
    const ch = Core.buildProgram([], Core.mergeCfg(p2Raw()), { prio: 'chest', budget: 70 }), c = noteOf(ch, /^Приоритет/)!;
    assert.equal(total(ch), 52);
    assert.ok(c.x!.includes('грудь выше не поднять — в каждой тренировке уже по девять упражнений. Уровни ниже, пропорция та же. Лимит недели тут ни при чём: занято 52 подхода из 70.'), String(c.x));
    /* следующему уровню и правда не хватает лимита — так и сказано */
    const up = Core.buildProgram([], Core.mergeCfg(p2Raw()), { prio: 'upper', budget: 70 }), u = noteOf(up, /^Приоритет/)!;
    assert.ok(u.x!.includes('Лимита 70 подходов в неделю не хватает') && u.x!.includes('увеличь лимит недели'), String(u.x));
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

test('группа «Плечи» в приоритете: три пучка дельт без груди, в полтора раза выше остальных — 14.8–15 при остальных 9.7–14.3', () => {
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
  withDays(3, () => { const cfg = Core.mergeCfg(seedRaw()); check(Core.buildProgram(W, cfg, { prio: 'delts' }), cfg, '14.8–15', '9.7–14.3', 100); });
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
      /* разница сторон — не баланс движений: замечание остаётся */
      assert.deepEqual(app.bal, week.bal.filter(t => !t.startsWith('В программе нет')), name);
    });
  }
});
