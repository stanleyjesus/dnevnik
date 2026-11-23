const Core = require('./core.js');
const raw = require('./workouts.json'), cfg = Core.mergeCfg(require('./config.json'));
const W = Core.sortW(raw.map(d => Core.fromDoc(d.date, d)));
const show = (W, cfg, slot, date, label) => {
  const a = Core.adapt(W, cfg, slot, date);
  console.log('\n=== ' + (label || '') + ' ' + slot + ' ' + date + ' | deload ' + a.deload + ' (' + a.worse + '/' + a.of + ')');
  for (const p of a.props) console.log('  [' + p.tag + '] ' + Core.exName(cfg, p.ex) + ' -> ' + p.sets.map(s => Core.fmt(s.w) + '(' + s.tg[0] + '+)').join(' ') + (p.cyc ? ' cyc ' + p.cyc.pct + '/' + p.cyc.reps : '') + '\n      ' + p.notes.join('\n      '));
  for (const d of a.adds) console.log('  [add] ' + d.name + ' ' + d.sets + 'x8-12 id=' + d.exId + (d.def ? ' (new)' : '') + ' — ' + d.why);
  const ap = Core.applyAdapt(a, {});
  console.log('  applied items:', ap.items.length, 'create:', Object.keys(ap.create).join(','));
  return a;
};
const pl = Core.planned(W, cfg);
console.log('planned volume', JSON.stringify(Object.fromEntries(Object.entries(pl.pv).map(([k, v]) => [k, +v.toFixed(1)]))), 'load', JSON.stringify(pl.load), 'pat', JSON.stringify(pl.pp));
show(W, cfg, 'wed', '2025-11-12'); show(W, cfg, 'fri', '2025-11-14'); show(W, cfg, 'mon', '2025-11-17');
// historic replay: what would it have said on earlier dates
show(W, cfg, 'mon', '2025-10-27', 'replay'); show(W, cfg, 'mon', '2025-10-13', 'replay after gap'); show(W, cfg, 'wed', '2025-09-24', 'replay'); show(W, cfg, 'wed', '2025-10-22', 'replay');
// synthetic: plateau + failed wave + fatigue
const W2 = Core.clone(W);
const add = (date, slot, items) => W2.push({ id: date, date, slot, note: '', open: false, items: items.map(i => ({ ex: i[0], range: i[2] ? null : [8, 12], cyc: i[2] || null, sets: Core.parseSets(i[1]), note: '', skip: false, rir: null })) });
add('2025-11-17', 'mon', [['bench', '85x5 85x5 85x4 85x3', { pct: 77, reps: 5 }], ['lat_pulldown', '55x11 52.5x11 52.5x10 50x11'], ['leg_curl_seated', '37.5x11 37.5x9 35x11 35x9'], ['lat_raise_machine', '22.5x10 22.5x9 20x12 20x11'], ['tri_overhead', '20x9 20x9 17.5x11'], ['hammer', '16x10 16x6 14x12']]);
add('2025-11-24', 'mon', [['bench', '85x5 85x4 85x4 85x3', { pct: 77, reps: 5 }], ['lat_pulldown', '55x10 52.5x11 52.5x10 50x11'], ['leg_curl_seated', '37.5x10 37.5x9 35x11 35x9'], ['lat_raise_machine', '22.5x10 22.5x9 20x12 20x10'], ['tri_overhead', '20x9 20x8 17.5x11'], ['hammer', '16x9 16x6 14x12']]);
add('2025-12-01', 'mon', [['bench', '85x5 85x4 85x4 85x3', { pct: 77, reps: 5 }], ['lat_pulldown', '55x10 52.5x10 52.5x10 50x11'], ['leg_curl_seated', '37.5x10 37.5x9 35x10 35x9'], ['lat_raise_machine', '22.5x10 22.5x9 20x12 20x10'], ['tri_overhead', '20x9 20x8 17.5x11'], ['hammer', '16x9 16x6 14x12']]);
const W3 = Core.sortW(W2);
show(W3, cfg, 'mon', '2025-12-08', 'synthetic plateau');
