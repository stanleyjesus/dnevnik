/* Программа с нуля и базовые (решение владельца, 19 ноября 2026; в эталоне этого правила нет):
   сборка пустой программы ставит упражнения по волне из справочника по одному в день, каждое первым;
   пауэрбилдинг для базового, которого нет в программе, сам ставит его в день.
   Там, где базовые в программе уже стоят или их нет в справочнике вовсе, сборка обязана остаться такой же, как у эталона. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ref, plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { withStarter } from '../src/core/starter.ts';
import type { Cfg, ExDef, ProgSlots, Workout } from '../src/core/types.ts';

type Raw = { ex: Record<string, ExDef>; gear?: Record<string, { n?: string; step?: number }> };
const starter = (): Raw => plain(withStarter<Raw>(null));
const first = (slots: ProgSlots) => Core.SLOTS.map(sl => (slots[sl.id][0] || { ex: '' }).ex);
const total = (pr: { after: { load: Record<string, number> } }) => Core.SLOTS.reduce((a, sl) => a + pr.after.load[sl.id], 0);
const inZone = (cfg: Cfg, pr: { after: { pv: Record<string, number> } }, top = 5) => {
  for (const m of Core.MUSCLES) {
    const v = pr.after.pv[m.id] || 0;
    if (cfg.ignore[m.id]) continue;
    assert.ok(v >= cfg.zones.opt - 0.75 && v <= cfg.zones.opt + top, m.n + ': ' + v);
  }
};
const noteOf = (pr: { notes: { t: string; x?: string }[] }, start: string) => pr.notes.find(n => n.t.startsWith(start));

test('с нуля, «Равномерно»: базовые по одному в день и первыми, остальное — как обычно', () => {
  const cfg = Core.mergeCfg(starter()), pr = Core.buildProgram([], cfg, {});
  assert.deepEqual(first(pr.slots), ['bench', 'leg_press', 'pullup']);
  for (const id of ['bench', 'leg_press', 'pullup']) assert.equal(Core.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id)).length, 1, id + ' стоит не в одном дне');
  for (const sl of Core.SLOTS) {
    assert.ok(pr.slots[sl.id].length >= 5, sl.n + ': упражнений ' + pr.slots[sl.id].length);
    assert.equal(pr.slots[sl.id].filter(e => Core.isCycle(pr.cfg, e.ex)).length, 1, sl.n + ': базовое одно');
    assert.ok(pr.slots[sl.id][0].isNew && pr.slots[sl.id][0].n === undefined, sl.n + ': базовое новое и без числа подходов — его задаёт волна');
  }
  assert.deepEqual(pr.goals, { bench: null, leg_press: null, pullup: null }, 'все три — на обычной волне');
  assert.deepEqual(Object.keys(pr.create), []);
  assert.ok(total(pr) <= cfg.caps.week + 0.01);
  inZone(cfg, pr);
  for (const m of Core.MUSCLES.filter(x => cfg.ignore[x.id])) assert.ok((pr.after.pv[m.id] || 0) === 0, m.n + ' вне расчёта — ноль');
  const n = noteOf(pr, 'Базовые — первыми в своих днях');
  assert.equal(n && n.t, 'Базовые — первыми в своих днях: Жим лежа (пн), Жим ногами (ср), Подтягивания (пт)');
  assert.ok(!pr.notes.some(x => String(x.x).includes('undefined')), 'в заметках нет «undefined»: ' + JSON.stringify(pr.notes.filter(x => String(x.x).includes('undefined'))));
  assert.equal(pr.same, false);
});

test('с нуля, пауэрбилдинг: тяжёлый день в понедельник, лёгкий — в самый дальний, в третьем — упражнение на массу, остальные базовые на поддержании', () => {
  const cfg = Core.mergeCfg(starter());
  for (const [lift, others] of [['bench', ['leg_press', 'pullup']], ['leg_press', ['bench', 'pullup']], ['pullup', ['bench', 'leg_press']]] as [string, string[]][]) {
    const pr = Core.buildProgram([], cfg, { focus: lift });
    assert.equal(pr.name, 'Пауэрбилдинг: ' + cfg.ex[lift].n.toLowerCase());
    assert.equal(pr.focus, lift); assert.equal(pr.others, 'hold');
    assert.equal(pr.slots.mon[0].ex, lift, 'приоритетное — первым в понедельник');
    assert.equal(pr.slots.fri[0].ex, lift + '_light', 'лёгкий день — первым в пятницу: она дальше всего от понедельника');
    assert.deepEqual(plain(pr.goals), { [lift]: 'auto', [others[0]]: 'hold', [others[1]]: 'hold' });
    assert.deepEqual(Object.keys(pr.create), [lift + '_light']);
    assert.equal(pr.create[lift + '_light'].of, lift);
    /* остальные базовые — по одному в день, вторым или первым */
    assert.equal(pr.slots.wed[0].ex, others[0]); assert.equal(pr.slots.fri[1].ex, others[1]);
    /* третий день: закреплённое упражнение двойной прогрессии на главную мышцу базового */
    const pin = pr.slots.wed.filter(e => e.pin);
    assert.equal(pin.length, 1, 'в среде одно закреплённое упражнение');
    const main = Object.keys(cfg.ex[lift].m).filter(m => cfg.ex[lift].m[m] >= 1);
    assert.ok(main.some(m => (pr.cfg.ex[pin[0].ex].m[m] || 0) >= 1) && !Core.isCycle(pr.cfg, pin[0].ex), 'закреплено не то: ' + pin[0].ex);
    assert.ok(total(pr) <= cfg.caps.week + 0.01);
    inZone(cfg, pr);
    assert.ok(noteOf(pr, 'Базовые — первыми в своих днях') && noteOf(pr, cfg.ex[lift].n + ' — сила по запасу') && noteOf(pr, 'Второй день в пятницу') && noteOf(pr, 'Третий день в среду'));
  }
});

