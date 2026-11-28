/* Онбординг: первый вход в пустой профиль (решение владельца, 25 ноября 2026). В эталоне этого нет.
   Пока в профиле нет ни тренировок, ни программы, «Обзор» — не карточка «В дневнике пока пусто», а мастер на весь экран, без вкладок:
     1. Старт — собрать программу, разложить свою по дням, вставить её текстом или перенести записи из файла копии;
        текст дневник делит на дни и упражнения (core/paste.ts), названия сверяет со справочником, незнакомые атлет выбирает сам;
     2. Цель — масса, сила или гибрид с тем же уточняющим списком, что на «Программе», дни в неделю, какие из них идут подряд, время на тренировку (отдых между подходами дневник ставит упражнению сам);
     2а. Что беречь — больные места и стоп-упражнения (care.ts; решение владельца, 25 ноября 2026), только когда программу собирает дневник;
     3. Программа — дни собранного черновика (тот же черновик и те же правки, что на «Программе», draft.ts); «Принять» принимает её;
     4. Веса — шаг веса снарядов этой программы (атлет вводит его сам) и известные веса её упражнений; пустые дневник оценивает
        по похожим упражнениям со штангой и гантелями (core/rules.ts, kinMax), остальные подбираются на первой тренировке;
        вес тела и сколько раз подряд атлет подтягивается (решение владельца, 25 ноября 2026, пункт 3 разбора): старт подтягиваний — вес тела
        на столько повторов, а меньше нижней границы диапазона — вместо них встаёт первая замена на те же мышцы (вертикальная тяга) с пояснением;
     5. Готово — программа с весами старта и переход к первой тренировке.
   Расчёт тот же, что на вкладках: мастер только ведёт по шагам. Он идёт только с днями «День N» — с таблицей дней эталона
   (общие сценарии сверки с артефактом) пустой «Обзор» прежний. «Пропустить» возвращает прежний пустой «Обзор» до перезагрузки.
   Новая программа (просьба владельца, 28 ноября 2026): с днями «День N» блока сборки на «Программе» нет — кнопка «Собрать новую программу»
   открывает этот же мастер (kind 'new') прямо на вкладке «Программа», без вкладок. Шаги те же, без переноса записей из файла и без памятки
   (она и так встречает каждую тренировку); «Отмена» до «Принять» оставляет действующую программу, после — «К программе». Ушёл на другую
   вкладку до «Принять» — мастер ждёт на том же шаге, после — закончен. Сборка, замены и «Принять» — те же, что были в блоке: черновик общий (draft.ts).
   Таблицы мышц с «−» и «+» в мастере нет (выбор владельца, 28 ноября 2026): подходы мышцам ставит дневник */
