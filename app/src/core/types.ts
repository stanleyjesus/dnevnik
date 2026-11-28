/* Типы данных дневника: что лежит в записях и в настройке профиля и чем обмениваются функции логики.
   Исполняемого кода здесь нет. Смысл полей — в docs/02-data-model.md. */

/* ---------- справочники ---------- */

/** Мышца: id, название, группа (верх, руки, корпус, ноги) */
export interface Muscle { id: string; n: string; g: string }
/** Тип движения. gen и fix есть у движений, отсутствие которых дневник считает пробелом программы */
export interface Pattern { id: string; n: string; gen?: string; fix?: string }
/** День программы: id, название, короткое название, день недели (0 — воскресенье) */
export interface Slot { id: string; n: string; s: string; dow: number }
/** Карта мышц упражнения: 1 — основная, 0.5 — помогает */
export type MuscleMap = Record<string, number>;
/** Диапазон повторов: [нижняя граница, верхняя] */
export type Range = number[];
/** Проценты волны по числу повторов: { 5: 77, 4: 82, 3: 87 } */
export type PctMap = Record<number, number>;
/** Отметка цели упражнения: название; lo и w — нижняя граница и наименьшая ширина диапазона, если цель их задаёт */
export interface Goal { n: string; lo?: number; w?: number }

/* ---------- записи ---------- */

/** Подход. w — вес (null, пока не выбран); r — повторы (null, пока не записаны); q — запас повторов до отказа (RIR);
    warm — разминочный; skip — не делал */
export interface SetRec { w: number | null; r: number | null; skip?: boolean; warm?: boolean; q?: number }
/** Подход по процентам: доля расчётного максимума и число повторов */
export interface Cyc { pct: number; reps: number }
/** Упражнение в тренировке: либо диапазон (двойная прогрессия), либо cyc (по процентам); tm — расчётный максимум */
export interface Item { ex: string; range: Range | null; cyc: Cyc | null; sets: SetRec[]; note: string; skip: boolean; rir: null; tm?: number | null }
/** Тренировка. slot — день программы; open — ещё идёт */
export interface Workout { id: string; date: string; slot: string | null; note: string; open: boolean; items: Item[]; min?: number; began?: number; old?: boolean }   // (в эталоне нет) min — сколько минут шла тренировка: от «Начать тренировку» до «Завершить» или как поправил атлет; began — когда нажато «Начать тренировку», мс, только у идущей (pace.ts); old — тренировка из прежнего дневника, загруженная поверх своей программы: она в истории и прогрессе, но не в плане (data/backup.ts, mergeBackup)
/** Упражнение тренировки в том виде, в каком оно лежит в хранилище: подходы и диапазон записаны текстом */
export interface ItemDoc { ex: string; cyc?: string; tm?: number; rng?: string; sets?: string; note?: string; skip?: boolean; rir?: number }
/** Тренировка в том виде, в каком она лежит в хранилище */
export interface WorkoutDoc { date: string; slot: string; items: ItemDoc[]; note?: string; open?: boolean; min?: number; began?: number; old?: boolean }
/** Запись веса тела */
export interface BodyRec { id?: string; date: string; kg: number }

/* ---------- настройка профиля ---------- */

/** Упражнение справочника */
export interface ExDef {
  n: string;                    // название
  m: MuscleMap;                 // мышцы
  pat?: string;                 // тип движения; iso — изоляция
  mode?: string;                // cycle — по процентам (волна), light — лёгкий день; пусто — двойная прогрессия
  of?: string;                  // у лёгкого дня: id его базового
  mid?: boolean;                // (только приложение) у лёгкого дня: это средний день «Силы: <движение>» — 3 × 6 на 79% (strength.ts, DAY_M)
  gear?: string;                // снаряд, в котором лежит упражнение
  step?: number;                // шаг веса: берётся от снаряда
  round?: number;               // округление весов волны: тоже от снаряда
  lo?: number;                  // диапазон повторов
  hi?: number;
  uni?: boolean;                // одна сторона: подход идёт за половину
  goal?: string;                // отметка цели
  stored?: string;              // (только приложение) режим, как он сохранён, если роль в принятой программе его сменила: 'cycle' или '' (rules.ts, applyRoles)
  work?: number;                // известные веса: рабочий, на сколько повторов, разовый максимум
  workR?: number;
  max?: number;
  stop?: boolean;               // (только приложение) стоп-упражнение: сборка его не ставит и в заменах не предлагает (rules.ts, stopOf)
}
/** Упражнение, прочитанное из названия */
export interface ExGuess { pat: string; m: MuscleMap; uni?: boolean }
/** Снаряд: название и шаг веса; own — заведён атлетом */
export interface GearDef { n: string; step: number; own?: boolean }
/** Зоны недельного объёма: мало до min, рабочая зона от opt до high */
export interface Zones { min: number; opt: number; high: number }
/** Обычная волна: прибавка к расчётному максимуму в % за неделю, число подходов, проценты */
export interface CycleCfg { inc: number; sets: number; pct: PctMap }
/** Упражнение в программе. n — число подходов (у упражнений по процентам его задаёт волна).
    Остальное живёт только в черновике сборки: chg — сколько подходов прибавлено, pin — закреплено,
    isNew — добавлено сборкой, from — перенесено из этого дня, was — чем упражнение было до замены */
