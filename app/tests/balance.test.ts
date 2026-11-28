/* Замена не меняет баланс мышц (пункт 1 вопросов владельца, 28 ноября 2026; core/balance.ts, docs/03, раздел 22).
   Встроенный справочник, профиль без записей, дни «День N»: программу собирает дневник, атлет меняет упражнение, дневник возвращает мышцам объём до замены. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { SHIFT_MIN, balanceText, rebalance, shiftOf, shiftText } from '../src/core/balance.ts';
import { pairClash, pairsOf } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, ProgSlots } from '../src/core/types.ts';

type Built = ReturnType<typeof Core.buildProgram>;
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const cfgOf = (extra?: Record<string, unknown>) => Core.mergeCfg(Object.assign(withStarter(null) as Record<string, unknown>, extra || {}) as never);
const vol = (cfg: Cfg, slots: ProgSlots) => { const pv = Core.progTally(cfg, slots).pv; return Object.fromEntries(Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => [m.id, pv[m.id] || 0])); };
const sq = (a: Record<string, number>, b: Record<string, number>) => Object.keys(a).reduce((t, m) => t + ((b[m] || 0) - a[m]) ** 2, 0);
const total = (cfg: Cfg, slots: ProgSlots) => { const T = Core.progTally(cfg, slots); return Core.SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0); };
const mins = (cfg: Cfg, slots: ProgSlots) => Core.SLOTS.map(sl => Core.estMinutes(cfg, slots[sl.id], cfg.rest));
/** Замена, как её делает экран (draft.ts, edit.swap): упражнение в том же месте, подходы те же, затем выравнивание */
function swap(pr: Built, cfg: Cfg, slot: string, from: string, to: string, opts: BuildOpts = {}) {
  const i = pr.slots[slot].findIndex(e => e.ex === from);
  assert.ok(i >= 0, from + ' нет в дне ' + slot + ': ' + pr.slots[slot].map(e => e.ex).join());
  const was = Core.progTally(pr.cfg, pr.slots).pv, n = pr.slots[slot][i].n, defs: Record<string, ExDef> = {};
  pr.slots[slot][i].ex = to;
  const mid = vol(pr.cfg, pr.slots), minMid = mins(pr.cfg, pr.slots), dayMid = Core.progTally(pr.cfg, pr.slots).day;
  const b = rebalance(pr.cfg, pr.slots, was, { slot, ex: to }, { z: cfg.zones, ignore: cfg.ignore, budget: +pr.budget! || cfg.caps.week, dayCap: cfg.caps.day, time: opts.time || 0, rest: cfg.rest }, (id, def) => { defs[id] = def; });
  return { b, was: Object.fromEntries(Object.keys(mid).map(m => [m, was[m] || 0])), mid, minMid, dayMid, n, defs, at: pr.slots[slot].find(e => e.ex === to)! };
}

test('сдвиг у варианта замены: приседания → ягодичный мост отнимают у квадрицепса все подходы приседаний', () => withDays(3, () => {
  const cfg = cfgOf(), pr = Core.buildProgram([], cfg, {});
  const i = pr.slots.mon.findIndex(e => e.ex === 'squat'), n = pr.slots.mon[i].n!;
  assert.deepEqual(shiftOf(pr.cfg, pr.slots, 'mon', i, 'hip_thrust'), [['quads', -n], ['hams', n / 2]]);
  assert.equal(shiftText(shiftOf(pr.cfg, { mon: pr.slots.mon }, 'mon', i, 'hip_thrust')), 'квадрицепс −' + n + ', бицепс бедра +' + n / 2 + ' в неделю', 'по одному дню — то же, что по всей программе');
  assert.deepEqual(shiftOf(pr.cfg, pr.slots, 'mon', i, 'lunge'), [], 'выпады — те же мышцы с той же долей: сдвига нет');
  assert.deepEqual(shiftOf(pr.cfg, pr.slots, 'mon', i, 'squat'), [], 'то же упражнение — сдвига нет');
  const j = pr.slots.mon.findIndex(e => e.ex === 'row_machine');
  assert.deepEqual(shiftOf(pr.cfg, pr.slots, 'mon', j, 'shrug').map(x => x[0]).sort(), ['biceps', 'delt_rear', 'lats'], 'даже из «Тех же мышц»: шраги вместо тяги отнимают у помощников');
  assert.ok(shiftOf(pr.cfg, pr.slots, 'mon', j, 'shrug').every(x => x[1] <= -SHIFT_MIN), 'потери от подхода');
}));