import { $, C, h, toInt, toNum } from './dom.ts';
import { PT, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { saveCfg } from './storage.ts';
import { D, go, render } from './render.ts';
import { acceptProgram, dayLoad, loadText, progDay } from './program.ts';
import { builtDay } from './builtday.ts';
import { bodyMap } from './bodymap.ts';   // фигура с нагрузкой мышц на последнем шаге (просьба владельца, 25 ноября 2026)   // у программы, которую собрал дневник, только «Заменить» (решение владельца, 25 ноября 2026)
import { careBox, pairsRow } from './care.ts';
import { memoCards } from './memo.ts';
import { carousel } from './carousel.ts';   // дни программы каруселью   // что беречь и дни подряд (решение владельца, 25 ноября 2026)
import { progDraft, progFocus, progLifts } from './draft.ts';
import { goalOf, goalPicker, modeBudget, othersOf } from './goal.ts';
import { rulesBox } from './program.ts';
import { TIMES, timeOf } from './fit.ts';
import { weekDays } from './platform.ts';
import { importBox, pickBackup } from './importer.ts';
import { DAY_COUNTS, useDays } from '../core/days.ts';
import { appRules, withBody } from '../core/rules.ts';
import { pasteDays, pasteMatch } from '../core/paste.ts';
import type { PasteDay } from '../core/paste.ts';
import type { ExDef, ProgSlots, Swap } from '../core/types.ts';
import type { El, Kid, View } from './types.ts';

declare const __DEV__: boolean;

type Step = 'start' | 'goal' | 'care' | 'paste' | 'prog' | 'weights' | 'done' | 'memo';
/** Программа из текста: text — как вставлен, days — разбор, pick — что взять в строке «день-строка» (id, '' — не брать, NEW — новое упражнение),
    gear — снаряд нового упражнения, fill — разбор ещё не разложен в черновик */
interface Paste { text: string; days: PasteDay[] | null; pick: Record<string, string>; gear: Record<string, string>; fill: boolean }
/** Мастер открытого профиля: gen — поколение профиля (storage.ts, openProfile), path — собрать, своя или текстом, focus — режим сборки,
    steps — снаряды, шаг которых атлет ввёл в мастере, took — программа принята в мастере;
    reps — сколько раз подряд атлет делает упражнение с весом тела, away — такие упражнения, которые пока заменены: id → чем и дни программы до замены,
    day — какой день программы открыт в карусели шага «Программа» (с 0) */
interface Onb { gen: number; kind: 'first' | 'new'; step: Step; path: 'build' | 'own' | 'paste'; focus: string; steps: Record<string, boolean>; took: boolean; done: boolean; paste: Paste; reps: Record<string, number>; away: Record<string, { to: string; slots: ProgSlots }>; day: number }
const NEW = '+new';
let O: Onb | null = null;
/* сколько дней было до того, как в мастере новой программы выбрали другое число: помнится до «Принять», и после «Отмены» тоже — число дней сохранено сразу */
let was: { gen: number; n: number } | null = null;
/* профили, где мастер пропустили: до перезагрузки страницы там прежний пустой «Обзор» */
const skipped = new Set<string>();

/* профиль пуст: ни одной тренировки с рабочими подходами, нет идущей тренировки и принятой программы — как у пустого «Обзора» */
const fresh = () => !skipped.has(S.profile) && !S.cfg.program && !(S.draft && S.draft.open) && !S.workouts.some(w => w.items.some(it => C.work(it).length));

/** Мастер на экране: идёт или должен начаться. Пока программа в нём не принята, он заканчивается сам, как только профиль перестал быть пустым (загружена копия) */
export function onbOn(): boolean {
  if (S.conn !== 'ready' || !S.canWrite || weekDays() || !appRules()) return false;
  if (O && O.gen === S.gen && O.kind === 'new') return !O.done ? false : fresh();   // мастер новой программы идёт на «Программе»
  if (O && O.gen === S.gen) {
    if (!O.done && !O.took && !fresh()) O.done = true;
    return !O.done;
  }
  return fresh();
}
/** Пустой «Обзор» после «Пропустить»: вернуться к мастеру */
export function onbAgain() { skipped.delete(S.profile); O = null; render(); }

const blank = (kind: Onb['kind'], focus: string): Onb => ({ gen: S.gen, kind, step: 'start', path: 'build', focus, steps: {}, took: false, done: false, paste: { text: '', days: null, pick: {}, gear: {}, fill: false }, reps: {}, away: {}, day: 0 });
/** Мастер новой программы на «Программе»: идёт, пока его не закончили и не отменили */
export function newOn(): boolean {
  return !!O && O.gen === S.gen && O.kind === 'new' && !O.done && S.conn === 'ready' && S.canWrite && !weekDays() && appRules();
}
/** «Собрать новую программу» на «Программе»: мастер начинается с режима, по которому собрана действующая программа */
export function onbNew() {
  const cfg = D.cfg, cur = C.currentSlots(D.W, cfg);
  shown = ''; S.ui.prog = null;
  O = blank('new', progFocus(cfg.program, progLifts(cfg), C.SLOTS.every(sl => !cur[sl.id].length)));
  render();
}
/* ушли с «Программы» после «Принять» — мастер новой программы закончен; до «Принять» он ждёт: вернувшись, атлет продолжает с того же шага */
addEventListener('hashchange', () => { if (O && O.kind === 'new' && O.took && location.hash !== '#program') { O.done = true; S.ui.prog = null; } });
/* (только при разработке) сценарии сверки экранов читают у черновика мастера то, чего на шаге «Программа» нет (выбор владельца, 28 ноября 2026):
   название, лимит недели, подходы в неделю у черновика и сейчас, заметки сборки — у эталона и с таблицей дней эталона это видно в блоке «Новая программа» */
if (__DEV__) (window as unknown as { __dnevnikProg: unknown }).__dnevnikProg = () => {
  const st = S.ui.prog, pr = st && st.draft;
  if (!st || !pr) return null;
  const cfg = D.cfg, cur = C.currentSlots(D.W, cfg), empty = C.SLOTS.every(sl => !cur[sl.id].length);
  const total = (t: typeof pr.after) => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
  return { name: pr.name, cap: st.focus === 'manual' ? cfg.caps.week : st.budget, sets: Math.round(total(pr.after) * 2) / 2,
    now: empty && !pr.away ? '' : dayLoad(total(pr.before) + (pr.away || 0)), notes: pr.notes.map(n => n.t),
    why: (pr.hand || []).map(x => x.m + ': ' + x.t).concat(pr.notes.map(n => n.t + ' ' + n.x)).join('\n') };
};

/** Что возьмёт дневник для первой тренировки упражнения без журнала: строка под полями известных весов (здесь и в «Настройке»).
    Читает свежую настройку, поэтому строка следует за вводом без перерисовки страницы */
export function startLine(id: string) {
  const c = S.cfg, s = C.startOf(D.W, c, id);
  if (!s) return 'вес подберёшь на первой тренировке';
  const by = s.src === 'est' && s.of ? 'оценка по «' + C.exName(c, s.of) + '»' : '', w = (by ? '≈ ' : '') + C.fmt(s.w) + ' кг';
  if (s.pct) return 'старт: ' + w + ' — ' + s.pct + '% от максимума ' + C.fmt(s.tm, 1) + ', ' + C.waveOf(c, id).sets(s.reps!) + ' × ' + s.reps + (by ? ' — ' + by : '');
  return 'старт: ' + w + ' на ' + C.rangeOf(D.W, c, id).join('–') + ' повторов' + (by ? ' — ' + by : s.src === 'work' ? '' : ' (от максимума ' + C.fmt(C.knownMax(c, id), 1) + ')');
}

const seq = (o: Onb): Step[] => (o.path === 'own' ? ['start', 'care', 'prog', 'weights', 'done', 'memo'] as Step[] : o.path === 'paste' ? ['start', 'paste', 'care', 'prog', 'weights', 'done', 'memo'] as Step[] : ['start', 'goal', 'care', 'prog', 'weights', 'done', 'memo'] as Step[]).filter(x => x !== 'memo' || o.kind === 'first');   // у новой программы памятки нет: она встречает каждую тренировку
const to = (step: Step) => { O!.step = step; O!.day = 0; render(); };   // на шаг «Программа» мастер приходит к первому дню
function skip() { skipped.add(S.profile); O!.done = true; render(); }
/* новая программа: «Отмена» — действующая программа остаётся */
function cancel() { O!.done = true; S.ui.prog = null; render(); }
/* мастер закончен: дальше — обычные вкладки */
function finish(view: string) { O!.done = true; S.ui.plan = null; go(view); }
/* шаг мастера: номер, заголовок, пояснение в одну-две строки, содержимое и кнопки внизу */
let shown = '';   // шаг, который на экране: появление шага (data-enter) — только при переходе на него, а не при каждой перерисовке внутри шага
function frame(title: string, text: string | null, body: Kid[], back: (() => void) | null, next: Kid) {
  const o = O!, all = seq(o), n = all.indexOf(o.step) + 1, enter = shown !== o.step;
  shown = o.step;
  const before = o.step === 'start' || o.step === 'goal' || o.step === 'care' || o.step === 'paste' || o.step === 'prog';
  const end = o.kind === 'new' ? before && !o.took ? h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-cancel', onclick: cancel }, 'Отмена') : h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-end', onclick: () => finish('program') }, 'К программе')
    : before ? h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-skip', onclick: skip }, 'Пропустить')
    : o.step === 'done' || o.step === 'memo' ? h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-end', onclick: () => finish('overview') }, 'В дневник') : null;
  /* полоса шагов и «Готово на N%» сверху, «Назад» и «Дальше» — внизу за чертой (новый дизайн, 26 ноября 2026) */
  return h('section', { class: 'card', id: 'onb', 'data-step': o.step, 'data-path': o.path, 'data-enter': enter ? '' : null, style: 'max-width:760px;margin:0 auto;width:100%' },
    h('div', { class: 'onb-steps', 'aria-hidden': 'true' }, all.map((_, i) => h('i', { class: i < n - 1 ? 'on' : i === n - 1 ? 'on now' : null }))),
    h('div', { class: 'onb-top' }, h('span', null, h('b', null, 'Готово на ' + Math.round(n / all.length * 100) + '%')), end),
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow', id: 'onb-n' }, 'Шаг ' + n + ' из ' + all.length), h('h2', null, title))),
    text ? h('p', { class: 'note', style: 'margin-bottom:12px' }, text) : null,
    body,
    h('div', { class: 'row onb-foot', style: 'margin-top:16px;justify-content:space-between' },
      back ? h('button', { type: 'button', class: 'btn', id: 'onb-back', onclick: back }, 'Назад') : h('span'), next));
}
/* черновик программы: тот же, что на «Программе»; режим берётся из мастера, пока на «Программе» его не выбрали */
function draft() {
  const cfg = D.cfg, o = O!;
  if (!S.ui.prog) S.ui.prog = { focus: o.focus, others: othersOf(cfg.program), budget: modeBudget(o.focus, cfg.caps.week), draft: null, key: '', daysWas: o.kind === 'new' && was && was.gen === S.gen ? was.n : undefined };   // новая программа: «Остальные базовые» — как у действующей
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
    if (O!.kind === 'new' && !(was && was.gen === S.gen)) was = { gen: S.gen, n: C.SLOTS.length };   // новая программа: «Вернуть прежнюю» вернёт и число дней, как на «Программе»
    if (S.ui.prog && O!.kind === 'new') S.ui.prog.daysWas = was!.n;
    await saveCfg(raw => { if (n === 3) delete raw.days; else raw.days = n; });
    useDays(n, false); if (S.ui.prog) S.ui.prog.draft = null; if (O!.path === 'paste') O!.paste.fill = true; S.ui.plan = null; render(true);
  } }, String(n)))));

