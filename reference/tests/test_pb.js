/* powerbuilding: one lift on «сила по запасу» twice a week plus a mass day, the other lifts on hold, the muscles built evenly */
const assert = require('assert');
const C = require('./core.js');
const clone = o => JSON.parse(JSON.stringify(o));
const raw = require('./config.json'), W = C.sortW(require('./workouts.json').map(d => C.fromDoc(d.date, d)));
const cfg = C.mergeCfg(raw), tot = t => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
const A = C.AUTO, LA = C.LIGHT_A;
const session = (WW, date, slot, ex, w, reps, qs, pct, tm) => WW.push(C.fromDoc(date, { date, slot, items: [{ ex, cyc: (pct || A.pct) + '/' + (pct ? reps[0] : A.reps), tm: tm || +(w / ((pct || A.pct) / 100)).toFixed(2), sets: reps.map((r, i) => w + 'x' + r + (qs && qs[i] != null ? '@' + qs[i] : '')).join(' ') }] }));

/* 1. the scheme: one weight, four by four, the last set decides */
{ const r = clone(raw); r.ex.bench.goal = 'auto'; const c = C.mergeCfg(r), WW = W.slice();
  assert.strictEqual(C.goalOf(c, 'bench'), 'auto'); assert.strictEqual(C.goalName(c, 'bench'), 'сила по запасу');
  const wv = C.waveOf(c, 'bench'); assert(wv.auto && wv.keep && wv.order.join() === '4' && wv.sets(4) === 4 && wv.pct[4] === 83 && wv.inc === 0);
  /* from the wave: the same maximum, 83% of it */
  let p = C.planCycle(WW, c, 'bench', '2025-11-17');
  assert(p.auto && p.verdict === 'start' && p.w === 90 && p.sets === 4 && p.reps === 4 && p.pct === 83 && Math.abs(p.tm - 109.2) < 0.1, JSON.stringify(p));
  const steps = [[[4, 4, 4, 4], [, , , 3], 92.5, 'up'], [[4, 4, 4, 4], [, , , 2], 95, 'up'], [[4, 4, 4, 4], [, , , 1], 95, 'hold'], [[4, 4, 4, 4], [3, 3, 2, 2], 97.5, 'up'],
    [[4, 4, 4, 3], [, , , 0], 92.5, 'down'], [[4, 4, 4, 4], [], 95, 'up'], [[4, 4, 4, 4], [, , , 0], 90, 'down'], [[4, 4, 3, 4], [, , , 2], 85, 'down']];
  let d = new Date('2025-11-17T00:00:00Z'); const seen = [];
  for (const [reps, qs, next, verdict] of steps) {
    const date = d.toISOString().slice(0, 10); p = C.planCycle(C.sortW(WW), c, 'bench', date);
    session(WW, date, 'mon', 'bench', p.w, reps, qs); d = new Date(d.getTime() + 7 * 864e5);
    const n = C.planCycle(C.sortW(WW), c, 'bench', d.toISOString().slice(0, 10)); seen.push(p.w + '→' + n.w + ' ' + n.verdict);
    assert.strictEqual(n.w, next, 'after ' + p.w + ' ' + reps + ' @' + qs + ': ' + n.w); assert.strictEqual(n.verdict, verdict); assert(Math.abs(n.tm - n.w / 0.83) < 1e-6 && n.sets === 4 && n.reps === 4 && !n.repeat && !n.hard);
  }
  console.log('scheme:', seen.join(' | '));
  /* the day's plan carries the scheme and its maximum */
  const WS = C.sortW(WW), it = C.plan(WS, c, 'mon', d.toISOString().slice(0, 10)).items.find(x => x.ex === 'bench');
  assert(it && it.cyc.pct === 83 && it.cyc.reps === 4 && it.sets.length === 4 && it.sets.every(s => s.w === 85) && Math.abs(it.tm - 85 / 0.83) < 0.01, JSON.stringify(it && it.cyc));
  /* the weight was changed by hand: the next week goes from what was lifted */
  session(WW, d.toISOString().slice(0, 10), 'mon', 'bench', 87.5, [4, 4, 4, 4], [, , , 2]); d = new Date(d.getTime() + 7 * 864e5);
  assert.strictEqual(C.planCycle(C.sortW(WW), c, 'bench', d.toISOString().slice(0, 10)).w, 90);
  /* no adjustments on top: the scheme corrects itself */
  const ad = JSON.stringify(C.adapt(C.sortW(WW), c, 'mon', d.toISOString().slice(0, 10)));
  assert(!/Плато|Недогруз|Запас меньше расчётного/.test(ad), 'an adjustment on a self-correcting lift');
  /* the same journal on the wave does get one: two sessions in a row were not closed */
  { const rw = clone(raw), cw = C.mergeCfg(rw), Ww = W.slice(); session(Ww, '2025-11-17', 'mon', 'bench', 87.5, [4, 4, 3, 3], null, 82); session(Ww, '2025-11-24', 'mon', 'bench', 87.5, [4, 3, 3, 3], null, 82);
    assert(/Плато/.test(JSON.stringify(C.adapt(C.sortW(Ww), cw, 'mon', '2025-12-01'))), 'the wave lost its own adjustment'); }
  /* a full set every time: about two reps from failure */
  assert.strictEqual(C.estRir(A.pct, A.reps), 2); assert.strictEqual(C.cycleVol(c, 'bench'), 1); assert.strictEqual(C.waveSetsAvg(c, 'bench'), 4);
  /* pull-ups move by their own step */
  const r2 = clone(raw); r2.ex.pullup.goal = 'auto'; r2.gear = { g: { n: 'Подтягивания', step: 1 } }; r2.ex.pullup.gear = 'g'; const c3 = C.mergeCfg(r2), W3 = W.slice();
  const p0 = C.planCycle(W3, c3, 'pullup', '2025-11-21'); session(W3, '2025-11-21', 'fri', 'pullup', p0.w, [4, 4, 4, 4], [, , , 3]);
  assert.strictEqual(C.planCycle(C.sortW(W3), c3, 'pullup', '2025-11-28').w, p0.w + 1); console.log('pull-ups:', p0.w, '→', p0.w + 1); }

