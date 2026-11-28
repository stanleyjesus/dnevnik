/* (в эталоне нет) Замена не меняет баланс мышц (пункт 1 вопросов владельца, 28 ноября 2026; docs/03, раздел 22).
   В программе, которую собрал дневник, атлет меняет упражнение на другое: подходы переходят к новому, а мышцы считаются уже по его карте.
   Приседания → ягодичный мост отнимают у квадрицепса все подходы приседаний, горизонтальная тяга → шраги — половину у широчайших,
   задних дельт и бицепса. Поэтому:
   - shiftOf — что замена сделает с недельным объёмом мышц, пока дневник ничего не вернул: подпись у вариантов в списке замен;
   - rebalance — после замены дневник возвращает каждой мышце тот объём, что был до неё: сначала снимает лишнее у мышц, которые получили
     подход и больше, потом прибавляет тем, что потеряли, — тем же ходом, что кнопки «−» и «+» у мышцы (nudgeMuscle). Шаг принимается, только
     если сумма квадратов отклонений от прежнего объёма уменьшилась: так новое упражнение в два подхода не встаёт ради одного недостающего.
     Выбранное атлетом упражнение «−» не трогает. Лимиты — как у кнопок (11 подходов на мышцу за тренировку, лимит недели, верх рабочей зоны
     соседей), и ещё два: с выбранным временем день не становится длиннее этого времени (или того, что было сразу после замены, если больше),
     с днями подряд мышца не становится основной в двух соседних днях. Чего вернуть нельзя, дневник называет.
   Мышцы вне расчёта не выравниваются: сборка им подходов не выделяет.
   [И] Рост мышцы идёт от числа подходов на неё за неделю, косвенный подход — за половину (Schoenfeld и соавт., 2017; Pelland и соавт., 2024);
   замена действительно переносит нагрузку: присед и ягодичный мост растили ягодицы одинаково, а квадрицепс заметно больше рос от приседа
   (Plotkin и соавт., 2023); менять упражнения можно и полезно, если подходов на мышцу столько же (Fonseca и соавт., 2014; Kassiano и соавт., 2022).
   [Т] Порог в один подход и сами доли 1 и 0.5. Только с днями «День N» и только у программы, которую собрал дневник: в «Вручную» решает атлет */
import { MUSCLE, MUSCLES, SLOTS } from './catalog.ts';
import { signed } from './format.ts';
import { clone } from './records.ts';
import { placed } from './gear.ts';
import { LIB, nudgeMuscle, progTally } from './program.ts';
import { estMinutes, fmtDur } from './time.ts';
import { pairClash, pairsOf } from './rules.ts';
import type { Cfg, ExDef, OptOpts, ProgEntry, ProgSlots, Slot } from './types.ts';

/** Сдвиг меньше одного подхода в неделю дневник не показывает и не выравнивает [Т] */
export const SHIFT_MIN = 1;
/** Сколько шагов кнопками мышц делает выравнивание, не больше */
const STEPS = 40;

/** Недельный объём мышц, которые дневник считает (без мышц вне расчёта) */
const volOf = (cfg: Cfg, slots: ProgSlots) => { const pv = progTally(cfg, slots).pv; return Object.fromEntries(MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => [m.id, pv[m.id] || 0])); };

/** Что сделает с недельным объёмом мышц замена упражнения i дня slot на id (def — упражнение встроенного списка, которого нет в справочнике):
    мышцы со сдвигом от одного подхода, сначала потери. Мышцы вне расчёта не в счёт */
export function shiftOf(cfg: Cfg, slots: ProgSlots, slot: string, i: number, id: string, def?: ExDef | null): [string, number][] {
  const e = slots[slot] && slots[slot][i];
  if (!e || !e.n || e.ex === id) return [];
  const c2 = cfg.ex[id] || !def ? cfg : Object.assign({}, cfg, { ex: Object.assign({}, cfg.ex, { [id]: placed(cfg, Object.assign({ n: id }, def)) }) });
  if (!c2.ex[id]) return [];
  const s2 = Object.assign({}, slots, { [slot]: slots[slot].map((x, j) => j === i ? Object.assign({}, x, { ex: id }) : x) });
  const a = volOf(cfg, slots), b = volOf(c2, s2);
  return Object.keys(a).map(m => [m, +(b[m] - a[m]).toFixed(1)] as [string, number]).filter(x => Math.abs(x[1]) >= SHIFT_MIN - 0.01).sort((x, y) => x[1] - y[1] || MUSCLE[x[0]].n.localeCompare(MUSCLE[y[0]].n, 'ru'));
}
/** Сдвиг словами: «квадрицепс −4, бицепс бедра +2 в неделю» */
export const shiftText = (sh: [string, number][]) => sh.length ? sh.map(([m, d]) => MUSCLE[m].n.toLowerCase() + ' ' + signed(d, 1)).join(', ') + ' в неделю' : '';

