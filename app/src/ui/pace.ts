/* Время тренировки по факту на экране (просьба владельца, 25 ноября 2026; docs/03, раздел 18). В эталоне этого нет.
   В конце тренировки дневник спрашивает, сколько она шла; по ответам он находит темп атлета (core/pace.ts) и множит на него свою оценку времени. */
import { C, h, toInt } from './dom.ts';
import { touch } from './storage.ts';
import { D } from './render.ts';
import { PACE } from '../core/rules.ts';
import type { Workout } from '../core/index.ts';

/* время тренировки по словам атлета, минут (core/pace.ts) */
export function minField(d: Workout, label: string) {
  const done = d.items.map(it => Object.assign({}, it, { sets: it.sets.filter(s => s.r != null) })), est = C.estMinutes(D.cfg, done);
  return h('label', { class: 'f' }, h('span', null, label), h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'wk-min', 'aria-label': 'Сколько минут длилась тренировка', placeholder: est > 0 ? String(Math.round(est)) : '', value: d.min == null ? '' : String(d.min),
    oninput: e => { const v = toInt(e.target.value); if (v != null && v > 0) d.min = v; else delete d.min; touch(); } }),
    d.open ? h('span', { class: 'sub' }, est > 0 ? 'по расчёту ≈ ' + C.fmtDur(est) + '; по ответам дневник подстроит оценку под твой темп' : 'по ответам дневник подстроит оценку времени под твой темп') : null);
}
/* оценка времени идёт по темпу атлета (core/pace.ts): что это значит, одной фразой */
export const paceText = () => PACE.k !== 1 ? ' Оценка — по твоему темпу: тренировки идут ×' + C.fmt(PACE.k, 2) + ' к расчёту.' : '';
