/* Построение страницы: элементы, значки, мелкие помощники.
   Перенесено из reference/src/ui1.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { Core } from '../core/index.ts';
import type { Attrs, El, Kid, SvgEl } from './types.ts';

export const C = Core;
export const SVGNS = 'http://www.w3.org/2000/svg';
export function mk(ns: boolean, tag: string, attrs: Attrs | null | undefined, kids: any[]) {
  const el: any = ns ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'value' && !ns) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') { el[k] = true; el.setAttribute(k, ''); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  put(el, kids);
  return el;
}
export function put(el: Node, kids: any[]) { for (const k of kids) { if (k == null || k === false) continue; if (Array.isArray(k)) put(el, k); else el.appendChild(k.nodeType ? k : document.createTextNode(String(k))); } }
export const h = <K extends keyof HTMLElementTagNameMap>(t: K, a?: Attrs | null, ...k: Kid[]): HTMLElementTagNameMap[K] => mk(false, t, a, k);
export const sv = (t: string, a?: Attrs | null, ...k: Kid[]): SvgEl => mk(true, t, a, k);
export const $ = (id: string) => document.getElementById(id) as El | null;
export const toNum = (v: unknown): number | null => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
export const toInt = (v: unknown): number | null => { const n = parseInt(String(v), 10); return isNaN(n) ? null : n; };
export const ICONS: Record<string, string> = {
  good: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-4-4 1.4-1.4 2.6 2.6 5.4-5.4 1.4 1.4z',
  warn: 'M12 2.5L1.5 21h21zM11 9h2v6h-2zm0 8h2v2h-2z',
  serious: 'M12 2l10 10-10 10L2 12zM11 7h2v6h-2zm0 8h2v2h-2z',
  crit: 'M12 2a10 10 0 100 20 10 10 0 000-20zm4.2 12.8l-1.4 1.4L12 13.4l-2.8 2.8-1.4-1.4 2.8-2.8-2.8-2.8 1.4-1.4 2.8 2.8 2.8-2.8 1.4 1.4-2.8 2.8z',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v2h-2zm0 4h2v6h-2z',
  up: 'M12 5l7 8h-4.5v6h-5v-6H5z', down: 'M12 19l-7-8h4.5V5h5v6H19z',
  x: 'M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z', minus: 'M5 11h14v2H5z',
  over: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4.5l5 5.5h-3.5v5.5h-3V12H7z',
  arrowU: 'M12 6l-6 6 1.4 1.4L11 9.8V19h2V9.8l3.6 3.6L18 12z', arrowD: 'M12 18l6-6-1.4-1.4L13 14.2V5h-2v9.2l-3.6-3.6L6 12z',
  skip: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 016.3 12.9L7.1 5.7A8 8 0 0112 4zM5.7 7.1l11.2 11.2A8 8 0 015.7 7.1z',
  bar: 'M2 9h2v6H2zm3-3h2.5v12H5zm11.5 0H19v12h-2.5zM20 9h2v6h-2zM8.5 11h7v2h-7z'
};
export const icon = (n: string) => sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, sv('path', { d: ICONS[n] || ICONS.info, fill: 'currentColor' }));
export const pill = (sev: string, label: string) => h('span', { class: 'pill ' + sev }, icon(sev), label);
