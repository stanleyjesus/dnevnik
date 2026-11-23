/* ---------- UI part 3: progress, muscles, coach, setup ---------- */
function vProgress() {
  if (!D.W.length) return S.conn === 'ready' ? [h('div', { class: 'card empty' }, 'Графики появятся после первых тренировок.')] : [];
  const out = [], start = C.dnum(D.cfg.start), ui = S.ui;
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
      const st = s.active ? STATUS[s.status] : null;
      return h('button', { class: 'ex-card', 'aria-pressed': String(s.id === ui.exSel), onclick: () => { ui.exSel = s.id; ui.hist = false; render(true); const el = $('ex-detail'); if (el) el.scrollIntoView({ block: 'nearest' }); } },
        h('span', { class: 'nm', text: C.exName(D.cfg, s.id) }),
        h('div', { class: 'ln' }, h('span', { class: 'big' }, C.fmt(s.last.best.w) + ' × ' + s.last.best.r), spark(s.ss.map(x => x.metric), s.active ? null : 'var(--deemph)')),
        h('div', { class: 'ln' }, h('span', { class: 'tag' }, C.signed(s.delta) + '% за ' + s.n + ' ' + C.plural(s.n, ['тренировку', 'тренировки', 'тренировок'])), st ? pill(st[0], st[1]) : h('span', { class: 'tag' }, 'не в программе')));
    }))));

  out.push(bodySection());
  return out;
}

function exerciseDetail(s, start) {
  const ui = S.ui, cyc = C.isCycle(D.cfg, s.id), st = s.active ? STATUS[s.status] : null;
  const ex = D.cfg.ex[s.id] || { m: {} };
  const mus = Object.entries(ex.m || {}).sort((a, b) => b[1] - a[1]).map(e => (C.MUSCLE[e[0]] || {}).n + (e[1] < 1 ? ' ½' : '')).join(', ');
  const day = x => C.dnum(x.date);
  let chart;
  if (ui.metric === 'e1') {
    chart = chartHost((el, W) => lineChart(el, W, { label: 'Расчётный максимум', start, unit: ' кг', series: [{ name: cyc ? 'Расчётный максимум по волне' : 'Расчётный 1ПМ лучшего подхода', color: 'var(--s1)', area: true, end: true, pts: s.ss.map(x => ({ x: day(x), y: x.metric })) }] }));
  } else if (cyc) {
    const cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'], order = Array.from(new Set(s.ss.map(x => x.item.cyc.reps))).sort((a, b) => b - a).slice(0, 4);
    const pctOf = r => { const l = s.ss.filter(x => x.item.cyc.reps === r); return l[l.length - 1].item.cyc.pct; };
    chart = chartHost((el, W) => lineChart(el, W, { label: 'Рабочий вес по неделям волны', start, unit: ' кг', series: order.map((r, i) => ({ name: r + ' повт. · ' + pctOf(r) + '%', color: cols[i % 4], end: true, pts: s.ss.filter(x => x.item.cyc.reps === r).map(x => ({ x: day(x), y: x.top.w })) })).filter(q => q.pts.length),
      tip: x => s.ss.filter(q => day(q) === x).map(q => ({ color: cols[Math.max(0, order.indexOf(q.item.cyc.reps)) % 4], v: q.sets.length + ' × ' + q.top.r + ' по ' + C.fmt(q.top.w) + ' кг', k: q.item.cyc.pct + '%' })) }));
  } else {
    const rest = [];
    for (const x of s.ss) for (const t of x.sets) if (t !== x.top && t.w !== x.top.w) rest.push({ x: day(x), y: t.w });
    chart = chartHost((el, W) => lineChart(el, W, { label: 'Рабочий вес', start, unit: ' кг', series: [{ name: 'Самый тяжёлый подход', color: 'var(--s1)', end: true, pts: s.ss.map(x => ({ x: day(x), y: x.top.w })) }], dots: rest.length ? { name: 'Остальные подходы', pts: rest } : null,
      tip: x => { const q = s.ss.find(k => day(k) === x); return q ? q.sets.map((t, i) => ({ color: t === q.top ? 'var(--s1)' : 'var(--deemph)', v: C.fmt(t.w) + ' × ' + t.r, k: 'подход ' + (i + 1) })) : []; } }));
  }
  const rows = s.ss.slice().reverse(), lim = ui.hist ? rows.length : 6;
  const tbl = h('table', null, h('thead', null, h('tr', null, h('th', null, 'Дата'), h('th', { style: 'text-align:left' }, 'Подходы'), h('th', null, cyc ? 'Максимум' : 'Расч. 1ПМ'), h('th', null, 'К прошлой'))),
    h('tbody', null, rows.slice(0, lim).map((x, i) => { const p = rows[i + 1]; return h('tr', null, h('td', null, C.fmtDate(x.date) + ', ' + ((C.SLOT[x.slot] || {}).s || '')), h('td', { class: 'wrapc' }, h('div', { class: 'chips', style: 'justify-content:flex-start' }, x.item.sets.map(t => setChip(t)))), h('td', null, C.fmt(x.metric, 1)), h('td', null, p ? C.signed(C.pct(x.metric, p.metric), 1) + '%' : '–')); })));
  return h('div', { class: 'card', id: 'ex-detail' },
    h('div', { class: 'sec-h' }, h('div', null, h('h3', { style: 'font-size:18px', text: C.exName(D.cfg, s.id) }), h('p', { class: 'sub' }, (mus || 'мышцы не указаны') + (goalTag(D.cfg, s.id) ? ' · ' + goalTag(D.cfg, s.id) : ''))),
      h('div', { class: 'row' }, st ? pill(st[0], st[1]) : h('span', { class: 'tag' }, 'не в программе'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Что показать на графике' }, h('button', { 'aria-pressed': String(ui.metric === 'w'), onclick: () => { ui.metric = 'w'; render(true); } }, 'Рабочий вес'), h('button', { 'aria-pressed': String(ui.metric === 'e1'), onclick: () => { ui.metric = 'e1'; render(true); } }, 'Максимум')))),
    h('div', { class: 'kv' },
      h('div', null, h('b', null, C.fmt(s.last.best.w) + ' × ' + s.last.best.r), h('span', null, 'лучший подход, ' + C.fmtDate(s.last.date))),
      h('div', null, h('b', null, C.fmt(s.last.metric, 1) + ' кг'), h('span', null, cyc ? 'расчётный максимум по волне' : 'расчётный 1ПМ (по Эпли)')),
      h('div', null, h('b', null, C.signed(s.delta) + '%'), h('span', null, 'с ' + C.fmtDate(s.first.date) + ' (' + C.fmt(s.first.best.w) + ' × ' + s.first.best.r + ')')),
      h('div', null, h('b', null, s.n), h('span', null, C.plural(s.n, ['тренировка', 'тренировки', 'тренировок'])))),
    chart,
    h('div', { class: 'scroll-x', style: 'margin-top:10px' }, tbl),
    rows.length > 6 ? h('button', { class: 'btn ghost sm', style: 'margin-top:6px', onclick: () => { ui.hist = !ui.hist; render(true); } }, ui.hist ? 'Свернуть' : 'Вся история: ' + rows.length) : null);
}

function bodySection() {
  const r = C.bodyRate(S.body), start = C.dnum(D.cfg.start), last = S.body[S.body.length - 1];
  const add = async () => {
    const date = $('bw-date').value || D.today, kg = toNum($('bw-kg').value);
    if (!(kg > 20 && kg < 400)) { toast('Введи вес в килограммах'); return; }
    try { await S.db.doc(PT().body + '/' + date).set({ date, kg }); toast('Вес записан'); $('bw-kg').value = ''; } catch (e) { dbErr(e); }
  };
  return h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Вес тела'), h('p', { class: 'sub' }, last ? 'Последняя запись: ' + C.fmt(last.kg, 1) + ' кг, ' + C.fmtDate(last.date, true) + (r ? ' · ' + C.signed(r.perWeek, 2) + ' кг в неделю (' + C.signed(r.pctWeek, 2) + '%)' : '') : D.cfg.bw === 'track' ? 'Записывай вес 2–3 раза в неделю утром: по нему видно, куда идёт процесс.' : 'Для набора мышц ориентир — плюс 0.25–0.5% веса в неделю.'))),
    S.canWrite && S.db ? h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('label', { class: 'f' }, h('span', null, 'Дата'), h('input', { type: 'date', id: 'bw-date', value: D.today })),
      h('label', { class: 'f' }, h('span', null, 'Вес, кг'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'bw-kg', placeholder: last ? C.fmt(last.kg, 1) : '' })),
      h('button', { class: 'btn', style: 'align-self:flex-end', onclick: add }, 'Записать')) : null,
    S.body.length >= 2 ? chartHost((el, W) => lineChart(el, W, { label: 'Вес тела', start, unit: ' кг', h: 180, series: [{ name: 'Вес тела', color: 'var(--s1)', area: true, end: true, pts: S.body.map(b => ({ x: C.dnum(b.date), y: b.kg })) }] })) : null,
    S.body.length ? h('div', { class: 'chips', style: 'justify-content:flex-start;margin-top:10px' }, S.body.slice(-8).reverse().map(b => h('span', { class: 'chip' }, C.fmtDM(b.date) + ' · ' + C.fmt(b.kg, 1), S.canWrite ? h('button', { class: 'icon-btn', style: 'width:20px;height:20px', title: 'Удалить запись', 'aria-label': 'Удалить запись ' + C.fmtDM(b.date), onclick: async () => { try { await S.db.doc(PT().body + '/' + b.id).delete(); } catch (e) { dbErr(e); } } }, icon('x')) : null))) : null);
}

