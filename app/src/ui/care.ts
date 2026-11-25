/* (в эталоне нет) Что беречь и дни подряд (решения владельца, 25 ноября 2026, пункты 2 и 6 разбора «Чего не хватает сборке программы»).
   careBox — больные места и стоп-упражнения: в онбординге это свой шаг после «Цели и времени», в «Настройке» — карточка в свёрнутой части.
   Больное место ничего не убирает: у упражнений, которые его нагружают, в собранной программе и в списке замен красная пилюля (builtday.ts).
   Стоп-упражнение сборка не ставит и в заменах не предлагает (core/rules.ts, stopOf). pairsRow — какие дни программы идут подряд:
   в двух днях подряд мышца основная только в одном (core/rules.ts, pairsOf). Только с днями «День N». */
import { C, h } from './dom.ts';
import { S } from './state.ts';
import { saveCfg } from './storage.ts';
import { toast } from './toast.ts';
import { D, render } from './render.ts';
import { dayNo } from '../core/days.ts';
import { ZONES, dayLinks, pairsOf } from '../core/rules.ts';

/* настройка изменилась: черновик сборки и план считаются заново */
const fresh = () => { S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null; render(true); };

/** Больные места и стоп-упражнения */
export function careBox(ro?: boolean) {
  const cfg = D.cfg, care = cfg.care || [];
  const zone = async (id: string) => {
    if (!(await saveCfg(raw => { const L = Array.isArray(raw.care) ? raw.care.filter((x: string) => x !== id) : []; if (!care.includes(id)) L.push(id); if (L.length) raw.care = L; else delete raw.care; }))) return;
    fresh();
  };
  const stop = async (id: string, on: boolean) => {
    if (!(await saveCfg(raw => { const e = raw.ex[id]; if (!e) return; if (on) e.stop = true; else delete e.stop; }))) return;
    fresh();
  };
  const stops = Object.keys(cfg.ex).filter(id => cfg.ex[id].stop).sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const can = Object.keys(cfg.ex).filter(id => !cfg.ex[id].stop && cfg.ex[id].mode !== 'light').sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  return h('div', { id: 'care' },
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Что болит'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Упражнения на это место останутся с красной пометкой — заменишь сам.'),
    h('div', { class: 'picks', role: 'group', 'aria-label': 'Что болит' }, ZONES.map(z => h('button', { type: 'button', class: 'btn sm', id: 'care-' + z.id, disabled: !!ro, 'aria-pressed': String(care.includes(z.id)), onclick: () => zone(z.id) }, z.n))),
    h('div', { class: 'eyebrow', style: 'margin:14px 0 4px' }, 'Стоп-упражнения'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Их не будет в программе и в заменах.'),
    stops.length ? h('div', { class: 'picks', id: 'stop-list', style: 'margin-bottom:8px' }, stops.map(id => h('span', { class: 'tag crit stop' }, C.exName(cfg, id),
      ro ? null : h('button', { type: 'button', class: 'x', id: 'stop-off-' + id, 'aria-label': 'Убрать из стоп-упражнений: ' + C.exName(cfg, id), onclick: () => stop(id, false) }, '×')))) : null,
    ro ? null : h('select', { id: 'stop-add', 'aria-label': 'Добавить стоп-упражнение', onchange: e => { if (e.target.value) stop(e.target.value, true); } },
      h('option', { value: '', selected: true, text: 'Добавить стоп-упражнение…' }),
      can.map(id => h('option', { value: id, text: C.exName(cfg, id) }))));
}

/** Какие дни программы идут подряд: соседние дни по кругу, при двух днях — ничего */
export function pairsRow() {
  const cfg = D.cfg, links = dayLinks(C.SLOTS);
  if (!links.length) return null;
  const on = (k: string) => (cfg.pairs || []).includes(k), live = pairsOf(cfg, C.SLOTS).length;
  const flip = async (k: string) => {
    if (!on(k) && live + 1 >= links.length) { toast('Все дни подряд не бывают: между последним и первым днём недели есть отдых'); return; }
    if (!(await saveCfg(raw => { const L = Array.isArray(raw.pairs) ? raw.pairs.filter((x: string) => x !== k) : []; if (!on(k)) L.push(k); if (L.length) raw.pairs = L; else delete raw.pairs; }))) return;
    fresh();
  };
  return h('div', { class: 'pf', id: 'pp' }, h('span', null, 'Дни подряд'), h('div', { class: 'picks', role: 'group', 'aria-label': 'Какие дни программы идут подряд' },
    links.map(([a, b]) => { const k = a + '-' + b; return h('button', { type: 'button', class: 'btn sm', id: 'pp-' + k, 'aria-pressed': String(on(k)), onclick: () => flip(k) }, dayNo(a) + '–' + dayNo(b)); })));
}
