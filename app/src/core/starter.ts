/* Встроенный справочник упражнений (решение владельца, 18 ноября 2026): в эталоне его нет.
   Профиль без упражнений получает этот список — с ним программу можно собрать сразу, не заводя упражнения руками.
   Это справочные данные, как мышцы и типовые упражнения сборки, а не записи: в хранилище список попадает
   только при первом сохранении настройки профиля, пустое хранилище остаётся рабочим состоянием.

   Состав: 34 упражнения основного набора (id, мышцы и снаряды — из исходного справочника дневника)
   и 44 распространённых упражнения зала. Каждое лежит на снаряде: «Без снаряда» во встроенном списке пусто.
   28 ноября 2026 (просьба владельца, пункты 7–9): жим в тренажёре на грудь назван «сидя» — под углом это другое упражнение,
   и добавлено 15 упражнений: варианты для разнообразия по дням недели (docs/03, раздел 23), растянутые варианты
   и прямая работа на ягодицы. Упражнения в тренажёре Смита лежат на снаряде «Тренажёр».
   Базовые (жим лежа, жим ногами, подтягивания) идут по волне, остальные — двойная прогрессия. */
import { clone } from './records.ts';
import { GEAR, NO_GEAR, gearGuess } from './gear.ts';
import type { ExDef, MuscleMap } from './types.ts';

/** Снаряд сверх четырёх обычных, который нужен списку: подтягивания считаются с шагом 1 кг (решение владельца) */
export const STARTER_GEAR: Record<string, { n: string; step: number }> = { g_pullup: { n: 'Подтягивания', step: 1 } };

const PRESS: MuscleMap = { chest: 1, delt_front: 0.5, triceps: 0.5 }, OHP: MuscleMap = { delt_front: 1, delt_mid: 0.5, triceps: 0.5 };
const PULL: MuscleMap = { lats: 1, upper_back: 0.5, biceps: 0.5 }, ROW: MuscleMap = { upper_back: 1, lats: 0.5, delt_rear: 0.5, biceps: 0.5 };
const SQUAT: MuscleMap = { quads: 1, glutes: 0.5 }, LUNGE: MuscleMap = { quads: 1, glutes: 1 }, RDL: MuscleMap = { hams: 1, glutes: 1, erectors: 1 };   // карта прежнего правила по названию: с днями «День N» румынская тяга читается с разгибателями, которые помогают (rules.ts, appEx)
const FLY: MuscleMap = { chest: 1, delt_front: 0.5 }, REAR: MuscleMap = { delt_rear: 1, upper_back: 0.5 }, BRIDGE: MuscleMap = { glutes: 1, hams: 0.5 };

