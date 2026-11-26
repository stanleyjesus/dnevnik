/* «Капля» в меню (новый дизайн, решение владельца 26 ноября 2026; стили — theme.css): подсветка раздела в нижней панели перетекает
   к нажатому разделу — передний край быстрее, задний догоняет, капля чуть сплющивается. Вкладки перерисовываются целиком при каждом
   нажатии, поэтому капля живёт рядом с ними, в самой панели, а не в #tabs. «Уменьшить движение» в системе — без перетекания */
const LEAD = 'cubic-bezier(.3,1.45,.45,1)', TRAIL = 'cubic-bezier(.55,0,.25,1)';

export function tabDrop() {
  const nav = document.querySelector<HTMLElement>('nav.tabs'), wrap = document.getElementById('tabs');
  if (!nav || !wrap || nav.querySelector('.tblob')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const blob = document.createElement('i');
  blob.className = 'tblob'; blob.setAttribute('aria-hidden', 'true');
  nav.prepend(blob); nav.classList.add('has-drop');
  let cur = -1, live = false;
  const place = (animate: boolean) => {
    const links = [...wrap.querySelectorAll('a')], i = links.findIndex(a => a.getAttribute('aria-current') === 'page');
    if (i < 0) { blob.style.opacity = '0'; cur = -1; return; }
    const n = nav.getBoundingClientRect(), r = links[i]!.getBoundingClientRect(), b = nav.clientLeft;
    const dir = cur < 0 ? 0 : Math.sign(i - cur), still = !animate || reduce.matches || !dir;
    blob.style.transition = still ? 'none'
      : dir > 0 ? 'right .34s ' + LEAD + ', left .46s ' + TRAIL + ' .07s'
        : 'left .34s ' + LEAD + ', right .46s ' + TRAIL + ' .07s';
    blob.style.left = (r.left - n.left - b) + 'px'; blob.style.right = (n.right - r.right - b) + 'px'; blob.style.opacity = '1';
    if (!still && blob.animate) blob.animate([{ top: '5px', bottom: '5px' }, { top: '8px', bottom: '8px', offset: .4 }, { top: '4px', bottom: '4px', offset: .75 }, { top: '5px', bottom: '5px' }], { duration: 560, easing: 'ease-out' });
    cur = i;
  };
  new MutationObserver(() => place(live)).observe(wrap, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  wrap.addEventListener('scroll', () => place(false), { passive: true });
  addEventListener('resize', () => place(false));
  /* шрифт догружается позже первой отрисовки — ширина вкладок меняется */
  if (document.fonts) void document.fonts.ready.then(() => place(false));
  place(false); live = true;
}
