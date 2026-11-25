/* Вкладки и перерисовка страницы.
   Перенесено из reference/src/ui1.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C, h, put } from './dom.ts';
import { derive, S, VIEWS } from './state.ts';
import { switchProfile } from './storage.ts';
import { drawCharts } from './charts.ts';
import { VIEW_FN } from './views.ts';
import { onbOn } from './onboard.ts';
import type { Derived } from './types.ts';

export let D = null as unknown as Derived;
/* ---------- routing + render loop ---------- */
export function route() { const v = (location.hash || '').replace('#', ''); S.view = VIEWS.some(x => x[0] === v) ? v : 'overview'; }
export let stale = false, raf = 0;
export function softRender() {
  const a = document.activeElement;
  if (a && $('view')!.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { stale = true; paintTop(); return; }
  if (S.view === 'workout' && S.draft) { stale = true; paintTop(); return; }
  cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(true));
}
export function render(force?: boolean) {
  stale = false;
  D = derive();
  document.body.classList.toggle('onb-on', S.view === 'overview' && onbOn());   // (в эталоне нет) онбординг — на весь экран, без вкладок (onboard.ts)
  paintTop();
  const v = $('view');
  const y = window.scrollY;
  v!.textContent = '';
  const wrap = h('div', { class: 'wrap stack' });
  if (S.conn === 'none' || S.conn === 'error') wrap.appendChild(h('div', { class: 'banner crit' }, h('b', null, 'Хранилище на этом устройстве недоступно. '), 'Записи не загрузились, и новые сейчас не сохранятся. Закрой режим «инкогнито», если он включён, и обнови страницу.'));
  else if (S.conn !== 'ready') wrap.appendChild(h('div', { class: 'banner' }, S.slow ? 'Записи пока не загрузились. Приложение продолжает попытки.' : 'Загружаю дневник…'));
  else if (!S.canWrite) wrap.appendChild(h('div', { class: 'banner' }, 'Дневник открыт только для чтения: изменять записи может владелец.'));
  put(wrap, [VIEW_FN[S.view]()]);
  v!.appendChild(wrap);
  drawCharts();
  for (const el of v!.querySelectorAll('.to-end')) el.scrollLeft = el.scrollWidth;
  if (!force) window.scrollTo(0, 0); else window.scrollTo(0, y);
}
export function paintTop() {
  const d = D || derive();
  const cur = d.wi.weeks.find(w => w.current);
  $('week-badge')!.textContent = cur ? 'Неделя ' + cur.no + ' · ' + C.fmtDate(cur.from) + ' – ' + C.fmtDate(cur.to) : '';
  const s = $('sync');
  s!.className = 'sync ' + (S.conn === 'ready' ? 'ok' : S.conn === 'none' || S.conn === 'error' ? 'bad' : 'busy');
  s!.lastChild!.textContent = S.conn === 'ready' ? 'записи на устройстве' : S.conn === 'none' || S.conn === 'error' ? 'хранилище недоступно' : 'загрузка';
  const ps = $('prof-slot');
  if (ps && document.activeElement !== $('prof')) {
    ps.textContent = '';
    if (S.profiles.length > 1 && S.db) ps.appendChild(h('select', { id: 'prof', class: 'prof', 'aria-label': 'Чей дневник открыт', onchange: e => switchProfile(e.target.value) }, S.profiles.map(p => h('option', { value: p.id, selected: p.id === S.profile, text: p.n }))));
  }
  const tabs = $('tabs');
  tabs!.textContent = '';
  const crit = d.ins.some(i => i.sev === 'crit');
  for (const [id, name] of VIEWS) tabs!.appendChild(h('a', { href: '#' + id, 'aria-current': S.view === id ? 'page' : null }, name, id === 'workout' && S.draft && S.draft.open ? h('span', { class: 'dot', title: 'тренировка идёт' }) : null, id === 'coach' && crit ? h('span', { class: 'dot', title: 'есть важные замечания' }) : null));
}
export function go(v: string) { if (location.hash === '#' + v) { route(); render(); } else location.hash = v; }
