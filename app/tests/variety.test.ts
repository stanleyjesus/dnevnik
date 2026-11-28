/* Разнообразие, прямая работа и замены (просьба владельца, 28 ноября 2026, пункты 6–9; rules.ts, docs/03, раздел 23).
   Всё — с днями «День N» на встроенном справочнике: сборка с нуля в «Массе», как в онбординге. С таблицей дней эталона — как в эталоне. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ref, plain } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { STARTER, withStarter } from '../src/core/starter.ts';
import { GLUTE_WORK, appRules, armLift, stretchOf, swappable } from '../src/core/rules.ts';
import type { BuildOpts, Cfg, ExDef } from '../src/core/types.ts';

type Built = ReturnType<typeof Core.buildProgram>;
function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const build = (o: BuildOpts) => Core.buildProgram([], Core.mergeCfg(withStarter(null)), o);
const ids = (pr: Built) => Core.SLOTS.flatMap(sl => pr.slots[sl.id].map(e => e.ex));
const repeats = (pr: Built) => { const n: Record<string, number> = {}; for (const id of ids(pr)) n[id] = (n[id] || 0) + 1; return Object.keys(n).filter(id => n[id] > 1).sort(); };
const total = (pr: Built) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const TIMES = [0, 90, 120];

test('«Масса — поровну — 2 дня — без времени»: жима узким хватом нет, у трицепса — разгибания из-за головы, ни одно упражнение не повторяется', () => withDays(2, () => {
  const pr = build({});
  assert.ok(!ids(pr).includes('close_grip_bench'), 'жим узким хватом');
  assert.ok(ids(pr).some(id => /из.за головы/.test(pr.cfg.ex[id].n) && pr.cfg.ex[id].pat === 'iso'), 'разгибания из-за головы');
  assert.deepEqual(repeats(pr), []);
  assert.equal(total(pr), 68, 'подходов в неделю: до 28 ноября 2026 — 66, с тем же упражнением в обоих днях');
}));

test('«Поровну» при двух, трёх и четырёх днях повторяется только то, у чего в справочнике нет другого упражнения не хуже', () => {
  for (const days of [2, 3, 4]) withDays(days, () => {
    for (const time of TIMES) {
      const pr = build({ time });
      /* повтор — когда без него объём недели хуже: таких мало, а растянутый вариант на другой не меняется. До 28 ноября 2026 — от 6 до 16 */
      assert.ok(repeats(pr).length <= (days === 4 ? 4 : 1), days + ' дня, ' + time + ': ' + repeats(pr).join());
    }
    if (days === 3) {
      const pr = build({});
      assert.deepEqual(repeats(pr), ['leg_curl_seated'], 'три дня без времени: повторяются только сгибания ног сидя — растянутый вариант');
      assert.ok(stretchOf(pr.cfg.ex.leg_curl_seated) > 0);
    }
  });
});

test('жим узким хватом — только когда у трицепса в неделе уже есть изоляция; при двух днях «поровну» его нет', () => {
  const triIso = (pr: Built) => ids(pr).some(id => pr.cfg.ex[id].pat === 'iso' && (pr.cfg.ex[id].m.triceps || 0) >= 1);
  for (const days of [2, 3, 4]) withDays(days, () => {
    for (const prio of ['', 'glutes', 'legs', 'back', 'chest', 'delts']) for (const time of TIMES) {
      const pr = build({ prio, time });
      if (ids(pr).includes('close_grip_bench')) assert.ok(triIso(pr), days + ' дня, ' + (prio || 'поровну') + ', ' + time);
      if (days === 2 && !prio) assert.ok(!ids(pr).includes('close_grip_bench'), '2 дня, поровну, ' + time);
    }
  });
});

test('многосуставное только на руки — после изоляции на них; с руками или верхом тела в приоритете жим узким хватом остаётся', () => withDays(2, () => {
  assert.ok(armLift(STARTER.close_grip_bench), 'жим узким хватом');
  for (const id of ['bench', 'db_bench', 'ohp', 'barbell_curl', 'tri_overhead']) assert.ok(!armLift(STARTER[id]), id);
  for (const prio of ['arms', 'upper']) {
    const pr = build({ prio });
    assert.ok(ids(pr).includes('close_grip_bench'), prio);
  }
}));

test('с таблицей дней эталона жим узким хватом — обычное многосуставное', () => {
  assert.equal(appRules(), false);
  assert.ok(!armLift(STARTER.close_grip_bench));
});

test('ягодицы в приоритете «Массы»: в неделе есть ягодичный мост и отведение ноги в сторону — при двух, трёх и четырёх днях, со временем и без', () => {
  for (const days of [2, 3, 4]) withDays(days, () => {
    for (const time of TIMES) {
      const pr = build({ prio: 'glutes', time });
      for (const g of GLUTE_WORK) assert.ok(ids(pr).some(id => g.is(pr.cfg.ex[id])), days + ' дня, ' + time + ': ' + g.n);
    }
  });
  withDays(3, () => {
    const pr = build({ prio: 'glutes' });
    assert.equal(total(pr), 72, 'три дня без времени: до 28 ноября 2026 — 68, отведения не было');
  });
});

