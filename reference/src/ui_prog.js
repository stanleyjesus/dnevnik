/* ---------- UI: the programme — what runs now, and a new one: by hand or built around a priority ---------- */
const progSig = slots => C.SLOTS.map(sl => (slots[sl.id] || []).map(e => e.ex + ':' + (e.n || '')).join(',')).join('|');
function progScheme(cfg, e) {
  const k = C.kindOf(cfg, e.ex), s = C.startOf(D.W, cfg, e.ex), from = s ? ' · старт ' + C.fmt(s.w) + ' кг' : '';   // a weight named in the settings for an exercise new to the journal
  if (k === 'light') { const L = C.lightOf(cfg, e.ex); return L.sets + ' × ' + L.reps + ' на ' + L.pct + '% от максимума' + from; }
  if (k === 'base') { const wv = C.waveOf(cfg, e.ex); return (wv.auto ? C.AUTO.sets + ' × ' + C.AUTO.reps + ' одним весом, вес по запасу' : 'волна ' + wv.order.map(r => wv.sets(r) + '×' + r).join(' → ')) + from; }
  return e.n + ' × ' + C.rangeOf(D.W, cfg, e.ex).join('–') + from;
}
const dayLoad = v => C.fmt(Math.round(v * 2) / 2, 1);
const loadText = v => dayLoad(v) + ' ' + (Number.isInteger(Math.round(v * 2) / 2) ? C.plural(Math.round(v), ['подход', 'подхода', 'подходов']) : 'подхода');

