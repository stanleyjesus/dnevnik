/* weights named in the settings start the first plan of an exercise that is not in the journal yet */
const assert = require('assert');
const C = require('./core.js');
const raw = JSON.parse(JSON.stringify(Object.assign({}, require('./config_p2.json'), { ignore: { calves: 1, chest: 1, forearms: 1 } })));
Object.assign(raw.ex.hip_thrust, { work: 40, workR: 10 });        // reps inside 8–12: taken as it is
Object.assign(raw.ex.squat, { max: 50 });                         // a one-rep maximum only
Object.assign(raw.ex.leg_press, { work: 80, workR: 15 });         // reps outside 8–12: recalculated
raw.gear = Object.assign({}, raw.gear, { g5: { n: 'Тренажёр 5 кг', step: 5 } }); raw.ex.leg_press.gear = 'g5';   // the step is the equipment's: here the athlete's own kind with 5 kg
Object.assign(raw.ex.lat_raise, { work: 4 });                     // no reps: taken as it is
Object.assign(raw.ex.rdl, { work: 30, workR: 8, max: 60 });       // both: the working weight wins where it fits
const second = C.mergeCfg(raw);
const sw = id => C.startOf([], second, id);
console.log('p2 starts:', ['hip_thrust', 'squat', 'leg_press', 'lat_raise', 'rdl', 'abs'].map(id => id + ' ' + JSON.stringify(sw(id))).join(' | '));
assert.strictEqual(sw('hip_thrust').w, 40); assert.strictEqual(sw('hip_thrust').src, 'work');
assert.strictEqual(sw('squat').w, 35); assert.strictEqual(sw('squat').src, 'max');            // 50 / (1 + (10 + 2) / 30) = 35.7 → step 2.5
assert.strictEqual(sw('leg_press').w, 85);                                                     // 80 × (1 + 17/30) = 125.3 → / 1.4 = 89.5 → step 5
assert.strictEqual(sw('lat_raise').w, 4); assert.strictEqual(sw('rdl').w, 30); assert.strictEqual(sw('abs'), null);
/* the first plan of every day */
for (const sl of C.SLOTS) {
  const p = C.plan([], second, sl.id, '2025-11-12');
  console.log(sl.id + ':', p.items.map(it => C.exName(second, it.ex).slice(0, 18) + ' ' + it.sets.length + '×' + (it.sets[0].w == null ? '?' : it.sets[0].w)).join(', '));
  for (const it of p.items) { const s = sw(it.ex); assert(it.sets.every(x => x.w === (s ? s.w : null)), sl.id + ' ' + it.ex); assert.strictEqual(it.sets.length, second.program.slots[sl.id].find(e => e.ex === it.ex).n); }
}
/* once the exercise is in the journal, the journal decides */
const W = [C.fromDoc('2025-11-12', { date: '2025-11-12', slot: 'wed', items: [{ ex: 'hip_thrust', rng: '8-12', sets: '45x12 45x10 45x9' }] })];
assert.strictEqual(C.startOf(W, second, 'hip_thrust'), null);
const p2 = C.plan(W, second, 'mon', '2025-11-17'), ht = p2.items.find(it => it.ex === 'hip_thrust');
console.log('after a session, hip thrust on Monday:', ht.sets.map(s => s.w).join('/'));
assert.deepStrictEqual(ht.sets.map(s => s.w), [47.5, 45, 45]);                               // «со штангой»: the barbell's step, 2.5
/* the builder says where the first weights come from */
const pr = C.buildProgram([], second, { budget: 60 }), n1 = pr.notes.find(n => /Стартовые веса/.test(n.t)), n2 = pr.notes.find(n => /Вес пока не задан/.test(n.t));
console.log('builder:', n1 && n1.x.slice(0, 200)); console.log('        ', n2 && (n2.t + ' — ' + n2.x.slice(0, 120)));
assert(n1 && /Приседания со штангой — 35 кг \(от разового максимума\)/.test(n1.x) && n2);
assert(/ВЕСА, КОТОРЫЕ АТЛЕТ НАЗВАЛ САМ.*Ягодичный мост со штангой — рабочий 40 кг × 10.*разовый максимум 50 кг/.test(C.coachPrompt({ workouts: [], cfg: second, body: [], today: '2025-11-12' }, '')));

/* a percentage lift: the wave counts from the named maximum, the light day too */
const me = JSON.parse(JSON.stringify(require('./config.json')));
me.ex.dead = { n: 'Становая тяга', mode: 'cycle', pat: 'hinge', m: { hams: 1, glutes: 1, erectors: 1 }, round: 2.5, max: 100 };
me.ex.dead_light = { n: 'Становая тяга — лёгкий день', mode: 'light', of: 'dead', pat: 'hinge', m: { hams: 1 }, round: 2.5 };
me.ex.ohp2 = { n: 'Жим стоя', mode: 'cycle', pat: 'v_push', m: { delt_front: 1 }, round: 2.5, work: 40, workR: 5 };
const cm = C.mergeCfg(me), Wm = C.sortW(require('./workouts.json').map(x => C.fromDoc(x.date, x)));
const a = C.makeItem(Wm, cm, 'dead', 'mon', '2025-11-12'), l = C.makeItem(Wm, cm, 'dead_light', 'wed', '2025-11-12'), o = C.makeItem(Wm, cm, 'ohp2', 'mon', '2025-11-12'), b = C.makeItem(Wm, cm, 'bench', 'mon', '2025-11-12');
console.log('wave from max 100:', a.cyc.pct + '% ×' + a.cyc.reps, a.sets.map(s => s.w).join('/'), '| light:', l.sets.map(s => s.w).join('/'), '| from work 40×5 (rir ' + cm.rir + '):', o.sets.map(s => s.w).join('/'), '| bench (journal):', b.sets[0].w);
assert.deepStrictEqual(a.sets.map(s => s.w), [77.5, 77.5, 77.5, 77.5]); assert.deepStrictEqual(l.sets.map(s => s.w), [75, 75, 75]);
assert.strictEqual(o.sets[0].w, 37.5);                                    // 40 × (1 + 6/30) = 48 → 77% = 36.96 → 37.5
assert(b.sets[0].w > 0 && !C.startOf(Wm, cm, 'bench'));
assert.strictEqual(C.startOf(Wm, cm, 'dead').tm, 100); assert.strictEqual(C.startOf(Wm, cm, 'dead_light').w, 75);
/* nothing named: as before */
const plain = C.mergeCfg(require('./config_p2.json'));
assert(C.plan([], plain, 'mon', '2025-11-12').items.every(it => it.sets.every(s => s.w == null)));
console.log('OK known weights');