test('после замены дневник возвращает мышцам объём: приседания → ягодичный мост, квадрицепс снова как до замены', () => withDays(3, () => {
  const cfg = cfgOf(), pr = Core.buildProgram([], cfg, {}), budget = +pr.budget! || cfg.caps.week;
  const r = swap(pr, cfg, 'mon', 'squat', 'hip_thrust');
  assert.ok(r.mid.quads <= r.was.quads - 4 + 0.01, 'сразу после замены квадрицепс потерял подходы');
  const now = vol(pr.cfg, pr.slots);
  for (const m of Object.keys(now)) assert.ok(Math.abs(now[m] - r.was[m]) <= SHIFT_MIN + 0.01, m + ': ' + r.was[m] + ' → ' + now[m]);   // остаток до подхода: «Равномерно» — разброс около двух
  assert.equal(r.at.n, r.n, 'выбранное атлетом упражнение «−» не трогает');
  assert.ok(total(pr.cfg, pr.slots) <= budget + 0.01, 'в лимите недели');
  const T = Core.progTally(pr.cfg, pr.slots);
  for (const sl of Core.SLOTS) for (const m of Object.keys(T.day[sl.id] || {})) assert.ok(T.day[sl.id][m] <= cfg.caps.day + 0.01, sl.id + ' ' + m + ': ' + T.day[sl.id][m]);
  assert.deepEqual(r.b.lack, []);
  assert.deepEqual(r.b.back.map(x => x[0]).sort(), ['hams', 'quads']);
  assert.ok(r.b.moves.some(mv => mv.m === 'Квадрицепс' && mv.t.startsWith('+1 подход')) && r.b.moves.some(mv => mv.m === 'Бицепс бедра' && mv.t.startsWith('−1 подход')), JSON.stringify(r.b.moves));
  assert.match(balanceText(r.b), /^\. Объём мышц выровнен: (бицепс бедра −2, квадрицепс \+4|квадрицепс \+4, бицепс бедра −2)$/);
}));

test('вернуть обратно: замена назад и выравнивание дают прежний объём мышц', () => withDays(3, () => {
  const cfg = cfgOf(), pr = Core.buildProgram([], cfg, {}), start = vol(pr.cfg, pr.slots);
  swap(pr, cfg, 'mon', 'squat', 'hip_thrust');
  swap(pr, cfg, 'mon', 'hip_thrust', 'squat');
  const now = vol(pr.cfg, pr.slots);
  for (const m of Object.keys(start)) assert.ok(Math.abs(now[m] - start[m]) <= SHIFT_MIN + 0.01, m + ': ' + start[m] + ' → ' + now[m]);
}));

test('с выбранным временем день не становится длиннее; чего вернуть нельзя — названо с причиной', () => withDays(3, () => {
  const cfg = cfgOf(), opts = { time: 60 }, pr = Core.buildProgram([], cfg, opts);
  const r = swap(pr, cfg, 'mon', 'squat', 'hip_thrust', opts), after = mins(pr.cfg, pr.slots);
  after.forEach((v, k) => assert.ok(v <= Math.max(60, r.minMid[k]) + 0.01, 'день ' + (k + 1) + ': ' + v + ' мин'));
  const now = vol(pr.cfg, pr.slots);
  assert.ok(sq(r.was, now) < sq(r.was, r.mid), 'отклонений меньше, чем сразу после замены');
  assert.deepEqual(r.b.lack.map(l => l.m), Object.keys(now).filter(m => now[m] - r.was[m] <= -SHIFT_MIN + 0.01), 'в «не хватает» — ровно мышцы, которым не вернули подход и больше');
  assert.ok(r.b.lack.some(l => l.m === 'quads' && /не уложится в 1 ч/.test(l.why)), JSON.stringify(r.b.lack));
  assert.match(balanceText(r.b), /\. Не хватает: квадрицепс −\d+ — тренировка не уложится в 1 ч$/);
}));

