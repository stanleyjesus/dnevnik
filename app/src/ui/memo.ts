/* Памятка (просьба владельца, 26 ноября 2026): три вещи, на которых держать внимание в подходе, — растягивать мышцу, где упражнение
   это позволяет, опускать вес под контролем и считать запас. Только с днями «День N»: последний шаг онбординга и экран поверх
   тренировки, когда она начинается («Понятно, начинаем» его закрывает, Esc — тоже). Картинки — свои анимации на SVG и CSS, без файлов
   и сети; при «уменьшить движение» они стоят (style.css). В тексте честно сказано, где исследование, а где тренерское правило.
   Четвёртая карточка — «Подбери вес» (просьба владельца, 28 ноября 2026): в начале тренировки, где есть упражнение без веса (live.ts) */
import { h, sv } from './dom.ts';
import { S } from './state.ts';
import { needPick } from './live.ts';
import type { SvgEl } from './types.ts';

const A = { viewBox: '0 0 200 84', 'aria-hidden': 'true' };
/* сгибание на бицепс сбоку: внизу рука прямая, мышца вытянута — «растяжение»; вверх быстрее, вниз медленно */
const stretch = () => sv('svg', A,
  sv('circle', { cx: 74, cy: 11, r: 7, class: 'm-iron' }),
  sv('line', { x1: 74, y1: 20, x2: 74, y2: 54, class: 'm-bone' }),
  sv('line', { x1: 74, y1: 54, x2: 67, y2: 80, class: 'm-bone' }), sv('line', { x1: 74, y1: 54, x2: 81, y2: 80, class: 'm-bone' }),
  sv('line', { x1: 80, y1: 23, x2: 80, y2: 45, class: 'm-bone' }),
  sv('ellipse', { cx: 85, cy: 34, rx: 3.5, ry: 9, class: 'm-muscle' }),
  sv('g', { class: 'm-fore' }, sv('line', { x1: 80, y1: 45, x2: 80, y2: 66, class: 'm-bone' }), sv('rect', { x: 72, y: 65, width: 16, height: 7, rx: 2, class: 'm-iron' })),
  sv('circle', { cx: 80, cy: 45, r: 3, class: 'm-joint' }),
  sv('text', { x: 104, y: 38, class: 'm-cap m-blink' }, 'растяжение'),
  sv('text', { x: 104, y: 52, class: 'm-cap m-sub m-blink' }, 'внизу рука прямая'));
/* штанга: вниз три секунды — счёт 1, 2, 3, — вверх за одну */
const tempo = () => sv('svg', A,
  sv('g', { class: 'm-bar' }, sv('line', { x1: 30, y1: 14, x2: 120, y2: 14, class: 'm-bone' }), sv('rect', { x: 26, y: 3, width: 8, height: 22, rx: 2, class: 'm-iron' }), sv('rect', { x: 116, y: 3, width: 8, height: 22, rx: 2, class: 'm-iron' })),
  [1, 2, 3].map(i => sv('text', { x: 160, y: 46, class: 'm-num m-n' + i }, String(i))),
  sv('text', { x: 160, y: 44, class: 'm-num m-up' }, 'вверх'),
  sv('text', { x: 160, y: 70, class: 'm-cap m-mid' }, 'секунды вниз'));
/* подход: четыре повтора сделаны, ещё два мог бы — это запас */
const rir = () => sv('svg', A,
  [0, 1, 2, 3, 4, 5].map(i => sv('rect', { x: 26 + i * 25, y: 14, width: 19, height: 32, rx: 5, class: i < 4 ? 'm-rep m-r' + (i + 1) : 'm-rep m-left' })),
  sv('path', { d: 'M126 54v5h44v-5', class: 'm-brace' }),
  sv('text', { x: 148, y: 74, class: 'm-cap m-mid m-acc' }, 'запас 2'),
  sv('text', { x: 72, y: 74, class: 'm-cap m-mid' }, 'сделал 4'));
/* подбор веса (просьба владельца, 28 ноября 2026; live.ts): ступени веса по одной, на каждой по нескольку повторов; когда вес пошёл медленнее — это рабочий */
const pick = () => sv('svg', A,
  [18, 28, 38, 50].map((v, i) => sv('rect', { x: 16 + i * 36, y: 58 - v, width: 22, height: v, rx: 4, class: 'm-rep m-r' + (i + 1) })),
  ['×5', '×4', '×3'].map((t, i) => sv('text', { x: 27 + i * 36, y: 74, class: 'm-cap m-mid' }, t)),
  sv('text', { x: 135, y: 74, class: 'm-cap m-mid m-acc' }, 'рабочий'),
  sv('text', { x: 152, y: 28, class: 'm-cap m-sub m-blink' }, 'пошёл'),
  sv('text', { x: 152, y: 42, class: 'm-cap m-sub m-blink' }, 'медленнее'));
/** Карточка «Подбери вес»: только когда в тренировке есть упражнение без веса */
const PICK_ITEM: [() => SvgEl, string, string, string] = [pick, 'Подбери вес', 'У упражнения без веса прибавляй по шагу, на каждом 3–5 повторов. Когда вес пошёл заметно медленнее, с него первый подход. Запиши повторы и запас — дальше вес поставит дневник.', 'Исследования: вес по запасу работает не хуже процентов. Ступени разминки — тренерское правило'];

const ITEMS: [() => SvgEl, string, string, string][] = [
  [stretch, 'Растягивай мышцу', 'Опускай вес до полного растяжения, где упражнение это позволяет: низ жима, сгибания, тяги.', 'Исследования: в растянутом положении мышца растёт лучше'],
  [tempo, 'Опускай под контролем', 'Вниз — 2–3 секунды, без броска, вверх — уверенно.', 'Тренерское правило: так виден предел и меньше риск травмы'],
  [rir, 'Считай запас', 'В конце подхода спроси себя, сколько ещё повторов сделал бы чисто, и запиши это в «Запас». Целься в 1, в базовых со штангой и гантелями — в 2.', 'По запасу дневник ставит вес следующей тренировки']
];
export const memoCards = (withPick?: boolean) => h('div', { class: 'memo' }, (withPick ? ITEMS.concat([PICK_ITEM]) : ITEMS).map(([art, t, p, src]) => h('div', { class: 'memo-i' }, art(), h('div', null, h('b', null, t), h('p', null, p), h('p', { class: 'src' }, src)))));

/* экран поверх тренировки: он вне #view, поэтому перерисовка страницы его не трогает */
export function showMemo(after?: () => void) {
  if (document.getElementById('memo-sheet')) return;
  const was = document.activeElement as HTMLElement | null;
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const close = () => { sheet.remove(); document.removeEventListener('keydown', esc); if (was && was.isConnected) was.focus(); if (after) after(); };
  const ok = h('button', { type: 'button', class: 'btn primary', id: 'memo-ok', onclick: close }, 'Понятно, начинаем');
  const sheet = h('div', { class: 'memo-sheet', id: 'memo-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'memo-h' },
    h('div', { class: 'memo-in' }, h('div', { class: 'eyebrow' }, 'Перед тренировкой'), h('h2', { id: 'memo-h' }, 'Памятка'), memoCards(!!S.draft && needPick(S.draft.items)), ok));
  document.body.appendChild(sheet);
  document.addEventListener('keydown', esc);
  ok.focus({ preventScroll: true });   // экран открывается сверху, Enter сразу закрывает
}
