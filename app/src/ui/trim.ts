/* Программа короче, когда тренировки систематически не влезают во время (просьба владельца, 25 ноября 2026; docs/03, раздел 20). В эталоне этого нет.
   Программа собрана под выбранное «Время на тренировку», темп атлета известен по нескольким тренировкам с названным временем (core/pace.ts),
   и с этим темпом самая длинная тренировка недели в это время не влезает. Тогда после тренировки дневник сам собирает программу той же цели
   под то же время — тем же черновиком, что на «Программе» (draft.ts), уже с темпом — и принимает её, как кнопка «Принять». Объём уходит ровно
   настолько, чтобы дни влезли. Сам дневник программу только сокращает, обратно не удлиняет; «Вернуть прежнюю» отменяет сокращение, и после этого
   дневник ту программу сам больше не сокращает. Программы «Вручную» и без выбранного времени не трогаются: сколько у атлета времени, дневник не знает.
   Правила — тренерские [Т]. */
import { C, h } from './dom.ts';
import { S } from './state.ts';
import { saveCfg } from './storage.ts';
import { D, render } from './render.ts';
import { progDraft, progLifts } from './draft.ts';
import { acceptProgram } from './program.ts';
import { shown, timeOf } from './fit.ts';
import { appRules } from '../core/rules.ts';
import type { Cfg, ProgSlots } from '../core/index.ts';

/** Сколько тренировок с названным временем нужно, чтобы считать «систематически»: темп — медиана, одна долгая тренировка его не сдвигает */
export const TRIM = { n: 3 };
const setsOf = (cfg: Cfg, slots: ProgSlots) => { const T = C.progTally(cfg, slots); return Math.round(C.SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0)); };
const longestOf = (cfg: Cfg, slots: ProgSlots) => Math.max(0, ...C.SLOTS.map(sl => C.estMinutes(cfg, slots[sl.id] || [])));

/** Пора ли сокращать: что сейчас — самая длинная тренировка недели с темпом и выбранное время; null — не пора */
export function trimNeed() {
  if (!appRules()) return null;
  const P = D.cfg.program, time = timeOf(S.cfgRaw);
  if (!P || !P.fit || P.trimOff || !time || P.fit.time !== time || P.fit.days !== C.SLOTS.length) return null;
  if (D.pace.n < TRIM.n || D.pace.k <= 1) return null;
  const longest = longestOf(D.cfg, C.currentSlots(D.W, D.cfg));
  return shown(longest) > time ? { time, longest } : null;
}
/** Сократить программу, если пора: сообщение для атлета или null. Журнал в S.workouts — уже с только что законченной тренировкой */
export async function trimProgram() {
  render(true);                                                      // D — по журналу с этой тренировкой и с новым темпом
  const need = trimNeed();
  if (!need) return null;
  const cfg = D.cfg, P = cfg.program!, cur = C.currentSlots(D.W, cfg), was = setsOf(cfg, cur), k = D.pace.k, keep = S.ui.prog;
  S.ui.prog = null;                                                  // черновик — с целью и временем принятой программы, а не с тем, что открыто на «Программе»
  const { pr } = progDraft(cfg, cur, false, progLifts(cfg), '');
  const now = setsOf(pr.cfg, pr.slots);
  if (now >= was || longestOf(pr.cfg, pr.slots) >= need.longest) { S.ui.prog = keep; return null; }
  const before = S.cfgRaw && S.cfgRaw.program;
  await acceptProgram(pr, P.name || null);
  if (!S.cfgRaw || !S.cfgRaw.program || S.cfgRaw.program === before) return null;
  await saveCfg(raw => { if (raw.program) raw.program.trim = { from: was, to: now, k, time: need.time }; });
  render(true);
  return 'Программа сокращена под ' + C.fmtDur(need.time) + ': тренировки идут ×' + C.fmt(k, 2) + ' к расчёту, подходов в неделю ' + was + ' → ' + now;
}
/** Строка над планом, пока по сокращённой программе прошли не все дни */
export function trimLine() {
  const P = D.cfg.program, t = P && P.trim;
  if (!appRules() || !P || !t) return null;
  const done = D.W.filter(w => !w.open && w.date >= P.since);
  if (C.SLOTS.every(sl => done.some(w => w.slot === sl.id))) return null;
  return h('p', { class: 'note', id: 'trim-note', style: 'margin-bottom:12px' }, 'Дневник сократил программу под ' + C.fmtDur(t.time) + ': тренировки шли ×' + C.fmt(t.k, 2) + ' к расчёту и не влезали. Подходов в неделю было ' + t.from + ', стало ' + t.to + '. Вернуть прежнюю — на «Программе».');
}
