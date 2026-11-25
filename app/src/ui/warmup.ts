/* Разминка перед упражнением в идущей тренировке (просьба владельца, 25 ноября 2026; docs/03, раздел 17). В эталоне этого нет.
   Сколько подходов — по типу упражнения и по тому, работала ли уже его основная мышца в этой тренировке (core/rules.ts, warmSets): так же считает оценка
   времени. Раскладка — доли первого рабочего веса (WARM_STEPS), вес вниз до шага снаряда */
import { C, h } from './dom.ts';
import { D } from './render.ts';
import { freshFor, warmPlan, warmSets, withBody } from '../core/rules.ts';
import type { Item, Workout } from '../core/index.ts';

export function warmLine(d: Workout, it: Item, idx: number) {
  const seen = new Set<string>(), mOf = (id: string) => (D.cfg.ex[id] || { m: {} }).m || {};
  for (const x of d.items.slice(0, idx)) if (!x.skip && x.sets.length) for (const [m, c] of Object.entries(mOf(x.ex))) if (c > 0) seen.add(m);
  const n = warmSets(D.cfg, it.ex, freshFor(mOf(it.ex), seen));
  const w = it.sets.length ? it.sets[0].w : null, L = warmPlan(D.cfg, it.ex, n, w, C.stepOf(D.W, D.cfg, it.ex));
  if (!L.length) return null;
  const text = withBody(D.cfg, it.ex) ? 'Разминка: ' + L.map(x => x.r).join(', ') + ' повт. полегче — без отягощения или с помощью'
    : L[0].w != null ? 'Разминка, кг: ' + L.map(x => C.fmt(x.w!) + ' × ' + x.r).join(' · ')
    : 'Разминка: ' + L.map(x => x.pct + '% × ' + x.r).join(' · ') + ' от рабочего веса';
  return h('p', { class: 'sub warm', id: 'warm-' + idx, title: 'Разминочные подходы перед рабочими: в тяжёлом дне 4, в лёгком и в первом упражнении на мышцу со штангой или гантелями 2, в тренажёре 1; мышца уже работала — без разминки' }, text);
}
