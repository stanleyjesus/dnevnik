/* Встроенный справочник упражнений (решение владельца, 18 ноября 2026): в эталоне его нет.
   Профиль без упражнений получает этот список — с ним программу можно собрать сразу, не заводя упражнения руками.
   Это справочные данные, как мышцы и типовые упражнения сборки, а не записи: в хранилище список попадает
   только при первом сохранении настройки профиля, пустое хранилище остаётся рабочим состоянием.

   Состав: 34 упражнения основного набора (id, мышцы и снаряды — из исходного справочника дневника)
   и 29 распространённых упражнений зала. Каждое лежит на снаряде: «Без снаряда» во встроенном списке пусто.
   Базовые (жим лежа, жим ногами, подтягивания) идут по волне, остальные — двойная прогрессия. */
import { clone } from './records.ts';
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
  chest_press: { n: 'Жим в тренажере на грудь', pat: 'h_push', m: PRESS, gear: 'machine' },
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
  close_grip_bench: { n: 'Жим лежа узким хватом', pat: 'h_push', m: { triceps: 1, chest: 0.5, delt_front: 0.5 }, gear: 'barbell' },
  cable_fly: { n: 'Сведение рук в кроссовере', pat: 'iso', m: FLY, gear: 'cable' },
  db_fly: { n: 'Разводка гантелей лежа', pat: 'iso', m: FLY, gear: 'dumbbell' },
  pulldown_cable: { n: 'Тяга верхнего блока', pat: 'v_pull', m: PULL, gear: 'cable' },
  pullover_cable: { n: 'Пуловер на верхнем блоке', pat: 'iso', m: { lats: 1 }, lo: 10, hi: 15, gear: 'cable' },
  seated_row: { n: 'Тяга нижнего блока к поясу', pat: 'h_pull', m: ROW, gear: 'cable' },
  barbell_row: { n: 'Тяга штанги в наклоне', pat: 'h_pull', m: ROW, gear: 'barbell' },
  db_row: { n: 'Тяга гантели в наклоне', pat: 'h_pull', m: ROW, gear: 'dumbbell' },
  shrug: { n: 'Шраги с гантелями', pat: 'iso', m: { upper_back: 1 }, gear: 'dumbbell' },
  ohp: { n: 'Жим штанги стоя', pat: 'v_push', m: OHP, gear: 'barbell' },
  shoulder_press_machine: { n: 'Жим в тренажере на плечи', pat: 'v_push', m: OHP, gear: 'machine' },
  cable_lat_raise: { n: 'Махи в стороны на блоке', pat: 'iso', m: { delt_mid: 1 }, lo: 10, hi: 20, gear: 'cable' },
  face_pull: { n: 'Тяга к лицу на блоке', pat: 'iso', m: REAR, gear: 'cable' },
  rear_delt_db: { n: 'Махи гантелями в наклоне', pat: 'iso', m: REAR, gear: 'dumbbell' },
  db_curl: { n: 'Сгибания рук с гантелями', pat: 'iso', m: { biceps: 1 }, gear: 'dumbbell' },
  cable_curl: { n: 'Сгибания рук на блоке', pat: 'iso', m: { biceps: 1 }, gear: 'cable' },
  preacher_curl: { n: 'Сгибания рук на скамье Скотта', pat: 'iso', m: { biceps: 1 }, gear: 'barbell' },
  skullcrusher: { n: 'Французский жим лежа', pat: 'iso', m: { triceps: 1 }, gear: 'barbell' },
  wrist_curl: { n: 'Сгибания кистей со штангой', pat: 'iso', m: { forearms: 1 }, gear: 'barbell' },
  hack_squat: { n: 'Гакк-приседания', pat: 'knee', m: SQUAT, gear: 'machine' },
  bulgarian: { n: 'Болгарские выпады с гантелями', pat: 'knee', m: LUNGE, gear: 'dumbbell' },
  deadlift: { n: 'Становая тяга', pat: 'hinge', m: RDL, gear: 'barbell' },
  db_rdl: { n: 'Румынская тяга с гантелями', pat: 'hinge', m: RDL, gear: 'dumbbell' },
  glute_bridge_machine: { n: 'Ягодичный мост в тренажере', pat: 'hinge', m: BRIDGE, gear: 'machine' },
  cable_kickback: { n: 'Отведение ноги назад на блоке', pat: 'iso', m: { glutes: 1 }, lo: 10, hi: 15, gear: 'cable' },
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
/** Настройка профиля, как она сохранена, — или она же со встроенным списком, если своих упражнений в ней нет.
    Свой справочник профиля список не трогает: ни одно упражнение к нему само не добавляется */
export function withStarter<T extends { ex?: Record<string, ExDef>; gear?: Record<string, { n?: string; step?: number }> }>(raw: T | null | undefined): T {
  const r = (raw || {}) as T;
  if (r.ex && Object.keys(r.ex).length) return r;
  return Object.assign({}, r, { ex: clone(STARTER), gear: Object.assign(clone(STARTER_GEAR), r.gear || {}) });
}
