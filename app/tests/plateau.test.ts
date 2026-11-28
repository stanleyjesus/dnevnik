/* Плато в двойной прогрессии с днями «День N» (решение владельца, 26 ноября 2026): остановка каскада после сброса и тренд по четырём неделям
   (rules.ts, plateauOf; adapt.ts). Разбор и источники — docs/03, раздел 21. Атлет выдуман: его «настоящий» максимум растёт на заданный процент
   в неделю, повторы считаются по Эпли с запасом 1 — так же, как в разборе «Сила, масса и плато». С таблицей дней эталона — прежнее правило. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plain, readJson } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { useDays } from '../src/core/days.ts';
import { cutAsk, PLATEAU, plateauOf, RIR_CHECK, statusOf } from '../src/core/rules.ts';
import type { Cfg, Item, Session, SetRec, Workout } from '../src/core/types.ts';

function withDays<T>(n: number | null, fn: () => T): T { useDays(n, false); try { return fn(); } finally { useDays(null, true); } }
const EX = 'lat_pulldown', HI = 10, E0 = 100 * (1 + 11 / 30);
const iso = (d0: string, add: number) => { const d = new Date(d0 + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + add); return d.toISOString().slice(0, 10); };

/** Атлет на тяге верхнего блока: перед каждой тренировкой берёт план с поправками дневника, делает повторы по своему максимуму.
    log — отмечает запас, когда повторов больше верха диапазона; иначе останавливается на верхе диапазона и запас не пишет.
    С заметкой «Проверка запаса» последний подход — до отказа, запас 0. swap — соглашается на замену упражнения; extra — поля настройки поверх примерной */