/* ---------- muscles ---------- */
/* the load on a body: what was actually done on average, or what the programme gives */
function bodyCard() {
  const ui = S.ui, z = D.cfg.zones, hasFact = D.wi.ref.length > 0, pl = C.planned(D.W.filter(w => !w.open), D.cfg), plan = pl.pv;
  const by = ui.bodyBy === 'plan' || !hasFact ? 'plan' : 'fact', vals = by === 'fact' ? D.avg : plan, sel = ui.bodySel && C.MUSCLE[ui.bodySel] ? ui.bodySel : null;
  const sw = (k, t) => h('span', { class: 'sw' }, h('i', { class: 'hc z-' + k }), t);
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

function vMuscles() {
  if (!D.W.length) return S.conn !== 'ready' ? [] : D.cfg.program ? [bodyCard()] : [h('div', { class: 'card empty' }, 'Расчёт появится после первых тренировок.')];
  const out = [bodyCard()], z = D.cfg.zones, ui = S.ui, weeks = D.wi.weeks;
  const refTxt = D.wi.ref.length ? 'недели ' + D.wi.ref.map(w => w.no).join(', ') : '–';
  /* a cell is coloured by its zone; a week that is still going on and muscles outside the goal are not judged */
  const cellZ = (m, w, v) => !w.count ? 'z-off' : w.current && !w.complete ? 'z-cur' : D.cfg.ignore[m.id] && v < z.opt ? 'z-off' : 'z-' + C.zone(v, z);
  const head = h('tr', null, h('th', null, 'Мышца'), weeks.map(w => h('th', { style: 'text-align:center', title: C.fmtDate(w.from) + ' – ' + C.fmtDate(w.to) }, 'н' + w.no)), h('th', null, 'Среднее'), h('th', { style: 'text-align:left' }, 'Оценка'));
  const body = [];
  let g = null;
  for (const m of C.MUSCLES) {
    if (m.g !== g) { g = m.g; body.push(h('tr', { class: 'g' }, h('td', { colspan: weeks.length + 3 }, h('span', { class: 'eyebrow' }, g)))); }
    body.push(h('tr', null, h('td', null, m.n),
      weeks.map(w => {
        const v = (D.vol[w.no] && D.vol[w.no].m[m.id]) || 0, sel = ui.cell && ui.cell.m === m.id && ui.cell.w === w.no;
        return h('td', null, h('button', { class: 'hc ' + cellZ(m, w, v) + (w.current && !w.complete ? ' cur' : '') + (sel ? ' sel' : ''), 'aria-pressed': String(!!sel), 'aria-label': m.n + ', неделя ' + w.no + ': ' + C.fmt(v, 1), onclick: () => { ui.cell = { m: m.id, w: w.no }; render(true); } }, w.count ? C.fmt(v, 1) : '–'));
      }),
      h('td', null, h('b', null, C.fmt(D.avg[m.id], 1)), C.splitText(D.avg[m.id], D.avgS[m.id] || 0) ? h('span', { class: 'msplit', id: 'mavg-' + m.id, text: '(' + C.splitText(D.avg[m.id], D.avgS[m.id] || 0) + ')' }) : null), h('td', { style: 'text-align:left' }, D.cfg.ignore[m.id] && D.avg[m.id] < z.opt ? h('span', { class: 'pill' }, 'вне расчёта') : zonePill(D.avg[m.id], z))));
  }
  let detail;
  if (ui.cell && C.MUSCLE[ui.cell.m]) {
    const v = D.vol[ui.cell.w], d = v && v.detail[ui.cell.m] ? Object.values(v.detail[ui.cell.m]) : [];
    const tot = (v && v.m[ui.cell.m]) || 0, strong = (v && v.s && v.s[ui.cell.m]) || 0;
    detail = h('div', null, h('h3', { id: 'cell-h' }, C.MUSCLE[ui.cell.m].n + ', неделя ' + ui.cell.w + ': ' + C.nSets(+tot.toFixed(2)) + (C.splitText(tot, strong) ? ' (' + C.splitText(tot, strong) + ')' : '')),
      d.length ? h('div', { class: 'plan-list', style: 'margin-top:6px' }, d.sort((a, b) => b.v - a.v).map(e => h('div', { class: 'plan-row' }, h('span', { class: 'n', text: C.exName(D.cfg, e.ex) }), h('span', { class: 'sub' }, C.nSets(+e.n.toFixed(2)) + (e.eff !== e.n ? ', в зачёт ' + C.fmt(e.eff, 1) + ' (запас от 3 повторов — за половину)' : '') + (e.c >= 1 ? ', основная мышца' : ' × ' + C.fmt(e.c, 2) + ', помогает') + ' = '), h('b', null, C.fmt(e.v, 1)))))
        : h('p', { class: 'sub', style: 'margin-top:4px' }, 'На этой неделе мышца не работала ни в одном упражнении. ' + 'Что добавить: ' + C.FIX[ui.cell.m] + '.'));
  } else detail = h('p', { class: 'sub' }, 'Нажми на ячейку, чтобы увидеть, из каких упражнений сложилась цифра.');

  const sw = (k, t) => h('span', { class: 'sw' }, h('i', { class: 'hc z-' + k }), t);
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Подходы на мышцу по неделям'), h('p', { class: 'note' }, 'Подход, где мышца работает основной, считается за 1, где помогает — за 0.5. Подход, после которого в запасе осталось 3 повтора и больше, идёт за половину: у базовых по волне запас считается по проценту, если ты не отметил его сам. Оценка стоит по среднему за три последние полные недели (' + refTxt + ').'))),
    h('div', { class: 'scroll-x to-end' }, h('table', { class: 'heat' }, h('thead', null, head), h('tbody', null, body))),
    h('div', { class: 'scale', style: 'margin-top:12px' }, sw('none', 'нет нагрузки'), sw('low', 'мало: до ' + z.min), sw('base', 'ниже рабочей: ' + z.min + '–' + z.opt), sw('opt', 'рабочая зона: ' + z.opt + '–' + z.high), sw('high', 'выше зоны: больше ' + z.high), sw('cur', 'неделя ещё идёт или мышца вне расчёта')),
    h('hr', { class: 'rule' }), detail));

  /* movement patterns */
  const mx = Math.max(1, ...C.PATTERNS.map(p => D.pat[p.id] || 0));
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Баланс движений'), h('p', { class: 'note' }, 'Рабочих подходов в неделю по типам движений, среднее за ' + refTxt + '.'))),
    h('div', { class: 'meters' }, C.PATTERNS.map(p => {
      const v = D.pat[p.id] || 0, f = h('i', { class: 'fill' }); f.style.width = (v / mx * 100) + '%';
      return [h('span', { class: 'mn' }, p.n), h('div', { class: 'meter', role: 'img', 'aria-label': C.fmt(v, 1) + ' подходов' }, f), h('span', { class: 'mv' }, C.fmt(v, 1)), v > 0 ? h('span', { class: 'pill' }, '') : p.fix ? pill('warn', 'нет в программе') : h('span', { class: 'pill' }, '')];
    }))));

  out.push(h('details', { class: 'card' }, h('summary', { style: 'cursor:pointer;font-weight:600' }, 'На чём основаны оценки'),
    h('div', { class: 'note stack', style: 'gap:8px;margin-top:10px' },
      h('p', null, 'Границы ' + z.min + ' / ' + z.opt + ' / ' + z.high + ' подходов в неделю — практический ориентир, а не закон: рост мышц увеличивается вместе с недельным числом подходов, но каждый следующий подход добавляет всё меньше. Около 4 подходов в неделю — нижний порог, при котором рост заметен; 10–20 — зона, где обычно лежит разумный баланс между результатом, временем и восстановлением.'),
      h('p', null, 'Способ счёта (прямой подход = 1, косвенный = 0.5) взят из мета-регрессии Pelland и соавторов о дозе недельного объёма; там же показано, что сила выходит на плато при заметно меньшем объёме, чем гипертрофия. Близость к отказу (RIR 1 в твоей методике) важна именно для роста мышц — это вывод мета-регрессии Robinson и соавторов.'),
      h('p', null, 'Коэффициенты упражнений и сами границы можно изменить в настройке.'))));
  return out;
}

