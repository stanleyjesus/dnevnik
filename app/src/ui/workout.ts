/* Экран «Тренировка»: план, запись подходов, завершение.
   Перенесено из reference/src/ui2.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C, h, icon, pill, toInt, toNum } from './dom.ts';
import { PT, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { backupDraft, flushSave, saveCfg, saveT, setSaveState, touch, uniqueId } from './storage.ts';
import { D, go, render } from './render.ts';
import { dayTitle, durText, paintEta, planLegend, planRows, planSets, propList, restSelect, setWord, startWorkout } from './overview.ts';
import { exForm } from './setup.ts';
import { appRules, cutAsk, HEAVY, heavyOf, LIGHT_RIR, lightWhy, restTag, rirOf } from '../core/rules.ts';
import { byButtons, okMin } from '../core/pace.ts';
import { goneOf, movesOf, skipProgram } from './skipfix.ts';
import { factDur, minField, paceText } from './pace.ts';
import { warmLine } from './warmup.ts';
import { liveApply, liveLine, ownWeight, PICK } from './live.ts';
import { trimLine, trimProgram } from './trim.ts';
import { workCar, wkNext } from './workcar.ts';   // (в эталоне нет) идущая тренировка каруселью (просьба владельца, 28 ноября 2026)
import type { Adapted, Addition, Item, Prop, Range, SetRec, Workout } from '../core/index.ts';
import type { CyclePlan, Kid, RangeTrack, SetGoal, SetsSource } from './types.ts';

/* ---------- workout ---------- */
export function vWorkout() {
  if (S.conn !== 'ready') return [];
  if (S.draft) return workoutEditor();
  if (!S.canWrite) return [h('div', { class: 'card empty' }, 'Записывать тренировки может только владелец дневника.')];
  const ui = S.ui;
  if (!ui.plan) ui.plan = { slot: D.slot, date: D.date };
  const pl = ui.plan, A = C.adapt(D.W, D.cfg, pl.slot, pl.date), n = A.props.length + A.adds.length;
  if (!pl.off) pl.off = Object.assign({}, A.off0);
  if (!n) pl.variant = 'base'; else if (!pl.variant || appRules()) pl.variant = 'adj';   // (в эталоне нет) с днями «День N» план всегда с поправками дневника, выбора варианта нет (решение владельца, 25 ноября 2026)
  const adj = pl.variant === 'adj';
  const sel = adj ? C.applyAdapt(A, pl.off) : { items: A.base.items, create: {}, used: [] };
  const baseSets = planSets(A.base.items), selSets = planSets(sel.items);
  const start = async (items: Item[]) => {
    const mk = Object.entries(sel.create).filter(e => !S.cfg.ex[e[0]]);
    if (mk.length) { const ok = await saveCfg(raw => { for (const [id, def] of mk) raw.ex[id] = def; }); if (!ok) return; }
    startWorkout({ slot: pl.slot, date: pl.date, items });
  };
  return [h('div', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Новая тренировка'), h('h2', null, dayTitle(pl.date)))),
    h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('label', { class: 'f' }, h('span', null, 'Дата'), h('input', { type: 'date', id: 'np-date', value: pl.date, onchange: e => { if (e.target.value) { ui.plan = { slot: pl.slot, date: e.target.value }; render(true); } } })),
      h('label', { class: 'f' }, h('span', null, 'День программы'), h('div', { class: 'seg', role: 'group', 'aria-label': 'День программы' }, C.SLOTS.map(s => h('button', { type: 'button', 'aria-pressed': String(pl.slot === s.id), onclick: () => { ui.plan = { slot: s.id, date: C.nextDate(s.id, D.today, D.W) }; render(true); } }, s.n)))),
      n && !appRules() ? h('label', { class: 'f' }, h('span', null, 'Вариант плана'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Вариант плана' },
        h('button', { type: 'button', 'aria-pressed': String(adj), onclick: () => { pl.variant = 'adj'; render(true); } }, 'С поправками дневника'),
        h('button', { type: 'button', 'aria-pressed': String(!adj), onclick: () => { pl.variant = 'base'; render(true); } }, 'Только по моим правилам'))) : null,
      restSelect('np-rest')),
    A.deload ? h('div', { class: 'banner', style: 'margin-bottom:12px' }, h('b', null, 'Похоже на накопленную усталость. '), 'В ' + A.worse + ' из ' + A.of + ' упражнений последняя тренировка слабее предыдущей, поэтому ' + (appRules() ? 'в плане разгрузка: половина подходов.' : 'вариант с поправками — разгрузочный.')) : null,
    trimLine(),   // (в эталоне нет) программу сократил дневник: тренировки не влезали во время (trim.ts)
    /* (в эталоне нет) с днями «День N» карточки поправок с галочками нет: план выставляет дневник по алгоритму, руками его не правят (просьба владельца, 26 ноября 2026) */
    n && adj && !appRules() ? h('div', { class: 'adj-box', style: 'margin-bottom:12px' }, h('div', { class: 'eyebrow', style: 'margin-bottom:2px' }, 'Что дневник меняет в плане и почему'), h('p', { class: 'sub' }, 'Сними галочку, если поправка не нужна. По умолчанию включены все изменения веса, до двух добавочных подходов и одно новое упражнение за тренировку — остальное можно отметить самому.'),
      propList(A, pl.off, (k, isOff) => { if (isOff) pl.off![k] = true; else delete pl.off![k]; render(true); })) : null,
    h('p', { class: 'sub', style: 'margin-bottom:6px' }, A.base.prog ? 'Основа — программа «' + D.cfg.program!.name + '»: в этот день она идёт первый раз, ' + (D.W.some(w => !w.open) ? 'веса взяты из последних тренировок каждого упражнения' : 'вес в каждом упражнении подбирается на месте') + '. В плане ' + setWord(selSets) + (adj && selSets !== baseSets ? ' (по программе ' + baseSets + ')' : '') + '. Всё можно поправить по ходу.' : A.base.template ? 'Основа — тренировка ' + C.fmtDate(A.base.template.slice(0, 10), true) + '. В плане ' + setWord(selSets) + (adj && selSets !== baseSets ? ' (по правилам было бы ' + baseSets + ')' : '') + '. Всё можно поправить по ходу.' : '',
      !n && A.base.items.length ? ' Поправок нет: дневник не видит причин отходить от правил.' : ''),
    sel.items.length ? h('p', { class: 'sub', style: 'margin-bottom:6px' }, h('b', null, 'Время: ' + durText(sel.items)), ' — разминка, ' + setWord(selSets) + (appRules() ? ' и отдых: у каждого упражнения свой, от 2 до 5 мин.' + paceText() : ' и отдых по ' + C.fmtRest(D.cfg.rest) + ' (в базовых по волне на минуту дольше).')) : null,   // (в эталоне нет) с днями «День N» — с темпом атлета (pace.ts)
    planRows(sel.items, pl.slot, pl.date, A, sel.used), sel.items.length ? planLegend(adj && sel.used.length > 0) : null,
    h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn primary', onclick: () => start(sel.items) }, 'Начать тренировку'), sel.items.length && !appRules() ? h('button', { class: 'btn', onclick: () => startWorkout({ slot: pl.slot, date: pl.date, items: [] }) }, 'Начать с пустого листа') : null))];   // (в эталоне нет) с днями «День N» — без «Начать с пустого листа» (просьба владельца, 26 ноября 2026)
}
export function rangeTrack(range: Range, prevR: number | null) {
  const [lo, hi] = range, pos = (r: number) => Math.max(-8, Math.min(108, (r - lo) / Math.max(1, hi - lo) * 100));
  const tr = h('div', { class: 'rr', role: 'img' }, h('i', { class: 'track' }), h('span', { class: 'lo' }, lo), h('span', { class: 'hi' }, hi)) as RangeTrack;
  if (prevR != null) { const p = h('i', { class: 'p', title: 'прошлый раз: ' + prevR }); p.style.left = 'calc(6px + (100% - 12px) * ' + (pos(prevR) / 100) + ')'; tr.appendChild(p); }
  const c = h('i', { class: 'c' }); c.style.display = 'none'; tr.appendChild(c);
  tr.setCur = r => { if (r == null) { c.style.display = 'none'; } else { c.style.display = 'block'; c.style.left = 'calc(6px + (100% - 12px) * ' + (pos(r) / 100) + ')'; } tr.setAttribute('aria-label', 'Диапазон ' + lo + '–' + hi + (prevR != null ? ', прошлый раз ' + prevR : '') + (r != null ? ', сейчас ' + r : '')); };
  return tr;
}
export function setFeedback(st: SetRec, g: SetGoal | null | undefined, range: Range, step: number) {
  const [lo, hi] = range;
  if (st.r != null) {
    const rule = st.r >= hi ? 'up' : st.r < lo ? 'down' : 'hold', pr = C.effReps(st), byQ = pr >= hi ? 'up' : pr < lo ? 'down' : 'hold';
    if (st.q != null && byQ !== rule) return ['info', 'с запасом ' + st.q + ' это как ' + pr + ' ' + C.plural(pr, ['повтор', 'повтора', 'повторов']) + ': дневник предложит ' + (byQ === 'up' ? 'повысить вес' : byQ === 'down' ? 'снизить вес' : 'оставить вес')];
    if (rule === 'up') return ['good', 'верх диапазона: дальше +' + C.fmt(step) + ' кг'];
    if (rule === 'down') return ['serious', 'ниже диапазона: дальше вес ниже'];
    return ['info', 'в диапазоне: дальше цель ' + Math.min(hi, st.r + 1) + '+'];
  }
  if (!g) return null;
  if (g.rule === 'adj') return ['info', 'поправка дневника, цель ' + g.target[0] + '+'];
  if (g.rule === 'up') return ['info', 'новый вес, цель ' + lo + '+'];
  if (g.rule === 'hold') return ['info', 'цель ' + g.target[0] + '+'];
  if (g.rule === 'down') return ['serious', 'вес снижен, цель ' + lo + '–' + hi];
  return null;
}
export function workoutEditor() {
  const d = S.draft as Workout, out: Kid[] = [], ro = !S.canWrite;
  const wk = C.weekNo(d.date, D.cfg.start!);
  /* (в эталоне нет) идущая тренировка с днями «День N» — каруселью, без шапки с датой, днём и неделей (просьба владельца, 28 ноября 2026; workcar.ts):
     упражнения — карточками, остальное — в последней карточке «Конец тренировки» */
  const car = appRules() && !!d.open, tail: Kid[] = [], dst = car ? tail : out;
  if (!car) out.push(h('div', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, d.open ? 'Тренировка идёт' : 'Правка записи'), h('h2', null, dayTitle(d.date))),
      h('span', { class: 'sub' }, 'Неделя ' + wk + ' · ', h('span', { id: 'eta' }, ''), ' · ', h('span', { id: 'save-state' }, ''))),
    h('div', { class: 'row' },
      h('label', { class: 'f' }, h('span', null, 'Дата'), h('input', { type: 'date', id: 'wk-date', value: d.date, onchange: e => { if (e.target.value) { d.date = e.target.value; d.id = uniqueId(d.date, S.draftSaved); touch(); render(true); } } })),
      h('label', { class: 'f' }, h('span', null, 'День программы'), h('div', { class: 'seg', role: 'group', 'aria-label': 'День программы' }, C.SLOTS.concat([d.slot, (S.workouts.find(w => w.id === S.draftSaved) || { slot: null }).slot].filter((id, i, a) => !!id && !!C.SLOT[id] && !C.SLOTS.some(s => s.id === id) && a.indexOf(id) === i).map(id => C.SLOT[id!])).map(s => h('button', { type: 'button', 'aria-pressed': String(d.slot === s.id), onclick: () => { d.slot = s.id; touch(); render(true); } }, s.s)))),
      S.canWrite ? restSelect('wk-rest') : null,
      appRules() && !d.open ? minField(d, 'Длилась, мин') : null)));   // (в эталоне нет) время по факту можно поправить в записи

  const A = d.open ? C.adapt(D.W, D.cfg, d.slot!, d.date) : null;
  const cards = d.items.map((it, idx) => exerciseCard(d, it, idx, A));
  if (!car) out.push(...cards);
  /* (в эталоне нет) упражнения, которые поправка «Не делал два раза» убрала из плана (core/skips.ts): их можно вернуть */
  const gone = goneOf(d, A);
  if (gone.length && !ro) dst.push(h('div', { class: 'adj-box' }, h('div', { class: 'eyebrow', style: 'margin-bottom:2px' }, 'Дневник убрал из плана'),
    h('div', { class: 'plan-list' }, gone.map(p => h('div', { class: 'plan-row', style: 'align-items:center' }, h('div', { class: 'grow' }, h('b', { text: C.exName(D.cfg, p.ex) }), h('div', { class: 'sub', text: p.notes[0].charAt(0).toUpperCase() + p.notes[0].slice(1) + '.' })),
      h('button', { class: 'btn sm', id: 'back-' + p.ex, onclick: () => { d.items.splice(Math.min(p.idx, d.items.length), 0, C.clone(A!.base.items[p.idx])); touch(); render(true); } }, 'Вернуть'))))));
  if (A && !ro) {
    const adds = A.adds.filter(a => !d.items.some(it => it.ex === a.exId || a.a.cover(D.cfg.ex[it.ex])));
    if (adds.length) dst.push(h('div', { class: 'adj-box' }, h('div', { class: 'eyebrow', style: 'margin-bottom:2px' }, 'Дневник предлагает добавить сегодня'),
      h('div', { class: 'plan-list' }, adds.map(a => h('div', { class: 'plan-row', style: 'align-items:center' }, h('div', { class: 'grow' }, h('b', { text: a.name }), h('div', { class: 'sub', text: setWord(a.sets) + (appRules() ? '' : ' по ' + a.range[0] + '–' + a.range[1]) + ': ' + a.why })), h('button', { class: 'btn sm', onclick: () => addProposed(a) }, icon('plus'), 'Добавить'))))));
  }

  /* add exercise */
  if (S.ui.exForm === 'new-in-workout') dst.push(h('div', { class: car ? 'wk-new' : 'card' }, h('h3', { style: 'margin-bottom:10px' }, 'Новое упражнение'), exForm(null, id => { S.ui.exForm = null; if (id) addExercise(id); else render(true); })));
  else {
    const ids = Object.keys(D.cfg.ex).sort((a, b) => C.exName(D.cfg, a).localeCompare(C.exName(D.cfg, b), 'ru'));
    const inP = ids.filter(i => D.prog.has(i)), rest = ids.filter(i => !D.prog.has(i));
    const sel = h('select', { id: 'add-ex', 'aria-label': 'Упражнение' },
      inP.length ? h('optgroup', { label: 'Сейчас в программе' }, inP.map(i => h('option', { value: i, text: C.exName(D.cfg, i) }))) : null,
      rest.length ? h('optgroup', { label: 'Остальные' }, rest.map(i => h('option', { value: i, text: C.exName(D.cfg, i) }))) : null,
      h('option', { value: '__new', text: '+ Новое упражнение…' }));
    dst.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, sel), h('button', { class: 'btn', onclick: () => { const v = $('add-ex')!.value; if (v === '__new') { S.ui.exForm = 'new-in-workout'; render(true); } else addExercise(v); } }, icon('plus'), 'Добавить упражнение')));
  }
  dst.push(h('label', { class: 'f' }, h('span', null, 'Заметка к тренировке'), h('textarea', { id: 'wk-note', placeholder: 'Самочувствие, сон, что мешало', oninput: e => { d.note = e.target.value; touch(); } }, d.note || '')));

  if (car) out.push(workCar(d, cards, d.items.map(it => C.exName(D.cfg, it.ex)), h('div', { class: 'ex wk-end' }, h('div', { class: 'ex-h' }, h('h3', null, 'Конец тренировки')),
    h('p', { class: 'sub' }, h('span', { id: 'eta' }, ''), ' · ', h('span', { id: 'save-state' }, '')), h('div', { class: 'stack' }, tail))));

  /* bottom bar */
  let empty = 0, skipEx = 0;
  for (const it of d.items) { const f = it.sets.filter(s => s.r != null).length; if (!f || it.skip) skipEx += it.skip || it.sets.length ? 1 : 0; else empty += it.sets.length - f; }
  const bar = h('div', { class: 'wk-bar' });
  const loose = (empty ? 'Без повторов осталось ' + empty + ' ' + C.plural(empty, ['подход', 'подхода', 'подходов']) + ' — в журнал они не попадут. ' : '') + (skipEx ? 'Упражнений без единого подхода: ' + skipEx + ' — будут отмечены «не делал».' : '');
  if (S.ui.confirm === 'finish') bar.appendChild(h('div', { class: 'confirm' }, h('p', null, loose),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn primary', onclick: () => finishWorkout(true) }, 'Завершить'), h('button', { class: 'btn', onclick: () => { S.ui.confirm = null; render(true); } }, 'Вернуться'))));
  else if (S.ui.confirm === 'cancel') bar.appendChild(h('div', { class: 'confirm' }, h('p', null, 'Удалить эту тренировку целиком? Введённые подходы пропадут.'),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn danger', onclick: cancelWorkout }, 'Удалить тренировку'), h('button', { class: 'btn', onclick: () => { S.ui.confirm = null; render(true); } }, 'Вернуться'))));
  else if (d.open) bar.appendChild(h('div', { class: 'row between' }, h('button', { class: 'btn primary', disabled: ro, onclick: () => finishWorkout(false) }, 'Завершить тренировку'), h('button', { class: 'btn ghost danger', title: 'Удалить эту тренировку', onclick: () => { S.ui.confirm = 'cancel'; render(true); } }, 'Отменить')));
  else bar.appendChild(h('div', { class: 'row between' }, h('button', { class: 'btn primary', disabled: ro, onclick: saveEdit }, 'Сохранить изменения'), h('button', { class: 'btn', onclick: () => { S.draft = null; S.dirty = false; S.ui.confirm = null; go('journal'); } }, 'Отмена')));
  out.push(bar);
  setTimeout(() => { setSaveState(); paintEta(); }, 0);
  return out;
}
export const propApplied = (it: Item, prop: Prop) => it.sets.length === prop.sets.length && prop.sets.every((x, i) => it.sets[i].w === x.w) && (!prop.cyc || (!!it.cyc && it.cyc.reps === prop.cyc.reps)) && (!prop.range || (!!it.range && it.range[0] === prop.range[0] && it.range[1] === prop.range[1])) && (!prop.note || it.note === prop.note) && (!prop.swap || it.ex === prop.swap);   // (в эталоне нет) проверка запаса — заметкой, замена при долгом плато — упражнением
/* the mark of one exercise, changeable right in the workout card: the mode of a percentage lift, 8–12 or 6–10 for a multi-joint accessory.
   Isolation has no mark: its range follows the weight step */
export function goalSelect(it: Item) {
  const k = C.kindOf(D.cfg, it.ex), cur = C.goalOf(D.cfg, it.ex) || '';
  if (appRules() || (k !== 'base' && k !== 'compound')) return null;   // (в эталоне нет) с днями «День N» методику задаёт цель программы и тип упражнения, отметки у упражнения нет
  const opts = k === 'base' ? [['', 'обычная волна'], ['auto', 'сила по запасу: 4 × 4, вес по запасу'], ['strength', 'тяжёлая волна: прибавка раз в цикл'], ['hold', 'поддержание: на подход меньше, без прибавки']] : [['mass', '8–12 повторов'], ['both', '6–10 повторов']];
  const sel = k === 'base' ? cur : cur || (it.range && it.range[0] < 8 ? 'both' : 'mass');
  return h('label', { class: 'row', style: 'gap:6px' }, k === 'base' ? 'Режим' : 'Цель', h('select', { id: 'goal-' + it.ex, 'aria-label': k === 'base' ? 'Режим волны' : 'Диапазон по цели', onchange: async e => {
    const v = e.target.value;
    const ok = await saveCfg(raw => { if (!raw.ex[it.ex]) return; if (v) raw.ex[it.ex].goal = v; else delete raw.ex[it.ex].goal; });
    if (ok && it.cyc && S.draft && S.draft.open && it.sets.every(s => s.r == null)) {      // nothing done yet: re-plan the lift by its new wave
      const n = C.makeItem(S.workouts, S.cfg, it.ex, S.draft.slot!, S.draft.date);
      if (n.sets[0] && n.sets[0].w != null) { it.cyc = n.cyc; it.sets = n.sets; it.tm = n.tm; touch(); }
    }
    render(true);
  } }, opts.map(o => h('option', { value: o[0], selected: o[0] === sel, text: o[1] }))));
}
export function adjBox(it: Item, prop: Prop, A: Adapted) {
  const baseIt = A.base.items[prop.idx], applied = propApplied(it, prop);
  const setTo = (src: SetsSource) => { it.sets = src.sets.map((x, i) => { const o = it.sets[i] && it.sets[i].w === x.w ? it.sets[i] : null, n: SetRec = { w: x.w, r: o ? o.r : null }; if (o && o.q != null) n.q = o.q; return n; }); if (src.cyc) { it.cyc = { pct: src.cyc.pct, reps: src.cyc.reps }; it.tm = src.tm || null; } if (src.range) it.range = src.range.slice(); if (prop.note) it.note = src === prop ? prop.note : it.note === prop.note ? '' : it.note; if (prop.swap) it.ex = src === prop ? prop.swap : baseIt.ex; touch(); render(true); };   // (в эталоне нет) проверка запаса, замена при долгом плато
  return h('div', { class: 'adj-box' }, h('div', { class: 'row between' }, h('b', null, 'Поправка дневника · ' + prop.tag),
    applied ? h('button', { class: 'btn sm', onclick: () => setTo(baseIt) }, 'Вернуть по правилу') : h('button', { class: 'btn sm primary', onclick: () => setTo(prop) }, 'Применить')),
    prop.notes.map(t => h('div', { text: t.charAt(0).toUpperCase() + t.slice(1) + '.' })), h('div', { class: 'muted', text: applied ? 'Уже внесено в подходы ниже.' : 'Не внесено: подходы ниже идут по правилу или с твоими правками.' }));
}
export async function addProposed(a: Addition) {
  const d = S.draft;
  if (!d) return;
  if (a.def && !S.cfg.ex[a.exId]) { const ok = await saveCfg(raw => { if (!raw.ex[a.exId]) raw.ex[a.exId] = a.def!; }); if (!ok) return; }
  d.items.push({ ex: a.exId, cyc: null, range: a.range.slice(), sets: Array.from({ length: a.sets }, () => ({ w: null, r: null })), note: '', skip: false, rir: null });
  touch(); render(true);
}
export function exerciseCard(d: Workout, it: Item, idx: number, A: Adapted | null) {
  const ex = D.cfg.ex[it.ex] || { n: it.ex, m: {} };
  const prim = Object.entries(ex.m || {}).filter(e => e[1] >= 1).map(e => (C.MUSCLE[e[0]] || {}).n).filter(Boolean);
  const move = (k: number) => { const j = idx + k; if (j < 0 || j >= d.items.length) return; d.items.splice(j, 0, d.items.splice(idx, 1)[0]); touch(); render(true); };
  const card = h('div', { class: 'ex' + (it.skip ? ' skipped' : '') });
  const bare = appRules() && !!d.open;   // (в эталоне нет) идущая тренировка с днями «День N» (просьба владельца, 26 ноября 2026): каждая тренировка сама по себе — из инструментов упражнения только «не делал», поправки под упражнением нет; вес и подходы ставит алгоритм. Правка законченной записи — как была
  card.appendChild(h('div', { class: 'ex-h' }, h('h3', { text: ex.n }),
    h('div', { class: 'ex-tools' },
      bare ? null : h('button', { class: 'icon-btn', title: 'Выше', 'aria-label': 'Переместить выше', onclick: () => move(-1) }, icon('arrowU')),
      bare ? null : h('button', { class: 'icon-btn', title: 'Ниже', 'aria-label': 'Переместить ниже', onclick: () => move(1) }, icon('arrowD')),
      h('button', { class: 'icon-btn', title: it.skip ? 'Вернуть в тренировку' : 'Не делал', 'aria-label': it.skip ? 'Вернуть в тренировку' : 'Отметить «не делал»', 'aria-pressed': String(!!it.skip), onclick: () => { it.skip = !it.skip; if (it.skip) it.sets.forEach(s => { s.r = null; s.skip = true; }); else it.sets.forEach(s => { delete s.skip; }); touch(); if (it.skip && bare) wkNext(d, idx); render(true); } }, icon('skip')),   // (в эталоне нет) в карусели идущей тренировки «не делал» открывает следующее упражнение (workcar.ts)
      bare ? null : h('button', { class: 'icon-btn', title: 'Убрать из тренировки', 'aria-label': 'Убрать упражнение', onclick: () => { d.items.splice(idx, 1); touch(); render(true); } }, icon('x')))));
  if (it.skip) { card.appendChild(h('p', { class: 'sub' }, 'Отмечено «не делал». План: ' + it.sets.map(s => C.fmt(s.w)).join(' · ') + ' кг.')); return card; }
  const prop = A ? A.props.find(p => (p.ex === it.ex || (p.swap === it.ex && !d.items.some(x => x.ex === p.ex))) && !p.drop) : null;   // (в эталоне нет) возвращённое упражнение, которое убрала поправка «Не делал два раза», идёт по правилу; замена при долгом плато — по своей поправке
  if (prop && !bare) card.appendChild(adjBox(it, prop, A!));
  const warm = appRules() && d.open ? warmLine(d, it, idx) : null;   // (в эталоне нет) раскладка разминки (просьба владельца, 25 ноября 2026; warmup.ts)
  if (warm) card.appendChild(warm);
  if (it.cyc) cycleBlock(card, d, it, prim); else dpBlock(card, d, it, prim, idx, prop, A);
  card.appendChild(h('input', { type: 'text', id: 'ex-note-' + idx, style: 'width:100%;margin-top:8px', placeholder: 'Заметка к упражнению', 'aria-label': 'Заметка к упражнению', value: it.note || '', oninput: e => { it.note = e.target.value; touch(); } }));
  return card;
}
export function dpBlock(card: HTMLElement, d: Workout, it: Item, prim: string[], idx: number, prop: Prop | null | undefined, A: Adapted | null) {
  const hh = C.hints(D.W, D.cfg, it.ex, d.slot, d.date);
  const baseIt = prop ? A!.base.items[prop.idx] : null, appl = !!prop && propApplied(it, prop);
  if (!it.range) it.range = hh.range.slice();
  const topW = it.sets.reduce((m, s) => Math.max(m, s.w || 0), 0), fr = C.formulaRange(topW, hh.step, it.range[0]);
  const rIn = (k: number, lab: string) => h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'rng-' + idx + '-' + k, 'aria-label': lab, value: it.range![k], onchange: e => { const v = toInt(e.target.value); if (v != null && v > 0) { it.range![k] = v; if (it.range![1] <= it.range![0]) it.range![1] = it.range![0] + 1; touch(); } render(true); } });
  const bare = appRules() && !!d.open, rq = rirOf(D.cfg, it.ex);   // (в эталоне нет) идущая тренировка с днями «День N»: без диапазона, прошлых результатов и ориентиров — каждая тренировка сама по себе (просьба владельца, 26 ноября 2026)
  if (bare) card.appendChild(h('div', { class: 'ex-meta' }, prim.length ? h('span', { class: 'tag' }, prim.join(', ')) : null,
    h('span', { class: 'tag', title: 'Отдых между подходами: его ставит дневник по типу упражнения' }, restTag(D.cfg, it.ex)),
    h('span', null, 'запас ' + rq + (rq > D.cfg.rir ? ': со свободным весом отказ опасен' : '')),
    it.sets.length && it.sets.every(s => s.w == null) ? h('span', { class: 'pick' }, PICK) : hh.prevDate ? null : h('span', null, 'первая запись: подбери вес, с которым в запасе ' + (rq === 1 ? 'останется один повтор' : 'останется ' + rq))));   // (в эталоне нет) веса нет — как его подобрать (просьба владельца, 28 ноября 2026; live.ts)
  else card.appendChild(h('div', { class: 'ex-meta' }, prim.length ? h('span', { class: 'tag' }, prim.join(', ')) : null,
    appRules() ? h('span', { class: 'tag', title: 'Отдых между подходами: его ставит дневник по типу упражнения' }, restTag(D.cfg, it.ex)) : null,   // (в эталоне нет) просьба владельца, 25 ноября 2026
    h('span', null, 'Диапазон'), rIn(0, 'Нижняя граница повторов'), '–', rIn(1, 'Верхняя граница повторов'),
    (fr[1] !== it.range[1]) && topW > 0 ? h('button', { class: 'btn ghost sm', title: 'Шаг ' + C.fmt(hh.step) + ' кг от ' + C.fmt(topW) + ' кг, делённый на 2.5', onclick: () => { it.range = fr.slice(); touch(); render(true); } }, 'по формуле шага: ' + fr[0] + '–' + fr[1]) : null,
    S.canWrite ? goalSelect(it) : null,
    rirOf(D.cfg, it.ex) > D.cfg.rir ? h('span', null, 'запас ' + rirOf(D.cfg, it.ex) + ': со свободным весом отказ опасен') : null,   // (в эталоне нет) вывод 10 аудита
    hh.prevDate ? h('span', null, 'прошлый раз ' + C.fmtDate(hh.prevDate) + (hh.prevSkipped ? ' (не делал)' : '')) : h('span', null, 'первая запись: подбери вес, чтобы в первом подходе вышло ' + it.range[0] + '–' + it.range[1] + ' повторов и в запасе ' + (rirOf(D.cfg, it.ex) === 1 ? 'остался один' : 'осталось ' + rirOf(D.cfg, it.ex))),   // (в эталоне нет) запас по упражнению (вывод 10 аудита)
    appRules() && d.open && cutAsk(it.sets, hh.prevSets) ? pill('info', 'вес ниже прошлого раза: отметь запас — по нему дневник решит, как быстро вернуть вес') : null));   // (в эталоне нет) пункт 5 разбора «Сила, масса и плато» (26 ноября 2026)
  const sets = h('div', { class: 'sets' });
  sets.appendChild(h('div', { class: bare ? 'set head bare' : 'set head' }, h('span'), h('span', null, 'Вес, кг'), h('span'), h('span', null, 'Повторы'), h('span', { title: 'Сколько повторов оставалось до отказа. Пусто — как по методике: ' + rirOf(D.cfg, it.ex) }, 'Запас'), h('span')));
  it.sets.forEach((st, i) => {
    const prev = hh.prevSets[i], g = appl && (!baseIt!.sets[i] || baseIt!.sets[i].w !== prop.sets[i].w) ? { rule: 'adj', target: prop.sets[i].tg } : hh.sets[i];
    const track = rangeTrack(it.range!, prev && prev.r != null ? prev.r : null);
    const fbEl = h('span', { class: 'fb' });
    const paint = () => { if (bare) return; track.setCur(st.r); fbEl.textContent = ''; const f = setFeedback(st, g, it.range!, hh.step); if (f) fbEl.appendChild(pill(f[0], f[1])); };
    sets.appendChild(h('div', { class: bare ? 'set bare' : 'set' },
      h('span', { class: 'i' }, i + 1),
      h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'w-' + idx + '-' + i, 'aria-label': 'Вес, подход ' + (i + 1), value: st.w == null ? '' : C.fmt(st.w, 3), oninput: e => { st.w = toNum(e.target.value); if (bare) ownWeight(st); touch(); } }),   // (в эталоне нет) вес, вписанный руками, дневник по ходу тренировки не меняет (live.ts)
      h('span', { class: 'x' }, '×'),
      h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'r-' + idx + '-' + i, 'aria-label': 'Повторы, подход ' + (i + 1), placeholder: !bare && g && g.rule !== 'repeat' ? g.target[0] + '+' : '', value: st.r == null ? '' : st.r, oninput: e => { st.r = toInt(e.target.value); delete st.skip; paint(); if (bare) liveApply(it, idx, hh.step); touch(); } }),   // (в эталоне нет) вес следующих подходов по этому (live.ts)
      h('input', { class: 'num rir', type: 'text', inputmode: 'numeric', id: 'q-' + idx + '-' + i, 'aria-label': 'Запас повторов до отказа (RIR), подход ' + (i + 1), placeholder: '–', value: st.q == null ? '' : st.q, oninput: e => { const v = toInt(e.target.value); if (v == null) delete st.q; else st.q = Math.max(0, Math.min(5, v)); paint(); if (bare) liveApply(it, idx, hh.step); touch(); } }),
      bare ? null : track,
      bare ? null : h('span', { class: 'prev' }, prev ? ['было ', h('b', null, C.fmt(prev.w) + ' × ' + (prev.r == null ? '?' : prev.r)), prev.q != null ? ', запас ' + prev.q + ' ' : ' '] : null, fbEl),
      h('button', { class: 'icon-btn', title: 'Убрать подход', 'aria-label': 'Убрать подход ' + (i + 1), onclick: () => { it.sets.splice(i, 1); if (bare) liveApply(it, idx, hh.step); touch(); render(true); } }, icon('x'))));
    paint();
  });
  card.appendChild(sets);
  if (bare) card.appendChild(liveLine(it, idx, hh.step));   // (в эталоне нет) почему дневник поменял вес следующих подходов (live.ts)
  card.appendChild(h('button', { class: 'btn ghost sm', style: 'margin-top:6px', onclick: () => { const l = it.sets[it.sets.length - 1]; it.sets.push({ w: l ? l.w : null, r: null }); if (bare) liveApply(it, idx, hh.step); touch(); render(true); } }, icon('plus'), 'Подход'));
}
export function cycleBlock(card: HTMLElement, d: Workout, it: Item, prim: string[]) {
  const light = C.isLight(D.cfg, it.ex), par = light ? (D.cfg.ex[it.ex] || {}).of : null;
  const pc: CyclePlan = light ? { prev: null } : C.planCycle(D.W, D.cfg, it.ex, d.date), wv = C.waveOf(D.cfg, it.ex), uid = it.ex;
  const order = light ? [it.cyc!.reps] : wv.order.includes(it.cyc!.reps) ? wv.order : wv.order.concat(it.cyc!.reps), pctOf = (r: number) => light ? it.cyc!.pct : wv.pct[r] || it.cyc!.pct;
  const w0 = it.sets[0] ? it.sets[0].w : null;
  const tmEl = h('b', null, '');
  const paintTm = () => { const w = it.sets[0] ? it.sets[0].w : null; tmEl.textContent = w ? C.fmt(it.tm || w / (it.cyc!.pct / 100), 1) + ' кг' : '–'; };
  const A = appRules() ? heavyOf(D.cfg, it.ex) : C.AUTO;              // (в эталоне нет) с днями «День N» — тяжёлый день 3 × 4, у изоляции 3 × 6 («Новая схема», 24 ноября 2026)
  const auto = !light && wv.auto && it.cyc!.pct === A.pct && (it.cyc!.reps === A.reps || (appRules() && it.cyc!.reps > A.reps && it.cyc!.reps <= A.reps + HEAVY.reps));   // (в эталоне нет) тяжёлый день с прибавкой повторами (вывод 6 аудита, 25 ноября 2026)
  /* «сила по запасу»: what the last session decided, in the words of its rule */
  const lm = light && appRules() ? +(C.planLight(D.W, D.cfg, it.ex, d.date).move || 0) : 0;   // (в эталоне нет) лёгкий день слушает запас (вывод 7 аудита)
  const steps = +(pc.steps || 0), was = pc.rz == null ? 'в прошлый раз все подходы закрыты, запас не отмечен' : 'в прошлый раз запас ' + pc.rz + ' в последнем подходе';
  const said = !auto || !pc.prev || pc.verdict === 'start' ? null
    : appRules() && pc.verdict === 'reps' ? pill('good', was + ': плюс повтор тем же весом — шаг веса велик для этого упражнения')   // (в эталоне нет) вывод 6 аудита, 25 ноября 2026
    : appRules() && pc.verdict === 'back' ? pill('warn', (pc.closed ? 'в прошлый раз подход шёл в отказ' : 'в прошлый раз подходы не закрыты') + ': на повтор меньше тем же весом')
    : appRules() && pc.verdict === 'up' && pc.rz == null ? pill('info', was + ': плюс шаг. Отметь запас в последнем подходе — по нему дневник решает, сколько прибавить')
    : pc.verdict === 'up' ? pill('good', was + ': плюс ' + (steps > 1 ? steps + ' ' + C.plural(steps, ['шаг', 'шага', 'шагов']) : 'шаг'))
    : pc.verdict === 'hold' ? pill('info', 'в прошлый раз запас 1 в последнем подходе: вес тот же')
    : pill('warn', (pc.closed ? 'в прошлый раз подход шёл в отказ' : 'в прошлый раз подходы не закрыты') + ': вес −' + C.AUTO.down + '%');
  /* (в эталоне нет) идущая тренировка с днями «День N» (просьба владельца, 28 ноября 2026, пункт 10): одна строка схемы и запаса — без списка схемы,
     числа подходов, расчётного максимума и абзаца о запасе; план выставляет дневник, руками в идущей тренировке его не правят */
  const bare = appRules() && !!d.open, plan = it.sets.length + ' × ' + it.cyc!.reps + ' одним весом · ';
  card.appendChild(h('div', { class: 'ex-meta' }, prim.length ? h('span', { class: 'tag' }, prim.join(', ')) : null,
    appRules() ? h('span', { class: 'tag', title: 'Отдых между подходами: его ставит дневник по типу упражнения' }, restTag(D.cfg, it.ex)) : null,   // (в эталоне нет) просьба владельца, 25 ноября 2026
    bare ? h('span', null, plan + (auto ? 'запас ' + C.AUTO.aim + ' в последнем подходе' : (light ? ((D.cfg.ex[it.ex] || {}).mid ? 'средний день, ' : 'лёгкий день, ') : wv.hold ? 'поддержание, ' : '') + 'запас около ' + Math.max(0, C.estRir(it.cyc!.pct, it.cyc!.reps))))
    : auto ? h('span', null, A.sets + ' × ' + it.cyc!.reps + ' одним весом · цель — запас ' + C.AUTO.aim + ' в последнем подходе' + (appRules() ? ', отметь его' : '') + ' · расчётный максимум ', tmEl)
      : h('span', null, it.cyc!.pct + '% от расчётного максимума ' + (light && par ? 'в упражнении «' + C.exName(D.cfg, par) + '» ' : ''), tmEl),
    bare && w0 == null ? h('span', { class: 'pick' }, PICK) : null,   // (в эталоне нет) веса нет — как его подобрать (live.ts)
    light && !bare ? h('span', null, !appRules() ? 'лёгкий день: техника и скорость, до отказа далеко' : (D.cfg.ex[it.ex] || {}).mid ? 'средний день: между тяжёлым и лёгким' : 'лёгкий день: вес меньше, повторов больше, чем в тяжёлом') : null,   // (в эталоне нет) «Новая схема»: запас и в лёгком дне около 2
    S.canWrite ? goalSelect(it) : null,
    (appRules() && !!d.open) ? null : pc.prev ? h('span', null, 'прошлый раз ' + C.fmtDate(pc.prev.date) + ': ' + C.fmt(pc.prev.top.w) + ' × ' + pc.prev.item.cyc!.reps) : null,   // (в эталоне нет) в идущей тренировке с днями «День N» — без прошлого раза (просьба владельца, 26 ноября 2026)
    (appRules() && !!d.open) ? null : said || (lm ? pill(lm > 0 ? 'good' : 'warn', lightWhy(lm)) : null) || (pc.repeat ? pill('warn', 'в прошлый раз подходы не закрыты: неделя повторяется') : pc.hard ? pill('warn', 'в прошлый раз был подход в отказ: максимум не повышен') : null)));
  const repsRow = h('div', { class: 'cyc-sets' });
  const paintSets = () => {
    repsRow.textContent = '';
    repsRow.appendChild(h('span', { class: 'sub' }, 'Повторы по подходам'));
    it.sets.forEach((st, i) => repsRow.appendChild(h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'cr-' + uid + '-' + i, 'aria-label': 'Повторы, подход ' + (i + 1), placeholder: it.cyc!.reps, value: st.r == null ? '' : st.r, oninput: e => { st.r = toInt(e.target.value); touch(); } })));
    repsRow.appendChild(h('button', { class: 'btn sm', onclick: () => { it.sets.forEach(s => { s.r = it.cyc!.reps; }); touch(); paintSets(); } }, 'Все по ' + it.cyc!.reps));
    repsRow.appendChild(h('span', { class: 'sub' }, bare ? 'Запас по подходам' : auto ? 'Запас: сколько повторов оставалось до отказа. Отметь хотя бы в последнем подходе — он решает вес на следующей неделе: ' + C.AUTO.aim + ' и больше — плюс шаг, 1 — тот же, 0 — минус ' + C.AUTO.down + '%'
      : 'Запас по подходам: сколько повторов оставалось до отказа. По расчёту здесь около ' + Math.max(0, C.estRir(it.cyc!.pct, it.cyc!.reps))
        + (light && appRules() ? '. Отметь в последнем подходе: ' + LIGHT_RIR.easy + ' и больше два раза подряд — вес на шаг выше, 0 — на шаг ниже' : '')));   // (в эталоне нет) вывод 7 аудита
    it.sets.forEach((st, i) => repsRow.appendChild(h('input', { class: 'num', type: 'text', inputmode: 'numeric', id: 'cq-' + uid + '-' + i, 'aria-label': 'Запас повторов (RIR), подход ' + (i + 1), placeholder: '–', value: st.q == null ? '' : st.q, oninput: e => { const v = toInt(e.target.value); if (v == null) delete st.q; else st.q = Math.max(0, Math.min(5, v)); touch(); } })));
  };
  card.appendChild(h('div', { class: 'cyc' },
    h('label', { class: 'f' }, h('span', null, 'Вес, кг'), h('input', { class: 'num', type: 'text', inputmode: 'decimal', id: 'cw-' + uid, value: w0 == null ? '' : C.fmt(w0, 3), oninput: e => { const v = toNum(e.target.value); it.sets.forEach(s => { s.w = v; }); it.tm = null; paintTm(); touch(); } })),
    bare ? null : h('label', { class: 'f' }, h('span', null, 'Схема'), h('select', { id: 'cs-' + uid, onchange: e => { const r = +e.target.value; it.cyc = { reps: r, pct: pctOf(r) }; it.tm = null; touch(); render(true); } }, order.map(r => h('option', { value: r, selected: r === it.cyc!.reps, text: r + ' повт. · ' + pctOf(r) + '%' })))),
    bare ? null : h('label', { class: 'f' }, h('span', null, 'Подходов'), h('input', { class: 'num sm', type: 'text', inputmode: 'numeric', id: 'cn-' + uid, value: it.sets.length, onchange: e => { const n = Math.max(1, Math.min(12, toInt(e.target.value) || 1)), w = it.sets[0] ? it.sets[0].w : null; while (it.sets.length < n) it.sets.push({ w, r: null }); it.sets.length = n; touch(); render(true); } }))));
  card.appendChild(repsRow);
  paintSets(); paintTm();
}
export function addExercise(id: string) {
  const d = S.draft;
  if (!d) return;
  if (C.isCycle(D.cfg, id) || C.isLight(D.cfg, id)) d.items.push(C.makeItem(D.W, D.cfg, id, d.slot!, d.date));
  else {
    const hh = C.hints(D.W, D.cfg, id, d.slot, d.date);
    d.items.push({ ex: id, cyc: null, range: hh.range.slice(), sets: hh.sets.length ? hh.sets.map(s => ({ w: s.w, r: null })) : [0, 1, 2].map(() => ({ w: hh.start, r: null })), note: '', skip: false, rir: null });
  }
  touch(); render(true);
}
export async function finishWorkout(confirmed: boolean) {
  const d = S.draft as Workout;
  let loose = 0;
  for (const it of d.items) { const f = it.sets.filter(s => s.r != null).length; if (!f || it.skip) loose += it.sets.length ? 1 : 0; else loose += it.sets.length - f; }
  if (loose && !confirmed) { S.ui.confirm = 'finish'; render(true); return; }
  const fx = appRules() ? movesOf(d) : [];                           // (в эталоне нет) поправки «Не делал два раза», которые остались в тренировке
  const fact = appRules() && d.began ? byButtons(d, Date.now()) : null;   // (в эталоне нет) время по факту — от «Начать тренировку» до этого нажатия (pace.ts)
  if (appRules()) { const m = d.began ? fact : okMin(d.min); if (m) d.min = m; else delete d.min; }
  for (const it of d.items) {
    const f = it.sets.filter(s => s.r != null).length;
    if (!f || it.skip) { it.skip = true; it.sets.forEach(s => { s.r = null; s.skip = true; }); }
    else { it.sets = it.sets.filter(s => s.r != null); it.sets.forEach(s => { if (s.w == null) s.w = 0; }); }
  }
  d.items = d.items.filter(it => it.sets.length);
  d.items.forEach(it => it.sets.forEach(s => { if (s.w == null) s.w = 0; }));
  d.open = false;
  const ok = await flushSave();
  if (!ok) { d.open = true; render(true); return; }
  S.draft = null; S.dirty = false; S.ui.confirm = null; backupDraft(); delete d.began;
  const moved = fx.length ? await skipProgram(d, fx) : false;
  /* (в эталоне нет) запись уже в хранилище, а список журнала догонит её сам; программа, которая с темпом атлета не влезает во время, сокращается (trim.ts) */
  let cut: string | null = null;
  if (appRules()) { S.workouts = C.sortW(S.workouts.filter(w => w.id !== d.id).concat([C.clone(d)])); cut = await trimProgram(); }
  toast('Тренировка сохранена' + (fact ? ', шла ' + factDur(fact) : '') + (moved ? '. Программа поправлена: ' + fx.map(f => C.exName(D.cfg, f.ex) + (f.kind === 'move' ? ' — в ' + C.SLOT[f.to!].n : ' — подходы другим упражнениям')).join(', ') : '') + (cut ? '. ' + cut : ''));
  go('overview');
}
export async function saveEdit() {
  const d = S.draft as Workout;
  d.items.forEach(it => it.sets.forEach(s => { if (s.w == null) s.w = 0; }));
  d.items = d.items.filter(it => it.sets.length);
  const ok = await flushSave();
  if (!ok) return;
  S.draft = null; S.dirty = false; toast('Запись обновлена'); go('journal');
}
export async function cancelWorkout() {
  const id = S.draftSaved;
  clearTimeout(saveT);
  S.draft = null; S.dirty = false; S.ui.confirm = null; S.draftSaved = null; backupDraft();
  if (id && S.db) { try { await S.db.doc(PT().w + '/' + id).delete(); } catch (e) { dbErr(e); } }
  S.workouts = S.workouts.filter(w => w.id !== id);
  go('overview');
}