export interface ProgEntry { ex: string; n?: number; chg?: number; pin?: boolean; isNew?: boolean; from?: string; was?: string }
/** Программа по дням */
export type ProgSlots = Record<string, ProgEntry[]>;
/** Принятая программа: действует в дне, пока в нём не было тренировки с даты since.
    prev — к чему вернуться кнопкой «Вернуть прежнюю»: прежние отметки цели упражнений, прежняя программа и (только приложение) прежнее число дней
    в неделе, если перед принятием его меняли. fit (только приложение) — программа принята с лимитом недели, найденным по времени на тренировку:
    время, отдых, режим сборки и число дней, при которых он найден; пока они те же, дневник большего лимита не ищет.
    triad (только приложение) — «Сила: пауэрлифтерская тройка», три движения по id: по проценту идут только они (rules.ts, programRoles) */
export interface ProgramCfg { name?: string; focus?: string | null; others?: string | null; prio?: string; budget?: number; lean?: boolean; strength?: boolean; since: string; made?: string; slots: ProgSlots; prev?: { goals?: Record<string, string>; program?: ProgramCfg; days?: number }; fit?: { time: number; rest: number; mode: string; days: number }; drop?: string[]; triad?: string[];
  /* (в эталоне нет) программу сократил сам дневник: тренировки шли дольше расчёта и не влезали во время (ui/trim.ts); trimOff — атлет вернул прежнюю, сам дневник её больше не сокращает */
  trim?: { from: number; to: number; k: number; time: number }; trimOff?: boolean }
/** Настройка профиля после mergeCfg: все значения по умолчанию подставлены */
export interface Cfg {
  start: string | null;                       // понедельник первой недели программы
  zones: Zones;
  cycle: CycleCfg;
  method: string;                             // методика словами
  ex: Record<string, ExDef>;                  // справочник упражнений
  gear: Record<string, GearDef>;              // снаряды
  program: ProgramCfg | null;
  ignore: Record<string, number>;             // мышцы вне расчёта
  rir: number;                                // запас повторов по методике
  bw: string;                                 // вес тела: gain — следить за набором, track — только записывать
  caps: { day: number; week: number };        // лимиты: подходов на мышцу за тренировку и рабочих подходов в неделю
  rest: number;                               // отдых между подходами, секунды
  care?: string[];                            // (только приложение) что беречь: больные места по id из ZONES (rules.ts)
  pairs?: string[];                           // (только приложение) дни программы подряд: пары id дней, «mon-wed» (rules.ts, pairsOf)
}
/** Всё, что нужно замечаниям и запросу для разбора */
export interface State { workouts: Workout[]; cfg: Cfg; body: BodyRec[]; today: string }

/* ---------- история и объём ---------- */

/** Одна тренировка упражнения в его истории: top — самый тяжёлый подход, best — лучший по расчётному максимуму */
export interface Session { date: string; wid: string; slot: string | null; item: Item; sets: SetRec[]; top: SetRec; best: SetRec; e1: number; tm: number | null; metric: number }
/** Последняя запись упражнения: тренировка и упражнение в ней */
export interface SessRef { w: Workout; it: Item }
/** Подход, который стоит на месте: номер, вес, повторы */
export interface Stalled { i: number; w: number; r: number }
/** Неделя программы */
export interface WeekInfo { no: number; from: string; to: string; count: number; current: boolean; complete: boolean }
/** Вклад одного упражнения в объём мышцы за неделю */
export interface VolDetail { ex: string; n: number; eff: number; c: number; v: number }
/** Объём недели: m — по мышцам, s — его часть от упражнений по процентам (сила), pat — подходы по типам движений */
export interface WeekVol { m: Record<string, number>; s: Record<string, number>; detail: Record<string, Record<string, VolDetail>>; pat: Record<string, number>; sets: number; n: number; unknown: string[] }
/** Объём по неделям программы */
export type Volume = Record<number, WeekVol>;

/* ---------- неделя по шаблонам дней ---------- */

/** Упражнение шаблона дня: из законченной тренировки (sets) или из принятой программы (n) */
export interface TplItem { ex: string; sets?: SetRec[]; n?: number; cyc?: Cyc | null; skip?: boolean }
/** Шаблон дня: последняя законченная тренировка этого дня или день принятой программы (prog) */
export interface DayTpl { items: TplItem[]; prog?: boolean }
/** Шаблоны дней недели */
export type Week = Record<string, DayTpl>;

