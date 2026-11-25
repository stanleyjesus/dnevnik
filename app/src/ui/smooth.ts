/* Плавная смена экрана (просьба владельца, 25 ноября 2026: «при нажатии экран моргает»). Страница перерисовывается целиком,
   и нажатая кнопка, её подсветка и всё вокруг сменялись в один кадр. Перед каждым действием пользователя дневник запоминает экран;
   если действие перерисовало его на месте (прокрутка та же), старый экран ещё мгновение лежит поверх нового и тает: меняется на глаз
   только то, что изменилось, остальное совпадает пиксель в пиксель. Перешёл на другой раздел или шаг — новый экран проявляется.
   Новый экран сразу живой: тающий слой не ловит нажатий и не входит в фокус. «Уменьшить движение» в системе — без этого */
const FADE = 180;
type Seen = { wrap: Element; top: number; left: number; width: number; y: number; t: number; scrolled: [Element, number][] };
let seen: Seen | null = null;

function remember() {
  const v = document.getElementById('view'), w = v && v.firstElementChild;
  if (!w || w.classList.contains('ghost')) return;
  const r = w.getBoundingClientRect();
  /* полосы с прокруткой вбок (таблицы, карусель): в отцепленном экране прокрутка теряется, её вернут слою */
  const scrolled = [...w.querySelectorAll('.scroll-x, .to-end')].filter(e => e.scrollLeft > 0).map(e => [e, e.scrollLeft] as [Element, number]);
  seen = { wrap: w, top: r.top + scrollY, left: r.left + scrollX, width: r.width, y: scrollY, t: performance.now(), scrolled };
}

function melt(v: HTMLElement, s: Seen) {
  const g = s.wrap as HTMLElement;
  g.classList.add('ghost'); g.setAttribute('aria-hidden', 'true'); g.inert = true;
  Object.assign(g.style, { position: 'absolute', margin: '0', width: s.width + 'px', pointerEvents: 'none', zIndex: '3' });
  v.appendChild(g);
  const box = (g.offsetParent || document.body).getBoundingClientRect();
  g.style.top = (s.top - scrollY - box.top) + 'px'; g.style.left = (s.left - scrollX - box.left) + 'px';
  for (const [e, x] of s.scrolled) e.scrollLeft = x;
  g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: 'ease-out', fill: 'forwards' });
  setTimeout(() => g.remove(), FADE + 20);
}

export function smooth() {
  const v = document.getElementById('view');
  if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const t of ['pointerdown', 'click', 'change', 'keydown']) document.addEventListener(t, remember, true);
  new MutationObserver(recs => {
    const s = seen;
    if (!s || performance.now() - s.t > 1500 || !recs.some(r => [...r.removedNodes].includes(s.wrap))) return;
    seen = null;
    const fresh = v.firstElementChild as HTMLElement | null;
    if (Math.abs(scrollY - s.y) <= 2) melt(v, s);                         // перерисовка на месте: старое тает поверх нового
    else if (fresh) fresh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease-out' });   // другой экран — проявляется
  }).observe(v, { childList: true });
}
