/* Встроенный справочник упражнений на экране «Настройка» (функции 34–36 в docs/05). В эталоне этого нет.
   Профиль без упражнений получает список сам (storage.ts). Здесь — то, что нужно профилю со своими упражнениями:
   разложить по снарядам те, что лежат «без снаряда», добавить упражнения списка, которых у профиля нет,
   и убрать из справочника упражнение, которое нигде не используется. Ничего из этого дневник не делает сам. */
import { C, h, icon } from './dom.ts';
import { S } from './state.ts';
import { toast } from './toast.ts';
import { saveCfg } from './storage.ts';
import { D, render } from './render.ts';
import { STARTER, STARTER_GEAR, starterGear, starterMissing } from '../core/starter.ts';
import type { RawCfg } from './types.ts';

/* план и черновик программы посчитаны со старым справочником */
const fresh = () => { S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null; };
/* свой снаряд встроенного списка заводится в профиле, когда на него кладут упражнение */
export const needGear = (raw: RawCfg, g: string) => { if (STARTER_GEAR[g] && !(raw.gear && raw.gear[g])) { raw.gear = raw.gear || {}; raw.gear[g] = C.clone(STARTER_GEAR[g]); } };

/** Упражнения профиля, лежащие «без снаряда», которым встроенный список знает место: id и снаряд */
export function sortable() {
  const cfg = D.cfg, out: { id: string; g: string }[] = [];
  for (const id of Object.keys(cfg.ex)) {
    if (cfg.ex[id].mode === 'light' || C.gearOf(cfg, id) !== C.NO_GEAR) continue;
    const g = starterGear(id, cfg.ex[id].n);
    if (g && (cfg.gear[g] || STARTER_GEAR[g])) out.push({ id, g });
  }
  return out;
}
/** Две кнопки над снарядами; когда делать нечего — ничего */
export function starterTools() {
  if (!S.canWrite) return null;
  const loose = sortable(), missing = starterMissing(D.cfg.ex);
  if (!loose.length && !missing.length) return null;
  const sort = async () => {
    if (!(await saveCfg(raw => { for (const x of loose) { const e = raw.ex[x.id]; if (!e) continue; needGear(raw, x.g); e.gear = x.g; delete e.step; delete e.round; } }))) return;
    fresh(); toast('Разложено по снарядам: ' + loose.length); render(true);
  };
  const add = async () => {
    if (!(await saveCfg(raw => { for (const id of missing) { const def = C.clone(STARTER[id]); needGear(raw, def.gear!); raw.ex[id] = def; } }))) return;
    fresh(); toast('Добавлено упражнений: ' + missing.length); render(true);
  };
  return h('div', { class: 'row', id: 'starter-tools', style: 'margin-bottom:14px' },
    loose.length ? h('button', { class: 'btn sm', id: 'starter-sort', title: 'Положить упражнения «без снаряда» на тренажёр, блок, штангу или гантель — так, как они обычно выполняются', onclick: sort }, 'Разложить по снарядам: ' + loose.length) : null,
    missing.length ? h('button', { class: 'btn sm', id: 'starter-add', title: 'Добавить в справочник распространённые упражнения, которых в нём нет. Лишнее потом можно убрать в «Справочнике упражнений»', onclick: add }, icon('plus'), 'Типовые упражнения: ' + missing.length) : null);
}
/** Можно ли убрать упражнение из справочника: его нет ни в журнале, ни в идущей тренировке, ни в программе (принятой и той, к которой можно вернуться), и у него нет лёгкого дня */
export function canDropEx(id: string) {
  const cfg = D.cfg, P = cfg.program, old = P && P.prev && P.prev.program;
  if (!S.canWrite || !cfg.ex[id] || cfg.ex[id].mode === 'light' || D.prog.has(id)) return false;
  if (Object.values(cfg.ex).some(e => e.mode === 'light' && e.of === id)) return false;
  /* все дни программы, а не только те, что сейчас в неделе: день, которого при выбранном числе дней нет, вернётся вместе с ним */
  for (const pr of [P, old]) if (pr && pr.slots && Object.values(pr.slots).some(day => Array.isArray(day) && day.some(e => e.ex === id))) return false;
  return !D.W.some(w => w.items.some(it => it.ex === id)) && !(S.draft && S.draft.items.some(it => it.ex === id));
}
/** Кнопка «Убрать» в строке справочника — только у упражнения, которое нигде не используется */
export function dropExButton(id: string) {
  if (!canDropEx(id)) return null;
  const name = C.exName(D.cfg, id);
  return h('button', { class: 'btn ghost sm', id: 'ex-del-' + id, 'aria-label': 'Убрать из справочника: ' + name, onclick: async () => {
    if (!(await saveCfg(raw => { delete raw.ex[id]; }))) return;
    fresh(); toast('Убрано из справочника: ' + name); render(true);
  } }, 'Убрать');
}
