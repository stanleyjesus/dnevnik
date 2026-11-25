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
   (общие сценарии сверки с артефактом) пустой «Обзор» прежний. «Пропустить» возвращает прежний пустой «Обзор» до перезагрузки. */
import { $, C, h, toInt, toNum } from './dom.ts';
import { PT, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { saveCfg } from './storage.ts';
import { D, go, render } from './render.ts';
import { acceptProgram, loadText, progDay } from './program.ts';
import { builtDay } from './builtday.ts';
import { bodyMap } from './bodymap.ts';   // фигура с нагрузкой мышц на последнем шаге (просьба владельца, 25 ноября 2026)   // у программы, которую собрал дневник, только «Заменить» (решение владельца, 25 ноября 2026)
import { careBox, pairsRow } from './care.ts';   // что беречь и дни подряд (решение владельца, 25 ноября 2026)
import { progDraft, progLifts } from './draft.ts';
import { goalPicker, modeBudget } from './goal.ts';
import { TIMES, timeOf } from './fit.ts';
import { weekDays } from './platform.ts';
import { importBox, pickBackup } from './importer.ts';
import { DAY_COUNTS, useDays } from '../core/days.ts';
import { appRules, withBody } from '../core/rules.ts';
import { pasteDays, pasteMatch } from '../core/paste.ts';
import type { PasteDay } from '../core/paste.ts';
import type { ExDef, ProgSlots, Swap } from '../core/types.ts';
import type { El, Kid, View } from './types.ts';

type Step = 'start' | 'goal' | 'care' | 'paste' | 'prog' | 'weights' | 'done';
/** Программа из текста: text — как вставлен, days — разбор, pick — что взять в строке «день-строка» (id, '' — не брать, NEW — новое упражнение),
    gear — снаряд нового упражнения, fill — разбор ещё не разложен в черновик */
interface Paste { text: string; days: PasteDay[] | null; pick: Record<string, string>; gear: Record<string, string>; fill: boolean }
/** Мастер открытого профиля: gen — поколение профиля (storage.ts, openProfile), path — собрать, своя или текстом, focus — режим сборки,
    steps — снаряды, шаг которых атлет ввёл в мастере, took — программа принята в мастере;
    reps — сколько раз подряд атлет делает упражнение с весом тела, away — такие упражнения, которые пока заменены: id → чем и дни программы до замены,
    day — какой день программы открыт в карусели шага «Программа» (с 0) */
interface Onb { gen: number; step: Step; path: 'build' | 'own' | 'paste'; focus: string; steps: Record<string, boolean>; took: boolean; done: boolean; paste: Paste; reps: Record<string, number>; away: Record<string, { to: string; slots: ProgSlots }>; day: number }
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

const seq = (o: Onb): Step[] => o.path === 'own' ? ['start', 'prog', 'weights', 'done'] : o.path === 'paste' ? ['start', 'paste', 'prog', 'weights', 'done'] : ['start', 'goal', 'care', 'prog', 'weights', 'done'];
const to = (step: Step) => { O!.step = step; O!.day = 0; render(); };   // на шаг «Программа» мастер приходит к первому дню
function skip() { skipped.add(S.profile); O!.done = true; render(); }
/* мастер закончен: дальше — обычные вкладки */
function finish(view: string) { O!.done = true; S.ui.plan = null; go(view); }
/* шаг мастера: номер, заголовок, пояснение в одну-две строки, содержимое и кнопки внизу */
let shown = '';   // шаг, который на экране: появление шага (data-enter) — только при переходе на него, а не при каждой перерисовке внутри шага
function frame(title: string, text: string | null, body: Kid[], back: (() => void) | null, next: Kid) {
  const o = O!, all = seq(o), n = all.indexOf(o.step) + 1, enter = shown !== o.step;
  shown = o.step;
  return h('section', { class: 'card', id: 'onb', 'data-enter': enter ? '' : null, style: 'max-width:760px;margin:0 auto;width:100%' },
    h('div', { class: 'sec-h' }, h('div', null, h('div', { class: 'eyebrow', id: 'onb-n' }, 'Шаг ' + n + ' из ' + all.length), h('h2', null, title)),
      o.step === 'start' || o.step === 'goal' || o.step === 'care' || o.step === 'paste' || o.step === 'prog' ? h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-skip', onclick: skip }, 'Пропустить')
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
  return [frame('С чего начнём?', 'Записи хранятся только на этом устройстве.', [
    h('div', { class: 'stack', style: 'gap:8px' },
      opt('onb-build', 'Собрать программу', 'Под твою цель и время.', () => { O!.path = 'build'; if (O!.focus === 'manual') O!.focus = 'even'; S.ui.prog = null; to('goal'); }),
      opt('onb-own', 'У меня своя программа', 'Свои упражнения по дням.', () => { O!.path = 'own'; O!.focus = 'manual'; S.ui.prog = null; to('prog'); }),
      opt('onb-paste', 'Вставить программу текстом', 'Из заметок — дневник разложит сам.', () => { O!.path = 'paste'; O!.focus = 'manual'; to('paste'); }),
      opt('onb-import', 'Перенести записи из файла', 'Резервная копия с другого устройства.', pickBackup)),
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
  return [frame('Программа текстом', 'Дни — строками «День 1», «День 2», под ними упражнения по одному в строке.', [
    h('textarea', { id: 'onb-text', rows: 9, placeholder: EXAMPLE, 'aria-label': 'Программа текстом', oninput: e => { P.text = e.target.value; } }, P.text),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn', id: 'onb-parse', onclick: parse }, 'Разобрать')),
    days ? h('div', { id: 'onb-parsed', style: 'margin-top:12px' },
      h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'Дней: ' + P.days!.length + '.' + (P.days!.length > 4 ? ' Возьмутся первые четыре.' : P.days!.length < 2 ? ' Второй заполнишь дальше.' : '') + ' Незнакомое выбери из списка.'),
      days.map((d, n) => h('div', { style: 'margin-bottom:10px' }, h('b', null, 'День ' + (n + 1) + (d.name ? ' · ' + d.name : '')), d.items.map((it, i) => row(n, it, i))))) : null],
    () => to('start'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', disabled: !chosen, onclick: next }, 'Дальше'))];
}

function vGoal(): View {
  const cfg = D.cfg, d = draft(), st = d.st, time = timeOf(S.cfgRaw);
  return [frame('Цель и время', null, [
    h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' },
      goalPicker(st, cfg, progLifts(cfg), d.pick, true),
      daysRow(),
      pairsRow(),
      h('label', { class: 'f' }, h('span', null, 'Время на тренировку'), h('select', { id: 'pt', onchange: async e => { const v = +e.target.value; await saveCfg(raw => { if (v) raw.time = v; else delete raw.time; }); if (!v) { st.budget = modeBudget(st.focus, cfg.caps.week); delete st.keep; } st.draft = null; render(true); } },
        [0].concat(TIMES.includes(time) || !time ? TIMES : TIMES.concat(time).sort((a, b) => a - b)).map(v => h('option', { value: v, selected: v === time, text: v ? 'до ' + C.fmtDur(v) : 'не ограничено' })))))],
    () => to('start'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('care') }, 'Дальше'))];
}

/* что беречь: больные места и стоп-упражнения; ничего не отмечать — тоже ответ */
function vCare(): View {
  return [frame('Что беречь', 'Нечего отмечать — жми «Дальше».', [careBox()],
    () => to('goal'), h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('prog') }, 'Дальше'))];
}

/* дни программы — карусель (просьба владельца, 25 ноября 2026, по присланному образцу): открытый день — карточка по центру, соседние —
   узкие края по бокам, связанные с ней перемычкой, дальние спрятаны. Листать — пальцем вбок, нажатием на край, точками над днями,
   стрелками на клавиатуре; дни не идут по кругу: у первого дня слева пусто. Открытый день стоит в потоке и задаёт высоту карусели,
   края — 84% её высоты; смену дня ведут переходы стилей, высоту — анимация (Web Animations), и в разметке от анимации ничего не остаётся.
   Страница перерисовывается целиком (замена упражнения, правка подходов), поэтому открытый день хранится в мастере (O.day),
   и после перерисовки карусель сразу стоит на нём */
const SPRING = 'linear(0, 0.055, 0.17, 0.3, 0.43, 0.545, 0.643, 0.723, 0.787, 0.836, 0.876, 0.906, 0.929, 0.947, 0.96, 0.97, 0.978, 0.984, 0.988, 0.991, 0.993, 0.995, 0.996, 0.997, 1)';   // пружина образца (жёсткость 220, затухание 26, масса 0.75) — 0.5 с; та же в style.css
function dayCarousel(days: HTMLElement[]): Kid[] {
  const o = O!, n = days.length;
  o.day = Math.max(0, Math.min(o.day, n - 1));
  const slots = days.map((d, i) => h('div', { class: 'pslot', onclick: () => open(i) },
    h('div', { class: 'pclip' }, d), h('span', { class: 'plab', 'aria-hidden': 'true' }, C.SLOTS[i].n), h('span', { class: 'pnotch', 'aria-hidden': 'true' })));
  const dots = C.SLOTS.slice(0, n).map((sl, i) => h('button', { type: 'button', id: 'onb-dot-' + sl.id, 'aria-label': sl.n, onclick: () => open(i) }));
  const place = () => {                                                      // где какой день: −2 и 2 — дальше краёв, спрятаны
    slots.forEach((s, i) => { s.setAttribute('data-off', String(Math.max(-2, Math.min(2, i - o.day)))); (s.firstChild as HTMLElement).inert = i !== o.day; });
    dots.forEach((b, i) => b.setAttribute('aria-current', i === o.day ? 'true' : 'false'));
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, ease = CSS.supports('transition-timing-function', SPRING) ? SPRING : 'cubic-bezier(.25, .8, .25, 1)';
  const open = (i: number) => {
    if (i < 0 || i >= n || i === o.day) return;
    const was = slots.map(s => s.offsetHeight);
    o.day = i; place();
    if (!still) slots.forEach((s, j) => { const now = s.offsetHeight; if (now !== was[j]) s.animate([{ height: was[j] + 'px' }, { height: now + 'px' }], { duration: 500, easing: ease }); });
    const top = (bar || car).getBoundingClientRect().top;                    // день бывает длиннее экрана: начало карусели — снова на виду
    if (top < 0) window.scrollBy({ top: top - 12, behavior: still ? 'auto' : 'smooth' });
  };
  /* палец вбок: карусель идёт за ним, у первого и последнего дня — с сопротивлением; отпустил дальше порога — соседний день.
     Палец вниз — обычная прокрутка страницы (touch-action: pan-y); с полей ввода карусель не листается */
  let id = -1, x0 = 0, y0 = 0, dx = 0, drag = false, moved = -1e9;
  const down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button > 0 || (e.target as Element).closest('input, select, textarea')) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false;
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!drag) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { id = -1; return; }
      if (Math.abs(mx) < 8) return;
      drag = true; car.classList.add('drag'); getSelection()?.removeAllRanges();
      try { car.setPointerCapture(id); } catch { /* указатель уже отпущен */ }
    }
    dx = (o.day === 0 && mx > 0) || (o.day === n - 1 && mx < 0) ? mx / 3 : mx;
    car.style.setProperty('--dx', dx + 'px');
  };
  const up = (e: PointerEvent, go: boolean) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!drag) return;
    drag = false; moved = performance.now(); car.classList.remove('drag'); car.style.removeProperty('--dx'); if (!car.style.length) car.removeAttribute('style');
    const far = Math.min(70, car.clientWidth * .18);
    if (go && dx < -far) open(o.day + 1); else if (go && dx > far) open(o.day - 1);
  };
  const key = (e: KeyboardEvent) => {
    const t = e.target as Element;
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || (t !== car && !t.closest('.pdots'))) return;
    e.preventDefault(); open(o.day + (e.key === 'ArrowRight' ? 1 : -1));
    if (t !== car) dots[o.day].focus();
  };
  const car = h('div', { class: 'pcar', id: 'onb-days', role: 'group', 'aria-roledescription': 'карусель', 'aria-label': 'Дни программы', tabindex: '0',
    onpointerdown: down, onpointermove: move, onpointerup: (e: PointerEvent) => up(e, true), onpointercancel: (e: PointerEvent) => up(e, false), onkeydown: key }, slots);
  car.addEventListener('click', e => { if (performance.now() - moved < 350) { moved = -1e9; e.stopPropagation(); e.preventDefault(); } }, true);   // палец листал, а не нажимал: нажатие сразу после — не нажатие
  const bar = n > 1 ? h('div', { class: 'pdots', onkeydown: key }, dots) : null;
  place();
  return [bar, car];   // точки — над днями: день бывает длиннее экрана
}

