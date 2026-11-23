/* Записи профиля из хранилища в том виде, в каком с ними работает логика (src/core). */
import type { Doc, Store } from '../store/types.ts';
import type { BodyRec, Cfg, ExDef, Workout, WorkoutDoc } from '../core/types.ts';
import { fromDoc } from '../core/records.ts';
import { mergeCfg } from '../core/config.ts';
import { withStarter } from '../core/starter.ts';
import { sortW } from '../core/stats.ts';
import { mondayOf } from '../core/dates.ts';
import { paths } from './paths.ts';

/** cfgRaw — настройка как она сохранена (пишется всегда она); cfg — она же с подставленными умолчаниями */
export interface ProfileData { workouts: Workout[]; cfgRaw: Doc | null; cfg: Cfg; body: BodyRec[]; coach: Doc | null }

export async function loadProfile(store: Store, pid: string): Promise<ProfileData> {
  const pt = paths(pid);
  const [ws, cfgRaw, bs, coach] = await Promise.all([store.list(pt.w), store.get(pt.cfg), store.list(pt.body), store.get(pt.coach)]);
  return {
    workouts: sortW(ws.map(d => fromDoc(d.id, d.data as Partial<WorkoutDoc>))),
    cfgRaw,
    cfg: mergeCfg(withStarter(cfgRaw as { ex?: Record<string, ExDef> } | null)),   // профиль без упражнений считается со встроенным справочником, как на экране
    body: bs.map(d => ({ id: d.id, date: String(d.data.date || d.id), kg: +(d.data.kg as number) })).filter(x => x.kg > 0).sort((x, y) => x.date < y.date ? -1 : 1),
    coach
  };
}

/** Настройка для расчётов: если начало программы не задано, это понедельник первой тренировки */
export const readyCfg = (cfg: Cfg, workouts: Workout[], today: string): Cfg =>
  cfg.start ? cfg : Object.assign({}, cfg, { start: mondayOf(workouts.length ? workouts[0].date : today) });
