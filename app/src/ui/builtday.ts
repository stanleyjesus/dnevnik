/* (в эталоне нет) День программы, которую собрал дневник: онбординг и вкладка «Программа» с днями «День N», кроме «Вручную».
   Решение владельца, 25 ноября 2026: порядок и подходы уже посчитала сборка, поэтому у упражнения только «Заменить» — под кнопкой
   упражнения на те же мышцы, а частично совпадающие — в свёрнутой строке (или сразу, когда других нет). Стрелки «выше», «−» и «+»
   подходов, «убрать», пометок «новое», «перенос», «+N подходов» и строки «В день» здесь нет: они остались «Вручную», своей программе
   и программе текстом в онбординге (progDay). Подходы мышце по-прежнему прибавляются и убавляются кнопками у мышцы.
   Замена — та же, что в progDay (draft.ts): подходы остаются, «вместо «…»» показывает, что было. Полоса слева — то, что меняется
   против действующей программы: замена, новое или перенесённое упражнение, другое число подходов, другая роль базового */
import { C, h } from './dom.ts';
import { D } from './render.ts';
import { dayLoad, loadText, progScheme } from './program.ts';
import type { Cfg, ProgEntry, Slot, Swap } from '../core/types.ts';
import type { Marked, ProgEdit } from './types.ts';

/* was — подходов в этом дне у действующей программы (null — сравнивать не с чем: программы нет), marked — у базового сменилась роль */
export function builtDay(cfg: Cfg, sl: Slot, list: ProgEntry[], load: number, was: number | null, edit: ProgEdit, marked: Marked | null) {
  const rows = list.map((e, i) => {
    const k = C.kindOf(cfg, e.ex), nm = C.exName(cfg, e.ex), sid = 'sw-' + sl.id + '-' + i, goal = k === 'base' ? C.goalName(cfg, e.ex) : null;
    const alts = k === 'compound' || k === 'iso' ? C.swapsFor(cfg, e.ex, list.map(x => x.ex)) : null, can = !!alts && alts.same.length + alts.near.length > 0;
    const open = can && edit.swapAt === sl.id + ':' + i;
    let first = true;                                                   // первое упражнение списка получает фокус, когда список открывается (swapOpen в draft.ts)
    const card = (x: Swap, note: string) => h('button', { type: 'button', class: 'ex-card', id: first ? (first = false, sid + '-to') : null, onclick: () => edit.swap(sl.id, i, x) }, h('span', { class: 'nm' }, x.n), note ? h('span', { class: 'sub' }, note) : null);
    const added = (x: Swap) => x.def ? 'добавится в справочник' : '';
    const near = (x: Swap) => card(x, ['мышцы совпадают частично: ' + x.main!.map(m => C.MUSCLE[m].n.toLowerCase()).join(', '), added(x)].filter(Boolean).join(' · '));
    const pick = open ? h('div', { class: 'stack swaprow', style: 'gap:6px' },
      alts!.same.map(x => card(x, added(x))),
      !alts!.near.length ? null : alts!.same.length
        ? h('details', null, h('summary', { class: 'sub', style: 'cursor:pointer' }, 'Ещё похожие: ' + alts!.near.length), h('div', { class: 'stack', style: 'gap:6px;margin-top:6px' }, alts!.near.map(near)))
        : alts!.near.map(near)) : null;
    const changed = e.was || (was != null && (e.isNew || e.chg)) || (marked && marked(e));
    return h('div', { class: 'prow' + (changed ? ' changed' : '') + (open ? ' swapping' : '') },
      h('div', { class: 'grow' },
        h('div', { class: 'pn' }, nm, goal ? h('span', { class: 'tag' + (['strength', 'auto'].includes(C.goalOf(cfg, e.ex)!) ? ' accent' : '') }, goal) : null),
        h('div', { class: 'sub' }, progScheme(cfg, e), e.was ? ' · вместо «' + C.exName(cfg, e.was) + '»' : '')),
      can ? h('button', { type: 'button', class: 'btn sm' + (open ? ' ghost' : ''), id: sid, 'aria-expanded': open ? 'true' : 'false', 'aria-label': (open ? 'Не заменять: ' : 'Заменить упражнение: ') + nm,
        onclick: () => edit.swapOpen(open ? null : sl.id, i) }, open ? 'Отмена' : 'Заменить') : null,
      pick);
  });
  return h('div', { class: 'pday' },
    h('div', { class: 'pday-h' }, h('b', null, sl.n), h('span', { class: 'sub' }, loadText(load) + (was != null && Math.abs(was - load) >= 0.5 ? ' · было ' + dayLoad(was) : '') + (list.length ? ' · ≈ ' + C.fmtDur(C.estMinutes(cfg, list, D.cfg.rest)) : ''))),
    rows.length ? rows : h('p', { class: 'sub', style: 'padding:10px 0' }, 'В этот день упражнений пока нет.'));
}
