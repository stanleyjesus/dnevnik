/* Экран «Мышцы».
   Перенесено из reference/src/ui3.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { C, h } from './dom.ts';
import { S } from './state.ts';
import { D, render } from './render.ts';
import { zonePill } from './charts.ts';
import { keyMark, zoneMark } from './marks.ts';
import { bodyMap } from './bodymap.ts';
import { carousel, kept } from './carousel.ts';   // (в эталоне нет) группы мышц каруселью с днями «День N»
import { appRules } from '../core/rules.ts';
import type { Muscle, WeekInfo } from '../core/index.ts';

/* ---------- muscles ---------- */
/* the load on a body: what was actually done on average, or what the programme gives */
export function bodyCard() {
  const ui = S.ui, z = D.cfg.zones, hasFact = D.wi.ref.length > 0, pl = C.planned(D.W.filter(w => !w.open), D.cfg), plan = pl.pv;
  const by = ui.bodyBy === 'plan' || !hasFact ? 'plan' : 'fact', vals = by === 'fact' ? D.avg : plan, sel = ui.bodySel && C.MUSCLE[ui.bodySel] ? ui.bodySel : null;
  const sw = (k: string, t: string) => h('span', { class: 'sw' }, h('i', { class: 'hc z-' + k }), appRules() ? keyMark(k === 'cur' ? 'off' : k) : null, t);   // (в эталоне нет) с днями «День N» у цвета — значок зоны из столбца «Оценка»
  let info = h('p', { class: 'sub' }, 'Нажми на мышцу или подпись, чтобы увидеть оценку и что с ней делать.');
  if (sel) {
    const v = vals[sel] || 0, k = C.zone(v, z), off = D.cfg.ignore[sel] && v < z.opt, split = C.splitText(v, ((by === 'fact' ? D.avgS : pl.ps) || {})[sel] || 0);
    info = h('div', { class: 'why' }, h('div', { class: 'row' }, h('b', { id: 'bm-sel' }, C.MUSCLE[sel].n + ': ' + C.nSets(+v.toFixed(1)) + ' в неделю' + (split ? ' (' + split + ')' : '')), off ? h('span', { class: 'pill' }, 'вне расчёта') : zonePill(v, z)),
      h('div', { class: 'sub' }, off ? 'Мышца вне расчёта: дневник сам подходы ей не выделяет и не считает её пробелом. Прибавить можно кнопкой «+» на вкладке «Программа».' : k === 'opt' ? 'В рабочей зоне ' + z.opt + '–' + z.high + '. Менять ничего не нужно.' : k === 'high' ? 'Выше ' + z.high + ' подходов отдача от каждого следующего мала. Если веса в этих упражнениях не растут, убери 2–4 подхода.' : 'До рабочей зоны не хватает ' + C.nSets(+(z.opt - v).toFixed(1)) + '. Что добавить: ' + C.FIX[sel] + '.'));
  }
  return h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Нагрузка на теле'), h('p', { class: 'note' }, by === 'fact' ? 'Подходов в неделю по факту: среднее за недели ' + D.wi.ref.map(w => w.no).join(', ') + '.' : 'Подходов в неделю, которые даёт текущая программа' + (hasFact ? '.' : ': полных недель по факту пока нет.'))),
      hasFact ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Что показать на теле' }, h('button', { id: 'bm-fact', 'aria-pressed': String(by === 'fact'), onclick: () => { ui.bodyBy = 'fact'; render(true); } }, 'По факту'), h('button', { id: 'bm-plan', 'aria-pressed': String(by === 'plan'), onclick: () => { ui.bodyBy = 'plan'; render(true); } }, 'По программе')) : null),
    bodyMap(vals, { z, ignore: D.cfg.ignore, sel, pick: m => { ui.bodySel = ui.bodySel === m ? null : m; render(true); } }),
    h('div', { class: 'scale', style: 'margin:10px 0' }, sw('none', 'нет нагрузки'), sw('low', 'мало: до ' + z.min), sw('base', 'ниже рабочей: ' + z.min + '–' + z.opt), sw('opt', 'рабочая зона: ' + z.opt + '–' + z.high), sw('high', 'выше зоны'), sw('off', 'вне расчёта')),
    info);
}
export function vMuscles() {
  if (!D.W.length) return S.conn !== 'ready' ? [] : D.cfg.program ? [bodyCard()] : [h('div', { class: 'card empty' }, 'Расчёт появится после первых тренировок.')];
  const out = [bodyCard()], z = D.cfg.zones, ui = S.ui, weeks = D.wi.weeks;
  const refTxt = D.wi.ref.length ? 'недели ' + D.wi.ref.map(w => w.no).join(', ') : '–';
  /* a cell is coloured by its zone; a week that is still going on and muscles outside the goal are not judged */
  const cellZ = (m: Muscle, w: WeekInfo, v: number) => !w.count ? 'z-off' : w.current && !w.complete ? 'z-cur' : D.cfg.ignore[m.id] && v < z.opt ? 'z-off' : 'z-' + C.zone(v, z);
  /* (в эталоне нет) с днями «День N» группы мышц — карточки карусели (просьба владельца, 26 ноября 2026): в карточке — последние четыре недели,
     три полные, по которым стоит оценка, и текущая; строка мышцы — название, под ним недели, среднее и оценка */
  const wk = appRules() ? weeks.slice(-4) : weeks;
  const head = () => h('tr', null, h('th', null, 'Мышца'), wk.map(w => h('th', { style: 'text-align:center', title: C.fmtDate(w.from) + ' – ' + C.fmtDate(w.to) }, 'н' + w.no)), h('th', null, 'Среднее'), h('th', { style: 'text-align:left' }, 'Оценка'));
  const row = (m: Muscle) => h('tr', null, h('td', null, m.n),
      wk.map(w => {
        const v = (D.vol[w.no] && D.vol[w.no].m[m.id]) || 0, sel = ui.cell && ui.cell.m === m.id && ui.cell.w === w.no;
        return h('td', null, h('button', { class: 'hc ' + cellZ(m, w, v) + (w.current && !w.complete ? ' cur' : '') + (sel ? ' sel' : ''), 'aria-pressed': String(!!sel), 'aria-label': m.n + ', неделя ' + w.no + ': ' + C.fmt(v, 1), onclick: () => { ui.cell = { m: m.id, w: w.no }; render(true); } }, w.count ? C.fmt(v, 1) : '–'));
      }),
      h('td', null, h('b', null, C.fmt(D.avg[m.id], 1)), C.splitText(D.avg[m.id], D.avgS[m.id] || 0) ? h('span', { class: 'msplit', id: 'mavg-' + m.id, text: '(' + C.splitText(D.avg[m.id], D.avgS[m.id] || 0) + ')' }) : null), h('td', { style: 'text-align:left' }, appRules() ? zoneMark(D.avg[m.id], z, !!D.cfg.ignore[m.id] && D.avg[m.id] < z.opt) : D.cfg.ignore[m.id] && D.avg[m.id] < z.opt ? h('span', { class: 'pill' }, 'вне расчёта') : zonePill(D.avg[m.id], z)));   // (в эталоне нет) с днями «День N» — значок зоны без подписи, что он значит — в легенде под таблицей (marks.ts)
  const body = [];
  let g = null;
  for (const m of C.MUSCLES) {
    if (m.g !== g) { g = m.g; body.push(h('tr', { class: 'g' }, h('td', { colspan: wk.length + 3 }, h('span', { class: 'eyebrow' }, g)))); }
    body.push(row(m));
  }
  let detail;
  if (ui.cell && C.MUSCLE[ui.cell.m]) {
    const v = D.vol[ui.cell.w], d = v && v.detail[ui.cell.m] ? Object.values(v.detail[ui.cell.m]) : [];
    const tot = (v && v.m[ui.cell.m]) || 0, strong = (v && v.s && v.s[ui.cell.m]) || 0;
    detail = h('div', null, h('h3', { id: 'cell-h' }, C.MUSCLE[ui.cell.m].n + ', неделя ' + ui.cell.w + ': ' + C.nSets(+tot.toFixed(2)) + (C.splitText(tot, strong) ? ' (' + C.splitText(tot, strong) + ')' : '')),
      d.length ? h('div', { class: 'plan-list', style: 'margin-top:6px' }, d.sort((a, b) => b.v - a.v).map(e => h('div', { class: 'plan-row' }, h('span', { class: 'n', text: C.exName(D.cfg, e.ex) }), h('span', { class: 'sub' }, C.nSets(+e.n.toFixed(2)) + (e.eff !== e.n ? ', в зачёт ' + C.fmt(e.eff, 1) + ' (запас от 3 повторов — за половину)' : '') + (e.c >= 1 ? ', основная мышца' : ' × ' + C.fmt(e.c, 2) + ', помогает') + ' = '), h('b', null, C.fmt(e.v, 1)))))
        : h('p', { class: 'sub', style: 'margin-top:4px' }, 'На этой неделе мышца не работала ни в одном упражнении. ' + 'Что добавить: ' + C.FIX[ui.cell.m] + '.'));
  } else detail = h('p', { class: 'sub' }, 'Нажми на ячейку, чтобы увидеть, из каких упражнений сложилась цифра.');

  const sw = (k: string, t: string) => h('span', { class: 'sw' }, h('i', { class: 'hc z-' + k }), appRules() ? keyMark(k === 'cur' ? 'off' : k) : null, t);   // (в эталоне нет) с днями «День N» у цвета — значок зоны, как в столбце «Оценка»
  const groups = [...new Set(C.MUSCLES.map(m => m.g))];
  out.push(h('section', { class: 'card' },
    appRules() ? h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Подходы на мышцу по неделям'))) :   // (в эталоне нет) с днями «День N» без пояснения над таблицей (просьба владельца, 26 ноября 2026)
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Подходы на мышцу по неделям'), h('p', { class: 'note' }, 'Подход, где мышца работает основной, считается за 1, где помогает — за 0.5. Подход, после которого в запасе осталось 3 повтора и больше, идёт за половину: ' + (appRules() ? 'у подходов по проценту от максимума' : 'у базовых по волне') + ' запас считается по проценту, если ты не отметил его сам. Оценка стоит по среднему за три последние полные недели (' + refTxt + ').'))),
    appRules() ? h('div', null, carousel(groups.map(gr => h('div', { class: 'pday' }, h('div', { class: 'pday-h' }, h('b', null, gr)),
      h('div', { class: 'scroll-x' }, h('table', { class: 'heat card-heat', style: '--wk:' + wk.length }, h('thead', null, head()), h('tbody', null, C.MUSCLES.filter(m => m.g === gr).map(row)))))),
      kept('mg'), { id: 'mg-days', dot: i => 'mg-dot-' + i, lab: i => groups[i], aria: 'Группы мышц' }))
    : h('div', { class: 'scroll-x to-end' }, h('table', { class: 'heat' }, h('thead', null, head()), h('tbody', null, body))),
    h('div', { class: 'scale', style: 'margin-top:12px' }, sw('none', 'нет нагрузки'), sw('low', 'мало: до ' + z.min), sw('base', 'ниже рабочей: ' + z.min + '–' + z.opt), sw('opt', 'рабочая зона: ' + z.opt + '–' + z.high), sw('high', 'выше зоны: больше ' + z.high), sw('cur', 'неделя ещё идёт или мышца вне расчёта')),
    h('hr', { class: 'rule' }), detail));

  /* карточки «Баланс движений» нет: баланс движений дневник не считает (решение владельца, 23 ноября 2026) */

  if (!appRules()) out.push(h('details', { class: 'card' }, h('summary', { style: 'cursor:pointer;font-weight:600' }, 'На чём основаны оценки'),   // (в эталоне нет) с днями «День N» этого блока нет (просьба владельца, 26 ноября 2026)
    h('div', { class: 'note stack', style: 'gap:8px;margin-top:10px' },
      h('p', null, 'Границы ' + z.min + ' / ' + z.opt + ' / ' + z.high + ' подходов в неделю — практический ориентир, а не закон: рост мышц увеличивается вместе с недельным числом подходов, но каждый следующий подход добавляет всё меньше. Около 4 подходов в неделю — нижний порог, при котором рост заметен; 10–20 — зона, где обычно лежит разумный баланс между результатом, временем и восстановлением.'),
      h('p', null, 'Способ счёта (прямой подход = 1, косвенный = 0.5) взят из мета-регрессии Pelland и соавторов о дозе недельного объёма; там же показано, что сила выходит на плато при заметно меньшем объёме, чем гипертрофия. Близость к отказу (RIR 1 в твоей методике) важна именно для роста мышц — это вывод мета-регрессии Robinson и соавторов.'),
      h('p', null, 'Коэффициенты упражнений и сами границы можно изменить в настройке.'))));
  return out;
}
