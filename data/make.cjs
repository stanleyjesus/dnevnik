#!/usr/bin/env node
/* Примерные данные дневника — те, на которых идут все проверки проекта.

   Атлет выдуман. Ни одной настоящей записи здесь нет и быть не должно: веса, повторы, пропуски и заметки
   получаются из таблиц и формул этого файла. Случайных чисел нет: запуск всегда даёт те же файлы байт в байт.

   Как получается журнал. Первая тренировка каждого дня задана таблицей WEEK1. Дальше атлет «ведёт дневник»:
   план следующей тренировки строит логика артефакта (reference/src/core.js — она заморожена и не меняется),
   а сколько повторов он сделал, считает модель ниже: у каждого упражнения есть «потолок» — расчётный максимум
   по формуле Эпли; он понемногу растёт от тренировки к тренировке, каждый следующий подход чуть слабее предыдущего,
   атлет останавливается за повтор до отказа и на верхней границе диапазона. Отдельной таблицей вписаны случаи,
   которые нужны проверкам: пропущенное упражнение, незаписанные повторы, разминочный подход, вес 0, заметки,
   неделя без тренировок, замена упражнения, незакрытый подход в волне.

   Файлы: workouts.json и config.json — журнал и настройка первого профиля, как их писала ранняя версия дневника;
   config.p2.json и config.p2.stored.json — второй профиль в начальном виде и каким его хранит приложение;
   later.json — тот же дневник неделей позже, резервная копия в формате приложения (см. конец файла).

   node data/make.cjs            — переписать файлы в data/
   node data/make.cjs --check    — убедиться, что файлы в data/ совпадают с выводом генератора (ничего не пишет)

   Менять примерные данные — только здесь, отдельным коммитом, и после этого обновлять всё, что на них посчитано:
   node reference/run-checks.js --update, снимки чисел в тестах приложения, таблицы в docs/04. */
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, '..', 'reference', 'src', 'core.js'));

/* ---------- календарь: десять недель, три дня в неделю ---------- */
const START = '2025-09-08';                        // понедельник первой недели, с него же считаются недели
const OFF = { mon: 0, wed: 2, fri: 4 };
const WEEKS = 10;                                  // в десятой неделе записан только понедельник: «сегодня» в проверках — её среда
const EMPTY_WEEK = 5;                              // неделя без тренировок
const MISSED = { '2:wed': true };                  // одна пропущенная тренировка
const dateOf = (week, slot) => C.addDays(START, 7 * (week - 1) + OFF[slot]);
const trains = (week, slot) => week !== EMPTY_WEEK && !MISSED[week + ':' + slot] && !(week === WEEKS && slot !== 'mon');

/* ---------- справочник первого профиля ----------
   Названия и мышцы — из встроенного справочника приложения (app/src/core/starter.ts); исключение — leg_curl_lying:
   у первого профиля оно названо иначе, чем у второго, и так проверяется общий справочник двух профилей.
   Справочник записан «по-старому», как его писала ранняя версия дневника: без снарядов, с полями step и round.
   Их давно никто не читает (шаг веса берётся от снаряда), и проверки смотрят, что это так: значения условные,
   часть нарочно не равна шагу снаряда (тесты эталона ждут 5 у вертикальной тяги, жима ногами и отведения ног). */
