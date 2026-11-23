const Core = require('./core.js');
const raw = require('./workouts.json'), cfg = Core.mergeCfg(require('./config.json'));
const W = Core.sortW(raw.map(d => Core.fromDoc(d.date, d)));
let bad = 0;
for (const d of raw) { const b = Core.toDoc(Core.fromDoc(d.date, d)); const norm = x => JSON.stringify(x.items.map(i => [i.ex, i.rng || i.cyc, i.sets, i.note || '', !!i.skip])); if (norm(b) !== norm(d)) { bad++; console.log('ROUNDTRIP', d.date); } }
console.log('roundtrip mismatches:', bad);
console.log('parse:', JSON.stringify(Core.parseSets('40x12@1 37.5x10@0 35x? 25x- 20x12w 100x3@3')), '->', Core.fmtSets(Core.parseSets('40x12@1 37.5x10@0 35x? 25x- 20x12w 100x3@3')));
console.log('legacy rir:', Core.toDoc(Core.fromDoc('2025-11-10', { date: '2025-11-10', slot: 'mon', items: [{ ex: 'bench', cyc: '87/3', sets: '95x3 95x3 95x3 95x3', rir: 1 }] })).items[0].sets);
console.log('estRir 77/5, 82/4, 87/3, 92.5/2:', [[77, 5], [82, 4], [87, 3], [92.5, 2]].map(x => Core.estRir(x[0], x[1])).join(' '), '| cycleVol', Core.cycleVol(cfg).toFixed(3));
const today = '2025-11-11', wi = Core.weeksInfo(W, cfg, today), vol = Core.volume(W, cfg), { avg } = Core.avgVolume(vol, wi.ref);
console.log('\nVOLUME with reserve discount');
for (const m of Core.MUSCLES) console.log(m.n.padEnd(20), wi.weeks.map(w => Core.fmt((vol[w.no] || { m: {} }).m[m.id] || 0, 1).padStart(5)).join(''), ' ', Core.fmt(avg[m.id], 1).padStart(5), Core.zone(avg[m.id], cfg.zones));
const pl = Core.planned(W, cfg);
console.log('planned', JSON.stringify(Object.fromEntries(Object.entries(pl.pv).map(([k, v]) => [k, +v.toFixed(1)]))));
const show = (W, slot, date, label) => { const a = Core.adapt(W, cfg, slot, date); console.log('\n=== ' + label + ' ' + slot + ' ' + date); for (const p of a.props) console.log('  [' + p.tag + '] ' + Core.exName(cfg, p.ex) + ' -> ' + p.sets.map(s => Core.fmt(s.w) + '(' + s.tg[0] + '+)').join(' ') + '\n      ' + p.notes.join('\n      ')); for (const d of a.adds) console.log('  [add] ' + d.name); };
show(W, 'wed', '2025-11-12', 'now'); show(W, 'fri', '2025-11-14', 'now'); show(W, 'mon', '2025-11-17', 'now');
// synthetic: reserve logged on the last Monday of the journal
const W2 = Core.clone(W), m = W2.find(w => w.date === '2025-11-10');
const set = (ex, s) => { m.items.find(i => i.ex === ex).sets = Core.parseSets(s); };
set('bench', '95x3@3 95x3@3 95x3@3 95x3@3');               // far easier than 87% should be
set('lat_pulldown', '55x10@3 52.5x9@1 52.5x10@0 50x8@2');   // 10 with 3 left -> worth 13 -> up; set 4 held back
set('tri_overhead', '20x13@0 20x13@1 17.5x8@0');            // top of range only by failure; lower bound by failure
set('lat_raise_machine', '22.5x13@4 22.5x13 20x9 20x13');
show(W2, 'mon', '2025-11-17', 'with logged reserve');
const st = Core.exStats(W2, cfg, 'lat_pulldown', Core.program(W2));
console.log('pulldown e1 with reserve:', st.last.e1.toFixed(1), 'best', Core.fmtSets([st.last.best]));
const m2 = W2.find(w => w.date === '2025-11-03'); m2.items.find(i => i.ex === 'bench').sets = Core.parseSets('87.5x4@1 87.5x4@1 87.5x4@1 87.5x4@0');
const W3 = W2.filter(w => w.date < '2025-11-10'); show(W3, 'mon', '2025-11-10', 'bench after a set to failure at 82%');
m2.items.find(i => i.ex === 'bench').sets = Core.parseSets('87.5x4@1 87.5x4@1 87.5x4@1 87.5x4@1'); show(W2.filter(w => w.date < '2025-11-10'), 'mon', '2025-11-10', 'bench with reserve 1 at 82% (expected 3)');
console.log('\nvolume week 10 chest with logged reserve 3 on bench:', Core.volume(W2, cfg)[10].m.chest, '| insights ok:', Core.insights({ workouts: W2, cfg, body: [], today }).length);
