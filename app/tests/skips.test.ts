/* Поправка «Не делал два раза» и время по факту (просьба владельца, 25 ноября 2026; docs/03, раздел 20): core/skips.ts, core/pace.ts, records.ts.
   Всё — с днями «День 1…3» на примерных данных из data/; с таблицей дней эталона поправки нет, а оценка времени — по формуле, как в эталоне. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { SKIP, applySkips } from '../src/core/skips.ts';
import { tally } from '../src/core/tally.ts';
import { PACE_RULE, okMin, paceOf, paceOne, setPace } from '../src/core/pace.ts';
import { MAX_SETS } from '../src/core/rules.ts';
import type { Cfg, Item, ProgSlots, SkipFix, Workout } from '../src/core/types.ts';
import type { Adapted } from '../src/core/index.ts';

function withDays<T>(n: number, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const seedRaw = () => readJson('data/config.json');
const seedW = (): Workout[] => Core.sortW(readJson('data/workouts.json').map((d: { date: string }) => Core.fromDoc(d.date, d)));
const OFF: Record<string, number> = { mon: 0, wed: 2, fri: 4 };

/* тренировки по плану дневника после примерного журнала: упражнения `miss` в дне `slot` не сделаны (так их оставляет «Завершить тренировку»),
   остальное сделано по нижней границе. Останавливается перед тренировкой дня `slot`, которой предшествуют `times` таких пропусков */
function skipRun(cfg: Cfg, miss: string[], slot: string, times = SKIP.times, W0 = seedW()) {
  let W = W0.slice(), n = 0;
  const dateOf = (wk: number, sl: string) => Core.addDays(cfg.start!, 7 * (wk - 1) + OFF[sl]);
  const sched: [number, string][] = [[10, 'wed'], [10, 'fri']];
  for (let k = 11; k < 16; k++) for (const sl of ['mon', 'wed', 'fri']) sched.push([k, sl]);
  for (const [wk, sl] of sched) {
    const date = dateOf(wk, sl), A = Core.adapt(W, cfg, sl, date);
    if (sl === slot && n === times) return { W, date, A };
    const items: Item[] = Core.clone(Core.applyAdapt(A, A.off0).items).filter((it: Item) => cfg.ex[it.ex]);
    for (const it of items) {
      if (sl === slot && miss.includes(it.ex)) { it.skip = true; it.sets.forEach(s => { s.r = null; s.skip = true; }); continue; }
      it.sets.forEach(s => { s.r = it.cyc ? it.cyc.reps : it.range![0]; if (it.cyc) s.q = 2; if (s.w == null) s.w = 10; });
    }
    if (sl === slot && items.some(it => miss.includes(it.ex))) n++;
    W = Core.sortW(W.concat([{ id: date, date, slot: sl, note: '', open: false, items }]));
  }
  throw new Error('пропусков меньше ' + times);
}
const fixOf = (A: Adapted, ex: string) => A.props.find(p => p.ex === ex && p.tag === SKIP.tag);
/* тренировка дня по плану с поправкой, законченная без убранного упражнения, и программа, которую из неё пишет экран (ui/skipfix.ts, skipProgram) */
function finishWith(raw: Record<string, unknown>, W: Workout[], cfg: Cfg, A: Adapted, slot: string, date: string) {
  const items: Item[] = Core.clone(Core.applyAdapt(A, A.off0).items);
  items.forEach(it => it.sets.forEach(s => { s.r = it.cyc ? it.cyc.reps : it.range![0]; if (it.cyc) s.q = 2; if (s.w == null) s.w = 10; }));
  const W2 = Core.sortW(W.concat([{ id: date, date, slot, note: '', open: false, items }]));
  const fixes = A.props.filter(p => p.drop && p.fix!.kind !== 'drop').map(p => p.fix!) as SkipFix[];
  const slots: ProgSlots = applySkips(Core.currentSlots(W2, cfg), fixes);
  const r = Object.assign({}, raw, { program: { name: 'Своя программа', focus: '', others: '', lean: true, since: date, made: date, slots } });
  return { W2, cfg2: Core.mergeCfg(r), slots };
}
const pvOf = (cfg: Cfg, slots: ProgSlots) => tally(cfg, Object.fromEntries(Core.SLOTS.map(s => [s.id, { items: slots[s.id] }]))).pv;
const r1 = (v: number | undefined) => Math.round((v || 0) * 10) / 10;

