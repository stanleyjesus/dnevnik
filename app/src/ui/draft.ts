/* Черновик новой программы: выбор сценария, лимит недели по времени, сборка и правки вручную.
   Этот код стоял в vProgram (program.ts) и перенесён сюда без изменений: тот же черновик собирает онбординг (onboard.ts),
   и у вкладки «Программа» и у онбординга он один — S.ui.prog. В эталоне этого файла нет: в артефакте код живёт внутри vProgram. */
import { $, C } from './dom.ts';
import { S } from './state.ts';
import { toast } from './toast.ts';
import { D, render } from './render.ts';
import { progSig } from './program.ts';
import { lostMode, modeAfter, modeBudget, modeKey, othersOf, setMode } from './goal.ts';
import { fitBudget, timeOf } from './fit.ts';
import { appRules, PACE, targetIds } from '../core/rules.ts';
import { balanceText, rebalance, shiftText } from '../core/balance.ts';
import type { Cfg, ProgSlots } from '../core/index.ts';
import type { ProgEdit } from './types.ts';

/** Базовые, вокруг которых строятся «Сила» и «Гибрид»: с таблицей дней эталона — упражнения по волне из справочника,
    с днями «День N» — список целей (решение владельца, 24 ноября 2026, пункт 8) */
export function progLifts(cfg: Cfg) {
  const lifts = Object.keys(cfg.ex).filter(id => C.isCycle(cfg, id));   // пауэрбилдинг предлагается для любого базового справочника: если его нет в программе, сборка поставит его сама
  /* (в эталоне нет) с днями «День N» цель «Силы» и «Гибрида» — из своего списка (решение владельца, 24 ноября 2026, пункт 8): базовым её делает роль, а не справочник */
  if (appRules()) lifts.splice(0, lifts.length, ...targetIds(cfg));
  return lifts;
}

/** Режим сборки, с которого начинается черновик: тот, по которому собрана действующая программа; без программы — «Вручную», если дни пусты, иначе «Равномерно».
    Тот же начальный режим берёт мастер новой программы (onboard.ts) */
export function progFocus(P: Cfg['program'], lifts: string[], empty: boolean) {
  return P && P.strength && P.triad && P.triad.length && appRules() ? 'p' : P && P.strength && P.focus && lifts.includes(P.focus) ? 's:' + P.focus : P && P.strength && lifts.length ? 's' : P && P.focus && lifts.includes(P.focus) ? 'l:' + P.focus : P && P.prio && C.PRIOS.some(g => g.id === P.prio) ? 'm:' + P.prio : empty ? 'manual' : 'even';
}

/** Черновик новой программы для того, что действует сейчас (cur; empty — в днях пусто), и обработчики правок в днях.
    awaySig — что стоит в днях вне недели: от него зависит, пересобирать ли черновик */