const BACK = { upper_back: 1, lats: 0.5, delt_rear: 0.5, biceps: 0.5 }, PULL = { lats: 1, upper_back: 0.5, biceps: 0.5 };
const EX = {
  bench:             { n: 'Жим лежа', mode: 'cycle', pat: 'h_push', m: { chest: 1, triceps: 0.5, delt_front: 0.5 }, round: 5 },
  leg_press:         { n: 'Жим ногами', mode: 'cycle', pat: 'knee', m: { quads: 1, glutes: 0.5 }, round: 5 },
  pullup:            { n: 'Подтягивания', mode: 'cycle', pat: 'v_pull', m: PULL, round: 1 },
  incline_db:        { n: 'Жим гантелей под углом 45', pat: 'h_push', m: { chest: 1, delt_front: 0.5, triceps: 0.5 }, step: 1 },
  pec_fly:           { n: 'Бабочка', pat: 'iso', m: { chest: 1, delt_front: 0.5 }, step: 2.5 },
  lat_pulldown:      { n: 'Вертикальная тяга в тренажере', pat: 'v_pull', m: PULL, step: 5 },
  row_machine:       { n: 'Горизонтальная тяга в тренажере', pat: 'h_pull', m: BACK, step: 5 },
  tbar_row:          { n: 'Горизонтальная тяга Т-бар', pat: 'h_pull', m: BACK, step: 5 },
  lat_raise_db:      { n: 'Махи с гантелями на плечи', pat: 'iso', m: { delt_mid: 1 }, step: 1 },
  lat_raise_machine: { n: 'Средние дельты в тренажере', pat: 'iso', m: { delt_mid: 1 }, step: 5 },
  barbell_curl:      { n: 'Бицепс со штангой стоя', pat: 'iso', m: { biceps: 1 }, step: 5 },
  hammer:            { n: 'Молотки с гантелями', pat: 'iso', m: { biceps: 1, forearms: 0.5 }, step: 1 },
  bayesian_curl:     { n: 'Бицепс Bayesian curl', pat: 'iso', m: { biceps: 1 }, step: 5 },
  tri_pushdown:      { n: 'Трицепс с косичкой на блоке', pat: 'iso', m: { triceps: 1 }, step: 5 },
  tri_overhead:      { n: 'Трицепс из за головы на блоке с косичкой', pat: 'iso', m: { triceps: 1 }, step: 1.25 },
  wrist_db_r:        { n: 'Кисть с гантелью правая рука', pat: 'iso', m: { forearms: 1 }, uni: true, step: 1 },
  wrist_db_l:        { n: 'Кисть с гантелью левая рука', pat: 'iso', m: { forearms: 1 }, uni: true, step: 1 },
  wrist_cable_r:     { n: 'Кисть на блоке правая', pat: 'iso', m: { forearms: 1 }, uni: true, step: 1.25 },
  wrist_cable_l:     { n: 'Кисть на блоке левая', pat: 'iso', m: { forearms: 1 }, uni: true, step: 1.25 },
  leg_ext:           { n: 'Разгибания ног в тренажере', pat: 'iso', m: { quads: 1 }, step: 5 },
  leg_curl_lying:    { n: 'Бицепс бедра на тренажере лежа на животе', pat: 'iso', m: { hams: 1 }, step: 5 },
  leg_curl_seated:   { n: 'Бицепс бедра сидя в тренажере', pat: 'iso', m: { hams: 1 }, step: 5 },
  abs:               { n: 'Пресс', pat: 'iso', m: { abs: 1 }, step: 1 }
};
const clone = o => JSON.parse(JSON.stringify(o));
const CYCLE = { inc: 2, sets: 4, pct: { 3: 87, 4: 82, 5: 77 } }, ZONES = { min: 4, opt: 10, high: 20 };
const configMain = {
  start: START, zones: ZONES, cycle: CYCLE,
  method: 'Примерный дневник: атлет выдуман, записи посчитаны генератором data/make.cjs. Занятий в неделе три. Три базовых упражнения - жим лежа, жим ногами, подтягивания - ведутся волной: четыре подхода на 5, 4 и 3 повтора при 77, 82 и 87 процентах от расчётного максимума; максимум за неделю прибавляет не больше 2 процентов. В остальных упражнениях сначала растут повторы, потом вес, у каждого подхода свой счёт; до отказа остаётся один повтор.',
  ex: clone(EX)
};
const cfg = C.mergeCfg(configMain);

/* ---------- первая тренировка каждого дня ----------
   Базовое: вес четырёх подходов первой недели (77% × 5). Подсобка: число подходов и диапазон; вес и повторы — из модели MODEL.
   Два диапазона нарочно уже, чем даёт формула «шаг веса в % / 2.5» (трицепс из-за головы и бицепс Bayesian):
   на них видна поправка «Диапазон по шагу веса». */