/** Что сделало выравнивание: moves — шаги кнопок мышц (мышца и текст, как у кнопок), back — сколько вернул мышцам и снял у них (по мышцам),
    lack — чего вернуть не удалось и почему */
export interface Balance { moves: { m: string; t: string }[]; back: [string, number][]; lack: { m: string; d: number; why: string }[] }

/** После замены: вернуть мышцам объём до замены (before — недельный объём по мышцам до неё). keep — день и упражнение, которое выбрал атлет;
    o — лимиты, как у кнопок мышц, time — минут на тренировку (0 — не выбрано), rest — отдых для оценки времени; define — новое упражнение
    из встроенного списка, когда кнопка «+» его ставит (как у кнопок мышц). Меняет slots на месте */
export function rebalance(c2: Cfg, slots: ProgSlots, before: Record<string, number>, keep: { slot: string; ex: string },
  o: OptOpts & { time?: number; rest?: number | null }, define: (id: string, def: ExDef) => void): Balance {
  const ign = c2.ignore || {}, mOf = (id: string) => (c2.ex[id] && c2.ex[id].m) || {};
  const gaps = () => { const v = volOf(c2, slots); return Object.keys(v).filter(m => before[m] != null || v[m] > 0).map(m => [m, +(v[m] - (before[m] || 0)).toFixed(2)] as [string, number]); };
  const cost = () => gaps().reduce((a, x) => a + x[1] * x[1], 0);
  const start = Object.fromEntries(gaps());
  /* время: день не длиннее выбранного, а если он уже длиннее сразу после замены — не длиннее, чем есть */
  const mins = (list: ProgEntry[], c: Cfg = c2) => estMinutes(c, list, o.rest);
  /* упражнение встроенного списка, которого ещё нет в справочнике: для оценки времени и дней подряд — как его поставит кнопка «+» */
  const withLib = (id: string) => { if (c2.ex[id]) return c2; const L = LIB.find(x => x.id === id); return L ? Object.assign({}, c2, { ex: Object.assign({}, c2.ex, { [id]: placed(c2, Object.assign({ n: id }, L.def)) }) }) : c2; };
  const allow: Record<string, number> = {};
  if (o.time) for (const sl of SLOTS) allow[sl.id] = Math.max(o.time, slots[sl.id].length ? mins(slots[sl.id]) : 0);
  /* дни подряд: мышца не становится основной в двух соседних днях чаще, чем сразу после замены */
  const links = pairsOf(c2, SLOTS), clash = (S: ProgSlots, c: Cfg = c2) => links.length ? pairClash(links, d => (S[d] || []).map(e => e.ex), id => (c.ex[id] && c.ex[id].m) || {}, ign).length : 0, clash0 = clash(slots);
  const opts: OptOpts = Object.assign({}, o, {
    keep: (sl: Slot, e: ProgEntry) => (sl.id === keep.slot && e.ex === keep.ex) || ban.has(sl.id + ':' + e.ex + ':-'),
    fits: (sl: Slot, id: string, sets: number, isAdd: boolean) => {
      if (ban.has(sl.id + ':' + id + ':' + (isAdd ? 'a' : '+'))) return false;
      const L = slots[sl.id].map(e => e.ex === id && !isAdd ? Object.assign({}, e, { n: (e.n || 0) + sets }) : e).concat(isAdd ? [{ ex: id, n: sets }] : []), c = withLib(id);
      if (o.time && mins(L, c) > allow[sl.id] + 0.01) { opts.fitsWhy = 'тренировка не уложится в ' + fmtDur(o.time); return false; }
      if (links.length && isAdd && clash(Object.assign({}, slots, { [sl.id]: L }), c) > clash0) { opts.fitsWhy = 'в днях подряд мышца стала бы основной в обоих днях'; return false; }
      return true;
    }
  });
  const moves: Balance['moves'] = [], why: Record<string, string> = {}, stuck = new Set<string>(), ban = new Set<string>();
  /* что поменял шаг кнопки: день, упражнение и как (a — новое, + / − — подход) — чтобы не предлагать этот ход снова */
  const touched = (snap: ProgSlots, dir: number) => SLOTS.flatMap(sl => {
    const A = snap[sl.id] || [], B = slots[sl.id] || [], n = (L: ProgEntry[], id: string) => { const e = L.find(x => x.ex === id); return e ? e.n || 0 : -1; };
    return [...new Set(A.concat(B).map(e => e.ex))].filter(id => n(A, id) !== n(B, id)).map(id => sl.id + ':' + id + ':' + (dir < 0 ? '-' : n(A, id) < 0 ? 'a' : '+'));
  });
  /* один шаг кнопки мышцы: принимается, если отклонения от прежнего объёма уменьшились; иначе всё как было, этот ход запрещён и кнопка ищет другой */
  const step = (m: string, dir: number) => {
    for (let k = 0; k < 8; k++) {
      const snap = clone(slots), had = new Set(Object.keys(c2.ex)), defs: [string, ExDef][] = [], was = cost();
      opts.fitsWhy = '';
      const r = nudgeMuscle(c2, slots, m, dir, opts, (id, def) => { defs.push([id, def]); c2.ex[id] = placed(c2, Object.assign({ n: id }, def)); });
      const undo = () => { for (const k of Object.keys(slots)) slots[k] = snap[k]; for (const id of Object.keys(c2.ex)) if (!had.has(id)) delete c2.ex[id]; };
      if (!r.ok) { undo(); why[m] = why[m] || r.text; return false; }
      if (cost() > was - 0.01) { const t = touched(snap, dir); undo(); if (!t.length) return false; t.forEach(x => ban.add(x)); why[m] = why[m] || 'другие упражнения сдвинули бы соседние мышцы'; continue; }
      for (const [id, def] of defs) define(id, def);
      moves.push({ m: MUSCLE[m].n, t: r.text });
      return true;
    }
    return false;
  };
  for (let k = 0; k < STEPS; k++) {
    const g = gaps();
    const over = g.filter(([m, d]) => d >= SHIFT_MIN - 0.01 && !stuck.has('-' + m)).sort((a, b) => b[1] - a[1])[0];
    if (over) { if (!step(over[0], -1)) stuck.add('-' + over[0]); continue; }
    const under = g.filter(([m, d]) => d <= -(SHIFT_MIN - 0.01) && !stuck.has('+' + m)).sort((a, b) => a[1] - b[1])[0];
    if (under) { if (!step(under[0], 1)) stuck.add('+' + under[0]); continue; }
    break;
  }
  const end = Object.fromEntries(gaps());
  const back = Object.keys(start).map(m => [m, +((end[m] || 0) - start[m]).toFixed(1)] as [string, number]).filter(x => Math.abs(x[1]) >= 0.5 - 0.01 && Math.abs(start[x[0]]) >= SHIFT_MIN - 0.01);
  const lack = Object.keys(end).filter(m => end[m] <= -(SHIFT_MIN - 0.01)).map(m => ({ m, d: end[m], why: lackWhy(why[m]) }));
  return { moves, back, lack };
}
/* причина, почему не вернуть: текст кнопки «+» без начала «Добавить некуда:» и с маленькой буквы */
const lackWhy = (t?: string) => !t ? 'в днях нет места' : t.replace(/^Добавить некуда:\s*/, '').replace(/^./, c => c.toLowerCase());
/** Выравнивание словами для сообщения о замене: «. Объём мышц выровнен: квадрицепс +4, бицепс бедра −2. Не хватает: …» */
export function balanceText(b: Balance) {
  const list = (L: [string, number][]) => L.map(([m, d]) => MUSCLE[m].n.toLowerCase() + ' ' + signed(d, 1)).join(', ');
  return (b.back.length ? '. Объём мышц выровнен: ' + list(b.back) : '') + (b.lack.length ? '. Не хватает: ' + list(b.lack.map(l => [l.m, l.d] as [string, number])) + ' — ' + b.lack[0].why : '');
}
