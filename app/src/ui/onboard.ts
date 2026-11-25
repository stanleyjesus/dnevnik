/* Онбординг: первый вход в пустой профиль (решение владельца, 25 ноября 2026). В эталоне этого нет.
   Пока в профиле нет ни тренировок, ни программы, «Обзор» — не карточка «В дневнике пока пусто», а мастер на весь экран, без вкладок:
     1. Старт — собрать программу, разложить свою по дням, вставить её текстом или перенести записи из файла копии;
        текст дневник делит на дни и упражнения (core/paste.ts), названия сверяет со справочником, незнакомые атлет выбирает сам;
     2. Цель — масса, сила или гибрид с тем же уточняющим списком, что на «Программе», дни в неделю, время на тренировку (отдых между подходами дневник ставит упражнению сам);
     3. Программа — дни собранного черновика (тот же черновик и те же правки, что на «Программе», draft.ts); «Принять» принимает её;
     4. Веса — шаг веса снарядов этой программы (атлет вводит его сам) и известные веса её упражнений; пустые дневник оценивает
        по похожим упражнениям со штангой и гантелями (core/rules.ts, kinMax), остальные подбираются на первой тренировке;
     5. Готово — программа с весами старта и переход к первой тренировке.
   Расчёт тот же, что на вкладках: мастер только ведёт по шагам. Он идёт только с днями «День N» — с таблицей дней эталона
   (общие сценарии сверки с артефактом) пустой «Обзор» прежний. «Пропустить» возвращает прежний пустой «Обзор» до перезагрузки. */
import { $, C, h, toNum } from './dom.ts';
import { S } from './state.ts';
import { toast } from './toast.ts';
import { saveCfg } from './storage.ts';
import { D, go, render } from './render.ts';
import { acceptProgram, loadText, progDay, progScheme } from './program.ts';
import { progDraft, progLifts } from './draft.ts';
import { goalOf, goalPicker, modeBudget } from './goal.ts';
import { TIMES, timeOf } from './fit.ts';
import { weekDays } from './platform.ts';
import { importBox, pickBackup } from './importer.ts';
import { DAY_COUNTS, useDays } from '../core/days.ts';
import { appRules } from '../core/rules.ts';
import { pasteDays, pasteMatch } from '../core/paste.ts';
import type { PasteDay } from '../core/paste.ts';
import type { Cfg, ExDef, ProgEntry, Slot, Swap } from '../core/types.ts';
import type { El, Kid, ProgEdit, View } from './types.ts';

type Step = 'start' | 'goal' | 'paste' | 'prog' | 'weights' | 'done';
/** Программа из текста: text — как вставлен, days — разбор, pick — что взять в строке «день-строка» (id, '' — не брать, NEW — новое упражнение),
    gear — снаряд нового упражнения, fill — разбор ещё не разложен в черновик */
interface Paste { text: string; days: PasteDay[] | null; pick: Record<string, string>; gear: Record<string, string>; fill: boolean }
/** Мастер открытого профиля: gen — поколение профиля (storage.ts, openProfile), path — собрать, своя или текстом, focus — режим сборки,
    steps — снаряды, шаг которых атлет ввёл в мастере, took — программа принята в мастере */
interface Onb { gen: number; step: Step; path: 'build' | 'own' | 'paste'; focus: string; steps: Record<string, boolean>; took: boolean; done: boolean; paste: Paste }
const NEW = '+new';
let O: Onb | null = null;
/* профили, где мастер пропустили: до перезагрузки страницы там прежний пустой «Обзор» */
const skipped = new Set<string>();

/* профиль пуст: ни одной тренировки с рабочими подходами, нет идущей тренировки и принятой программы — как у пустого «Обзора» */
const fresh = () => !skipped.has(S.profile) && !S.cfg.program && !(S.draft && S.draft.open) && !S.workouts.some(w => w.items.some(it => C.work(it).length));

