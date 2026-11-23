/* Графики и шкалы.
   Перенесено из reference/src/ui1.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { C, h, pill, sv } from './dom.ts';
import type { SetRec, Zones } from '../core/index.ts';
import type { BarOpts, Draw, LineOpts, Point, TipRow } from './types.ts';

/* ---------- charts (drawn after the view is in the document, at its real width) ---------- */
export let chartQ: [HTMLElement, Draw][] = [];
export function chartHost(draw: Draw, cls?: string) { const el = h('div', { class: 'chart ' + (cls || '') }); chartQ.push([el, draw]); return el; }
export function drawCharts() { const q = chartQ; chartQ = []; for (const [el, draw] of q) if (el.isConnected) { try { draw(el, el.clientWidth || 320); } catch (e) { el.textContent = 'График не построился'; } } }
export function niceTicks(lo: number, hi: number, n: number) {
  if (!(hi > lo)) { hi = lo + 1; lo = lo - 1; }
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(6));
  return t;
}
export function tipBox(host: HTMLElement) { let t = host.querySelector('.tip') as HTMLElement | null; if (!t) { t = h('div', { class: 'tip' }); t.style.display = 'none'; host.appendChild(t); } return t; }
export function showTip(host: HTMLElement, t: HTMLElement, x: number, y: number, W: number) {
  t.style.display = 'block';
  const tw = t.offsetWidth;
  t.style.left = Math.max(0, Math.min(W - tw, x + 12 > W - tw ? x - tw - 12 : x + 12)) + 'px';
  t.style.top = Math.max(0, y) + 'px';
}
export function tipRows(t: HTMLElement, title: string, rows: TipRow[]) {
  t.textContent = '';
  t.appendChild(h('div', { class: 'th', text: title }));
  for (const r of rows) { const k = h('i', { class: 'key' }); if (r.color) k.style.borderTopColor = r.color; t.appendChild(h('div', { class: 'tr' }, r.color ? k : null, h('b', { text: r.v }), h('span', { text: r.k }))); }
}
/* line chart. o: {series:[{name,color,pts:[{x(day),y}],area,end}], dots:{name,pts:[{x,y}]}, h, unit, start, tip(x)->rows, title(x)} */
export function lineChart(host: HTMLElement, W: number, o: LineOpts) {
  const H = o.h || 220, m = { l: 38, r: o.endPad || 46, t: 12, b: 24 };
  const all: Point[] = [];
  for (const s of o.series) for (const p of s.pts) all.push(p);
  if (!all.length) { host.appendChild(h('div', { class: 'empty', text: 'Пока нет данных для графика' })); return; }
  const xs = Array.from(new Set(all.map(p => p.x))).sort((a, b) => a - b);
  let x0 = xs[0], x1 = xs[xs.length - 1];
  if (x1 - x0 < 7) { x0 -= 3; x1 += 4; }
  let lo = Math.min(...all.map(p => p.y)), hi = Math.max(...all.map(p => p.y));
  if (o.dots) for (const p of o.dots.pts) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  const pad = (hi - lo || hi * 0.1 || 1) * 0.1;
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const X = (x: number) => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r), Y = (y: number) => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b);
  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': o.label || 'График' });
  for (const t of ticks) {
    svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === lo ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }));
    svg.appendChild(sv('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', text: C.fmt(t, 1) }));
  }
  if (o.start != null) {             /* week ticks along the bottom */
    const w0 = Math.floor((x0 - o.start) / 7) + 1, w1 = Math.floor((x1 - o.start) / 7) + 1;
    const every = Math.max(1, Math.ceil((w1 - w0 + 1) / Math.max(2, Math.floor((W - m.l - m.r) / 44))));
    for (let k = w0; k <= w1; k++) {
      const x = o.start + (k - 1) * 7;
      if (x < x0 || x > x1 || (k - w0) % every) continue;
      svg.appendChild(sv('line', { x1: X(x), x2: X(x), y1: H - m.b, y2: H - m.b + 4, stroke: 'var(--axis)' }));
      svg.appendChild(sv('text', { x: X(x), y: H - 6, 'text-anchor': 'middle', text: 'н' + k }));
    }
  }
  if (o.dots) for (const p of o.dots.pts) svg.appendChild(sv('circle', { cx: X(p.x), cy: Y(p.y), r: 3.5, fill: 'var(--deemph)', stroke: 'var(--surface)', 'stroke-width': 1.5 }));
  for (const s of o.series) {
    if (!s.pts.length) continue;
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
    if (s.area && s.pts.length > 1) svg.appendChild(sv('path', { d: d + 'L' + X(s.pts[s.pts.length - 1].x).toFixed(1) + ' ' + Y(lo) + 'L' + X(s.pts[0].x).toFixed(1) + ' ' + Y(lo) + 'Z', fill: s.color, opacity: .1 }));
    svg.appendChild(sv('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (s.pts.length <= 40) for (const p of s.pts) svg.appendChild(sv('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
    if (s.end) { const p = s.pts[s.pts.length - 1]; svg.appendChild(sv('text', { class: 'end', x: X(p.x) + 9, y: Y(p.y) + 4, text: C.fmt(p.y, 1) })); }
  }
  const cross = sv('line', { y1: m.t, y2: H - m.b, stroke: 'var(--ink-2)', 'stroke-width': 1, visibility: 'hidden' });
  svg.appendChild(cross);
  const hit = sv('rect', { x: m.l - 8, y: 0, width: W - m.l - m.r + 16, height: H - m.b, fill: 'transparent', tabindex: 0, 'aria-label': 'Значения по тренировкам: веди указателем или стрелками' });
  svg.appendChild(hit);
  if (o.series.length + (o.dots ? 1 : 0) >= 2) {
    const lg = h('div', { class: 'legend' });
    for (const s of o.series) { const k = h('i', { class: 'key' }); k.style.borderTopColor = s.color; lg.appendChild(h('span', null, k, s.name)); }
    if (o.dots) lg.appendChild(h('span', null, h('i', { class: 'sw' }), o.dots.name));
    host.appendChild(lg);
  }
  host.appendChild(svg);
  const tip = tipBox(host);
  let cur = xs.length - 1;
  const at = (i: number) => {
    cur = Math.max(0, Math.min(xs.length - 1, i));
    const x = xs[cur];
    cross.setAttribute('x1', X(x)); cross.setAttribute('x2', X(x)); cross.setAttribute('visibility', 'visible');
    const rows = o.tip ? o.tip(x) : o.series.map(s => { const p = s.pts.find(q => q.x === x); return p ? { color: s.color, v: C.fmt(p.y, 1) + (o.unit || ''), k: s.name } : null; }).filter(Boolean) as TipRow[];
    tipRows(tip, o.title ? o.title(x) : C.fmtDay(C.dstr(x)), rows);
    showTip(host, tip, X(x), svg.getBoundingClientRect().top - host.getBoundingClientRect().top + m.t, W);
  };
  const off = () => { cross.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; };
  hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width); let b = 0; xs.forEach((x, i) => { if (Math.abs(X(x) - px) < Math.abs(X(xs[b]) - px)) b = i; }); at(b); });
  hit.addEventListener('pointerleave', off);
  hit.addEventListener('focus', () => at(cur));
  hit.addEventListener('blur', off);
  hit.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { at(cur - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { at(cur + 1); e.preventDefault(); } });
}
/* column chart. o: {bars:[{label,v,note,muted}], h, unit} */
export function barChart(host: HTMLElement, W: number, o: BarOpts) {
  const H = o.h || 200, m = { l: 34, r: 8, t: 16, b: 24 }, n = o.bars.length;
  if (!n) { host.appendChild(h('div', { class: 'empty', text: 'Пока нет данных' })); return; }
  const ticks = niceTicks(0, Math.max(...o.bars.map(b => b.v), 1), 4), hi = ticks[ticks.length - 1];
  const Y = (y: number) => m.t + (1 - y / hi) * (H - m.t - m.b), slot = (W - m.l - m.r) / n, bw = Math.min(24, Math.max(4, slot - 4));
  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': o.label || 'Диаграмма' });
  for (const t of ticks) {
    svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === 0 ? 'var(--axis)' : 'var(--grid)' }));
    svg.appendChild(sv('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', text: C.fmt(t, 0) }));
  }
  host.appendChild(svg);
  const tip = tipBox(host), every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - m.l - m.r) / 36))));
  o.bars.forEach((b, i) => {
    const cx = m.l + slot * (i + .5), y = Y(b.v), ht = Math.max(0, H - m.b - y), r = Math.min(4, bw / 2, ht);
    const g = sv('g', { tabindex: 0, role: 'img', 'aria-label': b.label + ': ' + C.fmt(b.v, 1) + (o.unit || '') });
    if (ht > 0) g.appendChild(sv('path', { d: 'M' + (cx - bw / 2) + ' ' + (H - m.b) + 'V' + (y + r) + 'q0 ' + (-r) + ' ' + r + ' ' + (-r) + 'h' + (bw - 2 * r) + 'q' + r + ' 0 ' + r + ' ' + r + 'V' + (H - m.b) + 'Z', fill: b.muted ? 'var(--deemph)' : 'var(--s1)' }));
    g.appendChild(sv('rect', { x: cx - slot / 2, y: m.t, width: slot, height: H - m.t - m.b, fill: 'transparent' }));
    const on = () => { tipRows(tip, b.title || b.label, [{ v: C.fmt(b.v, 1) + (o.unit || ''), k: b.note || '' }]); showTip(host, tip, cx, Math.max(0, y - 44), W); };
    const offf = () => { tip.style.display = 'none'; };
    g.addEventListener('pointerenter', on); g.addEventListener('pointerleave', offf); g.addEventListener('focus', on); g.addEventListener('blur', offf);
    svg.appendChild(g);
    if (i % every === 0) svg.appendChild(sv('text', { x: cx, y: H - 6, 'text-anchor': 'middle', text: b.label }));
    if (i === n - 1 || b.v === Math.max(...o.bars.map(q => q.v))) svg.appendChild(sv('text', { class: 'end', x: cx, y: y - 5, 'text-anchor': 'middle', text: C.fmt(b.v, 0) }));
  });
}
export function spark(vals: number[], color?: string | null) {
  const W = 96, H = 30, n = vals.length;
  const svg = sv('svg', { class: 'spark', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
  if (n < 2) return svg;
  const lo = Math.min(...vals), hi = Math.max(...vals), X = (i: number) => 3 + i / (n - 1) * (W - 9), Y = (v: number) => 4 + (1 - (hi > lo ? (v - lo) / (hi - lo) : .5)) * (H - 8);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  svg.appendChild(sv('path', { d: d + 'L' + X(n - 1) + ' ' + H + 'L' + X(0) + ' ' + H + 'Z', fill: color || 'var(--s1)', opacity: .1 }));
  svg.appendChild(sv('path', { d, fill: 'none', stroke: color || 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  svg.appendChild(sv('circle', { cx: X(n - 1), cy: Y(vals[n - 1]), r: 3.5, fill: color || 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 }));
  return svg;
}
/* weekly sets against the zones */
export function meter(v: number, z: Zones) {
  const max = Math.max(z.high * 1.2, v * 1.05), p = (x: number) => Math.min(100, x / max * 100) + '%';
  const zone = h('i', { class: 'zone' }); zone.style.left = p(z.opt); zone.style.width = (Math.min(100, z.high / max * 100) - z.opt / max * 100) + '%';
  const fill = h('i', { class: 'fill z-' + C.zone(v, z) }); fill.style.width = p(v);
  const t1 = h('i', { class: 'tick' }); t1.style.left = p(z.min);
  return h('div', { class: 'meter', role: 'img', 'aria-label': C.fmt(v, 1) + ' подходов в неделю' }, zone, fill, t1);
}
export const zonePill = (v: number, z: Zones) => { const k = C.zone(v, z); return pill(C.ZONE[k].sev, C.ZONE[k].n); };
export const setChip = (s: SetRec, cls?: string) => h('span', { class: 'chip ' + (cls || '') + (s.warm ? ' warmup' : s.skip ? ' off' : s.r == null ? ' hole' : ''), title: s.warm ? 'разминочный' : s.skip ? 'не делал' : s.r == null ? 'повторы не записаны' : s.q != null ? 'в запасе повторов: ' + s.q : null }, C.fmt(s.w) + ' × ' + (s.skip ? '–' : s.r == null ? '?' : s.r), s.q != null && s.r != null && !s.skip ? h('small', null, 'r' + s.q) : null);
