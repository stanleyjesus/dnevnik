/* Экран «Журнал».
   Перенесено из reference/src/ui2.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { C, h, pill } from './dom.ts';
import { weekDays } from './platform.ts';
import { PT, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { backupDraft } from './storage.ts';
import { D, go, render } from './render.ts';
import { setChip } from './charts.ts';
import { dayTitle } from './overview.ts';
import { appRules } from '../core/rules.ts';
import { journalRow } from './marks.ts';
import type { Workout } from '../core/index.ts';

/* ---------- journal ---------- */
export function vJournal() {
  if (!D.WA.length) return S.conn === 'ready' ? [h('div', { class: 'card empty' }, 'Записей пока нет.')] : [];   // (в эталоне нет) в журнале и тренировки прежнего дневника (state.ts, derive)
  const out = [], prs: Set<string> = new Set();
  for (const s of D.stats) { let mx = -1; s.ss.forEach((x, i) => { if (i && x.metric > mx * 1.0005) prs.add(x.wid + '|' + s.id); mx = Math.max(mx, x.metric); }); }
  const byWeek: Record<number, Workout[]> = {};
  for (const w of D.WA) { const k = C.weekNo(w.date, D.cfg.start!); (byWeek[k] || (byWeek[k] = [])).push(w); }
  const nos = Array.from(new Set(D.wi.weeks.map(w => w.no).concat(Object.keys(byWeek).map(Number)))).sort((a, b) => b - a);
  for (const no of nos) {
    const ws = byWeek[no] || [], [a, b] = C.weekRange(no, D.cfg.start!), v = D.vol[no];
    const det = h('details', { class: 'week' });
    if (no >= D.wi.cur - 2) det.setAttribute('open', '');
    det.appendChild(h('summary', null, h('h2', null, 'Неделя ' + no), h('span', { class: 'sub' }, C.fmtDate(a) + ' – ' + C.fmtDate(b) + ' · ' + (ws.length ? ws.length + ' ' + C.plural(ws.length, ['тренировка', 'тренировки', 'тренировок']) + ' · ' + C.fmt(v ? v.sets : 0, 1) + ' ' + 'рабочих подходов' : 'тренировок нет'))));
    const box = h('div', { class: 'stack', style: 'gap:10px;padding-bottom:14px' });
    for (const w of ws) box.appendChild(workoutCard(w, prs));
    det.appendChild(box);
    out.push(det);
  }
  return out;
}
export function workoutCard(w: Workout, prs: Set<string>) {
  const del = S.ui.confirm === 'del:' + w.id;
  const card = h('div', { class: w.old ? 'wo old' : 'wo' }, h('div', { class: 'wo-h' },   // (в эталоне нет) тренировка прежнего дневника — другим фоном и с пометкой (просьба владельца, 28 ноября 2026)
    h('div', { class: 'row' }, h('b', { text: dayTitle(w.date) }), !w.old && w.slot && C.SLOT[w.slot] && (!weekDays() || C.SLOT[w.slot].dow !== C.dow(w.date)) ? h('span', { class: 'tag' }, (weekDays() ? 'день: ' : '') + C.SLOT[w.slot].n.toLowerCase()) : null, w.open ? h('span', { class: 'tag accent' }, 'идёт') : null, w.old ? h('span', { class: 'tag old' }, 'прежний дневник') : null),
    S.canWrite ? (del ? h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Удалить запись?'), h('button', { class: 'btn sm danger', onclick: () => deleteWorkout(w.id) }, 'Удалить'), h('button', { class: 'btn sm', onclick: () => { S.ui.confirm = null; render(true); } }, 'Нет'))
      : h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: () => editWorkout(w) }, w.open ? 'Продолжить' : 'Изменить'), h('button', { class: 'btn ghost sm danger', onclick: () => { S.ui.confirm = 'del:' + w.id; render(true); } }, 'Удалить'))) : null));
  for (const it of w.items) {
    let chips;
    const same = it.cyc && it.sets.length && it.sets.every(s => s.w === it.sets[0].w && s.r === it.sets[0].r && s.r != null && s.q == null);
    if (it.skip) chips = [h('span', { class: 'tag' }, 'не делал')];
    else if (same) chips = [h('span', { class: 'chip' }, it.sets.length + ' × ' + it.sets[0].r + ' по ' + C.fmt(it.sets[0].w)), h('span', { class: 'tag' }, it.cyc!.pct + '%')];
    else chips = it.sets.map(s => setChip(s)).concat(it.cyc ? [h('span', { class: 'tag' }, it.cyc.pct + '%')] : []);
    if (appRules()) { card.appendChild(journalRow(w, it, chips)); continue; }   // (в эталоне нет) с днями «День N» отметка рядом с названием, подходы — под нажатием (marks.ts)
    if (!it.cyc && prs.has(w.id + '|' + it.ex)) chips.push(pill('good', 'рекорд'));
    card.appendChild(h('div', { class: 'wo-row' }, h('span', { class: 'n' }, C.exName(D.cfg, it.ex), it.note ? h('span', { class: 'muted' }, ' · ' + it.note) : null), h('div', { class: 'chips' }, chips)));
  }
  if (w.note) card.appendChild(h('p', { class: 'note', style: 'margin-top:8px', text: w.note }));
  return card;
}
export function editWorkout(w: Workout) {
  if (S.draft && S.draft.id !== w.id) { toast(S.draft.open ? 'Сначала заверши текущую тренировку' : 'Сначала сохрани или отмени открытую правку'); return; }
  if (!S.draft) { S.draft = C.clone(w); S.draftSaved = w.id; S.dirty = false; }
  S.ui.confirm = null;
  go('workout');
}
export async function deleteWorkout(id: string) {
  S.ui.confirm = null;
  if (S.draft && S.draft.id === id) { S.draft = null; backupDraft(); }
  try { await S.db!.doc(PT().w + '/' + id).delete(); S.workouts = S.workouts.filter(w => w.id !== id); toast('Запись удалена'); } catch (e) { dbErr(e); }
  render(true);
}