/* ---------- coach ---------- */
function mdLite(text) {
  const box = h('div', { class: 'coach-out' });
  const inline = (el, s) => { String(s).split(/\*\*(.+?)\*\*/g).forEach((part, i) => { if (part) el.appendChild(i % 2 ? h('b', { text: part }) : document.createTextNode(part)); }); return el; };
  let ul = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { ul = null; continue; }
    const m = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { if (!ul) { ul = h('ul'); box.appendChild(ul); } ul.appendChild(inline(h('li'), m[1])); }
    else { ul = null; box.appendChild(inline(h('p'), line.replace(/^#+\s*/, ''))); }
  }
  return box;
}
let coachCtl = null;
const COACH_ERR = { not_granted: 'Разбор не запрошен: доступ к Claude для этой страницы не разрешён.', sampling_disabled: 'Claude недоступен для этого аккаунта.', rate_limited: 'Лимит запросов исчерпан. Попробуй позже.', session_expired: 'Сессия истекла — войди в Claude заново.', refused: 'Claude отклонил запрос. Измени вопрос и попробуй ещё раз.', prompt_too_large: 'Слишком много данных для одного запроса.' };
async function askCoach() {
  const ui = S.ui;
  if (!S.sample || ui.coachBusy) return;
  ui.q = ($('coach-q') || {}).value || '';
  ui.coachBusy = true; ui.coachErr = null; ui.coachText = '';
  const gen = S.gen, doc = PT().coach;
  render(true);
  coachCtl = new AbortController();
  const outEl = () => $('coach-live');
  try {
    const res = await S.sample(C.coachPrompt(D.st, ui.q.trim()), { signal: coachCtl.signal, cache: false, onText: ({ text }) => { if (gen !== S.gen) return; ui.coachText = text; const el = outEl(); if (el) { el.textContent = ''; el.appendChild(mdLite(text)); } } });
    if (S.db && S.canWrite) { try { await S.db.doc(doc).set({ text: res.text, at: D.today, q: ui.q.trim() }); } catch (e) { /* the answer stays on screen */ } }
    if (gen !== S.gen) return;                                        // another profile was opened: the answer is saved where it belongs
    ui.coachText = res.text;
    S.coach = { text: res.text, at: D.today, q: ui.q.trim() };
    ui.coachText = null;
  } catch (e) {
    if (gen !== S.gen) return;
    const code = e && e.code;
    if (code !== 'cancelled') ui.coachErr = COACH_ERR[code] || 'Не получилось получить разбор. Попробуй ещё раз.';
    if (e && e.text) { S.coach = { text: e.text, at: D.today, q: ui.q.trim(), cut: true }; }
    ui.coachText = null;
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared') S.sample = null;
  }
  ui.coachBusy = false; coachCtl = null;
  render(true);
}
function vCoach() {
  if (!D.W.length) return S.conn === 'ready' ? [h('div', { class: 'card empty' }, 'Советы появятся после первых тренировок.')] : [];
  const out = [], ui = S.ui;
  const cnt = k => D.ins.filter(i => i.sev === k).length;
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Замечания дневника'), h('p', { class: 'note' }, 'Пересчитываются после каждой записи по твоим правилам прогрессии и недельному объёму.')),
      h('div', { class: 'row', style: 'gap:12px' }, cnt('crit') ? pill('crit', 'критично: ' + cnt('crit')) : null, cnt('warn') ? pill('warn', 'внимание: ' + cnt('warn')) : null, pill('info', 'заметки: ' + cnt('info')), pill('good', 'хорошо: ' + cnt('good')))),
    D.ins.map(i => insightEl(i, true))));

  const saved = S.coach && S.coach.text;
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Разбор от Claude'), h('p', { class: 'note' }, 'Claude получает твою методику, тренировки за последние недели, объём по мышцам и замечания выше и отвечает, что поменять на ближайшие одну-две недели. Запрос расходует лимит твоего аккаунта Claude.'))),
    S.sample ? [
      h('label', { class: 'f' }, h('span', null, 'Вопрос к разбору (необязательно)'), h('textarea', { id: 'coach-q', placeholder: 'Например: куда поставить румынскую тягу и икры, чтобы тренировка не стала длиннее?', oninput: e => { ui.q = e.target.value; } }, ui.q || '')),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn primary', disabled: ui.coachBusy, onclick: askCoach }, ui.coachBusy ? 'Claude думает…' : saved ? 'Запросить новый разбор' : 'Запросить разбор'), ui.coachBusy ? h('button', { class: 'btn', onclick: () => { if (coachCtl) coachCtl.abort(); } }, 'Остановить') : null)
    ] : h('p', { class: 'sub' }, 'Кнопка появится, когда страница открыта в Claude и доступ к нему разрешён. Тот же разбор можно попросить прямо в чате проекта: Claude читает записи дневника.'),
    ui.coachErr ? h('p', { class: 'banner crit', style: 'margin-top:12px', text: ui.coachErr }) : null,
    ui.coachBusy ? h('div', { id: 'coach-live', style: 'margin-top:14px' }, h('p', { class: 'sub' }, 'Думаю над дневником…')) : null,
    !ui.coachBusy && saved ? h('div', { style: 'margin-top:14px' }, h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Разбор от ' + C.fmtDate(S.coach.at || D.today, true) + (S.coach.cut ? ' · оборван' : '')), S.coach.q ? h('p', { class: 'sub', style: 'margin-bottom:6px', text: 'Вопрос: ' + S.coach.q }) : null, mdLite(S.coach.text)) : null));
  return out;
}

/* ---------- setup ---------- */
const PAT_OPTS = () => C.PATTERNS.map(p => [p.id, p.n]);
/* kinds of equipment: each has a weight step, and every exercise lies in exactly one of them or in «без снаряда».
   An exercise has no step of its own: it works with the step of the place it lies in. */
function gearBlock() {
  const cfg = D.cfg, ro = !S.canWrite, NONE = C.NO_GEAR, kinds = C.gearList(cfg);
  const ids = Object.keys(cfg.ex).filter(id => cfg.ex[id].mode !== 'light').sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const at = id => C.gearOf(cfg, id), nm = g => cfg.gear[g].n;
  const fresh = () => { S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null; };      // the plan and the programme draft were counted with the old steps
  const setStep = async (g, val) => {
    const v = toNum(val);
    if (!(v > 0)) { toast('Шаг должен быть больше нуля'); render(true); return; }
    if (v === cfg.gear[g].step) return;
    if (await saveCfg(r => { r.gear = r.gear || {}; r.gear[g] = Object.assign({}, r.gear[g], { step: v }); })) toast('Шаг сохранён: ' + nm(g).toLowerCase() + ' — ' + C.fmt(v) + ' кг');
    fresh(); render(true);
  };
  const move = async (id, g) => { if (!id || !cfg.ex[id] || !cfg.gear[g]) return; await saveCfg(r => { const e = r.ex[id]; if (!e) return; e.gear = g; delete e.step; delete e.round; }); fresh(); render(true); };
  const addKind = async () => { const id = 'g_' + Date.now().toString(36); if (!(await saveCfg(r => { r.gear = r.gear || {}; r.gear[id] = { n: 'Новый снаряд', step: 2.5 }; }))) return; S.ui.gearFocus = { id, until: Date.now() + 1500 }; render(true); };
  const rename = async (g, val) => { S.ui.gearFocus = null; const v = val.trim().slice(0, 30); if (!v || v === nm(g)) { render(true); return; } await saveCfg(r => { r.gear[g] = Object.assign({}, r.gear[g], { n: v }); }); render(true); };
  /* without its kind an exercise goes where its name points, else to «без снаряда» */
  const delKind = async g => { await saveCfg(r => { delete r.gear[g]; for (const e of Object.values(r.ex)) if (e.gear === g) delete e.gear; }); fresh(); toast('Снаряд убран'); render(true); };
  const stepInput = g => h('label', { class: 'row', style: 'gap:6px;font-size:13px;flex-wrap:nowrap' }, 'Шаг, кг', h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'gear-step-' + g, 'aria-label': 'Шаг веса: ' + nm(g), value: C.fmt(cfg.gear[g].step, 3), disabled: ro, onchange: e => setStep(g, e.target.value) }));
  const box = g => {
    const k = cfg.gear[g], mine = ids.filter(id => at(id) === g);
    const rest = ids.filter(id => at(id) !== g).sort((a, b) => (at(a) === NONE ? 0 : 1) - (at(b) === NONE ? 0 : 1));       // not sorted yet go first
    return h('div', { class: 'pday', id: 'gear-' + g },
      h('div', { class: 'pday-h', style: 'align-items:center' },
        k.own ? h('input', { type: 'text', class: 'gear-n', id: 'gear-n-' + g, 'aria-label': 'Название снаряда', value: k.n, disabled: ro, onchange: e => rename(g, e.target.value) }) : h('b', null, k.n),
        h('div', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, stepInput(g),
          k.own && !ro ? h('button', { class: 'icon-btn', id: 'gear-del-' + g, title: 'Убрать снаряд', 'aria-label': 'Убрать снаряд: ' + k.n, onclick: () => delKind(g) }, icon('x')) : null)),
      h('div', { class: 'chips', style: 'justify-content:flex-start;margin:8px 0' }, mine.length ? mine.map(id => h('span', { class: 'chip' }, C.exName(cfg, id),
        ro ? null : h('button', { class: 'icon-btn', style: 'width:20px;height:20px', title: 'Убрать со снаряда', 'aria-label': 'Убрать со снаряда: ' + C.exName(cfg, id), onclick: () => move(id, NONE) }, icon('x')))) : h('span', { class: 'sub' }, 'Упражнений пока нет.')),
      ro || !rest.length ? null : h('div', { class: 'row', style: 'flex-wrap:nowrap' },
        h('select', { id: 'gear-add-' + g, class: 'grow', style: 'min-width:0', 'aria-label': 'Упражнение для снаряда: ' + k.n }, rest.map(id => h('option', { value: id, text: C.exName(cfg, id) + (at(id) === NONE ? '' : ' (' + nm(at(id)).toLowerCase() + ')') }))),
        h('button', { class: 'btn sm', id: 'gear-btn-' + g, onclick: () => move($('gear-add-' + g).value, g) }, icon('plus'), 'Добавить')));
  };
  /* what is not sorted yet, by name, each with its own way to a kind of equipment */
  const loose = ids.filter(id => at(id) === NONE);
  const looseBox = h('div', { class: 'pday gear-loose', id: 'gear-' + NONE },
    h('div', { class: 'pday-h', style: 'align-items:center' }, h('b', null, 'Без снаряда', h('span', { class: 'cnt', id: 'gear-loose-n' }, ' ' + loose.length)), stepInput(NONE)),
    loose.length
      ? h('div', { class: 'chips', style: 'justify-content:flex-start;margin:8px 0 2px' }, loose.map(id => h('span', { class: 'chip' }, C.exName(cfg, id),
          ro ? null : h('select', { class: 'chip-sel', id: 'gear-to-' + id, 'aria-label': 'Снаряд для: ' + C.exName(cfg, id), onchange: e => move(id, e.target.value) },
            h('option', { value: '', text: 'снаряд…' }), kinds.map(x => h('option', { value: x.id, text: x.n }))))))
      : h('p', { class: 'sub', style: 'margin:8px 0 2px' }, 'Все упражнения разложены по снарядам.'));
  const out = h('div', { style: 'margin-bottom:14px' },
    h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:4px' }, h('div', { class: 'eyebrow' }, 'Снаряды'),
      ro ? null : h('button', { class: 'btn ghost sm', id: 'gear-new', onclick: addKind }, icon('plus'), 'Снаряд')),
    h('p', { class: 'note', style: 'margin-bottom:10px' }, 'Шаг веса задаётся у снаряда: упражнение берёт шаг того снаряда, в котором лежит.'),
    h('div', { class: 'gear-grid' }, kinds.map(x => box(x.id)), looseBox));
  /* a new kind waits for its name: the save is followed by a redraw or two, and the cursor has to survive them */
  { const f = S.ui.gearFocus; if (f && Date.now() < f.until) setTimeout(() => { const el = $('gear-n-' + f.id); if (el && S.ui.gearFocus === f && document.activeElement !== el) { el.focus(); el.select(); } }, 0); else S.ui.gearFocus = null; }
  return out;
}