test('с нуля при лимите недели 60 и с приоритетом мышц: базовые на месте, лимит не превышен', () => {
  const cfg = Core.mergeCfg(starter());
  const a = Core.buildProgram([], cfg, { budget: 60 }), b = Core.buildProgram([], cfg, { prio: 'legs' }), c = Core.buildProgram([], cfg, { focus: 'pullup', budget: 80, others: 'grow' });
  for (const pr of [a, b]) assert.deepEqual(first(pr.slots), ['bench', 'leg_press', 'pullup']);
  assert.ok(total(a) <= 60.01, 'подходов ' + total(a));
  assert.ok(total(c) <= 80.01, 'подходов ' + total(c));
  assert.equal(b.prio, 'legs');
  assert.deepEqual(plain(c.goals), { pullup: 'auto', bench: null, leg_press: null }, '«растут как раньше»: остальные базовые на обычной волне');
});

test('с нуля, одно базовое в справочнике: дни не пустуют, лёгкий день и упражнение на массу встают в пустые дни', () => {
  const raw = starter(); delete raw.ex.leg_press.mode; delete raw.ex.pullup.mode;
  const cfg = Core.mergeCfg(raw), even = Core.buildProgram([], cfg, {}), pb = Core.buildProgram([], cfg, { focus: 'bench' });
  assert.equal(even.slots.mon[0].ex, 'bench');
  for (const sl of Core.SLOTS) assert.ok(even.slots[sl.id].length >= 5, '«Равномерно», ' + sl.n + ': упражнений ' + even.slots[sl.id].length);
  inZone(cfg, even);
  assert.equal(pb.slots.mon[0].ex, 'bench'); assert.equal(pb.slots.fri[0].ex, 'bench_light');
  assert.equal(pb.slots.wed.filter(e => e.pin).length, 1);
  for (const sl of Core.SLOTS) assert.ok(pb.slots[sl.id].length >= 5, 'пауэрбилдинг, ' + sl.n + ': упражнений ' + pb.slots[sl.id].length);
});

test('с нуля, базовых больше, чем дней: встают три, приоритетное — первым; об остальных сказано', () => {
  const raw = starter(); raw.ex.squat.mode = 'cycle';
  const cfg = Core.mergeCfg(raw), ls = Object.keys(cfg.ex).filter(id => Core.isCycle(cfg, id));
  assert.deepEqual(ls, ['bench', 'leg_press', 'pullup', 'squat']);
  const pr = Core.buildProgram([], cfg, { focus: 'squat' });
  assert.deepEqual(first(pr.slots).map(id => id.replace('_light', '')), ['squat', 'bench', 'squat']);
  assert.ok(!Core.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === 'pullup')), 'четвёртое базовое в программу не попало');
  assert.ok(noteOf(pr, 'Базовые — первыми в своих днях')!.x!.includes('не поместились: Подтягивания'));
});

