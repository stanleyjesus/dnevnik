/* even mode is literally even, and one click moves one muscle */
const assert = require('assert');
const C = require('./core.js');
const W = C.sortW(require('./workouts.json').map(d => C.fromDoc(d.date, d)));
const me = C.mergeCfg(require('./config.json'));
const second = C.mergeCfg(Object.assign({}, require('./config_p2.json'), { ignore: { calves: 1, chest: 1, forearms: 1 } }));
const tot = t => C.SLOTS.reduce((a, sl) => a + t.load[sl.id], 0);
const span = (cfg, t) => { const v = C.MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => t.pv[m.id] || 0); return [Math.min(...v), Math.max(...v)]; };
let n = 0;
for (const [title, Wk, cfg, budget] of [['p2 100', [], second, 100], ['p2 80', [], second, 80], ['p2 60', [], second, 60], ['p2 50', [], second, 50], ['me 100', W, me, 100], ['me 80', W, me, 80], ['me 60', W, me, 60]]) {
  const t0 = Date.now(), pr = C.buildProgram(Wk, cfg, { budget }), [lo, hi] = span(cfg, pr.after), was = span(cfg, pr.before);
  console.log(title.padEnd(8), 'sets', tot(pr.before).toFixed(0), '→', tot(pr.after).toFixed(0), '| muscles', was.map(x => x.toFixed(1)).join('–'), '→', lo.toFixed(1) + '–' + hi.toFixed(1), '|', pr.notes[0].t, '|', Date.now() - t0, 'ms');
  assert(tot(pr.after) <= budget + 0.01, title + ': over the weekly budget');
  assert(!C.ruleBreaks(pr.cfg, pr.after).length, title + ': breaks a limit');
  assert(hi - lo <= 4.5, title + ': spread ' + (hi - lo).toFixed(1));
  assert(hi - lo < was[1] - was[0], title + ': not more even than before');
  for (const sl of C.SLOTS) for (const e of pr.slots[sl.id]) assert(pr.cfg.ex[e.ex], title + ': unknown exercise ' + e.ex);
  for (const id of Object.keys(pr.create)) assert(C.SLOTS.some(sl => pr.slots[sl.id].some(e => e.ex === id)), title + ': created but unused ' + id);
  n++;
}
/* glutes no longer take the week */
{ const pr = C.buildProgram([], second, { budget: 60 }); const g = pr.after.pv.glutes, rest = C.MUSCLES.filter(m => !second.ignore[m.id] && m.id !== 'glutes').map(m => pr.after.pv[m.id] || 0);
  assert(g <= Math.min(...rest) + 2.6, 'glutes ' + g + ' vs min ' + Math.min(...rest)); console.log('p2 60: glutes', g, 'others', Math.min(...rest), '–', Math.max(...rest)); }
/* a priority takes about one and a half times more than the rest, and no more: the rest stay level */
for (const [title, Wk, cfg, o] of [['p2 glutes 100', [], second, { prio: 'glutes' }], ['p2 glutes 60', [], second, { prio: 'glutes', budget: 60 }], ['p2 legs 70', [], second, { prio: 'legs', budget: 70 }], ['p2 upper 60', [], second, { prio: 'upper', budget: 60 }], ['me chest 100', W, me, { prio: 'chest' }], ['me back 100', W, me, { prio: 'back' }], ['me arms 80', W, me, { prio: 'arms', budget: 80 }]]) {
  const pr = C.buildProgram(Wk, cfg, o), g = C.PRIOS.find(x => x.id === o.prio).m, tr = C.MUSCLES.map(m => m.id).filter(m => !cfg.ignore[m]);
  const P = tr.filter(m => g.includes(m)).map(m => pr.after.pv[m] || 0), R = tr.filter(m => !g.includes(m)).map(m => pr.after.pv[m] || 0);
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length, ratio = avg(P) / avg(R);
  console.log(title.padEnd(15), 'sets', tot(pr.after).toFixed(0), '| priority', Math.min(...P).toFixed(1) + '–' + Math.max(...P).toFixed(1), '| rest', Math.min(...R).toFixed(1) + '–' + Math.max(...R).toFixed(1), '| ratio', ratio.toFixed(2), '|', pr.notes[0].t);
  assert(tot(pr.after) <= (o.budget || cfg.caps.week) + 0.01 && !C.ruleBreaks(pr.cfg, pr.after).length, title + ': limits');
  assert(ratio > 1.15 && ratio < 1.85, title + ': ratio ' + ratio.toFixed(2));
  assert(Math.max(...R) - Math.min(...R) <= 5.6, title + ': the rest are not level');      // the upper back rides along with every pull
  assert(Math.max(...P) <= cfg.zones.high + 0.01, title + ': priority above the working zone');
  assert(Math.min(...P) >= Math.min(...R), title + ': a priority muscle below the rest');
  n++;
}
/* enough budget: the rest are in the working zone, the priority in its upper half */
{ const pr = C.buildProgram([], second, { prio: 'glutes' }), v = pr.after.pv; assert(v.glutes >= 15 && v.glutes <= 17.5, 'glutes ' + v.glutes); for (const m of C.MUSCLES) if (!second.ignore[m.id]) assert((v[m.id] || 0) >= second.zones.opt - 0.5, m.id + ' below the zone: ' + v[m.id]); }

