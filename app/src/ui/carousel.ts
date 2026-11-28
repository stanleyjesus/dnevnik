/* Карусель карточек (просьба владельца, 25 ноября 2026, по присланному образцу; сначала — дни программы в онбординге, с 26 ноября 2026 —
   и дни программы на «Программе», и группы мышц на «Мышцах»): открытая карточка — по центру, соседние — узкие края по бокам,
   связанные с ней перемычкой, дальние спрятаны. Листать — пальцем вбок, нажатием на край, полосами над карточками, стрелками
   на клавиатуре; по кругу карточки не идут: у первой слева пусто. Открытая карточка стоит в потоке и задаёт высоту карусели,
   края — 84% её высоты; смену карточки ведут переходы стилей, высоту — анимация (Web Animations), и в разметке от анимации ничего
   не остаётся. Страница перерисовывается целиком, поэтому открытая карточка хранится снаружи (`Car`): в мастере — в его состоянии,
   на вкладках — в `kept`, пока открыт тот же раздел, — и после перерисовки карусель сразу стоит на ней */
import { h } from './dom.ts';
import type { Kid } from './types.ts';

export interface Car { day: number }
const keep: Record<string, Car & { at: string }> = {};
/* открытая карточка карусели вкладки: помнится, пока открыт тот же раздел; в другом разделе карусель снова с первой */
export function kept(key: string): Car {
  const k = keep[key];
  if (k && k.at === location.hash) return k;
  const v = { at: location.hash, day: 0 };
  keep[key] = v;
  return v;
}

const SPRING = 'linear(0, 0.055, 0.17, 0.3, 0.43, 0.545, 0.643, 0.723, 0.787, 0.836, 0.876, 0.906, 0.929, 0.947, 0.96, 0.97, 0.978, 0.984, 0.988, 0.991, 0.993, 0.995, 0.996, 0.997, 1)';   // пружина образца (жёсткость 220, затухание 26, масса 0.75) — 0.5 с; та же в style.css
/* ref — получить функцию, которая открывает карточку с анимацией: так карусель листает кнопка внутри карточки (упражнения идущей тренировки, workcar.ts) */
export function carousel(days: HTMLElement[], o: Car, at: { id: string; dot: (i: number) => string; lab: (i: number) => string; aria: string; ref?: (open: (i: number) => void) => void }): Kid[] {
  const n = days.length;
  o.day = Math.max(0, Math.min(o.day, n - 1));
  const slots = days.map((d, i) => h('div', { class: 'pslot', onclick: () => { if (car.isConnected) open(i); } },   // кнопка в карточке перерисовала страницу: нажатие дошло до прежней карусели — она уже не на экране
    h('div', { class: 'pclip' }, d), h('span', { class: 'plab', 'aria-hidden': 'true' }, at.lab(i)), h('span', { class: 'pnotch', 'aria-hidden': 'true' })));
  const dots = days.map((_, i) => h('button', { type: 'button', id: at.dot(i), 'aria-label': at.lab(i), onclick: () => open(i) }));
  const place = () => {                                                      // где какой день: −2 и 2 — дальше краёв, спрятаны
    slots.forEach((s, i) => { s.setAttribute('data-off', String(Math.max(-2, Math.min(2, i - o.day)))); (s.firstChild as HTMLElement).inert = i !== o.day; });
    dots.forEach((b, i) => b.setAttribute('aria-current', i === o.day ? 'true' : 'false'));
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, ease = CSS.supports('transition-timing-function', SPRING) ? SPRING : 'cubic-bezier(.25, .8, .25, 1)';
  const open = (i: number) => {
    if (i < 0 || i >= n || i === o.day) return;
    const was = slots.map(s => s.offsetHeight);
    o.day = i; place();
    if (!still) slots.forEach((s, j) => { const now = s.offsetHeight; if (now !== was[j]) s.animate([{ height: was[j] + 'px' }, { height: now + 'px' }], { duration: 500, easing: ease }); });
    const top = (bar || car).getBoundingClientRect().top;                    // день бывает длиннее экрана: начало карусели — снова на виду
    if (top < 0) window.scrollBy({ top: top - 12, behavior: still ? 'auto' : 'smooth' });
  };
  /* палец вбок: карусель идёт за ним, у первого и последнего дня — с сопротивлением; отпустил дальше порога — соседний день.
     Палец вниз — обычная прокрутка страницы (touch-action: pan-y); с полей ввода карусель не листается */
  let id = -1, x0 = 0, y0 = 0, dx = 0, drag = false, moved = -1e9;
  const down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button > 0 || (e.target as Element).closest('input, select, textarea')) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false;
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!drag) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { id = -1; return; }
      if (Math.abs(mx) < 8) return;
      drag = true; car.classList.add('drag'); getSelection()?.removeAllRanges();
      try { car.setPointerCapture(id); } catch { /* указатель уже отпущен */ }
    }
    dx = (o.day === 0 && mx > 0) || (o.day === n - 1 && mx < 0) ? mx / 3 : mx;
    car.style.setProperty('--dx', dx + 'px');
  };
  const up = (e: PointerEvent, go: boolean) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!drag) return;
    drag = false; moved = performance.now(); car.classList.remove('drag'); car.style.removeProperty('--dx'); if (!car.style.length) car.removeAttribute('style');
    const far = Math.min(70, car.clientWidth * .18);
    if (go && dx < -far) open(o.day + 1); else if (go && dx > far) open(o.day - 1);
  };
  const key = (e: KeyboardEvent) => {
    const t = e.target as Element;
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || (t !== car && !t.closest('.pdots'))) return;
    e.preventDefault(); open(o.day + (e.key === 'ArrowRight' ? 1 : -1));
    if (t !== car) dots[o.day].focus();
  };
  const car = h('div', { class: 'pcar', id: at.id, role: 'group', 'aria-roledescription': 'карусель', 'aria-label': at.aria, tabindex: '0',
    onpointerdown: down, onpointermove: move, onpointerup: (e: PointerEvent) => up(e, true), onpointercancel: (e: PointerEvent) => up(e, false), onkeydown: key }, slots);
  car.addEventListener('click', e => { if (performance.now() - moved < 350) { moved = -1e9; e.stopPropagation(); e.preventDefault(); } }, true);   // палец листал, а не нажимал: нажатие сразу после — не нажатие
  const bar = n > 1 ? h('div', { class: 'pdots', onkeydown: key }, dots) : null;
  place();
  if (at.ref) at.ref(open);
  return [bar, car];   // точки — над днями: день бывает длиннее экрана
}