function vStart(): View {
  const opt = (id: string, title: string, text: string, act: () => void) => h('button', { type: 'button', class: 'ex-card', id, onclick: act }, h('span', { class: 'nm' }, title), h('span', { class: 'sub' }, text));
  const now = O!.kind === 'new';                                     // новая программа: записи уже есть, переноса из файла здесь нет — он в «Настройке» → «Данные»
  return [frame(now ? 'Новая программа' : 'С чего начнём?', now ? 'Текущая действует, пока не примешь новую.' : 'Записи хранятся только на этом устройстве.', [
    h('div', { class: 'stack', style: 'gap:8px' },
      opt('onb-build', 'Собрать программу', 'Под твою цель и время.', () => { O!.path = 'build'; if (O!.focus === 'manual') O!.focus = 'even'; S.ui.prog = null; to('goal'); }),
      opt('onb-own', now ? 'Своя программа' : 'У меня своя программа', now ? 'Свои упражнения по дням, начиная с текущих.' : 'Свои упражнения по дням.', () => { O!.path = 'own'; O!.focus = 'manual'; S.ui.prog = null; to('care'); }),
      opt('onb-paste', 'Вставить программу текстом', 'Из заметок — дневник разложит сам.', () => { O!.path = 'paste'; O!.focus = 'manual'; to('paste'); }),
      now ? null : opt('onb-import', 'Перенести записи из файла', 'Резервная копия с другого устройства.', pickBackup)),
    now ? null : importBox()], null, h('span'))];
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
    S.ui.prog = null; S.ui.plan = null; P.fill = true; to('care');
  };
  return [frame('Программа текстом', 'Дни — строками «День 1», «День 2», под ними упражнения по одному в строке.', [
    h('textarea', { id: 'onb-text', rows: 9, placeholder: EXAMPLE, 'aria-label': 'Программа текстом', oninput: e => { P.text = e.target.value; } }, P.text),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn', id: 'onb-parse', onclick: parse }, 'Разобрать')),
    days ? h('div', { id: 'onb-parsed', style: 'margin-top:12px' },
      h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'Дней: ' + P.days!.length + '.' + (P.days!.length > 4 ? ' Возьмутся первые четыре.' : P.days!.length < 2 ? ' Второй заполнишь дальше.' : '') + ' Незнакомое выбери из списка.'),
      days.map((d, n) => h('div', { style: 'margin-bottom:10px' }, h('b', null, 'День ' + (n + 1) + (d.name ? ' · ' + d.name : '')), d.items.map((it, i) => row(n, it, i))))) : null],
    () => to('start'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', disabled: !chosen, onclick: next }, 'Дальше'))];
}

/* за выбранное время не уложиться даже с самым малым лимитом недели — та же подсказка, что была под выбором времени на «Программе» */
const fitNote = (d: ReturnType<typeof draft>) => d.fit && !d.fit.fits ? h('p', { class: 'sub', id: 'pt-note', role: 'status', style: 'margin:-4px 0 12px' }, 'За ' + C.fmtDur(d.time) + ' не уложиться: даже ' + d.fit.budget + ' подходов в неделю — это тренировка ≈ ' + C.fmtDur(d.fit.min) + '. Выбери больше времени или больше дней в неделю.') : null;

function vGoal(): View {
  const cfg = D.cfg, d = draft(), st = d.st, time = timeOf(S.cfgRaw), now = O!.kind === 'new';   // новая программа: и то, что было в блоке сборки на «Программе»
  return [frame('Цель и время', null, [
    h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' },
      goalPicker(st, cfg, progLifts(cfg), d.pick, true),
      /* «Гибрид»: остальные базовые — как подсобка или растут как раньше; базовых больше, чем дней, — каким жертвовать (решения владельца, 23 и 25 ноября 2026).
         Раньше это было в блоке сборки на «Программе» (просьба владельца, 28 ноября 2026) */
      now && goalOf(st.focus) === 'mix' ? h('div', { class: 'pf' }, h('span', null, 'Остальные базовые'), h('div', { class: 'seg multi', role: 'group', 'aria-label': 'Остальные базовые упражнения' },
        h('button', { type: 'button', id: 'po-plain', 'aria-pressed': String(st.others === 'plain'), onclick: () => d.pick(st.focus, 'plain') }, 'Как подсобка'),
        h('button', { type: 'button', id: 'po-grow', 'aria-pressed': String(st.others === 'grow'), onclick: () => d.pick(st.focus, 'grow') }, 'Растут как раньше'))) : null,
      (now ? d.pr.dropped : []).map((x, i) => h('label', { class: 'f' }, h('span', null, 'Без базового'), h('select', { id: 'pd-drop' + (i ? '-' + i : ''), onchange: e => {
        const v = e.target.value, next = d.pr.dropped.slice(), j = next.indexOf(v);
        if (j >= 0) next[j] = next[i];
        next[i] = v; st.drop = next; st.draft = null; render(true);
      } }, d.pr.dropFrom.map(id => h('option', { value: id, selected: id === x, text: C.exName(cfg, id) }))))),
      daysRow(),
      h('label', { class: 'f' }, h('span', null, 'Время на тренировку'), h('select', { id: 'pt', onchange: async e => { const v = +e.target.value; await saveCfg(raw => { if (v) raw.time = v; else delete raw.time; }); if (!v) { st.budget = modeBudget(st.focus, cfg.caps.week); delete st.keep; } st.draft = null; render(true); } },
        [0].concat(TIMES.includes(time) || !time ? TIMES : TIMES.concat(time).sort((a, b) => a - b)).map(v => h('option', { value: v, selected: v === time, text: v ? 'до ' + C.fmtDur(v) : 'не ограничено' }))))),
    now ? fitNote(d) : null],
    () => to('start'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('care') }, 'Дальше'))];
}