const WEEK1 = {
  mon: [['bench', 70], ['lat_pulldown', 4, '8-12'], ['leg_curl_seated', 4, '8-12'], ['lat_raise_machine', 4, '8-13'], ['tri_overhead', 3, '8-13'], ['hammer', 3, '8-14']],
  wed: [['leg_ext', 3, '8-12'], ['leg_press', 155], ['incline_db', 4, '8-12'], ['row_machine', 4, '8-12'], ['lat_raise_db', 3, '8-16'], ['barbell_curl', 3, '8-12'], ['wrist_cable_r', 3, '8-16'], ['wrist_cable_l', 3, '8-16']],
  fri: [['pullup', 72.5], ['pec_fly', 4, '8-12'], ['leg_curl_lying', 3, '8-12'], ['tri_pushdown', 4, '8-12'], ['bayesian_curl', 3, '8-16'], ['abs', 3, '10-15'], ['wrist_db_r', 3, '8-16'], ['wrist_db_l', 3, '8-16']]
};
/* ---------- модель подсобки ----------
   w, r — вес и повторы первого подхода в самой первой тренировке упражнения; g — на какую долю растёт «потолок» за тренировку;
   f — на какую долю каждый следующий подход слабее предыдущего; turn — после какой по счёту тренировки рост меняется на g2 (застой или откат). */
const MODEL = {
  lat_pulldown:      { w: 52.5, r: 10, g: 0.013, f: 0.030 },
  leg_curl_seated:   { w: 35,   r: 10, g: 0.012, f: 0.028 },
  lat_raise_machine: { w: 20,   r: 12, g: 0.012, f: 0.032 },
  tri_overhead:      { w: 17.5, r: 11, g: 0.013, f: 0.034 },
  hammer:            { w: 14,   r: 12, g: 0.012, f: 0.030 },
  leg_ext:           { w: 45,   r: 11, g: 0.011, f: 0.026 },
  incline_db:        { w: 22,   r: 10, g: 0.013, f: 0.036 },
  row_machine:       { w: 45,   r: 11, g: -0.003, f: 0.030 },                        // стоит на месте — на седьмой неделе заменено на тягу Т-бар
  tbar_row:          { w: 30,   r: 10, g: 0.014, f: 0.030 },
  lat_raise_db:      { w: 10,   r: 13, g: 0.004, f: 0.040, turn: 1, g2: -0.030 },   // откатывается — на седьмой неделе убрано
  barbell_curl:      { w: 27.5, r: 10, g: 0.012, f: 0.032 },
  wrist_cable_r:     { w: 12.5, r: 14, g: 0.013, f: 0.030 },
  wrist_cable_l:     { w: 12.5, r: 12, g: 0.011, f: 0.034 },                         // левая слабее правой
  pec_fly:           { w: 40,   r: 11, g: 0.013, f: 0.030 },
  leg_curl_lying:    { w: 30,   r: 11, g: 0.008, f: 0.030, turn: 3, g2: 0 },         // с четвёртой тренировки стоит
  tri_pushdown:      { w: 22.5, r: 10, g: 0.012, f: 0.034, turn: 3, g2: -0.004 },   // с четвёртой тренировки без рекордов
  bayesian_curl:     { w: 10,   r: 13, g: 0.014, f: 0.036 },
  wrist_db_r:        { w: 10,   r: 14, g: 0.012, f: 0.032 },
  wrist_db_l:        { w: 10,   r: 12, g: 0.010, f: 0.036 }
};
const ABS = [[15, 13, 12], [15, 14, 12], [15, 14, 13], [15, 15, 13]];   // пресс без веса: повторы трёх тренировок, модели по весу тут нет

/* ---------- что менялось по ходу: «день:неделя» → правка состава ---------- */
const DROP = { 'wed:7': ['row_machine', 'lat_raise_db'], 'fri:6': ['abs'] };
const ADD = { 'wed:7': [{ ex: 'tbar_row', n: 4, rng: '8-12', after: 'incline_db' }], 'fri:6': [{ ex: 'leg_ext', n: 3, rng: '8-12', after: 'bayesian_curl' }] };
/* незакрытый последний подход в волне: неделя повторяется без прибавки */
const FAIL = { 'wed:7:leg_press': true };
/* особые записи: «день:неделя:упражнение» → что случилось */
const unknown = it => { it.sets.forEach(s => { s.r = null; }); };
const skipped = it => { it.skip = true; it.sets.forEach(s => { s.r = null; s.skip = true; }); };
const SPECIAL = {
  'mon:4:leg_curl_seated': unknown,                                                       // повторы не записаны — вся строка
  'mon:7:lat_pulldown': it => { it.sets.unshift({ w: 30, r: 15, warm: true }); },         // разминочный подход
  'mon:10:hammer': it => { it.sets[1].w = it.sets[0].w; it.sets[1].r = Math.max(1, it.sets[0].r - 4); },   // второй подход тем же весом — и на четыре повтора меньше
  'wed:3:incline_db': it => { it.sets.unshift({ w: 14, r: 12, warm: true }); },
  'wed:7:tbar_row': it => { it.note = 'узкая рукоять'; },
  'wed:8:wrist_cable_r': skipped,                                                         // пара «не делал»
  'wed:8:wrist_cable_l': skipped,
  'wed:9:incline_db': it => { it.sets[2].r = null; },                                     // последняя среда: один подход и целая строка без повторов
  'wed:9:barbell_curl': unknown,
  'wed:9:leg_ext': it => { it.sets[2].r = it.range[0] - 1; },                             // ниже нижней границы
  'fri:4:pec_fly': it => { it.note = 'сиденье на деление ниже'; },
  'fri:7:tri_pushdown': skipped,
  'fri:8:bayesian_curl': it => { it.sets[1].r = null; },
  'fri:9:pec_fly': it => { it.sets[0].r = it.range[1] + 2; }                              // выше верхней границы на два
};
const NOTES = { 'mon:6': 'первая после недели без тренировок' };

