const Core = require('./core.js');
const raw = require('./workouts.json'), cfgRaw = require('./config.json');
const mk = goals => { const c = Core.clone(cfgRaw); for (const [k, v] of Object.entries(goals || {})) c.ex[k].goal = v; return Core.mergeCfg(c); };
let W = Core.sortW(raw.map(d => Core.fromDoc(d.date, d)));
// 1. nothing changes without marks
const c0 = mk();
const sig = (cfg, W) => ['wed:2025-11-12', 'fri:2025-11-14', 'mon:2025-11-17'].map(x => { const [s, d] = x.split(':'); const a = Core.adapt(W, cfg, s, d); return a.base.items.map(i => Core.fmtSets(i.sets) + (i.cyc ? '|' + i.cyc.pct + '/' + i.cyc.reps : '')).join(';') + '#' + a.props.map(p => p.tag).join(','); }).join('\n');
console.log('unmarked plans identical to before goal feature:', sig(c0, W) === require('child_process').execSync("node -e \"const C=require('./core.v4.js');const raw=require('./workouts.json'),cfg=C.mergeCfg(require('./config.json'));const W=C.sortW(raw.map(d=>C.fromDoc(d.date,d)));console.log(['wed:2025-11-12','fri:2025-11-14','mon:2025-11-17'].map(x=>{const [s,d]=x.split(':');const a=C.adapt(W,cfg,s,d);return a.base.items.map(i=>C.fmtSets(i.sets)+(i.cyc?'|'+i.cyc.pct+'/'+i.cyc.reps:'')).join(';')+'#'+a.props.map(p=>p.tag).join(',')}).join('\\\\n'))\"").toString().trim());
// 2. bench marked strength: simulate 6 Mondays, each completed as planned
const c1 = mk({ bench: 'strength', incline_db: 'both', barbell_curl: 'strength', pec_fly: 'mass' });
let Ws = Core.clone(W), date = '2025-11-17';
const line = [];
for (let k = 0; k < 7; k++) {
  const p = Core.plan(Ws, c1, 'mon', date), b = p.items.find(i => i.ex === 'bench'), c = Core.planCycle(Ws, c1, 'bench', date);
  line.push(date.slice(5) + ': ' + b.sets.length + 'x' + b.cyc.reps + ' @' + b.sets[0].w + ' (' + b.cyc.pct + '%, max ' + c.tm.toFixed(1) + (c.switched ? ', switched' : '') + ')');
  const done = Core.clone(p); done.items.forEach(i => i.sets.forEach(s => { s.r = i.cyc ? i.cyc.reps : 10; }));
  Ws = Core.sortW(Ws.concat([{ id: date, date, slot: 'mon', note: '', open: false, items: done.items }]));
  date = Core.addDays(date, 7);
}
console.log('bench, heavy wave:\n  ' + line.join('\n  '));
console.log('stored tm round-trips:', JSON.stringify(Core.toDoc(Ws[Ws.length - 1]).items[0]));
// 3. a failed double repeats; a set to failure blocks the per-cycle increase
let Wf = Core.clone(Ws.filter(w => w.date <= '2025-12-08'));   // last = doubles week
const dbl = Wf[Wf.length - 1].items.find(i => i.ex === 'bench'); console.log('last heavy week:', Core.fmtSets(dbl.sets), dbl.cyc.pct + '%');
dbl.sets[2].r = 1; let c = Core.planCycle(Wf, c1, 'bench', '2025-12-15'); console.log('after a failed double -> ', c.sets + 'x' + c.reps, '@' + c.w, 'repeat', c.repeat);
dbl.sets[2].r = 2; dbl.sets[2].q = 0; c = Core.planCycle(Wf, c1, 'bench', '2025-12-15'); console.log('after a double to failure -> ', c.sets + 'x' + c.reps, '@' + c.w, 'max', c.tm.toFixed(1), 'hard', c.hard);
// 4. switch back to the usual wave
c = Core.planCycle(Wf, c0, 'bench', '2025-12-15'); console.log('goal removed -> ', c.sets + 'x' + c.reps, '@' + c.w, c.pct + '%', 'switched', c.switched);
// 5. range proposals from the marker
for (const [s, d] of [['wed', '2025-11-12'], ['fri', '2025-11-14'], ['mon', '2025-11-17']]) { const a = Core.adapt(W, c1, s, d); for (const p of a.props.filter(p => p.range)) console.log(s, '[' + p.tag + ']', Core.exName(c1, p.ex), '->', p.range.join('–'), '|', p.sets.map(x => Core.fmt(x.w)).join(' '), '| was', Core.fmtSets(a.base.items[p.idx].sets), '|', p.notes[0], '| default', a.off0[p.key] ? 'off' : 'on'); }
// after applying, next week it must not be proposed again and the range persists
const a = Core.adapt(W, c1, 'wed', '2025-11-12'), ap = Core.applyAdapt(a, a.off0), it = ap.items.find(i => i.ex === 'incline_db');
console.log('applied item:', it.range.join('-'), Core.fmtSets(it.sets));
it.sets.forEach((s, i) => { s.r = [8, 7, 6][i] || 6; });
const W5 = Core.sortW(W.concat([{ id: '2025-11-12', date: '2025-11-12', slot: 'wed', note: '', open: false, items: ap.items.map(i => (i.sets.forEach(s => { if (s.r == null) s.r = i.cyc ? i.cyc.reps : 9; if (s.w == null) s.w = 20; }), i)) }]));
const a2 = Core.adapt(W5, c1, 'wed', '2025-11-19'); const b2 = a2.base.items.find(i => i.ex === 'incline_db');
console.log('next Wednesday incline:', b2.range.join('-'), Core.fmtSets(b2.sets), '| range proposal again:', a2.props.some(p => p.ex === 'incline_db' && p.range));
console.log('planned chest volume, bench usual vs heavy wave:', Core.planned(W, c0).pv.chest.toFixed(2), Core.planned(W, c1).pv.chest.toFixed(2), '| cycleVol', Core.cycleVol(c0, 'bench').toFixed(3), Core.cycleVol(c1, 'bench').toFixed(3));
console.log('prompt goals line:', Core.coachPrompt({ workouts: W, cfg: c1, body: [], today: '2025-11-11' }, '').split('\n').find(l => l.startsWith('ЦЕЛИ')));
