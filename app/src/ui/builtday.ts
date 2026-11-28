/* (в эталоне нет) День программы, которую собрал дневник: онбординг и вкладка «Программа» с днями «День N», кроме «Вручную».
   Решение владельца, 25 ноября 2026: порядок и подходы уже посчитала сборка, поэтому у упражнения только «Заменить» — под кнопкой
   упражнения на те же мышцы, а частично совпадающие — в свёрнутой строке (или сразу, когда других нет). Стрелки «выше», «−» и «+»
   подходов, «убрать», пометок «новое», «перенос», «+N подходов» и строки «В день» здесь нет: они остались «Вручную», своей программе
   и программе текстом в онбординге (progDay). Подходы мышце по-прежнему прибавляются и убавляются кнопками у мышцы.
   Замена — та же, что в progDay (draft.ts): подходы остаются, «вместо «…»» показывает, что было, и только у замены полоса слева.
   На «Программе» день выглядит так же, как в онбординге (просьба владельца тем же днём): без полосы у нового, перенесённого и
   изменённого и без «было N» в заголовке дня.
   Что беречь (решение владельца, 25 ноября 2026): у упражнения, которое нагружает больное место атлета, — красная пилюля с названием места,
   и в программе, и в списке замен, чтобы было видно, на что менять (rules.ts, careOf) */
import { C, h } from './dom.ts';
import { D } from './render.ts';
import { loadText, progScheme } from './program.ts';
import { careOf, swappable, zoneName } from '../core/rules.ts';
import { shiftOf, shiftText } from '../core/balance.ts';
import type { Cfg, ProgEntry, Slot, Swap } from '../core/types.ts';
import type { ProgEdit } from './types.ts';

/** Красные пилюли больных мест, которые нагружает упражнение */
/* больные места — из нынешней настройки (D.cfg), а не из черновика: отметка в «Что беречь» видна сразу, без пересборки */
export const carePills = (cfg: Cfg, id: string, def?: { n?: string } | null) => careOf(D.cfg, id, cfg.ex[id] || def).map(z => h('span', { class: 'tag crit' }, zoneName(z)));
export function builtDay(cfg: Cfg, sl: Slot, list: ProgEntry[], load: number, edit: ProgEdit) {
  const rows = list.map((e, i) => {
    const k = C.kindOf(cfg, e.ex), nm = C.exName(cfg, e.ex), sid = 'sw-' + sl.id + '-' + i, goal = k === 'base' ? C.goalName(cfg, e.ex) : null;
    const alts = swappable(cfg, e.ex) ? C.swapsFor(cfg, e.ex, list.map(x => x.ex)) : null, can = !!alts && alts.same.length + alts.near.length > 0;
    const open = can && edit.swapAt === sl.id + ':' + i;
    let first = true;                                                   // первое упражнение списка получает фокус, когда список открывается (swapOpen в draft.ts)
    const card = (x: Swap, note: string) => h('button', { type: 'button', class: 'ex-card', id: first ? (first = false, sid + '-to') : null, onclick: () => edit.swap(sl.id, i, x) }, h('span', { class: 'nm' }, x.n, carePills(cfg, x.id, x.def)), note ? h('span', { class: 'sub' }, note) : null);
    const added = (x: Swap) => x.def ? 'добавится в справочник' : '';
    /* (в эталоне нет) что замена сделает с недельным объёмом мышц, пока дневник его не вернул (balance.ts; пункт 1 вопросов владельца, 28 ноября 2026) */
    const shift = (x: Swap) => open ? shiftText(shiftOf(cfg, { [sl.id]: list }, sl.id, i, x.id, x.def)) : '';
    const near = (x: Swap) => card(x, [shift(x) || 'мышцы совпадают частично: ' + x.main!.map(m => C.MUSCLE[m].n.toLowerCase()).join(', '), added(x)].filter(Boolean).join(' · '));
    const pick = open ? h('div', { class: 'stack swaprow', style: 'gap:6px' },
      alts!.same.map(x => card(x, [shift(x), added(x)].filter(Boolean).join(' · '))),
      !alts!.near.length ? null : alts!.same.length
        ? h('details', null, h('summary', { class: 'sub', style: 'cursor:pointer' }, 'Ещё похожие: ' + alts!.near.length), h('div', { class: 'stack', style: 'gap:6px;margin-top:6px' }, alts!.near.map(near)))
        : alts!.near.map(near)) : null;
    return h('div', { class: 'prow' + (e.was ? ' changed' : '') + (open ? ' swapping' : '') },
      h('div', { class: 'grow' },
        h('div', { class: 'pn' }, nm, goal ? h('span', { class: 'tag' + (['strength', 'auto'].includes(C.goalOf(cfg, e.ex)!) ? ' accent' : '') }, goal) : null, carePills(cfg, e.ex)),
        h('div', { class: 'sub' }, progScheme(cfg, e), e.was ? ' · вместо «' + C.exName(cfg, e.was) + '»' : ''),
        e.lack ? h('div', { class: 'sub', style: 'color:var(--warn)' }, 'Не хватает: ' + e.lack) : null),   // (в эталоне нет) объём, который после замены вернуть не вышло (balance.ts)
      can ? h('button', { type: 'button', class: 'btn sm' + (open ? ' ghost' : ''), id: sid, 'aria-expanded': open ? 'true' : 'false', 'aria-label': (open ? 'Не заменять: ' : 'Заменить упражнение: ') + nm,
        onclick: () => edit.swapOpen(open ? null : sl.id, i) }, open ? 'Отмена' : 'Заменить') : null,
      pick);
  });
  return h('div', { class: 'pday' },
    h('div', { class: 'pday-h' }, h('b', null, sl.n), h('span', { class: 'sub' }, loadText(load) + (list.length ? ' · ≈ ' + C.fmtDur(C.estMinutes(cfg, list, D.cfg.rest)) : ''))),
    rows.length ? rows : h('p', { class: 'sub', style: 'padding:10px 0' }, 'В этот день упражнений пока нет.'));
}