/** Упражнения встроенного списка по id. Порядок — как их увидит новый профиль: сначала основной набор, затем распространённые */
export const STARTER: Record<string, ExDef> = {
  /* основной набор */
  bench: { n: 'Жим лежа', pat: 'h_push', m: PRESS, mode: 'cycle', gear: 'barbell' },
  leg_press: { n: 'Жим ногами', pat: 'knee', m: SQUAT, mode: 'cycle', gear: 'machine' },
  pullup: { n: 'Подтягивания', pat: 'v_pull', m: PULL, mode: 'cycle', gear: 'g_pullup' },
  chest_press: { n: 'Жим в тренажере на грудь сидя', pat: 'h_push', m: PRESS, gear: 'machine' },
  db_bench: { n: 'Жим гантелей лежа', pat: 'h_push', m: PRESS, gear: 'dumbbell' },
  incline_db: { n: 'Жим гантелей под углом 45', pat: 'h_push', m: PRESS, gear: 'dumbbell' },
  pec_fly: { n: 'Бабочка', pat: 'iso', m: FLY, gear: 'machine' },
  lat_pulldown: { n: 'Вертикальная тяга в тренажере', pat: 'v_pull', m: PULL, gear: 'machine' },
  row_machine: { n: 'Горизонтальная тяга в тренажере', pat: 'h_pull', m: ROW, gear: 'machine' },
  tbar_row: { n: 'Горизонтальная тяга Т-бар', pat: 'h_pull', m: ROW, gear: 'barbell' },
  db_ohp: { n: 'Жим гантелей сидя', pat: 'v_push', m: OHP, gear: 'dumbbell' },
  lat_raise: { n: 'Махи гантелями в стороны', pat: 'iso', m: { delt_mid: 1 }, lo: 10, hi: 20, gear: 'dumbbell' },
  lat_raise_db: { n: 'Махи с гантелями на плечи', pat: 'iso', m: { delt_mid: 1 }, gear: 'dumbbell' },
  lat_raise_machine: { n: 'Средние дельты в тренажере', pat: 'iso', m: { delt_mid: 1 }, gear: 'machine' },
  x_rear: { n: 'Обратная бабочка', pat: 'iso', m: REAR, gear: 'machine' },
  barbell_curl: { n: 'Бицепс со штангой стоя', pat: 'iso', m: { biceps: 1 }, gear: 'barbell' },
  bayesian_curl: { n: 'Бицепс Bayesian curl', pat: 'iso', m: { biceps: 1 }, gear: 'cable' },
  hammer: { n: 'Молотки с гантелями', pat: 'iso', m: { biceps: 1, forearms: 0.5 }, gear: 'dumbbell' },
  tri_pushdown: { n: 'Трицепс с косичкой на блоке', pat: 'iso', m: { triceps: 1 }, gear: 'cable' },
  tri_overhead: { n: 'Трицепс из за головы на блоке с косичкой', pat: 'iso', m: { triceps: 1 }, gear: 'cable' },
  wrist_cable_l: { n: 'Кисть на блоке левая', pat: 'iso', m: { forearms: 1 }, uni: true, gear: 'cable' },
  wrist_cable_r: { n: 'Кисть на блоке правая', pat: 'iso', m: { forearms: 1 }, uni: true, gear: 'cable' },
  wrist_db_l: { n: 'Кисть с гантелью левая рука', pat: 'iso', m: { forearms: 1 }, uni: true, gear: 'dumbbell' },
  wrist_db_r: { n: 'Кисть с гантелью правая рука', pat: 'iso', m: { forearms: 1 }, uni: true, gear: 'dumbbell' },
  squat: { n: 'Приседания со штангой', pat: 'knee', m: SQUAT, gear: 'barbell' },
  lunge: { n: 'Выпады с гантелями', pat: 'knee', m: LUNGE, gear: 'dumbbell' },
  leg_ext: { n: 'Разгибания ног в тренажере', pat: 'iso', m: { quads: 1 }, gear: 'machine' },
  leg_curl_lying: { n: 'Сгибания ног лежа', pat: 'iso', m: { hams: 1 }, lo: 10, hi: 15, gear: 'machine' },
  leg_curl_seated: { n: 'Бицепс бедра сидя в тренажере', pat: 'iso', m: { hams: 1 }, gear: 'machine' },
  rdl: { n: 'Румынская тяга', pat: 'hinge', m: RDL, gear: 'barbell' },
  hip_thrust: { n: 'Ягодичный мост со штангой', pat: 'hinge', m: BRIDGE, gear: 'barbell' },
  abduction: { n: 'Отведение ног в тренажере', pat: 'iso', m: { glutes: 1 }, lo: 10, hi: 15, gear: 'machine' },
  back_ext: { n: 'Гиперэкстензия', pat: 'hinge', m: { erectors: 1, glutes: 0.5, hams: 0.5 }, lo: 10, hi: 15, gear: 'barbell' },
  abs: { n: 'Пресс', pat: 'iso', m: { abs: 1 }, lo: 10, hi: 15, gear: 'machine' },
  /* распространённые упражнения зала: названия такие, что дневник читает из них те же мышцы */
  incline_bench: { n: 'Жим штанги под углом', pat: 'h_push', m: PRESS, gear: 'barbell' },
  incline_press_machine: { n: 'Жим в тренажере на грудь под углом', pat: 'h_push', m: PRESS, gear: 'machine' },
  smith_incline: { n: 'Жим в тренажере Смита под углом', pat: 'h_push', m: PRESS, gear: 'machine' },
  close_grip_bench: { n: 'Жим лежа узким хватом', pat: 'h_push', m: { triceps: 1, chest: 0.5, delt_front: 0.5 }, gear: 'barbell' },
  cable_fly: { n: 'Сведение рук в кроссовере', pat: 'iso', m: FLY, gear: 'cable' },
  db_fly: { n: 'Разводка гантелей лежа', pat: 'iso', m: FLY, gear: 'dumbbell' },
  cable_fly_low: { n: 'Сведение рук на блоке снизу вверх', pat: 'iso', m: FLY, gear: 'cable' },
  pulldown_cable: { n: 'Тяга верхнего блока', pat: 'v_pull', m: PULL, gear: 'cable' },
  pulldown_neutral: { n: 'Тяга верхнего блока параллельным хватом', pat: 'v_pull', m: PULL, gear: 'cable' },
  pullover_cable: { n: 'Пуловер на верхнем блоке', pat: 'iso', m: { lats: 1 }, lo: 10, hi: 15, gear: 'cable' },
  pullover_db: { n: 'Пуловер с гантелью лежа', pat: 'iso', m: { lats: 1 }, lo: 10, hi: 15, gear: 'dumbbell' },
  seated_row: { n: 'Тяга нижнего блока к поясу', pat: 'h_pull', m: ROW, gear: 'cable' },
  barbell_row: { n: 'Тяга штанги в наклоне', pat: 'h_pull', m: ROW, gear: 'barbell' },
  db_row: { n: 'Тяга гантели в наклоне', pat: 'h_pull', m: ROW, gear: 'dumbbell' },
  chest_row_db: { n: 'Тяга гантелей лежа на наклонной скамье', pat: 'h_pull', m: ROW, gear: 'dumbbell' },
  shrug: { n: 'Шраги с гантелями', pat: 'iso', m: { upper_back: 1 }, gear: 'dumbbell' },
  ohp: { n: 'Жим штанги стоя', pat: 'v_push', m: OHP, gear: 'barbell' },
  shoulder_press_machine: { n: 'Жим в тренажере на плечи', pat: 'v_push', m: OHP, gear: 'machine' },
  arnold: { n: 'Жим Арнольда с гантелями', pat: 'v_push', m: OHP, gear: 'dumbbell' },
  cable_lat_raise: { n: 'Махи в стороны на блоке', pat: 'iso', m: { delt_mid: 1 }, lo: 10, hi: 20, gear: 'cable' },
  face_pull: { n: 'Тяга к лицу на блоке', pat: 'iso', m: REAR, gear: 'cable' },
  rear_delt_db: { n: 'Махи гантелями в наклоне', pat: 'iso', m: REAR, gear: 'dumbbell' },
  db_curl: { n: 'Сгибания рук с гантелями', pat: 'iso', m: { biceps: 1 }, gear: 'dumbbell' },
  cable_curl: { n: 'Сгибания рук на блоке', pat: 'iso', m: { biceps: 1 }, gear: 'cable' },
  incline_curl: { n: 'Сгибания рук с гантелями на наклонной скамье', pat: 'iso', m: { biceps: 1 }, gear: 'dumbbell' },
  preacher_curl: { n: 'Сгибания рук на скамье Скотта', pat: 'iso', m: { biceps: 1 }, gear: 'barbell' },
  skullcrusher: { n: 'Французский жим лежа', pat: 'iso', m: { triceps: 1 }, gear: 'barbell' },
  tri_overhead_db: { n: 'Трицепс из-за головы с гантелью', pat: 'iso', m: { triceps: 1 }, gear: 'dumbbell' },
  wrist_curl: { n: 'Сгибания кистей со штангой', pat: 'iso', m: { forearms: 1 }, gear: 'barbell' },
  hack_squat: { n: 'Гакк-приседания', pat: 'knee', m: SQUAT, gear: 'machine' },
  smith_squat: { n: 'Приседания в тренажере Смита', pat: 'knee', m: SQUAT, gear: 'machine' },
  goblet_squat: { n: 'Кубковые приседания с гантелью', pat: 'knee', m: SQUAT, gear: 'dumbbell' },
  step_up: { n: 'Зашагивания на скамью с гантелями', pat: 'knee', m: LUNGE, gear: 'dumbbell' },
  bulgarian: { n: 'Болгарские выпады с гантелями', pat: 'knee', m: LUNGE, gear: 'dumbbell' },
  deadlift: { n: 'Становая тяга', pat: 'hinge', m: RDL, gear: 'barbell' },
  db_rdl: { n: 'Румынская тяга с гантелями', pat: 'hinge', m: RDL, gear: 'dumbbell' },
  glute_bridge_machine: { n: 'Ягодичный мост в тренажере', pat: 'hinge', m: BRIDGE, gear: 'machine' },
  smith_hip_thrust: { n: 'Ягодичный мост в тренажере Смита', pat: 'hinge', m: BRIDGE, gear: 'machine' },
  cable_kickback: { n: 'Отведение ноги назад на блоке', pat: 'iso', m: { glutes: 1 }, lo: 10, hi: 15, gear: 'cable' },
  kickback_machine: { n: 'Отведение ноги назад в тренажере', pat: 'iso', m: { glutes: 1 }, lo: 10, hi: 15, gear: 'machine' },
  cable_abduction: { n: 'Отведение ноги в сторону на блоке', pat: 'iso', m: { glutes: 1 }, lo: 10, hi: 15, gear: 'cable' },
  calf_standing: { n: 'Подъем на носки стоя', pat: 'iso', m: { calves: 1 }, lo: 10, hi: 15, gear: 'machine' },
  calf_seated: { n: 'Подъем на носки сидя', pat: 'iso', m: { calves: 1 }, lo: 10, hi: 15, gear: 'machine' },
  cable_crunch: { n: 'Скручивания на блоке', pat: 'iso', m: { abs: 1 }, lo: 10, hi: 15, gear: 'cable' }
};