/* weights the athlete names before the journal has them: a working weight or a one-rep maximum for every exercise */
function knownBlock() {
  const cfg = D.cfg, ro = !S.canWrite, done = D.W.filter(w => !w.open);
  const cur = C.currentSlots(D.W, cfg), live = id => cfg.ex[id] && cfg.ex[id].mode !== 'light';
  const inProg = [...new Set(C.SLOTS.flatMap(sl => cur[sl.id].map(e => e.ex)))].filter(live);
  const rest = Object.keys(cfg.ex).filter(id => live(id) && !inProg.includes(id)).sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const logged = id => C.lastSessionItem(done, id, null, null);
  /* what the first plan will take; read from the fresh config, so the line follows the typing without redrawing the page */
  const startText = id => {
    const c = S.cfg, s = C.startOf(D.W, c, id);
    if (!s) return 'вес подберёшь на первой тренировке';
    if (s.pct) return 'старт: ' + C.fmt(s.w) + ' кг — ' + s.pct + '% от максимума ' + C.fmt(s.tm, 1) + ', ' + C.waveOf(c, id).sets(s.reps) + ' × ' + s.reps;
    return 'старт: ' + C.fmt(s.w) + ' кг на ' + C.rangeOf(D.W, c, id).join('–') + ' повторов' + (s.src === 'work' ? '' : ' (от максимума ' + C.fmt(C.knownMax(c, id), 1) + ')');
  };
  const set = async (id, k, el) => {
    const txt = el.value.trim(), v = toNum(txt);
    if (txt && !(v > 0)) { toast('Нужно число больше нуля'); el.value = ''; return; }
    const val = txt ? (k === 'workR' ? Math.max(1, Math.round(v)) : v) : null;
    if ((+S.cfg.ex[id][k] || null) === val) return;
    if (!(await saveCfg(r => { const e = r.ex[id]; if (!e) return; if (val) e[k] = val; else delete e[k]; }))) return;
    S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null;
    const out = $('kw-out-' + id); if (out) out.textContent = startText(id);
    toast(C.exName(S.cfg, id) + ': ' + (val ? 'сохранено' : 'убрано'));
  };
  const inp = (id, k, ph, lab) => h('input', { class: 'num sm', type: 'text', inputmode: k === 'workR' ? 'numeric' : 'decimal', id: 'kw-' + k + '-' + id, placeholder: ph, 'aria-label': lab + ': ' + C.exName(cfg, id), value: +cfg.ex[id][k] > 0 ? C.fmt(+cfg.ex[id][k], 3) : '', disabled: ro, onchange: e => set(id, k, e.target) });
  const row = id => {
    const p = logged(id), nm = h('div', { class: 'kw-n' }, C.exName(cfg, id), C.isCycle(cfg, id) ? h('span', { class: 'tag', style: 'margin-left:6px' }, 'волна') : null);
    if (p) {
      const sets = p.it.sets.filter(x => !x.warm && x.w != null), top = sets.length ? sets.reduce((t, x) => x.w > t.w || (x.w === t.w && (x.r || 0) > (t.r || 0)) ? x : t, sets[0]) : null;
      return h('div', { class: 'kw-row' }, nm, h('div', { class: 'kw-log sub' }, 'Есть в журнале' + (top ? ': ' + C.fmt(top.w) + ' кг' + (top.r != null ? ' × ' + top.r : '') + ', ' + C.fmtDate(p.w.date) : '') + ' — веса берутся из него.'));
    }
    return h('div', { class: 'kw-row' }, nm, inp(id, 'work', 'раб. кг', 'Рабочий вес, кг'), inp(id, 'workR', 'повт.', 'Повторов с рабочим весом'), inp(id, 'max', 'макс. кг', 'Разовый максимум, кг'), h('div', { class: 'kw-out sub', id: 'kw-out-' + id, text: startText(id) }));
  };
  /* in sight: the programme's exercises that still need a weight; the rest is one line each */
  const need = inProg.filter(id => !logged(id)), spare = rest.filter(id => !logged(id)), have = inProg.concat(rest).filter(id => logged(id));
  const fold = (title, ids) => ids.length ? h('details', { style: 'margin-top:10px' }, h('summary', { class: 'sub', style: 'cursor:pointer' }, title), h('div', { class: 'kw', style: 'margin-top:8px' }, ids.map(row))) : null;
  const head = h('div', { class: 'kw-row kw-head' }, h('span', null, 'Упражнение'), h('span', null, 'Рабочий вес, кг'), h('span', null, 'Повторов'), h('span', null, 'Разовый максимум, кг'), h('span', null, 'Что возьмёт дневник'));
  return h('div', { style: 'margin-bottom:14px', id: 'known' },
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Известные веса'),
    h('p', { class: 'note', style: 'margin-bottom:10px' }, 'Для упражнений, которых ещё нет в журнале: рабочий вес или разовый максимум, хватит одного. С них стартует первая тренировка.'),
    need.length ? h('div', { class: 'kw' }, head, need.map(row)) : (inProg.length ? null : h('p', { class: 'sub' }, 'В программе пока нет упражнений.')),
    fold('Остальные упражнения: ' + spare.length, spare),
    fold('Уже в журнале: ' + have.length + ' — веса берутся из него', have));
}