/* one day as a column; `edit` gives the handlers of the builder */
function progDay(cfg, sl, list, load, was, edit, marked) {
  const rows = list.map((e, i) => {
    const k = C.kindOf(cfg, e.ex), tags = [], nm = C.exName(cfg, e.ex);
    if (e.isNew) tags.push(h('span', { class: 'tag accent', title: e.from ? 'Перенесено с другого дня: ' + C.SLOT[e.from].n.toLowerCase() : null }, e.from ? 'перенос' : 'новое'));
    if (k === 'base' && C.goalName(cfg, e.ex)) tags.push(h('span', { class: 'tag' + (['strength', 'auto'].includes(C.goalOf(cfg, e.ex)) ? ' accent' : '') }, C.goalName(cfg, e.ex)));
    if (e.chg && !e.isNew) tags.push(h('span', { class: 'tag accent' }, (e.chg > 0 ? '+' : '−') + Math.abs(e.chg) + ' ' + C.plural(Math.abs(e.chg), ['подход', 'подхода', 'подходов'])));
    const ctl = edit ? h('div', { class: 'pctl' },
      i > 0 ? h('button', { class: 'icon-btn', title: 'Выше', 'aria-label': 'Переместить выше: ' + nm, onclick: () => edit.up(sl.id, i) }, icon('arrowU')) : null,
      e.n ? h('button', { class: 'icon-btn', title: 'Меньше подходов', 'aria-label': 'Меньше подходов: ' + nm, disabled: e.n <= 1, onclick: () => edit.sets(sl.id, i, -1) }, icon('minus')) : null,
      e.n ? h('button', { class: 'icon-btn', title: 'Больше подходов', 'aria-label': 'Больше подходов: ' + nm, disabled: e.n >= 6, onclick: () => edit.sets(sl.id, i, 1) }, icon('plus')) : null,
      k !== 'base' || edit.manual ? h('button', { class: 'icon-btn', title: 'Убрать из программы', 'aria-label': 'Убрать из программы: ' + nm, onclick: () => edit.drop(sl.id, i) }, icon('x')) : null) : null;
    /* another exercise for the same muscles in this place: the link opens a list, the choice keeps the sets */
    const alts = edit && (k === 'compound' || k === 'iso') ? C.swapsFor(cfg, e.ex, list.map(x => x.ex)) : null, canSwap = alts && (alts.same.length || alts.near.length);
    const open = canSwap && edit.swapAt === sl.id + ':' + i, sid = 'sw-' + sl.id + '-' + i;
    const opt = (x, tail) => h('option', { value: x.id, text: x.n + (tail || '') + (x.def ? ' · нет в списке, добавится' : '') });
    const sub = h('div', { class: 'sub' }, progScheme(cfg, e), e.was ? ' · вместо «' + C.exName(cfg, e.was) + '»' : '',
      canSwap && !open ? [' · ', h('button', { type: 'button', class: 'linkbtn', id: sid, 'aria-label': 'Заменить упражнение: ' + nm, onclick: () => edit.swapOpen(sl.id, i) }, 'заменить')] : null);
    const picker = open ? h('div', { class: 'row swaprow' },
      h('select', { id: sid + '-to', class: 'grow', style: 'min-width:0', 'aria-label': 'Чем заменить: ' + nm, onchange: ev => { const x = alts.same.concat(alts.near).find(a => a.id === ev.target.value); if (x) edit.swap(sl.id, i, x); } },
        h('option', { value: '', text: 'заменить на…' }),
        alts.same.length ? h('optgroup', { label: 'Те же мышцы' }, alts.same.map(x => opt(x))) : null,
        alts.near.length ? h('optgroup', { label: 'Близкие: мышцы совпадают частично' }, alts.near.map(x => opt(x, ' — ' + x.main.map(m => C.MUSCLE[m].n.toLowerCase()).join(', ')))) : null),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => edit.swapOpen(null) }, 'Отмена')) : null;
    return h('div', { class: 'prow' + (e.isNew || e.chg || e.was || (marked && marked(e)) ? ' changed' : '') + (open ? ' swapping' : '') }, h('div', { class: 'grow' }, h('div', { class: 'pn' }, nm, tags), sub), ctl, picker);
  });
  let adder = null;
  if (edit) {
    const ids = Object.keys(cfg.ex).filter(id => !C.isLight(cfg, id) && !list.some(e => e.ex === id)).sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
    adder = ids.length ? h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:nowrap' },
      h('select', { id: 'pa-' + sl.id, class: 'grow', 'aria-label': 'Упражнение для дня: ' + sl.n, style: 'min-width:0' }, ids.map(id => h('option', { value: id, text: C.exName(cfg, id) }))),
      h('button', { class: 'btn sm', id: 'pb-' + sl.id, onclick: () => edit.add(sl.id, $('pa-' + sl.id).value) }, icon('plus'), 'В день')) : null;
  }
  return h('div', { class: 'pday' },
    h('div', { class: 'pday-h' }, h('b', null, sl.n), h('span', { class: 'sub' }, loadText(load) + (was != null && Math.abs(was - load) >= 0.5 ? ' · было ' + dayLoad(was) : '') + (list.length ? ' · ≈ ' + C.fmtDur(C.estMinutes(cfg, list, D.cfg.rest)) : ''))),
    rows.length ? rows : h('p', { class: 'sub', style: 'padding:10px 0' }, edit ? 'Пусто. Добавь упражнения из списка.' : 'В этот день упражнений пока нет.'),
    adder);
}

async function acceptProgram(pr, name) {
  const lastDone = D.W.filter(w => !w.open).slice(-1)[0];
  const since = lastDone && lastDone.date >= D.today ? C.addDays(lastDone.date, 1) : D.today;
  const ok = await saveCfg(raw => {
    for (const [id, def] of Object.entries(pr.create)) if (!raw.ex[id]) raw.ex[id] = def;
    const prev = {};
    for (const [id, g] of Object.entries(pr.goals)) { if (!raw.ex[id]) continue; prev[id] = raw.ex[id].goal || ''; if (g) raw.ex[id].goal = g; else delete raw.ex[id].goal; }
    const slots = {};
    for (const sl of C.SLOTS) slots[sl.id] = pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
    const old = raw.program ? Object.assign({}, raw.program) : null;
    if (old) delete old.prev;
    const keep = pr.manual && old;                                   // edited by hand: the priority and the defaults of the programme stay
    raw.program = { name: (name || pr.name).slice(0, 60), focus: keep ? old.focus || '' : pr.focus || '', others: keep ? old.others || '' : pr.others || '', since, made: D.today, slots, prev: old ? { goals: prev, program: old } : { goals: prev } };
    const prio = keep ? old.prio || '' : pr.prio || '', budget = keep ? +old.budget || 0 : +pr.budget || 0;
    if (prio) raw.program.prio = prio;
    if (budget) raw.program.budget = budget;
    if (pr.manual || (keep && old.lean)) raw.program.lean = true;   // built by hand: extra sets and new exercises are offered, not switched on
  });
  if (!ok) return;
  S.ui.prog = null; S.ui.plan = null;
  toast('Программа принята: следующие тренировки пойдут по ней');
  render(true);
}
async function undoProgram() {
  const ok = await saveCfg(raw => {
    const P = raw.program;
    if (!P) return;
    for (const [id, g] of Object.entries((P.prev || {}).goals || {})) { if (!raw.ex[id]) continue; if (g) raw.ex[id].goal = g; else delete raw.ex[id].goal; }
    if (P.prev && P.prev.program) raw.program = P.prev.program; else delete raw.program;
  });
  if (!ok) return;
  S.ui.prog = null; S.ui.plan = null;
  toast('Вернул прежнюю программу');
  render(true);
}

