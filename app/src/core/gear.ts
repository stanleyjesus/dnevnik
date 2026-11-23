/* Снаряды: шаг веса принадлежит снаряду, а не упражнению.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import type { Cfg, ExDef } from './types.ts';

/* ---------- equipment: the weight step belongs to the kind of equipment; an exercise has no step of its own ---------- */
export const GEAR = [
  { id: 'machine', n: 'Тренажёр', step: 2.5, kw: ['тренаж'] },
  { id: 'cable', n: 'Блок', step: 2.5, kw: ['блок', 'кроссовер'] },
  { id: 'barbell', n: 'Штанга', step: 2.5, kw: ['штанг', 'т-бар'] },
  { id: 'dumbbell', n: 'Гантель', step: 2, kw: ['гантел'] }
];
export const NO_GEAR = 'none';                                           // «без снаряда»: a place with a step of its own, for everything not sorted yet
export const gearGuess = (name: string | null | undefined) => { const s = String(name || '').toLowerCase(); const g = GEAR.find(x => x.kw.some(k => s.includes(k))); return g ? g.id : null; };
/* the kinds of equipment of a profile, in order: the four stock ones, then the athlete's own */
export const gearList = (cfg: Cfg) => Object.keys(cfg.gear).filter(id => id !== NO_GEAR).map(id => Object.assign({ id }, cfg.gear[id]));
/* where an exercise lies: the kind the athlete chose, else the one its name mentions, else «без снаряда» */
export const gearOf = (cfg: Cfg, id: string) => (cfg.ex[id] && cfg.ex[id].gear) || NO_GEAR;
/* an exercise as the merged config holds it: on the equipment the athlete chose, else the one its name mentions, else «без снаряда», and with that step */
export const placed = (cfg: Cfg, def: ExDef): ExDef => {
  const x: ExDef = Object.assign({ n: '', m: {} }, def);
  delete x.step; delete x.round;
  if (x.mode === 'light') { delete x.gear; x.round = +((cfg.ex[x.of!] || {} as ExDef).round)! || 2.5; return x; }
  const gid = x.gear && cfg.gear[x.gear] ? x.gear : gearGuess(x.n) || NO_GEAR;
  if (gid === NO_GEAR) delete x.gear; else x.gear = gid;
  if (x.mode === 'cycle') x.round = cfg.gear[gid].step; else x.step = cfg.gear[gid].step;
  return x;
};