/* что беречь: больные места и стоп-упражнения; ничего не отмечать — тоже ответ. На всех трёх путях — перед днями программы:
   у собранной после «Цели и времени», у своей — сразу после первого шага, у программы текстом — после разбора текста */
function vCare(): View {
  const path = O!.path;
  return [frame('Что беречь', 'Нечего отмечать — жми «Дальше».', [careBox()],
    () => to(path === 'own' ? 'start' : path === 'paste' ? 'paste' : 'goal'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('prog') }, 'Дальше'))];
}

/* дни программы — карусель (carousel.ts); открытый день хранится в мастере (O.day) */
function dayCarousel(days: HTMLElement[]): Kid[] {
  return carousel(days, O!, { id: 'onb-days', dot: i => 'onb-dot-' + C.SLOTS[i].id, lab: i => C.SLOTS[i].n, aria: 'Дни программы' });
}

function vProg(): View {
  const cfg = D.cfg, d = draft(), pr = d.pr, P = cfg.program, own = O!.path !== 'build', now = O!.kind === 'new';
  const accept = async () => {
    O!.step = 'weights'; O!.took = true;                                // до перерисовки внутри acceptProgram: мастер не должен закончиться, увидев программу
    await acceptProgram(pr, d.manual ? pr.name : null);
    if (!S.cfg.program) { O!.step = 'prog'; O!.took = false; } else was = null;
    render();
  };
  const next = d.changed ? h('button', { type: 'button', class: 'btn primary', id: 'onb-accept', onclick: accept }, 'Принять программу')
    : P ? h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('weights') }, 'Дальше')
    : h('button', { type: 'button', class: 'btn primary', id: 'onb-accept', disabled: true }, 'Принять программу');
  return [frame(own ? 'Твоя программа' : 'Программа', null, [   // на шаге только дни программы (просьба владельца, 25 ноября 2026)
    own ? h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' }, daysRow())
      : C.SLOTS.length > 2 ? h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' }, pairsRow()) : null,   // дни подряд — у дней программы, которую собрал дневник (просьба владельца, 25 ноября 2026)
    now && !own ? fitNote(d) : null,
    dayCarousel(C.SLOTS.map(sl => own ? progDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], null, d.edit, null) : builtDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], d.edit))),
    /* новая программа (просьба владельца, 28 ноября 2026): из блока под днями черновика — только нарушения лимитов; таблицы мышц с «−» и «+»,
       счётчика свободных подходов и заметок сборки нет (выбор владельца тем же днём). В первом входе шаг прежний: только дни (просьба владельца, 25 ноября 2026) */
    now ? rulesBox(C.ruleBreaks(pr.cfg, pr.after)) : null],
    () => to('care'), next)];
}