/* ---------- расчёт ---------- */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seen = {};                                    // сколько тренировок упражнения уже записано
const ceiling = (ex, t) => { const m = MODEL[ex]; let e = m.w * (1 + (m.r + 1) / 30); for (let k = 0; k < t; k++) e *= 1 + (m.turn != null && k >= m.turn ? m.g2 : m.g); return e; };
function repsOf(ex, t, i, w, range, rested) {
  const m = MODEL[ex], e = ceiling(ex, t) * (1 - m.f * i) * (rested ? 0.985 : 1);            // после недели без тренировок — чуть слабее
  const h = hash(ex + ':' + t + ':' + i), wobble = h % 7 === 0 ? -1 : h % 7 === 6 ? 1 : 0;   // живой человек: иногда повтором больше или меньше
  let r = Math.floor(30 * (e / w - 1) + 1e-6) - 1 + wobble;                                  // до отказа оставляет один повтор
  if (r > range[1]) r = (h >> 3) % 5 === 0 ? range[1] + 1 : range[1];                        // взял верх диапазона — дальше не идёт; изредка на повтор больше
  return Math.max(1, r);
}
const item = (ex, o) => Object.assign({ ex, cyc: null, range: null, sets: [], note: '', skip: false, rir: null, tm: null }, o);
function fresh(ex, n, rng) { const m = MODEL[ex]; return item(ex, { range: rng.split('-').map(Number), sets: Array.from({ length: n }, () => ({ w: ex === 'abs' ? 0 : m.w, r: null })) }); }

let W = [];
for (let week = 1; week <= WEEKS; week++) for (const slot of ['mon', 'wed', 'fri']) {
  if (!trains(week, slot)) continue;
  const date = dateOf(week, slot), key = slot + ':' + week, first = !W.some(w => w.slot === slot);
  let items = first
    ? WEEK1[slot].map(([ex, a, rng]) => rng ? fresh(ex, a, rng) : item(ex, { cyc: { pct: 77, reps: 5 }, sets: Array.from({ length: 4 }, () => ({ w: a, r: null })) }))
    : C.plan(W, cfg, slot, date).items;
  if (DROP[key]) items = items.filter(it => !DROP[key].includes(it.ex));
  for (const a of ADD[key] || []) items.splice(items.findIndex(it => it.ex === a.after) + 1, 0, fresh(a.ex, a.n, a.rng));
  const rested = week === EMPTY_WEEK + 1;
  for (const it of items) {
    const t = seen[it.ex] || 0, sp = SPECIAL[key + ':' + it.ex];
    if (it.cyc) it.sets.forEach((s, i) => { s.r = it.cyc.reps - (FAIL[key + ':' + it.ex] && i === it.sets.length - 1 ? 1 : 0); });
    else if (it.ex === 'abs') it.sets.forEach((s, i) => { s.r = ABS[t][i]; });
    else it.sets.forEach((s, i) => { s.r = repsOf(it.ex, t, i, s.w, it.range, rested); });
    if (sp) sp(it);
    if (!it.skip) seen[it.ex] = t + 1;
  }
  const w = { id: date, date, slot, note: NOTES[key] || '', open: false, items };
  W = C.sortW(W.concat([C.fromDoc(date, C.toDoc(w))]));
}
const workouts = W.map(w => C.toDoc(w));