/** Сколько упражнений в основном наборе: они стоят первыми */
export const STARTER_OWN = 34;

/** Название для сравнения: без регистра, «ё» как «е», знаки и лишние пробелы не в счёт */
export const exKey = (name: string | null | undefined) => String(name || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

/* снаряды типовых упражнений сборки, название которых снаряд не называет: сборка добавляет их в справочник сама */
const GEAR_BY_NAME: Record<string, string> = Object.fromEntries(([
  ['Жим над головой', 'dumbbell'], ['Махи в стороны', 'dumbbell'], ['Сгибания на бицепс', 'dumbbell'], ['Сгибания кисти', 'dumbbell'],
  ['Разгибания ног', 'machine'], ['Сгибания ног', 'machine'], ['Ягодичный мост', 'barbell'], ['Подъёмы на носки', 'machine']
] as [string, string][]).map(([n, g]) => [exKey(n), g]));
const BY_NAME: Record<string, string> = Object.fromEntries(Object.entries(STARTER).map(([id, e]) => [exKey(e.n), id]));

/** Упражнение встроенного списка для упражнения профиля: по id, иначе по названию; null — список такого не знает */
export const starterOf = (id: string, name: string | null | undefined): string | null => STARTER[id] ? id : BY_NAME[exKey(name)] || null;
/** Снаряд, на который встроенный список кладёт упражнение профиля; null — список его не знает */
export const starterGear = (id: string, name: string | null | undefined): string | null => { const s = starterOf(id, name); return s ? STARTER[s].gear! : GEAR_BY_NAME[exKey(name)] || null; };
/** Упражнения встроенного списка, которых в справочнике профиля нет ни по id, ни по названию */
export function starterMissing(ex: Record<string, { n?: string }> | null | undefined): string[] {
  const own = ex || {}, names = new Set(Object.values(own).map(e => exKey(e && e.n)));
  return Object.keys(STARTER).filter(id => !own[id] && !names.has(exKey(STARTER[id].n)));
}
type RawGear = Record<string, { n?: string; step?: number }>;
/** Свой снаряд встроенного списка (подтягивания) заводится в настройке, когда на него кладут упражнение */
export function needGear(raw: { gear?: RawGear }, g: string) {
  if (STARTER_GEAR[g] && !(raw.gear && raw.gear[g])) { raw.gear = raw.gear || {}; raw.gear[g] = clone(STARTER_GEAR[g]); }
}
/** Где упражнение лежит по настройке, как она сохранена: выбранный снаряд, если он есть (свой — с названием), иначе по названию, иначе «без снаряда» (как placed) */
const liesOn = (gear: RawGear, e: ExDef) => {
  const own = e.gear && gear[e.gear] && String(gear[e.gear].n || '').trim();
  return e.gear && (e.gear === NO_GEAR || GEAR.some(g => g.id === e.gear) || own) ? e.gear : gearGuess(e.n) || NO_GEAR;
};
/** Справочник профиля из резервной копии, дополненный встроенным (решение владельца, 25 ноября 2026: копия первой версии приносит свой
    список упражнений без снарядов, и встроенный справочник после загрузки пропадал). То же, что две кнопки «Настройки» (ui/starter.ts), сразу:
    - упражнение, которое лежит «без снаряда» только потому, что снаряда у него нет, ложится на снаряд, который знает встроенный список;
      «без снаряда», выбранное атлетом, и лёгкий день не трогаются; шаг и округление, оставшиеся от старых версий, не читаются и уходят, как у кнопки;
    - упражнения встроенного списка, которых нет ни по id, ни по названию, добавляются.
    Свои упражнения, их мышцы и названия, журнал и программа не меняются. Настройка без упражнений остаётся как есть: встроенный список
    подставит загрузка профиля (withStarter). Полный справочник, выгруженный приложением, возвращается без изменений */
export function fillStarter<T extends { ex?: Record<string, ExDef>; gear?: RawGear }>(raw: T | null | undefined): { raw: T | null | undefined; sorted: string[]; added: string[] } {
  if (!raw || !raw.ex || !Object.keys(raw.ex).length) return { raw, sorted: [], added: [] };
  const out = clone(raw) as T & { ex: Record<string, ExDef> }, gear = out.gear || {}, sorted: string[] = [];
  for (const id of Object.keys(out.ex)) {
    const e = out.ex[id];
    if (!e || e.mode === 'light' || e.gear === NO_GEAR || liesOn(gear, e) !== NO_GEAR) continue;
    const g = starterGear(id, e.n);
    if (!g || !(GEAR.some(x => x.id === g) || STARTER_GEAR[g] || gear[g])) continue;
    needGear(out, g); e.gear = g; delete e.step; delete e.round; sorted.push(id);
  }
  const added = starterMissing(out.ex);
  for (const id of added) { const def = clone(STARTER[id]); needGear(out, def.gear!); out.ex[id] = def; }
  return { raw: sorted.length || added.length ? out : raw, sorted, added };
}
/** Настройка профиля, как она сохранена, — или она же со встроенным списком, если своих упражнений в ней нет.
    Свой справочник профиля список не трогает: ни одно упражнение к нему само не добавляется */
export function withStarter<T extends { ex?: Record<string, ExDef>; gear?: Record<string, { n?: string; step?: number }> }>(raw: T | null | undefined): T {
  const r = (raw || {}) as T;
  if (r.ex && Object.keys(r.ex).length) return r;
  return Object.assign({}, r, { ex: clone(STARTER), gear: Object.assign(clone(STARTER_GEAR), r.gear || {}) });
}
