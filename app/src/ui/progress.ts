/* Экран «Прогресс».
   Перенесено из reference/src/ui3.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C, h, icon, pill, toNum } from './dom.ts';
import { PT, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { D, render } from './render.ts';
import { barChart, chartHost, lineChart, setChip, spark } from './charts.ts';
import { goalTag, STATUS } from './overview.ts';
import { appRules, statusOf } from '../core/rules.ts';
import type { ExStat, Slot } from '../core/index.ts';
import type { Point } from './types.ts';

/* ---------- UI part 3: progress, muscles, coach, setup ---------- */
export function vProgress() {
  if (!D.W.length) return S.conn === 'ready' ? [h('div', { class: 'card empty' }, 'Графики появятся после первых тренировок.')] : [];
  const out = [], start = C.dnum(D.cfg.start!), ui = S.ui;
  const last = D.idx[D.idx.length - 1];
  out.push(h('div', { class: 'grid2 even' },
    h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('h2', null, 'Индекс силы'), h('span', { class: 'sub' }, last ? C.fmt(last.idx, 0) + ' · ' + C.signed(last.idx - 100) + '% к первой неделе' : '')),
      chartHost((el, W) => lineChart(el, W, { label: 'Индекс силы по неделям', start, h: 210, series: [{ name: 'Индекс силы', color: 'var(--s1)', area: true, end: true, pts: D.idx.map(x => ({ x: start + (x.week - 1) * 7, y: x.idx })) }],
        title: x => 'Неделя ' + (Math.floor((x - start) / 7) + 1), tip: x => { const r = D.idx.find(q => start + (q.week - 1) * 7 === x); return r ? [{ color: 'var(--s1)', v: C.fmt(r.idx, 1), k: r.shared ? 'по ' + r.shared + ' упражнениям' : 'точка отсчёта' }] : []; } })),
      h('p', { class: 'note', style: 'margin-top:8px' }, 'Первая неделя = 100. Каждую неделю индекс меняется на среднее изменение расчётного максимума в упражнениях, которые были и неделей раньше, поэтому замена упражнений его не ломает.')),
    h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('h2', null, 'Рабочие подходы по неделям')),
      chartHost((el, W) => barChart(el, W, { label: 'Рабочие подходы по неделям', h: 210, bars: D.wi.weeks.map(w => ({ label: 'н' + w.no, title: 'Неделя ' + w.no + (w.current ? ' (идёт)' : ''), v: D.vol[w.no] ? D.vol[w.no].sets : 0, muted: w.current && !w.complete, note: w.count + ' ' + C.plural(w.count, ['тренировка', 'тренировки', 'тренировок']) })) })),
      h('p', { class: 'note', style: 'margin-top:8px' }, 'Здесь все подходы с записанными повторами, без разминочных и без поправки на запас. Правая и левая рука вместе дают один подход. Серый столбец — текущая неделя.'))));

  /* exercises */
  const shown = D.stats.filter(s => ui.exAll || s.active);
  if (!ui.exSel || !D.statBy[ui.exSel]) ui.exSel = (shown[0] || D.stats[0]).id;
  const sel = D.statBy[ui.exSel];
  out.push(h('section', { class: 'stack', style: 'gap:12px' },
    h('div', { class: 'sec-h', style: 'margin-bottom:0' }, h('h2', null, 'Упражнения'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Какие упражнения показать' }, h('button', { 'aria-pressed': String(!ui.exAll), onclick: () => { ui.exAll = false; render(true); } }, 'В программе'), h('button', { 'aria-pressed': String(ui.exAll), onclick: () => { ui.exAll = true; render(true); } }, 'Все'))),
    exerciseDetail(sel, start),
    h('div', { class: 'ex-grid' }, shown.map(s => {
      const st = s.active ? STATUS[statusOf(D.cfg, s)] : null;
      return h('button', { class: 'ex-card', 'aria-pressed': String(s.id === ui.exSel), onclick: () => { ui.exSel = s.id; ui.hist = false; render(true); const el = $('ex-detail'); if (el) el.scrollIntoView({ block: 'nearest' }); } },
        h('span', { class: 'nm', text: C.exName(D.cfg, s.id) }),
        h('div', { class: 'ln' }, h('span', { class: 'big' }, C.fmt(s.last.best.w) + ' × ' + s.last.best.r), spark(s.ss.map(x => x.metric), s.active ? null : 'var(--deemph)')),
        h('div', { class: 'ln' }, h('span', { class: 'tag' }, C.signed(s.delta) + '% за ' + s.n + ' ' + C.plural(s.n, ['тренировку', 'тренировки', 'тренировок'])), st ? pill(st[0], st[1]) : h('span', { class: 'tag' }, 'не в программе')));
    }))));

  out.push(bodySection());
  return out;
}
export function exerciseDetail(s: ExStat, start: number) {
  const ui = S.ui, cyc = C.isCycle(D.cfg, s.id) && (!appRules() || s.ss.every(x => x.item.cyc)), st = s.active ? STATUS[statusOf(D.cfg, s)] : null;   // (в эталоне нет) с днями «День N» у базового бывают записи и по двойной прогрессии: тогда график — как у подсобки; статус — по тренду (rules.ts, statusOf)
  const wave = cyc && !appRules();   // (в эталоне нет) с днями «День N» максимум у всех упражнений — по подходам: подписи как у подсобки
  const ex = D.cfg.ex[s.id] || { m: {} };
  const mus = Object.entries(ex.m || {}).sort((a, b) => b[1] - a[1]).map(e => (C.MUSCLE[e[0]] || {}).n + (e[1] < 1 ? ' ½' : '')).join(', ');
  const day = (x: { date: string }) => C.dnum(x.date);
  let chart;
  if (ui.metric === 'e1') {
    chart = chartHost((el, W) => lineChart(el, W, { label: 'Расчётный максимум', start, unit: ' кг', series: [{ name: wave ? 'Расчётный максимум по волне' : 'Расчётный 1ПМ лучшего подхода', color: 'var(--s1)', area: true, end: true, pts: s.ss.map(x => ({ x: day(x), y: x.metric })) }] }));
  } else if (cyc) {
    const cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'], order = Array.from(new Set(s.ss.map(x => x.item.cyc!.reps))).sort((a, b) => b - a).slice(0, 4);
    const pctOf = (r: number) => { const l = s.ss.filter(x => x.item.cyc!.reps === r); return l[l.length - 1].item.cyc!.pct; };
    chart = chartHost((el, W) => lineChart(el, W, { label: 'Рабочий вес по неделям волны', start, unit: ' кг', series: order.map((r, i) => ({ name: r + ' повт. · ' + pctOf(r) + '%', color: cols[i % 4], end: true, pts: s.ss.filter(x => x.item.cyc!.reps === r).map(x => ({ x: day(x), y: x.top.w! })) })).filter(q => q.pts.length),
      tip: x => s.ss.filter(q => day(q) === x).map(q => ({ color: cols[Math.max(0, order.indexOf(q.item.cyc!.reps)) % 4], v: q.sets.length + ' × ' + q.top.r + ' по ' + C.fmt(q.top.w) + ' кг', k: q.item.cyc!.pct + '%' })) }));
  } else {
    const rest: Point[] = [];
    for (const x of s.ss) for (const t of x.sets) if (t !== x.top && t.w !== x.top.w) rest.push({ x: day(x), y: t.w! });
    chart = chartHost((el, W) => lineChart(el, W, { label: 'Рабочий вес', start, unit: ' кг', series: [{ name: 'Самый тяжёлый подход', color: 'var(--s1)', end: true, pts: s.ss.map(x => ({ x: day(x), y: x.top.w! })) }], dots: rest.length ? { name: 'Остальные подходы', pts: rest } : null,
      tip: x => { const q = s.ss.find(k => day(k) === x); return q ? q.sets.map((t, i) => ({ color: t === q.top ? 'var(--s1)' : 'var(--deemph)', v: C.fmt(t.w) + ' × ' + t.r, k: 'подход ' + (i + 1) })) : []; } }));
  }
  const rows = s.ss.slice().reverse(), lim = ui.hist ? rows.length : 6;   // (в эталоне нет) с днями «День N» в строке тренировки — только лучший подход, по нему считается максимум (просьба владельца, 26 ноября 2026)
  const tbl = h('table', null, h('thead', null, h('tr', null, h('th', null, 'Дата'), h('th', { style: 'text-align:left' }, appRules() ? 'Лучший подход' : 'Подходы'), h('th', null, wave ? 'Максимум' : 'Расч. 1ПМ'), h('th', null, 'К прошлой'))),
    h('tbody', null, rows.slice(0, lim).map((x, i) => { const p = rows[i + 1]; return h('tr', null, h('td', null, C.fmtDate(x.date) + ', ' + ((C.SLOT[x.slot!] || {} as Slot).s || '')), h('td', { class: 'wrapc' }, h('div', { class: 'chips', style: 'justify-content:flex-start' }, appRules() ? setChip(x.best) : x.item.sets.map(t => setChip(t)))), h('td', null, C.fmt(x.metric, 1)), h('td', null, p ? C.signed(C.pct(x.metric, p.metric), 1) + '%' : '–')); })));
  return h('div', { class: 'card', id: 'ex-detail' },
    h('div', { class: 'sec-h' }, h('div', null, h('h3', { style: 'font-size:18px', text: C.exName(D.cfg, s.id) }), h('p', { class: 'sub' }, (mus || 'мышцы не указаны') + (goalTag(D.cfg, s.id) ? ' · ' + goalTag(D.cfg, s.id) : ''))),
      h('div', { class: 'row' }, st ? pill(st[0], st[1]) : h('span', { class: 'tag' }, 'не в программе'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Что показать на графике' }, h('button', { 'aria-pressed': String(ui.metric === 'w'), onclick: () => { ui.metric = 'w'; render(true); } }, 'Рабочий вес'), h('button', { 'aria-pressed': String(ui.metric === 'e1'), onclick: () => { ui.metric = 'e1'; render(true); } }, 'Максимум')))),
    h('div', { class: 'kv' },
      h('div', null, h('b', null, C.fmt(s.last.best.w) + ' × ' + s.last.best.r), h('span', null, 'лучший подход, ' + C.fmtDate(s.last.date))),
      h('div', null, h('b', null, C.fmt(s.last.metric, 1) + ' кг'), h('span', null, wave ? 'расчётный максимум по волне' : 'расчётный 1ПМ (по Эпли)')),
      h('div', null, h('b', null, C.signed(s.delta) + '%'), h('span', null, 'с ' + C.fmtDate(s.first.date) + ' (' + C.fmt(s.first.best.w) + ' × ' + s.first.best.r + ')')),
      h('div', null, h('b', null, s.n), h('span', null, C.plural(s.n, ['тренировка', 'тренировки', 'тренировок'])))),
    chart,
    h('div', { class: 'scroll-x', style: 'margin-top:10px' }, tbl),
    rows.length > 6 ? h('button', { class: 'btn ghost sm', style: 'margin-top:6px', onclick: () => { ui.hist = !ui.hist; render(true); } }, ui.hist ? 'Свернуть' : 'Вся история: ' + rows.length) : null);
}
export function bodySection() {
  const r = C.bodyRate(S.body), start = C.dnum(D.cfg.start!), last = S.body[S.body.length - 1];
  const add = async () => {
    const date = $('bw-date')!.value || D.today, kg = toNum($('bw-kg')!.value);
    if (!(kg! > 20 && kg! < 400)) { toast('Введи вес в килограммах'); return; }
    try { await S.db!.doc(PT().body + '/' + date).set({ date, kg }); toast('Вес записан'); $('bw-kg')!.value = ''; } catch (e) { dbErr(e); }
  };
  return h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Вес тела'), h('p', { class: 'sub' }, last ? 'Последняя запись: ' + C.fmt(last.kg, 1) + ' кг, ' + C.fmtDate(last.date, true) + (r ? ' · ' + C.signed(r.perWeek, 2) + ' кг в неделю (' + C.signed(r.pctWeek, 2) + '%)' : '') : D.cfg.bw === 'track' ? 'Записывай вес 2–3 раза в неделю утром: по нему видно, куда идёт процесс.' : 'Для набора мышц ориентир — плюс 0.25–0.5% веса в неделю.'))),
    S.canWrite && S.db ? h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('label', { class: 'f' }, h('span', null, 'Дата'), h('input', { type: 'date', id: 'bw-date', value: D.today })),
      h('label', { class: 'f' }, h('span', null, 'Вес, кг'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'bw-kg', placeholder: last ? C.fmt(last.kg, 1) : '' })),
      h('button', { class: 'btn', style: 'align-self:flex-end', onclick: add }, 'Записать')) : null,
    S.body.length >= 2 ? chartHost((el, W) => lineChart(el, W, { label: 'Вес тела', start, unit: ' кг', h: 180, series: [{ name: 'Вес тела', color: 'var(--s1)', area: true, end: true, pts: S.body.map(b => ({ x: C.dnum(b.date), y: b.kg })) }] })) : null,
    S.body.length ? h('div', { class: 'chips', style: 'justify-content:flex-start;margin-top:10px' }, S.body.slice(-8).reverse().map(b => h('span', { class: 'chip' }, C.fmtDM(b.date) + ' · ' + C.fmt(b.kg, 1), S.canWrite ? h('button', { class: 'icon-btn', style: 'width:20px;height:20px', title: 'Удалить запись', 'aria-label': 'Удалить запись ' + C.fmtDM(b.date), onclick: async () => { try { await S.db!.doc(PT().body + '/' + b.id).delete(); } catch (e) { dbErr(e); } } }, icon('x')) : null))) : null);
}