/** Мастер на экране: идёт или должен начаться. Пока программа в нём не принята, он заканчивается сам, как только профиль перестал быть пустым (загружена копия) */
export function onbOn(): boolean {
  if (S.conn !== 'ready' || !S.canWrite || weekDays() || !appRules()) return false;
  if (O && O.gen === S.gen) {
    if (!O.done && !O.took && !fresh()) O.done = true;
    return !O.done;
  }
  return fresh();
}
/** Пустой «Обзор» после «Пропустить»: вернуться к мастеру */
export function onbAgain() { skipped.delete(S.profile); O = null; render(); }

/** Что возьмёт дневник для первой тренировки упражнения без журнала: строка под полями известных весов (здесь и в «Настройке»).
    Читает свежую настройку, поэтому строка следует за вводом без перерисовки страницы */
export function startLine(id: string) {
  const c = S.cfg, s = C.startOf(D.W, c, id);
  if (!s) return 'вес подберёшь на первой тренировке';
  const by = s.src === 'est' && s.of ? 'оценка по «' + C.exName(c, s.of) + '»' : '', w = (by ? '≈ ' : '') + C.fmt(s.w) + ' кг';
  if (s.pct) return 'старт: ' + w + ' — ' + s.pct + '% от максимума ' + C.fmt(s.tm, 1) + ', ' + C.waveOf(c, id).sets(s.reps!) + ' × ' + s.reps + (by ? ' — ' + by : '');
  return 'старт: ' + w + ' на ' + C.rangeOf(D.W, c, id).join('–') + ' повторов' + (by ? ' — ' + by : s.src === 'work' ? '' : ' (от максимума ' + C.fmt(C.knownMax(c, id), 1) + ')');
}