/* the choice of equipment in a form: by name, a kind, or none */
const gearSelect = (id, cur) => h('select', { id }, h('option', { value: '', text: 'по названию', selected: !cur }),
  C.gearList(D.cfg).map(x => h('option', { value: x.id, text: x.n + ' · шаг ' + C.fmt(x.step) + ' кг', selected: cur === x.id })),
  h('option', { value: C.NO_GEAR, text: 'без снаряда · шаг ' + C.fmt(D.cfg.gear[C.NO_GEAR].step) + ' кг', selected: cur === C.NO_GEAR }));
const musText = m => Object.entries(m || {}).sort((a, b) => b[1] - a[1]).map(x => (C.MUSCLE[x[0]] || { n: x[0] }).n + (x[1] < 1 ? ' ½' : '')).join(', ');
const musGrid = (pre, m) => h('div', { class: 'mgrid' }, C.MUSCLES.map(x => h('label', null, x.n, h('select', { id: pre + 'm-' + x.id }, [[0, 'нет'], [0.5, 'помогает · 0.5'], [1, 'основная · 1']].map(o => h('option', { value: o[0], text: o[1], selected: ((m || {})[x.id] || 0) === o[0] }))))));
const musRead = pre => { const m = {}; for (const x of C.MUSCLES) { const v = +$(pre + 'm-' + x.id).value; if (v) m[x.id] = v; } return m; };