function athlete(perWeek: number, growWeek: number, n: number, log: boolean, swap = false, extra?: Record<string, unknown>) {
  const raw = Object.assign(readJson('data/config.json'), extra || {});
  if (swap) raw.ex.x_pulldown_narrow = { n: 'Тяга верхнего блока узким хватом', gear: raw.ex[EX].gear, pat: raw.ex[EX].pat, m: { lats: 1, upper_back: 0.5, biceps: 0.5 } };   // замена на те же мышцы
  const cfg = Core.mergeCfg(raw), W: Workout[] = [], tags: string[] = [], slots = perWeek === 1 ? ['mon'] : ['mon', 'fri'], off: Record<string, number> = { mon: 0, fri: 4 };
  for (let wk = 0, k = 0; k < n; wk++) for (const sl of slots) {
    if (k >= n) break;
    const date = iso('2025-09-01', wk * 7 + off[sl]), E = E0 * Math.pow(1 + growWeek / perWeek, k);
    let it: Item, tag = '';
    if (!W.length) it = { ex: EX, range: [6, 10], cyc: null, note: '', skip: false, rir: null, sets: [100, 100, 100, 100].map(w => ({ w, r: null })) } as unknown as Item;
    else {
      const a = Core.adapt(W, cfg, sl, date), off = Object.assign({}, a.off0);
      if (swap) for (const p of a.props) if (p.swap) delete off[p.key];
      const got = Core.applyAdapt(a, off).items[0];
      it = got ? plain(got) : plain(W[W.length - 1].items[0]);
      tag = a.props.filter(p => /Плато|Откат/.test(p.tag)).map(p => p.tag.split(' · ')[0] + (p.swap ? ' ' + p.swap : p.note ? ' (проверка)' : p.sets.length > a.base.items[p.idx].sets.length ? ' +1' : '')).join('');
    }
    if (it.ex !== W.at(-1)?.items[0].ex && W.length) it.sets.forEach(s => { if (s.w == null) s.w = 60; });   // новое упражнение: вес подобран сам
    const ck = it.note === RIR_CHECK.note;
    it.sets = it.sets.map((s, i) => { const w = s.w!, f = Math.floor(30 * (E / w - 1)), r = f - 1; return ck && i === it.sets.length - 1 ? { w, r: f, q: 0 } : r > HI ? (log ? { w, r: HI, q: f - HI } : { w, r: HI }) : { w, r: Math.max(0, r) }; }) as SetRec[];
    W.push({ id: date, date, slot: sl, note: '', open: false, items: [it] } as unknown as Workout);
    tags.push(tag);
    k++;
  }
  const at = tags.map((t, i) => t ? (i + 1) + ':' + t : '').filter(Boolean), last = W[W.length - 1].items[0].sets;
  return { at, minW: Math.min(...W.filter(w => w.items[0].ex === EX).map(w => w.items[0].sets[0].w!)), last: Math.max(...last.map(s => s.w!)), sets: W.map(w => w.items[0].sets.length).join(''), ex: W[W.length - 1].items[0].ex };
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

test('настоящее плато: вес не снижается — сначала проверка запаса, через восемь недель с проверенным запасом — замена; без каскада', () => withDays(3, () => {
  /* до пунктов 3–5: «Плато» −10% на 7-й, 15-й и 23-й тренировке, вес падал до 90 кг. Теперь вес стоит на 100 кг: «Плато» просит последний подход до отказа,
     подход прибавлен «Мало объёма» на пятой тренировке (у стоящего упражнения тоже, пункт 4), пятого подхода дальше не бывает, а замены в справочнике нет —
     проверка повторяется раз в восемь недель */
  assert.deepEqual(athlete(1, 0, 30, false), { at: ['7:Плато (проверка)', '16:Плато (проверка)', '25:Плато (проверка)'], minW: 100, last: 100, sets: '4444' + '5'.repeat(26), ex: EX });
  assert.deepEqual(athlete(1, 0, 30, true).at, ['7:Плато (проверка)', '16:Плато (проверка)', '25:Плато (проверка)']);
  /* два раза в неделю — окна те же четыре недели */
  assert.deepEqual(athlete(2, 0, 30, false).at, ['11:Плато (проверка)', '28:Плато (проверка)']);
  /* в справочнике есть упражнение на те же мышцы: восемь недель без прибавки, запас проверен — замена, и атлет идёт дальше на ней */
  const sw = athlete(1, 0, 30, false, true);
  assert.deepEqual([sw.at, sw.ex], [['7:Плато (проверка)', '11:Плато: замена x_pulldown_narrow'], 'x_pulldown_narrow']);
  /* рост 0.25% в неделю — ниже порога 0.5%: только проверки запаса, вес всё равно растёт */
  const slow = athlete(1, 0.0025, 30, false);
  assert.deepEqual([slow.at, slow.minW, slow.last], [['8:Плато (проверка)', '17:Плато (проверка)', '27:Плато (проверка)'], 100, 107.5]);
}));

test('настоящий спад — «Откат»: −10%, как раньше; плато между откатами — проверка запаса', () => withDays(3, () => {
  /* сила падает на 1% в неделю: откат через шесть недель после проверки, вес снижается шагами, а не каскадом каждую неделю */
  assert.deepEqual(athlete(1, -0.01, 30, false).at, ['7:Плато (проверка)', '13:Откат', '19:Плато (проверка)', '24:Откат', '30:Плато (проверка)']);
  assert.equal(athlete(1, -0.01, 30, false).minW, 77.5);
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

test('«Неделей позже»: жим ногами — «Плато» через четыре недели после рекорда, +1 подход квадрицепсу; средние дельты и бицепс бедра лёжа больше не «Плато»', () => {
  const later = readJson('data/later.json').profiles[0], LW: Workout[] = Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  const tags = (cfg: Cfg, sl: string, date: string) => Core.adapt(LW, cfg, sl, date).props.filter(p => /Плато|Откат/.test(p.tag)).map(p => p.ex + ':' + p.tag);
  withDays(3, () => {
    const cfg = Core.mergeCfg(later.config);
    /* среда десятой недели: рекорд 22 октября (180 × 4) ровно четыре недели назад — ещё в окне; прежнее правило давало «Плато» трём упражнениям */
    assert.deepEqual(['mon', 'wed', 'fri'].flatMap(sl => tags(cfg, sl, '2025-11-19')), []);
    /* последний подход 175 × 5 был до отказа — запас проверен; квадрицепсу по программе 10 подходов в неделю — пятый подход, вес не снижается,
       а подходы, где запас мал, — на шаг ниже, как без плато */
    const p = Core.adapt(LW, cfg, 'wed', '2025-11-26').props.find(x => x.ex === 'leg_press')!;
    assert.deepEqual([p.tag, p.sets.map(x => x.w), p.notes[0]], ['Плато · Недогруз · Перегруз · Отказ', [175, 175, 172.5, 172.5, 172.5],
      '4 недели без прибавки ни в одном подходе (лучший — 180 × 4, 22 октября), а запас проверен: +1 подход — квадрицепс по программе 10 подходов в неделю, меньше 12']);
  });
  /* с таблицей дней эталона — как у эталона: три тренировки без рекорда; жим ногами там идёт волной */
  const cfg0 = Core.mergeCfg(later.config);
  assert.deepEqual(['mon', 'wed', 'fri'].flatMap(sl => tags(cfg0, sl, '2025-11-19')), ['lat_raise_machine:Плато', 'leg_curl_lying:Плато']);
  assert.match(Core.adapt(LW, cfg0, 'mon', '2025-11-19').props.find(x => x.tag === 'Плато')!.notes[0], /^3 тренировки без рекорда \(лучший — 22\.5 × 11, 27 октября\)/);
});

test('«Мало объёма» и у стоящего упражнения: подход прибавляется, а не только растущему (пункт 4)', () => {
  const later = readJson('data/later.json').profiles[0], LW: Workout[] = Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  withDays(3, () => {
    const cfg = Core.mergeCfg(later.config), past = LW.filter(w => w.date < '2025-11-19');
    /* махи в тренажёре три тренировки без рекорда («застой»), но плато по тренду нет; средним дельтам мало подходов — пятый подход */
    assert.equal(Core.exStats(past, cfg, 'lat_raise_machine', Core.program(past, cfg))!.status, 'flat');
    const a = Core.adapt(LW, cfg, 'mon', '2025-11-19'), p = a.props.find(x => x.ex === 'lat_raise_machine')!;
    assert.deepEqual([p.tag, p.sets.length, a.base.items[p.idx].sets.length, !!a.off0[p.key]], ['Мало объёма', 5, 4, false]);
  });
});

test('замена при долгом плато: дневник предлагает, галочка меняет упражнение; запас после снижения веса (пункт 5)', () => withDays(3, () => {
  /* до замены — восемь недель без прибавки, запас проверен; в плане замена выключена, с галочкой — новое упражнение с тем же числом подходов */
  const raw = readJson('data/config.json');
  raw.ex.x_pulldown_narrow = { n: 'Тяга верхнего блока узким хватом', gear: raw.ex[EX].gear, pat: raw.ex[EX].pat, m: { lats: 1, upper_back: 0.5, biceps: 0.5 } };
  const cfg = Core.mergeCfg(raw), W = Array.from({ length: 10 }, (_, k) => { const date = iso('2025-09-01', 7 * k);
    return { id: date, date, slot: 'mon', note: '', open: false, items: [{ ex: EX, range: [6, 10], cyc: null, note: k === 8 ? RIR_CHECK.note : '', skip: false, rir: null,
      sets: [{ w: 100, r: 9 }, { w: 100, r: 9 }, { w: 100, r: 8 }, k === 8 ? { w: 100, r: 9, q: 0 } : { w: 100, r: 8 }] }] } as unknown as Workout; });
  const a = Core.adapt(W, cfg, 'mon', '2025-11-10'), p = a.props.find(x => x.ex === EX)!;
  assert.deepEqual([p.tag, p.swap, !!a.off0[p.key]], ['Плато: замена', 'x_pulldown_narrow', true]);
  assert.match(p.notes[0], /^8 недель без прибавки, хотя запас проверен: замена на «Тяга верхнего блока узким хватом» — те же мышцы, другой стимул; вес подбери сам$/);
  assert.equal(Core.applyAdapt(a, a.off0).items[0].ex, EX);
  const on = Core.applyAdapt(a, {}).items[0];
  assert.deepEqual([on.ex, on.sets.length], ['x_pulldown_narrow', 4]);
  /* пункт 5: вес в подходе ниже прошлого и запас не отмечен — карточка просит его отметить; отмечен, тот же вес или пропущен — нет */
  const prev = [{ w: 30, r: 9 }, { w: 30, r: 8 }] as SetRec[];
  assert.equal(cutAsk([{ w: 27.5, r: null }, { w: 30, r: null }] as SetRec[], prev), true);
  assert.equal(cutAsk([{ w: 27.5, r: 10, q: 4 }, { w: 30, r: null }] as SetRec[], prev), false);
  assert.equal(cutAsk([{ w: 30, r: null }, { w: 32.5, r: null }, { w: 20, r: null }] as SetRec[], prev), false);
  assert.equal(cutAsk([{ w: 27.5, r: null, skip: true }] as SetRec[], prev), false);
}));

test('статус на «Прогрессе» — по тому же тренду: «застой» только при плато, где тренда не видно — как раньше', () => {
  const later = readJson('data/later.json').profiles[0], LW: Workout[] = Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  const raw = readJson('data/config.json'), W: Workout[] = Core.sortW(readJson('data/workouts.json').map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  const look = (ws: Workout[], cfg: Cfg) => Object.fromEntries(Core.allStats(ws, cfg).filter(s => s.active && s.status !== statusOf(cfg, s)).map(s => [s.id, s.status + ' → ' + statusOf(cfg, s)]));
  withDays(3, () => {
    /* «неделей позже»: три упражнения без рекорда три тренировки, но по тренду четырёх недель растут — как в плане, где у них нет «Плато» */
    assert.deepEqual(look(LW, Core.mergeCfg(later.config)), { lat_raise_machine: 'flat → up', leg_press: 'flat → up', leg_curl_lying: 'flat → up' });
    /* основные данные: трицепс на блоке стоит и по тренду — «застой» остаётся; бицепс сидя после разового тяжёлого подхода — тренда не видно, статус прежний */
    const cfg = Core.mergeCfg(raw), st = Object.fromEntries(Core.allStats(W, cfg).map(s => [s.id, [s.status, statusOf(cfg, s)]]));
    assert.deepEqual([st.tri_pushdown, st.bayesian_curl, look(W, cfg)], [['flat', 'flat'], ['up', 'up'], {}]);
  });
  /* с таблицей дней эталона — три тренировки без рекорда, как у эталона */
  assert.deepEqual(look(LW, Core.mergeCfg(later.config)), {});
});

test('мышца на поддержании: «Мало объёма» — только ниже четырёх в неделю, подхода при плато нет (пункт 11 вопросов владельца, 28 ноября 2026)', () => withDays(3, () => {
  /* тот же атлет на плато, спина на поддержании: пятого подхода «Мало объёма» нет — у широчайших 4 по программе, это не меньше четырёх; при плато подход не прибавляется
     (без поддержания, но с четырьмя подходами было бы «8:Плато +1») */
  const r = athlete(1, 0, 30, false, false, { maint: ['back'] });
  assert.deepEqual([r.at, r.sets], [['7:Плато (проверка)', '16:Плато (проверка)', '25:Плато (проверка)'], '4'.repeat(30)]);
  /* «неделей позже»: средним дельтам мало подходов — пятый подход у махов; с плечами на поддержании — нет */
  const later = readJson('data/later.json').profiles[0], LW: Workout[] = Core.sortW(later.workouts.map((d: Record<string, unknown>) => Core.fromDoc(String(d.id), d)));
  const find = (extra: Record<string, unknown>) => { const a = Core.adapt(LW, Core.mergeCfg(Object.assign({}, later.config, extra)), 'mon', '2025-11-19'); return (a.props.find(x => x.ex === 'lat_raise_machine') || { tag: '' }).tag; };
  assert.equal(find({}), 'Мало объёма');
  assert.equal(find({ maint: ['delts'] }), '');
}));