const seq = (o: Onb): Step[] => o.path === 'own' ? ['start', 'prog', 'weights', 'done'] : o.path === 'paste' ? ['start', 'paste', 'prog', 'weights', 'done'] : ['start', 'goal', 'prog', 'weights', 'done'];
const to = (step: Step) => { O!.step = step; render(); };
function skip() { skipped.add(S.profile); O!.done = true; render(); }
/* мастер закончен: дальше — обычные вкладки */
function finish(view: string) { O!.done = true; S.ui.plan = null; go(view); }
/* шаг мастера: номер, заголовок, пояснение в одну-две строки, содержимое и кнопки внизу */
function frame(title: string, text: string | null, body: Kid[], back: (() => void) | null, next: Kid) {
  const o = O!, all = seq(o), n = all.indexOf(o.step) + 1;
  return h('section', { class: 'card', id: 'onb', style: 'max-width:760px;margin:0 auto;width:100%' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow', id: 'onb-n' }, 'Шаг ' + n + ' из ' + all.length), h('h2', null, title)),
      o.step === 'start' || o.step === 'goal' || o.step === 'paste' || o.step === 'prog' ? h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-skip', onclick: skip }, 'Пропустить')
        : o.step === 'done' ? h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-end', onclick: () => finish('overview') }, 'В дневник') : null),
    text ? h('p', { class: 'note', style: 'margin-bottom:12px' }, text) : null,
    body,
    h('div', { class: 'row', style: 'margin-top:16px;justify-content:space-between' },
      back ? h('button', { type: 'button', class: 'btn', id: 'onb-back', onclick: back }, 'Назад') : h('span'), next));
}
/* черновик программы: тот же, что на «Программе»; режим берётся из мастера, пока на «Программе» его не выбрали */
function draft() {
  const cfg = D.cfg, o = O!;
  if (!S.ui.prog) S.ui.prog = { focus: o.focus, others: 'plain', budget: modeBudget(o.focus, cfg.caps.week), draft: null, key: '' };
  const cur = C.currentSlots(D.W, cfg), empty = C.SLOTS.every(sl => !cur[sl.id].length);
  const d = progDraft(cfg, cur, empty, progLifts(cfg), '');
  o.focus = d.st.focus;
  if (o.path === 'paste' && o.paste.fill) { o.paste.fill = false; fillDraft(d.pr); d.st.edited = true; return progDraft(cfg, cur, empty, progLifts(cfg), ''); }
  return d;
}
/* программа из текста — в дни черновика «Вручную»: упражнения по порядку, подходы из текста (без них — три), новые упражнения — в справочник при «Принять» */
function fillDraft(pr: ReturnType<typeof progDraft>['pr']) {
  const P = O!.paste, stamp = Date.now().toString(36);
  let k = 0;
  C.SLOTS.forEach((sl, d) => {
    const day = (P.days || [])[d], list: { ex: string; n: number; isNew: boolean }[] = [];
    if (day) day.items.forEach((it, i) => {
      let id = P.pick[d + '-' + i] || '';
      if (id === NEW) {
        const g = C.guessEx(it.name);
        if (!g) return;
        const def: ExDef = Object.assign({ n: it.name.slice(0, 60) }, g);
        if (P.gear[d + '-' + i] && P.gear[d + '-' + i] !== C.NO_GEAR) def.gear = P.gear[d + '-' + i];
        if (it.w && it.lo) { def.work = it.w; def.workR = it.lo; }
        id = 'x_' + stamp + '_' + k++;
        pr.create[id] = def; pr.cfg.ex[id] = C.placed(pr.cfg, def);
      }
      if (!id || !pr.cfg.ex[id] || list.some(e => e.ex === id)) return;
      list.push({ ex: id, n: Math.max(1, Math.min(6, it.n || 3)), isNew: true });
    });
    pr.slots[sl.id] = list;
  });
  pr.after = C.progTally(pr.cfg, pr.slots);
}
const total = (load: Record<string, number>) => C.SLOTS.reduce((a, sl) => a + load[sl.id], 0);
const daysRow = () => h('div', { class: 'pf', id: 'pd' }, h('span', null, 'Дней в неделю'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Тренировочных дней в неделю' },
  DAY_COUNTS.map(n => h('button', { type: 'button', id: 'pd-' + n, 'aria-pressed': String(n === C.SLOTS.length), onclick: async () => {
    if (n === C.SLOTS.length) return;
    await saveCfg(raw => { if (n === 3) delete raw.days; else raw.days = n; });
    useDays(n, false); if (S.ui.prog) S.ui.prog.draft = null; if (O!.path === 'paste') O!.paste.fill = true; S.ui.plan = null; render(true);
  } }, String(n)))));

function vStart(): View {
  const opt = (id: string, title: string, text: string, act: () => void) => h('button', { type: 'button', class: 'ex-card', id, onclick: act }, h('span', { class: 'nm' }, title), h('span', { class: 'sub' }, text));
  return [frame('С чего начнём?', 'Дневник ведёт твои тренировки, строит план следующей и подсказывает веса. Записи хранятся только на этом устройстве.', [
    h('div', { class: 'stack', style: 'gap:8px' },
      opt('onb-build', 'Собрать программу', 'Дневник подберёт упражнения по дням под твою цель и время.', () => { O!.path = 'build'; if (O!.focus === 'manual') O!.focus = 'even'; S.ui.prog = null; to('goal'); }),
      opt('onb-own', 'У меня своя программа', 'Разложишь свои упражнения по дням сам.', () => { O!.path = 'own'; O!.focus = 'manual'; S.ui.prog = null; to('prog'); }),
      opt('onb-paste', 'Вставить программу текстом', 'Из заметок: дни и упражнения с подходами — дневник разложит их сам.', () => { O!.path = 'paste'; O!.focus = 'manual'; to('paste'); }),
      opt('onb-import', 'Перенести записи из файла', 'Резервная копия этого дневника с другого устройства.', pickBackup)),
    importBox()], null, h('span'))];
}

const EXAMPLE = 'День 1\nЖим лежа 4×6–8 80 кг\nТяга верхнего блока 3×10\nМахи гантелями в стороны 3×12\n\nДень 2\nПриседания со штангой 4×6–8\nРумынская тяга 3×8\nСгибания ног лежа 3×12';
function vPaste(): View {
  const cfg = D.cfg, P = O!.paste;
  const ids = Object.keys(cfg.ex).filter(id => cfg.ex[id].mode !== 'light').sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const parse = () => {
    const el = $('onb-text') as HTMLTextAreaElement | null, text = el ? el.value : P.text, days = pasteDays(text);
    P.text = text;
    if (!days.length) { P.days = null; toast('Не нашёл упражнений: по одному в строке, дни — «День 1», «День 2»'); render(true); return; }
    P.days = days; P.pick = {}; P.gear = {};
    days.forEach((d, n) => d.items.forEach((it, i) => { const id = pasteMatch(cfg, it.name); P.pick[n + '-' + i] = id || ''; P.gear[n + '-' + i] = C.gearGuess(it.name) || C.NO_GEAR; }));
    render(true);
  };
  const days = P.days ? P.days.slice(0, 4) : null;
  const chosen = days ? days.some((d, n) => d.items.some((_, i) => !!P.pick[n + '-' + i])) : false;
  const sets = (it: PasteDay['items'][number]) => (it.n || 3) + (it.lo ? ' × ' + it.lo + (it.hi ? '–' + it.hi : '') : ' подх.') + (it.w ? ' · ' + C.fmt(it.w) + ' кг' : '');
  const row = (n: number, it: PasteDay['items'][number], i: number) => {
    const key = n + '-' + i, v = P.pick[key] || '', known = !!C.guessEx(it.name);
    return h('div', { class: 'stack', style: 'gap:4px;padding:6px 0' },
      h('div', { class: 'sub' }, it.line, !v ? h('span', { class: 'tag', style: 'margin-left:6px' }, 'выбери') : null),
      h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' },
        h('select', { id: 'onb-pick-' + key, class: 'grow', style: 'min-width:0', 'aria-label': 'Упражнение: ' + it.line, onchange: e => { P.pick[key] = e.target.value; render(true); } },
          h('option', { value: '', selected: !v, text: '— не брать —' }),
          known ? h('option', { value: NEW, selected: v === NEW, text: 'Новое: ' + it.name }) : null,
          ids.map(id => h('option', { value: id, selected: v === id, text: C.exName(cfg, id) }))),
        h('span', { class: 'sub', style: 'white-space:nowrap' }, sets(it))),
      v === NEW ? h('label', { class: 'f' }, h('span', null, 'Снаряд'), h('select', { id: 'onb-gear-' + key, onchange: e => { P.gear[key] = e.target.value; } },
        C.gearList(cfg).map(g => h('option', { value: g.id, selected: P.gear[key] === g.id, text: g.n })), h('option', { value: C.NO_GEAR, selected: P.gear[key] === C.NO_GEAR, text: 'Без снаряда' }))) : null);
  };
  const next = async () => {
    const n = Math.max(2, Math.min(4, days!.length));
    if (n !== C.SLOTS.length) { if (!(await saveCfg(raw => { if (n === 3) delete raw.days; else raw.days = n; }))) return; useDays(n, false); }
    /* вес из текста — рабочий вес с повторами, если своего у упражнения ещё нет; его видно и можно поправить в шаге «Веса» */
    const named = days!.flatMap((d, k) => d.items.map((it, i) => ({ it, id: P.pick[k + '-' + i] }))).filter(x => x.id && x.id !== NEW && x.it.w && x.it.lo && !(+S.cfg.ex[x.id].work! > 0) && !(+S.cfg.ex[x.id].max! > 0));
    if (named.length && !(await saveCfg(raw => { for (const x of named) if (raw.ex[x.id] && !raw.ex[x.id].work) { raw.ex[x.id].work = x.it.w; raw.ex[x.id].workR = x.it.lo; } }))) return;
    S.ui.prog = null; S.ui.plan = null; P.fill = true; to('prog');
  };
  return [frame('Программа текстом', 'Вставь программу из заметок: дни — строками «День 1», «День 2», под ними упражнения, по одному в строке, можно с подходами и весом.', [
    h('textarea', { id: 'onb-text', rows: 9, placeholder: EXAMPLE, 'aria-label': 'Программа текстом', oninput: e => { P.text = e.target.value; } }, P.text),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn', id: 'onb-parse', onclick: parse }, 'Разобрать')),
    days ? h('div', { id: 'onb-parsed', style: 'margin-top:12px' },
      h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'Дней: ' + P.days!.length + '.' + (P.days!.length > 4 ? ' Дневник ведёт от двух до четырёх дней — возьмутся первые четыре.' : P.days!.length < 2 ? ' Дневник ведёт от двух дней — второй заполнишь на следующем шаге.' : '') + ' Проверь, что дневник узнал: незнакомое выбери из списка или добавь новым.'),
      days.map((d, n) => h('div', { style: 'margin-bottom:10px' }, h('b', null, 'День ' + (n + 1) + (d.name ? ' · ' + d.name : '')), d.items.map((it, i) => row(n, it, i))))) : null],
    () => to('start'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', disabled: !chosen, onclick: next }, 'Дальше'))];
}

function vGoal(): View {
  const cfg = D.cfg, d = draft(), st = d.st, pr = d.pr, time = timeOf(S.cfgRaw);
  const mins = C.SLOTS.filter(sl => pr.slots[sl.id].length).map(sl => C.estMinutes(pr.cfg, pr.slots[sl.id], cfg.rest));
  const goal = goalOf(st.focus);
  const say = goal === 'force' ? 'Сила: больше вес в одном движении или в тройке — тяжёлый и лёгкий день, остальное подсобка.'
    : goal === 'mix' ? 'Гибрид: сила в одном движении и масса во всём остальном.' : 'Масса: больше мышц — подходы делятся между мышцами, вес растёт с повторами.';
  return [frame('Цель и время', 'Выбери цель, сколько дней в неделю тренируешься и сколько времени готов уделять тренировке. На следующем шаге программу можно поправить.', [
    h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' },
      goalPicker(st, cfg, progLifts(cfg), d.pick, true),
      daysRow(),
      h('label', { class: 'f' }, h('span', null, 'Время на тренировку'), h('select', { id: 'pt', onchange: async e => { const v = +e.target.value; await saveCfg(raw => { if (v) raw.time = v; else delete raw.time; }); if (!v) { st.budget = modeBudget(st.focus, cfg.caps.week); delete st.keep; } st.draft = null; render(true); } },
        [0].concat(TIMES.includes(time) || !time ? TIMES : TIMES.concat(time).sort((a, b) => a - b)).map(v => h('option', { value: v, selected: v === time, text: v ? 'до ' + C.fmtDur(v) : 'не ограничено' }))))),
    h('p', { class: 'sub', id: 'onb-goal-note' }, say),
    h('p', { class: 'sub', id: 'onb-sum', style: 'margin-top:6px' }, 'Получится: ' + loadText(total(pr.after.load)) + ' в неделю' + (mins.length ? ', самая длинная тренировка ≈ ' + C.fmtDur(Math.max(...mins)) : '') + '.')],
    () => to('start'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('prog') }, 'Дальше'))];
}

