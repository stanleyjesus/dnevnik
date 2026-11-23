const C = require('./core.js');
const W = C.sortW(require('./workouts.json').map(d => C.fromDoc(d.date, d)));
const me = C.mergeCfg(require('./config.json'));
const second = C.mergeCfg(Object.assign({}, require('./config_p2.json'), { ignore: { calves: 1, chest: 1, forearms: 1 } }));
const show = (title, W, cfg, o, brief) => {
  const pr = C.buildProgram(W, cfg, o), tot = t => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
  console.log('\n=== ' + title + ' → ' + pr.name + ' | sets ' + tot(pr.before).toFixed(1) + ' → ' + tot(pr.after).toFixed(1) + ' | budget ' + pr.budget + ' | breaks: ' + (C.ruleBreaks(pr.cfg, pr.after).join('; ') || 'none'));
  for (const sl of C.SLOTS) {
    const L = pr.slots[sl.id];
    console.log(' ' + sl.s + ' ' + pr.after.load[sl.id].toFixed(1) + ' подх, ' + C.fmtDur(C.estMinutes(pr.cfg, L)) + ' | max day muscle ' + Math.max(0, ...Object.values(pr.after.day[sl.id])).toFixed(1) + (brief ? '' : '\n    ' + L.map(e => C.exName(pr.cfg, e.ex).slice(0, 30) + (e.n ? ' ×' + e.n : '') + (e.isNew ? ' NEW' : e.chg ? ' (' + C.signed(e.chg) + ')' : '')).join('\n    ')));
  }
  console.log('  vol: ' + C.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.n.slice(0, 9) + ' ' + (pr.before.pv[m.id] || 0).toFixed(1) + '→' + (pr.after.pv[m.id] || 0).toFixed(1)).join(', '));
  console.log('  below zone: ' + C.MUSCLES.filter(m => !cfg.ignore[m.id] && (pr.after.pv[m.id] || 0) < cfg.zones.opt - 0.25).map(m => m.n).join(', '));
  for (const n of pr.notes.slice(0, brief ? 1 : 3)) console.log('  • ' + n.t + ' — ' + n.x.slice(0, 170));
  if (!brief) console.log('  notes total', pr.notes.length, '| create', Object.keys(pr.create).join(','));
  return pr;
};
show('P2 even 100', [], second, {});
show('P2 legs 100', [], second, { prio: 'legs' });
show('P2 legs 70', [], second, { prio: 'legs', budget: 70 }, true);
show('P2 even 60', [], second, { budget: 60 }, true);
show('P2 even 50 (below current 55)', [], second, { budget: 50 }, true);
show('ME even 100', W, me, {});
show('ME upper 100', W, me, { prio: 'upper' }, true);
show('ME even 80', W, me, { budget: 80 }, true);
show('ME bench focus', W, me, { focus: 'bench' }, true);
const sc = C.mergeCfg({ start: '2025-11-10', ex: require('./config_p2.json').ex });
show('SCRATCH (p2 catalogue, no programme) even 60', [], sc, { budget: 60 });