/* 2. the build */
const accept = (rawCfg, pr, since) => { const r = clone(rawCfg);
  for (const [id, def] of Object.entries(pr.create)) if (!r.ex[id]) r.ex[id] = def;
  for (const [id, g] of Object.entries(pr.goals)) { if (!r.ex[id]) continue; if (g) r.ex[id].goal = g; else delete r.ex[id].goal; }
  r.program = { name: pr.name, focus: pr.focus, others: pr.others, budget: pr.budget, since, slots: Object.fromEntries(C.SLOTS.map(sl => [sl.id, pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex })])) };
  return r; };
const rawBig = clone(raw); Object.assign(rawBig.ex, require('./fixtures/p2-stored.json').ex, clone(raw).ex); const big = C.mergeCfg(rawBig);
let k = 0;
for (const [title, c, o] of [['bench', cfg, { focus: 'bench' }], ['leg press', cfg, { focus: 'leg_press' }], ['pull-ups', cfg, { focus: 'pullup' }], ['bench 70', cfg, { focus: 'bench', budget: 70 }], ['pull-ups 60', cfg, { focus: 'pullup', budget: 60 }],
  ['bench, big list', big, { focus: 'bench' }], ['leg press 80, big list', big, { focus: 'leg_press', budget: 80 }], ['bench, others grow', cfg, { focus: 'bench', others: 'grow' }]]) {
  const pr = C.buildProgram(W, c, o), T = pr.after, f = o.focus, lid = f + '_light', all = C.SLOTS.flatMap(sl => pr.slots[sl.id]), cap = o.budget || 100;
  const dayOf = id => C.SLOTS.filter(sl => pr.slots[sl.id].some(e => e.ex === id));
  assert.strictEqual(pr.name, 'Пауэрбилдинг: ' + c.ex[f].n.toLowerCase()); assert.strictEqual(pr.focus, f); assert.strictEqual(pr.budget, cap);
  /* the lifts: the priority by reserve, the others on hold or as they were */
  assert.strictEqual(pr.goals[f], 'auto'); assert.strictEqual(C.goalOf(pr.cfg, f), 'auto');
  for (const id of ['bench', 'leg_press', 'pullup']) if (id !== f) assert.strictEqual(pr.goals[id], o.others === 'grow' ? null : 'hold', title + ': ' + id);
  /* two strength days: the heavy one first in its day, the light one first in another */
  const hd = dayOf(f), ld = dayOf(lid);
  assert(hd.length === 1 && ld.length === 1 && hd[0] !== ld[0], title + ': days'); assert.strictEqual(pr.slots[hd[0].id][0].ex, f); assert.strictEqual(pr.slots[ld[0].id][0].ex, lid);
  assert(C.isLight(pr.cfg, lid) && pr.cfg.ex[lid].of === f && C.lightOf(pr.cfg, lid) === LA);
  /* and a mass day: the remaining day has an exercise for the main muscle of the lift, and the build did not take it away */
  const fm = c.ex[f].m, mains = Object.keys(fm).filter(m => fm[m] >= 1), third = C.SLOTS.filter(sl => sl !== hd[0] && sl !== ld[0] && pr.slots[sl.id].length);
  for (const sl of third) { const e = pr.slots[sl.id].find(x => x.n && mains.some(m => (pr.cfg.ex[x.ex].m[m] || 0) >= 1) && ['compound', 'iso'].includes(C.kindOf(pr.cfg, x.ex)));
    assert(e && e.n >= 2, title + ': no mass exercise ' + sl.id); assert(e.pin && pr.notes.some(n => n.t.startsWith('Третий день') && n.t.endsWith(': ' + pr.cfg.ex[e.ex].n)), title + ': the mass day note does not name ' + e.ex + ' ' + sl.id); }
  assert(pr.notes.some(n => /сила по запасу/.test(n.t)) && pr.notes.some(n => /^Второй день/.test(n.t)) && pr.notes.some(n => /^Третий день/.test(n.t)), title + ': notes');
  /* everything else: evenly, inside the limits, out of the count at zero, two days for every muscle */
  const tr = C.MUSCLES.filter(m => !c.ignore[m.id]).map(m => m.id), v = tr.map(m => T.pv[m] || 0);
  assert(!C.ruleBreaks(pr.cfg, T).length && tot(T) <= cap + 0.01, title + ': limits ' + tot(T));
  for (const m of Object.keys(c.ignore)) assert(!(T.pv[m] > 0), title + ': ' + m + ' is counted');
  assert(Math.max(...v) - Math.min(...v) <= 5.01, title + ': spread ' + Math.min(...v) + '–' + Math.max(...v));
  if (cap >= 100) assert(Math.min(...v) >= 9.2, title + ': below the zone ' + Math.min(...v));
  const once = tr.filter(m => C.SLOTS.filter(sl => (T.day[sl.id][m] || 0) >= 1.99).length < 2), nt = pr.notes.find(n => /Один день в неделю/.test(n.t));
  assert(once.length <= 1 && once.every(m => nt && nt.t.includes(C.MUSCLE[m].n.toLowerCase())), title + ': one day for ' + once);
  for (const sl of C.SLOTS) { const ids = pr.slots[sl.id].map(e => e.ex); assert.strictEqual(new Set(ids).size, ids.length, title + ': twice in a day'); }
  console.log(title.padEnd(24), 'sets', tot(T).toFixed(0), '| heavy', hd[0].id, 'light', ld[0].id, '| muscles', Math.min(...v).toFixed(1) + '–' + Math.max(...v).toFixed(1), '| lift sets/week', (C.AUTO.sets + LA.sets));
  k++;
}
/* 3. accepted: the weeks that follow */
{ const pr = C.buildProgram(W, cfg, { focus: 'bench' }), r = accept(raw, pr, '2025-11-15'), c = C.mergeCfg(r), WW = W.slice();
  const mon = C.plan(WW, c, 'mon', '2025-11-17'), b = mon.items[0];
  assert(b.ex === 'bench' && b.cyc.pct === 83 && b.sets.length === 4 && b.sets[0].w === 90, 'the heavy day: ' + JSON.stringify(b.cyc) + ' ' + b.sets[0].w);
  session(WW, '2025-11-17', 'mon', 'bench', 90, [4, 4, 4, 4], [, , , 3]);
  const fri = C.plan(C.sortW(WW), c, 'fri', '2025-11-21'), l = fri.items[0];
  assert(l.ex === 'bench_light' && l.cyc.pct === LA.pct && l.cyc.reps === LA.reps && l.sets.length === LA.sets, 'the light day: ' + JSON.stringify(l.cyc));
  assert.strictEqual(l.sets[0].w, 85);                              // 78% of 90 / 0.83 = 84.6, rounded to 2.5
  assert.strictEqual(C.estRir(LA.pct, LA.reps), 4); assert.strictEqual(C.cycleVol(c, 'bench_light'), 0.5);
  const lp = C.plan(WW, c, 'wed', '2025-11-19').items.find(x => x.ex === 'leg_press');
  assert(lp && lp.sets.length === 3, 'a lift on hold keeps three sets'); const tm0 = C.planCycle(WW, c, 'leg_press', '2025-11-19').tm;
  session(WW, '2025-11-19', 'wed', 'leg_press', lp.sets[0].w, [lp.cyc.reps, lp.cyc.reps, lp.cyc.reps], null, lp.cyc.pct, tm0);
  assert(Math.abs(C.planCycle(C.sortW(WW), c, 'leg_press', '2025-11-26').tm - tm0) < 0.01, 'the maximum of a lift on hold moved');
  assert.strictEqual(C.plan(C.sortW(WW), c, 'mon', '2025-11-24').items[0].sets[0].w, 92.5);
  console.log('accepted: mon 4×4 по 90 → fri 3×4 по', l.sets[0].w, '→ next mon', 92.5, '| leg press on hold:', lp.sets.length, '×', lp.cyc.reps);
  /* a build for the muscles later keeps a lift the athlete left on «сила по запасу», and gives the others their wave back */
  const again = C.buildProgram(C.sortW(WW), c, {});
  assert.strictEqual(again.goals.bench, 'auto'); assert.strictEqual(again.goals.leg_press, null); assert(!C.SLOTS.some(sl => again.slots[sl.id].some(e => e.ex === 'bench_light')), 'the light day outlived the priority'); }