/* (решение владельца, 25 ноября 2026) день программы, которую собрал дневник: порядок и подходы уже посчитала сборка, поэтому у упражнения
   только «Заменить» — под кнопкой упражнения на те же мышцы, а частично совпадающие — в свёрнутой строке (или сразу, когда других нет).
   Стрелки «выше», «−» и «+» подходов, «убрать», пометки «новое» и строки «В день» здесь нет: они остались своей программе и программе
   текстом (progDay) и вкладке «Программа». Замена — та же, что на «Программе» (draft.ts): подходы остаются, «вместо «…»» показывает, что было */
function builtDay(cfg: Cfg, sl: Slot, list: ProgEntry[], load: number, edit: ProgEdit) {
  const rows = list.map((e, i) => {
    const k = C.kindOf(cfg, e.ex), nm = C.exName(cfg, e.ex), sid = 'sw-' + sl.id + '-' + i, goal = k === 'base' ? C.goalName(cfg, e.ex) : null;
    const alts = k === 'compound' || k === 'iso' ? C.swapsFor(cfg, e.ex, list.map(x => x.ex)) : null, can = !!alts && alts.same.length + alts.near.length > 0;
    const open = can && edit.swapAt === sl.id + ':' + i;
    let first = true;                                                   // первое упражнение списка получает фокус, когда список открывается (swapOpen в draft.ts)
    const card = (x: Swap, note: string) => h('button', { type: 'button', class: 'ex-card', id: first ? (first = false, sid + '-to') : null, onclick: () => edit.swap(sl.id, i, x) }, h('span', { class: 'nm' }, x.n), note ? h('span', { class: 'sub' }, note) : null);
    const added = (x: Swap) => x.def ? 'добавится в справочник' : '';
    const near = (x: Swap) => card(x, ['мышцы совпадают частично: ' + x.main!.map(m => C.MUSCLE[m].n.toLowerCase()).join(', '), added(x)].filter(Boolean).join(' · '));
    const pick = open ? h('div', { class: 'stack swaprow', style: 'gap:6px' },
      alts!.same.map(x => card(x, added(x))),
      !alts!.near.length ? null : alts!.same.length
        ? h('details', null, h('summary', { class: 'sub', style: 'cursor:pointer' }, 'Ещё похожие: ' + alts!.near.length), h('div', { class: 'stack', style: 'gap:6px;margin-top:6px' }, alts!.near.map(near)))
        : alts!.near.map(near)) : null;
    return h('div', { class: 'prow' + (e.was ? ' changed' : '') + (open ? ' swapping' : '') },
      h('div', { class: 'grow' },
        h('div', { class: 'pn' }, nm, goal ? h('span', { class: 'tag' + (['strength', 'auto'].includes(C.goalOf(cfg, e.ex)!) ? ' accent' : '') }, goal) : null),
        h('div', { class: 'sub' }, progScheme(cfg, e), e.was ? ' · вместо «' + C.exName(cfg, e.was) + '»' : '')),
      can ? h('button', { type: 'button', class: 'btn sm' + (open ? ' ghost' : ''), id: sid, 'aria-expanded': open ? 'true' : 'false', 'aria-label': (open ? 'Не заменять: ' : 'Заменить упражнение: ') + nm,
        onclick: () => edit.swapOpen(open ? null : sl.id, i) }, open ? 'Отмена' : 'Заменить') : null,
      pick);
  });
  return h('div', { class: 'pday' },
    h('div', { class: 'pday-h' }, h('b', null, sl.n), h('span', { class: 'sub' }, loadText(load) + (list.length ? ' · ≈ ' + C.fmtDur(C.estMinutes(cfg, list, D.cfg.rest)) : ''))),
    rows.length ? rows : h('p', { class: 'sub', style: 'padding:10px 0' }, 'В этот день упражнений пока нет.'));
}

