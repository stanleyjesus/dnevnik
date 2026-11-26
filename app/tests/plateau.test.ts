/* Плато в двойной прогрессии с днями «День N» (решение владельца, 26 ноября 2026): остановка каскада после сброса и тренд по четырём неделям
   (rules.ts, plateauOf; adapt.ts). Разбор и источники — docs/03, раздел 21. Атлет выдуман: его «настоящий» максимум растёт на заданный процент
   в неделю, повторы считаются по Эпли с запасом 1 — так же, как в разборе «Сила, масса и плато». С таблицей дней эталона — прежнее правило. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { PLATEAU, plateauOf } from '../src/core/rules.ts';
import type { Cfg, Item, Session, SetRec, Workout } from '../src/core/types.ts';

function withDays<T>(n: number | null, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const EX = 'lat_pulldown', HI = 10, E0 = 100 * (1 + 11 / 30);
const iso = (d0: string, add: number) => { const d = new Date(d0 + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + add); return d.toISOString().slice(0, 10); };

/** Атлет на тяге верхнего блока: перед каждой тренировкой берёт план с поправками дневника, делает повторы по своему максимуму.
    log — отмечает запас, когда повторов больше верха диапазона; иначе останавливается на верхе диапазона и запас не пишет */
function athlete(perWeek: number, growWeek: number, n: number, log: boolean) {
  const cfg = Core.mergeCfg(readJson('data/config.json')), W: Workout[] = [], tags: string[] = [], slots = perWeek === 1 ? ['mon'] : ['mon', 'fri'], off: Record<string, number> = { mon: 0, fri: 4 };
  for (let wk = 0, k = 0; k < n; wk++) for (const sl of slots) {
    if (k >= n) break;
    const date = iso('2025-09-01', wk * 7 + off[sl]), E = E0 * Math.pow(1 + growWeek / perWeek, k);
    let it: Item, tag = '';
    if (!W.length) it = { ex: EX, range: [6, 10], cyc: null, note: '', skip: false, rir: null, sets: [100, 100, 100, 100].map(w => ({ w, r: null })) } as unknown as Item;
    else {
      const a = Core.adapt(W, cfg, sl, date), got = Core.applyAdapt(a, a.off0).items.find(x => x.ex === EX);
      it = got ? plain(got) : plain(W[W.length - 1].items[0]);
      tag = a.props.filter(p => p.ex === EX && !a.off0[p.key] && /Плато|Откат/.test(p.tag)).map(p => p.tag).join('');
    }
    it.sets = it.sets.map(s => { const w = s.w!, f = Math.floor(30 * (E / w - 1)), r = f - 1; return r > HI ? (log ? { w, r: HI, q: f - HI } : { w, r: HI }) : { w, r: Math.max(0, r) }; }) as SetRec[];
    W.push({ id: date, date, slot: sl, note: '', open: false, items: [it] } as unknown as Workout);
    tags.push(tag);
    k++;
  }
  const at = tags.map((t, i) => t ? (i + 1) + ':' + t : '').filter(Boolean), last = W[W.length - 1].items[0].sets;
  return { at, minW: Math.min(...W.map(w => w.items[0].sets[0].w!)), last: Math.max(...last.map(s => s.w!)) };
}

test('растущий атлет не получает «Плато»: и раз, и два раза в неделю, с запасом и без', () => withDays(3, () => {
  /* до правила: при росте 0.5% в неделю без отмеченного запаса — 24 «Отката» подряд и вес до нуля, с запасом — «Плато» каждые 4–5 недель */
  for (const pw of [1, 2]) for (const log of [false, true]) for (const g of [0.005, 0.01]) {
    const r = athlete(pw, g, 30, log);
    assert.deepEqual(r.at, [], pw + ' в неделю, рост ' + g * 100 + '%, запас ' + (log ? 'отмечен' : 'не отмечен'));
  }
  /* за 30 недель при 0.5% в неделю вес растёт со 100 до 115 кг */
  assert.equal(athlete(1, 0.005, 30, false).last, 115);
}));

test('настоящее плато: «Плато» раз в 6–8 недель, без «Отката» и без каскада — вес не ниже первого сброса', () => withDays(3, () => {
  /* без запаса: сброс, четыре тренировки возврата к 100 кг, четыре недели на нём — снова сброс */
  assert.deepEqual(athlete(1, 0, 30, false), { at: ['7:Плато', '15:Плато', '23:Плато'], minW: 90, last: 100 });
  /* запас отмечен: после сброса 90 × 14 — сразу назад к 100 кг */
  assert.deepEqual(athlete(1, 0, 30, true).at, ['7:Плато', '13:Плато', '19:Плато', '25:Плато']);
  /* два раза в неделю — окна те же четыре недели */
  assert.deepEqual(athlete(2, 0, 30, false).at, ['11:Плато', '26:Плато']);
}));

/* короткие записи для правила: одна тренировка — день, дата, подходы «вес × повторы» */
const S = (date: string, sets: [number, number][], slot = 'mon'): Session => {
  const ss = sets.map(([w, r]) => ({ w, r })) as SetRec[], it = { ex: EX, range: [6, 10], cyc: null, sets: ss } as unknown as Item;
  const m = Math.max(...ss.map(s => s.w! * (1 + (s.r! + 1) / 30)));
  return { date, wid: date, slot, item: it, sets: ss, top: ss[0], best: ss[0], e1: m, tm: null, metric: m } as Session;
};
const weekly = (from: string, rows: [number, number][][]) => rows.map((r, i) => S(iso(from, 7 * i), r));

