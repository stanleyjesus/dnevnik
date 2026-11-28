/* «Подходы по мышцам» в мастере программы (решение владельца, 28 ноября 2026). В эталоне этого нет.
   С днями «День N» новая программа собирается в мастере (onboard.ts), а не блоком на «Программе». То, что было в блоке под днями черновика, —
   здесь, свёрнутой строкой на шаге «Программа»: сколько подходов в неделю и сейчас, что за режим, сколько подходов свободно, таблица мышц
   «Сейчас / Станет» с кнопками «−» и «+» (дневник сам выбирает упражнение), «Что изменилось и почему» и «Сбросить правки».
   Расчёт и тексты — те же, что в блоке «Новая программа» (program.ts, vProgram); тот остаётся только с таблицей дней эталона */
import { C, h, icon } from './dom.ts';
import { toast } from './toast.ts';
import { D, render } from './render.ts';
import { zonePill } from './charts.ts';
import { dayLoad, loadText } from './program.ts';
import { paceText } from './pace.ts';
import { mixText, soloText } from './goal.ts';
import { weekDays } from './platform.ts';
import { isoLift } from '../core/rules.ts';
import { DAY_H } from '../core/strength.ts';
import type { Muscle } from '../core/index.ts';
import type { ProgTally, VolRow } from './types.ts';
import type { progDraft } from './draft.ts';

/** Сколько подходов в неделю у черновика и у того, что действует сейчас, и сколько длится тренировка — строка под заголовком блока */
export function draftLine(d: ReturnType<typeof progDraft>, empty: boolean) {
  const pr = d.pr, total = (t: ProgTally) => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
  const avgMin = C.SLOTS.filter(sl => pr.slots[sl.id].length).map(sl => C.estMinutes(pr.cfg, pr.slots[sl.id], D.cfg.rest));
  return loadText(total(pr.after)) + ' в неделю' + (empty && !pr.away ? '' : ' · сейчас ' + dayLoad(total(pr.before) + (pr.away || 0))) + (avgMin.length ? ' · тренировка ≈ ' + C.fmtDur(avgMin.reduce((a, b) => a + b, 0) / avgMin.length) : '');
}