/* where a week breaks the athlete's limits */
function rulesBox(list) {
  return list.length ? h('div', { class: 'rules', role: 'alert' }, h('b', null, 'Выходит за твои лимиты'), list.map(t => h('div', { text: t }))) : null;
}

function vProgram() {
  if (S.conn !== 'ready') return [];
  const out = [], cfg = D.cfg, P = cfg.program, ro = !S.canWrite, done = D.W.filter(w => !w.open);
  const cur = C.currentSlots(D.W, cfg), curT = C.progTally(cfg, cur), empty = C.SLOTS.every(sl => !cur[sl.id].length);
  const lastOf = {};
  for (const w of done) if (w.slot) lastOf[w.slot] = w;
  const pending = C.SLOTS.filter(sl => C.progPending(cfg, sl.id, lastOf[sl.id]));
  const lifts = Object.keys(cfg.ex).filter(id => C.isCycle(cfg, id) && C.SLOTS.some(sl => cur[sl.id].some(e => e.ex === id)));

  /* what runs now */
  let state;
  if (P) {
    const started = pending.length < C.SLOTS.filter(sl => (P.slots[sl.id] || []).length).length;
    state = [h('p', { class: 'sub' }, 'Принята ' + C.fmtDate(P.made || P.since, true) + '. ',
      !pending.length ? 'Все дни уже идут по ней: дальше каждый день строится от своей прошлой тренировки.' : started ? 'Ещё не было по ней: ' + C.list(pending.map(sl => sl.n.toLowerCase())) + '.' : 'По ней ещё не было ни одной тренировки.',
      P.focus && cfg.ex[P.focus] ? ' Приоритет — «' + C.exName(cfg, P.focus) + '», остальные базовые ' + (P.others === 'grow' ? 'растут как раньше.' : 'на поддержании.') : '',
      P.prio && C.PRIOS.some(g => g.id === P.prio) ? ' Приоритет — ' + C.PRIOS.find(g => g.id === P.prio).n.toLowerCase() + '.' : '',
      P.budget ? ' Лимит недели — ' + P.budget + ' подходов.' : ''),
    !started && !ro && P.prev ? h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn sm', id: 'prog-undo', onclick: undoProgram }, 'Вернуть прежнюю')) : null];
  } else state = h('p', { class: 'sub' }, empty ? 'Программы пока нет. Собери её ниже: добавь упражнения в дни и нажми «Принять программу».' : 'Она ведётся по тренировкам: дневник берёт за основу последнюю тренировку каждого дня и строит по ней следующую.');
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Действует сейчас'), h('h2', null, P ? P.name : empty ? 'Программы нет' : 'Своя программа')), empty ? null : h('span', { class: 'sub' }, loadText(C.SLOTS.reduce((a, sl) => a + curT.load[sl.id], 0)) + ' в неделю')),
    state,
    empty ? null : h('div', { class: 'grid3', style: 'margin-top:12px' }, C.SLOTS.map(sl => progDay(cfg, sl, cur[sl.id], curT.load[sl.id], null, null, null))),
    rulesBox(C.ruleBreaks(cfg, curT))));
  if (ro) return out;

  /* a new one */
  const ui = S.ui;
  const budgets = [40, 50, 60, 70, 80, 90, 100, 110, 120].filter(v => v < cfg.caps.week).concat(cfg.caps.week);
  if (!ui.prog) ui.prog = { focus: P && P.focus && lifts.includes(P.focus) ? 'l:' + P.focus : P && P.prio && C.PRIOS.some(g => g.id === P.prio) ? 'm:' + P.prio : empty ? 'manual' : 'even',
    others: P && P.others === 'grow' ? 'grow' : 'hold', budget: P && +P.budget > 0 && +P.budget <= cfg.caps.week ? +P.budget : cfg.caps.week, draft: null, key: '' };
  const st = ui.prog, manual = st.focus === 'manual', lift = st.focus.startsWith('l:') ? st.focus.slice(2) : null, prio = st.focus.startsWith('m:') ? st.focus.slice(2) : '';
  if (!budgets.includes(st.budget)) st.budget = cfg.caps.week;
  const key = st.focus + '|' + st.others + '|' + st.budget + '|' + progSig(cur) + '|' + lifts.map(id => C.goalOf(cfg, id) || '').join(',') + '|' + (P ? P.since : '') + '|' + Object.keys(cfg.ex).length + '|' + cfg.caps.day + '/' + cfg.caps.week + '|' + Object.keys(cfg.ignore).sort().join(',');
  if (!st.draft || st.key !== key) { st.draft = C.buildProgram(D.W, cfg, { manual, focus: lift, others: st.others, prio, budget: st.budget }); st.key = key; st.edited = false; st.name = null; st.swapAt = null; }
  const pr = st.draft, changed = !pr.same || progSig(pr.slots) !== progSig(pr.cur);
  const recount = () => { pr.after = C.progTally(pr.cfg, pr.slots); st.edited = true; render(true); };
  const edit = {
    manual,
    sets: (slot, i, k) => { const e = pr.slots[slot][i]; e.n = Math.max(1, Math.min(6, e.n + k)); e.chg = (e.chg || 0) + k; recount(); },
    drop: (slot, i) => { st.swapAt = null; pr.slots[slot].splice(i, 1); recount(); },
    up: (slot, i) => { st.swapAt = null; const L = pr.slots[slot]; L.splice(i - 1, 0, L.splice(i, 1)[0]); recount(); },
    add: (slot, id) => { if (!id || !pr.cfg.ex[id]) return; pr.slots[slot].push(C.isCycle(pr.cfg, id) ? { ex: id, isNew: true } : { ex: id, n: 3, isNew: true }); recount(); },
    /* the exercise in this place changes, its sets stay; going back to the first one clears the mark */
    swapAt: st.swapAt || null,
    swapOpen: (slot, i) => { st.swapAt = slot == null ? null : slot + ':' + i; render(true); if (slot != null) setTimeout(() => { const el = $('sw-' + slot + '-' + i + '-to'); if (el) el.focus(); }, 0); },
    swap: (slot, i, x) => {
      const e = pr.slots[slot][i], old = e.ex, first = e.was || old;
      if (!x || x.id === old) return;
      if (!pr.cfg.ex[x.id]) { if (!x.def) return; pr.create[x.id] = C.clone(x.def); pr.cfg.ex[x.id] = C.placed(pr.cfg, Object.assign({ n: x.id }, x.def)); }
      e.ex = x.id; if (x.id === first) delete e.was; else e.was = first;
      st.swapAt = null;
      (pr.hand = pr.hand || []).push({ m: C.SLOT[slot].s, t: 'замена: ' + C.exName(pr.cfg, old) + ' → ' + C.exName(pr.cfg, x.id) });
      toast(C.SLOT[slot].s + ': ' + C.exName(pr.cfg, old) + ' → ' + C.exName(pr.cfg, x.id));
      recount();
    }
  };
  /* one click on a muscle: the diary itself finds the set or the exercise to add or to take away */
  /* the pool of the week: the limit chosen for this build (the profile's own limit in the manual and strength modes) */
  const cap = manual ? cfg.caps.week : st.budget;
  const freeOf = t => +(cap - C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0)).toFixed(1);
  const freeText = f => f > 0.01 ? 'свободно ' + C.fmt(f, 1) : f < -0.01 ? 'на ' + C.fmt(-f, 1) + ' больше лимита' : 'свободных подходов нет';
  const nudge = (m, dir) => {
    const r = C.nudgeMuscle(pr.cfg, pr.slots, m.id, dir, { z: cfg.zones, ignore: cfg.ignore, budget: cap, dayCap: cfg.caps.day }, (id, def) => { pr.create[id] = def; pr.cfg.ex[id] = C.placed(pr.cfg, Object.assign({ n: id }, def)); });
    toast(r.ok ? m.n + ' — ' + r.text.charAt(0).toLowerCase() + r.text.slice(1) + ' · ' + freeText(freeOf(C.progTally(pr.cfg, pr.slots))) : r.text);
    if (!r.ok) return;
    (pr.hand = pr.hand || []).push({ m: m.n, t: r.text });
    recount();
  };
  const pick = (f, o) => { st.focus = f; if (o) st.others = o; st.draft = null; render(true); };
  const modes = [['manual', 'Вручную'], ['even', 'Равномерно: всем мышцам поровну']].concat(C.PRIOS.map(g => ['m:' + g.id, 'Приоритет: ' + g.n.toLowerCase()]), lifts.map(id => ['l:' + id, 'Пауэрбилдинг: ' + C.exName(cfg, id).toLowerCase()]));
  const avgMin = C.SLOTS.filter(sl => pr.slots[sl.id].length).map(sl => C.estMinutes(pr.cfg, pr.slots[sl.id], D.cfg.rest));
  const total = t => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
  const used = total(pr.after), free = +(cap - used).toFixed(1), hand = pr.hand && pr.hand.length ? pr.hand : null;
  const z = cfg.zones, fm = pr.focus ? (cfg.ex[pr.focus].m || {}) : pr.prio ? Object.fromEntries(C.PRIOS.find(g => g.id === pr.prio).m.map(m => [m, 1])) : {};
  /* a row is marked when its mode or goal differs from what runs now */
  const marked = e => pr.goals[e.ex] !== undefined && (C.goalOf(cfg, e.ex) || null) !== pr.goals[e.ex];
  /* every muscle is listed, so the table reads as the whole week; muscles outside the goal are left out only while they get nothing */
  /* every muscle has a row: the ones left out of the count stay at what they have, and the buttons are the way to give them more */
  /* s: how much of the new volume is strength work — the lifts done by percentages; shown in brackets next to the total */
  const vols = C.MUSCLES.map(m => ({ m, a: pr.before.pv[m.id] || 0, b: pr.after.pv[m.id] || 0, s: (pr.after.ps || {})[m.id] || 0, sa: (pr.before.ps || {})[m.id] || 0 }));
  const splitOf = r => C.splitText(r.b, r.s), splitNow = r => C.splitText(r.a, r.sa);
  const nMoved = vols.filter(r => Math.abs(r.b - r.a) >= 0.05).length;

  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Новая программа'), h('h2', null, manual ? 'Правка вручную' : pr.name)), h('span', { class: 'sub' }, loadText(total(pr.after)) + ' в неделю' + (empty ? '' : ' · сейчас ' + dayLoad(total(pr.before))) + (avgMin.length ? ' · тренировка ≈ ' + C.fmtDur(avgMin.reduce((a, b) => a + b, 0) / avgMin.length) : ''))),
    h('p', { class: 'note', style: 'margin-bottom:12px' }, manual ? 'Собери или поправь программу сам: добавляй упражнения в дни, меняй порядок и число подходов. Упражнений, которых нет в списке, сначала заведи в «Настройке». Записи в журнале не меняются.'
      : lift ? 'Масса и сила с акцентом на одном базовом. Оно идёт два дня на силу — 4 × 4 с весом по запасу и лёгкий день — и один день на массу. Остальные мышцы делят объём поровну, каждая работает минимум в два дня недели.'
      : prio ? 'Приоритетные мышцы получают примерно в полтора раза больше остальных, остальные делят объём поровну. Каждая мышца работает минимум в два дня недели. Лимиты недели и дня не нарушаются.'
      : 'Все мышцы в цели получают поровну, разброс — около двух подходов. Каждая мышца работает минимум в два дня недели. Лимиты недели и дня не нарушаются.'),
    h('div', { class: 'row', style: 'margin-bottom:12px;align-items:flex-end' },
      h('label', { class: 'f' }, h('span', null, 'Как собрать'), h('select', { id: 'pf', onchange: e => pick(e.target.value) }, modes.map(o => h('option', { value: o[0], selected: o[0] === st.focus, text: o[1] })))),
      lift ? h('div', { class: 'pf' }, h('span', null, 'Остальные базовые'), h('div', { class: 'seg multi', role: 'group', 'aria-label': 'Остальные базовые упражнения' },
        h('button', { type: 'button', id: 'po-hold', 'aria-pressed': String(st.others === 'hold'), onclick: () => pick(st.focus, 'hold') }, 'Поддержание'),
        h('button', { type: 'button', id: 'po-grow', 'aria-pressed': String(st.others === 'grow'), onclick: () => pick(st.focus, 'grow') }, 'Растут как раньше'))) : null,
      !manual ? h('label', { class: 'f' }, h('span', null, 'Подходов в неделю, не больше'), h('select', { id: 'pb-budget', onchange: e => { st.budget = +e.target.value; st.draft = null; render(true); } }, budgets.map(v => h('option', { value: v, selected: v === st.budget, text: v + (v === cfg.caps.week ? ' — твой лимит' : '') })))) : null,
      restSelect('prog-rest'),
      manual ? h('label', { class: 'f grow' }, h('span', null, 'Название программы'), h('input', { type: 'text', id: 'prog-name', value: st.name != null ? st.name : pr.name, oninput: e => { st.name = e.target.value; } })) : null),
    h('div', { class: 'grid3' }, C.SLOTS.map(sl => progDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], empty ? null : pr.before.load[sl.id], edit, marked))),
    h('p', { class: 'sub', style: 'margin-top:8px' }, 'Полоса слева — то, что меняется. Время — разминка, подходы и отдых по ' + C.fmtRest(cfg.rest) + '.'),
    rulesBox(C.ruleBreaks(pr.cfg, pr.after)),

    h('hr', { class: 'rule' }),
    h('div', { class: 'grid2 even' },
      h('div', { style: 'min-width:0' }, h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Недельный объём по мышцам'),
        bodyMap(pr.after.pv, { z, ignore: cfg.ignore, sel: null, pick: null }),
        /* the reasons are there for whoever wants them, folded by default */
        pr.notes.length || hand ? h('details', { class: 'whybox', id: 'prog-why', open: !!st.whyOpen, ontoggle: e => { st.whyOpen = e.target.open; } },
          h('summary', null, 'Что изменилось и почему'),
          hand ? h('div', { class: 'why hand', id: 'prog-hand' }, h('b', null, 'Поправлено вручную'), h('div', { class: 'sub' }, hand.map(x => h('div', { text: x.m + ': ' + x.t.charAt(0).toLowerCase() + x.t.slice(1) })))) : null,
          pr.notes.map(n => h('div', { class: 'why' }, h('b', { text: n.t }), h('div', { class: 'sub', text: n.x })))) : null),
      h('div', { style: 'min-width:0' },
        h('div', { class: 'free ' + (free < -0.01 ? 'over' : free > 0.01 ? 'some' : 'none'), id: 'prog-free', role: 'status' },
          h('div', { class: 'free-main' },
            h('b', { class: 'free-n', id: 'prog-free-n', text: C.fmt(Math.abs(free), 1) }),
            h('div', null,
              h('div', { class: 'free-t', text: free < -0.01 ? C.plural(Math.round(-free), ['подход', 'подхода', 'подходов']) + ' сверх лимита' : free > 0.01 ? C.plural(Math.round(free), ['подход свободен', 'подхода свободны', 'подходов свободно']) : 'подходов свободно' }),
              h('div', { class: 'sub', text: 'В программе ' + C.fmt(used, 1) + ' из ' + cap + (manual ? ' — твой лимит недели' : '') + (free > 0.01 || free < -0.01 ? '' : '. Чтобы прибавить мышце, сначала убавь другой') }))),
          hand ? h('button', { class: 'btn sm', id: 'prog-reset', onclick: () => { st.draft = null; render(true); } }, 'Сбросить правки') : null,
          h('div', { class: 'free-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(0, Math.min(100, used / cap * 100)).toFixed(1) + '%' }))),
        h('div', { class: 'scroll-x mwrap' }, h('table', { class: 'mtab' }, h('thead', null, h('tr', null, h('th', null, 'Мышца'), h('th', { class: 'c-now' }, 'Сейчас'), h('th', null, 'Станет'), h('th', { class: 'c-zone', style: 'text-align:left' }, 'Оценка'), h('th', { style: 'text-align:center' }, '− / +'))),
          h('tbody', null, vols.map(r => {
            const ch = Math.abs(r.b - r.a) >= 0.05, off = cfg.ignore[r.m.id] && r.b < z.opt;
            return h('tr', null,
              /* on a narrow table the split moves under the name, so the buttons stay on the screen */
              h('td', null, r.m.n, fm[r.m.id] ? h('span', { class: 'tag', style: 'margin-left:6px' }, fm[r.m.id] >= 1 ? 'приоритет' : 'помогает') : null, splitOf(r) ? h('span', { class: 'msplit under', id: 'msn-' + r.m.id, text: splitOf(r) }) : null),
              h('td', { class: 'c-now' }, C.fmt(r.a, 1), splitNow(r) ? h('span', { class: 'msplit', id: 'msa-' + r.m.id, text: '(' + splitNow(r) + ')' }) : null),
              h('td', null, ch ? [h('span', { class: 'tag accent', style: 'margin-right:6px' }, C.signed(r.b - r.a, 1)), h('b', null, C.fmt(r.b, 1))] : C.fmt(r.b, 1), splitOf(r) ? h('span', { class: 'msplit', id: 'ms-' + r.m.id, text: '(' + splitOf(r) + ')' }) : null),
              h('td', { class: 'c-zone', style: 'text-align:left' }, off ? h('span', { class: 'pill', title: 'Вне расчёта: дневник сам подходы не выделяет, прибавь кнопкой «+»' }, icon('minus'), 'вне расчёта') : zonePill(r.b, z)),
              h('td', { class: 'mctl' }, h('div', { class: 'pctl' },
                h('button', { class: 'icon-btn', id: 'mn-' + r.m.id, title: 'Убавить подход', 'aria-label': 'Убавить подход: ' + r.m.n, disabled: r.b <= 0, onclick: () => nudge(r.m, -1) }, icon('minus')),
                h('button', { class: 'icon-btn', id: 'mp-' + r.m.id, title: 'Прибавить подход', 'aria-label': 'Прибавить подход: ' + r.m.n, onclick: () => nudge(r.m, 1) }, icon('plus')))));
          })))),
        vols.some(r => r.s >= 0.05 || r.sa >= 0.05) ? h('p', { class: 'sub', id: 'ms-note', style: 'margin-top:8px' }, 'В скобках: масса — подсобка, сила — базовые по процентам. Силовой подход с запасом от 3 повторов идёт в объём мышцы за половину.') : null,
        h('p', { class: 'note', style: 'margin-top:6px' }, '«−» освобождает подход, «+» отдаёт его мышце: дневник сам выбирает упражнение.'))),

    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn primary', id: 'prog-accept', disabled: !changed, onclick: () => acceptProgram(pr, manual ? (st.name != null ? st.name.trim() : '') || pr.name : null) }, 'Принять программу'),
      h('span', { class: 'sub' }, changed ? 'Ближайшая тренировка каждого дня будет построена по ней' + (done.length ? ', веса возьмутся из последних тренировок.' : '.') : manual ? 'Пока ничего не изменено.' : 'Эта программа совпадает с текущей.'))));
  return out;
}
