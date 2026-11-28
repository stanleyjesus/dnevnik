/* Типы экранов: элементы страницы, состояние, черновики, графики. Исполняемого кода здесь нет.
   Типы данных дневника (тренировка, подход, настройка профиля) — в ../core/types.ts. */
import type { BodyRec, Cfg, Core, CycleCfg, ExDef, GearDef, Muscle, ProgEntry, ProgramCfg, Range, Swap, Workout, Zones } from '../core/index.ts';
import type { dbOver } from './platform.ts';
import type { derive } from './state.ts';

/* ---------- элементы страницы ---------- */

/** Элемент, найденный по id. У полей формы читают value и checked, у раскрывающегося блока — open */
export interface El extends HTMLElement { value: string; checked: boolean; open: boolean; select(): void }
/** Событие поля формы: target — само поле */
export interface FieldEvent extends Event { readonly target: El }
/** Свойства элемента для h() и sv(): обработчики, text, value; всё остальное становится атрибутами */
export interface Attrs {
  onclick?: ((e: MouseEvent) => unknown) | null;
  onchange?: (e: FieldEvent) => unknown;
  oninput?: (e: FieldEvent) => unknown;
  ontoggle?: (e: FieldEvent) => unknown;
  onkeydown?: (e: KeyboardEvent) => unknown;
  [name: string]: unknown;
}
/** Элемент рисунка (svg): в атрибут можно записать и число */
export interface SvgEl extends SVGElement { setAttribute(name: string, value: string | number): void }
/** Отложенное действие: то, что возвращает setTimeout (в браузере — число) и принимает clearTimeout; 0 — ничего не отложено */
export type Timer = number | ReturnType<typeof setTimeout>;
/** Что можно положить внутрь элемента: узел, текст, число, вложенный список; null, undefined и false пропускаются */
export type Kid = Node | string | number | false | null | undefined | Kid[];
/** Экран: список его частей */
export type View = Kid[];

/* ---------- состояние страницы ---------- */

/** Профиль: чей дневник */
export interface Profile { id: string; n: string }
/** Хранилище, как его видят экраны: db.doc(путь) и db.collection(путь) */
export type Db = ReturnType<typeof dbOver>;
/** Сохранение файла на устройство */
export interface Downloads { save(file: { filename: string; data: string }): Promise<{ status: string }> }
/** Настройка профиля, как она лежит в хранилище: без значений по умолчанию. ex есть всегда, когда её правят */
export interface RawCfg {
  start?: string; zones?: Zones; cycle?: CycleCfg; method?: string;
  ex: Record<string, ExDef>; gear?: Record<string, GearDef>; program?: ProgramCfg | null;
  ignore?: Record<string, number>; rir?: number; bw?: string; caps?: { day: number; week: number }; rest?: number;
  days?: number;                                                    // тренировочных дней в неделе: 2, 3 или 4 (только приложение); нет поля — три
  time?: number;                                                    // минут на одну тренировку (только приложение): от них считается лимит недели на «Программе»; нет поля — не ограничено
  care?: string[];                                                  // что беречь: больные места по id (только приложение, core/rules.ts, ZONES); нет поля — ничего
  pairs?: string[];                                                 // дни программы подряд: «mon-wed» (только приложение, core/rules.ts, pairsOf); нет поля — подряд нет
  maint?: string[];                                                 // группы мышц на поддержании (только приложение, core/rules.ts, maintOf); нет поля — никого
}
/** Разбор от модели, сохранённый ещё в артефакте: приложение его хранит, но не показывает */
export interface CoachNote { text: string; at?: string; q?: string; cut?: boolean }
/** Правка, внесённая в черновик программы руками: мышца или день и что сделано */
export interface HandNote { m: string; t: string }
/** Черновик новой программы: результат сборки и ручные правки поверх него */
export type Built = ReturnType<typeof Core.buildProgram> & { hand?: HandNote[] };
/** План новой тренировки, пока она не начата: день, дата, снятые поправки, вариант плана */
export interface PlanUi { slot: string; date: string; off?: Record<string, boolean>; variant?: 'adj' | 'base' }
/** Вкладка «Программа»: как собрать, лимит недели, черновик и ключ условий, при которых он собран */
export interface ProgUi {
  focus: string; others: 'hold' | 'grow' | 'plain'; budget: number; draft: Built | null; key: string; edited?: boolean; name?: string | null; swapAt?: string | null; whyOpen?: boolean;
  /* выбор сценария кнопками цели (goal.ts): что было выбрано под целями «Масса», «Гибрид» и «Сила» в прошлый раз и какой лимит недели стоял до силового режима */
  mass?: string; mix?: string; force?: string; keep?: number;
  /* время на тренировку (fit.ts): сколько длится самая длинная тренировка при каждом лимите недели — пока не изменилось то, от чего зависит сборка */
  fit?: { key: string; max: Record<number, number>; made?: { b: number; t: Built } };   // made — сборка-примерка этого же показа: её берёт черновик, а не собирает заново
  /* сколько дней в неделе было, когда их начали менять на «Программе»: с принятой программой это число уходит в prev.days, и «Вернуть прежнюю» его возвращает */
  daysWas?: number;
  /* (в эталоне нет) базовых больше, чем дней: какими атлет жертвует, по порядку (список «Без базового»); нет — то, что сборка убирает по правилу */
  drop?: string[];
}
/** Форма нового упражнения: название, снаряд, просит ли дневник отметить мышцы */
export interface NewExUi { n: string; gear: string; ask: boolean }
/** То, что на экране выбрано и раскрыто */
export interface UiState {
  exSel: string | null; exAll: boolean; metric: 'w' | 'e1'; cell: { m: string; w: number } | null;
  plan: PlanUi | null; confirm: string | null; exForm: string | null; hist: boolean;
  q: string; coachBusy: boolean; coachText: string | null; coachErr: string | null;      // остались от запроса разбора: приложение их не использует
  prog: ProgUi | null; bodyBy: 'fact' | 'plan' | null; bodySel: string | null;
  newEx?: NewExUi | null; setupMore?: boolean;
}
/** Связь с хранилищем: ещё не открыто, записи грузятся, готово, хранилища нет, сбой */
export type Conn = 'connecting' | 'loading' | 'ready' | 'none' | 'error';
/** Состояние страницы: открытый профиль, его записи, идущая тренировка или правка */
export interface AppState {
  profile: string; profiles: Profile[]; gen: number; unsubs: (() => void)[];
  db: Db | null; conn: Conn; slow: boolean; canWrite: boolean; sample: unknown; downloads: Downloads | null;
  workouts: Workout[]; cfgRaw: RawCfg | null; cfg: Cfg; body: BodyRec[]; coach: CoachNote | null;
  view: string; draft: Workout | null; draftSaved: string | null; saving: boolean; dirty: boolean;
  ui: UiState;
}
/** Всё, что выводится из записей для экранов: недели, объём, статистика, замечания, ближайшая тренировка */
export type Derived = ReturnType<typeof derive>;

