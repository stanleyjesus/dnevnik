/* Сборка программы: равномерно, приоритет, пауэрбилдинг.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { MUSCLE, MUSCLES, SLOT, SLOTS } from './catalog.ts';
import { fmt, list, nSets, plural, signed } from './format.ts';
import { clone } from './records.ts';
import { placed } from './gear.ts';
import { exName, isCycle, isLight, kindOf } from './config.ts';
import { estRir } from './sets.ts';
import { AUTO, goalOf, LIGHT_A } from './goals.ts';
import { lastSessionItem, rangeOf, startOf } from './plan.ts';
import { planned, tally } from './tally.ts';
import { ADDS } from './adapt.ts';
import { DAY_H, DAY_L, DAY_M, DL_LIGHT, SOLO, STRONG } from './strength.ts';
import { STARTER, STARTER_GEAR } from './starter.ts';
import { DAYS, awayDays, dayNo } from './days.ts';
import { BASE_SETS, EVEN, HEAVY, HOLD, MAX_EX, ORDER, TIME_EX, TYPE, appEx, appRules, applyRoles, asStored, canTarget, dayOrder, fillTop, heavyOf, inTime, MANY_EX, MAX_SETS, OFF_APP, isDeadlift, isoLift, lightFor, LONG_K, moreTime, programRoles, restOf, REST, rirText, roomFor, sameMuscles, stretchOf, triadIds } from './rules.ts';
import { estMinutes, fmtDur } from './time.ts';
import type { Tally } from './tally.ts';
import type { Roles } from './rules.ts';
import type { Add, BuildOpts, Cfg, Cut, DayOf, ExDef, Fold, LibEntry, Move, MuscleMap, OptOpts, ProgEntry, ProgNote, ProgSlots, Slot, Swap, Workout } from './types.ts';

export function currentSlots(workouts: Workout[], cfg: Cfg) {
  const pl = planned(workouts.filter(w => !w.open), cfg), out: ProgSlots = {};
  for (const sl of SLOTS) {
    const w = pl.t[sl.id];
    out[sl.id] = !w ? [] : w.items.filter(it => cfg.ex[it.ex]).map(it => {
      const e: ProgEntry = { ex: it.ex };
      if (!isCycle(cfg, it.ex) && !isLight(cfg, it.ex)) e.n = it.sets ? it.sets.filter(x => !x.warm).length : (+it.n! || 3);
      return e;
    });
  }
  return out;
}
export const wrapSlots = (slots: ProgSlots) => Object.fromEntries(SLOTS.map(sl => [sl.id, { items: slots[sl.id] || [] }]));
export const progTally = (cfg: Cfg, slots: ProgSlots) => tally(cfg, wrapSlots(slots));
export const ON_DAY: Record<string, string> = { mon: 'в понедельник', wed: 'в среду', fri: 'в пятницу' };
/* muscle priorities a programme can be built around */
export const PRIOS = [
  { id: 'legs', n: 'Ноги и ягодицы', m: ['quads', 'hams', 'glutes'] },
  { id: 'glutes', n: 'Ягодицы', m: ['glutes'] },
  { id: 'upper', n: 'Верх тела', m: ['chest', 'lats', 'upper_back', 'delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps'] },
  { id: 'back', n: 'Спина', m: ['lats', 'upper_back', 'delt_rear'] },
  { id: 'chest', n: 'Грудь и плечи', m: ['chest', 'delt_front', 'delt_mid'] },
  { id: 'delts', n: 'Плечи', m: ['delt_front', 'delt_mid', 'delt_rear'] },   // (в эталоне нет) три пучка дельт без груди: решение владельца, 23 ноября 2026
  { id: 'arms', n: 'Руки', m: ['biceps', 'triceps'] }
];
/* a stock exercise for every muscle, used when the athlete's own list has nothing for it */
export const addDef = (k: string) => ADDS.find(a => a.key === k)!.def;
export const LIB: LibEntry[] = [
  { id: 'x_press', def: { n: 'Жим в тренажере на грудь', pat: 'h_push', m: { chest: 1, delt_front: 0.5, triceps: 0.5 } } },
  { id: 'x_pulldown', get def() { return appEx({ n: 'Вертикальная тяга в тренажере', pat: 'v_pull', m: { lats: 1, upper_back: 0.5, biceps: 0.5 } }); } },   // (в эталоне — постоянная карта) в приложении хват — половина подхода: rules.ts, appMap
  { id: 'x_pullover', def: { n: 'Пуловер на верхнем блоке', pat: 'iso', m: { lats: 1 }, lo: 10, hi: 15 } },
  { id: 'x_row', get def() { return appEx({ n: 'Горизонтальная тяга в тренажере', pat: 'h_pull', m: { upper_back: 1, lats: 0.5, delt_rear: 0.5, biceps: 0.5 } }); } },
  { id: 'x_ohp', def: addDef('ohp') },
  { id: 'x_raise', def: { n: 'Махи в стороны', pat: 'iso', m: { delt_mid: 1 }, lo: 10, hi: 20 } },
  { id: 'x_rear', def: addDef('rear') },
  { id: 'x_curl', get def() { return appEx({ n: 'Сгибания на бицепс', pat: 'iso', m: { biceps: 1 } }); } },
  { id: 'x_pushdown', def: { n: 'Разгибания на трицепс на блоке', pat: 'iso', m: { triceps: 1 } } },
  { id: 'x_wrist', def: { n: 'Сгибания кисти', pat: 'iso', m: { forearms: 1 } } },
  { id: 'x_abs', def: addDef('abs') },
  { id: 'x_rdl', get def() { return addDef('rdl'); } },          // (в эталоне — постоянная карта) в приложении разгибатели в ней помогают: rules.ts
  { id: 'x_backext', def: { n: 'Гиперэкстензия', pat: 'hinge', m: { erectors: 1, glutes: 0.5, hams: 0.5 }, lo: 10, hi: 15 } },
  { id: 'x_legext', def: { n: 'Разгибания ног', pat: 'iso', m: { quads: 1 }, lo: 10, hi: 15 } },
  { id: 'x_legcurl', def: { n: 'Сгибания ног', pat: 'iso', m: { hams: 1 }, lo: 10, hi: 15 } },
  { id: 'x_thrust', def: { n: 'Ягодичный мост', pat: 'hinge', m: { glutes: 1, hams: 0.5 } } },
  { id: 'x_calf', def: addDef('calf') }
];
/* Other exercises for the same place in a day. `same` — the main muscles are the same (an exact match of the whole muscle map first);
   `near` — at least one main muscle is shared. Percentage lifts and light days are not offered, a one-sided exercise changes
   for a one-sided one only, and a stock exercise is offered when the athlete's list has nothing with its muscles. */
export function swapsFor(cfg: Cfg, id: string, skip?: string[] | null) {
  const out: { same: Swap[]; near: Swap[] } = { same: [], near: [] }, e = cfg.ex[id];
  if (!e) return out;
  const mainOf = (m: MuscleMap | undefined) => Object.keys(m || {}).filter(k => m![k] >= 1).sort(), key = (m: MuscleMap | undefined) => JSON.stringify(Object.entries(m || {}).filter(x => x[1] > 0).sort());
  const dp = (x: string) => { const k = kindOf(cfg, x); return k === 'compound' || k === 'iso'; };
  const mine = mainOf(e.m), own = Object.keys(cfg.ex).filter(dp);
  const side = (n: string) => /(^|\s)лев/i.test(n) ? 'l' : /(^|\s)прав/i.test(n) ? 'r' : '';                 // the left wrist is not changed for the right one
  if (!mine.length || !dp(id)) return out;
  const pool: Swap[] = own.map(x => ({ id: x, n: cfg.ex[x].n, m: cfg.ex[x].m || {}, uni: !!cfg.ex[x].uni }))
    .concat(LIB.filter(L => !cfg.ex[L.id] && !own.some(x => key(cfg.ex[x].m) === key(L.def.m))).map(L => ({ id: L.id, n: L.def.n, m: L.def.m, uni: !!L.def.uni, def: L.def })));
  for (const c of pool) {
    if (c.id === id || (skip || []).includes(c.id) || c.uni !== !!e.uni || (side(c.n) && side(e.n) && side(c.n) !== side(e.n))) continue;
    const cm = mainOf(c.m), shared = cm.filter(x => mine.includes(x)).length;
    if (!shared) continue;
    /* how alike two muscle maps are: what they share over what they cover together */
    const ks = [...new Set(Object.keys(c.m).concat(Object.keys(e.m || {})))], like = ks.reduce((a, k) => a + Math.min(c.m[k] || 0, e.m[k] || 0), 0) / (ks.reduce((a, k) => a + Math.max(c.m[k] || 0, e.m[k] || 0), 0) || 1);
    if (shared === mine.length && cm.length === mine.length) out.same.push(Object.assign(c, { exact: key(c.m) === key(e.m), like }));
    else out.near.push(Object.assign(c, { shared, main: cm, like }));
  }
  const byName = (a: Swap, b: Swap) => a.n.localeCompare(b.n, 'ru');
  const long = (x: Swap) => stretchOf(cfg.ex[x.id] || x.def);       // (в эталоне нет) с днями «День N» растянутый вариант выше (вывод 3 аудита)
  out.same.sort((a, b) => (b.exact - a.exact) || (b.like! - a.like!) || (long(b) - long(a)) || byName(a, b));
  out.near.sort((a, b) => (b.like! - a.like!) || (long(b) - long(a)) || byName(a, b));
  return out;
}
/* Fit a week to the limits and to one common level.
   Every muscle in the goal aims at `o.level` sets a week, a priority muscle at PRIO_K times that; nobody rises more than two sets above its aim.
   First the limits (a day, the week), then a local search: a shortfall costs more than an excess, so the muscles that got much more than the rest lose sets
   and the ones that lag get them. `noFill` stops after the limits. Percentage lifts are never touched. */