/* программа, как она принята: упражнения, которым нужен вес, по порядку дней — без лёгких и средних дней (их вес — доля максимума тяжёлого) */
function progIds() {
  const cfg = D.cfg, cur = C.currentSlots(D.W, cfg);
  return [...new Set(C.SLOTS.flatMap(sl => cur[sl.id].map(e => e.ex)))].filter(id => cfg.ex[id] && cfg.ex[id].mode !== 'light');
}
function vWeights(): View {
  const cfg = D.cfg, o = O!, ids = progIds(), done = D.W.filter(w => !w.open);
  const gears = [...new Set(ids.map(id => C.gearOf(cfg, id)))];
  if (o.kind === 'new') for (const g of gears) o.steps[g] = true;      // новая программа: шаг веса снарядов уже знаком — он стоит в поле, его можно поправить
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
  /* вес тела и упражнения, где он входит в вес: подтягивания, отжимания, брусья — без журнала, и те, что пока заменены */
  const bodyIds = ids.filter(id => withBody(cfg, id) && !C.lastSessionItem(done, id, null, null)).concat(Object.keys(o.away).filter(id => cfg.ex[id] && !ids.includes(id)));
  const bw = S.body.length ? S.body[S.body.length - 1].kg : null;
  /* у подсобки повторов должно хватать на нижнюю границу диапазона; базовое в силовой роли (цель «Силы» и «Гибрида») не заменяется — по повторам дневник оценит его максимум */
  const plainEx = (id: string) => { const k = C.kindOf(cfg, id); return k === 'compound' || k === 'iso'; };
  const lo = (id: string) => plainEx(id) ? C.rangeOf(D.W, cfg, id)[0] : 1;
  const fit = (id: string, kg: number | null) => saveCfg(r => { const e = r.ex[id]; if (!e || !kg || !(o.reps[id] >= lo(id))) return; e.work = kg; e.workR = o.reps[id]; delete e.max; });
  const setBw = async (el: El) => {
    const kg = toNum(el.value);
    if (!(kg! > 20 && kg! < 400)) { toast('Введи вес в килограммах'); el.value = bw ? C.fmt(bw, 1) : ''; return; }
    try { await S.db!.doc(PT().body + '/' + D.today).set({ date: D.today, kg }); } catch (e) { dbErr(e); return; }
    for (const id of bodyIds) if (!o.away[id]) await fit(id, kg);
    S.ui.plan = null; render(true);
  };
  /* программа принята: упражнение с весом тела меняется в её днях на первую замену с теми же подходами; где замена уже стоит, подходы прибавляются к ней.
     Вернуть — дни программы, какими они были до замены */
  const swapOut = (id: string, to: Swap) => saveCfg(r => {
    if (to.def && !r.ex[to.id]) r.ex[to.id] = C.clone(to.def);
    const P = r.program; if (!P || !P.slots) return;
    for (const sl of Object.keys(P.slots)) {
      const L = P.slots[sl] || [], i = L.findIndex(e => e.ex === id), j = L.findIndex(e => e.ex === to.id);
      if (i < 0) continue;
      if (j >= 0) { L[j] = Object.assign({}, L[j], { n: (+L[j].n! || 0) + (+L[i].n! || 0) }); L.splice(i, 1); } else L[i] = Object.assign({}, L[i], { ex: to.id });
    }
  });
  const swapBack = (id: string) => saveCfg(r => { if (r.program && o.away[id]) r.program.slots = C.clone(o.away[id].slots); });
  const setReps = async (id: string, el: El) => {
    const n = toInt(el.value);
    if (el.value.trim() === '' || n == null || n < 0) { if (el.value.trim()) toast('Нужно число повторов'); delete o.reps[id]; render(true); return; }
    o.reps[id] = n;
    if (n < lo(id) && !o.away[id]) {
      const sw = C.swapsFor(cfg, id, []), to = sw.same[0] || sw.near[0], was = S.cfgRaw && S.cfgRaw.program ? C.clone(S.cfgRaw.program.slots) : null;
      if (to && was && (await swapOut(id, to))) o.away[id] = { to: to.id, slots: was };
    } else if (n >= lo(id) && o.away[id]) { if (await swapBack(id)) delete o.away[id]; }
    if (!o.away[id]) await fit(id, bw);
    S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null; render(true);
  };
  const bodyRow = (id: string) => {
    const n = o.reps[id], away = o.away[id] && o.away[id].to;
    const line = away ? 'меньше ' + lo(id) + ' — пока вместо них «' + C.exName(S.cfg, away) + '»'
      : n == null ? 'сколько раз подряд получается сейчас' : !bw ? 'укажи вес тела — старт посчитается от него' : startLine(id);
    return h('div', { class: 'kw-row' }, h('div', { class: 'kw-n' }, C.exName(cfg, id)),
      h('input', { class: 'num sm', type: 'text', inputmode: 'numeric', id: 'bw-reps-' + id, placeholder: 'раз', 'aria-label': 'Сколько раз подряд: ' + C.exName(cfg, id), value: n != null ? String(n) : '', onchange: e => setReps(id, e.target) }),
      h('div', { class: 'kw-out sub', id: 'bw-out-' + id, text: line }));
  };
  /* каждый блок шага — отдельной карточкой: шаг веса, упражнения с весом тела, веса упражнений (просьба владельца, 26 ноября 2026) */
  const bodyBox = bodyIds.length ? h('div', { class: 'onb-box' },
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Упражнения с весом тела'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Вес тела и сколько раз подряд получается.'),
    h('div', { class: 'row', id: 'onb-bw', style: 'flex-wrap:nowrap;gap:8px;margin-bottom:8px' }, h('span', { class: 'grow', style: 'min-width:0' }, 'Вес тела'),
      h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'onb-bw-kg', placeholder: 'кг', 'aria-label': 'Вес тела, кг', value: bw ? C.fmt(bw, 1) : '', onchange: e => setBw(e.target) }), h('span', { class: 'sub', style: 'min-width:96px' }, 'кг')),
    h('div', { class: 'kw', id: 'onb-body' }, bodyIds.map(bodyRow))) : null;
  const head = h('div', { class: 'kw-row kw-head' }, h('span', null, 'Упражнение'), h('span', null, 'Рабочий вес, кг'), h('span', null, 'Повторов'), h('span', null, 'Разовый максимум, кг'), h('span', null, 'Что возьмёт дневник'));
  const next = () => {
    const miss = gears.filter(g => !o.steps[g]);
    if (miss.length) { toast('Укажи шаг веса: ' + C.list(miss.map(g => cfg.gear[g].n.toLowerCase()))); const el = $('onb-step-' + miss[0]); if (el) el.focus(); return; }
    to('done');
  };
  return [frame('Веса', null, [
    h('div', { class: 'onb-box' }, h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Шаг веса'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Прибавка веса на снаряде в твоём зале.'),
    h('div', { class: 'stack', id: 'onb-gear', style: 'gap:6px' }, gears.map(g => h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' },
      h('span', { class: 'grow', style: 'min-width:0' }, cfg.gear[g].n),
      h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'onb-step-' + g, placeholder: 'кг', 'aria-label': 'Шаг веса, кг: ' + cfg.gear[g].n, value: o.steps[g] ? C.fmt(cfg.gear[g].step, 3) : '', onchange: e => setStep(g, e.target.value) }),
      o.steps[g] ? h('span', { class: 'sub', style: 'min-width:96px' }, 'кг') : h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-step-usual-' + g, style: 'min-width:96px', onclick: () => setStep(g, String(usual(g))) }, 'обычно ' + C.fmt(usual(g))))))),
    bodyBox,
    h('div', { class: 'onb-box' }, h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Веса упражнений'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Что знаешь: рабочий вес с повторами или разовый максимум.'),
    h('div', { class: 'kw', id: 'known' }, head, ids.filter(id => !bodyIds.includes(id)).map(row)))],
    () => { S.ui.prog = null; to('prog'); }, h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: next }, 'Дальше'))];
}

