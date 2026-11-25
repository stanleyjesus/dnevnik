/* Выбор сценария сборки на экране «Программа» (функция 39 в docs/05). В эталоне это один список «Как собрать»
   на все сценарии сразу; здесь — кнопки цели и один уточняющий список, который зависит от цели
   (решение владельца, 19 ноября 2026). Расчёт не меняется: выбор сводится к тому же значению режима, что и пункт
   прежнего списка — 'manual', 'even', 'm:<группа мышц>', 's', 'l:<базовое>'. Одного значения в эталоне нет:
   's:<базовое>' — сила в одном базовом (решение владельца, 19 ноября 2026).
   С днями «День N» (решение владельца, 24 ноября 2026, пункт 8 вопросов сборки) «Сила» и «Гибрид» выбирают цель из одного списка
   (core/strength.ts, TARGETS): под «Силой» — «Пауэрлифтерская тройка» ('p', когда в неделе от трёх дней) или одно упражнение ('s:<id>'),
   под «Гибридом» — одно из тех же восьми ('l:<id>'). «Все базовые» ('s') с днями «День N» не предлагаются. */
import { C, h } from './dom.ts';
import { DAY_H, ISO, STRONG, TRIAD_DAYS } from '../core/strength.ts';
import { appRules, targetName } from '../core/rules.ts';
import type { Cfg } from '../core/index.ts';
import type { ProgUi } from './types.ts';

/** Цель программы: масса (поровну или с группой мышц в приоритете), сила (все базовые два раза в неделю или одно базовое три раза), гибрид (пауэрбилдинг вокруг одного базового), вручную */
export type Goal = 'mass' | 'force' | 'mix' | 'hand';
const GOALS: [Goal, string][] = [['mass', 'Масса'], ['force', 'Сила'], ['mix', 'Гибрид'], ['hand', 'Вручную']];
/** Какой цели принадлежит режим сборки */
export const goalOf = (focus: string): Goal => focus === 'manual' ? 'hand' : focus === 's' || focus === 'p' || focus.startsWith('s:') ? 'force' : focus.startsWith('l:') ? 'mix' : 'mass';
/** Базовое, вокруг которого выбран режим: у гибрида ('l:<базовое>') и у силы в одном базовом ('s:<базовое>') */
export const liftOf = (focus: string) => focus.startsWith('l:') || focus.startsWith('s:') ? focus.slice(2) : null;

/** Смена режима сборки. Цель «Сила» приходит со своим лимитом недели (подсобке в ней отведено меньше);
    уходя от неё, лимит возвращается к тому, что стоял до неё: 80 — число силового режима, а не выбор атлета для остальных.
    Между «всеми базовыми» и одним базовым лимит не меняется. modeBudget — лимит, с которого режим начинается, когда его не задаёт время на тренировку */
export const modeBudget = (focus: string, week: number) => goalOf(focus) === 'force' ? Math.min(STRONG.budget, week) : week;
export function setMode(st: ProgUi, focus: string, week: number) {
  const to = goalOf(focus) === 'force', from = goalOf(st.focus) === 'force';
  if (to && !from) { st.keep = st.budget; st.budget = modeBudget(focus, week); }
  else if (!to && from) { st.budget = st.keep ?? week; delete st.keep; }
  st.focus = focus;
}
/** Пауэрлифтерская тройка предлагается с днями «День N», когда в неделе хватает дней: каждому движению свой тяжёлый день */
export const triadOk = () => appRules() && C.SLOTS.length >= TRIAD_DAYS;
/** «Сила», выбранная кнопкой: с таблицей дней эталона — все базовые; с днями «День N» — тройка, а при двух днях — первое упражнение списка */
export const forceMode = (lifts: string[]) => !appRules() ? 's' : triadOk() ? 'p' : 's:' + lifts[0];
/** Режим, которого больше не из чего собрать: базовое убрано из справочника или перестало считаться по процентам. Такой выбор возвращается к «Равномерно».
    С днями «День N» не собрать и «Все базовые» (их больше нет в списке), и тройку при двух днях: «Сила» остаётся «Силой» (modeAfter) */
export const lostMode = (focus: string, lifts: string[]) => focus === 's' ? appRules() || !lifts.length : focus === 'p' ? !triadOk() : liftOf(focus) != null && !lifts.includes(liftOf(focus)!);
/** Чем заменить режим, которого не собрать */
export const modeAfter = (focus: string, lifts: string[]) => appRules() && goalOf(focus) === 'force' && lifts.length ? forceMode(lifts) : 'even';

/* Слова о днях режима при выбранном числе дней в неделе (в эталоне дней всегда три, и слова — как при трёх).
   Сила в одном базовом идёт не больше трёх дней (с днями «День N» — два); у гибрида при двух днях отдельного дня «на массу» нет — упражнение на массу стоит в лёгкий день */
/** Тяжёлый день движения: с днями «День N» — 3 × 4, у изоляции в силовой роли — 3 × 6 («Новая схема», 24 ноября 2026; core/strength.ts, DAY_H и ISO);
    с таблицей дней эталона — 4 × 4 */
const heavy = (iso?: boolean) => iso ? ISO.sets + ' × ' + ISO.reps : appRules() ? DAY_H.sets + ' × ' + DAY_H.reps : '4 × 4';
/** Сила в одном базовом в пояснении к новой программе; iso — изоляция: она идёт два дня, а не три. С днями «День N» у всех движений два дня —
    тяжёлый и лёгкий (решение владельца, 25 ноября 2026; core/strength.ts, SOLO) */