function vProg(): View {
  const cfg = D.cfg, d = draft(), pr = d.pr, P = cfg.program, own = O!.path !== 'build', text = O!.path === 'paste';
  const mins = C.SLOTS.filter(sl => pr.slots[sl.id].length).map(sl => C.estMinutes(pr.cfg, pr.slots[sl.id], cfg.rest));
  const accept = async () => {
    O!.step = 'weights'; O!.took = true;                                // до перерисовки внутри acceptProgram: мастер не должен закончиться, увидев программу
    await acceptProgram(pr, d.manual ? pr.name : null);
    if (!S.cfg.program) { O!.step = 'prog'; O!.took = false; }
    render();
  };
  const next = d.changed ? h('button', { type: 'button', class: 'btn primary', id: 'onb-accept', onclick: accept }, 'Принять программу')
    : P ? h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('weights') }, 'Дальше')
    : h('button', { type: 'button', class: 'btn primary', id: 'onb-accept', disabled: true }, 'Принять программу');
  return [frame(own ? 'Твоя программа' : 'Программа',
    text ? 'Так разложилась твоя программа. Поправь подходы и порядок, добавь недостающее из списка.'
      : own ? 'Добавь в каждый день свои упражнения из списка, поставь подходы и порядок. Нет нужного упражнения — заведёшь его в «Настройке».'
      : 'Так дневник раскладывает упражнения по дням: порядок и подходы он посчитал сам. Любое упражнение можно заменить на похожее.', [
    own ? h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' }, daysRow()) : null,
    h('p', { class: 'sub', id: 'onb-sum', style: 'margin-bottom:8px' }, loadText(total(pr.after.load)) + ' в неделю' + (mins.length ? ' · самая длинная тренировка ≈ ' + C.fmtDur(Math.max(...mins)) : '')),
    h('div', { class: C.SLOTS.length === 2 ? 'grid2 even' : C.SLOTS.length === 4 ? 'grid4' : 'grid3' }, C.SLOTS.map(sl => own ? progDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], null, d.edit, null) : builtDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], d.edit))),
    h('p', { class: 'sub', style: 'margin-top:8px' }, 'Нагрузка по мышцам и подходы в неделю — на вкладке «Программа», когда закончишь.')],
    () => to(text ? 'paste' : own ? 'start' : 'goal'), next)];
}