test('прямая работа на ягодицы: мост — без бицепса бедра основным, отведение — в сторону, а не назад', () => withDays(3, () => {
  const cfg = Core.mergeCfg(withStarter(null)), is = (g: string, id: string) => GLUTE_WORK.find(x => x.id === g)!.is(cfg.ex[id]);
  for (const id of ['hip_thrust', 'glute_bridge_machine', 'smith_hip_thrust']) assert.ok(is('bridge', id), id);
  for (const id of ['rdl', 'squat', 'lunge', 'abduction']) assert.ok(!is('bridge', id), id);
  for (const id of ['abduction', 'cable_abduction']) assert.ok(is('side', id), id);
  for (const id of ['cable_kickback', 'kickback_machine', 'hip_thrust']) assert.ok(!is('side', id), id);
}));

test('«Заменить»: в «Массе» у приседаний есть жим ногами; базовое по проценту и лёгкий день не меняются; с таблицей дней эталона базовых в заменах нет', () => {
  const swaps = (cfg: Cfg, id: string) => { const s = Core.swapsFor(cfg, id, []); return s.same.concat(s.near).map(x => x.id); };
  withDays(3, () => {
    const cfg = Core.mergeCfg(withStarter(null));
    assert.ok(swappable(cfg, 'leg_press') && swaps(cfg, 'squat').includes('leg_press'), 'жим ногами вместо приседаний');
    assert.ok(swaps(cfg, 'hack_squat').includes('leg_press'), 'и вместо гакк-приседаний');
    assert.ok(swaps(cfg, 'leg_press').includes('squat'), 'у жима ногами в «Массе» — свои замены');
    const pr = Core.buildProgram([], cfg, { focus: 'leg_press', strength: true });
    assert.ok(!swappable(pr.cfg, 'leg_press'), 'жим ногами — цель «Силы»: идёт по проценту');
    assert.ok(!swaps(pr.cfg, 'squat').includes('leg_press'), 'и в заменах его нет');
    for (const id of Object.keys(pr.cfg.ex)) if (pr.cfg.ex[id].mode === 'light') assert.ok(!swappable(pr.cfg, id), id);
  });
  assert.equal(appRules(), false);
  const ref = Core.mergeCfg(withStarter(null));
  assert.ok(!swappable(ref, 'leg_press') && !swaps(ref, 'squat').includes('leg_press'), 'с таблицей дней эталона — как в эталоне');
  assert.deepEqual(plain(Core.swapsFor(ref, 'squat', [])), plain(Ref.swapsFor(ref, 'squat', [])));
});

test('кнопка «+» у мышцы: новое упражнение — то, которого в неделе ещё нет', () => withDays(2, () => {
  const cfg = Core.mergeCfg(withStarter(null)), pr = build({}), o = { z: cfg.zones, ignore: cfg.ignore, budget: 100, dayCap: cfg.caps.day };
  const had = new Set(ids(pr)), texts: string[] = [];
  for (let i = 0; i < 3; i++) texts.push(Core.nudgeMuscle(pr.cfg, pr.slots, 'biceps', 1, o, (id: string, def: ExDef) => { pr.cfg.ex[id] = Core.placed(pr.cfg, Object.assign({ n: id }, def)); }).text);
  const added = texts.find(t => /^Новое упражнение/.test(t)), name = (added || '').replace(/^Новое упражнение: (.+) \(день \d\).*$/, '$1');
  assert.ok(added, texts.join(' | '));
  assert.ok(![...had].some(id => pr.cfg.ex[id].n === name), 'новое упражнение — не то, что уже стоит в другом дне: ' + added + '; без этого правила — «Бицепс со штангой стоя» во втором дне');
}));

test('встроенный справочник: 78 упражнений, жим в тренажёре на грудь — «сидя», новые упражнения угадываются по названию так же', () => {
  assert.equal(Object.keys(STARTER).length, 78);
  assert.equal(STARTER.chest_press.n, 'Жим в тренажере на грудь сидя');
  const NEW = ['incline_press_machine', 'smith_incline', 'cable_fly_low', 'pulldown_neutral', 'pullover_db', 'chest_row_db', 'arnold', 'incline_curl', 'tri_overhead_db', 'smith_squat', 'goblet_squat', 'step_up', 'smith_hip_thrust', 'kickback_machine', 'cable_abduction'];
  for (const id of NEW) {
    const e = STARTER[id], g = Core.guessEx(e.n)!;
    assert.ok(e, id);
    assert.deepEqual([g.pat, plain(g.m)], [e.pat, plain(e.m)], e.n);
    assert.equal(Core.gearGuess(e.n), e.gear, e.n);
  }
  assert.equal(new Set(Object.values(STARTER).map(e => e.n)).size, 78, 'названия не повторяются');
});
