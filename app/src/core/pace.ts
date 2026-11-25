/* Время тренировки по факту (просьба владельца, 25 ноября 2026; docs/03, раздел 20). Только с днями «День N».
   В конце тренировки дневник спрашивает, сколько она шла (поле min записи). Оценка времени (time.ts, estMinutes) считает разминку, настройку снаряда,
   подходы и отдых по упражнению — у живого человека отдых и переходы обычно другие. Поэтому дневник сравнивает названное время с тем, что посчитал
   сам по сделанным подходам той же тренировки, и дальше множит свою оценку на этот темп — в плане, в оценке «осталось», в сборке программы под
   «Время на тренировку» и в поправке «Не делал два раза» (skips.ts). Правила — тренерские [Т]:
   - темп — медиана отношений «названное / посчитанное» по последним `n` тренировкам с записанным временем: одна долгая тренировка
     (разговор, очередь к тренажёру) его не сдвигает;
   - пока таких тренировок меньше `min`, темп 1 — оценка по формуле;
   - отношение вне `typo` — опечатка (5 минут вместо 50), его нет в расчёте; сам темп — не меньше `lo` и не больше `hi`;
   - темп округляется до `step`, чтобы оценка не прыгала от каждой новой записи. */
import { PACE } from './rules.ts';
import { estMinutes } from './time.ts';
import type { Cfg, Workout } from './types.ts';

export const PACE_RULE = { n: 5, min: 2, typo: [0.4, 2.5], lo: 0.75, hi: 1.75, step: 0.05 };
/** Названное время: целые минуты от 5 до 5 часов; иначе — не записано */
export const okMin = (v: number | null | undefined) => v != null && Number.isFinite(+v) && +v >= 5 && +v <= 300 ? Math.round(+v) : null;

/** Отношение «названное / посчитанное» у одной законченной тренировки; null — времени нет или посчитать нечего */
export function paceOne(cfg: Cfg, w: Workout) {
  const m = okMin(w.min), e = m ? estMinutes(cfg, w.items, null, false, true) : 0;
  return m && e > 0 ? m / e : null;
}
/** Темп атлета по журналу: { k, n } — множитель к оценке и по скольким тренировкам он найден */
export function paceOf(workouts: Workout[], cfg: Cfg) {
  const rs: number[] = [];
  for (let i = workouts.length - 1; i >= 0 && rs.length < PACE_RULE.n; i--) {
    const w = workouts[i];
    if (w.open) continue;
    const r = paceOne(cfg, w);
    if (r != null && r >= PACE_RULE.typo[0] && r <= PACE_RULE.typo[1]) rs.push(r);
  }
  if (rs.length < PACE_RULE.min) return { k: 1, n: rs.length };
  const s = rs.slice().sort((a, b) => a - b), mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const k = Math.min(PACE_RULE.hi, Math.max(PACE_RULE.lo, Math.round(mid / PACE_RULE.step) * PACE_RULE.step));
  return { k: +k.toFixed(2), n: rs.length };
}
/** Поставить темп, по которому дальше считается время (rules.ts, PACE): экран — по журналу профиля, проверки — сами */
export const setPace = (k: number) => { PACE.k = k > 0 ? k : 1; };