export const PRIO_K = 1.5;
export function optimise(c2: Cfg, slots: ProgSlots, o: OptOpts, define: (id: string, def: ExDef) => void) {
  const z = o.z, ign: Record<string, number> = o.ignore || {}, prio: Record<string, number> = o.prio || {}, lvl = o.level != null ? o.level : z.opt;
  const tgt = (m: string) => ign[m] ? 0 : prio[m] ? Math.min(z.high - 2, Math.round(lvl * PRIO_K)) : lvl, top = (m: string) => tgt(m) + 2;
  const used = SLOTS.filter(sl => slots[sl.id].length), days = o.allDays || !used.length ? SLOTS.slice() : used;   // allDays: в расчёте все выбранные дни, а не только занятые — при сборке с нуля и всегда с днями «День N»; иначе только те, что заняли базовые
  const dayMax = Math.ceil(o.budget / days.length) + 2, cut: Cut[] = [], fold: Fold[] = [];
  const info = (id: string) => c2.ex[id] || (LIB.find(L => L.id === id) || {} as LibEntry).def || { m: {} } as ExDef;
  const mOf = (id: string) => info(id).m || {};
  const uniF = (id: string) => info(id).uni ? 0.5 : 1;
  const isDp = (id: string) => { const k = kindOf(c2, id); return k === 'compound' || k === 'iso'; };
  const now = () => progTally(c2, slots);
  const total = (T: Tally) => SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0);
  const sibling = (L: ProgEntry[], e: ProgEntry) => info(e.ex).uni ? L.find(x => x !== e && info(x.ex).uni && x.n === e.n && JSON.stringify(mOf(x.ex)) === JSON.stringify(mOf(e.ex))) || null : null;
  const step = (L: ProgEntry[], e: ProgEntry, k: number) => { const sb = sibling(L, e); e.n! += k; e.chg = (e.chg || 0) + k; if (sb) { sb.n! += k; sb.chg = (sb.chg || 0) + k; } };
  const weight = (L: ProgEntry[]) => L.reduce((a, e) => a + (info(e.ex).uni ? 0.5 : 1), 0);
  /* an exercise only for muscles left out of the count is the athlete's own business: its sets are in the week, but the search leaves it alone */
  const byHand = (id: string) => { const ms = Object.entries(mOf(id)).filter(x => x[1] > 0); return ms.length > 0 && ms.every(x => ign[x[0]]); };
  /* how much of an exercise goes to muscles left out of the count: the search prefers a cleaner choice,
     and never brings in a new exercise where such a muscle is a main mover — that would be giving it sets after all */
  /* (в эталоне нет) хват — половина подхода предплечьям во всех тягах и сгибаниях (вывод 2 аудита): чистоте выбора он не мешает, иначе тяги проигрывали бы всему остальному */
  const aside = (id: string) => Object.entries(mOf(id)).reduce((a, x) => a + (ign[x[0]] && !(appRules() && OFF_APP[x[0]] && x[1] < 1) ? x[1] : 0), 0);
  const mainOff = (id: string) => Object.entries(mOf(id)).some(x => x[1] >= 1 && ign[x[0]]);

  /* frequency: a day trains a muscle when it gives it two sets or more (indirect work counts in halves, as everywhere);
     with two or more training days a muscle whose weekly aim allows it should have two such days, not one big one */
  /* (в эталоне нет) с выбранным временем на тренировку второй день весит больше: время заполняется подходами раньше, чем второй день достаётся всем мышцам,
     а он — требование владельца (решение 23 ноября 2026). Штраф за недостающий день 10 вместо 4, и ради второго дня баланс объёма может уступить 3 вместо 0.5 за шаг */
  const FQ = { sets: 2, days: 2, pen: o.time ? 10 : 4, slack: o.time ? 3 : 0.5 };
  const twice = (m: string) => !ign[m] && days.length >= FQ.days && tgt(m) >= FQ.sets * FQ.days;
  const trainedDays = (m: string, dOf: DayOf) => SLOTS.filter(sl => dOf(sl.id, m) >= FQ.sets - 0.01).length;
  const thinOf = (dOf: DayOf) => MUSCLES.filter(m => twice(m.id) && trainedDays(m.id, dOf) < FQ.days).map(m => m.id);
  const miss = (dOf: DayOf) => MUSCLES.reduce((a, m) => a + (twice(m.id) ? Math.max(0, FQ.days - trainedDays(m.id, dOf)) : 0), 0);

  /* 0a. no muscle above the daily limit */
  for (let g = 0; g < 200; g++) {
    const T = now();
    let hit: { sl: Slot; m: string } | null = null;
    for (const sl of SLOTS) { for (const m of MUSCLES) if ((T.day[sl.id][m.id] || 0) > o.dayCap + 0.01) { hit = { sl, m: m.id }; break; } if (hit) break; }
    if (!hit) break;
    const e = slots[hit.sl.id].filter(x => x.n! > 1 && mOf(x.ex)[hit.m] > 0).sort((a, b) => (mOf(b.ex)[hit.m] - mOf(a.ex)[hit.m]) || (b.n! - a.n!))[0];
    if (!e) break;
    step(slots[hit.sl.id], e, -1);
  }
  /* 0b. the week within the budget: sets go first from where a muscle is furthest above its target, priority muscles last */
  for (let g = 0; g < 400 && total(now()) > o.budget + 0.01; g++) {
    const T = now();
    let best: { sc: number; sl: Slot; e: ProgEntry } | null = null;
    const spare = (e: ProgEntry) => Math.min(...Object.entries(mOf(e.ex)).filter(x => x[1] > 0).map(([m, c]) => ign[m] ? 99 : (T.pv[m] || 0) - c * uniF(e.ex) - tgt(m) - (prio[m] ? 3 : 0)));
    for (const sl of SLOTS) for (const e of slots[sl.id]) { if (!e.n || e.n <= 2 || byHand(e.ex)) continue; const sc = spare(e) + 0.05 * T.load[sl.id]; if (!best || sc > best.sc) best = { sc, sl, e }; }
    if (best) { step(slots[best.sl.id], best.e, -1); continue; }
    for (const sl of SLOTS) for (const e of slots[sl.id]) { if (!e.n || byHand(e.ex) || e.pin) continue; const sc = spare(e) + 0.05 * T.load[sl.id]; if (!best || sc > best.sc) best = { sc, sl, e }; }
    if (!best) break;
    const L = slots[best.sl.id], sb = sibling(L, best.e);
    for (const x of [best.e, sb]) if (x) { L.splice(L.indexOf(x), 1); cut.push({ ex: x.ex, sl: best.sl }); }
  }
  /* 0c. (в эталоне нет) с выбранным временем на тренировку ни один день не длиннее него: подходы уходят из дня, который не укладывается, — оттуда,
         где мышца дальше всего выше своей цели; упражнение уходит целиком, когда у всех в этом дне по два подхода. Базовые и лёгкие дни не трогаются.
         (в эталоне нет) В дне сверх десяти упражнений (rules.ts, TIME_EX.day; решение владельца, 25 ноября 2026) уходит упражнение целиком */
  const many = (L: ProgEntry[]) => weight(L) > TIME_EX.day + 0.6;
  for (let g = 0; o.time && g < 400; g++) {
    const sl = SLOTS.find(x => slots[x.id].length && (!inTime(estMinutes(c2, slots[x.id]), o.time!) || many(slots[x.id])));
    if (!sl) break;
    const T = now(), L = slots[sl.id];
    const spare = (e: ProgEntry) => Math.min(...Object.entries(mOf(e.ex)).filter(x => x[1] > 0).map(([m, c]) => ign[m] ? 99 : (T.pv[m] || 0) - c * uniF(e.ex) - tgt(m) - (prio[m] ? 3 : 0)));
    let best: ProgEntry | null = null, bs = 0;
    if (!many(L)) for (const e of L) { if (!e.n || e.n <= 2 || !isDp(e.ex) || byHand(e.ex)) continue; const sc = spare(e); if (!best || sc > bs) { best = e; bs = sc; } }
    if (best) { step(L, best, -1); continue; }
    for (const e of L) { if (!e.n || !isDp(e.ex) || byHand(e.ex) || e.pin) continue; const sc = spare(e); if (!best || sc > bs) { best = e; bs = sc; } }
    if (!best) break;
    const sb = sibling(L, best);
    for (const x of [best, sb]) if (x) { L.splice(L.indexOf(x), 1); cut.push({ ex: x.ex, sl }); }
  }
  if (o.noFill) return { left: [], cut, fold, once: [], hit: null };
  /* a local search. A shortfall below the aim costs six times more than an excess above aim + 2.
     One step changes one exercise; when a day or the week is full, two at once: a set or an exercise goes and another comes. */
  {
    const same = appRules(), sameM = (a: MuscleMap, b: MuscleMap) => JSON.stringify(Object.entries(a).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b).filter(x => x[1] > 0).sort());
    const lim = (id: string) => info(id).pat === 'iso' ? 3 : 2;
    const cost = (pv: Record<string, number>) => MUSCLES.reduce((a, m) => { if (ign[m.id]) return a; const v = pv[m.id] || 0, d = tgt(m.id) - v, u = v - top(m.id); return a + (d > 0.25 ? 3 * d * d : 0) + (u > 0.01 ? 0.5 * u * u : 0); }, 0);
    /* two passes: first the volumes alone, to their balance; then the second training day for the muscles that have one,
       with steps that leave that balance as it is */
    /* (в эталоне нет) с днями «День N» и выбранным временем на тренировку потолка в девять упражнений нет: день берёт упражнения и подходы,
       пока укладывается в это время по оценке дневника (estMinutes) — подход с отдыхом, у пары сторон по подходу на каждую, минута на упражнение (rules.ts).
       Второй день мышцы тогда ищется с первого шага: время делят подходы и второй день, и второй день — требование (каждая мышца больше одного раза в неделю) */
    let fq = !!o.time;
    const rest = c2.rest || 120, setSec = (id: string) => { const r = same ? restOf(c2, id, info(id)) : rest; return info(id).uni ? 80 + r : 40 + r; };   // (в эталоне нет) с днями «День N» — отдых упражнения (rules.ts, restOf)
    /* (в эталоне нет) вывод 8 аудита, без выбранного времени (решение владельца, 25 ноября 2026; rules.ts, MANY_EX): когда поиск больше ничего не находит,
       в дне от шести упражнений упражнение в два подхода отдаёт их другому упражнению на ту же основную мышцу — если баланс недели от этого не хуже,
       второй день ни у кого не пропадает и лимиты дня соблюдены. Слитое в этот день поиск обратно не ставит, и поиск идёт дальше */
    const folding = same && !o.time;
    const foldOnce = () => {
      if (!folding) return false;
      const T = now(), vol0 = cost(T.pv), miss0 = miss((d, m) => T.day[d][m] || 0);
      let best: { sc: number; sl: Slot; a: ProgEntry; b: ProgEntry } | null = null;
      for (const sl of days) {
        const L = slots[sl.id];
        if (weight(L) < MANY_EX - 0.01) continue;
        const ok = (e: ProgEntry) => !!e.n && isDp(e.ex) && !byHand(e.ex) && !info(e.ex).uni;
        for (const b of L) {
          if (!ok(b) || b.n! > 2 || b.pin) continue;
          for (const a of L) {
            if (a === b || !ok(a) || a.n! + b.n! > MAX_SETS || !Object.entries(mOf(b.ex)).some(([m, c]) => c >= 1 && !ign[m] && (mOf(a.ex)[m] || 0) >= 1)) continue;
            const i = L.indexOf(b), nb = b.n!;
            a.n! += nb; L.splice(i, 1);
            const T2 = now(), vol = cost(T2.pv), fine = vol <= vol0 + 0.01 && miss((d, m) => T2.day[d][m] || 0) <= miss0
              && !MUSCLES.some(m => (T2.day[sl.id][m.id] || 0) > Math.max(o.dayCap, T.day[sl.id][m.id] || 0) + 0.01 || (!ign[m.id] && (T2.pv[m.id] || 0) > (T.pv[m.id] || 0) + 0.01 && (T2.pv[m.id] || 0) > z.high + 0.01));
            a.n! -= nb; L.splice(i, 0, b);
            const sc = vol0 - vol + 0.01 * (stretchOf(info(a.ex)) - stretchOf(info(b.ex))) + 0.001 * (a.n! - nb);   // при равном балансе остаётся растянутый вариант (вывод 3), потом то, где подходов больше
            if (fine && (!best || sc > best.sc + 1e-9)) best = { sc, sl, a, b };
          }
        }
      }
      if (!best) return false;
      const L = slots[best.sl.id];
      step(L, best.a, best.b.n!); L.splice(L.indexOf(best.b), 1);
      fold.push({ ex: best.b.ex, sl: best.sl, into: best.a.ex, n: best.b.n!, was: !best.b.isNew || !!best.b.from });
      return true;
    };
    for (let g = 0; g < 360; g++) {
      const T = now(), tot = total(T), dNow = (d: string, m: string) => T.day[d][m] || 0, vol0 = cost(T.pv), base = vol0 + (fq ? FQ.pen * miss(dNow) : 0);
      const sec = o.time ? Object.fromEntries(SLOTS.map(sl => [sl.id, estMinutes(c2, slots[sl.id]) * 60])) : null;
      if (base < 0.01) { if (fq) { if (foldOnce()) continue; break; } fq = true; continue; }
      const pool = Object.keys(c2.ex).filter(id => isDp(id) && !c2.ex[id].uni).concat(LIB.filter(L => !c2.ex[L.id] && !L.def.uni && !Object.keys(c2.ex).some(id => isDp(id) && sameM(mOf(id), L.def.m))).map(L => L.id));
      const nDays = (id: string) => SLOTS.filter(x => slots[x.id].some(e => e.ex === id)).length;
      /* a step up is worth trying only for a muscle that is short, a step down alone only for one that is above the top */
      const short: Record<string, number> = {}, above: Record<string, number> = {};
      for (const m of MUSCLES) { if (ign[m.id]) continue; const v = T.pv[m.id] || 0; if (tgt(m.id) - v > 0.25) short[m.id] = 1; if (v - top(m.id) > 0.01) above[m.id] = 1; }
      const hits = (id: string, set: Record<string, number>) => Object.entries(mOf(id)).some(([m, c]) => c > 0 && set[m]);
      /* a muscle with one training day: work for it is worth trying on a day that does not train it yet */
      const thin: Record<string, number> = {}; if (fq) for (const m of thinOf(dNow)) thin[m] = 1;
      const fills = (id: string, sl: Slot) => Object.entries(mOf(id)).some(([m, c]) => c > 0 && thin[m] && dNow(sl.id, m) < FQ.sets - 0.01);
      const less: Move[] = [], more: Move[] = [];
      for (const sl of days) {
        const L = slots[sl.id], seen: ProgEntry[] = [];
        for (const e of L) {
          if (!e.n || !isDp(e.ex) || seen.includes(e) || byHand(e.ex)) continue;
          const sb = sibling(L, e);
          if (info(e.ex).uni && !sb) continue;
          if (sb) seen.push(sb);
          const a = { sl, e, id: e.ex, f: uniF(e.ex) * (sb ? 2 : 1) };
          if (e.n < 5 && (hits(e.ex, short) || fills(e.ex, sl))) more.push(Object.assign({ dn: 1, dw: 0, pen: (e.n >= 4 ? 0.3 : 0) + 0.5 * aside(e.ex) }, a));
          if (e.n > 2) less.push(Object.assign({ dn: -1, dw: 0, pen: 0 }, a));
          if (e.n > 3) less.push(Object.assign({ dn: -2, dw: 0, pen: 0 }, a));       // two sets at once: they can move to another day as a new exercise
          if (!e.pin) less.push(Object.assign({ dn: -e.n, dw: -1, pen: e.isNew ? 0.1 : 0.8, drop: true }, a));     // an exercise the build put on its day for a reason stays there
        }
        /* (в эталоне нет) с днями «День N» в день не ставится второе упражнение с теми же мышцами: подходы прибавляются в том, что уже стоит.
           Иначе два варианта одного движения по два подхода занимают два места из девяти, и поиск застревает ниже достижимого уровня (rules.ts) */
        const twin = (id: string) => same && L.some(e => sameM(mOf(e.ex), mOf(id)));
        for (const id of pool) if ((hits(id, short) || fills(id, sl)) && !mainOff(id) && !L.some(e => e.ex === id) && !twin(id) && !cut.some(c => c.ex === id && c.sl === sl) && !fold.some(c => c.ex === id && c.sl === sl)) more.push({ sl, e: null, id, f: uniF(id), dn: 2, dw: 1, pen: (c2.ex[id] ? 0.4 : 0.5) + 0.3 * aside(id) - LONG_K * stretchOf(info(id)), add: true });   // (в эталоне нет) растянутый вариант раньше (вывод 3 аудита)
      }
      const rate = (list: Move[]) => {
        const dt = list.reduce((a, x) => a + x.dn * x.f, 0);
        if (dt > 0.01 && tot + dt > o.budget + 0.01) return null;
        const pv = Object.assign({}, T.pv), dayM: Record<string, Record<string, number>> = {}, load: Record<string, number> = {}, wt: Record<string, number> = {};
        for (const a of list) {
          const k = a.dn * a.f, d = a.sl.id;
          load[d] = (load[d] || 0) + k; wt[d] = (wt[d] || 0) + a.dw; dayM[d] = dayM[d] || {};
          for (const [m, c] of Object.entries(mOf(a.id))) if (c > 0) { pv[m] = (pv[m] || 0) + c * k; dayM[d][m] = (dayM[d][m] || 0) + c * k; }
        }
        for (const d of Object.keys(load)) {
          if (load[d] > 0.01 && T.load[d] + load[d] > dayMax + 0.01) return null;
          if (wt[d] > 0 && weight(slots[d]) + wt[d] > (sec ? TIME_EX.day : MAX_EX) + 0.6) return null;   // (в эталоне нет) с выбранным временем — не больше десяти (rules.ts)
          if (sec) { const s = list.reduce((a, x) => a + (x.sl.id === d ? x.dn * setSec(x.id) + x.dw * 60 : 0), 0); if (s > 0.01 && !inTime((sec[d] + s + (sec[d] ? 0 : 300)) / 60, o.time!)) return null; }
          for (const [m, v] of Object.entries(dayM[d])) if (v > 0.01 && (T.day[d][m] || 0) + v > o.dayCap + 0.01) return null;
        }
        for (const a of list) if (a.add && nDays(a.id) - list.filter(x => x.drop && x.id === a.id).length + 1 > lim(a.id)) return null;
        /* (в эталоне нет) с выбранным временем на мышцу — не больше двух упражнений (у приоритета трёх), второе — когда в первом уже три подхода (rules.ts, roomFor) */
        if (sec) for (const a of list) if (a.add) {
          const L = slots[a.sl.id].filter(e => !list.some(x => x.drop && x.e === e)), sets = (e: ProgEntry) => e.n! + list.reduce((t, x) => t + (x.e === e && !x.drop ? x.dn : 0), 0);
          if (!roomFor(L, a.id, mOf, prio, ign, sets)) return null;
        }
        for (const m of Object.keys(pv)) if (!ign[m] && pv[m] > (T.pv[m] || 0) + 0.01 && pv[m] > z.high + 0.01) return null;
        /* a second day is not bought with the balance of the week: a step that the volumes themselves do not pay for
           may not lift any muscle above its top, nor leave one short */
        const vol = cost(pv);
        if (vol > vol0 - 0.01) {
          if (vol > vol0 + FQ.slack) return null;
          for (const m of Object.keys(pv)) if (!ign[m] && pv[m] > (T.pv[m] || 0) + 0.01 && pv[m] > top(m) + 0.01) return null;
        }
        return base - vol - (fq ? FQ.pen * miss((d, m) => (T.day[d][m] || 0) + ((dayM[d] || {})[m] || 0)) : 0) - list.reduce((a, x) => a + x.pen, 0) - 0.002 * dt;
      };
      let best = null as { sc: number; list: Move[] } | null;
      const take = (list: Move[]) => { const sc = rate(list); if (sc != null && sc > 0.15 && (!best || sc > best.sc)) best = { sc, list }; };
      for (const a of more) take([a]);
      for (const a of less) if (hits(a.id, above)) take([a]);
      if (!best) for (const a of less) for (const b of more) if (a.e !== b.e) take([a, b]);
      /* the second pass may also carry an exercise over to another day as it is: the week's volumes stay, the days change */
      if (fq) for (const sl of days) for (const e of slots[sl.id]) {
        if (!e.n || !isDp(e.ex) || byHand(e.ex) || e.pin || info(e.ex).uni || !hits(e.ex, thin)) continue;
        for (const to of days) if (to !== sl && !slots[to.id].some(x => x.ex === e.ex || (same && sameM(mOf(x.ex), mOf(e.ex)))) && !cut.some(c => c.ex === e.ex && c.sl === to))   // (в эталоне нет) и не в день, где уже стоит упражнение с теми же мышцами
          take([{ sl, e, id: e.ex, f: 1, dn: -e.n, dw: -1, pen: 0.3, drop: true, to }, { sl: to, e: null, id: e.ex, f: 1, dn: e.n, dw: 1, pen: 0, add: true, n: e.n, from: sl }]);
      }
      if (!best) { if (fq) { if (foldOnce()) continue; break; } fq = true; continue; }
      for (const a of best.list) {
        const L = slots[a.sl.id];
        if (a.add) {
          if (!c2.ex[a.id]) define(a.id, clone((LIB.find(x => x.id === a.id) || {} as LibEntry).def));
          const e: ProgEntry = { ex: a.id, n: a.n || 2, isNew: true };
          if (a.from) e.from = a.from.id;                               // carried over from another day, not new to the programme
          if (kindOf(c2, a.id) === 'iso') L.push(e);
          else { let i = 0; L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light' || k === 'compound') i = j + 1; }); L.splice(i, 0, e); }
        } else if (a.drop) { for (const x of [a.e, sibling(L, a.e!)]) if (x) { L.splice(L.indexOf(x), 1); if (!x.isNew || x.from) cut.push({ ex: x.ex, sl: a.sl, to: a.to ? a.to.id : null }); } }
        else step(L, a.e!, a.dn);
      }
    }
    /* half a set short still counts as level: indirect work comes in halves */
    const T = now(), left = MUSCLES.filter(m => !ign[m.id] && (T.pv[m.id] || 0) < tgt(m.id) - 0.75).map(m => m.id);
    const over = MUSCLES.filter(m => !ign[m.id] && (T.pv[m.id] || 0) > top(m.id) + 1.25).map(m => m.id);
    return { left, over, cut, fold, once: thinOf((d, m) => T.day[d][m] || 0), hit: left.length ? (total(T) >= o.budget - 1.5 ? 'budget' : 'full') : null };
  }

}
/* One step for one muscle in a draft programme: dir +1 adds a set (or a two-set exercise when nothing fits), -1 takes one away.
   o: { z, ignore, budget, dayCap }. Returns { ok, text } and changes `slots` in place. */
