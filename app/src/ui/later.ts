/* Блоки статистики «Обзора», пока считать нечего (просьба владельца, 28 ноября 2026). В эталоне этого нет.
   С днями «День N» плитки «Тренировок записано» и «Индекс силы», «Базовые» программы и «Нагрузка по мышцам» видны и без тренировок:
   вместо чисел — подпись, когда они появятся. Нагрузка по мышцам считается по законченным неделям, поэтому её блок ждёт первую неделю
   и тогда, когда тренировки уже есть. Расчёта здесь нет: только то, что показать, пока данных нет */
import { C, h } from './dom.ts';
import { D } from './render.ts';
import { byPct } from '../core/rules.ts';
import { goalTag } from './overview.ts';

export const SOON = 'появится после первой тренировки';

/** Две плитки сверху, как у дневника с записями, но без чисел */
export function soonTiles() {
  return h('div', { class: 'tiles two', id: 'soon-tiles' },
    h('div', { class: 'tile' }, h('span', { class: 'l' }, 'Тренировок записано'), h('span', { class: 'v' }, '0'), h('span', { class: 'd' }, 'пока ни одной')),
    h('div', { class: 'tile' }, h('span', { class: 'l' }, 'Индекс силы'), h('span', { class: 'v' }, '–'), h('span', { class: 'd' }, SOON)));
}

/** «Базовые» — упражнения программы в силовой роли (по проценту от максимума), пока по ним не было тренировок */
export function soonLifts() {
  const cur = C.currentSlots(D.W, D.cfg), ids = [...new Set(C.SLOTS.flatMap(sl => cur[sl.id].map(e => e.ex)))].filter(id => byPct(D.cfg, id) && !C.isLight(D.cfg, id) && !D.stats.some(s => s.id === id && s.active));
  if (!ids.length) return null;
  return h('section', { id: 'soon-lifts' }, h('div', { class: 'sec-h' }, h('h2', null, 'Базовые')),
    h('div', { class: 'grid3' }, ids.map(id => h('div', { class: 'ex-card soon' },
      h('span', { class: 'nm' }, C.exName(D.cfg, id), goalTag(D.cfg, id) ? h('span', { class: 'tag accent', style: 'margin-left:6px' }, goalTag(D.cfg, id)) : null),
      h('div', { class: 'sub' }, 'Вес, расчётный максимум и график ' + SOON)))));
}

/** «Нагрузка по мышцам» без полной недели: блок на месте, числа — после первой недели с тренировками */
export function soonMuscles() {
  return h('section', { class: 'card', id: 'soon-muscles' }, h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Нагрузка по мышцам'), h('p', { class: 'sub' }, 'Подходов в неделю на каждую мышцу и зона нагрузки.')), h('a', { class: 'btn ghost sm', href: '#muscles' }, 'По неделям')),
    h('p', { class: 'empty soon' }, 'Появится, когда пройдёт первая неделя с тренировками.'));
}