test('«Не делал два раза»: перенос — упражнение уходит из дня в день, где на него хватает времени; со следующей тренировки он там, объём недели тот же', () => withDays(3, () => {
  const raw = seedRaw(), cfg = Core.mergeCfg(raw);
  const { W, date, A } = skipRun(cfg, ['leg_ext'], 'wed');
  const p = fixOf(A, 'leg_ext')!;
  assert.ok(p && p.drop, 'поправка в плане дня');
  assert.deepEqual([p.fix!.kind, p.fix!.to, p.fix!.n], ['move', 'mon', 2]);
  assert.match(p.notes[0], /^два раза подряд не сделано \(12 ноя и 19 ноя\): переезжает в День 1 — с ним там ≈ 1 ч, не дольше тренировок, которые ты успеваешь целиком$/);
  assert.ok(!Core.applyAdapt(A, A.off0).items.some(it => it.ex === 'leg_ext'), 'с поправкой упражнения в плане нет');
  assert.ok(Core.applyAdapt(A, { [p.key]: true }).items.some(it => it.ex === 'leg_ext'), 'поправка снимается галочкой');
  const before = pvOf(cfg, Core.currentSlots(W, cfg));
  const { W2, cfg2, slots } = finishWith(raw, W, cfg, A, 'wed', date);
  assert.deepEqual(slots.mon.slice(-1), [{ ex: 'leg_ext', n: 2 }], 'в конце нового дня');
  assert.equal(r1(pvOf(cfg2, slots).quads), r1(before.quads), 'подходы квадрицепса в неделю те же');
  const mon = Core.adapt(W2, cfg2, 'mon', Core.addDays(date, 5));
  assert.ok(mon.base.items.some(it => it.ex === 'leg_ext' && it.sets.length === 2), 'День 1 получает упражнение со следующей тренировки');
  const wed = Core.adapt(Core.sortW(W2), cfg2, 'wed', Core.addDays(date, 7));
  assert.ok(!wed.base.items.some(it => it.ex === 'leg_ext') && !wed.props.some(x => x.tag === SKIP.tag), 'в своём дне его нет, поправки тоже: счёт начинается заново');
}));

test('«Не делал два раза»: раздача — когда целиком некуда, подходы уходят упражнениям на ту же мышцу, не больше 5 в упражнении', () => withDays(3, () => {
  const raw = seedRaw(), cfg = Core.mergeCfg(raw);
  const { W, date, A } = skipRun(cfg, ['tri_pushdown'], 'fri');
  const p = fixOf(A, 'tri_pushdown')!;
  assert.deepEqual([p.fix!.kind, p.fix!.adds, p.fix!.left], ['spread', [{ sl: 'mon', ex: 'tri_overhead', k: 2 }], 0]);
  assert.match(p.notes[0], /целиком ни в один день не помещается \(другие дни с ним вышли бы дольше тех, что ты успеваешь целиком\), поэтому уходит, а подходы — «Трицепс из за головы на блоке с косичкой» \(День 1\) \+2$/);
  const before = pvOf(cfg, Core.currentSlots(W, cfg));
  const { cfg2, slots } = finishWith(raw, W, cfg, A, 'fri', date);
  const e = slots.mon.find(x => x.ex === 'tri_overhead')!;
  assert.ok(e.n! <= MAX_SETS);
  assert.equal(r1(pvOf(cfg2, slots).triceps), r1(before.triceps), 'подходы трицепса в неделю те же');
  /* упражнение на ту же мышцу в другом дне, но не той же группы: подходы бицепсу — молоткам */
  const b = fixOf(skipRun(cfg, ['barbell_curl'], 'wed').A, 'barbell_curl')!;
  assert.deepEqual([b.fix!.kind, b.fix!.adds], ['spread', [{ sl: 'mon', ex: 'hammer', k: 2 }]]);
  assert.match(b.notes[0], /\(в других днях уже есть упражнение на те же мышцы\)/, 'причина — настоящая');
}));

test('«Не делал два раза»: убрать — когда и подходы некуда; заметка называет, сколько у мышцы останется по программе, и подсказывает время на «Программе»', () => withDays(3, () => {
  const cfg = Core.mergeCfg(seedRaw());
  const { A } = skipRun(cfg, ['lat_pulldown'], 'mon');
  const p = fixOf(A, 'lat_pulldown')!;
  assert.deepEqual([p.fix!.kind, p.fix!.left], ['drop', 3]);
  assert.equal(p.notes[0], 'два раза подряд не сделано (17 ноя и 24 ноя): уходит из программы — другие дни с ним вышли бы дольше тех, что ты успеваешь целиком; по программе широчайшие — 6 подходов в неделю');
  assert.equal(p.notes[1], 'не успеваешь и другие дни — выбери на «Программе» время на тренировку: дни станут короче');
  assert.deepEqual(applySkips({ mon: [], wed: [{ ex: 'x', n: 2 }], fri: [] }, [p.fix!]), { mon: [], wed: [{ ex: 'x', n: 2 }], fri: [] }, 'в программу «убрать» не пишет ничего: убирает сама тренировка');
}));

test('«Не делал два раза»: пара сторон идёт вместе, как одно упражнение', () => withDays(3, () => {
  const cfg = Core.mergeCfg(seedRaw());
  const { A } = skipRun(cfg, ['wrist_cable_r', 'wrist_cable_l'], 'wed');
  const r = fixOf(A, 'wrist_cable_r')!, l = fixOf(A, 'wrist_cable_l')!;
  assert.equal(r.fix!.kind, l.fix!.kind);
  assert.equal(r.fix!.to, l.fix!.to);
  /* одна сторона — переезжает, как любое упражнение */
  const one = fixOf(skipRun(cfg, ['wrist_cable_r'], 'wed').A, 'wrist_cable_r')!;
  assert.deepEqual([one.fix!.kind, one.fix!.to], ['move', 'mon']);
}));