/* a new exercise: a name and a kind of equipment. What it trains the diary reads from the name;
   a name it does not know goes to Claude, and only when that fails too the athlete marks the muscles. */
function newExForm(done) {
  const ui = S.ui, st = ui.newEx || (ui.newEx = { n: '', gear: '', ask: false, busy: false });
  const pre = 'nx-';
  const close = id => { ui.newEx = null; done(id); };
  const store = async def => {
    const o = { n: st.n, pat: def.pat || 'iso', m: def.m };
    if (def.uni) o.uni = true;
    if (st.gear) o.gear = st.gear;
    const nid = 'x_' + Date.now().toString(36);
    if (await saveCfg(raw => { raw.ex[nid] = o; })) toast('Добавлено: ' + st.n + ' — ' + musText(o.m).toLowerCase());
    if (S.ui.prog) S.ui.prog.draft = null;
    close(nid);
  };
  const save = async () => {
    if (st.busy) return;
    st.n = $(pre + 'n').value.trim().slice(0, 80); st.gear = $(pre + 'gear').value;
    if (!st.n) { toast('Назови упражнение'); return; }
    if (Object.values(D.cfg.ex).some(e => e.n.toLowerCase() === st.n.toLowerCase())) { toast('Такое упражнение уже есть'); return; }
    if (st.ask) { const m = musRead(pre); if (!Object.values(m).some(v => v === 1)) { toast('Отметь хотя бы одну основную мышцу'); return; } return store({ pat: 'iso', m }); }
    let def = C.guessEx(st.n);
    if (!def && S.sample) {
      st.busy = true; render(true);
      try { const res = await S.sample(C.exPrompt(st.n), { cache: false }); def = C.parseDef(res && res.text); } catch (e) { def = null; }
      st.busy = false;
      if (S.ui.newEx !== st) return;                                  // the form was closed while Claude was thinking
    }
    if (def) return store(def);
    st.ask = true; render(true);
  };
  return h('div', { class: 'stack', style: 'gap:12px' },
    h('div', { class: 'form-grid' },
      h('label', { class: 'f' }, h('span', null, 'Название'), h('input', { type: 'text', id: pre + 'n', value: st.n, placeholder: 'например, Тяга к лицу на блоке', onkeydown: e => { if (e.key === 'Enter') save(); } })),
      h('label', { class: 'f' }, h('span', null, 'Снаряд'), gearSelect(pre + 'gear', st.gear))),
    st.ask ? h('div', null, h('p', { class: 'note', style: 'margin-bottom:6px' }, 'Не узнал это упражнение по названию. Отметь, какие мышцы работают.'), musGrid(pre, {})) : null,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', id: pre + 'save', disabled: st.busy, onclick: save }, st.busy ? 'Определяю мышцы…' : 'Добавить упражнение'), h('button', { class: 'btn', onclick: () => close(null) }, 'Отмена')));
}

function exForm(id, done) {
  const e = id ? C.clone(D.cfg.ex[id]) : { n: '', m: {}, pat: 'iso' };
  const raw = id ? ((S.cfgRaw || {}).ex || {})[id] || {} : {};
  const pre = 'xf-' + (id || 'new') + '-';
  const fld = (lab, el) => h('label', { class: 'f' }, h('span', null, lab), el);
  const save = async () => {
    const g = k => $(pre + k);
    const name = g('n').value.trim();
    if (!name) { toast('Назови упражнение'); return; }
    const o = { n: name, pat: g('pat').value, m: musRead(pre) };
    if (g('gear').value) o.gear = g('gear').value;
    if (g('mode').value === 'cycle') o.mode = 'cycle';
    const lo = toInt(g('lo').value), hi = toInt(g('hi').value);
    if (lo && hi && hi > lo && (lo !== 8 || hi !== 12)) { o.lo = lo; o.hi = hi; }
    if (g('uni').checked) o.uni = true;
    if (e.goal) o.goal = e.goal;
    for (const k of ['max', 'work', 'workR']) if (+e[k] > 0) o[k] = +e[k];      // named weights live in their own block and stay
    if (!Object.keys(o.m).length) { toast('Отметь хотя бы одну мышцу'); return; }
    const nid = id || 'x_' + Date.now().toString(36);
    const ok = await saveCfg(r => { r.ex[nid] = o; });
    if (ok) toast('Упражнение сохранено');
    S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null;
    done(nid);
  };
  return h('div', { class: 'stack', style: 'gap:12px' },
    h('div', { class: 'form-grid' },
      fld('Название', h('input', { type: 'text', id: pre + 'n', value: e.n || '' })),
      fld('Прогрессия', h('select', { id: pre + 'mode' }, h('option', { value: 'dp', text: 'Двойная прогрессия', selected: e.mode !== 'cycle' }), h('option', { value: 'cycle', text: 'Волна от максимума', selected: e.mode === 'cycle' }))),
      fld('Тип движения', h('select', { id: pre + 'pat' }, PAT_OPTS().map(o => h('option', { value: o[0], text: o[1], selected: (e.pat || 'iso') === o[0] })))),
      fld('Снаряд (шаг веса — от него)', gearSelect(pre + 'gear', raw.gear && D.cfg.gear[raw.gear] ? raw.gear : '')),
      fld('Диапазон повторов по умолчанию', h('div', { class: 'row' }, h('input', { class: 'num sm', type: 'text', inputmode: 'numeric', id: pre + 'lo', 'aria-label': 'Нижняя граница', value: e.lo || 8 }), '–', h('input', { class: 'num sm', type: 'text', inputmode: 'numeric', id: pre + 'hi', 'aria-label': 'Верхняя граница', value: e.hi || 12 })))),
    h('label', { class: 'row', style: 'font-size:13px' }, h('input', { type: 'checkbox', id: pre + 'uni', checked: !!e.uni }), 'Правая и левая сторона записаны отдельными упражнениями (каждое считается за половину подхода)'),
    h('div', null, h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Какие мышцы работают'), musGrid(pre, e.m)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'Сохранить упражнение'), h('button', { class: 'btn', onclick: () => done(null) }, 'Отмена')));
}

/* everything the diary keeps, for every profile, as one JSON document: a backup and the way to move the records elsewhere */
async function exportAll() {
  const db = S.db, out = { format: 'training-diary-backup', version: 1, exportedAt: new Date().toISOString(), profiles: [] };
  for (const p of S.profiles) {
    const pt = paths(p.id);
    const [cfg, ws, bs, co] = await Promise.all([db.doc(pt.cfg).get(), db.collection(pt.w).limit(1000).get(), db.collection(pt.body).limit(1000).get(), db.doc(pt.coach).get()]);
    out.profiles.push({ id: p.id, name: p.n, config: cfg.exists ? cfg.data() : null, workouts: ws.docs.map(d => Object.assign({ id: d.id }, d.data())), body: bs.docs.map(d => Object.assign({ id: d.id }, d.data())), coach: co.exists ? co.data() : null });
  }
  return JSON.stringify(out, null, 1);
}
async function saveBackup() {
  if (!S.db) return;
  let data;
  try { data = await exportAll(); } catch (e) { toast('Не получилось собрать копию. Проверь связь и повтори'); return; }
  if (S.downloads) { try { await S.downloads.save({ filename: 'dnevnik-backup-' + D.today + '.json', data }); return; } catch (e) { if (e && e.code === 'declined') return; } }
  try { await navigator.clipboard.writeText(data); toast('Копия скопирована в буфер: вставь её в файл .json'); } catch (e) { toast('Браузер не дал сохранить копию'); }
}

/* whose diaries live on this page */
function profilesCard() {
  const ro = !S.canWrite;
  const rename = async (p, v) => { v = v.trim().slice(0, 40); if (!v || v === p.n) return; if (await saveProfiles(S.profiles.map(x => x.id === p.id ? { id: x.id, n: v } : x))) { toast('Имя сохранено'); render(true); } };
  const add = async () => {
    const name = $('pr-new').value.trim().slice(0, 40);
    if (!name) { toast('Назови профиль'); return; }
    const id = 'p' + Date.now().toString(36), copy = $('pr-copy').checked, ex = {};
    if (copy) for (const [k, e] of Object.entries((S.cfgRaw || {}).ex || {})) { if (e.mode === 'light') continue; ex[k] = C.clone(e); delete ex[k].goal; }
    const doc = { start: C.mondayOf(D.today), zones: C.clone(D.cfg.zones), cycle: C.clone(D.cfg.cycle), method: '', ex };
    if (copy && (S.cfgRaw || {}).gear) doc.gear = C.clone(S.cfgRaw.gear);
    try { await S.db.doc(paths(id).cfg).set(doc); } catch (e) { dbErr(e); return; }
    if (!(await saveProfiles(S.profiles.concat([{ id, n: name }])))) return;
    switchProfile(id);
  };
  return h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Профили'), h('p', { class: 'note' }, 'У каждого профиля свои тренировки, программа, упражнения и настройка. Переключатель — в шапке страницы; всё ниже относится к открытому профилю: ' + profName() + '.'))),
    h('div', { class: 'plan-list' }, S.profiles.map(p => h('div', { class: 'plan-row', style: 'align-items:center' },
      h('input', { type: 'text', id: 'pr-n-' + p.id, 'aria-label': 'Имя профиля', value: p.n, disabled: ro, style: 'flex:1 1 200px', onchange: e => rename(p, e.target.value) }),
      p.id === S.profile ? h('span', { class: 'tag accent' }, 'открыт') : h('button', { class: 'btn sm', onclick: () => switchProfile(p.id) }, 'Открыть')))),
    ro ? null : h('div', { class: 'row', style: 'margin-top:12px;align-items:flex-end' },
      h('label', { class: 'f grow' }, h('span', null, 'Новый профиль'), h('input', { type: 'text', id: 'pr-new', placeholder: 'Имя' })),
      h('label', { class: 'row', style: 'font-size:13px;min-height:40px' }, h('input', { type: 'checkbox', id: 'pr-copy', checked: true }), 'скопировать упражнения из открытого'),
      h('button', { class: 'btn', id: 'pr-add', onclick: add }, icon('plus'), 'Добавить')));
}

function vSetup() {
  if (S.conn !== 'ready') return [];
  const out = [], cfg = D.cfg, ui = S.ui, ro = !S.canWrite;
  const order = C.cycleOrder(cfg);
  const saveProgram = async () => {
    const start = $('st-start').value, min = toNum($('st-min').value), opt = toNum($('st-opt').value), high = toNum($('st-high').value), inc = toNum($('st-inc').value), sets = toInt($('st-sets').value);
    if (!start || !(min > 0 && opt > min && high > opt)) { toast('Границы объёма должны идти по возрастанию'); return; }
    const pctMap = {};
    for (const r of order) { const v = toNum($('st-pct-' + r).value); if (v > 0) pctMap[r] = v; }
    const ign = {};
    for (const m of C.MUSCLES) { if ($('st-ign-' + m.id).checked) ign[m.id] = 1; else if (C.OFF_DEFAULT[m.id]) ign[m.id] = 0; }   // 0 puts a muscle that is out by default back into the count
    const rir = toInt($('st-rir').value), bw = $('st-bw').value, capD = toNum($('st-capd').value), capW = toNum($('st-capw').value), rest = +$('st-rest').value;
    const ok = await saveCfg(raw => { raw.start = C.mondayOf(start); raw.zones = { min, opt, high }; raw.cycle = { inc: inc == null ? 2 : inc, sets: sets || 4, pct: pctMap }; raw.method = $('st-method').value.trim(); raw.ignore = ign; raw.rir = rir == null ? 1 : Math.max(0, Math.min(4, rir)); raw.bw = bw === 'track' ? 'track' : 'gain'; raw.caps = { day: capD > 0 ? capD : 11, week: capW > 0 ? capW : 100 }; if (rest >= 30) raw.rest = rest; });
    if (ok) toast('Настройка сохранена');
    render(true);
  };
  const rest = [profilesCard()];
  rest.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('h2', null, 'Лимиты и методика')),
    h('div', { class: 'form-grid' },
      h('label', { class: 'f' }, h('span', null, 'Понедельник первой недели'), h('input', { type: 'date', id: 'st-start', value: cfg.start })),
      h('label', { class: 'f' }, h('span', null, 'Минимум подходов на мышцу'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-min', value: cfg.zones.min })),
      h('label', { class: 'f' }, h('span', null, 'Рабочая зона от'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-opt', value: cfg.zones.opt })),
      h('label', { class: 'f' }, h('span', null, 'Рабочая зона до'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-high', value: cfg.zones.high })),
      h('label', { class: 'f' }, h('span', null, 'Лимит: подходов на мышцу за тренировку'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-capd', value: cfg.caps.day })),
      h('label', { class: 'f' }, h('span', null, 'Лимит: рабочих подходов в неделю'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-capw', value: cfg.caps.week })),
      h('label', { class: 'f' }, h('span', null, 'Отдых между подходами'), h('select', { id: 'st-rest' }, (C.REST_OPTS.includes(cfg.rest) ? C.REST_OPTS : C.REST_OPTS.concat(cfg.rest).sort((a, b) => a - b)).map(v => h('option', { value: v, selected: v === cfg.rest, text: C.fmtRest(v) + ' мин' })))),
      h('label', { class: 'f' }, h('span', null, 'Запас повторов по методике (RIR)'), h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'st-rir', value: cfg.rir })),
      h('label', { class: 'f' }, h('span', null, 'Вес тела'), h('select', { id: 'st-bw' }, h('option', { value: 'gain', text: 'слежу за набором', selected: cfg.bw !== 'track' }), h('option', { value: 'track', text: 'просто записываю', selected: cfg.bw === 'track' })))),
    h('div', { style: 'margin-top:12px' }, h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Мышцы вне расчёта'),
      h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Отмеченным мышцам дневник подходы не выделяет и не считает их отставанием: ноль у них — норма. Сборка программы убирает упражнения, где такая мышца основная (кроме упражнений по волне). По умолчанию это икры, пресс и разгибатели спины. Прибавить им можно вручную — кнопкой «+» в таблице на вкладке «Программа».'),
      h('div', { class: 'checks' }, C.MUSCLES.map(m => h('label', null, h('input', { type: 'checkbox', id: 'st-ign-' + m.id, checked: !!cfg.ignore[m.id] }), m.n)))),
    h('hr', { class: 'rule' }),
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Волна для базовых упражнений'),
    h('p', { class: 'note', style: 'margin-bottom:10px' }, 'Это обычная волна. Режим базового упражнения выбирается в его карточке во вкладке «Тренировка» или целой программой во вкладке «Программа». «Приоритет силы» — своя волна, здесь не настраивается: 77.5% 4×5 → 82.5% 4×4 → 87.5% 4×3 → 92.5% 3×2, максимум +2.5% после каждого полного цикла. «Поддержание» — проценты отсюда, на подход меньше, максимум не растёт.'),
    h('div', { class: 'form-grid' },
      order.map(r => h('label', { class: 'f' }, h('span', null, 'Неделя с ' + r + ' повторами, % от максимума'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-pct-' + r, value: cfg.cycle.pct[r] }))),
      h('label', { class: 'f' }, h('span', null, 'Подходов'), h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'st-sets', value: cfg.cycle.sets })),
      h('label', { class: 'f' }, h('span', null, 'Прибавка к максимуму в неделю, %'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'st-inc', value: cfg.cycle.inc }))),
    h('hr', { class: 'rule' }),
    h('label', { class: 'f' }, h('span', null, 'Методика своими словами — её читает Claude, когда делает разбор'), h('textarea', { id: 'st-method', style: 'min-height:120px' }, cfg.method || '')),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn primary', disabled: ro, onclick: saveProgram }, 'Сохранить настройку'))));

  /* exercises: the kinds of equipment are the list; a new one needs a name only */
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('h2', null, 'Упражнения'),
      ro || ui.exForm === 'new' ? null : h('button', { class: 'btn', id: 'ex-new', onclick: () => { ui.exForm = 'new'; ui.newEx = null; render(true); } }, icon('plus'), 'Новое упражнение')),
    ui.exForm === 'new' ? h('div', { class: 'card', style: 'margin-bottom:14px' }, newExForm(() => { ui.exForm = null; render(true); })) : null,
    gearBlock(),
    knownBlock()));

  /* the catalogue with names, ranges, progression and muscles: rarely needed, so it lives in the folded part */
  const ids = Object.keys(cfg.ex).sort((a, b) => (D.prog.has(b) - D.prog.has(a)) || C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const list = [];
  for (const id of ids) {
    const e = cfg.ex[id];
    if (ui.exForm === id) { list.push(h('div', { class: 'card', style: 'margin:8px 0' }, exForm(id, () => { ui.exForm = null; render(true); }))); continue; }
    list.push(h('div', { class: 'plan-row' }, h('span', { class: 'n' }, e.n, D.prog.has(id) ? null : h('span', { class: 'muted' }, ' · не в программе')),
      h('span', { class: 'sub', style: 'flex:2 1 220px' }, (goalTag(cfg, id) ? goalTag(cfg, id) + ' · ' : '') + (e.mode === 'light' ? C.lightOf(cfg, id).sets + ' × ' + C.lightOf(cfg, id).reps + ' на ' + C.lightOf(cfg, id).pct + '% от максимума в «' + C.exName(cfg, e.of) + '»' : cfg.gear[C.gearOf(cfg, id)].n.toLowerCase() + ' · ' + (e.mode === 'cycle' ? 'волна, ' : '') + 'шаг ' + C.fmt((e.mode === 'cycle' ? e.round : e.step) || 2.5) + ' кг') + ' · ' + (musText(e.m) || 'мышцы не указаны')),
      ro || e.mode === 'light' ? null : h('button', { class: 'btn ghost sm', onclick: () => { ui.exForm = id; render(true); } }, 'Изменить')));
  }
  rest.push(h('section', { class: 'card', id: 'catalogue' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Справочник упражнений'), h('p', { class: 'note' }, 'Название, прогрессия, диапазон повторов и мышцы каждого упражнения. Мышцы дневник определяет сам по названию; здесь их можно поправить.'))),
    h('div', { class: 'plan-list' }, list.length ? list : h('p', { class: 'sub' }, 'Справочник пуст.'))));

  /* data */
  const csv = () => C.toCsv(D.W, cfg);
  rest.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Данные'), h('p', { class: 'note' }, 'Записей в дневнике: ' + D.W.length + '. Они хранятся вместе с этой страницей и видны с любого устройства, где ты вошёл в Claude. Выгрузка — таблица «один подход в строке».'))),
    h('div', { class: 'row' },
      S.downloads ? h('button', { class: 'btn', onclick: async () => { try { await S.downloads.save({ filename: 'trenirovki-' + D.today + '.csv', data: '﻿' + csv() }); } catch (e) { if (!e || e.code !== 'declined') toast('Файл не сохранился. Попробуй скопировать таблицу'); } } }, 'Скачать CSV') : null,
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(csv()); toast('Таблица скопирована'); } catch (e) { toast('Браузер не дал скопировать'); } } }, 'Скопировать CSV'),
      h('button', { class: 'btn', id: 'backup-all', onclick: saveBackup }, 'Резервная копия всех профилей (JSON)')),
    h('p', { class: 'note', style: 'margin-top:8px' }, 'CSV — тренировки открытого профиля. Резервная копия — всё сразу: профили, настройка, программы, тренировки и вес тела; из неё записи можно перенести в другое приложение.')));
  /* the rest is needed rarely: one folded line keeps it within reach without crowding the page */
  out.push(h('details', { class: 'morebox', id: 'setup-more', open: !!ui.setupMore, ontoggle: e => { ui.setupMore = e.target.open; } },
    h('summary', null, 'Остальные настройки: профили, лимиты и методика, справочник, данные'), rest));
  return out;
}

const VIEW_FN = { overview: vOverview, workout: vWorkout, journal: vJournal, progress: vProgress, muscles: vMuscles, coach: vCoach, program: vProgram, setup: vSetup };
window.addEventListener('hashchange', () => { route(); S.ui.confirm = null; render(); });
document.addEventListener('focusout', () => { setTimeout(() => { if (stale && !(S.view === 'workout' && S.draft)) { const a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) render(true); } }, 60); });
let rsT = 0, lastW = window.innerWidth;
window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rsT); rsT = setTimeout(() => { if (!(S.view === 'workout' && S.draft)) render(true); }, 200); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.draft && S.draft.open && S.dirty) saveDraft(); });
boot();