/* программа готова: дни с весами старта — той же каруселью, под ними фигура с недельной нагрузкой мышц (просьба владельца, 25 ноября 2026) */
function vDone(): View {
  const cfg = D.cfg, cur = C.currentSlots(D.W, cfg), t = C.progTally(cfg, cur);
  const tip = (x: string, y: string) => h('div', { class: 'why' }, h('b', null, x), h('div', { class: 'sub' }, y));
  return [frame('Программа готова', null, [
    dayCarousel(C.SLOTS.map(sl => progDay(cfg, sl, cur[sl.id], t.load[sl.id], null, null, null))),
    Object.keys(O!.away).filter(id => cfg.ex[id] && cfg.ex[O!.away[id].to]).map(id => tip('Вместо «' + C.exName(cfg, id) + '» пока «' + C.exName(cfg, O!.away[id].to) + '»',
      'У тебя пока ' + O!.reps[id] + ' повторов, нужно от ' + C.rangeOf(D.W, cfg, id)[0] + '. Вернёшь кнопкой «Заменить» на «Программе».')),
    h('div', { id: 'onb-body-map', style: 'margin-top:14px' }, h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Нагрузка мышц за неделю: ' + loadText(total(t.load))),
      bodyMap(t.pv, { z: cfg.zones, ignore: cfg.ignore, sel: null, pick: null }))],
    () => to('weights'), O!.kind === 'new' ? h('button', { type: 'button', class: 'btn primary', id: 'onb-go', onclick: () => finish('workout') }, 'Открыть тренировку') : h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('memo') }, 'Дальше'))];
}
/* последний шаг — памятка: на чём держать внимание в подходе (просьба владельца, 26 ноября 2026); та же встречает каждую тренировку */
function vMemo(): View {
  return [frame('Памятка', null, [memoCards()], () => to('done'),
    h('button', { type: 'button', class: 'btn primary', id: 'onb-go', onclick: () => finish('workout') }, 'Открыть первую тренировку'))];
}

/** Мастер вместо пустого «Обзора» (kind 'first') или вместо «Программы» (kind 'new', onbNew) */
export function vOnboard(kind: Onb['kind'] = 'first'): View {
  if (!O || O.gen !== S.gen || O.kind !== kind) { shown = ''; O = blank(kind, 'even'); }
  const v = O.step === 'goal' ? vGoal() : O.step === 'care' ? vCare() : O.step === 'paste' ? vPaste() : O.step === 'prog' ? vProg() : O.step === 'weights' ? vWeights() : O.step === 'done' ? vDone() : O.step === 'memo' ? vMemo() : vStart();
  return v;
}