/* программа, как она принята: упражнения, которым нужен вес, по порядку дней — без лёгких и средних дней (их вес — доля максимума тяжёлого) */
function progIds() {
  const cfg = D.cfg, cur = C.currentSlots(D.W, cfg);
  return [...new Set(C.SLOTS.flatMap(sl => cur[sl.id].map(e => e.ex)))].filter(id => cfg.ex[id] && cfg.ex[id].mode !== 'light');
}
function vWeights(): View {
  const cfg = D.cfg, o = O!, ids = progIds(), done = D.W.filter(w => !w.open);
  const gears = [...new Set(ids.map(id => C.gearOf(cfg, id)))];
  const usual = (g: string) => (C.GEAR.find(x => x.id === g) || cfg.gear[g]).step;
  const refresh = () => { for (const id of ids) { const out = $('kw-out-' + id); if (out) out.textContent = startLine(id); } };
  const setStep = async (g: string, val: string) => {
    const v = toNum(val);
    if (!(v! > 0)) { toast('Шаг должен быть больше нуля'); render(true); return; }
    if (!(await saveCfg(r => { r.gear = r.gear || {}; r.gear[g] = Object.assign({}, r.gear[g], { step: v }); }))) return;
    o.steps[g] = true; S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null;
    render(true);
  };
  const set = async (id: string, k: 'work' | 'workR' | 'max', el: El) => {
    const txt = el.value.trim(), v = toNum(txt);
    if (txt && !(v! > 0)) { toast('Нужно число больше нуля'); el.value = ''; return; }
    const val = txt ? (k === 'workR' ? Math.max(1, Math.round(v!)) : v) : null;
    if ((+S.cfg.ex[id][k]! || null) === val) return;
    if (!(await saveCfg(r => { const e = r.ex[id]; if (!e) return; if (val) e[k] = val; else delete e[k]; }))) return;
    S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null;
    refresh();
  };
  const inp = (id: string, k: 'work' | 'workR' | 'max', ph: string, lab: string) => h('input', { class: 'num sm', type: 'text', inputmode: k === 'workR' ? 'numeric' : 'decimal', id: 'kw-' + k + '-' + id, placeholder: ph, 'aria-label': lab + ': ' + C.exName(cfg, id), value: +cfg.ex[id][k]! > 0 ? C.fmt(+cfg.ex[id][k]!, 3) : '', onchange: e => set(id, k, e.target) });
  const row = (id: string) => {
    const nm = h('div', { class: 'kw-n' }, C.exName(cfg, id), C.isCycle(cfg, id) ? h('span', { class: 'tag', style: 'margin-left:6px' }, 'базовое') : null);
    if (C.lastSessionItem(done, id, null, null)) return h('div', { class: 'kw-row' }, nm, h('div', { class: 'kw-log sub' }, 'Есть в журнале — веса берутся из него.'));
    return h('div', { class: 'kw-row' }, nm, inp(id, 'work', 'раб. кг', 'Рабочий вес, кг'), inp(id, 'workR', 'повт.', 'Повторов с рабочим весом'), inp(id, 'max', 'макс. кг', 'Разовый максимум, кг'), h('div', { class: 'kw-out sub', id: 'kw-out-' + id, text: startLine(id) }));
  };
  const head = h('div', { class: 'kw-row kw-head' }, h('span', null, 'Упражнение'), h('span', null, 'Рабочий вес, кг'), h('span', null, 'Повторов'), h('span', null, 'Разовый максимум, кг'), h('span', null, 'Что возьмёт дневник'));
  const next = () => {
    const miss = gears.filter(g => !o.steps[g]);
    if (miss.length) { toast('Укажи шаг веса: ' + C.list(miss.map(g => cfg.gear[g].n.toLowerCase()))); const el = $('onb-step-' + miss[0]); if (el) el.focus(); return; }
    to('done');
  };
  return [frame('Веса', null, [
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Шаг веса'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'На сколько прибавляется вес на снаряде в твоём зале. Не знаешь — нажми обычное значение.'),
    h('div', { class: 'stack', id: 'onb-gear', style: 'gap:6px;margin-bottom:16px' }, gears.map(g => h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' },
      h('span', { class: 'grow', style: 'min-width:0' }, cfg.gear[g].n),
      h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'onb-step-' + g, placeholder: 'кг', 'aria-label': 'Шаг веса, кг: ' + cfg.gear[g].n, value: o.steps[g] ? C.fmt(cfg.gear[g].step, 3) : '', onchange: e => setStep(g, e.target.value) }),
      o.steps[g] ? h('span', { class: 'sub', style: 'min-width:96px' }, 'кг') : h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-step-usual-' + g, style: 'min-width:96px', onclick: () => setStep(g, String(usual(g))) }, 'обычно ' + C.fmt(usual(g)))))),
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Веса упражнений'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Заполни то, что уже делал: рабочий вес с повторами или разовый максимум. Пустые со штангой и гантелями дневник оценит по похожим, остальные подберёшь на первой тренировке.'),
    h('div', { class: 'kw', id: 'known' }, head, ids.map(row))],
    () => { S.ui.prog = null; to('prog'); }, h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: next }, 'Дальше'))];
}