test('с днями подряд выравнивание не делает мышцу основной в двух соседних днях', () => withDays(3, () => {
  const cfg = cfgOf({ pairs: ['mon-wed'] }), pr = Core.buildProgram([], cfg, {});
  const links = pairsOf(pr.cfg, Core.SLOTS), clash = () => pairClash(links, d => pr.slots[d].map(e => e.ex), id => (pr.cfg.ex[id] || { m: {} }).m || {}, pr.cfg.ignore).length;
  assert.ok(links.length > 0);
  const from = Core.SLOTS.map(sl => sl.id).find(d => pr.slots[d].some(e => e.ex === 'squat'))!;
  const i = pr.slots[from].findIndex(e => e.ex === 'squat'), before = Core.progTally(pr.cfg, pr.slots).pv;
  pr.slots[from][i].ex = 'hip_thrust';
  const c0 = clash();
  rebalance(pr.cfg, pr.slots, before, { slot: from, ex: 'hip_thrust' }, { z: cfg.zones, ignore: cfg.ignore, budget: +pr.budget! || cfg.caps.week, dayCap: cfg.caps.day, rest: cfg.rest }, () => {});
  assert.ok(clash() <= c0, 'соседних дней с той же основной мышцей не прибавилось');
}));

test('любая замена в собранных программах: отклонений не больше, лимиты и время не нарушены, выбранное упражнение не тронуто', () => {
  const cases: [number, BuildOpts][] = [[2, {}], [3, {}], [4, {}], [3, { prio: 'glutes', time: 120 }], [2, { time: 90 }], [3, { focus: 'bench', others: 'plain' }]];
  for (const [days, opts] of cases) withDays(days, () => {
    const cfg = cfgOf(), base = Core.buildProgram([], cfg, opts), budget = +base.budget! || cfg.caps.week;
    for (const sl of Core.SLOTS) base.slots[sl.id].forEach((e, i) => {
      const k = Core.kindOf(base.cfg, e.ex);
      if (k !== 'compound' && k !== 'iso') return;
      const alts = Core.swapsFor(base.cfg, e.ex, base.slots[sl.id].map(x => x.ex));
      for (const x of alts.same.concat(alts.near)) {
        const pr = Object.assign({}, base, { cfg: plain(base.cfg) as Cfg, slots: plain(base.slots) as ProgSlots });
        if (!pr.cfg.ex[x.id]) pr.cfg.ex[x.id] = Core.placed(pr.cfg, Object.assign({ n: x.id }, x.def));
        const tag = days + ' ' + JSON.stringify(opts) + ' ' + sl.id + ': ' + e.ex + ' → ' + x.id;
        const r = swap(pr, cfg, sl.id, e.ex, x.id, opts), now = vol(pr.cfg, pr.slots);
        assert.ok(sq(r.was, now) <= sq(r.was, r.mid) + 0.01, tag + ': отклонений не больше, чем сразу после замены');
        assert.equal(r.at.n, r.n, tag + ': выбранное упражнение со своими подходами');
        assert.ok(total(pr.cfg, pr.slots) <= Math.max(budget, total(base.cfg, base.slots)) + 0.01, tag + ': лимит недели');
        const T = Core.progTally(pr.cfg, pr.slots);
        for (const d of Core.SLOTS) for (const m of Object.keys(T.day[d.id] || {})) assert.ok(T.day[d.id][m] <= Math.max(cfg.caps.day, (r.dayMid[d.id] || {})[m] || 0) + 0.01, tag + ': лимит на мышцу за тренировку');
        if (opts.time) mins(pr.cfg, pr.slots).forEach((v, d) => assert.ok(v <= Math.max(opts.time!, r.minMid[d]) + 0.01, tag + ': день ' + (d + 1) + ' ' + v + ' мин'));
        assert.deepEqual(r.b.lack.map(l => l.m), Object.keys(now).filter(m => now[m] - r.was[m] <= -SHIFT_MIN + 0.01), tag + ': «не хватает» — честно');
      }
    });
  });
});