export const soloText = (n: number, iso?: boolean) => iso || appRules() ? (n === 2 ? 'Оно идёт в каждой тренировке' : 'Оно идёт два дня из ' + (n === 3 ? 'трёх' : 'четырёх')) + ': тяжёлый день ' + heavy(iso) + ' с весом по запасу и лёгкий день.'
  : n >= 4 ? 'Оно идёт три дня из четырёх: тяжёлый день 4 × 4 с весом по запасу и два лёгких дня.'
  : n === 2 ? 'Оно идёт в каждой тренировке: тяжёлый день 4 × 4 с весом по запасу и лёгкий день.'
  : 'Оно идёт в каждой тренировке: тяжёлый день 4 × 4 с весом по запасу и лёгкие дни в остальные.';
/** Сила в одном базовом в строке о действующей программе: on — в скольких днях недели движение стоит сейчас (от двух), n — сколько в неделе дней.
    Считается по тому, что стоит в днях, а не по выбранному числу дней: после смены числа дней действующая программа остаётся прежней */
export const soloNow = (on: number, n: number) => (on >= n ? 'оно идёт в каждой тренировке' : 'оно идёт ' + (on === 2 ? 'два дня' : 'три дня') + ' из ' + (n === 3 ? 'трёх' : 'четырёх'))
  + ' — тяжёлый день' + (on === 2 ? ' и лёгкий' : appRules() ? ', лёгкий и средний' : on >= n ? ' и лёгкие' : ' и два лёгких');
/** Гибрид в пояснении к новой программе */
export const mixText = (n: number, iso?: boolean) => n === 2 ? 'Оно идёт оба дня на силу — ' + heavy(iso) + ' с весом по запасу и лёгкий день; упражнение на массу стоит в лёгкий день.'
  : 'Оно идёт два дня на силу — ' + heavy(iso) + ' с весом по запасу и лёгкий день — и один день на массу.';

/** Режим сборки одной строкой — для лимита недели, найденного по времени: «остальные базовые» входят в него только там, где на сборку влияют
    (с днями «День N» под «Силой» их нет: остальные базовые там — обычные упражнения) */
/** «Остальные базовые» в «Гибриде» для принятой программы P. С днями «День N» вариантов два — «Как подсобка» и «Растут как раньше» (решение владельца,
    25 ноября 2026): программа, принятая с «Поддержанием» или без выбора, показывается с «Как подсобка», а в ней базовые идут, как приняты, пока атлет
    не примет новую. С таблицей дней эталона — как в эталоне: поддержание, если не выбрано «растут» */
export const othersOf = (P: { others?: string | null } | null | undefined): ProgUi['others'] => P && P.others === 'grow' ? 'grow' : appRules() ? 'plain' : 'hold';
export const modeKey = (st: { focus: string; others: string }) => st.focus + (st.focus.startsWith('l:') || (st.focus.startsWith('s:') && !appRules()) ? '|' + st.others : '');

/** Кнопки цели и уточняющий список для строки выбора сценария; pick — выбрать режим сборки по его значению.
    Нажатие на уже выбранную цель ничего не делает: черновик с правками вручную остаётся. noHand — без кнопки «Вручную» (онбординг, onboard.ts) */
export function goalPicker(st: ProgUi, cfg: Cfg, lifts: string[], pick: (focus: string) => void, noHand?: boolean) {
  const now = goalOf(st.focus);
  /* выбор под целью запоминается: вернувшись к ней, попадаешь на те же мышцы или то же базовое */
  if (now === 'mass') st.mass = st.focus; else if (now === 'mix') st.mix = st.focus; else if (now === 'force') st.force = st.focus;
  const to: Record<Goal, string> = { mass: st.mass || 'even', force: st.force && !lostMode(st.force, lifts) ? st.force : forceMode(lifts), mix: st.mix && lifts.includes(st.mix.slice(2)) ? st.mix : 'l:' + lifts[0], hand: 'manual' };
  /* (в эталоне нет) с днями «День N» в списках — цели «Силы» и «Гибрида»: упражнение, которого нет в справочнике, называется по встроенному */
  const name = (id: string) => appRules() ? targetName(cfg, id) : C.exName(cfg, id);
  /* сила и гибрид строятся вокруг базовых: без базовых в справочнике этих целей нет */
  const goals = GOALS.filter(g => (lifts.length || (g[0] !== 'force' && g[0] !== 'mix')) && !(noHand && g[0] === 'hand'));   // noHand — онбординг: «своя программа» там выбирается на первом шаге
  const list = (id: string, label: string, items: string[][]) => h('label', { class: 'f' }, h('span', null, label),
    h('select', { id, onchange: e => pick(e.target.value) }, items.map(o => h('option', { value: o[0], selected: o[0] === st.focus, text: o[1] }))));
  return [
    h('div', { class: 'pf', id: 'pg' }, h('span', null, 'Цель'), h('div', { class: 'seg multi', role: 'group', 'aria-label': 'Цель программы' },
      goals.map(g => h('button', { type: 'button', id: 'pg-' + g[0], 'aria-pressed': String(g[0] === now), onclick: () => { if (g[0] !== now) pick(to[g[0]]); } }, g[1])))),
    now === 'mass' ? list('pm', 'Мышцы в приоритете', [['even', 'Всем поровну']].concat(C.PRIOS.map(g => ['m:' + g.id, g.n])))
      : now === 'mix' ? list('pl', 'Базовое в приоритете', lifts.map(id => ['l:' + id, name(id)]))
      : now === 'force' ? list('ps', 'Базовые на силу', (!appRules() ? [['s', 'Все базовые']] : triadOk() ? [['p', 'Пауэрлифтерская тройка']] : []).concat(lifts.map(id => ['s:' + id, name(id)]))) : null
  ];
}