function vProg(): View {
  const cfg = D.cfg, d = draft(), pr = d.pr, P = cfg.program, own = O!.path !== 'build', text = O!.path === 'paste';
  const accept = async () => {
    O!.step = 'weights'; O!.took = true;                                // до перерисовки внутри acceptProgram: мастер не должен закончиться, увидев программу
    await acceptProgram(pr, d.manual ? pr.name : null);
    if (!S.cfg.program) { O!.step = 'prog'; O!.took = false; }
    render();
  };
  const next = d.changed ? h('button', { type: 'button', class: 'btn primary', id: 'onb-accept', onclick: accept }, 'Принять программу')
    : P ? h('button', { type: 'button', class: 'btn primary', id: 'onb-next', onclick: () => to('weights') }, 'Дальше')
    : h('button', { type: 'button', class: 'btn primary', id: 'onb-accept', disabled: true }, 'Принять программу');
  return [frame(own ? 'Твоя программа' : 'Программа', null, [   // на шаге только дни программы (просьба владельца, 25 ноября 2026)
    own ? h('div', { class: 'row', style: 'align-items:flex-end;margin-bottom:10px' }, daysRow()) : null,
    dayCarousel(C.SLOTS.map(sl => own ? progDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], null, d.edit, null) : builtDay(pr.cfg, sl, pr.slots[sl.id], pr.after.load[sl.id], d.edit)))],
    () => to(text ? 'paste' : own ? 'start' : 'care'), next)];
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
  const bodyBox = bodyIds.length ? [
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Упражнения с весом тела'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Вес тела и сколько раз подряд получается.'),
    h('div', { class: 'row', id: 'onb-bw', style: 'flex-wrap:nowrap;gap:8px;margin-bottom:8px' }, h('span', { class: 'grow', style: 'min-width:0' }, 'Вес тела'),
      h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'onb-bw-kg', placeholder: 'кг', 'aria-label': 'Вес тела, кг', value: bw ? C.fmt(bw, 1) : '', onchange: e => setBw(e.target) }), h('span', { class: 'sub', style: 'min-width:96px' }, 'кг')),
    h('div', { class: 'kw', id: 'onb-body', style: 'margin-bottom:16px' }, bodyIds.map(bodyRow))] : null;
  const head = h('div', { class: 'kw-row kw-head' }, h('span', null, 'Упражнение'), h('span', null, 'Рабочий вес, кг'), h('span', null, 'Повторов'), h('span', null, 'Разовый максимум, кг'), h('span', null, 'Что возьмёт дневник'));
  const next = () => {
    const miss = gears.filter(g => !o.steps[g]);
    if (miss.length) { toast('Укажи шаг веса: ' + C.list(miss.map(g => cfg.gear[g].n.toLowerCase()))); const el = $('onb-step-' + miss[0]); if (el) el.focus(); return; }
    to('done');
  };
  return [frame('Веса', null, [
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Шаг веса'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Прибавка веса на снаряде в твоём зале.'),
    h('div', { class: 'stack', id: 'onb-gear', style: 'gap:6px;margin-bottom:16px' }, gears.map(g => h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' },
      h('span', { class: 'grow', style: 'min-width:0' }, cfg.gear[g].n),
      h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'onb-step-' + g, placeholder: 'кг', 'aria-label': 'Шаг веса, кг: ' + cfg.gear[g].n, value: o.steps[g] ? C.fmt(cfg.gear[g].step, 3) : '', onchange: e => setStep(g, e.target.value) }),
      o.steps[g] ? h('span', { class: 'sub', style: 'min-width:96px' }, 'кг') : h('button', { type: 'button', class: 'btn ghost sm', id: 'onb-step-usual-' + g, style: 'min-width:96px', onclick: () => setStep(g, String(usual(g))) }, 'обычно ' + C.fmt(usual(g)))))),
    bodyBox,
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Веса упражнений'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Что знаешь: рабочий вес с повторами или разовый максимум.'),
    h('div', { class: 'kw', id: 'known' }, head, ids.filter(id => !bodyIds.includes(id)).map(row))],
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
    () => to('weights'), h('button', { type: 'button', class: 'btn primary', id: 'onb-go', onclick: () => finish('workout') }, 'Открыть первую тренировку'))];
}

/** Мастер вместо пустого «Обзора» */
export function vOnboard(): View {
  if (!O || O.gen !== S.gen) O = { gen: S.gen, step: 'start', path: 'build', focus: 'even', steps: {}, took: false, done: false, paste: { text: '', days: null, pick: {}, gear: {}, fill: false }, reps: {}, away: {}, day: 0 };
  const v = O.step === 'goal' ? vGoal() : O.step === 'care' ? vCare() : O.step === 'paste' ? vPaste() : O.step === 'prog' ? vProg() : O.step === 'weights' ? vWeights() : O.step === 'done' ? vDone() : vStart();
  return v;
}