/* ---------- второй профиль: без базовых по процентам, запас два повтора, записей нет ---------- */
const EX2 = {
  hip_thrust:     { n: 'Ягодичный мост со штангой', pat: 'hinge', m: { glutes: 1, hams: 0.5 }, step: 2.5 },
  rdl:            { n: 'Румынская тяга', pat: 'hinge', m: { hams: 1, glutes: 1, erectors: 1 }, step: 5 },
  squat:          { n: 'Приседания со штангой', pat: 'knee', m: { quads: 1, glutes: 0.5 }, step: 5 },
  leg_press:      { n: 'Жим ногами', pat: 'knee', m: { quads: 1, glutes: 0.5 }, step: 10 },
  lunge:          { n: 'Выпады с гантелями', pat: 'knee', m: { quads: 1, glutes: 1 }, step: 2 },
  back_ext:       { n: 'Гиперэкстензия', pat: 'hinge', m: { erectors: 1, glutes: 0.5, hams: 0.5 }, step: 5, lo: 10, hi: 15 },
  abduction:      { n: 'Отведение ног в тренажере', pat: 'iso', m: { glutes: 1 }, step: 5, lo: 10, hi: 15 },
  leg_curl_lying: { n: 'Сгибания ног лежа', pat: 'iso', m: { hams: 1 }, step: 5, lo: 10, hi: 15 },
  lat_pulldown:   { n: 'Вертикальная тяга в тренажере', pat: 'v_pull', m: PULL, step: 2.5 },
  row_machine:    { n: 'Горизонтальная тяга в тренажере', pat: 'h_pull', m: BACK, step: 5 },
  db_bench:       { n: 'Жим гантелей лежа', pat: 'h_push', m: { chest: 1, delt_front: 0.5, triceps: 0.5 }, step: 2 },
  chest_press:    { n: 'Жим в тренажере на грудь', pat: 'h_push', m: { chest: 1, delt_front: 0.5, triceps: 0.5 }, step: 2.5 },
  db_ohp:         { n: 'Жим гантелей сидя', pat: 'v_push', m: { delt_front: 1, delt_mid: 0.5, triceps: 0.5 }, step: 2 },
  lat_raise:      { n: 'Махи гантелями в стороны', pat: 'iso', m: { delt_mid: 1 }, step: 2, lo: 10, hi: 20 },
  abs:            { n: 'Пресс', pat: 'iso', m: { abs: 1 }, step: 1, lo: 10, hi: 15 }
};
const TODAY = dateOf(WEEKS, 'wed');                 // «сегодня» в проверках: среда десятой недели
const program2 = {
  name: 'Пример: всё тело три раза в неделю', focus: '', others: '', lean: true, since: C.addDays(TODAY, -1), made: C.addDays(TODAY, -1),
  slots: {
    mon: [['hip_thrust', 3], ['leg_press', 4], ['db_ohp', 3], ['back_ext', 3], ['leg_curl_lying', 3], ['abs', 3]],
    wed: [['squat', 3], ['lat_pulldown', 3], ['chest_press', 3], ['row_machine', 4], ['abduction', 3], ['lat_raise', 2]],
    fri: [['rdl', 3], ['lunge', 4], ['db_bench', 3], ['lat_pulldown', 3], ['lat_raise', 3], ['abduction', 2]]
  }
};
for (const sl of Object.keys(program2.slots)) program2.slots[sl] = program2.slots[sl].map(([ex, n]) => ({ ex, n }));
const config2 = {
  start: dateOf(WEEKS, 'mon'), zones: ZONES, cycle: CYCLE, rir: 2, bw: 'track', ignore: { forearms: 1, calves: 1 },
  method: 'Примерный второй профиль: атлет выдуман. Базовых по процентам нет: каждое упражнение ведётся двойной прогрессией, до отказа остаётся два повтора. Вес тела только записывается.',
  ex: clone(EX2), program: clone(program2)
};

/* Тот же профиль, каким его хранит приложение после настройки: общий справочник двух профилей, выбранные снаряды
   (старые шаги рядом — они не читаются), названные атлетом веса всех видов: рабочий вес с повторами в диапазоне и вне его,
   только вес, только разовый максимум, и то и другое. Ещё одна мышца вне расчёта и свой отдых между подходами. */