function vDone(): View {
  const cfg = D.cfg, P = cfg.program, cur = C.currentSlots(D.W, cfg), load = C.progTally(cfg, cur).load;
  const tip = (t: string, x: string) => h('div', { class: 'why' }, h('b', null, t), h('div', { class: 'sub' }, x));
  return [frame('Программа готова', P ? '«' + P.name + '»: ' + loadText(total(load)) + ' в неделю. По ней пойдут следующие тренировки.' : null, [
    h('div', { class: C.SLOTS.length === 2 ? 'grid2 even' : C.SLOTS.length === 4 ? 'grid4' : 'grid3' }, C.SLOTS.map(sl => progDay(cfg, sl, cur[sl.id], load[sl.id], null, null, null))),
    h('div', { style: 'margin-top:12px' },
      tip('Записывай вес и повторы каждого подхода', 'Со второй тренировки дневник подставляет веса сам и показывает цель по повторам.'),
      tip('Вес без старта подбирается на первой тренировке', 'Возьми вес, с которым повторы попадают в диапазон, а в запасе остаётся один-два повтора. Лучше начать легче.'),
      tip('Программу можно поправить', 'Дни, упражнения и подходы — на вкладке «Программа», шаг веса и веса — в «Настройке».'))],
    () => to('weights'), h('button', { type: 'button', class: 'btn primary', id: 'onb-go', onclick: () => finish('workout') }, 'Открыть первую тренировку'))];
}

/** Мастер вместо пустого «Обзора» */
export function vOnboard(): View {
  if (!O || O.gen !== S.gen) O = { gen: S.gen, step: 'start', path: 'build', focus: 'even', steps: {}, took: false, done: false, paste: { text: '', days: null, pick: {}, gear: {}, fill: false } };
  const v = O.step === 'goal' ? vGoal() : O.step === 'paste' ? vPaste() : O.step === 'prog' ? vProg() : O.step === 'weights' ? vWeights() : O.step === 'done' ? vDone() : vStart();
  return v;
}
