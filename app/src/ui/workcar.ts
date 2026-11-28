/* Идущая тренировка каруселью (просьба владельца, 28 ноября 2026). В эталоне этого нет.
   С днями «День N» после «Начать тренировку» упражнения идут карточками карусели (carousel.ts): по центру — одно упражнение,
   по бокам — края соседних, сверху — полосы по числу упражнений; сделанные упражнения отмечены на полосах. Сначала открыто первое
   несделанное упражнение. Кнопка «Следующее упражнение» под карточкой листает дальше, «не делал» сразу открывает следующее.
   Сам дневник после ввода повторов не листает: за повторами последнего подхода идёт его запас, и атлет уходит с карточки сам.
   Последняя карточка — «Конец тренировки»: что дневник убрал из плана или предлагает добавить, «Добавить упражнение», заметка
   к тренировке, сколько осталось по плану. Шапки с датой, днём программы и неделей нет: день и дата выбраны до старта.
   Открытая карточка помнится, пока идёт та же тренировка; после перезагрузки страницы — снова первое несделанное упражнение */
import { h } from './dom.ts';
import { carousel } from './carousel.ts';
import type { Car } from './carousel.ts';
import type { Item, Workout } from '../core/index.ts';
import type { Kid } from './types.ts';

let at: (Car & { id: string }) | null = null;
let open: ((i: number) => void) | null = null;

/** Упражнение сделано: в каждом подходе записаны повторы, или оно отмечено «не делал» */
export const exDone = (it: Item) => !!it.skip || (it.sets.length > 0 && it.sets.every(s => s.r != null));
/** Открытая карточка тренировки d: в новой тренировке и после перезагрузки — первое несделанное упражнение, иначе — карточка «Конец тренировки» */
function carOf(d: Workout): Car {
  if (!at || at.id !== d.id) { const i = d.items.findIndex(it => !exDone(it)); at = { id: d.id, day: i < 0 ? d.items.length : i }; }
  return at;
}
/** «не делал» у упражнения idx: после перерисовки открыто следующее */
export function wkNext(d: Workout, idx: number) { carOf(d).day = idx + 1; }

/* название упражнения на крае карточки — вертикальной строкой: длинное укорачивается */
const short = (t: string) => t.length > 24 ? t.slice(0, 23).trimEnd() + '…' : t;

/** Карусель тренировки: cards — карточки упражнений в порядке d.items, names — их названия, end — карточка «Конец тренировки» */
export function workCar(d: Workout, cards: HTMLElement[], names: string[], end: HTMLElement): Kid[] {
  const n = cards.length, o = carOf(d);
  cards.forEach((c, i) => c.appendChild(h('div', { class: 'row wk-next' },
    h('button', { type: 'button', class: 'btn', id: 'wk-next-' + i, onclick: (e: MouseEvent) => { e.stopPropagation(); if (open) open(i + 1); } }, i < n - 1 ? 'Следующее упражнение' : 'К завершению'))));
  const [bar, car] = carousel(cards.concat(end), o, { id: 'wk-ex', dot: i => 'wk-dot-' + i, lab: i => i < n ? (i + 1) + '. ' + short(names[i]) : 'Конец', aria: 'Упражнения тренировки', ref: f => { open = f; } }) as [HTMLElement | null, HTMLElement];
  car.classList.add('wk-car');
  if (bar) bar.classList.add('wk-dots');
  /* сделано ли упражнение — следом за вводом: полоса отмечена, кнопка «дальше» становится главной */
  /* после «Добавить упражнение» нажатие доходит и до прежней карусели, которую перерисовка уже убрала: у неё карточек меньше, чем упражнений */
  const mark = () => { if (car.isConnected || !car.parentNode) cards.forEach((c, i) => {
    const it = d.items[i], ok = !!it && exDone(it), b = c.querySelector('.wk-next .btn');
    if (bar && bar.children[i]) bar.children[i].toggleAttribute('data-done', ok);
    if (b) b.classList.toggle('primary', ok);
  }); };
  car.addEventListener('input', mark);
  car.addEventListener('click', mark);                                    // «Все по N» у подходов по проценту ставит повторы без ввода
  mark();
  return [bar, car];
}