/* ---------- поправки плана ---------- */

/** Что дневник знает о неделе, когда решает, не хватает ли программе упражнения */
export interface AddCtx { z: Zones; pv: (m: string) => number; pp: (p: string) => number; prim: (m: string) => boolean }
/** Упражнение, которого программе может не хватать: когда оно нужно и чем это объяснить */
export interface Add { key: string; id: string; prio: number; sets: number; times: number; def: ExDef; cover: (e?: ExDef) => boolean; need: (c: AddCtx) => boolean; why: (c: AddCtx) => string }
/** Предложение добавить упражнение в план тренировки */
export interface Addition { key: string; a: Add; exId: string; def: ExDef | null; name: string; sets: number; range: Range; why: string; w?: number | null }
/** Подход в поправке: вес и цель по повторам */
export interface PropSet { w: number | null; tg: Range }
/** Поправка к упражнению плана: тег, причины, новые подходы */
export interface Prop { key: string; ex: string; idx: number; tag: string; notes: string[]; sets: PropSet[]; cyc: Cyc | null; range: Range | null; note?: string; drop?: boolean; fix?: SkipFix; swap?: string }   // note — (в эталоне нет) заметка к упражнению, которую ставит поправка; drop и fix — (в эталоне нет) упражнение уходит из дня после двух пропусков подряд (skips.ts); swap — (в эталоне нет) замена упражнения при долгом плато (adapt.ts)
/** (в эталоне нет) Что делать с упражнением, которое два раза подряд не сделано (skips.ts): перенести в другой день (to), раздать подходы другим упражнениям (adds) или убрать; n — его подходы, left — сколько не поместилось */
export interface SkipFix { ex: string; kind: 'move' | 'spread' | 'drop'; n: number; to?: string; adds?: { sl: string; ex: string; k: number }[]; left?: number; notes: string[] }

/* ---------- сборка программы ---------- */

/** Типовое упражнение из встроенного списка */
export interface LibEntry { id: string; def: ExDef }
/** Вариант замены упражнения. exact — карта мышц совпадает целиком; like — сходство карт мышц от 0 до 1.
    exact — any, потому что сортировка вычитает эти «да / нет» друг из друга как числа */
export interface Swap { id: string; n: string; m: MuscleMap; uni: boolean; def?: ExDef; exact?: any; like?: number; shared?: number; main?: string[] }
/** Условия сборки: зоны, мышцы вне расчёта, приоритетные мышцы, лимит недели и дня, общий уровень; time — минут на тренировку, в которые укладывается каждый день */
export interface OptOpts { z: Zones; ignore?: Record<string, number>; prio?: Record<string, number>; budget: number; dayCap: number; level?: number; noFill?: boolean; allDays?: boolean; time?: number; split?: Record<string, string[]> | null }   // split — (в эталоне нет) дни, где мышца может быть основной, когда есть дни подряд (rules.ts, pairSplit)
/** Упражнение, убранное сборкой из дня */
export interface Cut { ex: string; sl: Slot; to?: string | null }
/** (в эталоне нет) упражнение, чьи подходы сборка отдала другому упражнению того же дня на ту же мышцу (вывод 8 аудита): was — оно стояло в программе до сборки */
export interface Fold { ex: string; sl: Slot; into: string; n: number; was: boolean }
/** Один шаг поиска в сборке: в каком дне, с каким упражнением, на сколько подходов (dn) и упражнений (dw), его цена (pen) */
export interface Move { sl: Slot; e: ProgEntry | null; id: string; f: number; dn: number; dw: number; pen: number; drop?: boolean; add?: boolean; to?: Slot; n?: number; from?: Slot }
/** Сколько подходов день даёт мышце */
export type DayOf = (d: string, m: string) => number;
/** Что собрать: вокруг базового (focus), под приоритет мышц (prio) или вручную (manual); time — минут на тренировку, от них потолок упражнений в дне (rules.ts);
    drop — базовые, которыми атлет жертвует, когда их больше, чем дней, по порядку (rules.ts); triad — с strength: «Пауэрлифтерская тройка» (rules.ts).
    С днями «День N» focus — цель «Силы» или «Гибрида»: любое упражнение справочника или встроенного списка, базовым его делает роль */
export interface BuildOpts { focus?: string | null; others?: string; prio?: string; budget?: number | string; manual?: boolean; strength?: boolean; time?: number; drop?: string[]; triad?: boolean }
/** Строка пояснения сборки: заголовок и текст */
export interface ProgNote { t: string; x?: string }

/* ---------- замечания ---------- */

/** Замечание дневника: важность, раздел, заголовок, текст, вкладка для перехода */
export interface Insight { sev: string; cat: string; title: string; text: string; link?: string }
