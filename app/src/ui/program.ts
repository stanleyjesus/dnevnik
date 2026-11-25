/* Экран «Программа».
   Перенесено из reference/src/ui_prog.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C, h, icon } from './dom.ts';
import { S } from './state.ts';
import { toast } from './toast.ts';
import { saveCfg } from './storage.ts';
import { D, render } from './render.ts';
import { zonePill } from './charts.ts';
import { restSelect } from './overview.ts';
import { bodyMap } from './bodymap.ts';
import { goalPicker, mixText, modeBudget, modeKey, soloNow, soloText } from './goal.ts';
import { needGear } from './starter.ts';
import { TIMES, timeOf } from './fit.ts';
import { progDraft, progLifts } from './draft.ts';
import { builtDay } from './builtday.ts';
import { pairsRow } from './care.ts';
import { weekDays } from './platform.ts';
import { DAY_COUNTS, awayDays, daysOf, useDays } from '../core/days.ts';
import { BASE_SETS, HOLD, appRules, byPct, heavyOf, isoLift } from '../core/rules.ts';
import type { Cfg, Muscle, ProgEntry, ProgSlots, Slot, Swap, Workout } from '../core/index.ts';
import type { Built, Marked, ProgEdit, ProgTally, VolRow } from './types.ts';
import { paceText } from './pace.ts';

/* ---------- UI: the programme — what runs now, and a new one: by hand or built around a priority ---------- */
export const progSig = (slots: ProgSlots) => C.SLOTS.map(sl => (slots[sl.id] || []).map(e => e.ex + ':' + (e.n || '')).join(',')).join('|');
export function progScheme(cfg: Cfg, e: ProgEntry) {
  const k = C.kindOf(cfg, e.ex), s = C.startOf(D.W, cfg, e.ex), from = s ? ' · старт ' + (s.src === 'est' ? '≈ ' : '') + C.fmt(s.w) + ' кг' : '';   // a weight named in the settings for an exercise new to the journal; (в эталоне нет) «≈» — оценка по похожему упражнению
  if (k === 'light') { const L = C.lightOf(cfg, e.ex); return L.sets + ' × ' + L.reps + ' на ' + L.pct + '% от максимума' + from; }
  if (k === 'base' && appRules()) { const A = heavyOf(cfg, e.ex); return (!byPct(cfg, e.ex) ? BASE_SETS + ' × ' + C.rangeOf(D.W, cfg, e.ex).join('–') : C.waveOf(cfg, e.ex).hold ? HOLD.sets + ' × ' + HOLD.reps + ', вес прежний' : A.sets + ' × ' + A.reps + ' одним весом, вес по запасу') + from; }   // (в эталоне нет) методика под цель; тяжёлый день — 3 × 4, у изоляции в силовой роли — 3 × 6 («Новая схема», 24 ноября 2026)
  if (k === 'base') { const wv = C.waveOf(cfg, e.ex); return (wv.auto ? C.AUTO.sets + ' × ' + C.AUTO.reps + ' одним весом, вес по запасу' : 'волна ' + wv.order.map(r => wv.sets(r) + '×' + r).join(' → ')) + from; }
  return e.n + ' × ' + C.rangeOf(D.W, cfg, e.ex).join('–') + from;
}
export const dayLoad = (v: number) => C.fmt(Math.round(v * 2) / 2, 1);
export const loadText = (v: number) => dayLoad(v) + ' ' + (Number.isInteger(Math.round(v * 2) / 2) ? C.plural(Math.round(v), ['подход', 'подхода', 'подходов']) : 'подхода');
/* one day as a column; `edit` gives the handlers of the builder */
export function progDay(cfg: Cfg, sl: Slot, list: ProgEntry[], load: number, was: number | null, edit: ProgEdit | null, marked: Marked | null) {
  const rows = list.map((e, i) => {
    const k = C.kindOf(cfg, e.ex), tags = [], nm = C.exName(cfg, e.ex);
    if (e.isNew) tags.push(h('span', { class: 'tag accent', title: e.from ? 'Перенесено с другого дня: ' + C.SLOT[e.from].n.toLowerCase() : null }, e.from ? 'перенос' : 'новое'));
    if (k === 'base' && C.goalName(cfg, e.ex)) tags.push(h('span', { class: 'tag' + (['strength', 'auto'].includes(C.goalOf(cfg, e.ex)!) ? ' accent' : '') }, C.goalName(cfg, e.ex)));
    if (e.chg && !e.isNew) tags.push(h('span', { class: 'tag accent' }, (e.chg > 0 ? '+' : '−') + Math.abs(e.chg) + ' ' + C.plural(Math.abs(e.chg), ['подход', 'подхода', 'подходов'])));
    const ctl = edit ? h('div', { class: 'pctl' },
      i > 0 ? h('button', { class: 'icon-btn', title: 'Выше', 'aria-label': 'Переместить выше: ' + nm, onclick: () => edit.up(sl.id, i) }, icon('arrowU')) : null,
      e.n ? h('button', { class: 'icon-btn', title: 'Меньше подходов', 'aria-label': 'Меньше подходов: ' + nm, disabled: e.n <= 1, onclick: () => edit.sets(sl.id, i, -1) }, icon('minus')) : null,
      e.n ? h('button', { class: 'icon-btn', title: 'Больше подходов', 'aria-label': 'Больше подходов: ' + nm, disabled: e.n >= 6, onclick: () => edit.sets(sl.id, i, 1) }, icon('plus')) : null,
      k !== 'base' || edit.manual ? h('button', { class: 'icon-btn', title: 'Убрать из программы', 'aria-label': 'Убрать из программы: ' + nm, onclick: () => edit.drop(sl.id, i) }, icon('x')) : null) : null;
    /* another exercise for the same muscles in this place: the link opens a list, the choice keeps the sets */
    const alts = edit && (k === 'compound' || k === 'iso') ? C.swapsFor(cfg, e.ex, list.map(x => x.ex)) : null, canSwap = alts && (alts.same.length || alts.near.length);
    const open = canSwap && edit!.swapAt === sl.id + ':' + i, sid = 'sw-' + sl.id + '-' + i;
    const opt = (x: Swap, tail?: string) => h('option', { value: x.id, text: x.n + (tail || '') + (x.def ? ' · нет в списке, добавится' : '') });
    const sub = h('div', { class: 'sub' }, progScheme(cfg, e), e.was ? ' · вместо «' + C.exName(cfg, e.was) + '»' : '',
      canSwap && !open ? [' · ', h('button', { type: 'button', class: 'linkbtn', id: sid, 'aria-label': 'Заменить упражнение: ' + nm, onclick: () => edit!.swapOpen(sl.id, i) }, 'заменить')] : null);
    const picker = open ? h('div', { class: 'row swaprow' },
      h('select', { id: sid + '-to', class: 'grow', style: 'min-width:0', 'aria-label': 'Чем заменить: ' + nm, onchange: ev => { const x = alts.same.concat(alts.near).find(a => a.id === ev.target.value); if (x) edit!.swap(sl.id, i, x); } },
        h('option', { value: '', text: 'заменить на…' }),
        alts.same.length ? h('optgroup', { label: 'Те же мышцы' }, alts.same.map(x => opt(x))) : null,
        alts.near.length ? h('optgroup', { label: 'Близкие: мышцы совпадают частично' }, alts.near.map(x => opt(x, ' — ' + x.main!.map(m => C.MUSCLE[m].n.toLowerCase()).join(', ')))) : null),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => edit!.swapOpen(null) }, 'Отмена')) : null;
    return h('div', { class: 'prow' + (e.isNew || e.chg || e.was || (marked && marked(e)) ? ' changed' : '') + (open ? ' swapping' : '') }, h('div', { class: 'grow' }, h('div', { class: 'pn' }, nm, tags), sub), ctl, picker);
  });
  let adder = null;
  if (edit) {
    const ids = Object.keys(cfg.ex).filter(id => !C.isLight(cfg, id) && !list.some(e => e.ex === id)).sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
    adder = ids.length ? h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:nowrap' },
      h('select', { id: 'pa-' + sl.id, class: 'grow', 'aria-label': 'Упражнение для дня: ' + sl.n, style: 'min-width:0' }, ids.map(id => h('option', { value: id, text: C.exName(cfg, id) }))),
      h('button', { class: 'btn sm', id: 'pb-' + sl.id, onclick: () => edit.add(sl.id, $('pa-' + sl.id)!.value) }, icon('plus'), 'В день')) : null;
  }
  return h('div', { class: 'pday' },
    h('div', { class: 'pday-h' }, h('b', null, sl.n), h('span', { class: 'sub' }, loadText(load) + (was != null && Math.abs(was - load) >= 0.5 ? ' · было ' + dayLoad(was) : '') + (list.length ? ' · ≈ ' + C.fmtDur(C.estMinutes(cfg, list, D.cfg.rest)) : ''))),
    rows.length ? rows : h('p', { class: 'sub', style: 'padding:10px 0' }, edit ? 'Пусто. Добавь упражнения из списка.' : 'В этот день упражнений пока нет.'),
    adder);
}
export async function acceptProgram(pr: Built, name: string | null) {
  const lastDone = D.W.filter(w => !w.open).slice(-1)[0];
  const since = lastDone && lastDone.date >= D.today ? C.addDays(lastDone.date, 1) : D.today;
  const was = S.ui.prog ? S.ui.prog.daysWas : 0, mode = S.ui.prog ? modeKey(S.ui.prog) : '';
  const ok = await saveCfg(raw => {
    for (const [id, def] of Object.entries(pr.create)) if (!raw.ex[id]) { if (def.gear) needGear(raw, def.gear); raw.ex[id] = def; }   // (в эталоне нет) цель из встроенного справочника приходит со своим снарядом: подтягивания
    const prev: Record<string, string> = {};
    for (const [id, g] of Object.entries(pr.goals)) { if (!raw.ex[id]) continue; prev[id] = raw.ex[id].goal || ''; if (g) raw.ex[id].goal = g; else delete raw.ex[id].goal; }
    const slots: ProgSlots = {};
    for (const sl of C.SLOTS) slots[sl.id] = pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex });
    const old = raw.program ? Object.assign({}, raw.program) : null;
    if (old) delete old.prev;
    const keep = pr.manual && old;                                   // edited by hand: the priority and the defaults of the programme stay
    raw.program = { name: (name || pr.name).slice(0, 60), focus: keep ? old.focus || '' : pr.focus || '', others: keep ? old.others || '' : pr.others || '', since, made: D.today, slots, prev: old ? { goals: prev, program: old } : { goals: prev } };
    const prio = keep ? old.prio || '' : pr.prio || '', budget = keep ? +old.budget! || 0 : +pr.budget! || 0;
    if (prio) raw.program.prio = prio;
    if (budget) raw.program.budget = budget;
    if (pr.manual || (keep && old.lean)) raw.program.lean = true;   // built by hand: extra sets and new exercises are offered, not switched on
    if (keep ? old.strength : pr.strength) { raw.program.strength = true; raw.program.lean = true; }   // силовой режим: подсобка ниже рабочей зоны намеренно, поэтому добавки плана только предлагаются
    /* (в эталоне нет) «Сила: пауэрлифтерская тройка» (решение владельца, 24 ноября 2026, пункт 8): по проценту идут три движения, правка вручную их не меняет */
    const triad = keep ? old.triad : pr.triad;
    if (triad && triad.length) raw.program.triad = triad.slice();
    /* (в эталоне нет) число дней меняли перед принятием — «Вернуть прежнюю» вернёт и его; лимит недели, найденный по времени, программа держит,
       пока не изменилось то, по чему он найден: иначе сразу после «Принять» дневник предлагал бы уже другую программу с лимитом побольше */
    if (was && was !== C.SLOTS.length) raw.program.prev!.days = was;
    const time = timeOf(raw), fit = keep ? old.fit : time && !pr.manual ? { time, rest: D.cfg.rest, mode, days: C.SLOTS.length } : null;
    if (fit) raw.program.fit = fit;
    /* (в эталоне нет) базовые, которыми программа пожертвовала из-за числа дней: когда дней станет больше, сборка их вернёт. Правка вручную
       оставляет прежний список, кроме того, что атлет сам поставил в дни */
    const drop = keep ? (old.drop || []).filter(id => !C.SLOTS.some(sl => slots[sl.id].some(e => e.ex === id))) : pr.dropped;
    if (drop.length) raw.program.drop = drop.slice();
  });
  if (!ok) return;
  S.ui.prog = null; S.ui.plan = null;
  toast('Программа принята: следующие тренировки пойдут по ней');
  render(true);
}
export async function undoProgram() {
  const ok = await saveCfg(raw => {
    const P = raw.program;
    if (!P) return;
    for (const [id, g] of Object.entries((P.prev || {}).goals || {})) { if (!raw.ex[id]) continue; if (g) raw.ex[id].goal = g; else delete raw.ex[id].goal; }
    /* (в эталоне нет) программа принималась под другое число дней: прежняя возвращается вместе со своим */
    if (!weekDays() && P.prev && P.prev.days) { if (daysOf(P.prev) === 3) delete raw.days; else raw.days = daysOf(P.prev); }
    if (P.prev && P.prev.program) raw.program = P.prev.program; else delete raw.program;
  });
  useDays(daysOf(S.cfgRaw), weekDays());
  if (!ok) return;
  S.ui.prog = null; S.ui.plan = null;
  toast('Вернул прежнюю программу');
  render(true);
}
/* where a week breaks the athlete's limits */
export function rulesBox(list: string[]) {
  return list.length ? h('div', { class: 'rules', role: 'alert' }, h('b', null, 'Выходит за твои лимиты'), list.map(t => h('div', { text: t }))) : null;
}
export function vProgram() {
  if (S.conn !== 'ready') return [];
  const out = [], cfg = D.cfg, P = cfg.program, ro = !S.canWrite, done = D.W.filter(w => !w.open);
  const cur = C.currentSlots(D.W, cfg), curT = C.progTally(cfg, cur), empty = C.SLOTS.every(sl => !cur[sl.id].length);
  const lastOf: Record<string, Workout> = {};
  for (const w of done) if (w.slot) lastOf[w.slot] = w;
  const pending = C.SLOTS.filter(sl => C.progPending(cfg, sl.id, lastOf[sl.id]));
  const lifts = progLifts(cfg);                                      // базовые для «Силы» и «Гибрида» (draft.ts)

  /* what runs now */
  let state;
  if (P) {
    /* по каким дням идёт программа, считается по её собственным дням, а не по дням выбранной недели: тренировка по ней в дне вне недели — тоже
       тренировка по ней. С таблицей дней эталона дни программы и дни недели — одно и то же */
    const started = Object.keys(P.slots).filter(id => (P.slots[id] || []).length).some(id => !C.progPending(cfg, id, lastOf[id]));
    /* (в эталоне нет) день недели, которого в принятой программе нет: он пуст, пока не принята программа на новое число дней */
    const holes = weekDays() ? [] : C.SLOTS.filter(sl => !(P.slots[sl.id] || []).length && !cur[sl.id].length);
    const on = P.strength && P.focus ? C.SLOTS.filter(sl => cur[sl.id].some(e => e.ex === P.focus || (C.isLight(cfg, e.ex) && cfg.ex[e.ex].of === P.focus))).length : 0;
    state = [h('p', { class: 'sub' }, 'Принята ' + C.fmtDate(P.made || P.since, true) + '. ',
      !pending.length ? (holes.length ? 'Её дни уже идут по ней.' : 'Все дни уже идут по ней: дальше каждый день строится от своей прошлой тренировки.') : started ? 'Ещё не было по ней: ' + C.list(pending.map(sl => sl.n.toLowerCase())) + '.' : 'По ней ещё не было ни одной тренировки.',
      holes.length ? ' ' + C.list(holes.map((sl, i) => i ? sl.n.toLowerCase() : sl.n)) + ' в ней ' + (holes.length > 1 ? 'пусты: заполнятся' : 'пуст: заполнится') + ', когда примешь программу ниже.' : '',
      P.focus && cfg.ex[P.focus] && !(appRules() && P.strength) ? ' Приоритет — «' + C.exName(cfg, P.focus) + '», остальные базовые ' + (P.others === 'grow' ? 'растут как раньше.' : P.others === 'plain' && appRules() ? 'идут как подсобка.' : 'на поддержании.') : '',
      P.prio && C.PRIOS.some(g => g.id === P.prio) ? ' Приоритет — ' + C.PRIOS.find(g => g.id === P.prio)!.n.toLowerCase() + '.' : '',
      /* (в эталоне нет) с днями «День N» под «Силой» по проценту идёт только цель: тройка или одно упражнение (пункт 8) */
      P.strength && appRules() && P.triad && P.triad.length ? ' Сила в тройке: ' + C.list(P.triad.filter(id => cfg.ex[id]).map(id => C.exName(cfg, id).toLowerCase())) + ' — каждое два раза в неделю, остальные базовые — обычные упражнения, подсобка — ниже рабочей зоны.'
        : P.strength && appRules() && P.focus && cfg.ex[P.focus] ? ' Сила: «' + C.exName(cfg, P.focus) + '»' + (on > 1 ? '. ' + soloNow(on, C.SLOTS.length).replace(/^о/, 'О') : '') + '; остальные базовые — обычные упражнения, подсобка — ниже рабочей зоны.'
        : P.strength ? (P.focus && cfg.ex[P.focus] ? (on > 1 ? ' Сила в одном базовом: ' + soloNow(on, C.SLOTS.length) + ', подсобка — ниже рабочей зоны.' : ' Сила в одном базовом, подсобка — ниже рабочей зоны.') : ' Силовой режим: каждое базовое идёт два раза в неделю, подсобка — ниже рабочей зоны.') : '',
      P.budget ? ' Лимит недели — ' + P.budget + ' подходов.' : ''),
    !started && !ro && P.prev ? h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn sm', id: 'prog-undo', onclick: undoProgram }, 'Вернуть прежнюю')) : null];
  } else state = h('p', { class: 'sub' }, empty ? 'Программы пока нет. Собери её ниже: добавь упражнения в дни и нажми «Принять программу».' : 'Она ведётся по тренировкам: дневник берёт за основу последнюю тренировку каждого дня и строит по ней следующую.');
  /* (в эталоне нет) дней в неделе стало меньше, а в убранном дне что-то стоит: в план оно не попадает, пока не принята программа на новое число дней */
  const away = awayDays(done, cfg), awaySig = away.map(d => d.id + ':' + d.items.map(e => e.ex + ':' + (e.n || '')).join(',')).join(';'), exWord = (n: number) => n + ' ' + C.plural(n, ['упражнение', 'упражнения', 'упражнений']);
  const awayNote = away.length ? h('p', { class: 'note', id: 'pd-away', role: 'status', style: 'margin-top:8px' }, away.map(d => {
    const base = d.items.filter(e => C.isCycle(cfg, e.ex)).map(e => C.exName(cfg, e.ex)), rest = d.items.length - base.length;
    return C.SLOT[d.id].n + ' сейчас не в неделе: ' + (base.length ? C.list(base) + (rest ? ' и ещё ' + exWord(rest) : '') : exWord(rest)) + ' в план не ' + (d.items.length === 1 ? 'попадает' : 'попадают') + '.';
  }).join(' ') + (ro ? '' : ' Прими программу ниже — сборка разложит неделю заново, а в «Вручную» добавь их в дни сам — или верни прежнее число дней.')) : null;
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Действует сейчас'), h('h2', null, P ? P.name : empty ? 'Программы нет' : 'Своя программа')), empty ? null : h('span', { class: 'sub' }, loadText(C.SLOTS.reduce((a, sl) => a + curT.load[sl.id], 0)) + ' в неделю')),
    state, awayNote,
    empty ? null : h('div', { class: C.SLOTS.length === 2 ? 'grid2 even' : C.SLOTS.length === 4 ? 'grid4' : 'grid3', style: 'margin-top:12px' }, C.SLOTS.map(sl => progDay(cfg, sl, cur[sl.id], curT.load[sl.id], null, null, null))),
    rulesBox(C.ruleBreaks(cfg, curT))));
  if (ro) return out;

  /* a new one */
  const { st, pr, edit, fit, time, budgets, manual, lift, prio, strong, solo, triad, changed, recount, pick } = progDraft(cfg, cur, empty, lifts, awaySig);   // черновик — общий с онбордингом (draft.ts)
  /* one click on a muscle: the diary itself finds the set or the exercise to add or to take away */
  /* the pool of the week: the limit chosen for this build (the profile's own limit in the manual and strength modes) */
  const cap = manual ? cfg.caps.week : st.budget;
  const freeOf = (t: ProgTally) => +(cap - C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0)).toFixed(1);
  const freeText = (f: number) => f > 0.01 ? 'свободно ' + C.fmt(f, 1) : f < -0.01 ? 'на ' + C.fmt(-f, 1) + ' больше лимита' : 'свободных подходов нет';
  const nudge = (m: Muscle, dir: number) => {
    const r = C.nudgeMuscle(pr.cfg, pr.slots, m.id, dir, { z: cfg.zones, ignore: cfg.ignore, budget: cap, dayCap: cfg.caps.day }, (id, def) => { pr.create[id] = def; pr.cfg.ex[id] = C.placed(pr.cfg, Object.assign({ n: id }, def)); });
    toast(r.ok ? m.n + ' — ' + r.text.charAt(0).toLowerCase() + r.text.slice(1) + ' · ' + freeText(freeOf(C.progTally(pr.cfg, pr.slots))) : r.text);
    if (!r.ok) return;
    (pr.hand = pr.hand || []).push({ m: m.n, t: r.text });
    recount();
  };
  const avgMin = C.SLOTS.filter(sl => pr.slots[sl.id].length).map(sl => C.estMinutes(pr.cfg, pr.slots[sl.id], D.cfg.rest));
  const total = (t: ProgTally) => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
  const used = total(pr.after), free = +(cap - used).toFixed(1), hand = pr.hand && pr.hand.length ? pr.hand : null;
  const z = cfg.zones, fm = pr.focus ? (pr.cfg.ex[pr.focus].m || {}) : pr.prio ? Object.fromEntries(C.PRIOS.find(g => g.id === pr.prio)!.m.map(m => [m, 1])) : {};
  /* a row is marked when its mode or goal differs from what runs now */
  const marked = (e: ProgEntry) => pr.goals[e.ex] !== undefined && (C.goalOf(cfg, e.ex) || null) !== pr.goals[e.ex];
  /* every muscle is listed, so the table reads as the whole week; muscles outside the goal are left out only while they get nothing */
  /* every muscle has a row: the ones left out of the count stay at what they have, and the buttons are the way to give them more */
  /* s: how much of the new volume is strength work — the lifts done by percentages; shown in brackets next to the total */
  const vols = C.MUSCLES.map(m => ({ m, a: pr.before.pv[m.id] || 0, b: pr.after.pv[m.id] || 0, s: (pr.after.ps || {})[m.id] || 0, sa: (pr.before.ps || {})[m.id] || 0 }));
  const splitOf = (r: VolRow) => C.splitText(r.b, r.s), splitNow = (r: VolRow) => C.splitText(r.a, r.sa);
  const nMoved = vols.filter(r => Math.abs(r.b - r.a) >= 0.05).length;
  /* (в эталоне нет) дни «День N»: если второй день достался не всем мышцам (об этом заметка сборки), пояснение не обещает его каждой */
  const thin = !weekDays() && pr.notes.some(n => n.t.startsWith('Один день в неделю')), twice = thin ? 'Второй день достался не всем мышцам: каким — ниже, в «Что изменилось и почему».' : 'Каждая мышца работает минимум в два дня недели.';

  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Новая программа'), h('h2', null, manual ? 'Правка вручную' : pr.name)), h('span', { class: 'sub' }, loadText(total(pr.after)) + ' в неделю' + (empty && !pr.away ? '' : ' · сейчас ' + dayLoad(total(pr.before) + (pr.away || 0))) + (avgMin.length ? ' · тренировка ≈ ' + C.fmtDur(avgMin.reduce((a, b) => a + b, 0) / avgMin.length) : ''))),
    h('p', { class: 'note', style: 'margin-bottom:12px' }, manual ? 'Собери или поправь программу сам: добавляй упражнения в дни, меняй порядок и число подходов. Упражнений, которых нет в списке, сначала заведи в «Настройке». Записи в журнале не меняются.'
      : triad && pr.strength ? 'Сила в тройке: ' + C.list((pr.triad || []).map(id => C.exName(pr.cfg, id).toLowerCase())) + '. Каждое движение идёт два дня в неделю: 4 × 4 с весом по запасу и лёгкий день. Остальные базовые — обычные упражнения, подсобка — чуть ниже рабочей зоны. ' + twice
      : strong && pr.strength ? 'Сила во всех базовых. Каждое идёт два дня в неделю: 4 × 4 с весом по запасу и лёгкий день. Подсобка — чуть ниже рабочей зоны: место в неделе отдано базовым. ' + twice
      : solo && pr.strength ? (appRules() ? 'Сила в одном движении. ' + soloText(C.SLOTS.length, isoLift(pr.cfg, solo)) + ' Его мышцам — в полтора раза больше подходов, чем остальным; остальные базовые — обычные упражнения, подсобка — чуть ниже рабочей зоны. ' : 'Сила в одном базовом. ' + soloText(C.SLOTS.length) + ' Остальные базовые — раз в неделю, подсобка — чуть ниже рабочей зоны. ') + twice
      : lift ? 'Масса и сила с акцентом на одном базовом. ' + mixText(C.SLOTS.length, isoLift(pr.cfg, lift)) + ' Остальные мышцы делят объём поровну' + (thin ? '. ' + twice : ', каждая работает минимум в два дня недели.')
      : prio ? 'Приоритетные мышцы получают примерно в полтора раза больше остальных, остальные делят объём поровну. ' + twice + ' Лимиты недели и дня не нарушаются.'
      : 'Все мышцы в цели получают поровну, разброс — около двух подходов. ' + twice + ' Лимиты недели и дня не нарушаются.'),
    h('div', { class: 'row', style: 'margin-bottom:12px;align-items:flex-end' },
      goalPicker(st, cfg, lifts, pick),                               // вместо списка «Как собрать»: кнопки цели и один уточняющий список (решение владельца, 19 ноября 2026)
      lift || (solo && !appRules()) ? h('div', { class: 'pf' }, h('span', null, 'Остальные базовые'), h('div', { class: 'seg multi', role: 'group', 'aria-label': 'Остальные базовые упражнения' },
        appRules() ? h('button', { type: 'button', id: 'po-plain', 'aria-pressed': String(st.others === 'plain'), onclick: () => pick(st.focus, 'plain') }, 'Как подсобка') : null,   // (в эталоне нет) решение владельца, 25 ноября 2026
        appRules() ? null : h('button', { type: 'button', id: 'po-hold', 'aria-pressed': String(st.others === 'hold'), onclick: () => pick(st.focus, 'hold') }, 'Поддержание'),   // (в эталоне есть) с днями «День N» его нет: два варианта (решение владельца, 25 ноября 2026)
        h('button', { type: 'button', id: 'po-grow', 'aria-pressed': String(st.others === 'grow'), onclick: () => pick(st.focus, 'grow') }, 'Растут как раньше'))) : null,
      /* сколько дней в неделе (в эталоне нет: решение владельца, 19 ноября 2026): выбор хранится в профиле, программа пересобирается под это число.
         При сверке с эталоном дней всегда три, и выбора нет */
      weekDays() ? null : h('div', { class: 'pf', id: 'pd' }, h('span', null, 'Дней в неделю'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Тренировочных дней в неделю' },
        DAY_COUNTS.map(n => h('button', { type: 'button', id: 'pd-' + n, 'aria-pressed': String(n === C.SLOTS.length), onclick: async () => {
          if (n === C.SLOTS.length) return;
          if (st.daysWas == null) st.daysWas = C.SLOTS.length;
          await saveCfg(raw => { if (n === 3) delete raw.days; else raw.days = n; });
          useDays(n, false); st.draft = null; S.ui.plan = null; render(true);
        } }, String(n))))),
      weekDays() || manual ? null : pairsRow(),                       // (в эталоне нет) какие дни идут подряд (решение владельца, 25 ноября 2026; care.ts)
      /* (в эталоне нет) базовых больше, чем дней (решение владельца, 23 ноября 2026): в тренировке одно базовое, лишнее уходит из программы.
         Каким жертвовать, выбирает атлет; пока не выбрал — стоит то, что сборка убрала по правилу. Выбор живёт, пока страница открыта, и уходит с принятой программой */
      !manual ? pr.dropped.map((x, i) => h('label', { class: 'f' }, h('span', null, 'Без базового'), h('select', { id: 'pd-drop' + (i ? '-' + i : ''), onchange: e => {
        const v = e.target.value, next = pr.dropped.slice(), j = next.indexOf(v);
        if (j >= 0) next[j] = next[i];
        next[i] = v; st.drop = next; st.draft = null; render(true);
      } }, pr.dropFrom.map(id => h('option', { value: id, selected: id === x, text: C.exName(cfg, id) }))))) : null,
      /* время на тренировку: выбор запоминается в профиле; «не ограничено» — лимит выбирается списком рядом, как в эталоне */
      !manual ? h('label', { class: 'f' }, h('span', null, 'Время на тренировку'), h('select', { id: 'pt', onchange: async e => { const v = +e.target.value; await saveCfg(raw => { if (v) raw.time = v; else delete raw.time; }); if (!v) { st.budget = modeBudget(st.focus, cfg.caps.week); delete st.keep; } st.draft = null; render(true); } },
        [0].concat(TIMES.includes(time) || !time ? TIMES : TIMES.concat(time).sort((a, b) => a - b)).map(v => h('option', { value: v, selected: v === time, text: v ? 'до ' + C.fmtDur(v) : 'не ограничено' })))) : null,
      /* лимит, выбранный вручную, снимает время на тренировку: два списка задают одно и то же, действует последний выбор.
         (в эталоне нет) С днями «День N» списка нет: подходы дневник считает сам от времени, дней и цели, а лимит недели — потолок методики (просьба владельца, 25 ноября 2026) */
      !manual && !appRules() ? h('label', { class: 'f' }, h('span', null, 'Подходов в неделю, не больше'), h('select', { id: 'pb-budget', onchange: async e => { st.budget = +e.target.value; st.draft = null; if (time) { delete st.keep; await saveCfg(raw => { delete raw.time; }); } render(true); } }, budgets.map(v => h('option', { value: v, selected: v === st.budget, text: v + (time && v === st.budget ? ' — по времени' : v === cfg.caps.week ? ' — твой лимит' : '') })))) : null,
      restSelect('prog-rest'),
      manual ? h('label', { class: 'f grow' }, h('span', null, 'Название программы'), h('input', { type: 'text', id: 'prog-name', value: st.name != null ? st.name : pr.name, oninput: e => { st.name = e.target.value; } })) : null),
    fit && !fit.fits ? h('p', { class: 'sub', id: 'pt-note', role: 'status', style: 'margin:-4px 0 12px' }, 'За ' + C.fmtDur(time) + ' не уложиться: даже ' + fit.budget + ' подходов в неделю — это тренировка ≈ ' + C.fmtDur(fit.min) + (appRules() ? '. Выбери больше времени или больше дней в неделю.' : '. Увеличь время или сократи отдых.')) : null,
    h('div', { class: C.SLOTS.length === 2 ? 'grid2 even' : C.SLOTS.length === 4 ? 'grid4' : 'grid3' }, C.SLOTS.map(sl => appRules() && !manual ? builtDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], edit) : progDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], empty ? null : pr.before.load[sl.id], edit, marked))),   // (в эталоне нет) с днями «День N» у программы, которую собрал дневник, только «Заменить» (builtday.ts, решение владельца 25 ноября 2026)
    h('p', { class: 'sub', style: 'margin-top:8px' }, (appRules() && !manual ? 'Полоса слева — замена. ' : 'Полоса слева — то, что меняется. ') + 'Время — разминка, подходы и отдых ' + (appRules() ? 'по упражнению: 5 мин в тяжёлом дне, 3 мин в лёгком, 2 мин 30 с в многосуставных со штангой, 2 мин в остальных.' + paceText() : 'по ' + C.fmtRest(cfg.rest) + '.')),
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
