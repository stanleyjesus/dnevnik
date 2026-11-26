/* Фигура мышц — карточка, которую переворачивают (просьба владельца, 26 ноября 2026: «чтобы занимала меньше места»).
   С днями «День N» вместо двух фигур рядом одна карточка: сначала вид спереди, нажатие переворачивает на вид сзади и обратно.
   Где фигура выбирает мышцу («Мышцы»), нажатие на мышцу или её подпись выбирает мышцу, а не переворачивает карточку.
   Сторона помнится, пока открыт тот же раздел: выбор мышцы на виде сзади перерисовывает экран, и карточка остаётся сзади;
   в другом разделе карточка снова начинается с вида спереди. Невидимая сторона не ловит нажатий и не входит в фокус.
   «Уменьшить движение» в системе — без поворота (style.css) */
import { h, sv } from './dom.ts';

const side = { at: '', back: false };
const TURN = 'M12 4a8 8 0 0 1 7.4 5H17v2h6V5h-2v2.3A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm8 8a8 8 0 0 1-15.4 3H7v-2H1v6h2v-2.3A10 10 0 0 0 22 12z';

export function flipCard(front: HTMLElement, rear: HTMLElement, picks: boolean): HTMLElement {
  if (side.at !== location.hash) { side.at = location.hash; side.back = false; }
  const word = h('span'), btn = h('button', { type: 'button', class: 'bm-flip' }, sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, sv('path', { d: TURN, fill: 'currentColor' })), word);
  const card = h('div', { class: 'bodymap flip' }, h('div', { class: 'flip-in' }, front, rear), btn);
  const show = (back: boolean) => {
    side.back = back;
    card.classList.toggle('back', back);
    front.inert = back; rear.inert = !back;
    word.textContent = back ? 'Вид сзади' : 'Вид спереди';
    btn.setAttribute('aria-label', 'Вид ' + (back ? 'сзади' : 'спереди') + ': перевернуть на вид ' + (back ? 'спереди' : 'сзади'));
  };
  show(side.back);
  card.addEventListener('click', e => {
    const t = e.target as Element | null;
    if (picks && t && t.closest && t.closest('.bm, .bm-t')) return;
    show(!side.back);
  });
  return card;
}
