/* Экран «Советы»: замечания дневника по правилам.
   Перенесено из reference/src/ui3.js. Запроса разбора у модели здесь нет (решение владельца, 18 ноября 2026):
   убраны карточка «Разбор от Claude», сам запрос и разметка его ответа — см. списки в scripts/tokens.mjs. */
import { h, pill } from './dom.ts';
import { S } from './state.ts';
import { D } from './render.ts';
import { insightEl } from './overview.ts';

/* ---------- coach ---------- */
export function vCoach() {
  if (!D.W.length) return S.conn === 'ready' ? [h('div', { class: 'card empty' }, 'Советы появятся после первых тренировок.')] : [];
  const out = [];
  const cnt = (k: string) => D.ins.filter(i => i.sev === k).length;
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Замечания дневника'), h('p', { class: 'note' }, 'Пересчитываются после каждой записи по твоим правилам прогрессии и недельному объёму.')),
      h('div', { class: 'row', style: 'gap:12px' }, cnt('crit') ? pill('crit', 'критично: ' + cnt('crit')) : null, cnt('warn') ? pill('warn', 'внимание: ' + cnt('warn')) : null, pill('info', 'заметки: ' + cnt('info')), pill('good', 'хорошо: ' + cnt('good')))),
    D.ins.map(i => insightEl(i, true))));
  return out;
}