const GEAR2 = { machine: ['abduction', 'chest_press', 'lat_pulldown', 'lat_raise_machine', 'leg_curl_seated', 'leg_ext', 'leg_press', 'pec_fly', 'row_machine'],
  barbell: ['barbell_curl', 'bench', 'hip_thrust', 'rdl', 'squat', 'tbar_row'], cable: ['tri_overhead', 'tri_pushdown', 'wrist_cable_l', 'wrist_cable_r'],
  dumbbell: ['db_bench', 'db_ohp', 'hammer', 'incline_db', 'lat_raise', 'lat_raise_db', 'lunge', 'wrist_db_l', 'wrist_db_r'] };
const KNOWN2 = { squat: { max: 55 }, hip_thrust: { work: 60, workR: 10 }, rdl: { work: 35, workR: 9 }, leg_press: { work: 70, workR: 15 }, lunge: { work: 10, workR: 10 },
  lat_pulldown: { work: 30, workR: 11 }, db_ohp: { work: 6 }, abduction: { work: 40, workR: 14 }, chest_press: { work: 15, workR: 12, max: 30 }, row_machine: { work: 25, workR: 10 },
  lat_raise: { work: 4 }, leg_curl_lying: { work: 20, workR: 13 } };
const sorted = o => Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sorted(o[k])])) : o;
const stored2ex = {};
for (const id of Object.keys(Object.assign({}, EX, EX2))) {
  const own = EX2[id], e = clone(own || EX[id]);
  delete e.mode; delete e.round;
  if (!own) { if (id === 'bayesian_curl' || id === 'pec_fly') e.step = EX[id].step; else delete e.step; }   // у своих упражнений старые шаги остались, у пришедших из первого профиля — только у двух
  if (id === 'pullup') e.step = 1;
  const g = Object.keys(GEAR2).find(k => GEAR2[k].includes(id));
  if (g) e.gear = g;
  stored2ex[id] = Object.assign(e, KNOWN2[id] || {});
}
const stored2 = sorted({ bw: 'track', cycle: CYCLE, ex: stored2ex, gear: { barbell: { step: 2.5 }, cable: { step: 2.5 }, dumbbell: { step: 2 }, machine: { step: 2.5 } },
  ignore: { calves: 1, chest: 1, forearms: 1 }, method: '', program: program2, rest: 90, rir: 2, start: config2.start, zones: ZONES });

/* ---------- тот же дневник неделей позже: резервная копия, какой её выгружает приложение ----------
   Второй набор записей для проверок. В нём есть то, чего нет в первом: запас в подходах — от отказа до большого,
   тренировка, записанная не в свой день недели, вес тела, свой снаряд, общий справочник двух профилей,
   а у второго профиля — принятая программа с приоритетом и первые тренировки. */
/* пояс заведён на десятой неделе: записи подтягиваний до него посчитаны с прежним округлением 2.5 кг и на сетку 1 кг не ложатся — так и задумано */
const exLater = clone(EX);
for (const id of Object.keys(EX2)) if (!exLater[id]) exLater[id] = clone(EX2[id]);
exLater.pullup.gear = 'belt';
const configLater = sorted({ cycle: CYCLE, ex: exLater, gear: { belt: { n: 'Пояс с отягощением', step: 1 } }, method: configMain.method, start: START, zones: ZONES });
const cfgLater = C.mergeCfg(configLater);
/* запас в подходах базовых: отказ в последнем подходе, запас заметно больше расчётного, запас меньше расчётного */
const RESERVE = { leg_press: [2, 2, 1, 0], pullup: [3, 3, 3, 3], bench: [1, 1, 1, 1] };
const reserveOf = (ex, t, i) => [1, 1, 2, 1, 0, 1, 3][hash('q:' + ex + ':' + t + ':' + i) % 7];
let WL = W.slice();
for (const [slot, date] of [['wed', dateOf(WEEKS, 'wed')], ['fri', C.addDays(dateOf(WEEKS, 'fri'), 1)], ['mon', dateOf(WEEKS + 1, 'mon')]]) {   // пятничная тренировка записана в субботу
  const items = C.plan(WL, cfgLater, slot, date).items;
  for (const it of items) {
    const t = seen[it.ex] || 0;
    if (it.cyc) it.sets.forEach((x, i) => { x.r = it.cyc.reps; x.q = RESERVE[it.ex][i]; });
    else it.sets.forEach((x, i) => { x.r = repsOf(it.ex, t, i, x.w, it.range, false); x.q = reserveOf(it.ex, t, i); });
    seen[it.ex] = t + 1;
  }
  WL = C.sortW(WL.concat([C.fromDoc(date, C.toDoc({ id: date, date, slot, note: slot === 'fri' ? 'в субботу вместо пятницы' : '', open: false, items }))]));
}
const body = [[C.addDays(TODAY, -9), 69.4], [C.addDays(TODAY, -2), 69.8], [C.addDays(TODAY, 5), 70.1]].map(([date, kg]) => ({ id: date, date, kg }));