test('без базовых в справочнике сборка с нуля — та же, что у эталона', () => {
  const raw = starter(); for (const id of ['bench', 'leg_press', 'pullup']) delete raw.ex[id].mode;
  for (const o of [{}, { budget: 60 }, { prio: 'glutes' }, { focus: 'bench' }]) {
    const mine = Core.buildProgram([], Core.mergeCfg(plain(raw)), o), ref = Ref.buildProgram([], Ref.mergeCfg(plain(raw)), o);
    assert.deepEqual(plain([mine.slots, mine.notes, mine.goals, mine.name, mine.create]), plain([ref.slots, ref.notes, ref.goals, ref.name, ref.create]), JSON.stringify(o));
  }
});

test('программа уже есть, а приоритетного базового в ней нет: оно встаёт первым в день без другого базового, дальше — обычный пауэрбилдинг', () => {
  /* программа из двух дней без базовых и третьего с жимом ногами; жим лежа в справочнике по волне, но не в программе */
  const raw = starter();
  const prog: ProgSlots = { mon: [{ ex: 'row_machine', n: 4 }, { ex: 'db_ohp', n: 3 }, { ex: 'leg_ext', n: 3 }, { ex: 'barbell_curl', n: 3 }], wed: [{ ex: 'leg_press' }, { ex: 'lat_pulldown', n: 4 }, { ex: 'tri_pushdown', n: 3 }], fri: [{ ex: 'rdl', n: 3 }, { ex: 'pec_fly', n: 3 }] };
  const cfg = Core.mergeCfg(Object.assign(raw, { program: { name: 'Своя', since: '2025-11-17', made: '2025-11-17', slots: prog } }));
  const pr = Core.buildProgram([], cfg, { focus: 'bench' });
  assert.equal(pr.slots.fri[0].ex, 'bench', 'жим встал первым в пятницу: в ней нет базового и она легче понедельника');
  assert.equal(pr.slots.fri[0].isNew, true);
  assert.equal(pr.slots.mon[0].ex, 'bench_light', 'лёгкий день — в понедельник: он дальше всего от пятницы');
  assert.deepEqual(plain(pr.goals), { bench: 'auto', leg_press: 'hold' });
  assert.ok(!Core.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === 'pullup')), 'базовое, которого в программе не было и которое не в приоритете, сборка не ставит');
  const n = noteOf(pr, 'Жим лежа — в программу в пятницу');
  assert.ok(n && n.x!.includes('без другого базового'), JSON.stringify(pr.notes.map(x => x.t)));
  /* без приоритета такая программа собирается как у эталона: чужие базовые сборка не добавляет */
  const mine = Core.buildProgram([], cfg, {}), ref = Ref.buildProgram([], Ref.mergeCfg(plain(Object.assign(starter(), { program: cfg.program }))), {});
  assert.deepEqual(plain([mine.slots, mine.notes, mine.goals]), plain([ref.slots, ref.notes, ref.goals]));
});

test('примерные данные и дневник неделей позже: ни одна сборка не изменилась', () => {
  const sets: [string, unknown, Record<string, unknown>[]][] = [['примерные данные, первый профиль', readJson('data/config.json'), readJson('data/workouts.json').map((d: { date: string }) => Object.assign({ id: d.date }, d))], ['примерные данные, второй профиль', readJson('data/config.p2.stored.json'), []]];
  for (const p of readJson('data/later.json').profiles) if (p.config) sets.push(['дневник неделей позже, ' + p.id, p.config, p.workouts]);
  let n = 0;
  for (const [title, config, docs] of sets) {
    const W: Workout[] = Core.sortW(docs.map(d => Core.fromDoc(String(d.id), d))), RW = Ref.sortW(docs.map(d => Ref.fromDoc(d.id, d)));
    const cfg = Core.mergeCfg(plain(config)), lifts = Object.keys(cfg.ex).filter(id => Core.isCycle(cfg, id));
    const opts = [{}, { budget: 60 }, { budget: 80 }, { prio: 'back' }, { prio: 'legs', budget: 70 }, { prio: 'glutes', budget: 60 }, ...lifts.map(id => ({ focus: id })), ...lifts.map(id => ({ focus: id, others: 'grow', budget: 80 }))];
    for (const o of opts) {
      const mine = Core.buildProgram(W, cfg, o), ref = Ref.buildProgram(RW, Ref.mergeCfg(plain(config)), o);
      assert.deepEqual(plain([mine.slots, mine.notes, mine.goals, mine.name, mine.create, mine.after.pv]), plain([ref.slots, ref.notes, ref.goals, ref.name, ref.create, ref.after.pv]), title + ' ' + JSON.stringify(o));
      n++;
    }
  }
  assert.ok(n >= 36, 'проверено сборок: ' + n);
});
