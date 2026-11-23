/* the weight step belongs to the equipment only; what an exercise trains is read from its name */
const assert = require('assert');
const C = require('./core.js');
const clone = o => JSON.parse(JSON.stringify(o));
const rawMe = require('./config.json'), rawSecond = require('./config_p2.json');
const stepOf = (cfg, id) => cfg.ex[id].mode === 'cycle' ? cfg.ex[id].round : cfg.ex[id].step;

/* 1. the first profile has no equipment stored: exercises lie where their names point, the rest is «без снаряда» */
{ const cfg = C.mergeCfg(rawMe), at = id => C.gearOf(cfg, id);
  const by = {}; for (const id of Object.keys(cfg.ex)) (by[at(id)] = by[at(id)] || []).push(id);
  console.log('me:', Object.entries(by).map(([g, ids]) => cfg.gear[g].n + ' ' + ids.length).join(', '), '| без снаряда:', by.none.map(id => cfg.ex[id].n).join('; '));
  assert.deepStrictEqual(C.gearList(cfg).map(g => g.id), ['machine', 'cable', 'barbell', 'dumbbell']);
  assert.strictEqual(at('lat_pulldown'), 'machine'); assert.strictEqual(at('tri_pushdown'), 'cable'); assert.strictEqual(at('tbar_row'), 'barbell'); assert.strictEqual(at('incline_db'), 'dumbbell');
  assert.deepStrictEqual(by.none.sort(), ['abs', 'bayesian_curl', 'bench', 'leg_press', 'pec_fly', 'pullup']);
  /* a step stored with the exercise by an older version is not read: 5 kg of the pulldown and of the leg press are gone */
  assert.strictEqual(rawMe.ex.lat_pulldown.step, 5); assert.strictEqual(stepOf(cfg, 'lat_pulldown'), 2.5);
  assert.strictEqual(rawMe.ex.leg_press.round, 5); assert.strictEqual(stepOf(cfg, 'leg_press'), 2.5); assert.strictEqual(cfg.ex.leg_press.step, undefined);
  assert.strictEqual(stepOf(cfg, 'pullup'), 2.5); assert.strictEqual(stepOf(cfg, 'incline_db'), 2); assert.strictEqual(stepOf(cfg, 'hammer'), 2);
  for (const id of Object.keys(cfg.ex)) assert.strictEqual(stepOf(cfg, id), cfg.gear[at(id)].step, id); }

/* 2. the step of a kind moves all its exercises; «без снаряда» has a step too */
{ const raw = clone(rawMe); raw.gear = { machine: { step: 5 }, none: { step: 1 } };
  const cfg = C.mergeCfg(raw);
  assert.strictEqual(stepOf(cfg, 'lat_pulldown'), 5); assert.strictEqual(stepOf(cfg, 'leg_ext'), 5); assert.strictEqual(stepOf(cfg, 'abs'), 1); assert.strictEqual(stepOf(cfg, 'bench'), 1); assert.strictEqual(stepOf(cfg, 'tbar_row'), 2.5); }

/* 3. the athlete's choice wins over the name; «none» is a choice; an own kind of equipment works as the stock ones */
{ const raw = clone(rawMe);
  raw.gear = { g5: { n: 'Тренажёр 5 кг', step: 5 }, belt: { n: 'Пояс', step: 0.5 }, bad: { step: 3 } };
  raw.ex.lat_pulldown.gear = 'g5'; raw.ex.pec_fly.gear = 'g5'; raw.ex.pullup.gear = 'belt'; raw.ex.leg_ext.gear = 'none'; raw.ex.bench.gear = 'barbell'; raw.ex.abs.gear = 'gone';
  const cfg = C.mergeCfg(raw);
  assert.deepStrictEqual(C.gearList(cfg).map(g => g.n), ['Тренажёр', 'Блок', 'Штанга', 'Гантель', 'Тренажёр 5 кг', 'Пояс']);       // a kind without a name is not a kind
  assert(cfg.gear.g5.own && !cfg.gear.machine.own);
  assert.strictEqual(stepOf(cfg, 'lat_pulldown'), 5); assert.strictEqual(stepOf(cfg, 'pec_fly'), 5); assert.strictEqual(stepOf(cfg, 'pullup'), 0.5);
  assert.strictEqual(C.gearOf(cfg, 'leg_ext'), 'none'); assert.strictEqual(C.gearOf(cfg, 'bench'), 'barbell'); assert.strictEqual(C.gearOf(cfg, 'abs'), 'none');   // a kind that is gone: back to the name
  /* the wave rounds to the step of its equipment, the next weight of a double progression moves by it */
  const W = C.sortW(require('./workouts.json').map(d => C.fromDoc(d.date, d)));
  const pc = C.planCycle(W, cfg, 'pullup', '2025-11-14'); assert(Math.abs(pc.w / 0.5 - Math.round(pc.w / 0.5)) < 1e-9, 'pull-ups round to 0.5: ' + pc.w);
  const pc2 = C.planCycle(W, C.mergeCfg(rawMe), 'pullup', '2025-11-14'); assert(Math.abs(pc2.w / 2.5 - Math.round(pc2.w / 2.5)) < 1e-9, 'pull-ups round to 2.5: ' + pc2.w);
  console.log('pull-ups, Friday: own kind 0.5 →', pc.w, '| без снаряда 2.5 →', pc2.w);
  assert.strictEqual(C.stepOf(W, cfg, 'lat_pulldown'), 5); assert.strictEqual(C.stepOf(W, C.mergeCfg(rawMe), 'lat_pulldown'), 2.5); }

