const N = require('./core.js'), O = require('./core.v5.js');
const docs = require('./workouts.json'), raw = require('./config.json');
const strip = a => JSON.stringify({ items: a.base.items.map(it => ({ ex: it.ex, cyc: it.cyc, range: it.range, sets: it.sets, tm: it.tm })), props: a.props, adds: a.adds.map(d => [d.key, d.exId, d.sets, d.range, d.why]), off0: a.off0, deload: a.deload });
let same = true;
for (const [slot, date] of [['wed', '2025-11-12'], ['fri', '2025-11-14'], ['mon', '2025-11-17']]) {
  const a = strip(N.adapt(N.sortW(docs.map(d => N.fromDoc(d.date, d))), N.mergeCfg(raw), slot, date));
  const b = strip(O.adapt(O.sortW(docs.map(d => O.fromDoc(d.date, d))), O.mergeCfg(raw), slot, date));
  if (a !== b) { same = false; console.log('DIFF', slot, '\n new', a.slice(0, 600), '\n old', b.slice(0, 600)); }
}
console.log('plans without a programme identical to the published version:', same);
const W = N.sortW(docs.map(d => N.fromDoc(d.date, d)));
const st = c => ({ workouts: W, cfg: c, body: [], today: '2025-11-11' });
console.log('insights identical:', JSON.stringify(N.insights(st(N.mergeCfg(raw)))) === JSON.stringify(O.insights({ workouts: O.sortW(docs.map(d => O.fromDoc(d.date, d))), cfg: O.mergeCfg(raw), body: [], today: '2025-11-11' })));
const pvN = N.planned(W, N.mergeCfg(raw)).pv, pvO = O.planned(O.sortW(docs.map(d => O.fromDoc(d.date, d))), O.mergeCfg(raw)).pv;
console.log('planned volume identical:', JSON.stringify(pvN) === JSON.stringify(pvO));

/* old marks are read by the new rules */
const r2 = JSON.parse(JSON.stringify(raw)); r2.ex.incline_db.goal = 'strength'; r2.ex.barbell_curl.goal = 'strength'; r2.ex.pec_fly.goal = 'mass'; r2.ex.bench.goal = 'mass'; r2.ex.pullup.goal = 'hold';
const c2 = N.mergeCfg(r2);
console.log('marks:', ['incline_db', 'barbell_curl', 'pec_fly', 'bench', 'pullup'].map(i => i + '→' + N.goalOf(c2, i) + ' (' + N.kindOf(c2, i) + ')').join(', '));
const pc = N.planCycle(W, c2, 'pullup', '2025-11-14');
console.log('pull-ups on hold:', pc.sets + '×' + pc.reps, 'по', pc.w, 'tm', pc.tm.toFixed(2), 'keep', pc.keep);

/* isolation: a range narrower than one weight step asks for */
const d3 = JSON.parse(JSON.stringify(docs)); const f = d3.find(d => d.date === '2025-11-07'); f.items.find(i => i.ex === 'bayesian_curl').rng = '8-12';
const W3 = N.sortW(d3.map(d => N.fromDoc(d.date, d))), A = N.adapt(W3, N.mergeCfg(raw), 'fri', '2025-11-14'), p = A.props.find(x => x.ex === 'bayesian_curl');
console.log('iso range proposal:', p ? '[' + p.tag + '] ' + p.notes[0] + ' | sets ' + p.sets.map(x => x.w + '(' + x.tg.join('–') + ')').join(' ') + ' | range ' + p.range.join('–') + ' | on ' + !A.off0[p.key] : 'NONE');
const it = N.applyAdapt(A, A.off0).items.find(i => i.ex === 'bayesian_curl'); console.log('applied:', it.range.join('-'), it.sets.map(s => s.w).join(' '));

/* hold: a big reserve does not raise the maximum */
const d4 = JSON.parse(JSON.stringify(docs)); d4.find(d => d.date === '2025-11-07').items.find(i => i.ex === 'pullup').sets = '92.5x4@5 92.5x4@5 92.5x4@5 92.5x4@5';
const W4 = N.sortW(d4.map(d => N.fromDoc(d.date, d)));
const usual = N.adapt(W4, N.mergeCfg(raw), 'fri', '2025-11-14').props.find(x => x.ex === 'pullup'), held = N.adapt(W4, c2, 'fri', '2025-11-14').props.find(x => x.ex === 'pullup');
console.log('reserve 5 on pull-ups: usual wave →', usual ? usual.tag : 'none', '| on hold →', held ? held.tag : 'none');
