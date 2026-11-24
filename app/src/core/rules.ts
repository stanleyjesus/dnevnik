/* Правила приложения, которых в эталоне нет (решения владельца, 23 и 24 ноября 2026).
   Они действуют, когда приложение выбрало дни «День 1…N» (useDays): так открывается любой профиль в приложении.
   С таблицей дней эталона — эталонные тесты и общие сценарии сверки экранов — всё считается как в эталоне.
   Держат tests/rules.test.ts и, для методики под цель и порядка в дне, tests/method.test.ts. */
import { DAYS } from './days.ts';
import { placed } from './gear.ts';
import { e1, estRir, work } from './sets.ts';
import { STARTER, starterOf } from './starter.ts';
import { DAY_H, ISO, TARGETS, TRIAD } from './strength.ts';
import type { Cfg, ExDef, Item, MuscleMap, ProgramCfg, Range, SetRec } from './types.ts';

/** Выключатель для проверок: tests/days.test.ts сверяет дни «День 1…3» с таблицей эталона при одних и тех же правилах */
export const RULES = { on: true };
/** Правила приложения включены: дни выбраны приложением, а не взяты из таблицы эталона */
export const appRules = () => RULES.on && !DAYS.week;

/* Румынская тяга и тяга на прямых ногах: движение в тазобедренном суставе делают бицепс бедра и ягодицы,
   разгибатели спины держат спину неподвижной — они помогают (½), а не основные. Становая и гуд морнинг — как были. */