export function nudgeMuscle(c2: Cfg, slots: ProgSlots, m: string, dir: number, o: OptOpts, define: (id: string, def: ExDef) => void) {
  const info = (id: string) => c2.ex[id] || (LIB.find(L => L.id === id) || {} as LibEntry).def || { m: {} } as ExDef, mOf = (id: string) => info(id).m || {}, uniF = (id: string) => info(id).uni ? 0.5 : 1;
  const T = progTally(c2, slots), tot = SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0), ign: Record<string, number> = o.ignore || {};
  const pair = (L: ProgEntry[], e: ProgEntry) => info(e.ex).uni ? L.find(x => x !== e && info(x.ex).uni && x.n === e.n && JSON.stringify(mOf(x.ex)) === JSON.stringify(mOf(e.ex))) || null : null;
  const label = (id: string, sl: Slot, sb?: ProgEntry | null) => exName(c2, id) + (sb ? ' и ' + exName(c2, sb.ex) : '') + ' (' + sl.s.toLowerCase() + ')';
  if (dir < 0) {
    let best: { sc: number; sl: Slot; e: ProgEntry } | null = null;
    for (const sl of SLOTS) for (const e of slots[sl.id]) {
      const c = mOf(e.ex)[m] || 0;
      if (!e.n || c <= 0) continue;
      /* the purest exercise for this muscle first: the neighbours should lose as little as possible, least of all those not yet in the working zone */
      const others = Object.entries(mOf(e.ex)).filter(([x, v]) => x !== m && v > 0 && !ign[x]);
      const side = others.reduce((a, x) => a + x[1], 0), harm = others.filter(([x, v]) => (T.pv[x] || 0) - v * uniF(e.ex) < o.z.opt).reduce((a, x) => a + x[1], 0);
      const sc = c * 3 - 0.5 * side - 0.5 * harm + 0.05 * e.n + 0.01 * T.load[sl.id];
      if (!best || sc > best.sc) best = { sc, sl, e };
    }
    if (!best) return { ok: false, text: SLOTS.some(sl => slots[sl.id].some(e => !e.n && (mOf(e.ex)[m] || 0) > 0)) ? (appRules() ? 'Эту мышцу нагружают только базовые и лёгкие дни: число подходов в них постоянное' : 'Эту мышцу нагружают только упражнения по процентам: число подходов в них задаёт волна') : 'В программе нет упражнений на эту мышцу' };
    const L = slots[best.sl.id], sb = pair(L, best.e);
    if (best.e.n! <= 1) { for (const x of [best.e, sb]) if (x) L.splice(L.indexOf(x), 1); return { ok: true, text: 'Убрано: ' + label(best.e.ex, best.sl, sb) }; }
    for (const x of [best.e, sb]) if (x) { x.n!--; x.chg = (x.chg || 0) - 1; }
    return { ok: true, text: '−1 подход: ' + label(best.e.ex, best.sl, sb) };
  }
  const sameM = (a: MuscleMap, b: MuscleMap) => JSON.stringify(Object.entries(a).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b).filter(x => x[1] > 0).sort());
  const isDp = (id: string) => { const k = kindOf(c2, id); return k === 'compound' || k === 'iso'; };
  const days = SLOTS.filter(sl => slots[sl.id].length).length ? SLOTS.filter(sl => slots[sl.id].length) : SLOTS.slice();
  const pool = Object.keys(c2.ex).filter(id => isDp(id) && !c2.ex[id].uni).concat(LIB.filter(L => !c2.ex[L.id] && !Object.keys(c2.ex).some(id => isDp(id) && sameM(mOf(id), L.def.m))).map(L => L.id));
  let best = null as { sc: number; sl: Slot; id: string; isAdd: boolean } | null, why = '', full = 0;                              // full: 1 — the week is full, 2 — one set is free but a new exercise takes two
  const rate = (sl: Slot, id: string, sets: number, isAdd: boolean) => {
    const c = mOf(id)[m] || 0, cost = sets * uniF(id), ms = Object.entries(mOf(id)).filter(x => x[1] > 0);
    if (c < (isAdd ? 1 : 0.5)) return;
    if (tot + cost > o.budget + 0.01) { full = Math.max(full, tot + 1 <= o.budget + 0.01 ? 2 : 1); return; }
    if (ms.some(([x, v]) => (T.day[sl.id][x] || 0) + v * cost > o.dayCap + 0.01)) { why = why || 'мешает лимит ' + o.dayCap + ' подходов на мышцу за тренировку'; return; }
    if (ms.some(([x, v]) => !ign[x] && x !== m && (T.pv[x] || 0) + v * cost > o.z.high + 0.01)) { why = why || 'соседние мышцы уже у верха рабочей зоны'; return; }
    /* the purest exercise first, so the neighbours gain as little as possible; a new exercise only when the ones in the programme do not fit */
    const others = ms.filter(([x]) => x !== m), side = others.reduce((a, x) => a + x[1], 0), over = others.filter(([x]) => !ign[x] && (T.pv[x] || 0) >= o.z.opt).reduce((a, x) => a + x[1], 0);
    const sc = c * 2 - 0.3 * side - 0.3 * over - 0.012 * T.load[sl.id] - (isAdd ? 0.8 + 0.04 * slots[sl.id].length - LONG_K * stretchOf(info(id)) : 0);   // (в эталоне нет) растянутый вариант раньше
    if (!best || sc > best.sc) best = { sc, sl, id, isAdd };
  };
  for (const sl of days) {
    const L = slots[sl.id];
    for (const e of L) { if (!e.n || e.n >= 5 || !isDp(e.ex)) continue; if (info(e.ex).uni && !pair(L, e)) continue; rate(sl, e.ex, info(e.ex).uni ? 2 : 1, false); }
    /* a new exercise goes where the day is shorter; the athlete asked for it, so a long day is no reason to refuse */
    for (const id of pool) { if (L.some(e => e.ex === id)) continue; rate(sl, id, 2, true); }
  }
  if (!best) return { ok: false, text: full === 2 ? 'Свободен один подход, а новому упражнению нужно два: убавь ещё подход у другой мышцы'
    : full ? 'Свободных подходов нет: все ' + o.budget + ' в неделю распределены. Сначала убавь другой мышце кнопкой «−»'
    : 'Добавить некуда: ' + (why || 'в днях нет места, а в подходящих упражнениях уже по пять подходов') };
  const L = slots[best.sl.id];
  if (best.isAdd) {
    if (!c2.ex[best.id]) define(best.id, clone((LIB.find(x => x.id === best!.id) || {} as LibEntry).def));
    const e = { ex: best.id, n: 2, isNew: true };
    if (kindOf(c2, best.id) === 'iso') L.push(e); else { let i = 0; L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light' || k === 'compound') i = j + 1; }); L.splice(i, 0, e); }
    return { ok: true, text: 'Новое упражнение: ' + label(best.id, best.sl) + ', 2 подхода' };
  }
  const e = L.find(x => x.ex === best!.id), sb = pair(L, e!);
  for (const x of [e, sb]) if (x) { x.n!++; x.chg = (x.chg || 0) + 1; }
  return { ok: true, text: '+1 подход: ' + label(best.id, best.sl, sb) };
}
export function buildProgram(workouts: Workout[], cfg: Cfg, opts?: BuildOpts) {
  opts = opts || {};
  const done = workouts.filter(w => !w.open), z = cfg.zones, cfg0 = cfg;
  /* (в эталоне нет) Цели «Силы» и «Гибрида» с днями «День N» (решение владельца, 24 ноября 2026, пункт 8 вопросов сборки; rules.ts): по проценту идёт только
     цель — одно упражнение из списка или «Пауэрлифтерская тройка» (triad); под «Силой» остальные базовые справочника — обычные упражнения по двойной
     прогрессии. Сборка считает от справочника, как он сохранён (роли принятой программы сняты, asStored), и даёт ему роли новой цели; цели нет
     в справочнике — она берётся из встроенного и уходит в create. «Сейчас» (cur, before) — по ролям принятой программы, cfg0 */
  const byRole = appRules() && !opts.manual, tri = byRole && !!opts.strength && !!opts.triad && !opts.focus;
  const aims = byRole ? (tri ? triadIds(cfg) : canTarget(cfg, opts.focus) ? [opts.focus!] : []) : [], added: Record<string, ExDef> = {};
  /* (в эталоне нет) «Гибрид» с остальными базовыми «как подсобка» (opts.others 'plain'; решение владельца, 25 ноября 2026, вывод 5 аудита): они идут обычными
     многосуставными по двойной прогрессии, как под «Силой», — экран выбирает это по умолчанию */
  const roles: Roles | null = aims.length ? { on: aims, plain: tri || !!opts.strength || opts.others === 'plain' } : null;
  if (byRole) {
    cfg = asStored(cfg);
    for (const id of aims) if (!cfg.ex[id]) {
      const def = added[id] = clone(STARTER[id]), g = def.gear;
      if (g && !cfg.gear[g] && STARTER_GEAR[g]) cfg.gear[g] = { n: STARTER_GEAR[g].n, step: STARTER_GEAR[g].step, own: true };   // свой снаряд встроенного списка: подтягивания, шаг 1 кг
      cfg.ex[id] = appEx(placed(cfg, Object.assign({ n: id }, def)));   // (в эталоне нет) карта — как у справочника в приложении: хват, присед (rules.ts, appMap)
    }
    applyRoles(cfg, roles);
  }
  const focus = opts.focus && isCycle(cfg, opts.focus) ? opts.focus : null, hold = !!focus && opts.others !== 'grow';
  let strong = !focus && !!opts.strength;                             // силовой режим (в эталоне его нет: решение владельца, 19 ноября 2026); без базовых в программе он ничего не значит
  const solo = !!focus && !!opts.strength;                            // сила в одном базовом (в эталоне нет: решение владельца, 19 ноября 2026): оно идёт до трёх дней в неделю, дня «на массу» нет, подсобка — как в силовом режиме
  const group = !focus && !strong && PRIOS.find(g => g.id === opts.prio) || null, caps = cfg.caps;
  const budget = Math.max(10, Math.min(caps.week, +opts.budget! > 0 ? +opts.budget! : caps.week));
  /* (в эталоне нет) упражнений в дне — от времени на тренировку (решение владельца, 23 ноября 2026): с днями «День N» и выбранным временем день заполняется,
     пока укладывается в него; без времени и с таблицей дней эталона — девять упражнений (rules.ts). moreT — следующее время из списка: его называют заметки,
     когда в дне больше не помещается. Без выбранного времени его не советуют: время задаёт и лимит недели «по времени», а он может выйти меньше нынешнего */
  const time = appRules() && +opts.time! > 0 ? +opts.time! : 0, moreT = time ? moreTime(time) : 0;
  const long = time ? 'в ' + fmtDur(time) + ' на тренировку больше не помещается' : 'в каждой тренировке уже по девять упражнений';
  const cur = currentSlots(done, cfg0), before = progTally(cfg0, cur);
  /* (в эталоне нет) «Сила: <упражнение>» с днями «День N»: мышцы цели — в приоритете, в полтора раза выше остальных; у изоляции два дня движения, а не три
     (решение владельца, 24 ноября 2026, пункт 8; strength.ts, ISO) */
  const aimM = solo && byRole ? Object.keys(cfg.ex[focus!].m || {}).filter(m => cfg.ex[focus!].m[m] >= 1 && !cfg.ignore[m]) : [], soloDays = solo && appRules() ? SOLO.days : STRONG.days;   // (в эталоне нет) с днями «День N» — два дня: тяжёлый и лёгкий (решение владельца, 25 ноября 2026; strength.ts, SOLO)
  /* числа тяжёлого и лёгкого дня цели; (в эталоне нет) с днями «День N» — «Новая схема» (решение владельца, 24 ноября 2026; strength.ts): тяжёлый 3 × 4 на 83%,
     лёгкий 3 × 8 на 75%, у изоляции 3 × 6 на 79% и 3 × 10 на 71% */
  const AH = focus && appRules() ? heavyOf(cfg, focus) : AUTO, AL = !appRules() ? LIGHT_A : focus ? lightFor(cfg, focus) : DAY_L;   // (в эталоне нет) у становой лёгкий день 3 × 6 на 79% (rules.ts, lightFor)
  /* (в эталоне нет) дни «День N»: «Сейчас» — вся нынешняя неделя, вместе с днями, которых в выбранной неделе нет, пока в них что-то стоит.
     Иначе при переходе с трёх дней на два «было» оказалось бы заниженным, а спад читался бы как рост */
  const away = awayDays(done, cfg0);
  let awaySets = 0;
  for (const d of away) {
    const t = progTally(cfg0, { [SLOTS[0].id]: d.items });
    for (const key of ['pv', 'ps', 'pp'] as const) for (const m of Object.keys(t[key])) before[key][m] = (before[key][m] || 0) + t[key][m];
    for (const m of Object.keys(t.prim)) before.prim[m] = true;
    awaySets += t.load[SLOTS[0].id] || 0;
  }
  /* by hand: the programme as it stands, to be edited in the page */
  if (opts.manual) return { manual: true, focus: null, others: null, name: (cfg.program && cfg.program.name) || 'Своя программа', slots: clone(cur), cur, goals: {} as Record<string, string | null>, create: {} as Record<string, ExDef>, notes: [] as ProgNote[], cfg: clone(cfg), before, after: away.length ? progTally(cfg, cur) : before, same: !away.length, away: awaySets, dropped: [] as string[], dropFrom: [] as string[], triad: null as string[] | null };
  const c2 = clone(cfg), slots = clone(byRole ? currentSlots(done, cfg) : cur), goals: Record<string, string | null> = {}, create: Record<string, ExDef> = clone(added), notes: ProgNote[] = [];   // (в эталоне нет) дни — по ролям новой цели
  const note = (t: string, x?: string) => notes.push({ t, x });
  /* (в эталоне нет: решение владельца, 19 ноября 2026) дни без привязки к дням недели: в заметках «в день 2» вместо «в среду»;
     сколько дней выбрал атлет, столько и тренировочных — пустой день сборка занимает */
  const onDay = (id: string) => DAYS.week ? ON_DAY[id] : 'в день ' + dayNo(id), everyDay = !DAYS.week, NUM = ['', 'один', 'два', 'три', 'четыре'];
  const all = () => SLOTS.flatMap(sl => slots[sl.id]);
  const inProg = (id: string): any => all().some(e => e.ex === id);
  const now = () => progTally(c2, slots);
  const nm = (id: string) => exName(c2, id);
  const mOf = (id: string) => (c2.ex[id] || {} as ExDef).m || {};
  const setGoal = (id: string, g: string | null) => { goals[id] = g || null; if (g) c2.ex[id].goal = g; else delete c2.ex[id].goal; };
  const define = (id: string, def: ExDef) => { create[id] = def; c2.ex[id] = placed(c2, Object.assign({ n: id }, def)); };
  /* a day for a new exercise: no heavy work for the same muscles that day, at most one new exercise a day, the shortest day first */
  const pickDay = (def: ExDef, skip?: ((sl: Slot) => boolean) | null) => {
    const T = now();
    const clash = (sl: Slot) => slots[sl.id].some(e => kindOf(c2, e.ex) !== 'iso' && Object.entries(def.m).some(([m, c]) => c >= 1 && mOf(e.ex)[m] > 0)) ? 1 : 0;
    const days = SLOTS.filter(sl => slots[sl.id].length && !(skip && skip(sl)) && !slots[sl.id].some(e => e.isNew && !isLight(c2, e.ex)));
    days.sort((a, b) => (clash(a) - clash(b)) || (T.load[a.id] - T.load[b.id]));
    return days[0] || null;
  };
  /* his own order: the percentage lifts first, then the rest; a new multi-joint exercise goes right after them, an isolation one to the end */
  const insert = (sl: Slot, e: ProgEntry) => {
    const L = slots[sl.id];
    if (kindOf(c2, e.ex) === 'iso') { L.push(e); return; }
    let i = 0;
    L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light') i = j + 1; });
    L.splice(i || Math.min(1, L.length), 0, e);
  };
  const existing = (a: Add) => {
    for (let i = done.length - 1; i >= 0; i--) for (const it of done[i].items) if (a.cover(cfg.ex[it.ex])) return it.ex;
    return Object.keys(cfg.ex).find(id => a.cover(cfg.ex[id])) || null;
  };

  /* 0. (в эталоне этого шага нет: решение владельца, 19 ноября 2026) Порядок «сначала базовое, потом остальное» действует и в программе,
        собранной с нуля: упражнения по волне из справочника встают по одному в день, каждое первым (приоритетное — в понедельник).
        Приоритетное базовое, которого в программе ещё нет, встаёт первым в тренировочный день без другого базового, в самый лёгкий. */
  const scratch = SLOTS.every(sl => !slots[sl.id].length), put: string[] = [];
  /* (в эталоне нет) неделя перекладывается под другое число дней: дней не три или в неделе появился пустой день */
  const reshape = everyDay && (SLOTS.length !== 3 || (!scratch && SLOTS.some(sl => !cur[sl.id].length)));
  /* (в эталоне нет) Базовых больше, чем дней (решение владельца, 23 ноября 2026; правило приложения, rules.ts): с днями «День N» в тренировке
     одно базовое — лишнее не встаёт вторым, а уходит из программы с заметкой. Каким жертвовать, выбирает атлет (opts.drop, по порядку); без выбора —
     то, что по правилу оказалось бы лишним. Приоритетное базовое не уходит. Тем, чем принятая программа пожертвовала (program.drop),
     сборка возвращает, когда дней снова хватает */
  /* (в эталоне нет) В «Массе» базовые идут по двойной прогрессии, а под «Силой: <упражнение>» по проценту идёт одно упражнение: жертвовать там нечем,
     и списка «Без базового» нет (решение владельца, 24 ноября 2026, пункт 8). Правило действует в «Гибриде» и в силе нескольких движений */
  const oneBase = appRules() && !solo && (!!focus || strong), dropped: string[] = [], dropFrom: string[] = [], mine = (opts.drop || []).filter(id => isCycle(cfg, id) && id !== focus);
  let rivals = 0;
  const pickOut = (all: string[], byRule: string[]) => {            // byRule: первым — то, что по правилу лишнее всего
    const cands = [...new Set(all)];                                 // одно базовое, поставленное руками в два дня, — одно
    if (cands.length <= SLOTS.length) return [] as string[];
    rivals = cands.length;
    for (const id of cands) if (id !== focus && !dropFrom.includes(id)) dropFrom.push(id);
    const out = [...new Set(mine.concat(byRule).filter(id => cands.includes(id) && id !== focus))].slice(0, cands.length - SLOTS.length);
    dropped.push(...out);
    return out;
  };
  /* (в эталоне нет) В «Массе» — и с мышцами в приоритете, и «Всем поровну» — базовые справочника с нуля сами не встают (решение владельца, 25 ноября 2026):
     силовой роли у них там нет (пункт 8), и первым в дне им стоять незачем — упражнения подбираются по мышцам из остального справочника.
     Базовые, которые в программе уже стоят, остаются; в «Силе» и «Гибриде» — как было */
  if (scratch && !(appRules() && !focus && !opts.strength)) {
    const ls = Object.keys(cfg.ex).filter(id => isCycle(cfg, id));
    if (focus) { ls.splice(ls.indexOf(focus), 1); ls.unshift(focus); }
    if (tri) ls.sort((a, b) => aims.indexOf(a) - aims.indexOf(b));   // (в эталоне нет) тройка встаёт по дням в своём порядке: приседания, жим лежа, становая
    if (oneBase) for (const id of pickOut(ls, ls.slice().reverse())) ls.splice(ls.indexOf(id), 1);   // с нуля лишнее — последнее по списку
    /* (в эталоне нет) без привязки к трём дням: если базовых больше, чем дней, остальные встают вторыми по кругу — не больше двух в день
       (с правилами приложения лишних уже нет: они ушли выше) */
    const room = everyDay && !oneBase ? SLOTS.length * 2 : SLOTS.length;
    ls.slice(0, room).forEach((id, i) => { slots[SLOTS[i % SLOTS.length].id].push({ ex: id }); put.push(id); });
    if (put.length) note('Базовые — первыми в своих днях: ' + put.map((id, i) => nm(id) + ' (' + SLOTS[i % SLOTS.length].s.toLowerCase() + (i >= SLOTS.length ? ', вторым' : '') + ')').join(', '), 'Программа собрана с нуля, поэтому ' + (appRules() ? 'базовые' : 'упражнения по волне') + ' встали по одному в день и первыми: сначала базовое на свежие силы, потом остальное.' + (put.length > SLOTS.length ? ' Базовых больше, чем дней, поэтому ' + list(put.slice(SLOTS.length).map(nm)) + ' — вторым упражнением.' : '') + (ls.length > room ? ' Дней ' + NUM[SLOTS.length] + ', поэтому не поместились: ' + list(ls.slice(room).map(nm)) + '.' : ''));
  }
  /* 0б. (в эталоне нет) Дней в неделе стало меньше: базовые, стоявшие в днях, которых больше нет, переезжают в оставшиеся — в день без лёгкого дня
         этого же базового, где базовых меньше, и встают после них. «Стояло в дне» — то, что в нём действует сейчас (awayDays): принятая программа,
         пока по ней в этом дне не тренировались, иначе последняя тренировка дня. Базовое, которое атлет убрал из дня сам, не возвращается */
  const movedFrom: Record<string, string> = {}, incoming: { x: string; d: string }[] = [];
  if (everyDay && !scratch) for (const d of away) for (const it of d.items) {
    const x = it.ex, lift = isCycle(cfg, x);
    /* (в эталоне нет) под «Силой» базовое справочника, которое не цель, — обычное упражнение, но и оно переезжает, а не пропадает вместе с днём (пункт 8) */
    if (!(lift || (cfg.ex[x] && cfg.ex[x].stored === 'cycle')) || inProg(x)) continue;
    if (oneBase && lift) { if (!incoming.some(v => v.x === x)) incoming.push({ x, d: d.id }); continue; }   // с правилами приложения встанет ниже, если ему хватит дня
    const T0 = now(), nBase = (sl: Slot) => slots[sl.id].filter(e => { const k = kindOf(cfg, e.ex); return k === 'base' || k === 'light'; }).length;
    const own = (sl: Slot) => slots[sl.id].some(e => isLight(cfg, e.ex) && cfg.ex[e.ex].of === x) ? 1 : 0;
    const day = SLOTS.slice().sort((a, b) => (own(a) - own(b)) || (nBase(a) - nBase(b)) || (T0.load[a.id] - T0.load[b.id]))[0];
    slots[day.id] = slots[day.id].filter(e => !(isLight(cfg, e.ex) && cfg.ex[e.ex].of === x));   // тяжёлый и лёгкий день одного базового в одной тренировке не стоят
    let at = 0;
    slots[day.id].forEach((e, k) => { const kind = kindOf(cfg, e.ex); if (kind === 'base' || kind === 'light') at = k + 1; });
    slots[day.id].splice(at, 0, { ex: x }); put.push(x); movedFrom[x] = d.id;
    note(nm(x) + ' — ' + onDay(day.id), 'Дней в неделе стало меньше, а это базовое стояло в дне, которого больше нет. Оно переехало сюда.');
  }
  /* 0в. (в эталоне нет) Дней в неделе стало больше: появился день без упражнений, а в другом стоят два базовых — второе переезжает в пустой день */
  if (everyDay && !scratch) for (const sl of SLOTS) {
    if (slots[sl.id].length) continue;
    const from = SLOTS.find(d => slots[d.id].filter(e => kindOf(cfg, e.ex) === 'base').length > 1);
    if (!from) break;
    const bases = slots[from.id].filter(e => kindOf(cfg, e.ex) === 'base'), e = bases[bases.length - 1];
    slots[from.id].splice(slots[from.id].indexOf(e), 1); slots[sl.id].push({ ex: e.ex }); put.push(e.ex); movedFrom[e.ex] = from.id;
    note(nm(e.ex) + ' — ' + onDay(sl.id), 'В неделе есть день без упражнений, а в другом дне стояли два базовых. Второе переехало сюда.');
  }
  /* 0г. (в эталоне нет) Одно базовое в тренировке (см. выше). Спорят за дни базовые, что стоят в днях, базовые из дней вне недели (шаг 0б),
         те, которыми принятая программа пожертвовала, и приоритетное, которого в программе нет. Лишних по правилу — сначала того, чем жертвовали,
         потом из дня вне недели, потом стоящее в своём дне не первым базовым, потом — с конца недели. Оставшиеся новые встают в день без
         другого базового: туда, где нет лёгкого дня этого же базового и лёгких дней меньше, при равенстве — в самый лёгкий. Если атлет убрал
         не то, что стояло вторым, второе базовое из дня, где их два, переезжает в день, оставшийся без базового */
  /* (в эталоне нет) В «Массе» лишних базовых нет: то, чем программа жертвовала, возвращается, а базовые из дней вне недели переехали шагом 0б (решение владельца,
     24 ноября 2026, пункт 8). Под «Силой: <упражнение>» базовые справочника — обычные упражнения: возвращать нечего */
  if (appRules() && !scratch) {
    const isHeavy = (e: ProgEntry) => kindOf(cfg, e.ex) === 'base', nLift = (sl: Slot) => slots[sl.id].filter(e => { const k = kindOf(cfg, e.ex); return k === 'base' || k === 'light'; }).length;
    const P = cfg.program, back = ((P && P.drop) || []).filter((id, i, a) => a.indexOf(id) === i && isCycle(cfg, id) && id !== focus && !inProg(id) && !incoming.some(v => v.x === id));
    const lone = (tri ? aims : focus ? [focus] : []).filter(x => !inProg(x) && !incoming.some(v => v.x === x));   // их ставит шаг ниже
    const inDays = SLOTS.flatMap(sl => slots[sl.id].filter(isHeavy).map((e, j) => ({ x: e.ex, j })));
    const out = !oneBase ? [] : pickOut(inDays.map(v => v.x).concat(incoming.map(v => v.x), back, lone),
      back.concat(incoming.slice().reverse().map(v => v.x), inDays.filter(v => v.j > 0).reverse().map(v => v.x), inDays.filter(v => !v.j).reverse().map(v => v.x)));
    for (const x of out) for (const sl of SLOTS) slots[sl.id] = slots[sl.id].filter(e => e.ex !== x && !(isLight(cfg, e.ex) && cfg.ex[e.ex].of === x));   // вместе со своим лёгким днём
    const place = (x: string) => {
      const T0 = now(), free = SLOTS.filter(sl => !slots[sl.id].some(isHeavy)), own = (sl: Slot) => slots[sl.id].some(e => isLight(cfg, e.ex) && cfg.ex[e.ex].of === x) ? 1 : 0;
      const day = (free.length ? free : SLOTS).slice().sort((a, b) => (own(a) - own(b)) || (nLift(a) - nLift(b)) || (T0.load[a.id] - T0.load[b.id]))[0];
      slots[day.id] = slots[day.id].filter(e => !(isLight(cfg, e.ex) && cfg.ex[e.ex].of === x));   // тяжёлый и лёгкий день одного базового в одной тренировке не стоят
      let at = 0;
      slots[day.id].forEach((e, k) => { const kind = kindOf(cfg, e.ex); if (kind === 'base' || kind === 'light') at = k + 1; });
      slots[day.id].splice(at, 0, { ex: x }); put.push(x);
      return day;
    };
    if (oneBase) for (const v of incoming) if (!out.includes(v.x)) { const day = place(v.x); movedFrom[v.x] = v.d; note(nm(v.x) + ' — ' + onDay(day.id), 'Дней в неделе стало меньше, а это базовое стояло в дне, которого больше нет. Оно переехало сюда.'); }
    const grew = !!P && Object.keys(P.slots).length < SLOTS.length;   // программа принята на меньшее число дней
    for (const x of back) if (!out.includes(x)) { const day = place(x); note(nm(x) + ' — ' + onDay(day.id), !oneBase ? 'Этим базовым программа жертвовала, когда дней не хватало. В «Массе» базовые идут по двойной прогрессии, и жертвовать ими не нужно: оно вернулось в программу.' : (grew ? 'Дней в неделе стало больше. Этим базовым программа жертвовала, потому что дней не хватало, — оно вернулось' : 'Этим базовым программа жертвовала, а теперь в списке «Без базового» выбрано другое. Оно вернулось') + ' в день без другого базового.'); }
    if (out.length) for (let g = 0; g < SLOTS.length; g++) {
      const two = SLOTS.find(sl => slots[sl.id].filter(isHeavy).length > 1);
      if (!two || !SLOTS.some(sl => !slots[sl.id].some(isHeavy))) break;
      const e = slots[two.id].filter(x => isHeavy(x) && x.ex !== focus).pop()!;
      slots[two.id].splice(slots[two.id].indexOf(e), 1);
      const day = place(e.ex);
      movedFrom[e.ex] = movedFrom[e.ex] || two.id;
      note(nm(e.ex) + ' — ' + onDay(day.id), 'В тренировке одно базовое, а этот день остался без базового. Оно переехало сюда из дня ' + dayNo(two.id) + '.');
    }
  }
  if (dropped.length) {
    const many = dropped.length > 1, num = (n: number) => NUM[n] || String(n);
    note('Не в программе: ' + list(dropped.map(nm)), 'Базовых ' + num(rivals) + ', а дней ' + num(SLOTS.length) + ': в тренировке одно базовое, второе шло бы уже не на свежие силы. ' + (many ? 'Какие убрать, выбирается в списках' : 'Какое убрать, выбирается в списке') + ' «Без базового» над днями программы. Когда дней станет больше, ' + (many ? 'они вернутся в программу сами.' : 'оно вернётся в программу само.'));
  }
  /* (в эталоне нет) у «Силы: пауэрлифтерская тройка» так встаёт каждое движение тройки, которого в программе нет: по порядку тройки */
  for (const x of scratch ? [] : (tri ? aims : focus ? [focus] : []).filter(x => !inProg(x) && !dropped.includes(x))) {
    const T0 = now(), open = SLOTS.filter(sl => everyDay || slots[sl.id].length), free = open.filter(sl => !slots[sl.id].some(e => kindOf(cfg, e.ex) === 'base'));
    /* (в эталоне нет) с днями «День N» тяжёлый день не встаёт туда, где стоит лёгкий день этого же базового */
    const own = (sl: Slot) => everyDay && slots[sl.id].some(e => isLight(cfg, e.ex) && cfg.ex[e.ex].of === x) ? 1 : 0;
    const day = (free.length ? free : open).sort((a, b) => (own(a) - own(b)) || (T0.load[a.id] - T0.load[b.id]))[0];
    if (everyDay) slots[day.id] = slots[day.id].filter(e => !(isLight(cfg, e.ex) && cfg.ex[e.ex].of === x));
    slots[day.id].unshift({ ex: x }); put.push(x);
    note(nm(x) + ' — в программу ' + onDay(day.id), (tri ? 'В программе этого движения не было. Оно в тройке' : byRole ? 'В программе этого упражнения не было. Оно — цель программы' : 'В программе этого упражнения не было. Оно в приоритете') + ', поэтому встало первым — в день ' + (free.length ? 'без другого базового.' : 'с наименьшей нагрузкой.'));
  }

  /* 1. a light day belongs to the priority lift only */
  const midOk = (e: ProgEntry) => !cfg.ex[e.ex].mid;   // (в эталоне нет) среднего дня сборка больше не ставит: «Сила: <движение>» — два дня (решение владельца, 25 ноября 2026; strength.ts, SOLO)
  const stays = (e: ProgEntry) => !isLight(cfg, e.ex) || (((focus && cfg.ex[e.ex].of === focus) || (strong && isCycle(cfg, cfg.ex[e.ex].of!) && inProg(cfg.ex[e.ex].of!))) && midOk(e));   // в силовом режиме лёгкий день есть у каждого базового
  /* (в эталоне нет) После «Силы в одном базовом» лёгких дней у базового два. В любом другом режиме лёгкий день у базового один:
     остаётся самый дальний по календарю от тяжёлого дня, второй уходит */
  const extra: ProgEntry[] = [], told: string[] = [];
  if (!solo || appRules()) for (const id of [...new Set(all().filter(e => isLight(cfg, e.ex) && stays(e)).map(e => e.ex))]) {   // (в эталоне нет) с днями «День N» и у «Силы: <движение>» лёгкий день один
    const on = SLOTS.filter(sl => slots[sl.id].some(e => e.ex === id));
    if (on.length < 2) continue;
    const home = SLOTS.find(sl => slots[sl.id].some(e => e.ex === cfg.ex[id].of)), gap = (sl: Slot) => { if (!home) return 0; const d = Math.abs(sl.dow - home.dow); return Math.min(d, 7 - d); };
    const keep = on.slice().sort((a, b) => gap(b) - gap(a))[0];
    for (const sl of on) if (sl !== keep) extra.push(...slots[sl.id].filter(e => e.ex === id));
  }
  for (const sl of SLOTS) slots[sl.id] = slots[sl.id].filter(e => {
    if (extra.includes(e)) { note('Убрано: ' + nm(e.ex) + ' ' + onDay(sl.id), (appRules() ? 'Движение идёт два дня в неделю: тяжёлый и лёгкий.' : 'Три дня движения — только в «Силе в одном базовом».') + ' Здесь лёгкий день один: остался самый дальний от тяжёлого.'); return false; }
    if (stays(e)) return true;
    if (!told.includes(e.ex)) { told.push(e.ex); note('Убрано: ' + nm(e.ex), cfg.ex[e.ex].mid ? 'Среднего дня больше нет: движение цели идёт два дня в неделю — тяжёлый и лёгкий.' : appRules() ? 'Лёгкий день есть только у того, что выбрано целью «Силы» или «Гибрида».' : 'Лёгкий день нужен только упражнению в приоритете.'); }   // (в эталоне нет) пункт 8: роль базового — у цели
    return false;
  });

  /* 2. the percentage lifts: priority, maintenance or the usual wave */
  const lifts = Object.keys(cfg.ex).filter(id => isCycle(cfg, id) && inProg(id)), held: string[] = [], back: string[] = [], grown: string[] = [];
  if (tri) lifts.sort((a, b) => aims.indexOf(a) - aims.indexOf(b));   // (в эталоне нет) тройка — в своём порядке
  if (!lifts.length) strong = false;
  for (const id of lifts) {
    /* the lift in priority goes by reserve; the others hold, or keep what they do. A lift the athlete put on «сила по запасу» himself stays on it.
       (в эталоне нет) Методика под цель (решение владельца, 24 ноября 2026): с днями «День N» по проценту идёт только силовая роль, которую задаёт цель.
       «Сила» и выбранное базовое — сила по запасу; остальные базовые вокруг выбранного — поддержание или, если «растут», сила по запасу раз в неделю;
       в «Массе» базовые — на двойной прогрессии */
    const was = goalOf(cfg0, id), want = appRules() ? (id === focus || strong ? 'auto' : focus ? (hold ? 'hold' : 'auto') : null) : id === focus || strong ? 'auto' : hold ? 'hold' : was === 'auto' ? 'auto' : null;
    setGoal(id, want);
    if (want === 'hold' && was !== 'hold') held.push(id);
    if (!want && was) back.push(id);
    if (appRules() && want === 'auto' && was !== 'auto' && id !== focus && !strong) grown.push(id);
  }
  if (focus && inProg(focus)) {
    if (goalOf(cfg0, focus) !== 'auto') note(nm(focus) + ' — сила по запасу', AH.sets + ' × ' + AH.reps + ' одним весом, первый вес — ' + AH.pct + '% от расчётного максимума. Дальше решает запас в последнем подходе: ' + (appRules() ? AUTO.aim + '–' + (HEAVY.fast - 1) + ' повтора — на следующей неделе плюс шаг; ' + HEAVY.fast + ' и больше — сразу несколько шагов, но не больше ' + HEAVY.max * 100 + '% веса; 1 — вес тот же; ' : AUTO.aim + ' повтора и больше — на следующей неделе плюс шаг, 1 — вес тот же, ') + '0 или подходы не закрыты — минус ' + AUTO.down + '%.' + (appRules() ? ' Если шаг больше ' + HEAVY.big * 100 + '% веса, сначала растут повторы: ' + AH.sets + ' × ' + (AH.reps + 1) + ', ' + AH.sets + ' × ' + (AH.reps + HEAVY.reps) + ', потом шаг.' : '') + ' Запас отмечается в карточке упражнения.');
    const lid = focus + '_light', home = SLOTS.find(sl => slots[sl.id].some(e => e.ex === focus));
    const at = slots[home!.id].findIndex(e => e.ex === focus);
    if (at > 0) { slots[home!.id].unshift(slots[home!.id].splice(at, 1)[0]); note(nm(focus) + ' — первым упражнением ' + onDay(home!.id), (byRole ? 'Цель программы' : 'Приоритетное упражнение') + ' делается на свежие силы, до всего остального.'); }
    if (solo) {
      /* 3б. (в эталоне нет) Сила в одном базовом: лёгкий день встаёт в каждый другой тренировочный день, пока движение не идёт STRONG.days раз в неделю.
             Сначала самый дальний по календарю день, при равенстве — менее нагруженный. Лёгкий день стоит первым, как в пауэрбилдинге;
             тот, что у базового уже есть, остаётся на месте. Новыми они помечаются в самом конце — как базовые шага 0.
             С днями «День N» движение идёт два дня — тяжёлый и лёгкий, у всех движений (решение владельца, 25 ноября 2026; strength.ts, SOLO);
             средний день, который ставила «Новая схема» 24 ноября, сборка убирает */
      const mid = focus + '_mid', par = cfg.ex[focus], iso = isoLift(cfg, focus), mine = (e: ProgEntry) => e.ex === lid || e.ex === mid;
      const T = now(), gap = (sl: Slot) => { const d = Math.abs(sl.dow - home!.dow); return Math.min(d, 7 - d); }, has = (sl: Slot) => slots[sl.id].some(mine);
      const free = SLOTS.filter(sl => sl !== home && (scratch || everyDay || slots[sl.id].length) && !has(sl)).sort((a, b) => (gap(b) - gap(a)) || (T.load[a.id] - T.load[b.id]));
      const add = free.slice(0, Math.max(0, soloDays - 1 - SLOTS.filter(sl => sl !== home && has(sl)).length));   // (в эталоне нет) у изоляции в силовой роли — два дня
      if (add.length) {
        if (!cfg.ex[lid]) define(lid, { n: par.n + ' — лёгкий день', mode: 'light', of: focus, pat: par.pat || 'iso', m: clone(par.m || {}) });
        for (const day of add) slots[day.id].unshift({ ex: lid });
      }
      const on = SLOTS.filter(sl => sl !== home && has(sl));
      if (appRules()) {
        /* (в эталоне нет) с днями «День N» у всех движений лёгкий день один (решение владельца, 25 ноября 2026; strength.ts, SOLO): средний день,
           оставшийся от прежней программы, ушёл выше, а лишний лёгкий день — вместе с ним */
        for (const sl of on) for (const e of slots[sl.id]) if (mine(e)) e.ex = lid;
        if (on.length && !cfg.ex[lid]) define(lid, { n: par.n + ' — лёгкий день', mode: 'light', of: focus, pat: par.pat || 'iso', m: clone(par.m || {}) });
      }
      const days = on.map(sl => ({ sl, L: slots[sl.id].some(e => e.ex === mid) ? DAY_M : AL })), own = AH.sets + days.reduce((t, d) => t + d.L.sets, 0);
      if (on.length && appRules()) note('Сила: ' + nm(focus) + ' — два раза в неделю', 'Тяжёлый день — ' + onDay(home!.id) + ': ' + AH.sets + ' × ' + AH.reps + ' одним весом, вес решает запас в последнем подходе. '
        + 'Лёгкий день — ' + list(on.map(sl => onDay(sl.id))) + ': ' + AL.sets + ' × ' + AL.reps + ' на ' + AL.pct + '%. В обоих днях запас около ' + estRir(AL.pct, AL.reps) + ' повторов, вес лёгкого дня идёт за тяжёлым. Всего ' + own + ' подходов движения в неделю: '
        + 'по исследованиям прибавка силы от подходов самого движения быстро затухает, и больше 5–6 в неделю надёжной разницы не дают. Дни отличаются повторами: так силы прибавляется больше, чем от одинаковых тренировок. Точные повторы — правило дневника. Дня «на массу», как в «Гибриде», здесь нет.');   // (в эталоне нет) решение владельца, 25 ноября 2026
      else if (on.length) note('Сила: ' + nm(focus) + ' — ' + (on.length > 1 ? 'три раза' : 'два раза') + ' в неделю', 'Тяжёлый день — ' + onDay(home!.id) + ': ' + AH.sets + ' × ' + AH.reps + ' одним весом, вес решает запас в последнем подходе. ' + (on.length > 1 ? 'Лёгкие дни — ' : 'Лёгкий день — ') + list(on.map(sl => onDay(sl.id))) + ': ' + AL.sets + ' × ' + AL.reps + ' на ' + AL.pct + '%, в запасе около ' + estRir(AL.pct, AL.reps) + ' повторов; вес идёт за тяжёлым днём сам. Всего ' + own + ' подходов движения в неделю. По исследованиям для силы считаются подходы самого движения, и отдача от них быстро убывает'
        + (on.length > 1 ? ': что ' + own + ' лучше ' + (AH.sets + AL.sets) + ', надёжно не показано. Три дня — тренерское правило: частая практика движения без лишней усталости.' : '.') + ' Дня «на массу», как в пауэрбилдинге, здесь нет.');
      else note('Без лёгкого дня: ' + nm(focus), 'Лёгкий день ставится в другой тренировочный день, а он в программе один. Добавь упражнения во второй день и собери программу ещё раз — иначе базовое идёт на силу только раз в неделю.');
    }
    /* 3. a second, light day for the priority lift */
    if (!solo && !inProg(lid)) {
      const T = now(), gap = (sl: Slot) => { const d = Math.abs(sl.dow - home!.dow); return Math.min(d, 7 - d); };
      const day = SLOTS.filter(sl => sl !== home && (scratch || everyDay || slots[sl.id].length)).sort((a, b) => (gap(b) - gap(a)) || (T.load[a.id] - T.load[b.id]))[0];   // с нуля годится и день, который пока пуст
      if (day) {
        const par = cfg.ex[focus];
        if (!cfg.ex[lid]) define(lid, { n: par.n + ' — лёгкий день', mode: 'light', of: focus, pat: par.pat || 'iso', m: clone(par.m || {}) });
        slots[day.id].unshift({ ex: lid, isNew: true });
        note((DAYS.week ? 'Второй день ' : 'Второй раз в неделю — ') + onDay(day.id) + ': ' + nm(lid), AL.sets + ' × ' + AL.reps + ' на ' + AL.pct + '% от расчётного максимума, в запасе около ' + estRir(AL.pct, AL.reps) + ' повторов. ' + (appRules() ? 'Второй раз в неделю движение идёт на других повторах: по исследованиям так силы прибавляется больше, чем от одинаковых тренировок.' : 'Вторая практика движения за неделю, которая почти не утомляет.') + ' Вес идёт за основным днём сам. Стоит первым, пока ты свежий.');   // (в эталоне нет) с днями «День N» — «Новая схема»
      }
    }
  }
  if (held.length && appRules()) note(list(held.map(nm)) + ' — поддержание', HOLD.sets + ' × ' + HOLD.reps + ' на ' + HOLD.pct + '% от расчётного максимума, раз в неделю; максимум не растёт, вес остаётся прежним. По исследованиям этого хватает, чтобы сила не уходила, а восстановление достаётся приоритету.');
  else if (held.length) note(list(held.map(nm)) + ' — поддержание', 'Та же волна, ' + Math.max(2, cfg.cycle.sets - 1) + ' подхода вместо ' + cfg.cycle.sets + ', расчётный максимум не растёт. Вес остаётся прежним — этого хватает, чтобы сила не уходила, а восстановление достаётся приоритету.');
  if (grown.length) note(list(grown.map(nm)) + ' — сила по запасу раз в неделю', DAY_H.sets + ' × ' + DAY_H.reps + ' одним весом, первый вес — ' + DAY_H.pct + '% от расчётного максимума; дальше решает запас в последнем подходе: ' + AUTO.aim + ' и больше — плюс шаг, 1 — вес тот же, 0 — минус ' + AUTO.down + '%.');
  if (back.length && appRules()) note(list(back.map(nm)) + ' — по двойной прогрессии', 'Без процентов от максимума: ' + BASE_SETS + ' подхода по ' + TYPE.compound.lo + '–' + (TYPE.compound.lo + TYPE.compound.w) + ' повторов ' + rirText(cfg, back) + ', каждый подход ведётся отдельно — взял верх диапазона, в следующий раз в этом подходе вес на шаг выше. Первый вес — от расчётного максимума по последним подходам.');
  else if (back.length) note(list(back.map(nm)) + ' — снова обычная волна', cfg.cycle.sets + ' подхода, расчётный максимум +' + fmt(cfg.cycle.inc, 1) + '% в неделю.');
  if (strong) {
    /* 3а. (в эталоне нет) Силовой режим: каждое базовое — первым в своём дне на силу по запасу и ещё раз лёгким днём в другой день недели.
           Лёгкий день встаёт туда, где базовых и лёгких дней меньше, при равенстве — в самый дальний по календарю день, и стоит сразу после тяжёлых базовых.
           Так в трёх днях с тремя базовыми выходит по одному тяжёлому и одному лёгкому в день. Лёгкий день, который у базового уже есть, остаётся на месте. */
    const isLift = (e: ProgEntry) => { const k = kindOf(c2, e.ex); return k === 'base' || k === 'light'; }, nLifts = (sl: Slot) => slots[sl.id].filter(isLift).length;
    const homeOf = (id: string) => SLOTS.find(sl => slots[sl.id].some(e => e.ex === id))!;
    for (const sl of SLOTS) {
      const L = slots[sl.id], heavy = L.filter(e => kindOf(c2, e.ex) === 'base');
      if (!heavy.length || !L.slice(0, heavy.length).some(e => kindOf(c2, e.ex) !== 'base')) continue;
      slots[sl.id] = heavy.concat(L.filter(e => kindOf(c2, e.ex) !== 'base'));
      note(list(heavy.map(e => nm(e.ex))) + ' — первым упражнением ' + onDay(sl.id), 'Тяжёлый день делается на свежие силы, до всего остального.');
    }
    const H = appRules() ? DAY_H : AUTO, L = appRules() ? DAY_L : LIGHT_A;   // (в эталоне нет) с днями «День N» — «Новая схема» (strength.ts)
    note((tri ? 'Тройка: ' + list(lifts.map(nm)) + ' — каждое' : 'Сила: ' + list(lifts.map(nm)) + ' —') + ' два раза в неделю', 'Тяжёлый день — ' + H.sets + ' × ' + H.reps + ' одним весом, первый вес — ' + H.pct + '% от расчётного максимума. Дальше решает запас в последнем подходе: ' + AUTO.aim + ' повтора и больше — на следующей неделе плюс шаг, 1 — вес тот же, 0 или подходы не закрыты — минус ' + AUTO.down + '%. Лёгкий день — ' + L.sets + ' × ' + L.reps + ' на ' + L.pct + '%' + (appRules() && lifts.some(id => isDeadlift(nm(id))) ? ', у становой — ' + DL_LIGHT.sets + ' × ' + DL_LIGHT.reps + ' на ' + DL_LIGHT.pct + '%' : '') + ', в запасе около ' + estRir(L.pct, L.reps) + ' повторов. '   // (в эталоне нет) лёгкий день становой — решение владельца, 25 ноября 2026
      + (appRules() ? 'Всего ' + (H.sets + L.sets) + ' подходов движения в неделю: по исследованиям для силы считаются подходы самого движения, и 5–9 в неделю дают чуть больше, чем меньше пяти. Дни отличаются повторами: так силы прибавляется больше, чем от одинаковых тренировок. Точные повторы — правило дневника.'
        : 'По исследованиям для силы считаются подходы самого движения, и 5–9 в неделю дают чуть больше, чем меньше пяти. Второй день как способ набрать их без лишней усталости — тренерское правило, а не вывод исследования.'));
    const lights: string[] = [], lone: string[] = [];
    for (const id of lifts.slice().sort((a, b) => SLOTS.indexOf(homeOf(a)) - SLOTS.indexOf(homeOf(b)))) {
      const lid = id + '_light';
      if (inProg(lid)) continue;
      const home = homeOf(id), gap = (sl: Slot) => { const d = Math.abs(sl.dow - home.dow); return Math.min(d, 7 - d); }, T = now();
      const day = SLOTS.filter(sl => sl !== home && (scratch || everyDay || slots[sl.id].length)).sort((a, b) => (nLifts(a) - nLifts(b)) || (gap(b) - gap(a)) || (T.load[a.id] - T.load[b.id]))[0];
      if (!day) { lone.push(id); continue; }
      const par = cfg.ex[id];
      if (!cfg.ex[lid]) define(lid, { n: par.n + ' — лёгкий день', mode: 'light', of: id, pat: par.pat || 'iso', m: clone(par.m || {}) });
      let at = 0;
      slots[day.id].forEach((x, j) => { if (isLift(x)) at = j + 1; });
      slots[day.id].splice(at, 0, { ex: lid });
      put.push(lid); lights.push(nm(id) + ' — ' + onDay(day.id));
    }
    if (lights.length) note('Лёгкие дни: ' + lights.join(', '), 'Каждый стоит сразу после тяжёлого базового своего дня и не в тот день, когда это же упражнение идёт тяжело. Вес лёгкого дня сам идёт за тяжёлым.');
    if (lone.length) note('Без лёгкого дня: ' + list(lone.map(nm)), 'Лёгкий день ставится в другой тренировочный день, а он в программе один. Добавь упражнения во второй день и собери программу ещё раз — иначе базовое идёт на силу только раз в неделю.');
  }

  if (focus && inProg(focus) && !solo) {
    /* 4. two strength days and a mass day: the remaining day gets an exercise for the main muscles of the lift, in its usual range and near failure */
    const fm: MuscleMap = cfg.ex[focus].m || {}, mains = Object.keys(fm).filter(m => fm[m] >= 1 && !cfg.ignore[m]), lid = focus + '_light';
    const dp = (id: string) => { const k = kindOf(c2, id); return k === 'compound' || k === 'iso'; };
    const hitsMain = (id: string) => mains.some(m => (mOf(id)[m] || 0) >= 1), offMain = (id: string) => Object.entries(mOf(id)).some(([m, c]) => c >= 1 && cfg.ignore[m]);
    const like = (id: string) => { const a = mOf(id), ks = [...new Set(Object.keys(a).concat(Object.keys(fm)))]; return ks.reduce((t, k) => t + Math.min(a[k] || 0, fm[k] || 0), 0) / (ks.reduce((t, k) => t + Math.max(a[k] || 0, fm[k] || 0), 0) || 1); };
    /* (в эталоне нет) без привязки к трём дням день на массу один: самый дальний от тяжёлого из дней, где этого движения нет;
       при двух днях свободного дня не остаётся, и упражнение на массу встаёт в лёгкий день — после лёгких подходов */
    let massDays = SLOTS.filter(sl => (scratch || everyDay || slots[sl.id].length > 0) && !slots[sl.id].some(e => e.ex === focus || e.ex === lid)), joint = false;
    if (everyDay) {
      const home = SLOTS.find(sl => slots[sl.id].some(e => e.ex === focus))!, gap = (sl: Slot) => { const d = Math.abs(sl.dow - home.dow); return Math.min(d, 7 - d); }, T = now();
      if (massDays.length) massDays = [massDays.slice().sort((a, b) => (gap(b) - gap(a)) || (T.load[a.id] - T.load[b.id]))[0]];
      else { massDays = SLOTS.filter(sl => slots[sl.id].some(e => e.ex === lid)).slice(0, 1); joint = true; }
    }
    const lead = DAYS.week ? 'Третий день ' : joint ? 'Масса — вместе с лёгким днём, ' : 'День на массу — ';
    const tail = joint ? ' Дней в неделе два, отдельного дня на массу нет: упражнение стоит после лёгких подходов.' : DAYS.week ? ' Два дня движение идёт на силу, третий — на объём.' : ' Два дня движение идёт на силу, ещё один — на объём.';
    for (const sl of massDays) {
      const have = slots[sl.id].find(e => dp(e.ex) && hitsMain(e.ex) && !offMain(e.ex));
      if (have) { have.pin = true; note(lead + onDay(sl.id) + ': ' + nm(have.ex), 'Упражнение на те же мышцы в режиме массы: ' + rangeOf(done, c2, have.ex).join('–') + ' повторов почти до отказа. Оно уже стоит в этом дне.'); continue; }
      const cand = Object.keys(c2.ex).filter(id => dp(id) && !c2.ex[id].uni && hitsMain(id) && !offMain(id)).sort((a, b) => (inProg(b) - inProg(a)) || (like(b) - like(a)) || nm(a).localeCompare(nm(b), 'ru'))[0];
      if (!cand) continue;
      insert(sl, { ex: cand, n: 3, isNew: true, pin: true });
      note(lead + onDay(sl.id) + ': ' + nm(cand), '3 × ' + rangeOf(done, c2, cand).join('–') + ' почти до отказа: упражнение на те же мышцы в режиме массы.' + tail);
    }
  }
  if (!focus || inProg(focus)) {
    /* 8. the muscles: one common level, the priority group PRIO_K times higher —
          the highest level, up to the working zone, that the limits give to every muscle.
          Around a lift in priority the percentage lifts stand as they are and everything else is built the same way. */
    const prio: Record<string, number> = {}, tracked = MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id);
    if (group && !tracked.every(m => group.m.includes(m))) for (const m of group.m) if (!cfg.ignore[m]) prio[m] = 1;
    if (aimM.length && !tracked.every(m => aimM.includes(m))) for (const m of aimM) prio[m] = 1;   // (в эталоне нет) «Сила: <упражнение>»: мышцы цели в приоритете
    /* muscles left out of the count get nothing from the build: an exercise where such a muscle is a main mover leaves the programme
       (a percentage lift is never touched). The athlete gives such a muscle its sets by hand, with «+» in the volume table. */
    /* (в эталоне нет) базовые справочника, которые под «Силой» и в «Гибриде» «как подсобка» идут обычными многосуставными, получают подходы сразу:
       так их читает принятая программа (rules.ts, appCfg), и сразу после «Принять» сборка не меняет их число */
    if (roles && roles.plain) for (const sl of SLOTS) for (const e of slots[sl.id]) { const x = c2.ex[e.ex]; if (x && x.stored === 'cycle' && x.mode !== 'cycle' && !(+e.n! > 0)) e.n = BASE_SETS; }
    const offMain = (id: string) => Object.entries(mOf(id)).some(([m, c]) => c >= 1 && cfg.ignore[m]), gone: { ex: string; sl: Slot }[] = [];
    for (const sl of SLOTS) slots[sl.id] = slots[sl.id].filter(e => { const k = kindOf(c2, e.ex); if ((k !== 'compound' && k !== 'iso') || !offMain(e.ex)) return true; gone.push({ ex: e.ex, sl }); return false; });
    const empty = SLOTS.every(sl => !slots[sl.id].length);
    /* (в эталоне нет) в дне нет места ещё одному упражнению по два подхода: в нём девять упражнений, а с выбранным временем — оно уже не укладывается */
    const places = (L: ProgEntry[]) => L.reduce((a, e) => a + ((c2.ex[e.ex] || {} as ExDef).uni ? 0.5 : 1), 0);
    const crowded = (L: ProgEntry[]) => places(L) + 1 > (time ? TIME_EX.day : MAX_EX) + 0.6;   // (в эталоне нет) с выбранным временем — десять упражнений (rules.ts)
    const full = (L: ProgEntry[]) => crowded(L) || (!!time && !inTime(estMinutes(c2, L) + (60 + 2 * (40 + (appRules() ? REST.other : c2.rest || 120))) / 60, time));
    /* 8а. Выравнивание дней. (в эталоне нет) Дни 1…N: когда дней не три или в неделе появился новый день, тренировки выравниваются по длине —
           упражнение двойной прогрессии целиком переезжает из самого нагруженного дня в самый свободный, пока разница больше трёх подходов.
           Недельный объём мышц тот же; лимит на мышцу за тренировку не нарушается, и ни одна мышца не теряет тренировочный день.
           Базовые, лёгкие дни, закреплённое упражнение и парные стороны не трогаются.
           (в эталоне нет) С днями «День N» — при любом числе дней и по оценке времени, а не по подходам: пока самый длинный день дольше самого
           короткого больше чем на EVEN.min минут (просьба владельца, 25 ноября 2026; rules.ts, EVEN) */
    /* С днями «День N» дни выравниваются в каждой попытке уровня (attempt): поиск уровня видит выровненные дни — время, которое освободилось в длинном дне,
       идёт подходам, и сразу после «Принять» сборка не находит больше, чем предложила (просьба владельца, 25 ноября 2026) */
    type Ev = { evened: ProgEntry[]; text: string[]; shifted: Map<ProgEntry, number>; shiftText: Map<string, number> };
    const newEv = (): Ev => ({ evened: [], text: [], shifted: new Map(), shiftText: new Map() });   // shifted, shiftText — (в эталоне нет) подходы, переехавшие при выравнивании дней
    const byTime = appRules();
    const free = (e: ProgEntry) => { const k = kindOf(c2, e.ex); return !!e.n && (k === 'compound' || k === 'iso') && !e.pin && !c2.ex[e.ex].uni; };
    const insertIn = (L: ProgEntry[], e: ProgEntry) => {                 // как insert, для любой раскладки
      if (kindOf(c2, e.ex) === 'iso') { L.push(e); return; }
      let i = 0;
      L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light') i = j + 1; });
      L.splice(i || Math.min(1, L.length), 0, e);
    };
    const evenDays = (S: ProgSlots, lv: number, r: OptRes, ev: Ev) => {
      const shape = () => JSON.stringify(SLOTS.map(sl => S[sl.id].map(e => e.ex + ':' + (e.n || 0))));
      /* (в эталоне нет) выравнивание меняет дни после поиска, и поиск от выровненной раскладки (сразу после «Принять») находил бы шаги, которых не сделал:
         поэтому после выравнивания поиск идёт ещё раз на том же уровне, и снова выравнивание — пока раскладка меняется (не больше трёх раз) */
      for (let pass = 0; pass < 3; pass++) {
      if (pass) {
        const was = shape(), r2 = optimise(c2, S, { z, ignore: cfg.ignore, prio, budget, dayCap: caps.day, level: lv, allDays: scratch || everyDay, time }, define);
        r.cut = r.cut.concat(r2.cut); r.fold = r.fold.concat(r2.fold); r.left = r2.left; r.over = r2.over; r.once = r2.once; r.hit = r2.hit;
        if (shape() === was) break;
      }
      for (let g = 0; g < 60; g++) {
        const T1 = progTally(c2, S), len = (sl: Slot) => byTime ? estMinutes(c2, S[sl.id]) : T1.load[sl.id];
        const byLoad = SLOTS.slice().sort((a, b) => len(b) - len(a)), lo = byLoad[byLoad.length - 1];
        let hi = byLoad[0], diff = len(hi) - len(lo);
        if (diff <= (byTime ? EVEN.min : 3)) break;
        const got = (sl: Slot, m: string) => (T1.day[sl.id] || {} as Record<string, number>)[m] || 0;
        const trained = (m: string, dh: number, dl: number) => SLOTS.filter(sl => got(sl, m) + (sl === hi ? dh : sl === lo ? dl : 0) >= 2 - 0.01).length;   // дней, где мышце два подхода и больше
        /* сколько упражнение занимает в длинном дне: подходы, а с днями «День N» — минуты по оценке времени */
        const own = (e: ProgEntry) => byTime ? len(hi) - estMinutes(c2, S[hi.id].filter(x => x !== e)) : e.n!;
        const fits = (e: ProgEntry) => {
          if (own(e) >= diff || (time ? !inTime(estMinutes(c2, S[lo.id].concat([e])), time) || crowded(S[lo.id]) || !roomFor(S[lo.id], e.ex, mOf, prio, cfg.ignore, x => x.n!) : S[lo.id].length >= MAX_EX) || S[lo.id].some(x => x.ex === e.ex || sameMuscles(mOf(x.ex), mOf(e.ex)))) return false;   // и не туда, где уже стоит упражнение с теми же мышцами
          for (const [m, c] of Object.entries(mOf(e.ex))) {
            if (!(c > 0)) continue;
            if (got(lo, m) + c * e.n! > caps.day + 0.01) return false;
            if (cfg.ignore[m]) continue;
            /* (в эталоне нет) с днями «День N» мышца может отдать один из своих дней, если их и после переезда не меньше двух: требование —
               больше одного дня в неделю (решение владельца), а три дня из трёх — не требование. Иначе в трёх днях выравнивать почти нечем */
            if (byTime) { if (trained(m, -c * e.n!, c * e.n!) < Math.min(2, trained(m, 0, 0))) return false; continue; }
            if (got(hi, m) >= 2 - 0.01 && got(hi, m) - c * e.n! < 2 - 0.01 && (got(lo, m) >= 2 - 0.01 || got(lo, m) + c * e.n! < 2 - 0.01)) return false;   // мышца потеряла бы тренировочный день: длинный день её лишается, а короткий либо уже считался, либо до двух подходов не дотянет
          }
          return true;
        };
        /* (в эталоне нет) с днями «День N» переезжает и один подход: из упражнения длинного дня в то же упражнение короткого дня или в упражнение
           с теми же мышцами. Так выравниваются дни, где упражнения на каждую мышцу уже стоят в обоих днях (при двух днях — всегда) */
        const less = (L: ProgEntry[], e: ProgEntry) => estMinutes(c2, L.map(x => x === e ? Object.assign({}, x, { n: x.n! - 1 }) : x));
        const oneSet = (e: ProgEntry) => len(hi) - less(S[hi.id], e);
        const into = (e: ProgEntry) => S[lo.id].find(x => free(x) && x.n! < MAX_SETS && (x.ex === e.ex || sameMuscles(mOf(x.ex), mOf(e.ex)))) || null;
        const shifts = (e: ProgEntry, x: ProgEntry) => {
          if (oneSet(e) >= diff || (time && !inTime(estMinutes(c2, S[lo.id].map(y => y === x ? Object.assign({}, y, { n: y.n! + 1 }) : y)), time))) return false;
          for (const [m, c] of Object.entries(mOf(e.ex))) {
            if (!(c > 0)) continue;
            if (got(lo, m) + c > caps.day + 0.01) return false;
            if (cfg.ignore[m]) continue;
            if (trained(m, -c, c) < Math.min(2, trained(m, 0, 0))) return false;
            /* второе упражнение на мышцу в дне — когда в первом от трёх подходов (rules.ts, TIME_EX): у упражнения, рядом с которым на ту же мышцу есть другое, их не меньше трёх */
            if (time && c >= 1 && e.n! - 1 < TIME_EX.next && S[hi.id].some(y => y !== e && (mOf(y.ex)[m] || 0) >= 1)) return false;
          }
          return true;
        };
        /* (в эталоне нет) с днями «День N» упражнения меняются днями: упражнение длинного дня уходит в короткий, а упражнение короткого с меньшим числом подходов —
           в длинный. Так выравниваются дни, когда в коротком дне уже десять упражнений и новому места нет. Проверки — те же, что у переезда целиком */
        const swaps = (e: ProgEntry, f: ProgEntry) => {
          const H = S[hi.id].map(x => x === e ? f : x), L = S[lo.id].map(x => x === f ? e : x), t = len(hi) - estMinutes(c2, H);
          if (!(t > 0.01) || t >= diff || !(Math.abs(estMinutes(c2, H) - estMinutes(c2, L)) < diff - 0.01) || (time && !inTime(estMinutes(c2, L), time))) return null;
          const clash = (D: ProgEntry[], a: ProgEntry) => D.some(x => x !== a && (x.ex === a.ex || sameMuscles(mOf(x.ex), mOf(a.ex))));
          if (clash(L, e) || clash(H, f)) return null;
          if (time && (!roomFor(L.filter(x => x !== e), e.ex, mOf, prio, cfg.ignore, x => x.n!) || !roomFor(H.filter(x => x !== f), f.ex, mOf, prio, cfg.ignore, x => x.n!))) return null;
          const after = (sl: Slot, m: string) => got(sl, m) + (sl === hi ? 1 : sl === lo ? -1 : 0) * ((mOf(f.ex)[m] || 0) * f.n! - (mOf(e.ex)[m] || 0) * e.n!);
          for (const m of new Set(Object.keys(mOf(e.ex)).concat(Object.keys(mOf(f.ex))))) {
            if (after(hi, m) > Math.max(caps.day, got(hi, m)) + 0.01 || after(lo, m) > Math.max(caps.day, got(lo, m)) + 0.01) return null;
            if (!cfg.ignore[m] && SLOTS.filter(sl => after(sl, m) >= 2 - 0.01).length < Math.min(2, trained(m, 0, 0))) return null;
          }
          return t;
        };
        const find = () => {
          const moves: { e: ProgEntry; to: ProgEntry | null; with?: ProgEntry; t: number }[] = S[hi.id].filter(e => free(e) && fits(e)).map(e => ({ e, to: null, t: own(e) }));
          if (byTime) for (const e of S[hi.id]) { if (!free(e) || e.n! <= 2) continue; const x = into(e); if (x && shifts(e, x)) moves.push({ e, to: x, t: oneSet(e) }); }
          if (byTime && !moves.length) for (const e of S[hi.id]) for (const f of S[lo.id]) { if (!free(e) || !free(f) || f.n! >= e.n!) continue; const t = swaps(e, f); if (t != null) moves.push({ e, to: null, with: f, t }); }
          return moves.sort((a, b) => Math.abs(diff / 2 - a.t) - Math.abs(diff / 2 - b.t))[0] || null;
        };
        let mv = find();
        /* (в эталоне нет) с днями «День N»: из самого длинного дня переносить нечего — в короткий день идёт что-то из следующего по длине: короткий день растёт, разница сжимается */
        if (!mv && byTime) for (const src of byLoad.slice(1, -1)) { hi = src; diff = len(hi) - len(lo); if (diff <= 0.01) break; mv = find(); if (mv) break; }
        if (!mv) break;
        const whole = (cand: ProgEntry, from: Slot, to: Slot) => {
          S[from.id].splice(S[from.id].indexOf(cand), 1);
          const src = cand.isNew ? cand.from : from.id;                  // новое упражнение ниоткуда не переезжало: о нём скажет заметка «Новое …»
          if (src && src !== to.id && (cur[src] || []).some(x => x.ex === cand.ex)) ev.text.push(nm(cand.ex) + ' (' + SLOT[src].s.toLowerCase() + ' → ' + to.s.toLowerCase() + ')');
          if (!cand.isNew) { cand.isNew = true; cand.from = from.id; }
          insertIn(S[to.id], cand); ev.evened.push(cand);
        };
        if (mv.with) { whole(mv.e, hi, lo); whole(mv.with, lo, hi); continue; }
        if (mv.to) {
          const e = mv.e, x = mv.to;
          e.n!--; e.chg = (e.chg || 0) - 1; x.n!++; x.chg = (x.chg || 0) + 1;
          /* переезд подхода назван, когда оба упражнения уже стояли в программе; у нового упражнения его подходы называет заметка «Новое …», а у прежнего — прибавка или убавка */
          if (!e.isNew && !x.isNew) {
            ev.shifted.set(e, (ev.shifted.get(e) || 0) - 1); ev.shifted.set(x, (ev.shifted.get(x) || 0) + 1);
            const k = nm(e.ex) + (x.ex !== e.ex ? ' → ' + nm(x.ex) : '') + ' (' + hi.s.toLowerCase() + ' → ' + lo.s.toLowerCase() + ')'; ev.shiftText.set(k, (ev.shiftText.get(k) || 0) + 1);
          }
          continue;
        }
        whole(mv.e, hi, lo);
      }
      }
    };
    let start = clone(slots);
    let why = null as string | null, pick = null as { level: number; res: OptRes; slots: ProgSlots; ev: Ev } | null;
    const tried: Record<number, { res: OptRes; slots: ProgSlots; ev: Ev }> = {};   // (в эталоне нет) последняя попытка каждого уровня: по ней видно, что остановило следующий
    const attempt = (lv: number) => {
      const trial = clone(start), r = optimise(c2, trial, { z, ignore: cfg.ignore, prio, budget, dayCap: caps.day, level: lv, allDays: scratch || everyDay, time }, define), ev = newEv();
      if (byTime) evenDays(trial, lv, r, ev);                            // (в эталоне нет) с днями «День N» уровень судится по выровненным дням
      if (!pick) why = r.hit;
      tried[lv] = { res: r, slots: trial, ev };
      if (!pick || r.left.length < pick.res.left.length || (r.left.length === pick.res.left.length && lv > pick.level)) pick = { level: lv, res: r, slots: trial, ev };
      return { ok: !r.left.length, trial };
    };
    const aim = strong || solo ? Math.max(z.min, z.opt - STRONG.under) : z.opt;   // в силовом режиме и в силе в одном базовом подсобка целится ниже рабочей зоны
    const first = attempt(aim);
    if (!first.ok && aim > z.min) {
      /* the next guess: what the weakest muscle reached, a priority one counted at its share */
      const pv = progTally(c2, first.trial).pv, low = Math.min(...tracked.map(m => (pv[m] || 0) / (prio[m] ? PRIO_K : 1)));
      let lv = Math.max(z.min, Math.min(aim - 1, Math.floor(low + 0.75)));
      if (attempt(lv).ok) { while (lv + 1 < aim && attempt(lv + 1).ok) lv++; }
      else while (lv > z.min && !attempt(--lv).ok);
    }
    /* (в эталоне нет) Дни 1…N, неделя перекладывается под другое число дней (то же условие, что у шага 8а): поиск идёт от раскладки, сложенной
       под прежнее число дней, и первый проход часто останавливается на уровне ниже достижимого — сразу после «Принять» та же сборка давала заметно
       больше. Поэтому поиск повторяется от найденной раскладки, пока общий уровень растёт (не больше четырёх раз) */
    if (reshape && !pick!.res.left.length && pick!.level < aim) for (let k = 0; k < 4; k++) {
      const was = pick!.level, cutWas = pick!.res.cut, foldWas = pick!.res.fold;
      start = clone(pick!.slots);
      const again = attempt(aim);
      if (!again.ok && aim > z.min) {
        const pv = progTally(c2, again.trial).pv, low = Math.min(...tracked.map(m => (pv[m] || 0) / (prio[m] ? PRIO_K : 1)));
        let lv = Math.max(was + 1, Math.min(aim - 1, Math.floor(low + 0.75)));
        if (lv < aim) { if (attempt(lv).ok) { while (lv + 1 < aim && attempt(lv + 1).ok) lv++; } else while (lv > was + 1 && !attempt(--lv).ok); }
      }
      if (pick!.level === was) break;
      pick!.res.cut = cutWas.concat(pick!.res.cut); pick!.res.fold = foldWas.concat(pick!.res.fold);
    }
    /* (в эталоне нет) с выбранным временем в «Массе» и «Гибриде» время заполняется подходами (решение владельца, 25 ноября 2026; rules.ts, fillTop):
       уровень растёт выше начала рабочей зоны, пока все мышцы его достают, дни укладываются во время и неделя — в лимит */
    const lv0 = pick!.level, top = time && !strong && !solo ? fillTop(z, Object.keys(prio).length > 0, PRIO_K) : 0, over0 = (pick!.res.over || []).length;
    if (top && !pick!.res.left.length && lv0 >= aim) {
      /* каждый следующий уровень ищется сначала от раскладки предыдущего (так быстрее и обычно лучше), а не вышло — от исходной, как остальные уровни;
         уровень не берётся, если у него больше мышц заметно выше своего уровня, чем у начального: «Равномерно» остаётся равномерным */
      const start0 = start, good = () => !pick!.res.left.length && (pick!.res.over || []).length <= over0;
      for (let lv = lv0 + 1; lv <= top; lv++) {
        const was = pick!;
        start = start0;
        attempt(lv);
        if (pick !== was && good()) continue;
        pick = was; start = clone(was.slots);
        attempt(lv);
        if (pick !== was && good()) { pick!.res.cut = was.res.cut.concat(pick!.res.cut); pick!.res.fold = was.res.fold.concat(pick!.res.fold); continue; }
        pick = was; break;
      }
      start = start0;
    }
    /* (в эталоне нет) с выбранным временем на тренировку каждая мышца — хотя бы два дня в неделю (решение владельца: «мышца должна все эти дни тренироваться»).
       Время заполняется подходами раньше, чем второй день достаётся всем мышцам; если уровнем-тремя ниже второй день помещается всем, берётся он */
    const thin = (r: OptRes, sl: ProgSlots) => { const D = progTally(c2, sl).day; return (r.once || []).filter(m => !(solo && ((cfg.ex[focus!].m || {})[m] || 0) >= 1) && SLOTS.filter(x => ((D[x.id] || {} as Record<string, number>)[m] || 0) >= 2 - 0.01).length < 2); };
    let thinUp: string[] = [];                                         // у них уровнем выше был бы один день в неделю: поэтому уровень ниже
    const up = time && !pick!.res.left.length ? thin(pick!.res, pick!.slots) : [];
    if (up.length) for (let lv = pick!.level - 1; lv >= Math.max(z.min, Math.min(lv0, pick!.level) - 3); lv--) {   // (в эталоне нет) после заполнения времени — до тех же трёх уровней ниже, что и без него
      attempt(lv);
      const t = tried[lv];
      if (!t.res.left.length && !thin(t.res, t.slots).length) { pick = { level: lv, res: t.res, slots: t.slots, ev: t.ev }; thinUp = up; break; }
    }
    const level = pick!.level, res = pick!.res;
    for (const sl of SLOTS) slots[sl.id] = pick!.slots[sl.id];
    for (const id of Object.keys(create)) if (!SLOTS.some(sl => slots[sl.id].some(e => e.ex === id))) { delete create[id]; delete c2.ex[id]; }
    if (empty || scratch) { const rank = (e: ProgEntry) => { const k = kindOf(c2, e.ex); return k === 'base' || k === 'light' ? 0 : k === 'compound' ? 1 : 2; }; for (const sl of SLOTS) slots[sl.id] = slots[sl.id].map((e, i) => ({ e, i })).sort((a, b) => (rank(a.e) - rank(b.e)) || (a.i - b.i)).map(x => x.e); }
    /* 8а. Выравнивание дней после поиска — когда неделя перекладывается под другое число дней без правил приложения; с днями «День N» дни уже выровнены
       в попытке уровня (evenDays в attempt) */
    const ev = pick!.ev;
    if (reshape && !byTime) evenDays(slots, level, res, ev);
    const evened = ev.evened, shifted = ev.shifted;
    for (const id of Object.keys(create)) if (!SLOTS.some(sl => slots[sl.id].some(e => e.ex === id))) { delete create[id]; delete c2.ex[id]; }
    const shiftList = [...ev.shiftText].map(([k, n]) => k.replace(/\)$/, ', ' + nSets(n) + ')'));
    if (ev.text.length || shiftList.length) note('Дни выровнены по длине', ev.text.concat(shiftList).join(', ') + '. ' + (byTime ? 'Упражнение или подход переезжает из самого длинного дня в самый короткий, пока разница между ними больше ' + EVEN.min + ' минут' : 'Упражнение целиком переехало из самого длинного дня в самый короткий') + ': объём за неделю тот же, меняется только день.');
    const T = now(), tot = SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0);
    const names = (ids: string[]) => list(ids.map(m => MUSCLE[m].n.toLowerCase()));
    const spanOf = (ids: string[]) => { const v = ids.map(m => T.pv[m] || 0), a = fmt(Math.min(...v), 1), b = fmt(Math.max(...v), 1); return a === b ? a : 'от ' + a + ' до ' + b; };
    const pm = tracked.filter(m => prio[m]), rest = tracked.filter(m => !prio[m]), half = rest.filter(m => (T.pv[m] || 0) < z.opt - 0.01);
    let noRoom = (time ? 'в ' + fmtDur(time) + ' на тренировку больше не помещается' : 'в днях уже по девять упражнений по пять подходов') + ' или мешает лимит ' + caps.day + ' подходов на мышцу за тренировку', roomFix = '';
    /* (в эталоне нет) с днями «День N» причина, по которой общий уровень не выше, — та, что остановила следующий уровень, а не первая попытка:
       иначе при свободных подходах заметка советовала увеличить лимит недели (решение владельца, 23 ноября 2026). Когда следующему уровню
       мешает не лимит, заметка называет мышцы, которые выше не поднять, и что поможет */
    const next = appRules() && !res.left.length ? tried[level + 1] : undefined;
    /* (в эталоне нет) с выбранным временем дни бывают полны и по числу упражнений (десять, rules.ts): тогда так и сказано, а большее время не советуется */
    const packedBy = (S: ProgSlots) => !!time && SLOTS.every(sl => crowded(S[sl.id])), longIn = (S: ProgSlots) => packedBy(S) ? 'в каждой тренировке уже по десять упражнений' : long;
    const helpsIn = (S: ProgSlots) => [SLOTS.length < 4 ? 'ещё один тренировочный день' : '', moreT && !packedBy(S) ? 'время на тренировку от ' + fmtDur(moreT) : ''].filter(Boolean);
    const helps = helpsIn(next ? next.slots : slots), used = ' Лимит недели тут ни при чём: занято ' + nSets(+tot.toFixed(1)) + ' из ' + budget + '.';
    if (thinUp.length) {
      /* (в эталоне нет) уровень взят ниже ради второго дня: так и сказано */
      why = 'full';
      noRoom = 'уровнем выше у части мышц (' + names(thinUp) + ') остался бы один день в неделю, а в ' + fmtDur(time) + ' на тренировку не помещается и то и другое';
      roomFix = used + ' Поможет ' + (helps.length ? helps.join(' или ') : 'замена упражнений вручную') + '.';
    } else if (next && next.res.hit) {
      why = next.res.hit;
      const short = next.res.left, packed = SLOTS.every(sl => full(next.slots[sl.id]));
      if (why === 'full' && short.length) {
        noRoom = names(short) + ' выше не поднять — ' + (packed ? longIn(next.slots) : 'упражнения на ' + (short.length > 1 ? 'них' : 'неё') + ' уже по пять подходов или упираются в лимит ' + caps.day + ' подходов на мышцу за тренировку');
        roomFix = used + ' Поможет ' + (packed ? (helps.length ? helps.join(' или ') : 'замена упражнений вручную') : 'ещё одно упражнение на ' + (short.length > 1 ? 'эти мышцы' : 'эту мышцу') + ' в справочнике') + '.';
      }
    }
    const plus = ' Точечно прибавить или убавить мышце можно кнопками «+» и «−» в таблице объёма.', sum = ' Всего ' + nSets(+tot.toFixed(1)) + ' при лимите ' + budget + '.';
    const lower = why === 'budget' ? 'Лимита ' + budget + ' подходов в неделю не хватает, чтобы довести все мышцы до рабочей зоны (от ' + z.opt + ')' : 'До рабочей зоны (от ' + z.opt + ') все мышцы разом не дотянуть: ' + noRoom;
    const nearly = 'Почти все мышцы в рабочей зоне (от ' + z.opt + '). На полподхода не дотягивают: ' + names(half) + ' — косвенная нагрузка считается половинами, поэтому ровно не сходится.';
    /* (в эталоне нет) время заполнено подходами (rules.ts, fillTop): заметка говорит, до какого уровня и что не дало подняться выше */
    let filled = '';
    if (top && level > aim) {
      const nx = tried[level + 1], stop = thinUp.length ? 'Уровнем выше у части мышц (' + names(thinUp) + ') остался бы один день в неделю.'
        : level >= top ? (pm.length ? 'Выше не поднимается: у приоритета потолок ' + (z.high - 2) + ' подходов, и с остальными выше ' + level + ' он перестал бы быть в полтора раза больше.' : 'Выше не поднимается: это верх рабочей зоны (до ' + z.high + ').')
        : !nx ? ''
        : nx.res.hit === 'budget' ? 'Выше не даёт лимит ' + budget + ' подходов в неделю.'
        : nx.res.left.length ? names(nx.res.left) + ' выше не поднять — ' + (SLOTS.every(sl => full(nx.slots[sl.id])) ? longIn(nx.slots) : 'упражнения на ' + (nx.res.left.length > 1 ? 'них' : 'неё') + ' уже по пять подходов или упираются в лимит ' + caps.day + ' подходов на мышцу за тренировку') + '.'
        : (nx.res.over || []).length > over0 ? 'Уровнем выше — перекос: ' + names(nx.res.over!) + ' заметно выше остальных.' : '';
      filled = ' Время на тренировку заполнено подходами: общий уровень поднят с ' + z.opt + ' до ' + level + ' подходов в неделю' + (pm.length ? ', у приоритета — до ' + Math.min(z.high - 2, Math.round(level * PRIO_K)) : '') + ', пока каждая тренировка укладывается в ' + fmtDur(time) + '.' + (stop ? ' ' + stop.charAt(0).toUpperCase() + stop.slice(1) : '');
    }
    const oneMore = DAYS.week ? 'четвёртый тренировочный день' : SLOTS.length < 4 ? 'ещё один тренировочный день' : '';   // при четырёх днях добавлять уже нечего
    const stuck = () => note('Не дотянуты: ' + names(res.left), res.hit === 'budget' ? 'Лимит ' + budget + ' подходов в неделю исчерпан. Чтобы закрыть остальное, нужен больший лимит' + (oneMore ? ' или ' + oneMore : '') + '.' : 'Добавлять некуда: ' + noRoom + '. Поможет ' + (oneMore ? oneMore + ' или ' : '') + 'замена упражнений вручную.');
    if (strong || solo) {
      if (res.left.length) stuck();
      /* (в эталоне нет) «Сила: <упражнение>» с днями «День N»: мышцы цели — в полтора раза выше остальных (решение владельца, 24 ноября 2026, пункт 8) */
      else if (pm.length) note('Мышцы цели — ' + spanOf(pm) + ', остальные — ' + spanOf(rest) + ' подходов в неделю', 'Мышцы цели (' + names(pm) + ') получают примерно в полтора раза больше остальных: сила движения растёт и с его мышцами — это тренерское правило. Остальная подсобка целится ниже рабочей зоны — в ' + aim + ' подходов в неделю вместо ' + z.opt + ': место в неделе и силы на восстановление отданы цели. Набранное при этом не уходит — по исследованиям для этого хватает и трети объёма, — но растут мышцы медленнее, чем в рабочей зоне.'
        + (level < aim ? ' До ' + aim + ' все мышцы разом не дотянуть: ' + (why === 'budget' ? 'не хватает лимита ' + budget + ' подходов в неделю' : noRoom) + ', поэтому уровни ниже, пропорция та же.' + roomFix : '') + sum + plus);
      else note('Подсобка — ' + spanOf(tracked) + ' подходов на мышцу', 'В силовом режиме подсобка целится ниже рабочей зоны — в ' + aim + ' подходов в неделю вместо ' + z.opt + ': место в неделе и силы на восстановление отданы базовым. Набранное при этом не уходит — по исследованиям для этого хватает и трети объёма, — но растут мышцы медленнее, чем в рабочей зоне.'
        + (level < aim ? ' До ' + aim + ' все мышцы разом не дотянуть: ' + (why === 'budget' ? 'не хватает лимита ' + budget + ' подходов в неделю' : noRoom) + ', поэтому уровень общий, но ниже.' + roomFix : '') + sum + plus);
    } else if (!pm.length) {
      const span = spanOf(tracked);
      if (res.left.length) stuck();
      else if (level < z.opt) note('Нагрузка поровну: ' + span + ' подходов на мышцу', lower + (why === 'budget' ? ', поэтому он разделён поровну. Чтобы поднять общий уровень, увеличь лимит недели.' : '. Поэтому уровень общий, но ниже.' + roomFix) + plus);
      else if (half.length) note('Нагрузка поровну: ' + span + ' подходов на мышцу', nearly + filled + sum + plus);
      else note('Все мышцы в рабочей зоне, поровну', 'Каждая мышца в цели получает ' + span + ' подходов в неделю, ни одна не выделяется.' + filled + sum);
    } else {
      const share = 'Приоритетные мышцы (' + names(pm) + ') получают примерно в полтора раза больше остальных, но не больше: каждый следующий подход прибавляет всё меньше, а остальным мышцам нужен свой объём. Остальные делят объём поровну. ';
      if (res.left.length) stuck();
      else note('Приоритет — ' + spanOf(pm) + ', остальные мышцы — ' + spanOf(rest) + ' подходов в неделю', share + (level < z.opt ? lower + (why === 'budget' ? ': уровни ниже, пропорция та же. Чтобы поднять всех, увеличь лимит недели.' : '. Уровни ниже, пропорция та же.' + roomFix) + plus
        : (half.length ? nearly : 'Все мышцы в рабочей зоне (от ' + z.opt + ').') + filled + sum));
    }
    if (res.over!.length) note('Чуть выше своего уровня: ' + names(res.over!), 'Эти мышцы работают попутно почти во всех упражнениях на соседние или ' + (appRules() ? 'в базовых, где число подходов постоянное' : 'в упражнениях по процентам, где число подходов задаёт волна') + '. Убрать у них ещё — значит недодать соседям.');
    /* у лёгкого дня числа подходов и диапазона нет: в эталоне его строка читается как «undefined × 8–12». С днями «День N» её нет — о лёгком дне сказано своей заметкой */
    for (const sl of SLOTS) for (const e of slots[sl.id]) if (e.isNew && !e.from && !(everyDay && isLight(c2, e.ex))) {
      const ms = Object.entries(mOf(e.ex)).filter(x => x[1] >= 1).map(x => x[0]);
      note('Новое ' + onDay(sl.id) + ': ' + nm(e.ex), e.n + ' × ' + rangeOf(done, c2, e.ex).join('–') + '. ' + ms.map(m => MUSCLE[m].n + ': было ' + fmt(before.pv[m] || 0, 1) + ', станет ' + fmt(T.pv[m] || 0, 1) + ' в неделю').join('; ') + '.');
    }
    const ownChg = (e: ProgEntry) => (e.chg || 0) - (shifted.get(e) || 0);   // (в эталоне нет) без подходов, переехавших при выравнивании дней: о них своя заметка
    const moved = (k: number) => SLOTS.flatMap(sl => slots[sl.id].filter(e => (!e.isNew || (!!e.from && evened.includes(e))) && (k > 0 ? ownChg(e) > 0 : ownChg(e) < 0)).map(e => nm(e.ex) + ' (' + sl.s.toLowerCase() + ') ' + signed(ownChg(e))));
    if (moved(1).length) note('Прибавлены подходы', moved(1).join(', ') + '.');
    if (moved(-1).length) note('Убраны подходы', moved(-1).join(', ') + '. Эти мышцы получали заметно больше, чем им отведено.');
    if (gone.length) {
      const off = MUSCLES.filter(m => cfg.ignore[m.id] && gone.some(g => (mOf(g.ex)[m.id] || 0) >= 1)).map(m => m.id), byEx: Record<string, string[]> = {};
      for (const g of gone) (byEx[g.ex] = byEx[g.ex] || []).push(g.sl.s.toLowerCase());
      note('Мышцы вне расчёта: ' + names(off) + ' — без подходов', 'Убрано: ' + Object.entries(byEx).map(([id, d]) => nm(id) + ' (' + d.join(', ') + ')').join(', ') + '. В этих упражнениях основная мышца — вне расчёта, а таким мышцам сборка подходы не даёт. Нужны — прибавь кнопкой «+» у мышцы в таблице объёма.');
    }
    /* frequency: what was carried over to another day, and the muscles that still have one day only */
    const carried = SLOTS.flatMap(sl => slots[sl.id].filter(e => e.from && e.from !== sl.id && !evened.includes(e)).map(e => nm(e.ex) + ' (' + SLOT[e.from!].s.toLowerCase() + ' → ' + sl.s.toLowerCase() + ')'));
    if (carried.length) note('Перенесено на другой день', carried.join(', ') + '. Чтобы каждая мышца получала нагрузку хотя бы в два дня недели: объём за неделю тот же, меняется только день.');
    /* в силе в одном базовом его основные мышцы работают в каждой тренировке: лёгкий день даёт им меньше двух подходов в счёте объёма, но днём без нагрузки его не назвать */
    const once = (res.once || []).filter(m => !(solo && ((cfg.ex[focus!].m || {})[m] || 0) >= 1) && SLOTS.filter(sl => ((T.day[sl.id] || {} as Record<string, number>)[m] || 0) >= 2 - 0.01).length < 2);
    /* (в эталоне нет) дни «День N»: когда во всех днях уже по девять упражнений (с выбранным временем — когда в него больше не помещается), мешает не лимит атлета,
       а длина тренировки — так и сказано. С выбранным временем заметка называет и следующее время из списка */
    if (once.length && everyDay && SLOTS.every(sl => full(slots[sl.id]))) {
      const can = ['добавить подход кнопкой «+» у мышцы', 'перенести упражнение вручную', SLOTS.length < 4 ? 'выбрать больше дней в неделю' : '', moreT && !packedBy(slots) ? 'выбрать время на тренировку от ' + fmtDur(moreT) : ''].filter(Boolean);
      note('Один день в неделю: ' + names(once), 'Второй день для этих мышц не поместился: ' + (time ? longIn(slots) + '.' : long + ', больше дневник в один день не ставит.') + ' Можно ' + can.slice(0, -1).join(', ') + ' или ' + can[can.length - 1] + '.');
    }
    else if (once.length) note('Один день в неделю: ' + names(once), 'Второй день для этих мышц не поместился: мешает лимит недели или дня, а переносить упражнения дальше — значит ломать баланс объёма. Можно добавить подход кнопкой «+» у мышцы или перенести упражнение вручную.');
    res.cut = res.cut.filter(c => !SLOTS.some(sl => slots[sl.id].some(e => e.ex === c.ex && e.from === c.sl.id)));
    if (res.cut.length) note('Убрано из программы', res.cut.map(c => nm(c.ex) + ' (' + c.sl.s.toLowerCase() + ')').join(', ') + ': эти упражнения давали лишнее мышцам, которые и так выше своего уровня, или не помещались в лимит недели' + (time ? ' либо в ' + fmtDur(time) + ' на тренировку' : '') + '.');
    /* (в эталоне нет) вывод 8 аудита: что из программы атлета слилось с другим упражнением того же дня */
    const folded = (res.fold || []).filter(f => f.was && slots[f.sl.id].some(e => e.ex === f.into) && !slots[f.sl.id].some(e => e.ex === f.ex));
    if (folded.length) note('Одно упражнение вместо двух', folded.map(f => nm(f.into) + ' (' + f.sl.s.toLowerCase() + ') +' + f.n + ' вместо ' + nm(f.ex)).join(', ') + '. В длинном дне подходы на мышцу собраны в одно упражнение: для роста считаются подходы, а каждое упражнение — это ещё разминка и настройка снаряда.');
  }

  /* (в эталоне нет) Порядок упражнений в дне (решение владельца, 24 ноября 2026, вопрос сборки 13; rules.ts, dayOrder): первым движение цели «Гибрида» и «Силы: …»
     (тяжёлый или лёгкий день — как и было: «лёгкий день встаёт первым»), за ним базовое дня, лёгкие дни силового режима, упражнения мышц в приоритете
     и закреплённое «на массу»; на каждой ступени многосуставные до изоляции; соседние упражнения — на разные основные мышцы.
     Заметка называет дни, где сборка переставила то, что в них уже стояло; новое упражнение и так отмечено «новое» */
  /* (в эталоне нет) под «Силой» по проценту идёт только цель: базовые справочника, которые стояли в программе базовыми, теперь обычные многосуставные
     (решение владельца, 24 ноября 2026, пункт 8) */
  if (roles && roles.plain) {
    const off = [...new Set(all().map(e => e.ex))].filter(id => cfg.ex[id] && cfg.ex[id].stored === 'cycle' && cfg.ex[id].mode !== 'cycle' && cfg0.ex[id] && cfg0.ex[id].mode === 'cycle');
    if (off.length) note(list(off.map(nm)) + ' — по двойной прогрессии', (opts.strength ? 'Под «Силой»' : 'В «Гибриде» с остальными базовыми «как подсобка»') + ' по проценту идёт только цель. ' + (off.length > 1 ? 'Остальные базовые — обычные многосуставные' : 'Это базовое — обычное многосуставное') + ': ' + TYPE.compound.lo + '–' + (TYPE.compound.lo + TYPE.compound.w) + ' повторов ' + rirText(cfg, off) + ', после цели, подходов — сколько нужно мышцам.');
  }
  if (appRules()) {
    const own = MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id), pm = group && !own.every(m => group.m.includes(m)) ? group.m.filter(m => !cfg.ignore[m]) : aimM.length && !own.every(m => aimM.includes(m)) ? aimM : [];
    const mains = (e: ProgEntry) => Object.entries(mOf(e.ex)).filter(x => x[1] >= 1).map(x => x[0]);
    const tier = (e: ProgEntry) => { const k = kindOf(c2, e.ex); return focus && (e.ex === focus || e.ex === focus + '_light' || e.ex === focus + '_mid') ? ORDER.goal : k === 'base' ? ORDER.base : k === 'light' ? ORDER.light : (e.pin || mains(e).some(m => pm.includes(m)) ? ORDER.prio : ORDER.rest) + (k === 'iso' ? 1 : 0); };
    const side = (e: ProgEntry) => (c2.ex[e.ex] || {} as ExDef).uni ? JSON.stringify(Object.entries(mOf(e.ex)).sort()) : null;
    const turned: string[] = [];
    for (const sl of SLOTS) {
      const L = slots[sl.id], to = dayOrder(L, tier, mains, side);
      if (to === L) continue;
      slots[sl.id] = to;
      const had = (cur[sl.id] || []).map(e => e.ex), seq = (A: ProgEntry[]) => A.filter(e => had.includes(e.ex)).map(e => e.ex).join();
      if (seq(L) !== seq(to)) turned.push(sl.s.toLowerCase());
    }
    const up = pm.length ? (aimM.length ? ', затем упражнения на мышцы цели' : ', затем упражнения на мышцы в приоритете') : SLOTS.some(sl => slots[sl.id].some(e => e.pin)) ? ', затем упражнение на массу' : '';
    if (turned.length) note('Порядок упражнений: ' + list(turned), 'Сначала ' + (focus ? nm(focus).toLowerCase() + (solo && byRole ? '' : ', затем остальные базовые') : tri ? 'тяжёлый день движения тройки, затем лёгкий' : 'базовое дня') + up + ', многосуставные — раньше изоляции, соседние упражнения — на разные мышцы. По исследованиям в упражнении ближе к началу тренировки больше повторов и сильнее растёт сила; чередование мышц — правило дневника. Свой порядок — в «Вручную»: там сборка его не трогает.');
  }
  /* the first weights: named in the settings, or to be found in the first workout */
  if (!opts.manual) {
    const ids = [...new Set(SLOTS.flatMap(sl => slots[sl.id].map(e => e.ex)))].filter(id => !lastSessionItem(done, isLight(c2, id) ? c2.ex[id].of! : id, null, null));
    const got = ids.map(id => ({ id, s: startOf(done, c2, id) })).filter(x => x.s), none = ids.filter(id => !got.some(x => x.id === id) && !isLight(c2, id));
    if (got.length) note('Стартовые веса — из «Настройки»', got.map(x => nm(x.id) + ' — ' + fmt(x.s!.w) + ' кг' + (x.s!.pct ? ' (' + x.s!.pct + '% от максимума ' + fmt(x.s!.tm, 1) + ')' : x.s!.src === 'max' ? ' (от разового максимума)' : '')).join('; ') + '. Первая тренировка начнётся с них, дальше веса ведёт журнал.');
    if (none.length && (got.length || done.length === 0)) note('Вес пока не задан: ' + none.length + ' ' + plural(none.length, ['упражнение', 'упражнения', 'упражнений']), list(none.map(nm)) + '. Его можно подобрать на первой тренировке — или указать рабочий вес либо разовый максимум в «Настройке» → «Известные веса», тогда дневник поставит его сам.');
  }
  /* базовые, поставленные шагом 0, помечаются новыми только теперь: заметку «Новое …» с числом подходов им писать не из чего, о них сказано выше */
  for (const sl of SLOTS) for (const e of slots[sl.id]) if (put.includes(e.ex)) { e.isNew = true; if (movedFrom[e.ex] && movedFrom[e.ex] !== sl.id) e.from = movedFrom[e.ex]; }
  if (solo) for (const sl of SLOTS) for (const e of slots[sl.id]) if ((e.ex === focus + '_light' || e.ex === focus + '_mid') && !cur[sl.id].some(x => x.ex === e.ex)) e.isNew = true;
  const sig = (S: ProgSlots) => SLOTS.map(sl => (S[sl.id] || []).map(e => e.ex + ':' + (e.n || '')).join(',')).join('|');
  /* (в эталоне нет) с днями «День N» программа та же, только если и роли те же: цель и то, идут ли остальные базовые обычными упражнениями */
  const rk = (R: Roles | null) => R ? R.on.slice().sort().join() + (R.plain ? '+' : '') : '';
  const same = !away.length && sig(slots) === sig(cur) && Object.keys(goals).every(id => (goalOf(cfg0, id) || null) === goals[id]) && (!byRole || rk(programRoles(cfg0.program)) === rk(roles));
  return { focus, others: focus ? (roles && roles.plain && !solo ? 'plain' : hold ? 'hold' : 'grow') : null, prio: group ? group.id : '', budget, strength: strong || solo, name: tri ? 'Сила: пауэрлифтерская тройка' : solo ? 'Сила: ' + nm(focus!).toLowerCase() : focus ? 'Пауэрбилдинг: ' + nm(focus).toLowerCase() : strong ? 'Сила: базовые два раза в неделю' : group ? 'Приоритет: ' + group.n.toLowerCase() : 'Равномерно на всё тело', slots, cur, goals, create, notes, cfg: c2, before, after: now(), same, away: awaySets, dropped, dropFrom, triad: tri ? aims.slice() : null };
}

export type OptRes = ReturnType<typeof optimise>;