/* ---------- экраны ---------- */

/** Шкала диапазона повторов в строке подхода: умеет показать текущее число повторов */
export interface RangeTrack extends HTMLDivElement { setCur(r: number | null): void }
/** Что можно делать с днём в черновике программы */
export interface ProgEdit {
  manual: boolean; swapAt: string | null;
  sets(slot: string, i: number, k: number): void; drop(slot: string, i: number): void; up(slot: string, i: number): void;
  add(slot: string, id: string): void; swapOpen(slot: string | null, i?: number): void; swap(slot: string, i: number, x: Swap): void;
}
/** Цель подхода в плане: правило и диапазон повторов */
export interface SetGoal { rule: string; target: Range }
/** Подходы, которые поправка или правило ставят упражнению: веса, схема по процентам, расчётный максимум, диапазон */
export interface SetsSource { sets: { w: number | null }[]; cyc?: { pct: number; reps: number } | null; tm?: number | null; range?: Range | null }
/** Все поля всех вариантов объединения, каждое необязательное: для значения, которое бывает и полным, и почти пустым */
type Merge<U> = { [K in U extends unknown ? keyof U : never]?: U extends unknown ? (K extends keyof U ? U[K] : never) : never };
/** План базового упражнения на ближайшую тренировку. У лёгкого дня от него есть только prev: null */
export type CyclePlan = Merge<ReturnType<typeof Core.planCycle>>;
/** Упражнения текущей программы. has() отдаёт any: сортировка справочника вычитает эти «да / нет» друг из друга как числа */
export interface ProgSet extends Set<string> { has(id: string): any }
/** Нагрузка программы по дням и мышцам */
export type ProgTally = ReturnType<typeof Core.progTally>;
/** Строка таблицы объёма в программе: мышца, сейчас (a) и станет (b), из них сила — sa и s */
export interface VolRow { m: Muscle; a: number; b: number; s: number; sa: number }
/** Проверка, помечать ли строку дня в черновике программы */
export type Marked = (e: ProgEntry) => boolean;
/** Фигура человека: зоны, мышцы вне расчёта, выбранная мышца и что делать по нажатию */
export interface BodyOpts { z: Zones; ignore: Record<string, number>; sel: string | null; pick: ((m: string) => void) | null }

/* ---------- графики ---------- */

/** Точка графика: x — номер дня, y — значение */
export interface Point { x: number; y: number }
/** Линия графика */
export interface Series { name: string; color: string; pts: Point[]; area?: boolean; end?: boolean }
/** Строка подсказки на графике */
export interface TipRow { color?: string; v: string; k: string }
/** Линейный график */
export interface LineOpts {
  series: Series[]; dots?: { name: string; pts: Point[] } | null;
  h?: number; unit?: string; start?: number; label?: string; endPad?: number;
  tip?: (x: number) => TipRow[]; title?: (x: number) => string;
}
/** Столбец диаграммы */
export interface Bar { label: string; v: number; title?: string; note?: string; muted?: boolean }
/** Столбчатая диаграмма */
export interface BarOpts { bars: Bar[]; h?: number; unit?: string; label?: string }
/** Рисует график в элементе известной ширины */
export type Draw = (el: HTMLElement, width: number) => void;
