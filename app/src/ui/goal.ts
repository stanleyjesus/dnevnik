/* Выбор сценария сборки на экране «Программа» (функция 39 в docs/05). В эталоне это один список «Как собрать»
   на все сценарии сразу; здесь — кнопки цели и один уточняющий список, который зависит от цели
   (решение владельца, 19 ноября 2026). Расчёт не меняется: выбор сводится к тому же значению режима, что и пункт
   прежнего списка — 'manual', 'even', 'm:<группа мышц>', 's', 'l:<базовое>'. Одного значения в эталоне нет:
   's:<базовое>' — сила в одном базовом (решение владельца, 19 ноября 2026). */
import { C, h } from './dom.ts';
import { STRONG } from '../core/strength.ts';
import type { Cfg } from '../core/index.ts';
import type { ProgUi } from './types.ts';

/** Цель программы: масса (поровну или с группой мышц в приоритете), сила (все базовые два раза в неделю или одно базовое три раза), гибрид (пауэрбилдинг вокруг одного базового), вручную */
export type Goal = 'mass' | 'force' | 'mix' | 'hand';
const GOALS: [Goal, string][] = [['mass', 'Масса'], ['force', 'Сила'], ['mix', 'Гибрид'], ['hand', 'Вручную']];
/** Какой цели принадлежит режим сборки */
export const goalOf = (focus: string): Goal => focus === 'manual' ? 'hand' : focus === 's' || focus.startsWith('s:') ? 'force' : focus.startsWith('l:') ? 'mix' : 'mass';
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
/** Режим, которого больше не из чего собрать: базовое убрано из справочника или перестало считаться по процентам. Такой выбор возвращается к «Равномерно» */
export const lostMode = (focus: string, lifts: string[]) => focus === 's' ? !lifts.length : liftOf(focus) != null && !lifts.includes(liftOf(focus)!);

/* Слова о днях режима при выбранном числе дней в неделе (в эталоне дней всегда три, и слова — как при трёх).
   Сила в одном базовом идёт не больше трёх дней; у гибрида при двух днях отдельного дня «на массу» нет — упражнение на массу стоит в лёгкий день */
/** Сила в одном базовом в пояснении к новой программе */
export const soloText = (n: number) => n >= 4 ? 'Оно идёт три дня из четырёх: тяжёлый день 4 × 4 с весом по запасу и два лёгких дня.'
  : n === 2 ? 'Оно идёт в каждой тренировке: тяжёлый день 4 × 4 с весом по запасу и лёгкий день.'
  : 'Оно идёт в каждой тренировке: тяжёлый день 4 × 4 с весом по запасу и лёгкие дни в остальные.';
/** Сила в одном базовом в строке о действующей программе: on — в скольких днях недели движение стоит сейчас (от двух), n — сколько в неделе дней.
    Считается по тому, что стоит в днях, а не по выбранному числу дней: после смены числа дней действующая программа остаётся прежней */
export const soloNow = (on: number, n: number) => (on >= n ? 'оно идёт в каждой тренировке' : 'оно идёт ' + (on === 2 ? 'два дня' : 'три дня') + ' из ' + (n === 3 ? 'трёх' : 'четырёх'))
  + ' — тяжёлый день и ' + (on === 2 ? 'лёгкий' : on >= n ? 'лёгкие' : 'два лёгких');
/** Гибрид в пояснении к новой программе */
export const mixText = (n: number) => n === 2 ? 'Оно идёт оба дня на силу — 4 × 4 с весом по запасу и лёгкий день; упражнение на массу стоит в лёгкий день.'
  : 'Оно идёт два дня на силу — 4 × 4 с весом по запасу и лёгкий день — и один день на массу.';

/** Режим сборки одной строкой — для лимита недели, найденного по времени: «остальные базовые» входят в него только там, где на сборку влияют */
export const modeKey = (st: { focus: string; others: string }) => st.focus + (liftOf(st.focus) ? '|' + st.others : '');

/** Кнопки цели и уточняющий список для строки выбора сценария; pick — выбрать режим сборки по его значению.
    Нажатие на уже выбранную цель ничего не делает: черновик с правками вручную остаётся */
export function goalPicker(st: ProgUi, cfg: Cfg, lifts: string[], pick: (focus: string) => void) {
  const now = goalOf(st.focus);
  /* выбор под целью запоминается: вернувшись к ней, попадаешь на те же мышцы или то же базовое */
  if (now === 'mass') st.mass = st.focus; else if (now === 'mix') st.mix = st.focus; else if (now === 'force') st.force = st.focus;
  const to: Record<Goal, string> = { mass: st.mass || 'even', force: st.force && !lostMode(st.force, lifts) ? st.force : 's', mix: st.mix && lifts.includes(st.mix.slice(2)) ? st.mix : 'l:' + lifts[0], hand: 'manual' };
  /* сила и гибрид строятся вокруг базовых: без базовых в справочнике этих целей нет */
  const goals = GOALS.filter(g => lifts.length || (g[0] !== 'force' && g[0] !== 'mix'));
  const list = (id: string, label: string, items: string[][]) => h('label', { class: 'f' }, h('span', null, label),
    h('select', { id, onchange: e => pick(e.target.value) }, items.map(o => h('option', { value: o[0], selected: o[0] === st.focus, text: o[1] }))));
  return [
    h('div', { class: 'pf', id: 'pg' }, h('span', null, 'Цель'), h('div', { class: 'seg multi', role: 'group', 'aria-label': 'Цель программы' },
      goals.map(g => h('button', { type: 'button', id: 'pg-' + g[0], 'aria-pressed': String(g[0] === now), onclick: () => { if (g[0] !== now) pick(to[g[0]]); } }, g[1])))),
    now === 'mass' ? list('pm', 'Мышцы в приоритете', [['even', 'Всем поровну']].concat(C.PRIOS.map(g => ['m:' + g.id, g.n])))
      : now === 'mix' ? list('pl', 'Базовое в приоритете', lifts.map(id => ['l:' + id, C.exName(cfg, id)]))
      : now === 'force' ? list('ps', 'Базовые на силу', [['s', 'Все базовые']].concat(lifts.map(id => ['s:' + id, C.exName(cfg, id)]))) : null
  ];
}
