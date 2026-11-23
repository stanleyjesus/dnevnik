const C = require('./core.js');
const W = C.sortW(require('./workouts.json').map(d => C.fromDoc(d.date, d)));
const raw = require('./config.json');
const cfg = C.mergeCfg(raw);
const show = (pr) => {
  console.log('\n=== ' + pr.name + (pr.others ? ' / others ' + pr.others : '') + ' | same=' + pr.same);
  for (const sl of C.SLOTS) {
    console.log(' ' + sl.s + '  ' + pr.after.load[sl.id].toFixed(2) + ' (было ' + pr.before.load[sl.id] + ')');
    for (const e of pr.slots[sl.id]) {
      const k = C.kindOf(pr.cfg, e.ex), wv = C.waveOf(pr.cfg, e.ex);
      const sch = k === 'light' ? '3×5 @75%' : k === 'base' ? wv.order.map(r => wv.sets(r) + '×' + r).join('→') + (wv.strong ? ' heavy' : wv.hold ? ' hold' : '') : e.n + ' × ' + C.rangeOf(W, pr.cfg, e.ex).join('–');
      console.log('    ' + C.exName(pr.cfg, e.ex).padEnd(44) + sch + (e.isNew ? '  NEW' : '') + (e.chg ? '  chg ' + e.chg : ''));
    }
  }
  for (const n of pr.notes) console.log('  • ' + n.t + '\n      ' + n.x);
  console.log('  goals', JSON.stringify(pr.goals), 'create', Object.keys(pr.create).join(','));
  console.log('  vol: ' + C.MUSCLES.map(m => m.id + ' ' + (pr.before.pv[m.id] || 0).toFixed(1) + '→' + (pr.after.pv[m.id] || 0).toFixed(1)).join(', '));
};
for (const o of [{ focus: 'bench' }, { focus: 'bench', others: 'grow' }, { focus: 'pullup' }, { focus: 'leg_press' }, {}]) show(C.buildProgram(W, cfg, o));

/* accept the bench programme and walk three weeks */
const accept = (rawCfg, pr, since) => {
  const r = JSON.parse(JSON.stringify(rawCfg));
  for (const [id, def] of Object.entries(pr.create)) if (!r.ex[id]) r.ex[id] = def;
  const prev = {};
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; prev[id] = r.ex[id].goal || null; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  r.program = { name: pr.name, focus: pr.focus, others: pr.others, since, slots: Object.fromEntries(C.SLOTS.map(sl => [sl.id, pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex })])), prev: { goals: prev } };
  return r;
};
let raw2 = accept(raw, C.buildProgram(W, cfg, { focus: 'bench' }), '2025-11-11');
let cfg2 = C.mergeCfg(raw2), WW = W.slice();
const line = it => C.exName(cfg2, it.ex).slice(0, 34).padEnd(35) + (it.cyc ? it.sets.length + '×' + it.cyc.reps + ' @' + it.cyc.pct + '% по ' + it.sets[0].w + (it.tm ? ' tm ' + it.tm : '') : it.range.join('-') + ' | ' + it.sets.map(s => s.w).join(' '));
const days = [['wed', '2025-11-12'], ['fri', '2025-11-14'], ['mon', '2025-11-17'], ['wed', '2025-11-19'], ['fri', '2025-11-21'], ['mon', '2025-11-24'], ['wed', '2025-11-26'], ['fri', '2025-11-28'], ['mon', '2025-12-01'], ['wed', '2025-12-03'], ['fri', '2025-12-05'], ['mon', '2025-12-08'], ['wed', '2025-12-10'], ['fri', '2025-12-12'], ['mon', '2025-12-15']];
let n = 0;
for (const [slot, date] of days) {
  const A = C.adapt(WW, cfg2, slot, date), sel = C.applyAdapt(A, A.off0);
  if (n < 4) {
    console.log('\n--- ' + slot + ' ' + date + ' prog=' + A.base.prog + ' template=' + A.base.template + ' sets=' + sel.items.reduce((a, it) => a + it.sets.length, 0));
    for (const it of sel.items) console.log('   ' + line(it));
    for (const p of A.props) console.log('   [' + p.tag + '] ' + C.exName(cfg2, p.ex) + ' on=' + !A.off0[p.key] + ' :: ' + p.notes[0].slice(0, 110));
    for (const a of A.adds) console.log('   [add] ' + a.name + ' on=' + !A.off0[a.key]);
  } else {
    console.log(slot + ' ' + date + ' prog=' + A.base.prog + ' | ' + sel.items.filter(it => it.cyc).map(it => C.exName(cfg2, it.ex).slice(0, 22) + ' ' + it.sets.length + '×' + it.cyc.reps + ' по ' + it.sets[0].w).join(' | '));
  }
  n++;
  /* do the workout exactly as planned: wave reps closed, double progression mid-range */
  const w = { id: date, date, slot, note: '', open: false, items: sel.items.map(it => { const hh = it.cyc ? null : C.hints(WW, cfg2, it.ex, slot, date); return Object.assign({}, it, { sets: it.sets.map((s, i) => { const p = hh && hh.prevSets[i]; return { w: s.w == null ? 20 : s.w, r: it.cyc ? it.cyc.reps : p && p.r != null && p.w === s.w ? Math.min(it.range[1], p.r + 1) : it.range[0] + 1 }; }) }); }) };
  WW = C.sortW(WW.concat([C.fromDoc(w.id, C.toDoc(w))]));
}
const st = { workouts: WW, cfg: cfg2, body: [], today: '2025-12-16' };
console.log('\ninsights:', C.insights(st).map(i => i.sev + ':' + i.title).join(' | ').slice(0, 900));
console.log('prog ids has light:', C.program(WW, cfg2).has('bench_light'), '| light status:', C.allStats(WW, cfg2).find(s => s.id === 'bench_light').status);
console.log('after 5 weeks: rebuild none ->');
show(C.buildProgram(WW, cfg2, {}));
console.log('prompt line:', C.coachPrompt(st, '').split('\n').find(l => l.startsWith('ПРОГРАММА')));