/* 4. the second profile as it is stored now: equipment chosen, old steps beside it */
{ const raw = clone(rawSecond); raw.gear = { barbell: { step: 2.5 }, cable: { step: 2.5 }, dumbbell: { step: 2 }, machine: { step: 2.5 } };
  for (const [id, g] of Object.entries({ abduction: 'machine', chest_press: 'machine', lat_pulldown: 'machine', db_bench: 'dumbbell', lunge: 'dumbbell', hip_thrust: 'barbell' })) raw.ex[id].gear = g;
  const cfg = C.mergeCfg(raw);
  assert.strictEqual(raw.ex.abduction.step, 5); assert.strictEqual(stepOf(cfg, 'abduction'), 2.5); assert.strictEqual(stepOf(cfg, 'db_bench'), 2); assert.strictEqual(stepOf(cfg, 'hip_thrust'), 2.5);
  assert.strictEqual(C.gearOf(cfg, 'leg_press'), 'none'); assert.strictEqual(stepOf(cfg, 'leg_press'), 2.5);
  /* the builder's stock exercises take the step of the equipment in their names */
  const pr = C.buildProgram([], cfg, { budget: 60 });
  for (const id of Object.keys(pr.create)) { const e = pr.cfg.ex[id], g = C.gearOf(pr.cfg, id); assert.strictEqual(e.step, pr.cfg.gear[g].step, id); assert.strictEqual(pr.create[id].step, undefined, id + ' is stored without a step'); }
  console.log('p2 build adds:', Object.keys(pr.create).map(id => pr.cfg.ex[id].n + ' — ' + pr.cfg.gear[C.gearOf(pr.cfg, id)].n.toLowerCase() + ', шаг ' + pr.cfg.ex[id].step).join('; ') || '—'); }

/* 5. a light day rounds as its lift does */
{ const raw = clone(rawMe); raw.gear = { barbell: { step: 5 } }; raw.ex.bench.gear = 'barbell';
  raw.ex.bench_light = { n: 'Жим лежа — лёгкий день', mode: 'light', of: 'bench', pat: 'h_push', m: { chest: 1 }, round: 2.5 };
  const cfg = C.mergeCfg(raw); assert.strictEqual(cfg.ex.bench.round, 5); assert.strictEqual(cfg.ex.bench_light.round, 5); assert.strictEqual(cfg.ex.bench_light.gear, undefined); }

/* 6. muscles from the name: every exercise both profiles have today is read exactly as it is stored */
{ const all = Object.assign({}, rawSecond.ex, rawMe.ex), norm = m => JSON.stringify(Object.keys(m).sort().map(k => [k, m[k]]));
  let n = 0;
  for (const [id, e] of Object.entries(all)) { const g = C.guessEx(e.n); assert(g, 'not read: ' + e.n); assert.strictEqual(norm(g.m), norm(e.m), e.n); assert.strictEqual(g.pat, e.pat || 'iso', e.n); assert.strictEqual(!!g.uni, !!e.uni, e.n); n++; }
  const T = [['Жим штанги лежа узким хватом', 'triceps'], ['Французский жим', 'triceps'], ['Болгарские сплит-приседания', 'quads,glutes'], ['Leg press', 'quads'], ['Армейский жим', 'delt_front'], ['Жим в хаммере на плечи', 'delt_front'],
    ['Жим гантелей сидя под углом', 'chest'], ['Тяга верхнего блока к груди', 'lats'], ['Тяга штанги в наклоне', 'upper_back'], ['Становая тяга', 'hams,glutes,erectors'], ['Тяга к лицу', 'delt_rear'], ['Обратная бабочка', 'delt_rear'],
    ['Разведения гантелей в наклоне', 'delt_rear'], ['Разведения гантелей в стороны', 'delt_mid'], ['Подъём гантелей перед собой', 'delt_front'], ['Подъёмы на носки стоя', 'calves'], ['Подъём ног в висе', 'abs'], ['Пуловер на верхнем блоке', 'lats'],
    ['Махи ногой назад в кроссовере', 'glutes'], ['Сгибания рук на скамье Скотта', 'biceps'], ['Шраги с гантелями', 'upper_back'], ['Сгибания ног сидя', 'hams'], ['Разгибание спины в тренажере', 'erectors']];
  for (const [name, main] of T) { const g = C.guessEx(name); assert(g, 'not read: ' + name); assert.strictEqual(Object.keys(g.m).filter(k => g.m[k] === 1).join(','), main, name); }
  assert.strictEqual(C.guessEx('Фермерская прогулка'), null); assert.strictEqual(C.guessEx('Сведение ног в тренажере'), null); assert.strictEqual(C.guessEx(''), null);
  assert(C.guessEx('Кисть на блоке левая').uni && !C.guessEx('Кисть на блоке').uni);
  console.log('names read:', n, 'stored +', T.length, 'new'); }

/* 7. Claude's answer about an unknown name is taken only when it is clean */
{ assert.deepStrictEqual(C.parseDef('Ответ: {"pat":"iso","m":{"glutes":0.5,"adductors":1,"quads":1}}'), { pat: 'iso', m: { glutes: 0.5, quads: 1 } });
  assert.deepStrictEqual(C.parseDef('{"pat":"zzz","m":{"forearms":1,"upper_back":0.5}}'), { pat: 'iso', m: { forearms: 1, upper_back: 0.5 } });
  assert.strictEqual(C.parseDef('{"pat":"iso","m":{"abs":0.5}}'), null); assert.strictEqual(C.parseDef('не знаю'), null); assert.strictEqual(C.parseDef('{"m":{"abs":2}}'), null); assert.strictEqual(C.parseDef('{bad json}'), null);
  assert(/«Фермерская прогулка»/.test(C.exPrompt('Фермерская прогулка')) && /forearms/.test(C.exPrompt('x'))); }
console.log('gear: ok');
