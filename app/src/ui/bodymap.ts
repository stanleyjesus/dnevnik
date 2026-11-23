/* Нагрузка по мышцам на фигуре человека.
   Перенесено из reference/src/ui_body.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { C, h, sv } from './dom.ts';
import type { BodyOpts, SvgEl } from './types.ts';

/* ---------- UI: weekly load drawn on a body, front and back ---------- */
/* Shapes are given for the right half of a schematic figure as [offset from the centre line, y]; the left half is their mirror. */
export const BM = {
  head: [[0, 8], [8, 10], [13, 18], [14, 28], [12, 38], [7, 45], [0, 47]],
  outline: [[8, 42], [9, 51], [22, 56], [40, 60], [52, 64], [60, 73], [63, 90], [62, 110], [64, 132], [63, 150], [69, 166], [69, 187], [64, 216], [67, 232], [61, 250], [53, 241], [54, 216], [51, 190], [49, 162], [47, 150], [45, 128], [42, 107],
    [39, 119], [36, 137], [28, 160], [28, 177], [34, 194], [42, 224], [43, 250], [38, 284], [34, 302], [38, 326], [36, 350], [27, 384], [30, 398], [24, 408], [12, 406], [16, 384], [11, 350], [10, 326], [13, 302], [9, 270], [4, 228], [0, 216]],
  front: [
    { m: 'upper_back', pts: [[10, 51], [22, 56], [36, 60], [24, 62], [12, 60]] },
    { m: 'delt_mid', pts: [[47, 63], [54, 66], [60, 76], [60, 90], [54, 101], [51, 88], [51, 73]], at: [56, 80], ly: 62 },
    { m: 'delt_front', pts: [[34, 62], [44, 62], [49, 70], [49, 85], [44, 97], [38, 88], [34, 75]], at: [42, 79], ly: 80 },
    { m: 'chest', pts: [[3, 70], [16, 66], [30, 68], [36, 78], [36, 92], [29, 104], [15, 109], [4, 105]], at: [20, 88], ly: 98 },
    { m: 'biceps', pts: [[43, 101], [51, 103], [57, 116], [58, 132], [54, 148], [48, 148], [44, 135], [42, 117]], at: [51, 124], ly: 124 },
    { m: 'abs', one: true, pts: [[-12, 113], [12, 113], [14, 140], [13, 168], [8, 196], [0, 207], [-8, 196], [-13, 168], [-14, 140]], at: [7, 152], ly: 152,
      lines: [[[0, 115], [0, 204]], [[-13, 131], [13, 131]], [[-13.5, 149], [13.5, 149]], [[-12.5, 167], [12.5, 167]]] },
    { m: 'forearms', pts: [[49, 158], [58, 154], [66, 163], [68, 184], [64, 214], [55, 216], [52, 197], [50, 176]], at: [59, 186], ly: 188 },
    { m: 'quads', pts: [[8, 224], [22, 215], [36, 216], [42, 240], [41, 268], [35, 292], [27, 300], [18, 298], [11, 280], [8, 250]], at: [26, 256], ly: 256,
      lines: [[[24, 222], [22, 296]]] },
    { m: 'calves', pts: [[11, 312], [19, 315], [22, 338], [20, 362], [15, 368], [11, 342]] }
  ],
  back: [
    { m: 'delt_mid', pts: [[53, 65], [59, 71], [61, 85], [58, 98], [55, 86]] },
    { m: 'lats', pts: [[13, 113], [23, 95], [37, 91], [41, 105], [39, 127], [34, 150], [26, 170], [14, 178], [10, 150]], at: [30, 134], ly: 140 },
    { m: 'upper_back', one: true, pts: [[0, 46], [9, 52], [26, 58], [42, 63], [33, 76], [21, 91], [11, 112], [0, 130], [-11, 112], [-21, 91], [-33, 76], [-42, 63], [-26, 58], [-9, 52]], at: [14, 76], ly: 60,
      lines: [[[0, 50], [0, 127]]] },
    { m: 'delt_rear', pts: [[37, 65], [47, 62], [55, 69], [57, 83], [51, 93], [43, 86], [37, 76]], at: [47, 77], ly: 79 },
    { m: 'triceps', pts: [[44, 99], [54, 97], [60, 108], [62, 128], [58, 148], [50, 150], [45, 135], [43, 115]], at: [53, 122], ly: 116, lines: [[[52, 104], [53, 146]]] },
    { m: 'forearms', pts: [[49, 158], [58, 154], [66, 163], [68, 184], [64, 214], [55, 216], [52, 197], [50, 176]] },
    { m: 'erectors', pts: [[2, 135], [9, 139], [11, 164], [9, 188], [2, 192]], at: [6, 163], ly: 166 },
    { m: 'glutes', pts: [[2, 197], [18, 191], [34, 196], [40, 212], [37, 230], [23, 239], [7, 235], [2, 219]], at: [22, 215], ly: 214 },
    { m: 'hams', pts: [[8, 243], [22, 241], [38, 237], [42, 258], [39, 282], [32, 300], [17, 300], [10, 281], [7, 261]], at: [24, 268], ly: 268, lines: [[[23, 246], [24, 297]]] },
    { m: 'calves', pts: [[12, 309], [24, 305], [36, 311], [38, 332], [33, 356], [25, 369], [17, 358], [11, 334]], at: [24, 334], ly: 334, lines: [[[24, 309], [25, 364]]] }
  ],
  /* shapes that only give the figure its form: obliques, knees, shins, hands */
  extra: {
    front: [[[16, 115], [29, 110], [34, 130], [30, 158], [29, 180], [20, 192], [15, 172], [16, 142]], [[14, 301], [30, 301], [33, 310], [24, 316], [13, 311]], [[23, 318], [34, 314], [37, 334], [33, 362], [27, 380], [24, 350]]],
    back: [[[13, 180], [27, 172], [29, 188], [16, 190]], [[14, 301], [32, 301], [30, 306], [16, 306]], [[19, 371], [29, 371], [27, 384], [19, 384]]]
  }
};
/* a closed smooth curve through the points */
export function bmPath(pts: number[][], cx: number, flip?: boolean) {
  const P = pts.map(p => [cx + (flip ? -p[0] : p[0]), p[1]]), n = P.length, f = (v: number) => v.toFixed(1);
  let d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]);
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], e = P[(i + 2) % n], k = 0.165;
    d += 'C' + f(b[0] + (c[0] - a[0]) * k) + ' ' + f(b[1] + (c[1] - a[1]) * k) + ' ' + f(c[0] - (e[0] - b[0]) * k) + ' ' + f(c[1] - (e[1] - b[1]) * k) + ' ' + f(c[0]) + ' ' + f(c[1]);
  }
  return d + 'Z';
}
/* vals: sets per week by muscle; o: { z, ignore, sel, pick } */
export function bodyMap(vals: Record<string, number>, o: BodyOpts) {
  const zc = (m: string) => o.ignore[m] && (vals[m] || 0) < o.z.opt ? 'off' : C.zone(vals[m] || 0, o.z);
  const word = (m: string) => o.ignore[m] && (vals[m] || 0) < o.z.opt ? 'вне расчёта' : C.ZONE[C.zone(vals[m] || 0, o.z)].n;
  const figure = (side: 'front' | 'back', cx: number, labelsLeft: boolean, caption: string) => {
    const both = (half: number[][]) => half.concat(half.slice(1, -1).reverse().map(p => [-p[0], p[1]]));
    const full = BM.outline.concat(BM.outline.slice(0, -1).reverse().map(p => [-p[0], p[1]]));
    const g = [sv('path', { class: 'bm-body', d: bmPath(full, cx) }), sv('path', { class: 'bm-body', d: bmPath(both(BM.head), cx) })];
    for (const pts of BM.extra[side]) g.push(sv('path', { class: 'bm-x', d: bmPath(pts, cx, false) }), sv('path', { class: 'bm-x', d: bmPath(pts, cx, true) }));
    const labels: SvgEl[] = [], seams: SvgEl[] = [];
    const seam = (ln: number[][], flip: boolean) => seams.push(sv('path', { class: 'bm-seam', d: 'M' + ln.map(p => (cx + (flip ? -p[0] : p[0])).toFixed(1) + ' ' + p[1]).join('L') }));
    for (const s of BM[side]) {
      const name = C.MUSCLE[s.m].n, v = vals[s.m] || 0, cls = 'bm z-' + zc(s.m) + (o.sel === s.m ? ' sel' : '');
      const tip = name + ': ' + C.fmt(v, 1) + ' в неделю — ' + word(s.m);
      const shape = (flip: boolean) => { const p = sv('path', { class: cls, d: bmPath(s.pts, cx, flip), role: 'button', tabindex: flip ? -1 : 0, 'aria-label': tip }, sv('title', null, tip)); if (o.pick) { p.addEventListener('click', () => o.pick!(s.m)); p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.pick!(s.m); } }); } return p; };
      g.push(shape(false));
      if (!s.one) g.push(shape(true));
      for (const ln of s.lines || []) { seam(ln, false); if (!s.one) seam(ln, true); }
      if (!s.at) continue;
      const ax = labelsLeft ? cx - s.at[0] : cx + s.at[0], lx = labelsLeft ? 147 : 148;
      labels.push(sv('path', { class: 'bm-lead', d: 'M' + lx + ' ' + s.ly + 'L' + (labelsLeft ? Math.min(ax, lx + 14) : Math.max(ax, lx - 14)) + ' ' + s.ly + 'L' + ax + ' ' + s.at[1] }), sv('circle', { class: 'bm-dot', cx: ax, cy: s.at[1], r: 1.8 }),
        sv('rect', { class: 'bm-key z-' + zc(s.m), x: labelsLeft ? 137 : 150, y: s.ly - 5, width: 8, height: 8, rx: 2 }),
        sv('text', { class: 'bm-t' + (o.sel === s.m ? ' sel' : ''), x: labelsLeft ? 133 : 162, y: s.ly + 3.5, 'text-anchor': labelsLeft ? 'end' : 'start', onclick: o.pick ? () => o.pick!(s.m) : null }, name + ' ', sv('tspan', { class: 'bm-v' }, C.fmt(v, 1))));
    }
    return h('figure', { class: 'bm-fig' }, sv('svg', { viewBox: '0 0 300 416', role: 'group', 'aria-label': 'Нагрузка по мышцам, вид ' + caption }, g, seams, labels), h('figcaption', null, 'Вид ' + caption));
  };
  return h('div', { class: 'bodymap' }, figure('front', 226, true, 'спереди'), figure('back', 74, false, 'сзади'));
}