/* one click */
const O = cfg => ({ z: cfg.zones, ignore: cfg.ignore, budget: cfg.caps.week, dayCap: cfg.caps.day });
const click = (pr, cfg, m, dir) => { const before = C.progTally(pr.cfg, pr.slots), r = C.nudgeMuscle(pr.cfg, pr.slots, m, dir, O(cfg), (id, def) => { pr.create[id] = def; pr.cfg.ex[id] = Object.assign({ n: id, m: {} }, def); }), after = C.progTally(pr.cfg, pr.slots); return { r, d: (after.pv[m] || 0) - (before.pv[m] || 0), dt: tot(after) - tot(before), after }; };
{
  const pr = C.buildProgram([], second, { budget: 60 });
  for (const m of C.MUSCLES.filter(m => !second.ignore[m.id]).map(m => m.id)) {
    const up = click(pr, second, m, 1);
    assert(up.r.ok && up.d >= 0.5 && up.dt > 0, 'plus ' + m + ': ' + up.r.text);
    assert(!C.ruleBreaks(pr.cfg, up.after).length, 'plus ' + m + ' breaks a limit');
    const dn = click(pr, second, m, -1);
    assert(dn.r.ok && dn.d <= -0.5 && dn.dt < 0, 'minus ' + m + ': ' + dn.r.text);
  }
  console.log('p2: + and − work for every tracked muscle');
  /* a muscle outside the goal can be added too, with a stock exercise */
  const c = click(pr, second, 'calves', 1); assert(c.r.ok && /Новое упражнение/.test(c.r.text) && pr.create.x_calf, 'calves: ' + c.r.text); console.log('p2 calves +:', c.r.text);
  /* minus down to nothing, then a clear answer */
  let k = 0, last; do { last = click(pr, second, 'calves', -1); k++; } while (last.r.ok && k < 10);
  assert(!last.r.ok && k === 3, 'calves minus: ' + k + ' ' + last.r.text); console.log('p2 calves − ×3:', last.r.text);
  /* plus until something stops it: the answer names the limit, the week never passes the cap */
  let i = 0, r; do { r = click(pr, second, 'glutes', 1); i++; } while (r.r.ok && i < 60);
  assert(!r.r.ok && /Добавить некуда|Свободных подходов нет|Свободен один подход/.test(r.r.text), 'glutes plus never stops'); assert(tot(r.after) <= second.caps.week + 0.01 && !C.ruleBreaks(pr.cfg, r.after).length);
  console.log('p2 glutes + ×' + (i - 1) + ' →', r.after.pv.glutes, '|', r.r.text);
}
{
  const pr = C.buildProgram(W, me, { budget: 80 });
  /* a muscle fed only by the percentage lifts cannot be cut */
  { /* quads without their accessories, on a copy of the days: only the leg press feeds them */
    const cut = { cfg: pr.cfg, create: pr.create, slots: Object.fromEntries(C.SLOTS.map(sl => [sl.id, pr.slots[sl.id].filter(e => !e.n || !((pr.cfg.ex[e.ex].m.quads || 0) > 0))])) }, was = JSON.stringify(cut.slots);
    assert(C.SLOTS.some(sl => cut.slots[sl.id].some(e => !e.n && (pr.cfg.ex[e.ex].m.quads || 0) > 0)), 'no lift on quads');
    const r = click(cut, me, 'quads', -1); assert(!r.r.ok && /по процентам/.test(r.r.text) && JSON.stringify(cut.slots) === was, 'quads −: ' + r.r.text); console.log('me quads −:', r.r.text); }
  const up = click(pr, me, 'delt_rear', 1); assert(up.r.ok && up.d >= 0.5); console.log('me rear delts +:', up.r.text);
  const dn = click(pr, me, 'biceps', -1); assert(dn.r.ok && dn.d <= -0.5); console.log('me biceps −:', dn.r.text);
  /* one-sided pairs move together */
  const f0 = C.progTally(pr.cfg, pr.slots).pv.forearms, fr = click(pr, me, 'forearms', 1); console.log('me forearms +:', fr.r.text, f0, '→', fr.after.pv.forearms);
  assert(fr.r.ok);
  for (const sl of C.SLOTS) { const u = pr.slots[sl.id].filter(e => pr.cfg.ex[e.ex].uni); for (let j = 0; j + 1 < u.length; j += 2) assert.strictEqual(u[j].n, u[j + 1].n, 'pair split'); }
}
/* calves, abs and erectors are out of the count by default: every automatic build leaves them at zero, the buttons give them sets by hand */
{
  assert.deepStrictEqual(Object.keys(me.ignore).sort(), ['abs', 'calves', 'erectors']);
  assert.deepStrictEqual(Object.keys(second.ignore).sort(), ['abs', 'calves', 'chest', 'erectors', 'forearms']);
  assert.deepStrictEqual(Object.keys(C.mergeCfg(Object.assign({}, require('./config.json'), { ignore: { abs: 0, erectors: 0, forearms: 1 } })).ignore).sort(), ['calves', 'forearms']);
  const raw = JSON.parse(JSON.stringify(require('./config.json')));
  for (const o of [{}, { budget: 60 }, { prio: 'legs' }, { prio: 'upper', budget: 80 }]) {
    const pr = C.buildProgram(W, me, o), v = pr.after.pv;
    assert(!(v.abs > 0) && !(v.calves > 0), 'the diary gave sets to abs or calves: ' + JSON.stringify(o));
    assert(!(v.erectors > 0), 'erectors ' + v.erectors);
    assert(!pr.notes.some(x => /пресс|икры|разгибател/i.test(x.t)), 'a note names them: ' + pr.notes.map(x => x.t).join(' ; '));
  }
  const pr = C.buildProgram(W, me, { budget: 80 });
  click(pr, me, 'delt_mid', -1); click(pr, me, 'delt_mid', -1);
  const a1 = click(pr, me, 'abs', 1), a2 = click(pr, me, 'abs', 1), c1 = click(pr, me, 'calves', 1);
  console.log('me by hand:', a1.r.text, '|', a2.r.text, '|', c1.r.text, '→ abs', a2.after.pv.abs, 'calves', c1.after.pv.calves);
  assert(a1.r.ok && a2.r.ok && c1.r.ok && a2.after.pv.abs === 3 && c1.after.pv.calves === 2);
  /* accepted, then built anew: zero is the default every time, the note says what went, and «+» gives the sets back */
  raw.program = { name: 'x', since: '2025-12-02', made: '2025-11-12', slots: Object.fromEntries(C.SLOTS.map(sl => [sl.id, pr.slots[sl.id].map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex })])) };
  for (const id of Object.keys(pr.create)) raw.ex[id] = pr.create[id];
  const cfg2 = C.mergeCfg(raw);
  for (const o of [{ budget: 60 }, {}, { prio: 'arms', budget: 70 }]) {
    const p2 = C.buildProgram(W, cfg2, o), nt = p2.notes.find(x => /Мышцы вне расчёта/.test(x.t));
    assert(p2.before.pv.abs === 3 && p2.before.pv.calves === 2 && !(p2.after.pv.abs > 0) && !(p2.after.pv.calves > 0), 'not back to zero: ' + JSON.stringify(o) + ' abs ' + p2.after.pv.abs + ' calves ' + p2.after.pv.calves);
    assert(nt && /пресс/.test(nt.t) && /икры/.test(nt.t) && /Пресс \(/.test(nt.x), 'no word about what went: ' + (nt && nt.t));
    assert(tot(p2.after) <= (o.budget || 100) + 0.01 && !C.ruleBreaks(p2.cfg, p2.after).length);
  }
  { const p2 = C.buildProgram(W, cfg2, { budget: 70 }); click(p2, cfg2, 'biceps', -1); const k = click(p2, cfg2, 'abs', 1); assert(k.r.ok && k.after.pv.abs === 2, 'abs by hand after a rebuild: ' + k.r.text); }
  /* by hand the programme stays as the athlete made it */
  assert.strictEqual(C.buildProgram(W, cfg2, { manual: true }).after.pv.abs, 3);
  assert(!(C.buildProgram(W, cfg2, { focus: 'bench' }).after.pv.abs > 0), 'powerbuilding builds the rest as the even mode does: out of the count means zero');
  /* the starter programme of the second profile has abs, a hyperextension, the Romanian deadlift and two chest presses; chest is out of its count too */
  { const rawSecond = JSON.parse(JSON.stringify(Object.assign({}, require('./config_p2.json'), { ignore: { calves: 1, chest: 1, forearms: 1 } }))), h2 = C.mergeCfg(rawSecond);
    for (const o of [{ prio: 'legs', budget: 60 }, { budget: 60 }, {}, { prio: 'glutes' }, { prio: 'upper', budget: 60 }]) {
      const p = C.buildProgram([], h2, o), v = p.after.pv, nt = p.notes.find(x => /Мышцы вне расчёта/.test(x.t)), used = [...new Set(C.SLOTS.flatMap(sl => p.slots[sl.id].map(e => e.ex)))];
      assert(p.before.pv.abs === 3 && p.before.pv.erectors === 6 && p.before.pv.chest === 6, 'p2 programme changed');
      for (const m of Object.keys(h2.ignore)) assert(!(v[m] > 0), 'p2 ' + m + ' is ' + v[m] + ' with ' + JSON.stringify(o));
      assert(!used.some(id => ['abs', 'back_ext', 'rdl', 'db_bench', 'chest_press'].includes(id)) && nt && /Румынская тяга \(пт\)/.test(nt.x) && /Пресс \(пн\)/.test(nt.x), 'p2 note: ' + (nt && nt.x));
      assert(!C.ruleBreaks(p.cfg, p.after).length && tot(p.after) <= (o.budget || 100) + 0.01);
    }
    const p = C.buildProgram([], h2, { prio: 'legs', budget: 60 }), tr = C.MUSCLES.map(m => m.id).filter(m => !h2.ignore[m]);
    console.log('p2 legs 60: priority', ['quads', 'hams', 'glutes'].map(m => p.after.pv[m]).join('/'), '| rest', Math.min(...tr.filter(m => !['quads', 'hams', 'glutes'].includes(m)).map(m => p.after.pv[m] || 0)), '–', Math.max(...tr.filter(m => !['quads', 'hams', 'glutes'].includes(m)).map(m => p.after.pv[m] || 0)), '| out of count', Object.keys(h2.ignore).map(m => m + ' ' + (p.after.pv[m] || 0)).join(', '));
    assert(Math.min(p.after.pv.quads, p.after.pv.hams, p.after.pv.glutes) >= 11 && Math.min(...tr.map(m => p.after.pv[m] || 0)) >= 6.5, 'the counted muscles lost their level');
    click(p, h2, 'delt_front', -1); const k = click(p, h2, 'erectors', 1);
    console.log('p2 erectors by hand:', k.r.text, '→', k.after.pv.erectors);
    assert(k.r.ok && k.after.pv.erectors === 2 && /Гиперэкстензия/.test(k.r.text), 'erectors by hand: ' + k.r.text); }
  /* the plan of a workout does not offer them either */
  const pl = C.plan(W, me, 'wed', '2025-11-12'), ad = C.adapt ? C.adapt(W, me, 'wed', '2025-11-12', pl) : null;
  if (ad) { const names = (ad.adds || []).map(d => C.exName(me, d.exId) || (d.def && d.def.n)); console.log('me adapt adds:', names.join(', ') || 'none'); assert(!names.some(x => /Пресс|носки|Гиперэкст/i.test(x || ''))); }
}
/* frequency: with three training days every counted muscle is trained on two of them — a day counts when it gives the muscle two sets or more —
   and the weekly balance is the one the volumes alone would give */
{
  const days = (pr, m) => C.SLOTS.map(sl => pr.after.day[sl.id][m] || 0);
  const once = (cfg, pr) => C.MUSCLES.filter(m => !cfg.ignore[m.id] && days(pr, m.id).filter(v => v >= 1.99).length < 2).map(m => m.id);
  const secondStored = C.mergeCfg(require('./fixtures/p2-stored.json'));
  const rawBig = JSON.parse(JSON.stringify(require('./config.json'))); Object.assign(rawBig.ex, require('./fixtures/p2-stored.json').ex, JSON.parse(JSON.stringify(require('./config.json'))).ex);
  const meBig = C.mergeCfg(rawBig);
  let moved = 0, k = 0;
  for (const [title, Wk, cfg, o] of [['p2 60', [], second, { budget: 60 }], ['p2 100', [], second, {}], ['p2 legs 60', [], second, { prio: 'legs', budget: 60 }], ['p2 glutes', [], second, { prio: 'glutes' }],
    ['p2 stored legs 60', [], secondStored, { prio: 'legs', budget: 60 }], ['p2 stored 60', [], secondStored, { budget: 60 }], ['p2 stored upper 60', [], secondStored, { prio: 'upper', budget: 60 }],
    ['me 100', W, me, {}], ['me 80', W, me, { budget: 80 }], ['me 60', W, me, { budget: 60 }], ['me back', W, me, { prio: 'back' }], ['me arms 80', W, me, { prio: 'arms', budget: 80 }], ['me legs', W, me, { prio: 'legs' }],
    ['me big 100', W, meBig, {}], ['me big 60', W, meBig, { budget: 60 }], ['me big arms 80', W, meBig, { prio: 'arms', budget: 80 }]]) {
    const pr = C.buildProgram(Wk, cfg, o), thin = once(cfg, pr), nt = pr.notes.find(x => /Один день в неделю/.test(x.t)), mv = pr.notes.find(x => /Перенесено на другой день/.test(x.t));
    const carried = C.SLOTS.flatMap(sl => pr.slots[sl.id].filter(e => e.from));
    if (mv) moved++;
    assert.strictEqual(!!mv, carried.length > 0, title + ': the note and the carried exercises disagree');
    for (const e of carried) assert(pr.cfg.ex[e.ex] && e.n >= 2 && e.isNew, title + ': carried ' + e.ex);
    /* whoever still has one day is named, with the reason; nobody is left out silently */
    for (const m of thin) assert(nt && nt.t.includes(C.MUSCLE[m].n.toLowerCase()), title + ': ' + m + ' has one day ' + JSON.stringify(days(pr, m)) + ' and no word about it');
    assert(thin.length <= 1, title + ': one day a week for ' + thin.join(', '));
    assert(!C.ruleBreaks(pr.cfg, pr.after).length && tot(pr.after) <= (o.budget || 100) + 0.01, title + ': limits');
    for (const sl of C.SLOTS) { const ids = pr.slots[sl.id].map(e => e.ex); assert.strictEqual(new Set(ids).size, ids.length, title + ': an exercise twice in a day'); }
    k++;
  }
  console.log('frequency:', k, 'builds, an exercise carried to another day in', moved);
  assert(moved >= 1, 'the second pass never had to carry anything: the test does not test it');
  /* a week with one training day has nothing to spread */
  { const raw1 = JSON.parse(JSON.stringify(require('./config_p2.json'))); raw1.program.slots.wed = []; raw1.program.slots.fri = []; const c1 = C.mergeCfg(raw1), p1 = C.buildProgram([], c1, { budget: 30 });
    assert(!p1.notes.some(x => /Один день в неделю|Перенесено/.test(x.t)) && !p1.slots.wed.length && !p1.slots.fri.length, 'a one-day week was spread'); }
}
console.log('OK', n, 'even builds + clicks');