/** Как называется тяга, у которой разгибатели спины только помогают */
export const RDL_NAME = /румынск|м[её]ртв\S* тяг|на прямых ногах|\brdl\b|stiff/;
/** Мышцы такой тяги в приложении */
export const RDL_M: MuscleMap = { hams: 1, glutes: 1, erectors: 0.5 };
/** Карта, которую ей давало прежнее правило по названию: с ней разгибатели — основная мышца */
const RDL_OLD: MuscleMap = { hams: 1, glutes: 1, erectors: 1 };
const sameMap = (a: MuscleMap | undefined, b: MuscleMap) => !!a && Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(k => a[k] === b[k]);
/** Это тяга на прямых ногах: по названию */
export const isRdl = (name: string | null | undefined) => RDL_NAME.test(' ' + String(name || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ');

/* Типовая румынская тяга сборки и поправок: в эталоне разгибатели в ней основные */
const RDL_REF: ExDef = { n: 'Румынская тяга', pat: 'hinge', m: RDL_OLD };
const RDL_APP: ExDef = { n: 'Румынская тяга', pat: 'hinge', m: RDL_M };
/** Типовая румынская тяга: в приложении разгибатели помогают, с таблицей дней эталона — как в эталоне */
export const rdlDef = (): ExDef => appRules() ? RDL_APP : RDL_REF;

/* Упражнений в дне — от времени на тренировку (решение владельца, 23 ноября 2026). В эталоне потолок один — девять упражнений в дне.
   С выбранным временем потолка в девять упражнений нет: сборка ставит в день упражнения и подходы, пока он укладывается в это время по оценке
   дневника (estMinutes) и с тем же округлением до 5 минут, что в заголовке дня. Больше времени — больше упражнений. Время «не ограничено» — девять,
   как в эталоне. Лимит недели «по времени» по-прежнему ищет ui/fit.ts: он страхует то, что сборка не двигает, — базовые и лёгкие дни */
/** Что предлагает список «Время на тренировку», минут (ui/fit.ts) */
export const TIMES = [60, 75, 90, 105, 120];
/** Упражнений в дне без выбранного времени — как в эталоне */
export const MAX_EX = 9;
/** Время так, как его показывает дневник (fmtDur): округление до 5 минут, не меньше 5 */
export const shown = (min: number) => Math.max(5, Math.round(min / 5) * 5);
/** Тренировка длиной `min` минут укладывается во время `time`: сравнивается то, что видно на экране */
export const inTime = (min: number, time: number) => shown(min) <= time;
/** Следующее время из списка после `time`; 0 — больше в списке нет */
export const moreTime = (time: number) => TIMES.find(t => t > time) || 0;

/** У двух упражнений одни и те же мышцы с той же долей: с днями «День N» сборка не ставит их в один день — подходы прибавляются в том, что уже стоит */
export const sameMuscles = (a: MuscleMap, b: MuscleMap) => JSON.stringify(Object.entries(a || {}).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b || {}).filter(x => x[1] > 0).sort());

/** Упражнение справочника, как его читает приложение. Румынская тяга с картой прежнего правила по названию читается с разгибателями,
    которые помогают: так сборка не убирает её из профиля, где разгибатели вне расчёта. Карту, которую атлет поменял сам, дневник не трогает;
    в хранилище ничего не переписывается. Возвращает то же упражнение или его копию с новой картой */
export function appEx(e: ExDef): ExDef {
  if (!appRules() || !isRdl(e.n) || !sameMap(e.m, RDL_OLD)) return e;
  return Object.assign({}, e, { m: Object.assign({}, RDL_M) });
}

/* Методика под цель (решение владельца, 24 ноября 2026; разбор — docs/03, раздел 15). С днями «День N» проценты, повторы и прибавку дневник
   считает от цели программы и типа упражнения. Волна 77–82–87 с прибавкой максимума +2% в неделю не действует: волна, записанная в профиле,
   остаётся в данных, но ничего не считает.
   - По проценту от расчётного максимума идёт только базовое в силовой роли, которую ставит сборка «Сила» или «Гибрид»: сила по запасу —
     тяжёлый день 3 × 4 одним весом с запасом 2 (≈ 83%), вес решает запас в последнем подходе, лёгкий день 3 × 8 на 75%, у «Силы: <движение>»
     ещё средний день 3 × 6 на 79% («Новая схема», решение владельца 24 ноября 2026; strength.ts); или поддержание — 3 × 4 на 83%
     от максимума, который не растёт, то есть вес прежний.
   - Всё остальное, в том числе базовое в «Массе», идёт по независимой двойной прогрессии — каждый подход ведётся отдельно: многосуставные
     и базовые 6–10 повторов, изоляция 8–12 (владелец заменил ею 10–15 в тот же день), запас по методике профиля (1 повтор). Свой диапазон упражнения
     остаётся. Ширина — от шага снаряда, как раньше: шаг веса в % / 2.5, чтобы после прибавки веса нижняя граница была по силам.
   - Когда упражнение меняет способ, расчётный максимум берётся из его последних подходов (Эпли с поправкой на запас), и план продолжается
     с весов журнала, а не с нуля. */
/** Нижняя граница и наименьшая ширина диапазона по типу упражнения: многосуставные 6–10, изоляция 8–12 */
export const TYPE = { compound: { lo: 6, w: 4 }, iso: { lo: 8, w: 4 } };
/** Поддержание базового: 3 × 4 на 83% от расчётного максимума, который не растёт (83% — как у силы по запасу, AUTO.pct) */
export const HOLD = { pct: 83, reps: 4, sets: 3 };
/** Подходов у базового на двойной прогрессии — 4, как в тяжёлом дне силы по запасу первой версии (AUTO.sets); тяжёлый день силовой роли
    с «Новой схемой» — 3 подхода (strength.ts, DAY_H) */
export const BASE_SETS = 4;
/** Роль базового по его отметке: auto — сила по запасу (и прежняя тяжёлая волна «приоритет силы»), hold — поддержание, иначе двойная прогрессия */
export function appGoal(e: ExDef | null | undefined): 'auto' | 'hold' | null {
  if (!e || e.mode !== 'cycle') return null;
  return e.goal === 'auto' || e.goal === 'strength' ? 'auto' : e.goal === 'hold' ? 'hold' : null;
}
/** Упражнение идёт по проценту от расчётного максимума: в эталоне — каждое базовое, в приложении — только базовое в силовой роли */
export const byPct = (cfg: Cfg, id: string) => { const e = cfg.ex[id]; return !!e && e.mode === 'cycle' && (!appRules() || !!appGoal(e)); };
/** Диапазон повторов в приложении. Свой — прошлый, если его нижняя граница не 8 (8 всем давало прежнее правило), или lo–hi упражнения в справочнике.
    Иначе по типу: базовое и многосуставное — от 6, изоляция — от 8; ширина — шаг веса в % от рабочего веса / 2.5, не уже 4 повторов и не шире 8 */
export function appRange(e: ExDef | null | undefined, last: Range | null | undefined, w: number, step: number): Range {
  if (last && last.length === 2 && last[0] !== 8) return [last[0], last[1]];
  if (e && +e.lo! > 0 && +e.hi! > +e.lo!) return [+e.lo!, +e.hi!];
  const t = e && (e.mode === 'cycle' || (e.pat && e.pat !== 'iso')) ? TYPE.compound : TYPE.iso;
  const k = Math.min(8, Math.max(t.w, w > 0 ? Math.round(step / w * 100 / 2.5) : 0));
  return [t.lo, t.lo + k];
}
/** Расчётный максимум одного подхода — Эпли от повторов плюс запас: отмеченный, у подхода по проценту — по проценту,
    иначе запас по методике профиля */
export function setMax(s: SetRec, it: Item, rir: number) {
  const q = s.q != null ? s.q : it.cyc && it.cyc.pct ? Math.max(0, estRir(it.cyc.pct, s.r!)) : rir;
  return e1(s.w!, s.r! + q);
}
/** Лучший подход записи по расчётному максимуму (setMax): при равенстве — первый */
export const maxSet = (it: Item, sets: SetRec[], rir: number) => sets.reduce((t, s) => setMax(s, it, rir) > setMax(t, it, rir) ? s : t, sets[0]);
/** Расчётный максимум по подходам одной записи — лучший подход по Эпли с поправкой на запас (setMax). null — рабочих подходов нет */
export function logMax(it: Item, rir: number) {
  let best = 0;
  for (const s of work(it)) best = Math.max(best, setMax(s, it, rir));
  return best > 0 ? best : null;
}
/** Вес подхода двойной прогрессии от расчётного максимума: середина диапазона с запасом по методике, вниз до шага снаряда */
export const fromMax = (tm: number, range: Range, rir: number, step: number) => { const v = Math.floor(tm / (1 + (Math.round((range[0] + range[1]) / 2) + rir) / 30) / step + 1e-6) * step; return v > 0 ? +v.toFixed(3) : null; };
/* Порядок упражнений в дне (решение владельца, 24 ноября 2026, вопрос сборки 13; разбор — docs/03, раздел 15.3). С днями «День N» сборка
   расставляет каждый день черновика; в «Вручную» порядок атлета, сборка его не трогает:
   1. Первым — то, что важнее для цели: движение цели «Гибрида» и «Силы: …» (тяжёлый или лёгкий день), затем базовое дня, затем лёгкие дни силового
      режима (сразу после тяжёлых), затем упражнения мышц в приоритете и закреплённое упражнение «на массу».
   2. На каждой ступени многосуставные — до изоляции.
   3. Соседние упражнения — на разные основные мышцы, если можно иначе, не нарушая 1 и 2.
   Из раскладок с наименьшим числом соседей на одни мышцы берётся ближайшая к прежнему порядку: раньше остаётся то, что стояло раньше.
   Правая и левая сторона одного упражнения стоят рядом и считаются одним упражнением */
/** Ступени порядка в дне: движение цели, базовое, лёгкий день, мышцы в приоритете и упражнение «на массу», остальное; у двух последних изоляция — следующая ступень */
export const ORDER = { goal: 0, base: 1, light: 2, prio: 3, rest: 5 };
/** Порядок дня. tier — ступень упражнения (меньше — раньше), mains — его основные мышцы, side — общий ключ у правой и левой стороны
    одного упражнения (null — не сторона). Если менять нечего, возвращает тот же массив, иначе новый */
export function dayOrder<T>(L: T[], tier: (e: T) => number, mains: (e: T) => string[], side: (e: T) => string | null): T[] {
  type U = { at: number; t: number; m: string[]; items: T[] };
  const units: U[] = [], open: Record<string, U> = {};
  L.forEach((e, at) => {
    const k = side(e);
    if (k != null && open[k]) { open[k].items.push(e); delete open[k]; return; }
    const u: U = { at, t: tier(e), m: mains(e), items: [e] };
    if (k != null) open[k] = u;
    units.push(u);
  });
  units.sort((a, b) => (a.t - b.t) || (a.at - b.at));
  const n = units.length, clash = (a: number, b: number) => a >= 0 && units[a].m.some(m => units[b].m.includes(m)) ? 1 : 0;
  let seq = units.map((u, i) => i);
  if (n > 2 && n <= 16) {
    /* перебор с запоминанием: что уже стоит (маска) и что стоит последним; дальше можно ставить только упражнения самой ранней ступени из оставшихся */
    const full = (1 << n) - 1, memo = new Map<number, number>();
    const next = (mask: number) => { let i = 0; while (mask & (1 << i)) i++; const out: number[] = []; for (let j = i; j < n && units[j].t === units[i].t; j++) if (!(mask & (1 << j))) out.push(j); return out; };
    const cost = (mask: number, last: number): number => {
      if (mask === full) return 0;
      const key = mask * 17 + last + 1, got = memo.get(key);
      if (got !== undefined) return got;
      let v = Infinity;
      for (const j of next(mask)) v = Math.min(v, clash(last, j) + cost(mask | (1 << j), j));
      memo.set(key, v);
      return v;
    };
    seq = [];
    for (let mask = 0, last = -1; mask !== full;) {
      const aim = cost(mask, last), j = next(mask).find(j => clash(last, j) + cost(mask | (1 << j), j) === aim)!;
      seq.push(j); mask |= 1 << j; last = j;
    }
  }
  const out = seq.flatMap(i => units[i].items);
  return out.every((e, i) => e === L[i]) ? L : out;
}
/* Цели «Силы» и «Гибрида» (решение владельца, 24 ноября 2026, пункт 8 вопросов сборки; разбор — docs/03, раздел 15.4). С днями «День N»
   «базовое» — не отметка в справочнике, а роль в программе: тяжёлый и лёгкий дни по проценту от расчётного максимума. Её получает только то,
   что выбрано целью:
   - под «Силой» — одно упражнение из списка (strength.ts, TARGETS) или «Пауэрлифтерская тройка» (TRIAD); всё остальное, в том числе базовые
     справочника, — обычные упражнения по двойной прогрессии по типу упражнения: «Остальных базовых» под «Силой» нет;
   - под «Гибридом» — одно упражнение из того же списка; остальные базовые справочника — как их ставит переключатель «Остальные базовые».
   В «Массе» и «Вручную» справочник читается, как сохранён. Роль живёт в принятой программе (programRoles) и в условиях сборки, а не в справочнике:
   в хранилище ничего не переписывается, а asStored возвращает справочник, как он сохранён. Цели нет в справочнике — сборка добавит её из встроенного */
/** Упражнение справочника для цели t (id встроенного справочника): по id, иначе по названию; его нет — сам id цели */
export function targetOf(cfg: Cfg, t: string) {
  if (cfg.ex[t] && cfg.ex[t].mode !== 'light') return t;
  return Object.keys(cfg.ex).find(id => cfg.ex[id].mode !== 'light' && starterOf(id, cfg.ex[id].n) === t) || t;
}
/** Цели по порядку списка на экране: id упражнений справочника, а тех, которых в нём нет, — id встроенного */
export const targetIds = (cfg: Cfg) => TARGETS.map(t => targetOf(cfg, t));
/** Пауэрлифтерская тройка: приседания, жим лежа, становая тяга */
export const triadIds = (cfg: Cfg) => TRIAD.map(t => targetOf(cfg, t));
/** Название цели: из справочника, а если её там нет — из встроенного */
export const targetName = (cfg: Cfg, id: string) => (cfg.ex[id] && cfg.ex[id].n) || (STARTER[id] && STARTER[id].n) || id;
/** Упражнение годится в цель: оно есть в справочнике и это не лёгкий день, или его знает встроенный */
export const canTarget = (cfg: Cfg, id: string | null | undefined) => !!id && (cfg.ex[id] ? cfg.ex[id].mode !== 'light' : !!STARTER[id]);
/** Изоляция в силовой роли — тяжёлый день 3 × 6 и лёгкий 3 × 10 (strength.ts, ISO и ISO_LIGHT); у лёгкого дня — по его базовому */
export function isoLift(cfg: Cfg, id: string) {
  if (!appRules()) return false;
  const e = cfg.ex[id], x = e && e.mode === 'light' ? cfg.ex[e.of!] : e;
  return !!x && x.mode === 'cycle' && x.pat === 'iso';
}
/** Тяжёлый день силовой роли: 3 × 4 одним весом на 83%, у изоляции 3 × 6 на 79%; вес решает запас в последнем подходе («Новая схема»,
    решение владельца 24 ноября 2026; strength.ts, DAY_H и ISO). С таблицей дней эталона тяжёлый день — 4 × 4 (AUTO, goals.ts) */
export const heavyOf = (cfg: Cfg, id: string) => isoLift(cfg, id) ? ISO : DAY_H;
/** В вес входит тело: подтягивания, отжимания, брусья — по названию упражнения или его снаряда. Лёгкий день такого базового не легче
    самого лёгкого веса в журнале (легче тела не бывает); у остальных он — ровно доля от расчётного максимума, и у новой цели тоже (пункт 8, 24 ноября 2026) */
export const BODY_NAME = /подтяг|отжим|брус/;
export function withBody(cfg: Cfg, id: string) {
  const e = cfg.ex[id], g = e && e.gear ? cfg.gear[e.gear] : null;
  return !!e && (BODY_NAME.test(String(e.n || '').toLowerCase()) || (!!g && BODY_NAME.test(String(g.n || '').toLowerCase())));
}
/** Роли программы: on — что идёт по проценту; plain — базовые справочника, кроме on, идут по двойной прогрессии */
export interface Roles { on: string[]; plain: boolean }
/** Роли принятой программы: «Сила: тройка» и «Сила: <упражнение>» — по проценту только цель; «Гибрид» — цель и, как раньше, остальные базовые справочника;
    «Масса», «Вручную» и силовой режим «все базовые», принятый до 24 ноября 2026, — справочник как есть */
export function programRoles(P: ProgramCfg | null | undefined): Roles | null {
  if (!appRules() || !P) return null;
  if (P.triad && P.triad.length) return { on: P.triad.slice(), plain: true };
  return P.focus ? { on: [P.focus], plain: !!P.strength } : null;
}
/** Справочник под роли (меняет c.ex): цель — базовое, остальные базовые — по двойной прогрессии, если так велит роль. Сохранённый режим помнит
    поле stored; шаг и округление — снова от снаряда, лёгкий день цели округляет, как она */
export function applyRoles(c: Cfg, R: Roles | null) {
  if (!R) return;
  const set = (id: string, mode: string) => {
    const e = c.ex[id], x: ExDef = Object.assign({}, e, { stored: e.stored !== undefined ? e.stored : e.mode || '' });
    if (mode) x.mode = mode; else delete x.mode;
    c.ex[id] = placed(c, x);
  };
  for (const id of Object.keys(c.ex)) {
    const e = c.ex[id];
    if (e.mode === 'light') continue;
    if (R.on.includes(id)) { if (e.mode !== 'cycle') set(id, 'cycle'); }
    else if (R.plain && e.mode === 'cycle') set(id, '');
  }
  for (const id of Object.keys(c.ex)) { const e = c.ex[id]; if (e.mode === 'light' && R.on.includes(e.of!)) c.ex[id] = placed(c, e); }
}
/** Настройка со справочником, как он сохранён: роли принятой программы сняты. Всегда копия — справочник и снаряды можно менять, не трогая c */
export function asStored(c: Cfg): Cfg {
  const out: Cfg = Object.assign({}, c, { ex: Object.assign({}, c.ex), gear: Object.assign({}, c.gear) }), back: string[] = [];
  for (const id of Object.keys(out.ex)) {
    const e = out.ex[id];
    if (e.stored === undefined) continue;
    const x = Object.assign({}, e);
    if (e.stored) x.mode = e.stored; else delete x.mode;
    delete x.stored;
    out.ex[id] = placed(out, x); back.push(id);
  }
  for (const id of Object.keys(out.ex)) { const e = out.ex[id]; if (e.mode === 'light' && back.includes(e.of!)) out.ex[id] = placed(out, e); }
  return out;
}
/** Настройка, как её читает приложение; в хранилище ничего не переписывается.
    - Роли принятой программы (см. выше). Упражнение, которое в ней идёт по двойной прогрессии вместо базового, получает число подходов базового,
      если в программе его нет: так программа, принятая до 24 ноября 2026, считается и планируется без пробелов.
    - Программа вокруг одного базового, принятая с «Растут как раньше» до 24 ноября 2026: остальные базовые в ней без отметки шли по обычной волне.
      Волны в приложении нет, а «растут» — это сила по запасу раз в неделю */
export function appCfg(c: Cfg) {
  const P = c.program;
  if (!appRules() || !P || !P.slots) return;
  const R = programRoles(P);
  applyRoles(c, R);
  if (R && R.plain) for (const sl of Object.keys(P.slots)) for (const e of P.slots[sl] || []) { const x = c.ex[e.ex]; if (x && x.stored === 'cycle' && !(+e.n! > 0)) e.n = BASE_SETS; }
  if (!P.focus || P.others !== 'grow' || P.strength) return;
  for (const sl of Object.keys(P.slots)) for (const e of P.slots[sl] || []) {
    const x = c.ex[e.ex];
    if (x && x.mode === 'cycle' && e.ex !== P.focus && !x.goal) c.ex[e.ex] = Object.assign({}, x, { goal: 'auto' });
  }
}
