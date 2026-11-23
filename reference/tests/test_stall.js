const Core = require('./core.js');
const raw = require('./workouts.json'), cfg = Core.mergeCfg(require('./config.json'));
const W = Core.sortW(raw.map(d => Core.fromDoc(d.date, d)));
const show = (W, slot, date, label) => { const a = Core.adapt(W, cfg, slot, date); console.log('=== ' + label + ' ' + slot + ' ' + date); for (const p of a.props) console.log('  [' + p.tag + '] ' + Core.exName(cfg, p.ex) + ' -> ' + p.sets.map(s => Core.fmt(s.w) + '(' + s.tg[0] + '+)').join(' ') + ' | ' + p.notes.join(' | ')); };
show(W, 'wed', '2025-11-12', 'now'); show(W, 'fri', '2025-11-14', 'now'); show(W, 'mon', '2025-11-17', 'now');
console.log('insights about stalled sets now:', Core.insights({ workouts: W, cfg, body: [], today: '2025-11-11' }).filter(i => /стоит|стоят/.test(i.title)).map(i => i.title));
// a case that must still be caught: nothing in the exercise moves for four Mondays except one earlier record
const W2 = Core.clone(W);
const mon = ['2025-10-20', '2025-10-27', '2025-11-03', '2025-11-10'];
mon.forEach((d, k) => { W2.find(w => w.date === d).items.find(i => i.ex === 'lat_pulldown').sets = Core.parseSets(['50x12 50x11 50x9 50x9', '50x12 50x11 50x9 50x9', '50x12 50x10 50x9 50x9', '50x12 50x11 50x9 50x9'][k]); });
show(Core.sortW(W2), 'mon', '2025-11-17', 'synthetic: every set flat, first at top of range');
mon.forEach((d, k) => { W2.find(w => w.date === d).items.find(i => i.ex === 'lat_pulldown').sets = Core.parseSets(['50x10 50x11 50x9 50x9', '50x11 50x11 50x9 50x9', '50x11 50x10 50x9 50x9', '50x11 50x11 50x9 50x9'][k]); });
show(Core.sortW(W2), 'mon', '2025-11-17', 'synthetic: first set grew 10->11, later sets flat');
mon.forEach((d, k) => { W2.find(w => w.date === d).items.find(i => i.ex === 'lat_pulldown').sets = Core.parseSets(['50x11 50x11 50x9 50x9', '50x10 50x11 50x9 50x9', '50x11 50x10 50x10 50x9', '50x11 50x11 50x10 50x9'][k]); });
show(Core.sortW(W2), 'mon', '2025-11-17', 'synthetic: sets 1-2 flat, set 3 grew, set 4 flat');