/** Свёрнутая строка «Подходы по мышцам»: d — черновик (draft.ts), empty — в днях действующей программы пусто */
export function musBox(d: ReturnType<typeof progDraft>, empty: boolean) {
  const cfg = D.cfg, { st, pr, manual, lift, prio, strong, solo, triad, recount } = d;
  /* запас недели: лимит этой сборки (в правке вручную — лимит профиля) */
  const cap = manual ? cfg.caps.week : st.budget;
  const total = (t: ProgTally) => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
  const freeText = (f: number) => f > 0.01 ? 'свободно ' + C.fmt(f, 1) : f < -0.01 ? 'на ' + C.fmt(-f, 1) + ' больше лимита' : 'свободных подходов нет';
  /* одно нажатие у мышцы: дневник сам находит подход или упражнение, которое прибавить или убрать */
  const nudge = (m: Muscle, dir: number) => {
    const r = C.nudgeMuscle(pr.cfg, pr.slots, m.id, dir, { z: cfg.zones, ignore: cfg.ignore, budget: cap, dayCap: cfg.caps.day }, (id, def) => { pr.create[id] = def; pr.cfg.ex[id] = C.placed(pr.cfg, Object.assign({ n: id }, def)); });
    toast(r.ok ? m.n + ' — ' + r.text.charAt(0).toLowerCase() + r.text.slice(1) + ' · ' + freeText(+(cap - total(C.progTally(pr.cfg, pr.slots))).toFixed(1)) : r.text);
    if (!r.ok) return;
    (pr.hand = pr.hand || []).push({ m: m.n, t: r.text });
    recount();
  };
  const used = total(pr.after), free = +(cap - used).toFixed(1), hand = pr.hand && pr.hand.length ? pr.hand : null;
  const z = cfg.zones, fm = pr.focus ? (pr.cfg.ex[pr.focus].m || {}) : pr.prio ? Object.fromEntries(C.PRIOS.find(g => g.id === pr.prio)!.m.map(m => [m, 1])) : {};
  const vols = C.MUSCLES.map(m => ({ m, a: pr.before.pv[m.id] || 0, b: pr.after.pv[m.id] || 0, s: (pr.after.ps || {})[m.id] || 0, sa: (pr.before.ps || {})[m.id] || 0 }));
  const splitOf = (r: VolRow) => C.splitText(r.b, r.s), splitNow = (r: VolRow) => C.splitText(r.a, r.sa);
  const thin = !weekDays() && pr.notes.some(n => n.t.startsWith('Один день в неделю')), twice = thin ? 'Второй день достался не всем мышцам: каким — ниже, в «Что изменилось и почему».' : 'Каждая мышца работает минимум в два дня недели.';
  const note = manual ? 'Собери или поправь программу сам: добавляй упражнения в дни, меняй порядок и число подходов. Упражнений, которых нет в списке, сначала заведи в «Настройке». Записи в журнале не меняются.'
    : triad && pr.strength ? 'Сила в тройке: ' + C.list((pr.triad || []).map(id => C.exName(pr.cfg, id).toLowerCase())) + '. Каждое движение идёт два дня в неделю: ' + DAY_H.sets + ' × ' + DAY_H.reps + ' с весом по запасу и лёгкий день. Остальные базовые — обычные упражнения, подсобка — чуть ниже рабочей зоны. ' + twice
    : strong && pr.strength ? 'Сила во всех базовых. Каждое идёт два дня в неделю: 4 × 4 с весом по запасу и лёгкий день. Подсобка — чуть ниже рабочей зоны: место в неделе отдано базовым. ' + twice
    : solo && pr.strength ? 'Сила в одном движении. ' + soloText(C.SLOTS.length, isoLift(pr.cfg, solo)) + ' Его мышцам — в полтора раза больше подходов, чем остальным; остальные базовые — обычные упражнения, подсобка — чуть ниже рабочей зоны. ' + twice
    : lift ? 'Масса и сила с акцентом на одном базовом. ' + mixText(C.SLOTS.length, isoLift(pr.cfg, lift)) + ' Остальные мышцы делят объём поровну' + (thin ? '. ' + twice : ', каждая работает минимум в два дня недели.')
    : prio ? 'Приоритетные мышцы получают примерно в полтора раза больше остальных, остальные делят объём поровну. ' + twice + ' Лимиты недели и дня не нарушаются.'
    : 'Все мышцы в цели получают поровну, разброс — около двух подходов. ' + twice + ' Лимиты недели и дня не нарушаются.';
  return h('details', { class: 'whybox', id: 'prog-mus', open: !!st.musOpen, ontoggle: e => { st.musOpen = e.target.open; } },
    h('summary', null, 'Подходы по мышцам', h('span', { class: 'sub', id: 'pn-sets', style: 'display:block;margin-top:2px' }, draftLine(d, empty))),
    h('div', { class: 'stack', style: 'gap:12px;margin-top:10px' },
      h('div', null, h('b', { id: 'pn-name' }, pr.name), h('p', { class: 'note', id: 'pn-note' }, note)),
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
            h('td', null, r.m.n, fm[r.m.id] ? h('span', { class: 'tag', style: 'margin-left:6px' }, fm[r.m.id] >= 1 ? 'приоритет' : 'помогает') : null, splitOf(r) ? h('span', { class: 'msplit under', id: 'msn-' + r.m.id, text: splitOf(r) }) : null),
            h('td', { class: 'c-now' }, C.fmt(r.a, 1), splitNow(r) ? h('span', { class: 'msplit', id: 'msa-' + r.m.id, text: '(' + splitNow(r) + ')' }) : null),
            h('td', null, ch ? [h('span', { class: 'tag accent', style: 'margin-right:6px' }, C.signed(r.b - r.a, 1)), h('b', null, C.fmt(r.b, 1))] : C.fmt(r.b, 1), splitOf(r) ? h('span', { class: 'msplit', id: 'ms-' + r.m.id, text: '(' + splitOf(r) + ')' }) : null),
            h('td', { class: 'c-zone', style: 'text-align:left' }, off ? h('span', { class: 'pill', title: 'Вне расчёта: дневник сам подходы не выделяет, прибавь кнопкой «+»' }, icon('minus'), 'вне расчёта') : zonePill(r.b, z)),
            h('td', { class: 'mctl' }, h('div', { class: 'pctl' },
              h('button', { class: 'icon-btn', id: 'mn-' + r.m.id, title: 'Убавить подход', 'aria-label': 'Убавить подход: ' + r.m.n, disabled: r.b <= 0, onclick: () => nudge(r.m, -1) }, icon('minus')),
              h('button', { class: 'icon-btn', id: 'mp-' + r.m.id, title: 'Прибавить подход', 'aria-label': 'Прибавить подход: ' + r.m.n, onclick: () => nudge(r.m, 1) }, icon('plus')))));
        })))),
      vols.some(r => r.s >= 0.05 || r.sa >= 0.05) ? h('p', { class: 'sub', id: 'ms-note' }, 'Число — все подходы на мышцу, в скобках — сколько из них силовые (базовые по процентам). Подход с запасом от 3 повторов идёт в объём за половину.') : null,
      h('p', { class: 'note' }, '«−» освобождает подход, «+» отдаёт его мышце: дневник сам выбирает упражнение.'),
      h('p', { class: 'sub', id: 'pn-time' }, 'Время — разминка, подходы и отдых по упражнению: 5 мин в тяжёлом дне, 3 мин в лёгком, 2 мин 30 с в многосуставных со штангой, 2 мин в остальных.' + paceText()),
      pr.notes.length || hand ? h('details', { class: 'whybox', id: 'prog-why', open: !!st.whyOpen, ontoggle: e => { st.whyOpen = e.target.open; } },
        h('summary', null, 'Что изменилось и почему'),
        hand ? h('div', { class: 'why hand', id: 'prog-hand' }, h('b', null, 'Поправлено вручную'), h('div', { class: 'sub' }, hand.map(x => h('div', { text: x.m + ': ' + x.t.charAt(0).toLowerCase() + x.t.slice(1) })))) : null,
        pr.notes.map(n => h('div', { class: 'why' }, h('b', { text: n.t }), h('div', { class: 'sub', text: n.x })))) : null));
}
