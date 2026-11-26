/* Запись подходов текстом; тренировка <-> документ хранилища.
   Перенесено из reference/src/core.js: тела функций без изменений, кроме времени тренировки (min и began, pace.ts; просьбы владельца 25 и 26 ноября 2026). */
import { fmt } from './format.ts';
import type { ItemDoc, SetRec, Workout, WorkoutDoc } from './types.ts';

/* ---------- sets <-> text ("40x10 38x? 26x- 24x12w") ---------- */
export function parseSets(str: string | null | undefined): SetRec[] {
  if (!str) return [];
  return String(str).trim().split(/\s+/).map(tok => {
    const m = /^(-?\d+(?:\.\d+)?)x(\d+|\?|-)(w?)(?:@(\d))?$/.exec(tok);
    if (!m) return null;
    const o: SetRec = { w: +m[1], r: /\d/.test(m[2]) ? +m[2] : null };
    if (m[2] === '-') o.skip = true;
    if (m[3]) o.warm = true;
    if (m[4] != null && o.r != null) o.q = +m[4];          // q = reps in reserve (RIR) logged for this set
    return o;
  }).filter(Boolean) as SetRec[];
}
export const fmtSets = (sets: SetRec[]) => sets.map(s => fmt(s.w == null ? 0 : s.w, 3) + 'x' + (s.skip ? '-' : s.r == null ? '?' : s.r) + (s.warm ? 'w' : '') + (s.q != null && s.r != null && !s.skip ? '@' + s.q : '')).join(' ');
export function fromDoc(id: string, d?: Partial<WorkoutDoc> | null): Workout {
  d = d || {};
  const w: Workout = {
    id, date: d.date || id.slice(0, 10), slot: d.slot || null, note: d.note || '', open: !!d.open,
    items: (Array.isArray(d.items) ? d.items : []).map(it => {
      const o = {
        ex: String(it.ex || ''),
        range: it.rng ? String(it.rng).split('-').map(Number) : null,
        cyc: it.cyc ? { pct: +String(it.cyc).split('/')[0], reps: +String(it.cyc).split('/')[1] } : null,
        sets: parseSets(it.sets), note: it.note || '', skip: !!it.skip, rir: null, tm: it.tm == null ? null : +it.tm
      };
      if (it.rir != null) {                                  // older records kept one value for the last set
        const done = o.sets.filter(s => s.r != null && !s.warm), l = done[done.length - 1];
        if (l && l.q == null) l.q = Math.max(0, Math.min(5, +it.rir));
      }
      return o;
    }).filter(it => it.ex)
  };
  if (+d.min! > 0) w.min = Math.round(+d.min!);                   // (в эталоне нет) сколько минут шла тренировка (pace.ts)
  if (w.open && +d.began! > 0) w.began = +d.began!;                // (в эталоне нет) когда нажато «Начать тренировку»: только у идущей
  return w;
}
export function toDoc(w: Workout): WorkoutDoc {
  const d: WorkoutDoc = { date: w.date, slot: w.slot || 'mon', items: w.items.map(it => {
    const o: ItemDoc = { ex: it.ex };
    if (it.cyc) { o.cyc = it.cyc.pct + '/' + it.cyc.reps; if (it.tm != null) o.tm = it.tm; } else if (it.range) o.rng = it.range[0] + '-' + it.range[1];
    o.sets = fmtSets(it.sets);
    if (it.note) o.note = it.note;
    if (it.skip) o.skip = true;
    return o;
  }) };
  if (w.note) d.note = w.note;
  if (w.open) d.open = true;
  if (w.min) d.min = w.min;                                         // (в эталоне нет) время по факту
  if (w.open && w.began) d.began = w.began;                         // (в эталоне нет) старт идущей тренировки
  return d;
}
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