test('тренд: четыре недели без прибавки к четырём неделям до них — плато; любая прибавка — нет', () => {
  const flat = weekly('2025-09-01', Array.from({ length: 8 }, () => [[100, 9], [100, 9], [100, 8]]));
  assert.equal(plateauOf(flat, '2025-10-27', 1)!.tag, 'Плато');
  /* окна по датам: в каждом нужно две тренировки */
  assert.equal(plateauOf(flat.slice(5), '2025-10-27', 1), null);
  assert.equal(PLATEAU.days, 28);
  /* лучший подход стоит, а третий подход прибавил повтор — не плато */
  const third = flat.slice(0, 7).concat([S('2025-10-20', [[100, 9], [100, 9], [100, 9]])]);
  assert.equal(plateauOf(third, '2025-10-27', 1), null);
  /* шаг веса: 102.5 × 9 по Эпли не сильнее 100 × 10, но вес в диапазоне новый — прибавка */
  const step = weekly('2025-09-01', [[[100, 9]], [[100, 9]], [[100, 10]], [[100, 10]], [[102.5, 9]], [[102.5, 9]], [[102.5, 9]], [[102.5, 9]]]);
  assert.equal(plateauOf(step, '2025-10-27', 1), null);
  /* лучший подход последних недель слабее прежнего больше чем на 5% — откат */
  const fall = weekly('2025-09-01', [[[100, 9]], [[100, 9]], [[100, 9]], [[100, 9]], [[97.5, 7]], [[97.5, 7]], [[97.5, 7]], [[97.5, 7]]]);
  assert.equal(plateauOf(fall, '2025-10-27', 1)!.tag, 'Откат');
});

test('остановка каскада: после снижения веса в дне считаются только новые тренировки', () => {
  /* сброс −10% и повторы до верха диапазона: по Эпли это ниже прежнего больше чем на 5%, но сравнивать не с чем — нового сброса нет */
  const reset = weekly('2025-09-01', [[[100, 9]], [[100, 9]], [[100, 9]], [[100, 9]], [[90, 10]], [[90, 10]], [[90, 10]], [[90, 10]]]);
  assert.equal(plateauOf(reset, '2025-10-27', 1), null);
  /* то же, когда вес снизил сам атлет на 5% и больше */
  const own = weekly('2025-09-01', [[[100, 9]], [[100, 9]], [[100, 9]], [[100, 9]], [[95, 9]], [[95, 9]], [[95, 9]], [[95, 9]]]);
  assert.equal(plateauOf(own, '2025-10-27', 1), null);
  /* через восемь недель на новом весе без прибавки — снова плато */
  const stuck = own.concat(weekly('2025-10-27', Array.from({ length: 4 }, () => [[95, 9]])));
  assert.equal(plateauOf(stuck, '2025-11-24', 1)!.tag, 'Плато');
  /* другой день того же упражнения с меньшим весом — не снижение: вес сравнивается внутри дня */
  const two = weekly('2025-09-01', Array.from({ length: 8 }, () => [[100, 9]])).concat(weekly('2025-09-05', Array.from({ length: 8 }, () => [[80, 9]])).map(x => Object.assign(x, { slot: 'fri' })));
  two.sort((a, b) => a.date < b.date ? -1 : 1);
  assert.equal(plateauOf(two, '2025-10-27', 1)!.tag, 'Плато');
});

test('«Неделей позже»: жим ногами — «Плато» через четыре недели после рекорда; средние дельты и бицепс бедра лёжа больше не «Плато»', () => {
  const later = readJson('data/later.json').profiles[0], LW: Workout[] = Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  const tags = (cfg: Cfg, sl: string, date: string) => Core.adapt(LW, cfg, sl, date).props.filter(p => /Плато|Откат/.test(p.tag)).map(p => p.ex + ':' + p.tag);
  withDays(3, () => {
    const cfg = Core.mergeCfg(later.config);
    /* среда десятой недели: рекорд 22 октября (180 × 4) ровно четыре недели назад — ещё в окне; прежнее правило давало «Плато» трём упражнениям */
    assert.deepEqual(['mon', 'wed', 'fri'].flatMap(sl => tags(cfg, sl, '2025-11-19')), []);
    const p = Core.adapt(LW, cfg, 'wed', '2025-11-26').props.find(x => x.ex === 'leg_press')!;
    assert.deepEqual([p.tag, p.sets.map(x => x.w), p.notes[0]], ['Плато', [157.5, 157.5, 157.5, 157.5], '4 недели без прибавки ни в одном подходе (лучший — 180 × 4, 22 октября): все подходы −10%, повторы набираются заново до верха диапазона']);
  });
  /* с таблицей дней эталона — как у эталона: три тренировки без рекорда; жим ногами там идёт волной */
  const cfg0 = Core.mergeCfg(later.config);
  assert.deepEqual(['mon', 'wed', 'fri'].flatMap(sl => tags(cfg0, sl, '2025-11-19')), ['lat_raise_machine:Плато', 'leg_curl_lying:Плато']);
  assert.match(Core.adapt(LW, cfg0, 'mon', '2025-11-19').props.find(x => x.tag === 'Плато')!.notes[0], /^3 тренировки без рекорда \(лучший — 22\.5 × 11, 27 октября\)/);
});
