/* История упражнения, недели программы, индекс силы.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { SLOTS } from './catalog.ts';
import { weekNo, weekRange } from './dates.ts';
import { pct } from './format.ts';
import { isLight } from './config.ts';
import { bestSet, e1, effReps, topSet, work } from './sets.ts';
import { progPending } from './goals.ts';
import { DAYS, dayStale } from './days.ts';
import { appRules, logMax, maxSet, setMax } from './rules.ts';
import type { Cfg, Session, Stalled, WeekInfo, Workout } from './types.ts';

/* sets that have not moved for four sessions of the same day while the sets before them did not grow either.
   A last set that merely holds its reps after heavier first sets is not stalled. */
export function stalledSets(hist: Session[], hi?: number | null) {
  if (hist.length < 4) return [];
  const rows = hist.slice(-4).map(x => x.item.sets.filter(k => !k.warm)), n = Math.min(...rows.map(r => r.length)), out: Stalled[] = [];
  const grew = (j: number) => { const a = rows[0][j], b = rows[3][j]; return a.r != null && b.r != null && e1(b.w!, effReps(b)) > e1(a.w!, effReps(a)) * 1.005; };
  for (let i = 0; i < n; i++) {
    const seq = rows.map(r => r[i]);
    if (seq.some(k => k.r == null) || !seq.every(k => k.w === seq[0].w)) continue;
    if (seq[3].q != null && seq[3].q >= 2) continue;                       // held back on purpose
    const rs = seq.map(k => k.r!);
    if (!(seq[3].r! <= seq[0].r! && Math.max(...rs) - Math.min(...rs) <= 1)) continue;
    if (hi != null && seq[3].r! >= hi) continue;
    let before = false;
    for (let j = 0; j < i && !before; j++) before = grew(j);
    if (!before) out.push({ i, w: seq[3].w!, r: seq[3].r! });
  }
  return out;
}
export function sortW(workouts: Workout[]) { return workouts.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1); }
/* every session of one exercise, oldest first */
export function sessions(workouts: Workout[], cfg: Cfg, exId: string): Session[] {
  const out: Session[] = [];
  for (const w of workouts) for (const it of w.items) {
    if (it.ex !== exId) continue;
    const sets = work(it);
    if (!sets.length) continue;
    const app = appRules(), top = topSet(sets), best = app ? maxSet(it, sets, cfg.rir) : bestSet(sets);
    const tm = it.cyc && it.cyc.pct ? (it.tm || top.w! / (it.cyc.pct / 100)) : null;
    /* (в эталоне нет) с днями «День N» максимум тренировки у всех упражнений — по подходам: лучший подход по Эпли от повторов плюс запас
       (решение владельца, 24 ноября 2026). Расчётный максимум, от которого план считает вес по проценту (tm), остаётся прежним */
    const mx = app ? setMax(best, it, cfg.rir) : e1(best.w!, effReps(best));
    out.push({ date: w.date, wid: w.id, slot: w.slot, item: it, sets, top, best, e1: mx, tm, metric: app ? mx : tm != null ? tm : mx });
  }
  return out;
}
/* exercises of the current programme: whatever the latest finished workout of each day contains */
export function program(workouts: Workout[], cfg: Cfg) {
  const last: Record<string, Workout> = {};
  for (const w of workouts) if (!w.open && w.slot && w.items.some(it => work(it).length)) last[w.slot] = w;
  const ids: Set<string> = new Set();
  /* дни «День N»: в программе — только дни выбранной недели; день, которого в ней нет, и запись дня вне принятой программы не считаются */
  for (const [slot, w] of Object.entries(last)) if ((DAYS.week || SLOTS.some(sl => sl.id === slot)) && !dayStale(cfg, slot, w) && !progPending(cfg, slot, w)) for (const it of w.items) ids.add(it.ex);
  if (cfg && cfg.program) for (const sl of SLOTS) if (progPending(cfg, sl.id, last[sl.id])) for (const e of cfg.program.slots[sl.id]) ids.add(e.ex);
  return ids;
}
export function exStats(workouts: Workout[], cfg: Cfg, exId: string, prog: Set<string>) {
  const ss = sessions(workouts, cfg, exId);
  if (!ss.length) return null;
  let prIdx = 0;
  ss.forEach((s, i) => { if (s.metric > ss[prIdx].metric * 1.0005) prIdx = i; });
  const n = ss.length, last = ss[n - 1], first = ss[0], sincePR = n - 1 - prIdx;
  let status = 'new';
  if (n >= 4) status = sincePR >= 3 ? (last.metric < ss[prIdx].metric * 0.95 ? 'down' : 'flat') : 'up';
  else if (n >= 2) status = last.metric > first.metric ? 'up' : 'new';
  if (isLight(cfg, exId)) status = 'light';
  const active = prog.has(exId);
  return { id: exId, ss, n, first, last, pr: ss[prIdx], prIdx, sincePR, status, active, delta: pct(last.metric, first.metric) };
}
export function allStats(workouts: Workout[], cfg: Cfg) {
  const prog = program(workouts, cfg);
  const ids: string[] = [];
  for (const w of workouts) for (const it of w.items) if (!ids.includes(it.ex)) ids.push(it.ex);
  return ids.map(id => exStats(workouts, cfg, id, prog)).filter(Boolean) as ExStat[];
}
/* ---------- weeks ---------- */
export function weeksInfo(workouts: Workout[], cfg: Cfg, today: string) {
  const start = cfg.start;
  const cur = Math.max(1, weekNo(today, start!));
  const count: Record<number, number> = {};
  let maxW = cur;
  for (const w of workouts) { if (!w.items.some(it => work(it).length)) continue; const k = weekNo(w.date, start!); count[k] = (count[k] || 0) + 1; if (k > maxW) maxW = k; }
  const weeks: WeekInfo[] = [];
  for (let k = 1; k <= maxW; k++) {
    const [a, b] = weekRange(k, start!);
    weeks.push({ no: k, from: a, to: b, count: count[k] || 0, current: k === cur, complete: k < cur || (count[k] || 0) >= SLOTS.length });
  }
  const ref = weeks.filter(w => w.complete && w.count > 0).slice(-3);
  return { weeks, cur, ref };
}
/* ---------- chained strength index: geometric mean of week-over-week change in every exercise done in both weeks ---------- */
export function strengthIndex(workouts: Workout[], cfg: Cfg) {
  const per: Record<number, Record<string, number>> = {};
  for (const w of workouts) {
    const k = weekNo(w.date, cfg.start!);
    for (const it of w.items) {
      const sets = work(it);
      if (!sets.length) continue;
      const b = bestSet(sets), t = topSet(sets);
      const metric = appRules() ? logMax(it, cfg.rir)! : it.cyc && it.cyc.pct ? t.w! / (it.cyc.pct / 100) : e1(b.w!, effReps(b));   // (в эталоне нет) с днями «День N» — по подходам, как в sessions
      if (!(metric > 0)) continue;
      const o = per[k] || (per[k] = {});
      if (!(o[it.ex] >= metric)) o[it.ex] = metric;
    }
  }
  const ks = Object.keys(per).map(Number).sort((a, b) => a - b);
  const out: { week: number; idx: number; shared: number }[] = [];
  let idx = 100;
  ks.forEach((k, i) => {
    let shared = 0;
    if (i > 0) {
      const prev = per[ks[i - 1]];
      let sum = 0;
      for (const [ex, v] of Object.entries(per[k])) if (prev[ex] > 0) { sum += Math.log(v / prev[ex]); shared++; }
      if (shared) idx *= Math.exp(sum / shared);
    }
    out.push({ week: k, idx, shared });
  });
  return out;
}

export type ExStat = NonNullable<ReturnType<typeof exStats>>;