/* второй профиль: принята сборка «ягодицы в приоритете» с лимитом 70 — так, как её сохраняет экран «Программа» */
const built = C.buildProgram([], C.mergeCfg(stored2), { prio: 'glutes', budget: 70 }), raw2 = clone(stored2), ACCEPTED = C.addDays(TODAY, 1);
for (const [id, def] of Object.entries(built.create)) if (!raw2.ex[id]) raw2.ex[id] = clone(def);
const prevGoals = {};
for (const [id, g] of Object.entries(built.goals)) { if (!raw2.ex[id]) continue; prevGoals[id] = raw2.ex[id].goal || ''; if (g) raw2.ex[id].goal = g; else delete raw2.ex[id].goal; }
raw2.program = { name: built.name, focus: built.focus || '', others: built.others || '', since: ACCEPTED, made: ACCEPTED,
  slots: Object.fromEntries(C.SLOTS.map(sl => [sl.id, built.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex })])), prev: { goals: prevGoals, program: clone(stored2.program) }, prio: 'glutes', budget: 70 };
const configLater2 = sorted(raw2), cfgLater2 = C.mergeCfg(configLater2);
/* две первые тренировки по принятой программе: вес — названный атлетом или из таблицы, повторы — от нижней границы, запас — около двух повторов */
const START2 = { back_ext: 0, abs: 0, db_bench: 8, lunge: 10, lat_raise: 4, db_ohp: 6 };
let W2 = [];
for (const [slot, date] of [['fri', dateOf(WEEKS, 'fri')], ['mon', dateOf(WEEKS + 1, 'mon')]]) {
  const items = C.plan(W2, cfgLater2, slot, date).items;
  for (const it of items) it.sets.forEach((x, i) => { const h = hash('p2:' + it.ex + ':' + date + ':' + i); if (x.w == null) x.w = START2[it.ex] != null ? START2[it.ex] : 10; x.r = Math.max(it.range[0], it.range[1] - 1 - i - h % 2); x.q = [2, 2, 3, 2, 1][h % 5]; });
  W2 = C.sortW(W2.concat([C.fromDoc(date, C.toDoc({ id: date, date, slot, note: '', open: false, items }))]));
}
const asDocs = list => list.map(w => Object.assign({ id: w.date }, C.toDoc(w)));
const later = { format: 'training-diary-backup', version: 1, exportedAt: C.addDays(TODAY, 7) + 'T08:00:00.000Z', profiles: [
  { id: 'me', name: 'Мой дневник', config: configLater, workouts: asDocs(WL), body, coach: null },
  { id: 'p2', name: 'Второй профиль', config: configLater2, workouts: asDocs(W2), body: [], coach: null }] };

/* ---------- файлы ---------- */
const files = { 'workouts.json': workouts, 'config.json': configMain, 'config.p2.json': config2, 'config.p2.stored.json': stored2, 'later.json': later };
const text = v => JSON.stringify(v, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const off = Object.keys(files).filter(f => { try { return fs.readFileSync(path.join(__dirname, f), 'utf8') !== text(files[f]); } catch (e) { return true; } });
  console.log(off.length ? 'Файлы в data/ не совпадают с выводом генератора: ' + off.join(', ') : 'Файлы в data/ совпадают с выводом генератора');
  process.exit(off.length ? 1 : 0);
}
for (const f of Object.keys(files)) fs.writeFileSync(path.join(__dirname, f), text(files[f]));
const setsN = workouts.reduce((a, d) => a + d.items.reduce((b, it) => b + String(it.sets).split(' ').length, 0), 0);
console.log('Примерные данные записаны: тренировок ' + workouts.length + ' (' + workouts[0].date + ' … ' + workouts[workouts.length - 1].date + '), подходов ' + setsN + '; «сегодня» в проверках — ' + TODAY
  + '. Неделей позже: тренировок ' + later.profiles[0].workouts.length + ' и ' + later.profiles[1].workouts.length + ', выгрузка ' + later.exportedAt.slice(0, 10));
