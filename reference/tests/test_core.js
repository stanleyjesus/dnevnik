const Core = require('./core.js');
const raw = require('./workouts.json'), cfg = Core.mergeCfg(require('./config.json'));
const W = Core.sortW(raw.map(d => Core.fromDoc(d.date, d)));
const today = '2025-11-11';
// round trip
for (const d of raw) { const back = Core.toDoc(Core.fromDoc(d.date, d)); if (JSON.stringify(back) !== JSON.stringify(d)) { console.log('ROUNDTRIP DIFF', d.date, JSON.stringify(back), JSON.stringify(d)); } }
const wi = Core.weeksInfo(W, cfg, today), vol = Core.volume(W, cfg), { avg, pat } = Core.avgVolume(vol, wi.ref);
console.log('weeks:', wi.weeks.map(w => w.no + ':' + w.count + (w.current ? '*' : '')).join(' '), '| ref', wi.ref.map(w => w.no));
console.log('\nVOLUME per week');
console.log('muscle'.padEnd(20), wi.weeks.map(w => String(w.no).padStart(5)).join(''), '  avg3');
for (const m of Core.MUSCLES) console.log(m.n.padEnd(20), wi.weeks.map(w => Core.fmt((vol[w.no] || { m: {} }).m[m.id] || 0, 1).padStart(5)).join(''), ' ', Core.fmt(avg[m.id], 1).padStart(5), Core.zone(avg[m.id], cfg.zones));
console.log('sets/wk'.padEnd(20), wi.weeks.map(w => Core.fmt((vol[w.no] || { sets: 0 }).sets, 1).padStart(5)).join(''));
console.log('patterns avg', JSON.stringify(pat));
console.log('\nINDEX', Core.strengthIndex(W, cfg).map(x => x.week + ':' + x.idx.toFixed(1) + '(' + x.shared + ')').join(' '));
console.log('\nSTATS');
for (const s of Core.allStats(W, cfg)) console.log(Core.exName(cfg, s.id).padEnd(42), 'n=' + String(s.n).padStart(2), s.status.padEnd(5), s.active ? 'act' : '---', (Core.fmt(s.first.best.w) + 'x' + s.first.best.r).padEnd(9), '->', (Core.fmt(s.last.best.w) + 'x' + s.last.best.r).padEnd(9), Core.signed(s.delta) + '%', 'sincePR=' + s.sincePR, s.last.tm ? 'TM ' + s.first.tm.toFixed(1) + '->' + s.last.tm.toFixed(1) : '');
console.log('\nNEXT', Core.nextSlot(W), Core.nextDate(Core.nextSlot(W), today, W));
for (const slot of ['wed', 'fri', 'mon']) {
  const d = Core.nextDate(slot, today, W), p = Core.plan(W, cfg, slot, d);
  console.log('\nPLAN', slot, d, 'template', p.template);
  for (const it of p.items) { const h = it.cyc ? null : Core.hints(W, cfg, it.ex, slot, d); console.log('  ', Core.exName(cfg, it.ex).padEnd(42), it.cyc ? it.cyc.pct + '% x' + it.cyc.reps : it.range.join('-'), '|', Core.fmtSets(it.sets), h ? '| ' + h.sets.map(s => s.rule[0] + s.target[0]).join(' ') + ' | step ' + h.step + ' prev ' + h.prevDate : ''); }
}
console.log('\nINSIGHTS');
for (const i of Core.insights({ workouts: W, cfg, body: [], today })) console.log('[' + i.sev + '] ' + i.cat + ' :: ' + i.title + '\n     ' + i.text);
console.log('\nPROMPT chars', Core.coachPrompt({ workouts: W, cfg, body: [], today }, '').length);
console.log(Core.toCsv(W, cfg).split('\n').slice(0, 4).join('\n'));
