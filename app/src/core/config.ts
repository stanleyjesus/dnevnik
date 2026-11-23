/* Настройка профиля: значения по умолчанию и чтение сохранённого.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { clone } from './records.ts';
import { GEAR, NO_GEAR, placed } from './gear.ts';
import { appEx } from './rules.ts';
import type { Cfg, ExDef } from './types.ts';

/* ---------- config ---------- */
export const OFF_DEFAULT: Record<string, number> = { calves: 1, abs: 1, erectors: 1 };
export function mergeCfg(raw: any): Cfg {
  raw = raw || {};
  const c = {
    start: raw.start || null,
    zones: Object.assign({ min: 4, opt: 10, high: 20 }, raw.zones || {}),
    cycle: { inc: 2, sets: 4, pct: { 5: 77, 4: 82, 3: 87 } },
    method: raw.method || '',
    ex: {}
  } as unknown as Cfg;                                       // остальные поля настройки дописываются ниже
  if (raw.cycle) { c.cycle.inc = +raw.cycle.inc || 0; c.cycle.sets = +raw.cycle.sets || 4; if (raw.cycle.pct) c.cycle.pct = Object.assign({}, raw.cycle.pct); }
  c.gear = {};
  { const rg = raw.gear || {};
    for (const g of GEAR) { const v = +((rg[g.id] || {}).step); c.gear[g.id] = { n: g.n, step: v > 0 ? v : g.step }; }
    for (const [id, g] of Object.entries<any>(rg)) if (!c.gear[id] && id !== NO_GEAR && g && String(g.n || '').trim()) c.gear[id] = { n: String(g.n).trim(), step: +g.step > 0 ? +g.step : 2.5, own: true };
    c.gear[NO_GEAR] = { n: 'Без снаряда', step: +((rg[NO_GEAR] || {}).step) > 0 ? +rg[NO_GEAR].step : 2.5 }; }
  /* steps written by older versions are not read any more: the step is the equipment's. A light day rounds as its lift does, so it goes second */
  for (const [id, e] of Object.entries<any>(raw.ex || {})) if (e.mode !== 'light') c.ex[id] = placed(c, Object.assign({ n: id }, e));
  for (const [id, e] of Object.entries<any>(raw.ex || {})) if (e.mode === 'light') c.ex[id] = placed(c, Object.assign({ n: id }, e));
  for (const id of Object.keys(c.ex)) c.ex[id] = appEx(c.ex[id]);   // (в эталоне нет) румынская тяга с картой прежнего правила по названию: разгибатели помогают (решение владельца, 23 ноября 2026)
  c.program = raw.program && raw.program.slots ? clone(raw.program) : null;
  /* muscles left out of the count: the diary gives them no sets of its own and does not call them a gap.
     Calves, abs and erectors are out by default (the athlete adds to them by hand); a stored 0 puts a muscle back in. */
  c.ignore = {};
  { const ig = Object.assign({}, OFF_DEFAULT, raw.ignore || {}); for (const k of Object.keys(ig)) if (ig[k]) c.ignore[k] = 1; }
  c.rir = raw.rir != null && +raw.rir >= 0 && +raw.rir <= 4 ? Math.round(+raw.rir) : 1;   // reps left in reserve by the method
  c.bw = raw.bw === 'track' ? 'track' : 'gain';                 // body weight: watched for gaining, or only recorded
  /* the athlete's own limits: sets for one muscle in one training day, working sets in the whole week */
  c.caps = { day: 11, week: 100 };
  if (raw.caps) { if (+raw.caps.day > 0) c.caps.day = +raw.caps.day; if (+raw.caps.week > 0) c.caps.week = +raw.caps.week; }
  c.rest = +raw.rest >= 30 && +raw.rest <= 600 ? +raw.rest : 120;   // seconds of rest between sets, for the time estimate
  return c;
}
export const exName = (cfg: Cfg, id: string) => (cfg.ex[id] && cfg.ex[id].n) || id;
export const isCycle = (cfg: Cfg, id: string) => !!(cfg.ex[id] && cfg.ex[id].mode === 'cycle');
/* the light day of a priority lift is its own exercise: a fixed share of that lift's maximum, far from failure */
export const isLight = (cfg: Cfg, id: string) => !!(cfg.ex[id] && cfg.ex[id].mode === 'light');
export const LIGHT = { pct: 75, reps: 5, sets: 3 };
/* what an exercise is: a percentage lift, its light day, a multi-joint accessory or an isolation move */
export const kindOf = (cfg: Cfg, id: string) => { const e = cfg.ex[id] || {} as ExDef; return e.mode === 'cycle' ? 'base' : e.mode === 'light' ? 'light' : e.pat && e.pat !== 'iso' ? 'compound' : 'iso'; };
/* reps scheme order inside the wave: 5 -> 4 -> 3 -> 5 ... */
export const cycleOrder = (cfg: Cfg) => Object.keys(cfg.cycle.pct).map(Number).sort((a, b) => b - a);