test('«Не делал два раза»: только два пропуска подряд, только с днями «День N»', () => {
  withDays(3, () => {
    const cfg = Core.mergeCfg(seedRaw());
    assert.equal(fixOf(skipRun(cfg, ['leg_ext'], 'wed', 1).A, 'leg_ext'), undefined, 'один пропуск — поправки нет');
    /* пропуск, потом сделано, потом пропуск — подряд не два */
    const a = skipRun(cfg, ['leg_ext'], 'wed', 1);
    const b = skipRun(cfg, [], 'wed', 0, a.W);
    const items = Core.clone(Core.applyAdapt(b.A, b.A.off0).items) as Item[];
    items.forEach(it => it.sets.forEach(s => { s.r = it.range ? it.range[0] : 5; if (s.w == null) s.w = 10; }));
    const W = Core.sortW(b.W.concat([{ id: b.date, date: b.date, slot: 'wed', note: '', open: false, items }]));
    assert.equal(fixOf(skipRun(cfg, ['leg_ext'], 'wed', 1, W).A, 'leg_ext'), undefined, 'сделано между пропусками — поправки нет');
  });
  /* с таблицей дней эталона — как в эталоне: поправки нет */
  const cfg = Core.mergeCfg(seedRaw());
  const { A } = skipRun(cfg, ['leg_ext'], 'wed');
  assert.ok(!A.props.some(p => p.tag === SKIP.tag));
});

test('время по факту: темп — медиана «названное / посчитанное» по последним пяти, от двух тренировок, без опечаток, в пределах 0.75–1.75, шагом 0.05', () => withDays(3, () => {
  const cfg = Core.mergeCfg(seedRaw()), W = seedW();
  assert.deepEqual(paceOf(W, cfg), { k: 1, n: 0 }, 'времени нет — оценка по формуле');
  const est = (w: Workout) => Core.estMinutes(cfg, w.items, null, false, true);
  const named = (ks: number[]) => W.map((w, i) => { const j = i - (W.length - ks.length); return j >= 0 ? Object.assign({}, w, { min: Math.round(est(w) * ks[j]) }) : w; });
  assert.deepEqual(paceOf(named([1.3]), cfg), { k: 1, n: 1 }, 'одной тренировки мало');
  assert.equal(paceOf(named([1.3, 1.3, 1.3]), cfg).k, 1.3);
  assert.equal(paceOf(named([1.2, 1.2, 2.4, 1.2, 1.2]), cfg).k, 1.2, 'одна долгая тренировка темп не сдвигает');
  assert.deepEqual(paceOf(named([1.2, 1.2, 0.1]), cfg), { k: 1.2, n: 2 }, 'опечатка не в расчёте');
  assert.equal(paceOf(named([2.2, 2.2, 2.2]), cfg).k, PACE_RULE.hi);
  assert.equal(paceOf(named([0.5, 0.5, 0.5]), cfg).k, PACE_RULE.lo);
  const r = paceOne(cfg, named([1.23])[W.length - 1])!;
  assert.ok(Math.abs(r - 1.23) < 0.02);
  assert.equal(paceOf(named([1.23, 1.23]), cfg).k, 1.25, 'шагом 0.05');
  /* оценка множится на темп; темп самих тренировок считается без него */
  const items = W[W.length - 1].items, base = Core.estMinutes(cfg, items);
  try {
    setPace(1.3);
    assert.ok(Math.abs(Core.estMinutes(cfg, items) - base * 1.3) < 1e-9);
    assert.equal(Core.estMinutes(cfg, items, null, false, true), base);
  } finally { setPace(1); }
}));

test('время по факту: с таблицей дней эталона оценка — по формуле, как в эталоне; запись хранит целые минуты, без времени — как раньше', () => {
  const cfg = Core.mergeCfg(seedRaw()), items = seedW().slice(-1)[0].items, base = Core.estMinutes(cfg, items);
  try { setPace(1.5); assert.equal(Core.estMinutes(cfg, items), base); } finally { setPace(1); }
  const w = Core.fromDoc('2025-11-12', { date: '2025-11-12', slot: 'wed', min: 47.6, items: [{ ex: 'leg_ext', sets: '40x10 40x9' }] });
  assert.equal(w.min, 48);
  assert.equal(Core.toDoc(w).min, 48);
  const old = { date: '2025-11-12', slot: 'wed', items: [{ ex: 'leg_ext', sets: '40x10 40x9' }] };
  assert.deepEqual(Core.toDoc(Core.fromDoc('2025-11-12', old)), old, 'запись без времени — та же');
  assert.deepEqual([okMin(4), okMin(5), okMin(62.4), okMin(300), okMin(301), okMin(null), okMin(NaN)], [null, 5, 62, 300, null, null, null]);
});
