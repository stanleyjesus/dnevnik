/* Поправки дневника поверх правил атлета.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { MUSCLE, MUSCLES, SLOTS } from './catalog.ts';
import { dnum, fmtDate } from './dates.ts';
import { fmt, nSets, plural } from './format.ts';
import { clone } from './records.ts';
import { exName, isCycle, isLight, kindOf } from './config.ts';
import { effReps, estRir, TARGET } from './sets.ts';
import { goalOf, goalRange, GOALS, waveOf } from './goals.ts';
import { allStats, exStats, program, sessions, stalledSets } from './stats.ts';
import { formulaRange, hints, lastSessionItem, plan, planCycle, roundTo, startWeight, suggestSet } from './plan.ts';
import { planned } from './tally.ts';
import { appRules, rdlDef } from './rules.ts';
import type { Tally } from './tally.ts';
import type { Add, AddCtx, Addition, Cfg, Cyc, ExDef, MuscleMap, Prop, PropSet, Range, Session, Slot, Workout } from './types.ts';

/* ---------- adaptive layer: what the diary would change on top of the athlete's rules ---------- */
export const ADDS: Add[] = [
  { key: 'abs', id: 'x_abs', prio: 4, sets: 3, times: 2, def: { n: 'Пресс', pat: 'iso', m: { abs: 1 } }, cover: e => ((e || {} as ExDef).m || {} as MuscleMap).abs >= 1,
    need: c => c.pv('abs') < c.z.min, why: c => 'пресс по программе получает ' + nSets(c.pv('abs')) + ' в неделю при минимуме ' + c.z.min },
  { key: 'rdl', id: 'x_rdl', prio: 1, sets: 4, times: 1, get def() { return rdlDef(); }, cover: e => (e || {} as ExDef).pat === 'hinge',
    need: c => !c.pp('hinge'), why: c => 'в программе нет тяги с наклоном: разгибатели спины — ' + nSets(c.pv('erectors')) + ', ягодицы — ' + nSets(c.pv('glutes')) + ' в неделю' },
  { key: 'calf', id: 'x_calf', prio: 3, sets: 3, times: 2, def: { n: 'Подъёмы на носки', pat: 'iso', m: { calves: 1 } }, cover: e => ((e || {} as ExDef).m || {} as MuscleMap).calves >= 1,
    need: c => c.pv('calves') < c.z.min, why: c => 'икры по программе получают ' + nSets(c.pv('calves')) + ' в неделю при минимуме ' + c.z.min },
  { key: 'ohp', id: 'x_ohp', prio: 2, sets: 3, times: 1, def: { n: 'Жим над головой', pat: 'v_push', m: { delt_front: 1, delt_mid: 0.5, triceps: 0.5 } }, cover: e => (e || {} as ExDef).pat === 'v_push',
    need: c => !c.pp('v_push'), why: c => 'в программе нет вертикального жима: передние дельты — ' + nSets(c.pv('delt_front')) + ' в неделю' },
  { key: 'rear', id: 'x_rear', prio: 5, sets: 3, times: 2, def: { n: 'Обратная бабочка', pat: 'iso', m: { delt_rear: 1, upper_back: 0.5 } }, cover: e => ((e || {} as ExDef).m || {} as MuscleMap).delt_rear >= 1,
    need: c => c.pv('delt_rear') < c.z.opt && !c.prim('delt_rear'), why: c => 'задние дельты работают только косвенно: ' + nSets(c.pv('delt_rear')) + ' в неделю при рабочей зоне от ' + c.z.opt }
];
/* a missing exercise is not offered when every muscle it is for is outside the athlete's goal */
export const offGoal = (cfg: Cfg, a: Add) => Object.entries(a.def.m).filter(e => e[1] >= 1).every(e => cfg.ignore && cfg.ignore[e[0]]);
/* exercises the programme lacks, spread over the days so that no day gets all of them */
export function additions(workouts: Workout[], cfg: Cfg, pl: Tally) {
  const ctx: AddCtx = { z: cfg.zones, pv: m => pl.pv[m] || 0, pp: p => pl.pp[p] || 0, prim: m => !!pl.prim[m] };
  const load = Object.assign({}, pl.load), out: Record<string, Addition[]> = {};
  for (const sl of SLOTS) out[sl.id] = [];
  for (const a of ADDS) {
    if (!a.need(ctx) || offGoal(cfg, a)) continue;
    const covered = (sl: Slot) => !!pl.t[sl.id] && pl.t[sl.id].items.some(it => a.cover(cfg.ex[it.ex]));
    const free = SLOTS.filter(sl => pl.t[sl.id] && !covered(sl));
    let needN = a.times - SLOTS.filter(covered).length;
    let exId: string | null = null;
    for (let i = workouts.length - 1; i >= 0 && !exId; i--) for (const it of workouts[i].items) if (a.cover(cfg.ex[it.ex])) { exId = it.ex; break; }
    if (!exId) exId = Object.keys(cfg.ex).find(id => a.cover(cfg.ex[id])) || null;
    const def = exId ? null : a.def;
    while (needN-- > 0 && free.length) {
      free.sort((x, y) => load[x.id] - load[y.id]);
      const sl = free.shift();
      load[sl!.id] += a.sets;
      out[sl!.id].push({ key: 'add:' + a.key, a, exId: exId || a.id, def, name: exId ? exName(cfg, exId) : a.def.n, sets: a.sets, range: [8, 12], why: a.why(ctx) });
    }
  }
  return out;
}
export function adapt(workouts: Workout[], cfg: Cfg, slot: string, date: string) {
  const past = workouts.filter(w => !w.open && w.date < date);
  const base = plan(workouts, cfg, slot, date), z = cfg.zones, prog = program(past, cfg), pl = planned(past, cfg), props: Prop[] = [];
  const dps = allStats(past, cfg).filter(s => s.active && !isCycle(cfg, s.id) && !isLight(cfg, s.id) && s.n >= 2);
  const worse = dps.filter(s => s.last.metric < s.ss[s.n - 2].metric * 0.98);
  const deload = dps.length >= 6 && worse.length >= dps.length / 2;
  const short: Record<string, number> = {}, over: Record<string, number> = {}, used: Record<string, boolean> = {};
  /* his limits: nothing is added past the weekly total or past the daily amount for one muscle */
  const caps = cfg.caps, weekCap = Math.min(caps.week, cfg.program && +cfg.program.budget! > 0 ? +cfg.program.budget! : Infinity);
  let room = weekCap - SLOTS.reduce((a, sl) => a + (pl.load[sl.id] || 0), 0);
  const dayV: Record<string, number> = pl.day[slot] || {};
  const fitsDay = (e: ExDef, n: number) => Object.entries(e.m || {}).every(([m, c]) => !c || (dayV[m] || 0) + n * c * (e.uni ? 0.5 : 1) <= caps.day + 0.01);
  for (const m of MUSCLES) { const v = pl.pv[m.id] || 0; if (v > 0 && v < z.opt - 0.5 && pl.prim[m.id] && !cfg.ignore[m.id]) short[m.id] = v; if (v > z.high) over[m.id] = v; }
  const q = (n: number) => n + ' ' + plural(n, ['день', 'дня', 'дней']);

  base.items.forEach((it, idx) => {
    const ex = cfg.ex[it.ex] || { m: {} } as ExDef, s = exStats(past, cfg, it.ex, prog);
    const gap = s ? dnum(date) - dnum(s.last.date) : 0;
    const push = (tag: string, notes: string[], sets: PropSet[], cyc?: Cyc | null, range?: Range | null) => props.push({ key: it.ex, ex: it.ex, idx, tag, notes, sets, cyc: cyc || null, range: range || null });

    if (isLight(cfg, it.ex)) return;                                  // the light day follows the lift's maximum, nothing to adjust
    if (it.cyc) {
      const c = planCycle(workouts, cfg, it.ex, date), rq = +ex.round! || 2.5;
      if (!c.prev) return;
      const ss = sessions(past, cfg, it.ex).filter(x => x.item.cyc);
      const failed = (x: Session) => { const p = x.item.sets.filter(k => !k.warm); return p.some(k => k.r == null || k.r < x.item.cyc!.reps); };
      const flat = (w: number) => +roundTo(w, rq).toFixed(3);
      if (deload) {
        const w = flat(c.prev.tm! * c.pct / 100), n = Math.max(1, Math.ceil(c.sets / 2));
        push('Разгрузка', [n + ' × ' + c.reps + ' по ' + fmt(w) + ' кг вместо ' + c.sets + ' × ' + c.reps + ' по ' + fmt(c.w) + ': половина подходов, максимум без прибавки'], Array.from({ length: n }, () => ({ w, tg: [c.reps, c.reps] })), { pct: c.pct, reps: c.reps });
      } else if (c.auto) {
        /* «сила по запасу» moves its own weight after every session: nothing to add here */
      } else if (ss.length >= 2 && failed(ss[ss.length - 1]) && failed(ss[ss.length - 2])) {
        const wv = waveOf(cfg, it.ex), r0 = wv.order[0], p0 = wv.pct[r0], n0 = wv.sets(r0), tm = c.prev.tm! * 0.9, w = flat(tm * p0 / 100);
        push('Плато', ['два раза подряд подходы не закрыты: расчётный максимум −10% (до ' + fmt(tm, 1) + ' кг), волна заново с ' + n0 + ' × ' + r0 + ' по ' + fmt(w) + ' кг'], Array.from({ length: n0 }, () => ({ w, tg: [r0, r0] })), { pct: p0, reps: r0 });
      } else if (gap >= 14 && !c.repeat && !c.hard) {
        const w = flat(c.prev.tm! * c.pct / 100);
        if (w !== c.w) push('После перерыва', [q(gap) + ' без этого упражнения: ' + fmt(w) + ' кг вместо ' + fmt(c.w) + ', волна идёт дальше без прибавки к максимуму'], Array.from({ length: c.sets }, () => ({ w, tg: [c.reps, c.reps] })), { pct: c.pct, reps: c.reps });
      } else if (!c.repeat && !c.hard) {
        const qs = c.prev.sets.filter(k => k.q != null).map(k => k.q!);
        if (qs.length) {
          const exp = estRir(c.prev.item.cyc!.pct, c.prev.item.cyc!.reps), mn = Math.min(...qs);
          const same = Array.from({ length: c.sets }, w => w), cy = { pct: c.pct, reps: c.reps };
          if (mn >= exp + 2 && !c.hold) {
            const w = flat(c.tm! * 1.025 * c.pct / 100);
            if (w !== c.w) push('Недогруз', ['в прошлый раз запас ' + mn + ' при расчётных ' + exp + ': максимум занижен, ' + fmt(w) + ' кг вместо ' + fmt(c.w)], same.map(() => ({ w, tg: [c.reps, c.reps] })), cy);
          } else if (mn <= exp - 2) {
            const w = flat(c.prev.tm! * c.pct / 100);
            if (w !== c.w) push('Запас меньше расчётного', ['в прошлый раз запас ' + mn + ' при расчётных ' + exp + ': максимум завышен, эта неделя без прибавки — ' + fmt(w) + ' кг вместо ' + fmt(c.w)], same.map(() => ({ w, tg: [c.reps, c.reps] })), cy);
          }
        }
      }
      return;
    }

    const h = hints(workouts, cfg, it.ex, slot, date), prev = h.prevSets, lo = it.range![0], hi = it.range![1], step = h.step;
    if (!prev.length) return;
    if (deload) {
      const n = Math.max(1, Math.ceil(prev.length / 2));
      push('Разгрузка', [n + ' ' + plural(n, ['подход', 'подхода', 'подходов']) + ' вместо ' + prev.length + ' на весах прошлого раза, по 2 повтора в запасе'], prev.slice(0, n).map(p => ({ w: p.w, tg: [lo, Math.max(lo, (p.r == null ? lo : p.r) - 2)] })));
      return;
    }
    if (s && gap >= 14 && h.sets.some(x => x.rule === 'up')) {
      push('После перерыва', [q(gap) + ' без этого упражнения: веса прошлого раза, без повышения'], prev.map(p => ({ w: p.w, tg: [Math.max(lo, Math.min(hi, p.r == null ? lo : p.r)), hi] })));
      return;
    }
    if (s && s.n >= 4 && (s.status === 'flat' || s.status === 'down')) {
      const b = s.pr.best;
      push(s.status === 'down' ? 'Откат' : 'Плато', [s.sincePR + ' ' + plural(s.sincePR, ['тренировка', 'тренировки', 'тренировок']) + ' без рекорда (лучший — ' + fmt(b.w) + ' × ' + b.r + ', ' + fmtDate(s.pr.date, true) + '): все подходы −10%, повторы набираются заново до верха диапазона'],
        prev.map(p => { const k = Math.max(1, Math.round(p.w! * 0.1 / step)); return { w: Math.max(0, +(p.w! - k * step).toFixed(3)), tg: [Math.min(hi, (p.r == null ? lo : p.r) + 2), hi] }; }));
      return;
    }

    const goal = goalOf(cfg, it.ex);
    if (goal) {
      const R = goalRange(goal, prev.reduce((m, p) => Math.max(m, p.w || 0), 0), step);
      if (R[0] !== lo) {
        const shift = lo - R[0];
        push('Цель: ' + GOALS[goal].n, ['диапазон ' + lo + '–' + hi + ' → ' + R[0] + '–' + R[1] + ', потому что цель упражнения — ' + GOALS[goal].n + '; веса ' + (shift > 0 ? 'выше' : 'ниже') + ' из расчёта 2.5% на повтор' + (goal === 'strength' ? ', в запасе оставляй 2 повтора' : '')],
          it.sets.map(x => { const k = x.w! > 0 ? Math.round(shift * 0.025 * x.w! / step) : 0; return { w: x.w == null ? null : Math.max(0, +(x.w + k * step).toFixed(3)), tg: [R[0], R[1]] }; }), null, R);
        return;
      }
    }
    /* isolation: the range must be wide enough to survive one weight step (his own formula) */
    if (kindOf(cfg, it.ex) === 'iso') {
      const top = prev.reduce((m, p) => Math.max(m, p.w || 0), 0), F = formulaRange(top, step, lo);
      if (top > 0 && F[1] >= hi + 2) {
        push('Диапазон по шагу веса', ['диапазон ' + lo + '–' + hi + ' → ' + F[0] + '–' + F[1] + ': шаг ' + fmt(step) + ' кг — это ' + fmt(step / top * 100, 0) + '% от ' + fmt(top) + ' кг, по твоей формуле на новом весе теряется около ' + (F[1] - F[0]) + ' повторов, и при верхней границе ' + hi + ' подход после повышения падает ниже ' + lo],
          it.sets.map((x, i) => { const g = prev[i] ? suggestSet(prev[i], F, step) : null; return { w: g ? g.w : x.w, tg: g ? g.target.slice() : F.slice() }; }), null, F);
        return;
      }
    }
    const sets = it.sets.map((x, i) => ({ w: x.w, tg: h.sets[i] ? h.sets[i].target.slice() : [lo, hi] })), notes: string[] = [], tags: string[] = [];
    const tag = (t: string) => { if (!tags.includes(t)) tags.push(t); }, stalled: Record<number, boolean> = {};
    /* a set that has not moved for four sessions of this day while the sets before it did not grow either: one step down, rebuild the reps */
    const hist = s ? s.ss.filter(x => x.slot === slot).slice(-4) : [];
    if (hist.length === 4 && s!.status === 'up' && hist[3].date === h.prevDate) {
      for (const k of stalledSets(hist, hi)) {
        if (!sets[k.i] || !(k.w > 0)) continue;
        const nw = Math.max(0, +(k.w - step).toFixed(3)), t0 = Math.min(hi, k.r + Math.max(1, Math.round(step / k.w * 100 / 2.5)));
        sets[k.i] = { w: nw, tg: [t0, hi] };
        notes.push('подход ' + (k.i + 1) + ': ' + fmt(k.w) + ' → ' + fmt(nw) + ' кг, цель ' + t0 + '+ — четыре тренировки подряд на ' + fmt(k.w) + ' × ' + k.r + (k.i ? ', и подходы перед ним за это время не выросли' : ''));
        tag('Подход стоит'); stalled[k.i] = true;
      }
    }
    /* the same rule, read with the logged reserve: 10 reps with 3 left are worth 12, 12 reps to failure are worth 11 */
    prev.forEach((p, i) => {
      if (!sets[i] || !h.sets[i] || p.r == null || stalled[i]) return;
      const pr = effReps(p), base = h.sets[i].rule, rule = pr >= hi ? 'up' : pr < lo ? 'down' : 'hold', was = sets[i].w;
      const seen = p.q != null && p.q !== TARGET ? p.r + ' ' + plural(p.r, ['повтор', 'повтора', 'повторов']) + ' с запасом ' + p.q : null;
      if (rule === 'up') {
        const extra = p.w! > 0 && pr >= hi + 2 ? Math.floor(((pr - hi) * 0.025 * p.w!) / step) : 0;
        if (base === 'up' && extra < 1) return;
        const nw = +(p.w! + (1 + extra) * step).toFixed(3);
        sets[i] = { w: nw, tg: [lo, hi] };
        notes.push('подход ' + (i + 1) + ': ' + (extra >= 1 ? 'сразу ' : '') + fmt(nw) + ' кг вместо ' + fmt(was) + ' — в прошлый раз ' + (seen || p.r + ' повторов при верхней границе ' + hi));
        tag('Недогруз');
      } else if (rule !== base && rule === 'hold') {
        sets[i] = { w: p.w, tg: [Math.min(hi, Math.max(lo, pr + 1)), hi] };
        notes.push('подход ' + (i + 1) + ': остаётся ' + fmt(p.w) + ' кг вместо ' + fmt(was) + ' — ' + (p.q === 0 ? p.r + ' повторов получились только в отказ' : 'в прошлый раз ' + seen + ', до нижней границы хватало'));
        tag(p.q === 0 ? 'Отказ' : 'Недогруз');
      } else if (rule !== base && rule === 'down') {
        const nw = Math.max(0, +(p.w! - step).toFixed(3));
        sets[i] = { w: nw, tg: [lo, hi] };
        notes.push('подход ' + (i + 1) + ': ' + fmt(p.w) + ' → ' + fmt(nw) + ' кг — ' + p.r + ' повторов получились только в отказ');
        tag('Отказ');
      }
    });
    /* weekly volume of the main muscle: one more set below the working zone, one less above it */
    for (const [m, c] of Object.entries(ex.m || {})) {
      if (c < 1) continue;
      if ((dayV[m] || 0) > caps.day + 0.01 && sets.length > 2 && !used['day-' + m]) {
        sets.pop();
        notes.push('−1 подход: ' + MUSCLE[m].n.toLowerCase() + ' в этот день — ' + nSets(+dayV[m].toFixed(1)) + ' при твоём лимите ' + caps.day + ' на мышцу за тренировку');
        used['day-' + m] = true; tag('Лимит на день');
        break;
      }
      if (short[m] != null && sets.length < 5 && s && s.status === 'up' && (!used[m] || ex.uni) && room >= (ex.uni ? 0.5 : 1) - 0.01 && fitsDay(ex, 1)) {
        room -= ex.uni ? 0.5 : 1;
        const l = sets[sets.length - 1];
        sets.push({ w: l.w, tg: [lo, hi] });
        notes.push('+1 подход: ' + MUSCLE[m].n.toLowerCase() + ' по программе — ' + nSets(+short[m].toFixed(1)) + ' в неделю, рабочая зона от ' + z.opt);
        used[m] = true; tag('Мало объёма');
        break;
      }
      if (over[m] != null && sets.length > 2 && !used['-' + m]) {
        sets.pop();
        notes.push('−1 подход: ' + MUSCLE[m].n.toLowerCase() + ' по программе — ' + nSets(+over[m].toFixed(1)) + ' в неделю, выше ' + z.high + ' отдача мала');
        used['-' + m] = true; tag('Лишний объём');
        break;
      }
    }
    if (notes.length) push(tags.join(' · '), notes, sets);
  });

  const adds = deload ? [] : (additions(past, cfg, pl)[slot] || []).filter(d => { const e = d.def || cfg.ex[d.exId] || {} as ExDef; if (room < d.sets - 0.01 || !fitsDay(e, d.sets)) return false; room -= d.sets; return true; });
  for (const d of adds) if (cfg.ex[d.exId] && !lastSessionItem(past, d.exId, null, null)) d.w = startWeight(past, cfg, d.exId, d.range);   // a named weight for an exercise new to the journal
  /* what is switched on by default: every change of weight, at most two extra sets and one new exercise per workout */
  const off0: Record<string, boolean> = {};
  /* a programme built around one lift stays lean: extra sets and new exercises are offered, not switched on */
  const lean = !!(cfg.program && (cfg.program.focus || cfg.program.lean));
  let extra = 0;
  for (const p of props) {
    const d = (p.sets.length - base.items[p.idx].sets.length) * ((cfg.ex[p.ex] || {} as ExDef).uni ? 0.5 : 1);
    if (d > 0) { if (lean || extra + d > 2) off0[p.key] = true; else extra += d; }
  }
  adds.slice().sort((a, b) => a.a.prio - b.a.prio).forEach((d, i) => { if (i > 0 || lean) off0[d.key] = true; });
  return { base, props, adds, off0, deload, worse: worse.length, of: dps.length };
}
/* the plan with the chosen proposals applied; `off` holds the keys the athlete unticked */
export function applyAdapt(a: Adapted, off?: Record<string, boolean> | null) {
  off = off || {};
  const items = clone(a.base.items), create: Record<string, ExDef> = {}, used: string[] = [];
  for (const p of a.props) {
    if (off[p.key] || !items[p.idx]) continue;
    items[p.idx].sets = p.sets.map(x => ({ w: x.w, r: null }));
    if (p.cyc) { items[p.idx].cyc = { pct: p.cyc.pct, reps: p.cyc.reps }; items[p.idx].tm = null; }
    if (p.range) items[p.idx].range = p.range.slice();
    used.push(p.key);
  }
  for (const d of a.adds) {
    if (off[d.key]) continue;
    if (d.def) create[d.exId] = d.def;
    items.push({ ex: d.exId, cyc: null, range: d.range.slice(), sets: Array.from({ length: d.sets }, () => ({ w: d.w == null ? null : d.w, r: null })), note: '', skip: false, rir: null });
    used.push(d.key);
  }
  return { items, create, used };
}

export type Adapted = ReturnType<typeof adapt>;
