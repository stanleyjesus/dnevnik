/* Экран «Обзор» и общие части плана тренировки.
   Перенесено из reference/src/ui2.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C, h, icon } from './dom.ts';
import { S } from './state.ts';
import { backupDraft, filled, saveCfg, saveDraft, uniqueId } from './storage.ts';
import { D, go, render } from './render.ts';
import { meter, spark, zonePill } from './charts.ts';

import { importBox, pickBackup } from './importer.ts';
import { onbAgain, onbOn, vOnboard } from './onboard.ts';
import { weekDays } from './platform.ts';
import { appRules, byPct, isoLift } from '../core/rules.ts';
import type { Adapted, Cfg, Insight, Item } from '../core/index.ts';
import type { Kid } from './types.ts';

/* ---------- UI part 2: overview, workout editor, journal ---------- */
export const DOWF = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const dayTitle = (d: string) => DOWF[C.dow(d)] + ', ' + C.fmtDate(d, true);
export const SEV: Record<string, string> = { crit: 'Критично', warn: 'Внимание', info: 'Заметка', good: 'Хорошо' };
export const STATUS: Record<string, string[]> = { up: ['good', 'растёт'], flat: ['warn', 'застой'], down: ['serious', 'откат'], new: ['info', 'мало данных'], light: ['info', 'лёгкий день'] };
/* the mark of an exercise as a short label: the mode of a percentage lift, the goal of an accessory */
export const goalTag = (cfg: Cfg, id: string) => { const n = C.goalName(cfg, id); return !n ? '' : C.kindOf(cfg, id) === 'base' ? n : 'цель: ' + n; };
export function insightEl(i: Insight, withLink?: boolean) {
  return h('div', { class: 'ins ' + i.sev }, icon(i.sev === 'warn' ? 'warn' : i.sev), h('div', { class: 'grow' },
    h('div', { class: 'k' }, SEV[i.sev] + ' · ' + i.cat), h('div', { class: 't', text: i.title }), h('div', { class: 'x', text: i.text }),
    withLink && i.link ? h('a', { class: 'btn ghost sm', href: '#' + i.link, style: 'margin-left:-8px' }, 'Открыть раздел') : null));
}
/* a plan as rows. A = the diary's proposals for that day, used = keys of the ones applied to `items` */
export function planRows(items: Item[], slot: string, date: string, A: Adapted | null, used: string[] | null) {
  const rows = [], on = (k: string) => !!used && used.includes(k);
  items.forEach((it, idx) => {
    const prop = A && on(it.ex) ? A.props.find(p => p.ex === it.ex) : null;
    const add = A && idx >= A.base.items.length ? A.adds.find(a => a.exId === it.ex && on(a.key)) : null;
    const baseIt = prop ? A!.base.items[prop.idx] : null;
    let right;
    const so = !prop ? C.startOf(D.W, D.cfg, it.ex) : null;           // (в эталоне нет) вес, оценённый по похожему упражнению, помечен «оценка»
    const named = so ? so.src === 'est' ? h('span', { class: 'tag', title: 'Вес оценён по весу похожего упражнения из «Настройки» (' + C.exName(D.cfg, so.of!) + '): в журнале этого упражнения ещё нет' }, 'оценка') : h('span', { class: 'tag', title: 'Рабочий вес или разовый максимум из «Настройки»: в журнале этого упражнения ещё нет' }, 'вес из настроек') : null;
    if (add) right = h('div', { class: 'chips' }, h('span', { class: 'chip adj' }, it.sets.length + ' × ' + it.range![0] + '–' + it.range![1] + (it.sets[0] && it.sets[0].w != null ? ' по ' + C.fmt(it.sets[0].w) + ' кг' : '')));
    else if (it.cyc) {
      const w = it.sets[0] ? it.sets[0].w : null;
      right = h('div', { class: 'chips' }, h('span', { class: 'chip' + (prop ? ' adj' : '') }, it.sets.length + ' × ' + it.cyc.reps + (w != null ? ' по ' + C.fmt(w) + ' кг' : '')), h('span', { class: 'tag' }, it.cyc.pct + '%'), w != null ? named : null);
    } else if (!prop && it.sets.length && it.sets.every(s => s.w == null)) {
      right = h('div', { class: 'chips' }, h('span', { class: 'chip' }, it.sets.length + ' × ' + it.range![0] + '–' + it.range![1]), h('span', { class: 'tag' }, 'вес подбирается'));
    } else if (named && it.sets.length && it.sets.every(s => s.w === it.sets[0].w)) {
      right = h('div', { class: 'chips' }, h('span', { class: 'chip' }, it.sets.length + ' × ' + it.range![0] + '–' + it.range![1] + ' по ' + C.fmt(it.sets[0].w) + ' кг'), named);
    } else {
      const hh = C.hints(D.W, D.cfg, it.ex, slot, date);
      right = h('div', { class: 'chips' }, it.sets.map((s, i) => {
        if (prop && (!baseIt!.sets[i] || baseIt!.sets[i].w !== s.w)) return h('span', { class: 'chip adj' }, C.fmt(s.w), h('small', null, prop.sets[i].tg[0] + '+'));
        const g = hh.sets[i] || { rule: 'new', target: it.range };
        return h('span', { class: 'chip ' + (g.rule === 'up' ? 'up' : g.rule === 'down' ? 'down' : '') }, C.fmt(s.w), g.rule === 'up' ? ' ↑' : g.rule === 'down' ? ' ↓' : g.rule === 'hold' ? h('small', null, g.target[0] + '+') : null);
      }));
    }
    rows.push(h('div', { class: 'plan-row' }, h('span', { class: 'n' }, add ? add.name : C.exName(D.cfg, it.ex), !prop && goalTag(D.cfg, it.ex) ? h('span', { class: 'tag', style: 'margin-left:6px' }, goalTag(D.cfg, it.ex)) : null, prop ? h('span', { class: 'tag accent', style: 'margin-left:6px' }, prop.tag) : add ? h('span', { class: 'tag accent', style: 'margin-left:6px' }, 'новое') : null), right));
  });
  if (!rows.length) rows.push(h('div', { class: 'empty', text: 'Для этого дня ещё нет прошлой тренировки. Начни с пустого листа и добавь упражнения.' }));
  return h('div', { class: 'plan-list' }, rows);
}
export const planLegend = (withAdj: boolean) => h('div', { class: 'legend-line' }, h('span', null, h('span', { class: 'chip up' }, '40 ↑'), ' прошлый раз взят верх диапазона, вес повышен'), h('span', null, h('span', { class: 'chip' }, '40', h('small', null, '11+')), ' тот же вес, цель по повторам'), h('span', null, h('span', { class: 'chip down' }, '40 ↓'), ' было ниже диапазона'), withAdj ? h('span', null, h('span', { class: 'chip adj' }, '40', h('small', null, '11+')), ' поправка дневника') : null);
export const setWord = (n: number) => n + ' ' + C.plural(n, ['подход', 'подхода', 'подходов']);
export const planSets = (items: Item[]) => items.reduce((n, it) => n + it.sets.length * ((D.cfg.ex[it.ex] || {}).uni ? 0.5 : 1), 0);
/* the diary's proposals for one day, each with a tick box */
export function propList(A: Adapted, off: Record<string, boolean>, toggle: (key: string, off: boolean) => void) {
  const row = (key: string, name: string, tag: string, lines: string[]) => h('label', { class: 'prop' }, h('input', { type: 'checkbox', id: 'pp-' + key.replace(/[^a-z0-9_]/gi, '-'), checked: !off[key], onchange: e => toggle(key, !e.target.checked) }),
    h('div', { class: 'grow' }, h('div', null, h('b', { text: name }), h('span', { class: 'tag accent', style: 'margin-left:6px' }, tag)), lines.map(t => h('div', { class: 'sub', text: t }))));
  return h('div', { class: 'props' }, A.props.map(p => row(p.key, C.exName(D.cfg, p.ex), p.tag, p.notes)), A.adds.map(a => row(a.key, a.name, 'Добавить в программу', [setWord(a.sets) + ' по ' + a.range[0] + '–' + a.range[1] + ': ' + a.why])));
}
/* rest between sets: one of a few values, kept in the profile and used for every time estimate */
export function restSelect(id: string) {
  if (appRules()) return null;   // (в эталоне нет) с днями «День N» отдых ставит дневник по упражнению (rules.ts, restOf; просьба владельца, 25 ноября 2026)
  const opts = C.REST_OPTS.includes(D.cfg.rest) ? C.REST_OPTS : C.REST_OPTS.concat(D.cfg.rest).sort((a, b) => a - b);
  return h('label', { class: 'f' }, h('span', null, 'Отдых между подходами'), h('select', { id, onchange: async e => { const v = +e.target.value; await saveCfg(raw => { raw.rest = v; }); render(true); } }, opts.map(v => h('option', { value: v, selected: v === D.cfg.rest, text: C.fmtRest(v) + ' мин' }))));
}
export const durText = (items: Item[]) => '≈ ' + C.fmtDur(C.estMinutes(D.cfg, items));
/* time left in the workout that is going on */
export function paintEta() {
  const el = $('eta'), d = S.draft;
  if (!el || !d) return;
  const left = C.estMinutes(S.cfg, d.items, null, true);
  el.textContent = 'по плану ' + durText(d.items) + (d.open ? left > 0 ? ' · осталось ≈ ' + C.fmtDur(left) : ' · все подходы записаны' : '');
}
export function startWorkout(p: { slot: string, date: string, items: Item[] }) {
  S.draft = { id: uniqueId(p.date), date: p.date, slot: p.slot, note: '', open: true, items: C.clone(p.items) };
  S.draftSaved = null; S.dirty = true; S.ui.plan = null; S.ui.confirm = null;
  backupDraft(); saveDraft();
  if (S.view === 'workout') render(); else go('workout');
}
export function vOverview() {
  const out: Kid[] = [];
  if (S.conn !== 'ready' && !D.W.length) return out;
  if (onbOn()) return vOnboard();                                    // (в эталоне нет) пустой профиль с днями «День N» начинается с онбординга (onboard.ts)
  const done = D.W.filter(w => w.items.some(it => C.work(it).length));
  if (!done.length && !(S.draft && S.draft.open)) {
    if (!D.cfg.program) {
      const onb = appRules() && !weekDays();                           // (в эталоне нет) с днями «День N» две кнопки: «Собрать программу» открывает онбординг, и резервная копия
      out.push(h('div', { class: 'card empty' }, h('h2', null, 'В дневнике пока пусто'), h('p', { style: 'margin:8px 0 14px' }, onb ? 'Собери программу по шагам или перенеси записи из резервной копии.' : 'Собери программу во вкладке «Программа» или сразу запиши первую тренировку — после неё появятся план, графики и расчёт нагрузки.'),
        S.canWrite ? h('div', { class: 'row', style: 'justify-content:center' }, onb ? h('button', { class: 'btn primary', id: 'onb-again', onclick: onbAgain }, 'Собрать программу') : h('a', { class: 'btn primary', href: '#program' }, 'Собрать программу'), onb ? null : h('a', { class: 'btn', href: '#workout' }, 'Записать тренировку'),
          h('button', { class: 'btn', id: 'import-first', onclick: pickBackup }, 'Загрузить резервную копию')) : null,
        importBox()));
      return out;
    }
    const A = C.adapt(D.W, D.cfg, D.slot, D.date), sel = C.applyAdapt(A, A.off0), q = D.cfg.rir;
    out.push(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Первая тренировка'), h('h2', null, dayTitle(D.date))), S.canWrite ? h('a', { class: 'btn primary', href: '#workout' }, 'Открыть план') : null),
        h('p', { class: 'sub', style: 'margin-bottom:6px' }, 'По программе «' + D.cfg.program.name + '»: ' + setWord(planSets(sel.items)) + ', ' + durText(sel.items) + (appRules() ? ' с отдыхом по упражнению' : ' при отдыхе ' + C.fmtRest(D.cfg.rest)) + '. День и дату можно сменить в плане.'),
        planRows(sel.items, D.slot, D.date, A, sel.used)),
      h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('h2', null, 'С чего начать')),
        h('div', { class: 'why' }, h('b', null, 'Вес подбирается на первой тренировке'), h('div', { class: 'sub' }, 'В каждом упражнении возьми вес, с которым повторы попадают в диапазон, а в запасе остаётся ' + (q >= 2 ? q + '–' + (q + 1) : 'один-два') + ' ' + (q >= 2 ? 'повтора' : 'повтора') + '. Лучше начать легче: дневник сам поднимет вес, когда возьмёшь верх диапазона.')),
        h('div', { class: 'why' }, h('b', null, 'Записывай вес и повторы каждого подхода'), h('div', { class: 'sub' }, 'Со второй тренировки дневник подставляет веса сам и показывает цель по повторам. Графики и нагрузка по мышцам появятся после первой недели.')),
        h('div', { class: 'why' }, h('b', null, 'Программу можно править'), h('div', { class: 'sub' }, 'Состав дней, порядок и число подходов меняются во вкладке «Программа», упражнения и шаг веса — в «Настройке».')))));
    return out;
  }
  const last = D.idx[D.idx.length - 1];
  const refSets = D.wi.ref.length ? D.wi.ref.reduce((s, w) => s + D.vol[w.no].sets, 0) / D.wi.ref.length : 0;
  const zc = { none: 0, low: 0, base: 0, opt: 0, high: 0 }, tracked = C.MUSCLES.filter(m => !D.cfg.ignore[m.id]);
  for (const m of tracked) zc[C.zone(D.avg[m.id], D.cfg.zones)]++;
  const refTxt = D.wi.ref.length ? 'среднее за недели ' + D.wi.ref[0].no + '–' + D.wi.ref[D.wi.ref.length - 1].no : 'нет полных недель';
  const gaps = D.wi.weeks.filter(w => !w.count && !w.current).length;
  out.push(h('div', { class: appRules() ? 'tiles two' : 'tiles' },
    h('div', { class: 'tile' }, h('span', { class: 'l' }, 'Тренировок записано'), h('span', { class: 'v' }, done.length), h('span', { class: 'd' }, (done.length ? 'с ' + C.fmtDate(done[0].date, true) : '') + (gaps ? ' · пропущено недель: ' + gaps : ''))),
    h('div', { class: 'tile' }, h('span', { class: 'l' }, 'Индекс силы'), h('div', { class: 'tile-top' }, h('span', { class: 'v' }, last ? C.fmt(last.idx, 0) : '–'), spark(D.idx.map(x => x.idx))), h('span', { class: 'd' }, last ? C.signed(last.idx - 100) + '% к первой неделе' : '')),
    appRules() ? null : h('div', { class: 'tile' }, h('span', { class: 'l' }, 'Рабочих подходов в неделю'), h('span', { class: 'v' }, C.fmt(refSets, 0)), h('span', { class: 'd' }, refTxt)),   // (в эталоне нет) с днями «День N» сверху только две плитки (решение владельца, 25 ноября 2026)
    appRules() ? null : h('div', { class: 'tile' }, h('span', { class: 'l' }, 'Мышц в рабочей зоне'), h('span', { class: 'v' }, D.wi.ref.length ? zc.opt : '–', h('small', null, 'из ' + tracked.length)), h('span', { class: 'd' }, D.wi.ref.length ? 'без нагрузки: ' + zc.none + ' · мало: ' + (zc.low + zc.base) : 'считается после первой полной недели'))
  ));

  /* next workout + attention */
  let nextCard;
  if (S.draft && S.draft.open) {
    const total = S.draft.items.reduce((n, it) => n + it.sets.length, 0);
    nextCard = h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Тренировка идёт'), h('h2', null, dayTitle(S.draft.date))), h('a', { class: 'btn primary', href: '#workout' }, 'Продолжить')),
      h('p', { class: 'sub' }, 'Заполнено ' + filled(S.draft) + ' из ' + total + ' ' + C.plural(total, ['подхода', 'подходов', 'подходов']) + '.'));
  } else {
    const A = C.adapt(D.W, D.cfg, D.slot, D.date), sel = C.applyAdapt(A, A.off0), n = sel.used.length, more = A.props.length + A.adds.length - n;
    nextCard = h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'Следующая тренировка'), h('h2', null, dayTitle(D.date))),
      S.canWrite ? h('a', { class: 'btn primary', href: '#workout' }, 'Открыть план') : null),
      h('p', { class: 'sub', style: 'margin-bottom:6px' }, sel.items.length ? setWord(planSets(sel.items)) + ', ' + durText(sel.items) + (appRules() ? ' с отдыхом по упражнению' : ' при отдыхе ' + C.fmtRest(D.cfg.rest)) + '. ' : '', A.base.prog ? 'Первый раз по программе «' + D.cfg.program!.name + '»: веса взяты из последних тренировок каждого упражнения. ' : '', n ? (A.base.prog ? 'В план' : 'План по твоим правилам, в него') + ' уже внесены поправки дневника: ' + n + '.' + (more ? ' Ещё ' + more + ' можно включить перед стартом.' : ' Перед стартом можно снять любую.') : (A.base.prog ? '' : 'План по твоим правилам от прошлой тренировки этого дня.') + (more ? ' Дневник предлагает поправки: ' + more + ', включить их можно перед стартом.' : ' Поправок дневник не предлагает.')),
      planRows(sel.items, D.slot, D.date, A, sel.used), planLegend(n > 0));
  }
  const top = D.ins.filter(i => i.sev === 'crit' || i.sev === 'warn').slice(0, 4);
  const att = h('div', { class: 'card' }, h('div', { class: 'sec-h' }, h('h2', null, 'Требует внимания'), h('a', { class: 'btn ghost sm', href: '#coach' }, 'Все советы: ' + D.ins.length)),
    top.length ? top.map(i => insightEl(i)) : h('p', { class: 'sub' }, 'Критичных замечаний нет.'));
  out.push(appRules() ? nextCard : h('div', { class: 'grid2' }, nextCard, att));   // (в эталоне нет) с днями «День N» блока «Требует внимания» нет: вкладки «Советы» нет, поправки — в плане тренировки

  /* wave lifts (в приложении — базовые в силовой роли: сила по запасу и поддержание, решение владельца 24 ноября 2026) */
  const cyc = D.stats.filter(s => byPct(D.cfg, s.id) && s.active), app = appRules();
  if (cyc.length) {
    out.push(h('section', null, h('div', { class: 'sec-h' }, h('h2', null, 'Базовые'), h('span', { class: 'sub' }, app ? [cyc.some(s => C.goalOf(D.cfg, s.id) === 'auto' && !isoLift(D.cfg, s.id)) ? 'сила по запасу: 4 × 4, вес по запасу' : '', cyc.some(s => C.goalOf(D.cfg, s.id) === 'auto' && isoLift(D.cfg, s.id)) ? 'изоляция: 4 × 6, вес по запасу' : '', cyc.some(s => C.goalOf(D.cfg, s.id) === 'hold') ? 'поддержание: 3 × 4, вес прежний' : ''].filter(Boolean).join(' · ') : 'волна ' + Object.entries(D.cfg.cycle.pct).sort((a: any, b: any) => b[0] - a[0]).map(e => e[1] + '% × ' + e[0]).join(' → ') + ', максимум +' + C.fmt(D.cfg.cycle.inc, 1) + '% в неделю' + (cyc.some(s => C.goalOf(D.cfg, s.id) === 'auto') ? ' · сила по запасу: 4 × 4, вес по запасу' : ''))),
      h('div', { class: 'grid3' }, cyc.map(s => {
        const p = C.planCycle(D.W, D.cfg, s.id, null);
        return h('button', { class: 'ex-card', onclick: () => { S.ui.exSel = s.id; go('progress'); } },
          h('span', { class: 'nm' }, C.exName(D.cfg, s.id), goalTag(D.cfg, s.id) ? h('span', { class: 'tag accent', style: 'margin-left:6px' }, goalTag(D.cfg, s.id)) : null),
          h('div', { class: 'ln' }, h('div', null, h('div', { class: 'big' }, C.fmt(s.last.top.w) + ' × ' + s.last.top.r), h('div', { class: 'sub' }, C.fmtDate(s.last.date) + (s.last.item.cyc ? ' · ' + s.last.item.cyc.pct + '%' : ''))), spark(s.ss.map(x => x.metric))),
          h('div', { class: 'sub' }, 'Расчётный максимум ' + C.fmt(s.last.metric, 1) + ' кг · дальше ', h('b', null, C.fmt(p.w) + ' × ' + p.reps), p.repeat ? ' (повтор недели)' : ''));
      }))));
  }

  /* muscles */
  if (D.wi.ref.length) {
    const z = D.cfg.zones, rows = [];
    let g = null;
    for (const m of C.MUSCLES) {
      if (m.g !== g) { g = m.g; rows.push(h('div', { class: 'grp eyebrow' }, g)); }
      rows.push(h('span', { class: 'mn' }, m.n), meter(D.avg[m.id], z), h('span', { class: 'mv' }, C.fmt(D.avg[m.id], 1)), D.cfg.ignore[m.id] && D.avg[m.id] < z.opt ? h('span', { class: 'pill' }, 'вне расчёта') : zonePill(D.avg[m.id], z));
    }
    out.push(h('section', { class: 'card' }, h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Нагрузка по мышцам'), h('p', { class: 'sub' }, 'Подходов в неделю, ' + refTxt + '. Подсвеченный участок шкалы — рабочая зона ' + z.opt + '–' + z.high + ', риска — минимум ' + z.min + '.')), h('a', { class: 'btn ghost sm', href: '#muscles' }, 'По неделям')),
      h('div', { class: 'meters' }, rows)));
  }
  return out;
}
