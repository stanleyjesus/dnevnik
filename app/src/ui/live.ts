/* Вес по ходу тренировки и подбор веса (просьба владельца, 28 ноября 2026; docs/03, раздел 25). В эталоне этого нет.
   Только с днями «День N», только в идущей тренировке и только у упражнения на двойной прогрессии: подход записан, а он вышел на нижней границе
   диапазона или ниже (или легче верха на 2 повтора и больше) — следующим подходам, где повторов ещё нет, дневник ставит вес по этому подходу
   (core/rules.ts, liveSets) и пишет под подходами одну строку причины. Вес, который атлет вписал руками, не трогается.
   Что было в подходе до поправки, помнится, пока открыта страница: исправил повторы — веса пересчитываются от прежних */
import { $, C, h } from './dom.ts';
import { D } from './render.ts';
import { liveSets, rirOf } from '../core/rules.ts';
import type { Item, SetRec } from '../core/index.ts';

/** Подходы, вес которых атлет вписал сам; вес подхода до поправки дневника */
const own = new WeakSet<SetRec>(), was = new WeakMap<SetRec, number | null>();
/** Атлет сам вписал вес подхода: дневник его больше не меняет */
export const ownWeight = (st: SetRec) => { own.add(st); was.delete(st); };
const calc = (it: Item, step: number) => liveSets(it.sets, it.sets.map(s => { if (!was.has(s)) was.set(s, s.w == null ? null : s.w); return was.get(s)!; }), it.sets.map(s => own.has(s)), it.range!, rirOf(D.cfg, it.ex), step);
const say = (it: Item, why: { i: number; w: number; dir: number } | null) => {
  if (!why) return '';
  const s = it.sets[why.i];
  return (why.dir < 0 ? 'Дальше легче' : 'Дальше тяжелее') + ', ' + C.fmt(why.w) + ' кг: в подходе ' + (why.i + 1) + ' — ' + s.r + ' ' + C.plural(s.r!, ['повтор', 'повтора', 'повторов']) + (s.q != null ? ' с запасом ' + s.q : '');
};
/** Строка причины под подходами: при отрисовке карточки — по тому, что уже записано */
export function liveLine(it: Item, idx: number, step: number) {
  const t = it.range ? say(it, calc(it, step).why) : '';
  return h('p', { class: 'sub live', id: 'live-' + idx, hidden: !t }, t);
}
/** Подход записан или исправлен: веса следующих подходов и строка причины — без перерисовки страницы, чтобы поле ввода не теряло фокус */
export function liveApply(it: Item, idx: number, step: number) {
  if (!it.range) return;
  const r = calc(it, step);
  it.sets.forEach((s, j) => {
    if (s.r != null || own.has(s) || s.w === r.w[j]) return;
    s.w = r.w[j];
    const el = $('w-' + idx + '-' + j);
    if (el) el.value = s.w == null ? '' : C.fmt(s.w, 3);
  });
  const line = $('live-' + idx);
  if (line) { const t = say(it, r.why); line.textContent = t; line.hidden = !t; }
}
/** В тренировке есть упражнение без веса: его подбирают на месте (карточка «Подбери вес» в памятке) */
export const needPick = (items: Item[]) => items.some(it => !it.skip && it.sets.length > 0 && it.sets.every(s => s.w == null));
/** Подсказка подбора веса у упражнения без веса */
export const PICK = 'Подбери вес: прибавляй по шагу по 3–5 повторов; где вес пошёл заметно медленнее — с него первый подход. Дальше вес поставит дневник';
