/* Состояние страницы и всё, что из него выводится для экранов.
   Перенесено из reference/src/ui1.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { C } from './dom.ts';
import type { AppState, ProgSet } from './types.ts';

/* ---------- state ---------- */
export const S: AppState = {
  profile: 'me', profiles: [{ id: 'me', n: 'Мой дневник' }], gen: 0, unsubs: [],
  db: null, conn: 'connecting', slow: false, canWrite: true, sample: null, downloads: null,
  workouts: [], cfgRaw: null, cfg: C.mergeCfg(null), body: [], coach: null,
  view: 'overview', draft: null, draftSaved: null, saving: false, dirty: false,
  ui: { exSel: null, exAll: false, metric: 'w', cell: null, plan: null, confirm: null, exForm: null, hist: false, q: '', coachBusy: false, coachText: null, coachErr: null, prog: null, bodyBy: null, bodySel: null }
};
export const VIEWS = [['overview', 'Обзор'], ['workout', 'Тренировка'], ['journal', 'Журнал'], ['progress', 'Прогресс'], ['muscles', 'Мышцы'], ['coach', 'Советы'], ['program', 'Программа'], ['setup', 'Настройка']];
/* every profile keeps its own records; the first one stays where the diary always kept them */
export const paths = (pid: string) => pid === 'me' ? { w: 'workouts', cfg: 'config/main', body: 'body', coach: 'notes/coach', draft: 'td-draft' }
  : { w: 'workouts_' + pid, cfg: 'config/' + pid, body: 'body_' + pid, coach: 'notes/coach_' + pid, draft: 'td-draft-' + pid };
export const PT = () => paths(S.profile);
export const profName = () => (S.profiles.find(p => p.id === S.profile) || { n: '' }).n;
export function derive() {
  const today = C.todayStr();
  C.setTarget(S.cfg.rir);
  const cfg = S.cfg.start ? S.cfg : Object.assign({}, S.cfg, { start: C.mondayOf(S.workouts.length ? S.workouts[0].date : today) });
  const W = S.workouts;
  const st = { workouts: W, cfg, body: S.body, today };
  const wi = C.weeksInfo(W, cfg, today), vol = C.volume(W, cfg), av = C.avgVolume(vol, wi.ref);
  const stats = C.allStats(W, cfg);
  const slot = C.nextSlot(W, today);
  return {
    today, cfg, W, st, wi, vol, avg: av.avg, avgS: av.avgS, pat: av.pat, stats, statBy: Object.fromEntries(stats.map(s => [s.id, s])),
    ins: C.insights(st), idx: C.strengthIndex(W, cfg), prog: C.program(W, cfg) as ProgSet, slot, date: C.nextDate(slot, today, W),
    openW: W.find(w => w.open) || null
  };
}
