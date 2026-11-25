/* План следующей тренировки по правилам атлета.
   Перенесено из reference/src/core.js: тела функций без изменений, кроме методики под цель с днями «День N» (rules.ts, решение владельца 24 ноября 2026). */
import { SLOT, SLOTS } from './catalog.ts';
import { DAYS, dayStale } from './days.ts';
import { addDays, dow } from './dates.ts';
import { isCycle, isLight } from './config.ts';
import { e1, work } from './sets.ts';
import { appRange, appRules, BASE_SETS, byPct, fromMax, HEAVY, heavyOf, heavyStep, lightShift, logMax, rirOf, withBody } from './rules.ts';
import { AUTO, goalOf, goalRange, GOALS, lightOf, progPending, waveOf } from './goals.ts';
import { sessions } from './stats.ts';
import type { Cfg, ExDef, Item, ProgEntry, Range, SessRef, SetRec, Workout } from './types.ts';

/* ---------- planning by the athlete's own rules ---------- */
export function lastSessionItem(workouts: Workout[], exId: string, slot?: string | null, before?: string | null) {
  let same: SessRef | null = null, any: SessRef | null = null;
  for (const w of workouts) {
    if (before && !(w.date < before)) continue;
    if (w.open) continue;
    for (const it of w.items) if (it.ex === exId && it.sets.length) { any = { w, it }; if (w.slot === slot) same = { w, it }; }
  }
  return same || any;
}
export function inferStep(workouts: Workout[], exId: string) {
  const ws: number[] = [];
  for (let i = workouts.length - 1; i >= 0 && ws.length < 24; i--)
    for (const it of workouts[i].items) if (it.ex === exId) for (const s of it.sets) if (!ws.includes(s.w!)) ws.push(s.w!);
  ws.sort((a, b) => a - b);
  let step = 0;
  for (let i = 1; i < ws.length; i++) { const d = +(ws[i] - ws[i - 1]).toFixed(3); if (d > 0 && (!step || d < step)) step = d; }
  return step || 2.5;
}
export const stepOf = (workouts: Workout[], cfg: Cfg, exId: string) => (cfg.ex[exId] && +cfg.ex[exId].step!) || (appRules() && cfg.ex[exId] && +cfg.ex[exId].round!) || inferStep(workouts, exId);   // (в эталоне нет) базовое на двойной прогрессии: шаг его снаряда
/* his formula: reps lost on a weight jump = step% / 2.5, lower bound 8, never narrower than 4 */
export const formulaRange = (w: number, step: number, lo = 8) => w > 0 ? [lo, lo + Math.max(4, Math.round((step / w * 100) / 2.5))] : [lo, lo + 4];
export function suggestSet(prev: SetRec | null | undefined, range: Range, step: number) {
  const [lo, hi] = range;
  if (!prev) return { w: null, rule: 'new', target: [lo, hi] };
  if (prev.r == null) return { w: prev.w, rule: 'repeat', target: [lo, hi] };
  if (prev.r >= hi) return { w: +(prev.w! + step).toFixed(3), rule: 'up', target: [lo, hi] };
  if (prev.r < lo) return { w: Math.max(0, +(prev.w! - step).toFixed(3)), rule: 'down', target: [lo, hi] };
  return { w: prev.w, rule: 'hold', target: [Math.min(hi, prev.r + 1), hi] };
}
export const roundTo = (v: number, q: number) => Math.round(v / q) * q;
export function planCycle(workouts: Workout[], cfg: Cfg, exId: string, before?: string | null) {
  const wv = waveOf(cfg, exId), order = wv.order, first = order[0], ex = cfg.ex[exId] || {} as ExDef, q = +ex.round! || 2.5;
  const all = sessions(workouts.filter(w => !w.open && (!before || w.date < before)), cfg, exId), ss = all.filter(s => s.item.cyc);
  /* (в эталоне нет) с днями «День N» последняя запись упражнения — по двойной прогрессии: расчётный максимум из её подходов (Эпли с поправкой на запас) */
  const fromLog = appRules() && all.length && !all[all.length - 1].item.cyc ? logMax(all[all.length - 1].item, rirOf(cfg, exId)) : null;
  if (!ss.length || fromLog) {                                      // no sessions yet: from the maximum the athlete named, if any
    const tm = fromLog || knownMax(cfg, exId), p0 = wv.pct[first];
    return { reps: first, pct: p0, sets: wv.sets(first), w: tm ? +roundTo(tm * p0 / 100, q).toFixed(3) : null, tm, prev: null, repeat: false, strong: wv.strong, hold: wv.hold, keep: wv.keep, known: !!tm, auto: wv.auto, verdict: wv.auto ? 'start' : undefined };
  }
  const last = ss[ss.length - 1], lr = last.item.cyc!.reps;
  const planned = last.item.sets.filter(s => !s.warm);
  const done = planned.length > 0 && planned.every(s => s.r != null && s.r >= lr) && !last.item.skip;
  const hard = last.sets.some(s => s.q === 0);
  const repeat = !done;
  const A = appRules() ? heavyOf(cfg, exId) : AUTO;               // (в эталоне нет) с днями «День N» — тяжёлый день 3 × 4, у изоляции 3 × 6 (rules.ts, heavyOf)
  const inWave = wv.pct[lr] === last.item.cyc!.pct || (appRules() && wv.auto && last.item.cyc!.pct === A.pct && lr > A.reps && lr <= A.reps + HEAVY.reps);   // the last session was planned by this wave; (в эталоне нет) тяжёлый день с прибавкой повторами
  if (wv.auto && inWave) {
    /* one weight, four by four: the last set says what the next week is */
    const lw = last.top.w, end = planned[planned.length - 1], rz = end && end.q != null ? end.q : null;
    const verdict = !done || hard ? 'down' : rz === 1 ? 'hold' : 'up';
    if (appRules()) { const H = heavyStep(lw!, q, lr, A.reps, verdict, rz); return { reps: H.reps, pct: A.pct, sets: A.sets, w: H.w, tm: H.w / (A.pct / 100), prev: last, repeat: false, hard: false, strong: false, hold: false, keep: true, auto: true, verdict: H.verdict, rz, closed: done, steps: H.steps }; }   // (в эталоне нет) выводы аудита 6 (rules.ts, heavyStep)
    const w = +(verdict === 'up' ? lw! + q : verdict === 'hold' ? lw! : Math.min(lw! - q, roundTo(lw! * (1 - AUTO.down / 100), q))).toFixed(3);
    return { reps: A.reps, pct: A.pct, sets: A.sets, w, tm: w / (A.pct / 100), prev: last, repeat: false, hard: false, strong: false, hold: false, keep: true, auto: true, verdict, rz, closed: done };
  }
  let reps: number, tm: number | null;
  if (!inWave) { reps = first; tm = last.tm; }                     // the wave was switched: start it from the top on the same maximum
  else if (repeat) { reps = lr; tm = last.tm; }
  else {
    const i = order.indexOf(lr);
    reps = order[(i + 1) % order.length];
    const grows = wv.perCycle ? i === order.length - 1 : true;     // the heavy wave adds once per cycle, the usual one every week
    tm = last.tm! * (grows && !hard ? 1 + wv.inc / 100 : 1);
  }
  const p = wv.pct[reps];
  return { reps, pct: p, sets: wv.sets(reps), w: repeat && inWave ? last.top.w : +roundTo(tm! * p / 100, q).toFixed(3), tm, prev: last, repeat: repeat && inWave, hard, strong: wv.strong, hold: wv.hold, keep: wv.keep, switched: !inWave, auto: wv.auto, verdict: wv.auto ? 'start' : undefined };
}
export function planLight(workouts: Workout[], cfg: Cfg, exId: string, before?: string | null) {
  const ex = cfg.ex[exId] || {} as ExDef, par = ex.of, q = +ex.round! || +((cfg.ex[par!] || {} as ExDef).round)! || 2.5, LIGHT = lightOf(cfg, exId);
  const c = par ? planCycle(workouts, cfg, par, before) : null, tm = c && c.prev ? c.prev.tm : c && c.known ? c.tm : null;
  let min: number | null = null;
  if (!appRules() || withBody(cfg, par!)) {                          // never below the lightest weight ever logged in the lift (body weight in pull-ups); (в эталоне нет) с днями «День N» — только там, где в вес входит тело
    for (const x of workouts) for (const it of x.items) if (it.ex === par) for (const k of work(it)) if (k.w! > 0 && (min == null || k.w! < min)) min = k.w;
  }
  const share = (t: number, pct: number) => { const v = +roundTo(t * pct / 100, q).toFixed(3); return min != null && v < min ? min : v; };
  let w = tm ? share(tm, LIGHT.pct) : null, steps = 0, move = 0;
  if (w != null && appRules()) {                                     // (в эталоне нет) лёгкий и средний день слушают запас (вывод 7 аудита, rules.ts, lightShift)
    const hist = sessions(workouts.filter(x => !x.open && (!before || x.date < before)), cfg, exId).filter(s => s.item.cyc).map(s => {
      const planned = s.item.sets.filter(x => !x.warm), end = planned[planned.length - 1];
      return { off: s.item.tm ? Math.round((s.top.w! - share(s.item.tm, s.item.cyc!.pct)) / q) : 0, rz: end && end.q != null ? end.q : null,
        closed: planned.length > 0 && planned.every(x => x.r != null && x.r >= s.item.cyc!.reps) && !s.item.skip };
    });
    const S = lightShift(hist), cap = c && c.w ? +(c.w - q).toFixed(3) : null;
    const k0 = S.steps - S.move; steps = S.steps;
    while (steps > 0 && cap != null && w + steps * q > cap + 1e-9) steps--;   // легче тяжёлого дня
    move = S.move > 0 ? Math.max(0, steps - k0) : S.move;              // что решил запас; уступка тяжёлому дню — не решение запаса
    w = Math.max(q, +(w + steps * q).toFixed(3));
  }
  return { pct: LIGHT.pct, reps: LIGHT.reps, sets: LIGHT.sets, w, tm, of: par, steps, move };
}
/* ---------- weights the athlete names before there is a journal: a one-rep maximum or a working weight ---------- */
/* the maximum an exercise without sessions is planned from: the named one, else the working weight raised by Epley over its reps plus the method's reserve */
export function knownMax(cfg: Cfg, exId: string) {
  const e = cfg.ex[exId] || {} as ExDef;
  if (+e.max! > 0) return +e.max!;
  if (!(+e.work! > 0)) return null;
  const r = +e.workR! > 0 ? +e.workR! : byPct(cfg, exId) ? waveOf(cfg, exId).order[0] : Math.round(((+e.lo! || 8) + (+e.hi! || 12)) / 2);
  return e1(+e.work!, r + rirOf(cfg, exId));                       // (в эталоне нет) с днями «День N» запас по упражнению (вывод 10 аудита)
}
/* the weight a double-progression exercise starts with: the working weight as it is when its reps fit the range,
   else the weight for the middle of the range with the method's reserve, rounded down to the step */