/* mass and strength: the lifts done by percentages are strength work, the rest is work for mass; the two add up to the total */
{ const split = (c, o) => { const pr = C.buildProgram(W, c, o), T = pr.after; return { T, of: m => [+((T.pv[m] || 0) - (T.ps[m] || 0)).toFixed(2), +(T.ps[m] || 0).toFixed(2)] }; };
  const pb = split(cfg, { focus: 'bench', budget: 100 });
  for (const m of C.MUSCLES) { const v = pb.T.pv[m.id] || 0, s = pb.T.ps[m.id] || 0; assert(s >= 0 && s <= v + 1e-9, m.id + ': strength work is more than the total'); }
  assert.deepStrictEqual(pb.of('chest'), [6, 5.5], 'chest: 6 for mass, 4 heavy sets and 3 light ones at half for strength');
  assert.deepStrictEqual(pb.of('triceps')[1], 2.75, 'triceps help in the bench: half of the chest');
  assert.strictEqual(pb.of('hams')[1], 0, 'hamstrings have no lift by percentages');
  assert.strictEqual(pb.of('quads')[1], 2, 'leg press on hold: three sets, two of three weeks at half');
  /* the usual wave: four sets, one week of three counts in full */
  const ev = split(cfg, {});
  assert(Math.abs(ev.of('chest')[1] - 4 * 2 / 3) < 0.01, 'the usual wave gives the chest 2.67 of strength work');
  /* a profile without lifts by percentages has no strength work at all */
  const second = C.mergeCfg(require('./config_p2.json')), hp = C.buildProgram([], second, { budget: 60 });
  assert(Object.values(hp.after.ps).every(v => !v), 'a profile on double progression shows strength work');
  console.log('mass / strength: chest', pb.of('chest').join(' + '), '| triceps', pb.of('triceps').join(' + '), '| quads', pb.of('quads').join(' + '), '| lats', pb.of('lats').join(' + '), '| usual wave, chest', ev.of('chest').map(x => x.toFixed(2)).join(' + ')); }
