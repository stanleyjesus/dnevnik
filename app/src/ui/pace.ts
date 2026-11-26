/* Время тренировки по факту на экране (просьбы владельца 25 и 26 ноября 2026; docs/03, раздел 20). В эталоне этого нет.
   Сколько шла тренировка, дневник берёт из нажатий «Начать тренировку» и «Завершить» (core/pace.ts, byButtons); у законченной записи его можно поправить.
   По этому времени он находит темп атлета и множит на него свою оценку времени. */
import { C, h, toInt } from './dom.ts';
import { touch } from './storage.ts';
import { D } from './render.ts';
import { PACE } from '../core/rules.ts';
import type { Workout } from '../core/index.ts';

/* время тренировки в законченной записи, минут: его можно поправить, если «Завершить» нажато не сразу (core/pace.ts) */
export function minField(d: Workout, label: string) {
  const done = d.items.map(it => Object.assign({}, it, { sets: it.sets.filter(s => s.r != null) })), est = C.estMinutes(D.cfg, done);
  return h('label', { class: 'f' }, h('span', null, label), h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'wk-min', 'aria-label': 'Сколько минут длилась тренировка', placeholder: est > 0 ? String(Math.round(est)) : '', value: d.min == null ? '' : String(d.min),
    oninput: e => { const v = toInt(e.target.value); if (v != null && v > 0) d.min = v; else delete d.min; touch(); } }));
}
/* время по факту — до минуты, без округления оценки */
export const factDur = (m: number) => m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : '');
/* оценка времени идёт по темпу атлета (core/pace.ts): что это значит, одной фразой */
export const paceText = () => PACE.k !== 1 ? ' Оценка — по твоему темпу: тренировки идут ×' + C.fmt(PACE.k, 2) + ' к расчёту.' : '';
