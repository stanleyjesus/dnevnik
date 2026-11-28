/* Мышцы на поддержании (пункт 11 вопросов владельца, 28 ноября 2026, вариант «Поддерживать»; rules.ts — MAINT, maintList, maintOf; docs/03, раздел 24).
   Встроенный справочник, профиль без записей, дни «День N»: группа мышц на поддержании получает треть общего уровня, не меньше четырёх подходов в неделю,
   остальные — как без отметки или больше, когда время заполняется подходами. С таблицей дней эталона отметка не действует. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { MAINT, MAINT_GROUPS, maintAim, maintList, maintOf } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef, ProgSlots } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; maint?: string[]; program?: unknown };
type Built = ReturnType<typeof Core.buildProgram>;
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const starter = (extra?: Partial<Raw>): Raw => Object.assign(withStarter(null) as Raw, extra || {});
const total = (pr: Built) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const daysOf = (pr: Built, m: string) => Core.SLOTS.filter(sl => ((pr.after.day[sl.id] || {})[m] || 0) >= 2 - 0.01).length;
const noteOf = (pr: Built, re: RegExp) => pr.notes.find(n => re.test(n.t));
const tracked = (cfg: Cfg) => Core.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id);
/* так программу принимает экран (acceptProgram), как в care.test.ts */
function acceptAs(raw: Raw, pr: Built, since: string): Cfg {
  const r = plain(raw) as Raw; Object.assign(r.ex, plain(pr.create));
  const slots: ProgSlots = {}; for (const id of Object.keys(pr.slots)) slots[id] = pr.slots[id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
  r.program = Object.assign({ name: pr.name, focus: pr.focus || '', others: pr.others || '', prio: pr.prio, budget: pr.budget, since, made: since, slots }, pr.strength ? { strength: true, lean: true } : {}, pr.triad ? { triad: pr.triad.slice() } : {});
  return Core.mergeCfg(r);
}

test('поддержание: группы из настройки — только известные, по порядку; мышцы — в расчёте и не в приоритете; всё сразу и с таблицей дней эталона — никого', () => {
  assert.deepEqual(maintList(['glutes', 'x', 'arms', 'arms']), ['arms', 'glutes']);
  assert.deepEqual(maintList('arms'), []);
  assert.deepEqual([maintAim(10), maintAim(12), maintAim(18)], [4, 4, 6], 'треть уровня, не меньше четырёх');
  withDays(3, () => {
    const cfg = Core.mergeCfg(starter({ maint: ['arms', 'thighs'] }));
    assert.deepEqual(cfg.maint, ['arms', 'thighs']);
    assert.deepEqual(Object.keys(maintOf(cfg)).sort(), ['biceps', 'hams', 'quads', 'triceps'], 'предплечья вне расчёта — их нет');
    assert.deepEqual(Object.keys(maintOf(cfg, { quads: 1, hams: 1 })).sort(), ['biceps', 'triceps'], 'мышцы в приоритете растут');
    assert.deepEqual(maintOf(Core.mergeCfg(starter({ maint: MAINT_GROUPS.map(g => g.id) }))), {}, 'всё на поддержании не бывает');
    assert.equal(Core.mergeCfg(starter({ maint: [] })).maint, undefined, 'пусто — поля нет');
  });
  assert.deepEqual(maintOf(Core.mergeCfg(starter({ maint: ['arms'] }))), {}, 'с таблицей дней эталона отметка не действует');
});

test('«Масса», «Поровну», без времени: руки на поддержании — от четырёх в неделю и не меньше двух дней, остальные — рабочая зона; сразу после «Принять» — та же программа', () => withDays(3, () => {
  const raw = starter({ maint: ['arms'] }), cfg = Core.mergeCfg(raw), pr = Core.buildProgram([], cfg, {}), base = Core.buildProgram([], Core.mergeCfg(starter()), {});
  const pv = pr.after.pv, hold = maintOf(cfg);
  for (const m of tracked(cfg)) {
    if (hold[m]) assert.ok((pv[m] || 0) >= MAINT.min - 0.01 && (pv[m] || 0) <= base.after.pv[m] - 3, m + ': ' + pv[m] + ' против ' + base.after.pv[m]);
    else assert.ok((pv[m] || 0) >= cfg.zones.opt - 0.75, m + ': ' + pv[m]);
    assert.ok(daysOf(pr, m) >= 2, m + ': один день');
  }
  assert.ok(total(pr) < total(base), total(pr) + ' подходов против ' + total(base));
  const say = noteOf(pr, /^На поддержании: /);
  assert.ok(say && /^На поддержании: бицепс и трицепс — /.test(say.t), JSON.stringify(pr.notes.map(n => n.t)));
  assert.match(say!.x!, /треть общего уровня, но не меньше 4 подходов в неделю/);
  assert.ok(!noteOf(base, /^На поддержании/), 'без отметки заметки нет');
  assert.equal(Core.buildProgram([], acceptAs(raw, pr, '2025-11-20'), {}).same, true, 'после «Принять»');
}));

test('с выбранным временем подходы и время уходят мышцам, которые растут: уровень остальных не ниже, чем без отметки; дни укладываются; после «Принять» — та же программа', () => withDays(3, () => {
  for (const [time, maint] of [[90, ['arms']], [120, ['arms']], [90, ['thighs', 'glutes']]] as [number, string[]][]) {
    const label = time + ' мин, ' + maint.join(' '), raw = starter({ maint }), cfg = Core.mergeCfg(raw), hold = maintOf(cfg);
    const pr = Core.buildProgram([], cfg, { time }), base = Core.buildProgram([], Core.mergeCfg(starter()), { time });
    const grow = tracked(cfg).filter(m => !hold[m]), low = (b: Built) => Math.min(...grow.map(m => b.after.pv[m] || 0));
    assert.ok(low(pr) >= low(base) - 0.01, label + ': остальные ' + low(pr) + ' против ' + low(base));
    for (const m of Object.keys(hold)) assert.ok((pr.after.pv[m] || 0) >= MAINT.min - 0.01 && (pr.after.pv[m] || 0) < low(pr), label + ': ' + m + ' ' + pr.after.pv[m]);
    for (const sl of Core.SLOTS) assert.ok(Core.estMinutes(pr.cfg, pr.slots[sl.id]) <= time + 2.5, label + ': ' + sl.id + ' не влезает');
    assert.equal(Core.buildProgram([], acceptAs(raw, pr, '2025-11-20'), { time }).same, true, label + ': после «Принять»');
  }
  /* руки на поддержании, 1 ч 30 мин: остальным — 12 вместо 10 (без отметки широчайшие и задние дельты — 9.5) */
  const pr = Core.buildProgram([], Core.mergeCfg(starter({ maint: ['arms'] })), { time: 90 });
  assert.match(noteOf(pr, /^Все мышцы в рабочей зоне|^Нагрузка поровну/)!.x!, /общий уровень поднят с 10 до 12 подходов в неделю/);
}));

test('мышцы в приоритете и мышцы цели «Силы» растут, даже если их группа на поддержании', () => withDays(3, () => {
  const glutes = (maint: string[], o: BuildOpts) => Core.buildProgram([], Core.mergeCfg(starter({ maint })), o);
  const a = glutes(['glutes'], { prio: 'glutes' }), b = glutes([], { prio: 'glutes' });
  assert.equal(a.after.pv.glutes, b.after.pv.glutes);
  assert.ok(!noteOf(a, /^На поддержании/));
  const c = glutes(['chest', 'arms'], { focus: 'bench', strength: true }), d = glutes([], { focus: 'bench', strength: true });
  assert.equal(c.after.pv.chest, d.after.pv.chest, 'грудь — мышца цели «Сила: жим лежа»');
  assert.match(noteOf(c, /^На поддержании: /)!.t, /^На поддержании: бицепс и трицепс — /);
}));