export function startWeight(workouts: Workout[], cfg: Cfg, exId: string, range: Range) {
  const e = cfg.ex[exId] || {} as ExDef, lo = range[0], hi = range[1];
  if (+e.work! > 0 && !(+e.workR! > 0 && (+e.workR! < lo || +e.workR! > hi))) return +e.work!;
  const mx = knownMax(cfg, exId);
  if (!mx) return null;
  const step = stepOf(workouts, cfg, exId), v = Math.floor(mx / (1 + (Math.round((lo + hi) / 2) + rirOf(cfg, exId)) / 30) / step + 1e-6) * step;
  return v > 0 ? +v.toFixed(3) : null;
}
/* what the first plan of an exercise without sessions starts from: { w, tm, pct, reps, src } or null (there is a journal, or nothing is named) */
export function startOf(workouts: Workout[], cfg: Cfg, exId: string) {
  const done = workouts.filter(w => !w.open), e = cfg.ex[exId] || {} as ExDef, own = isLight(cfg, exId) ? cfg.ex[e.of!] || {} as ExDef : e;
  if (lastSessionItem(done, isLight(cfg, exId) ? e.of! : exId, null, null) || !(+own.max! > 0 || +own.work! > 0)) return null;
  const src = +own.max! > 0 ? 'max' : 'work';
  if (isLight(cfg, exId)) { const c = planLight(done, cfg, exId, null); return c.w ? { w: c.w, tm: c.tm, pct: c.pct, reps: c.reps, src } : null; }
  if (byPct(cfg, exId)) { const c = planCycle(done, cfg, exId, null); return c.w ? { w: c.w, tm: c.tm, pct: c.pct, reps: c.reps, src } : null; }
  const w = startWeight(done, cfg, exId, rangeOf(done, cfg, exId));
  return w ? { w, src: +e.work! > 0 && w === +e.work! ? 'work' : src } : null;
}
/* hints for one exercise in a workout being planned or edited */
export function hints(workouts: Workout[], cfg: Cfg, exId: string, slot?: string | null, before?: string | null) {
  const ex = cfg.ex[exId] || {} as ExDef;
  const p = lastSessionItem(workouts, exId, slot, before);
  const step = stepOf(workouts, cfg, exId);
  const g = goalOf(cfg, exId);
  const range = appRules() ? appRange(ex, p && p.it.range, p ? p.it.sets.reduce((m, x) => Math.max(m, x.w || 0), 0) : 0, step) : (p && p.it.range) || (g && GOALS[g].lo ? goalRange(g, 0, step) : [ex.lo || 8, ex.hi || 12]);
  const prevSets = p ? p.it.sets.filter(s => !s.warm) : [];
  /* (в эталоне нет) прошлый раз упражнение шло по проценту, а теперь — по двойной прогрессии: каждый подход начинается с веса от расчётного максимума прошлого раза */
  const tm = appRules() && p && p.it.cyc && !byPct(cfg, exId) ? logMax(p.it, rirOf(cfg, exId)) : null, w0 = tm ? fromMax(tm, range, rirOf(cfg, exId), step) : null;
  return { step, range, prevDate: p ? p.w.date : null, prevSlot: p ? p.w.slot : null, prevSkipped: p ? p.it.skip : false, prevSets, sets: prevSets.map(s => tm ? { w: w0, rule: 'new', target: range.slice() } : suggestSet(s, range, step)), start: p ? null : startWeight(workouts, cfg, exId, range) };
}
export function nextSlot(workouts: Workout[], today?: string | null) {
  const done = workouts.filter(w => !w.open && w.slot);
  if (!done.length) { if (!DAYS.week) return SLOTS[0].id; const d = today ? dow(today) : 1; return SLOTS.slice().sort((a, b) => ((a.dow - d + 7) % 7) - ((b.dow - d + 7) % 7))[0].id; }   // дни без привязки к дням недели: дневник начинается с дня 1
  const i = SLOTS.findIndex(s => s.id === done[done.length - 1].slot);
  return SLOTS[(i + 1) % SLOTS.length].id;
}
export function nextDate(slot: string, today: string, workouts: Workout[]) {
  const want = SLOT[slot].dow, taken = workouts.some(w => w.date === today && !w.open);
  if (!DAYS.week) return taken ? addDays(today, 1) : today;           // дни без привязки к дням недели: тренировка — сегодня, а если сегодняшняя уже записана — завтра
  for (let k = taken ? 1 : 0; k < 8; k++) { const d = addDays(today, k); if (dow(d) === want) return d; }
  return today;
}
/* one exercise of a plan: by its wave, as a light day, or by double progression; `n` fixes the number of sets */
export function makeItem(workouts: Workout[], cfg: Cfg, exId: string, slot: string, date: string, n?: number): Item {
  if (isLight(cfg, exId)) {
    const c = planLight(workouts, cfg, exId, date);
    return { ex: exId, cyc: { pct: c.pct, reps: c.reps }, range: null, sets: Array.from({ length: c.sets }, () => ({ w: c.w, r: null })), note: '', skip: false, rir: null, tm: c.tm ? +c.tm.toFixed(2) : null };
  }
  if (byPct(cfg, exId)) {
    const c = planCycle(workouts, cfg, exId, date);
    return { ex: exId, cyc: { pct: c.pct, reps: c.reps }, range: null, sets: Array.from({ length: c.sets }, () => ({ w: c.w, r: null })), note: '', skip: false, rir: null, tm: c.keep && c.tm ? +c.tm.toFixed(2) : null };
  }
  const h = hints(workouts, cfg, exId, slot, date);
  let sets = h.sets.map(x => ({ w: x.w, r: null }));
  if (!(n! > 0) && appRules() && (isCycle(cfg, exId) || (cfg.ex[exId] || {} as ExDef).stored === 'cycle')) n = BASE_SETS;  // (в эталоне нет) базовое на двойной прогрессии — четыре подхода; и базовое справочника, которое под «Силой» идёт обычным упражнением (rules.ts)
  if (n! > 0) { if (sets.length > n!) sets = sets.slice(0, n); while (sets.length < n!) sets.push({ w: sets.length ? sets[sets.length - 1].w : h.start, r: null }); }
  return { ex: exId, cyc: null, range: h.range.slice(), sets, note: '', skip: false, rir: null };
}
export function plan(workouts: Workout[], cfg: Cfg, slot: string, date: string) {
  let tpl: Workout | null = null;
  for (const w of workouts) if (!w.open && w.slot === slot && w.date < date && !dayStale(cfg, slot, w)) tpl = w;   // дни «День N»: см. dayStale
  const prog = progPending(cfg, slot, tpl);
  const src: ProgEntry[] = prog ? cfg.program!.slots[slot].filter(e => cfg.ex[e.ex]) : tpl ? tpl.items.map(it => ({ ex: it.ex })) : [];
  const items = src.map(e => makeItem(workouts, cfg, e.ex, slot, date, prog ? e.n : 0));
  return { slot, date, template: prog ? null : tpl ? tpl.id : null, prog, items };
}
/* ---------- a new programme: the current one rebuilt around one priority ---------- */
/* the range the next plan of a double-progression exercise ends up with (its goal may move it) */
export function rangeOf(workouts: Workout[], cfg: Cfg, exId: string) {
  const p = lastSessionItem(workouts.filter(w => !w.open), exId, null, null), ex = cfg.ex[exId] || {} as ExDef, g = goalOf(cfg, exId);
  if (appRules()) return appRange(ex, p && p.it.range, p ? p.it.sets.reduce((m, x) => Math.max(m, x.w || 0), 0) : 0, stepOf(workouts, cfg, exId));   // (в эталоне нет) по типу упражнения
  const cur = (p && p.it.range) || [ex.lo || 8, ex.hi || 12];
  if (g && GOALS[g].lo) {
    const top = p ? p.it.sets.reduce((m, x) => Math.max(m, x.w || 0), 0) : 0, R = goalRange(g, top, stepOf(workouts, cfg, exId));
    if (R[0] !== cur[0]) return R;
  }
  return cur;
}
