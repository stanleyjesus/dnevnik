/* Таймер идущей тренировки (просьба владельца, 26 ноября 2026; docs/01, раздел 14). В эталоне этого нет.
   Время тренировки дневник берёт из нажатий «Начать тренировку» и «Завершить» (core/pace.ts), и чтобы было видно, что отсчёт идёт,
   на вкладке «Тренировка» вместо точки «тренировка идёт» — часы от «Начать тренировку»: вкладки закреплены наверху экрана, их видно с любого раздела.
   Часы обновляются раз в секунду ровно на границе секунды и только пока таймер на экране. */
import { $, h } from './dom.ts';
import { S } from './state.ts';

/* прошло времени: 4:05, 1:02:09 */
export const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), p = (v: number) => String(v).padStart(2, '0');
  return (hh ? hh + ':' + p(mm) : String(mm)) + ':' + p(s % 60);
};
let ticking = false;
function tick() {
  const el = $('wk-timer'), t0 = S.draft && S.draft.open ? S.draft.began : undefined;
  if (!el || !t0) { ticking = false; return; }
  const txt = hms(Date.now() - t0);
  if (el.textContent !== txt) el.textContent = txt;
  setTimeout(tick, 1000 - (Date.now() - t0) % 1000);
}
/** Часы на вкладке «Тренировка»: от «Начать тренировку» (began) до сейчас */
export function workoutClock(t0: number) {
  const el = h('span', { class: 'timer', id: 'wk-timer', title: 'тренировка идёт: время от «Начать тренировку»' }, hms(Date.now() - t0));
  if (!ticking) { ticking = true; setTimeout(tick, 1000 - (Date.now() - t0) % 1000); }
  return el;
}