export function progDraft(cfg: Cfg, cur: ProgSlots, empty: boolean, lifts: string[], awaySig: string) {
  const P = cfg.program;
  const ui = S.ui;
  const budgets = [40, 50, 60, 70, 80, 90, 100, 110, 120].filter(v => v < cfg.caps.week).concat(cfg.caps.week);
  if (!ui.prog) ui.prog = { focus: progFocus(P, lifts, empty),
    others: othersOf(P), budget: P && +P.budget! > 0 && +P.budget! <= cfg.caps.week ? +P.budget! : cfg.caps.week, draft: null, key: '' };
  if (lostMode(ui.prog.focus, lifts)) setMode(ui.prog, modeAfter(ui.prog.focus, lifts), cfg.caps.week);   // выбранного базового больше нет в справочнике: в эталоне экран оставался в режиме, которого уже не собрать
  const st = ui.prog, manual = st.focus === 'manual', lift = st.focus.startsWith('l:') ? st.focus.slice(2) : null, prio = st.focus.startsWith('m:') ? st.focus.slice(2) : '';
  const strong = st.focus === 's';                                    // силовой режим: в эталоне его нет (решение владельца, 19 ноября 2026)
  const solo = st.focus.startsWith('s:') ? st.focus.slice(2) : null;  // сила в одном базовом: в эталоне нет (решение владельца, 19 ноября 2026)
  const triad = st.focus === 'p';                                      // «Сила: пауэрлифтерская тройка»: в эталоне нет (решение владельца, 24 ноября 2026)
  if (!budgets.includes(st.budget)) st.budget = cfg.caps.week;
  /* время на тренировку (в эталоне нет: решение владельца, 19 ноября 2026): лимит недели — самый большой из списка, при котором самая длинная
     тренировка укладывается в названное время. Сборки-примерки считаются по одной на лимит и помнятся, пока не изменилось то, от чего они зависят,
     в том числе темп атлета (core/pace.ts): с ним оценка времени другая */
  const time = manual ? 0 : timeOf(S.cfgRaw);
  /* (в эталоне нет) от времени зависит и число упражнений в дне (решение владельца, 23 ноября 2026): сборка получает его вместе с лимитом */
  const build = (budget: number) => C.buildProgram(D.W, cfg, { manual, focus: lift || solo, others: st.others, prio, budget, strength: strong || !!solo || triad, triad, time, drop: st.drop });
  let fit = null as ReturnType<typeof fitBudget> | null;
  if (time) {
    const fkey = st.focus + '|' + st.others + '|' + progSig(cur) + '|' + PACE.k + '|' + lifts.map(id => C.goalOf(cfg, id) || '').join(',') + '|' + (P ? P.since : '') + '|' + JSON.stringify(cfg.ex) + '|' + cfg.caps.day + '/' + cfg.caps.week + '|' + Object.keys(cfg.ignore).sort().join(',') + '|' + cfg.rest + '|' + time + '|' + C.SLOTS.length + '|' + awaySig + (st.drop ? '|' + st.drop.join(',') : '');
    if (!st.fit || st.fit.key !== fkey) st.fit = { key: fkey, max: {} };
    const max = st.fit.max, longest = (b: number) => { if (max[b] == null) { const t = build(b); st.fit!.made = { b, t }; max[b] = Math.max(...C.SLOTS.map(sl => C.estMinutes(t.cfg, t.slots[sl.id], cfg.rest))); } return max[b]; };
    const F = P && P.fit, held = F && F.time === time && F.rest === cfg.rest && F.mode === modeKey(st) && F.days === C.SLOTS.length ? budgets.filter(b => b <= +P.budget!) : [];
    fit = fitBudget(held.length ? held : budgets, longest, time);
    st.budget = fit.budget;
  }
  /* (в эталоне нет) с днями «День N» списка «Подходов в неделю» нет (просьба владельца, 25 ноября 2026): без выбранного времени лимит — потолок методики,
     лимит профиля (100), а под «Силой» — 80, как с первого дня силового режима; с выбранным временем — по времени, как выше */
  else if (appRules()) st.budget = modeBudget(st.focus, cfg.caps.week);
  const key = st.focus + '|' + st.others + '|' + st.budget + '|' + progSig(cur) + '|' + PACE.k + '|' + lifts.map(id => C.goalOf(cfg, id) || '').join(',') + '|' + (P ? P.since : '') + '|' + Object.keys(cfg.ex).length + '|' + cfg.caps.day + '/' + cfg.caps.week + '|' + Object.keys(cfg.ignore).sort().join(',') + '|' + C.SLOTS.length + '|' + awaySig + (time ? '|' + time + '/' + cfg.rest : '') + (st.drop ? '|' + st.drop.join(',') : '');
  /* (в эталоне нет) черновик — та же сборка, что примерка по времени в этом показе, если лимит тот же: сборка с выбранным временем дольше (время заполняется подходами), и дважды её не считаем */
  const made = st.fit && st.fit.made; if (st.fit) delete st.fit.made;
  if (!st.draft || st.key !== key) { st.draft = made && made.b === st.budget ? made.t : build(st.budget); st.key = key; st.edited = false; st.name = null; st.swapAt = null; }
  const pr = st.draft, changed = !pr.same || progSig(pr.slots) !== progSig(pr.cur);
  const keepBalance = appRules() && !manual;                          // (в эталоне нет) замена у программы, которую собрал дневник, не меняет баланс мышц (balance.ts)
  const recount = () => { pr.after = C.progTally(pr.cfg, pr.slots); st.edited = true; render(true); };
  const edit: ProgEdit = {
    manual,
    sets: (slot, i, k) => { const e = pr.slots[slot][i]; e.n = Math.max(1, Math.min(6, e.n! + k)); e.chg = (e.chg || 0) + k; recount(); },
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
      const was = keepBalance ? C.progTally(pr.cfg, pr.slots).pv : null;   // (в эталоне нет) объём мышц до замены: его дневник вернёт (balance.ts)
      e.ex = x.id; if (x.id === first) delete e.was; else e.was = first;
      st.swapAt = null;
      (pr.hand = pr.hand || []).push({ m: C.SLOT[slot].s, t: 'замена: ' + C.exName(pr.cfg, old) + ' → ' + C.exName(pr.cfg, x.id) });
      /* (в эталоне нет) замена не меняет баланс мышц (пункт 1 вопросов владельца, 28 ноября 2026): дневник возвращает мышцам объём до замены
         ходами кнопок «−» и «+» у мышцы; что вернуть не вышло — в сообщении и под заменой */
      let tail = '';
      if (was) {
        for (const sl of C.SLOTS) for (const x2 of pr.slots[sl.id]) delete x2.lack;
        const b = rebalance(pr.cfg, pr.slots, was, { slot, ex: x.id }, { z: cfg.zones, ignore: cfg.ignore, budget: st.budget, dayCap: cfg.caps.day, time, rest: D.cfg.rest }, (id, def) => { pr.create[id] = def; pr.cfg.ex[id] = C.placed(pr.cfg, Object.assign({ n: id }, def)); });
        for (const mv of b.moves) pr.hand.push(mv);
        tail = balanceText(b);
        const me = pr.slots[slot].find(y => y.ex === x.id);
        if (me && b.lack.length) me.lack = shiftText(b.lack.map(l => [l.m, l.d] as [string, number])) + ' — ' + b.lack[0].why;
      }
      toast(C.SLOT[slot].s + ': ' + C.exName(pr.cfg, old) + ' → ' + C.exName(pr.cfg, x.id) + tail);
      recount();
    }
  };
  /* силовой режим предлагается со своим лимитом недели: он меньше обычного, потому что подсобке в нём отведено меньше (setMode) */
  const pick = (f: string, o?: 'hold' | 'grow' | 'plain') => { setMode(st, f, cfg.caps.week); if (o) st.others = o; st.draft = null; render(true); };
  return { st, pr, edit, fit, time, budgets, manual, lift, prio, strong, solo, triad, changed, recount, pick };
}