/* the same split in the weeks by fact: a lift logged by percentages is strength work */
{ const vol = C.volume(W, cfg), wi = C.weeksInfo(W, cfg, '2025-11-12'), av = C.avgVolume(vol, wi.ref);
  for (const k of Object.keys(vol)) for (const m of C.MUSCLES) assert((vol[k].s[m.id] || 0) <= (vol[k].m[m.id] || 0) + 1e-9, 'week ' + k + ', ' + m.id + ': strength work is more than the total');
  assert.strictEqual(vol[9].s.chest, 2); assert.strictEqual(vol[9].m.chest, 9); assert.strictEqual(vol[10].s.chest, 4, 'week 10: four sets at 87% count in full');
  assert(!vol[9].s.hams && !av.avgS.hams, 'hamstrings got strength work');
  assert.strictEqual(C.splitText(av.avg.chest, av.avgS.chest), 'масса 7.6 · сила 2.7'); assert.strictEqual(C.splitText(10, 0), ''); assert.strictEqual(C.splitText(9, 2.75), 'масса 6.2 · сила 2.8', 'the two parts must add up to the shown total');
  console.log('by fact, weeks', wi.ref.map(w => w.no).join(', ') + ': chest', C.splitText(av.avg.chest, av.avgS.chest), '| lats', C.splitText(av.avg.lats, av.avgS.lats), '| quads', C.splitText(av.avg.quads, av.avgS.quads), '| glutes', C.splitText(av.avg.glutes, av.avgS.glutes)); }
console.log('powerbuilding: ok,', k, 'builds');
