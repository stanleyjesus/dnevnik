/* ---------- Core: data model, training maths, rules. No DOM in this part. ---------- */
const Core = (() => {
  'use strict';

  const MUSCLES = [
    { id: 'chest', n: 'Грудь', g: 'Верх' },
    { id: 'lats', n: 'Широчайшие', g: 'Верх' },
    { id: 'upper_back', n: 'Верх спины', g: 'Верх' },
    { id: 'delt_front', n: 'Передние дельты', g: 'Верх' },
    { id: 'delt_mid', n: 'Средние дельты', g: 'Верх' },
    { id: 'delt_rear', n: 'Задние дельты', g: 'Верх' },
    { id: 'biceps', n: 'Бицепс', g: 'Руки' },
    { id: 'triceps', n: 'Трицепс', g: 'Руки' },
    { id: 'forearms', n: 'Предплечья', g: 'Руки' },
    { id: 'abs', n: 'Пресс', g: 'Корпус' },
    { id: 'erectors', n: 'Разгибатели спины', g: 'Корпус' },
    { id: 'quads', n: 'Квадрицепс', g: 'Ноги' },
    { id: 'hams', n: 'Бицепс бедра', g: 'Ноги' },
    { id: 'glutes', n: 'Ягодицы', g: 'Ноги' },
    { id: 'calves', n: 'Икры', g: 'Ноги' }
  ];
  const MUSCLE = Object.fromEntries(MUSCLES.map(m => [m.id, m]));

  const FIX = {
    chest: 'ещё 1–2 подхода в жиме под углом или бабочке',
    lats: 'ещё подходы вертикальной тяги или пуловер на блоке',
    upper_back: 'ещё подходы горизонтальной тяги',
    delt_front: 'жим над головой с гантелями или штангой, 3–4 подхода',
    delt_mid: 'ещё подходы махов в стороны',
    delt_rear: 'обратная бабочка или тяга каната к лицу, 3–4 подхода дважды в неделю',
    biceps: 'ещё подход сгибаний',
    triceps: 'ещё подход разгибаний',
    forearms: 'сгибания кисти или молотки',
    abs: 'скручивания на блоке или подъём ног в висе, 3–4 подхода дважды в неделю',
    erectors: 'гиперэкстензия или румынская тяга, 3–4 подхода',
    quads: 'ещё подходы разгибаний, приседания или гакк',
    hams: 'ещё подходы сгибаний или румынская тяга',
    glutes: 'румынская тяга, ягодичный мост или выпады, 3–4 подхода',
    calves: 'подъёмы на носки стоя или сидя, 3–4 подхода дважды в неделю'
  };

  const PATTERNS = [
    { id: 'h_push', n: 'Горизонтальный жим' },
    { id: 'v_push', n: 'Вертикальный жим', gen: 'вертикального жима', fix: 'жим над головой стоя или сидя' },
    { id: 'h_pull', n: 'Горизонтальная тяга' },
    { id: 'v_pull', n: 'Вертикальная тяга' },
    { id: 'knee', n: 'Присед и жим ногами' },
    { id: 'hinge', n: 'Тяга с наклоном', gen: 'тяги с наклоном', fix: 'румынская тяга, становая или гиперэкстензия' },
    { id: 'iso', n: 'Изолирующие' }
  ];

  const SLOTS = [
    { id: 'mon', n: 'Понедельник', s: 'Пн', dow: 1 },
    { id: 'wed', n: 'Среда', s: 'Ср', dow: 3 },
    { id: 'fri', n: 'Пятница', s: 'Пт', dow: 5 }
  ];
  const SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]));

  /* ---------- dates (day numbers, timezone-free) ---------- */
  const dnum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const dstr = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const dow = s => new Date(dnum(s) * 864e5).getUTCDay();
  const addDays = (s, k) => dstr(dnum(s) + k);
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MON3 = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const DOW2 = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const fmtDate = (s, long) => { const [, m, d] = s.split('-').map(Number); return d + ' ' + (long ? MONTHS : MON3)[m - 1]; };
  const fmtDay = s => DOW2[dow(s)] + ', ' + fmtDate(s, true);
  const fmtDM = s => s.slice(8, 10) + '.' + s.slice(5, 7);
  const mondayOf = s => addDays(s, -((dow(s) + 6) % 7));
  const weekNo = (date, start) => Math.floor((dnum(date) - dnum(start)) / 7) + 1;
  const weekRange = (no, start) => { const a = addDays(start, (no - 1) * 7); return [a, addDays(a, 6)]; };

  /* ---------- formatting ---------- */
  const fmt = (v, dp = 2) => { if (v == null || isNaN(v)) return '–'; const s = (+v).toFixed(dp); return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s; };
  const pct = (a, b) => b ? (a / b - 1) * 100 : 0;
  const signed = (v, dp = 0) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), dp);
  const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return f[(a > 10 && a < 20) ? 2 : b === 1 ? 0 : (b >= 2 && b <= 4) ? 1 : 2]; };
  const nSets = v => { const n = +(+v).toFixed(1); return fmt(n, 1) + ' ' + (Number.isInteger(n) ? plural(n, ['подход', 'подхода', 'подходов']) : 'подхода'); };
  const list = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1];

  /* ---------- sets <-> text ("40x10 38x? 26x- 24x12w") ---------- */
  function parseSets(str) {
    if (!str) return [];
    return String(str).trim().split(/\s+/).map(tok => {
      const m = /^(-?\d+(?:\.\d+)?)x(\d+|\?|-)(w?)(?:@(\d))?$/.exec(tok);
      if (!m) return null;
      const o = { w: +m[1], r: /\d/.test(m[2]) ? +m[2] : null };
      if (m[2] === '-') o.skip = true;
      if (m[3]) o.warm = true;
      if (m[4] != null && o.r != null) o.q = +m[4];          // q = reps in reserve (RIR) logged for this set
      return o;
    }).filter(Boolean);
  }
  const fmtSets = sets => sets.map(s => fmt(s.w == null ? 0 : s.w, 3) + 'x' + (s.skip ? '-' : s.r == null ? '?' : s.r) + (s.warm ? 'w' : '') + (s.q != null && s.r != null && !s.skip ? '@' + s.q : '')).join(' ');

  function fromDoc(id, d) {
    d = d || {};
    return {
      id, date: d.date || id.slice(0, 10), slot: d.slot || null, note: d.note || '', open: !!d.open,
      items: (Array.isArray(d.items) ? d.items : []).map(it => {
        const o = {
          ex: String(it.ex || ''),
          range: it.rng ? String(it.rng).split('-').map(Number) : null,
          cyc: it.cyc ? { pct: +String(it.cyc).split('/')[0], reps: +String(it.cyc).split('/')[1] } : null,
          sets: parseSets(it.sets), note: it.note || '', skip: !!it.skip, rir: null, tm: it.tm == null ? null : +it.tm
        };
        if (it.rir != null) {                                  // older records kept one value for the last set
          const done = o.sets.filter(s => s.r != null && !s.warm), l = done[done.length - 1];
          if (l && l.q == null) l.q = Math.max(0, Math.min(5, +it.rir));
        }
        return o;
      }).filter(it => it.ex)
    };
  }
  function toDoc(w) {
    const d = { date: w.date, slot: w.slot || 'mon', items: w.items.map(it => {
      const o = { ex: it.ex };
      if (it.cyc) { o.cyc = it.cyc.pct + '/' + it.cyc.reps; if (it.tm != null) o.tm = it.tm; } else if (it.range) o.rng = it.range[0] + '-' + it.range[1];
      o.sets = fmtSets(it.sets);
      if (it.note) o.note = it.note;
      if (it.skip) o.skip = true;
      return o;
    }) };
    if (w.note) d.note = w.note;
    if (w.open) d.open = true;
    return d;
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- equipment: the weight step belongs to the kind of equipment; an exercise has no step of its own ---------- */
  const GEAR = [
    { id: 'machine', n: 'Тренажёр', step: 2.5, kw: ['тренаж'] },
    { id: 'cable', n: 'Блок', step: 2.5, kw: ['блок', 'кроссовер'] },
    { id: 'barbell', n: 'Штанга', step: 2.5, kw: ['штанг', 'т-бар'] },
    { id: 'dumbbell', n: 'Гантель', step: 2, kw: ['гантел'] }
  ];
  const NO_GEAR = 'none';                                           // «без снаряда»: a place with a step of its own, for everything not sorted yet
  const gearGuess = name => { const s = String(name || '').toLowerCase(); const g = GEAR.find(x => x.kw.some(k => s.includes(k))); return g ? g.id : null; };
  /* the kinds of equipment of a profile, in order: the four stock ones, then the athlete's own */
  const gearList = cfg => Object.keys(cfg.gear).filter(id => id !== NO_GEAR).map(id => Object.assign({ id }, cfg.gear[id]));
  /* where an exercise lies: the kind the athlete chose, else the one its name mentions, else «без снаряда» */
  const gearOf = (cfg, id) => (cfg.ex[id] && cfg.ex[id].gear) || NO_GEAR;

  /* an exercise as the merged config holds it: on the equipment the athlete chose, else the one its name mentions, else «без снаряда», and with that step */
  const placed = (cfg, def) => {
    const x = Object.assign({ n: '', m: {} }, def);
    delete x.step; delete x.round;
    if (x.mode === 'light') { delete x.gear; x.round = +((cfg.ex[x.of] || {}).round) || 2.5; return x; }
    const gid = x.gear && cfg.gear[x.gear] ? x.gear : gearGuess(x.n) || NO_GEAR;
    if (gid === NO_GEAR) delete x.gear; else x.gear = gid;
    if (x.mode === 'cycle') x.round = cfg.gear[gid].step; else x.step = cfg.gear[gid].step;
    return x;
  };

  /* ---------- what an exercise trains, read from its name: the athlete names it, the diary knows the muscles ----------
     The first rule that fits wins, so the narrow ones stand before the broad ones («бицепс бедра» before «бицепс», «румынская тяга» before «тяга»). */
  const EX_RULES = [
    [/французск/, 'iso', { triceps: 1 }],
    [/узк\S* хват/, 'h_push', { triceps: 1, chest: 0.5, delt_front: 0.5 }],
    [/брусь/, 'h_push', { chest: 1, triceps: 1, delt_front: 0.5 }],
    [/выпад|болгарск|сплит|зашагиван|lunge/, 'knee', { quads: 1, glutes: 1 }],
    [/жим\S* ног|гакк|присед|squat|leg press/, 'knee', { quads: 1, glutes: 0.5 }],
    [/жим.*(груд|под углом|наклонн)|(груд|наклонн).*жим|incline/, 'h_push', { chest: 1, delt_front: 0.5, triceps: 0.5 }],
    [/над голов|армейск|жим\S* (\S+ )?(стоя|сидя)|жим.*(плеч|дельт|арнольда)|overhead press|ohp/, 'v_push', { delt_front: 1, delt_mid: 0.5, triceps: 0.5 }],
    [/жим|отжиман|bench|press/, 'h_push', { chest: 1, delt_front: 0.5, triceps: 0.5 }],
    [/подтягив|вертикальн\S* тяг|тяг\S* верхн|pull-?up|pulldown/, 'v_pull', { lats: 1, upper_back: 0.5, biceps: 0.5 }],
    [/пуловер|pullover/, 'iso', { lats: 1 }],
    [/румынск|становая|м[её]ртвая тяга|на прямых ногах|гуд ?морнинг|rdl|deadlift/, 'hinge', { hams: 1, glutes: 1, erectors: 1 }],
    [/гиперэкстенз|разгибан\S* спин/, 'hinge', { erectors: 1, glutes: 0.5, hams: 0.5 }],
    [/ягодичн\S* мост|hip thrust|мостик/, 'hinge', { glutes: 1, hams: 0.5 }],
    [/отведени\S* (ног|бедра)|мах\S* ног|kickback/, 'iso', { glutes: 1 }],
    [/тяг\S* к лицу|face pull|задн\S* дельт|обратн\S* (бабочк|разведен)|(мах|разведен)\S* (\S+ )?в наклоне/, 'iso', { delt_rear: 1, upper_back: 0.5 }],
    [/шраг/, 'iso', { upper_back: 1 }],
    [/тяг|гребл|row/, 'h_pull', { upper_back: 1, lats: 0.5, delt_rear: 0.5, biceps: 0.5 }],
    [/разгибан\S* (ног|голен)|leg ext/, 'iso', { quads: 1 }],
    [/сгибан\S* (ног|голен)|бицепс\S* б[её]др|leg curl/, 'iso', { hams: 1 }],
    [/икр|на носки|голен|calf/, 'iso', { calves: 1 }],
    [/пресс|скручив|подъ[её]м\S* ног|планк|ролик/, 'iso', { abs: 1 }],
    [/передн\S* дельт|мах\S* впер[её]д|подъ[её]м\S* (\S+ )?перед собой/, 'iso', { delt_front: 1 }],
    [/мах|средн\S* дельт|разведен\S* (\S+ )?в стороны|отведени\S* рук|lateral/, 'iso', { delt_mid: 1 }],
    [/бабочк|сведени\S* рук|кроссовер|разводк|разведен|pec|fly/, 'iso', { chest: 1, delt_front: 0.5 }],
    [/молот|hammer/, 'iso', { biceps: 1, forearms: 0.5 }],
    [/кист|предплеч|запяст|wrist/, 'iso', { forearms: 1 }],
    [/бицепс|сгибан\S* рук|curl/, 'iso', { biceps: 1 }],
    [/трицепс|разгибан\S* рук|pushdown/, 'iso', { triceps: 1 }]
  ];
  /* name -> { pat, m, uni? }, or null when the name says nothing the diary knows */
  function guessEx(name) {
    const s = ' ' + String(name || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
    const r = EX_RULES.find(x => x[0].test(s));
    if (!r) return null;
    const def = { pat: r[1], m: clone(r[2]) };
    if (/ (лев|прав)(ая|ой|ую|ый|ое|ого) /.test(s)) def.uni = true;         // «кисть на блоке левая»: one side, its own exercise
    return def;
  }
  /* a muscle map that came from outside (Claude's answer): only known muscles, only 1 or 0.5, at least one main */
  function cleanDef(o) {
    if (!o || typeof o !== 'object') return null;
    const m = {};
    for (const [k, v] of Object.entries(o.m || {})) if (MUSCLE[k] && (+v === 1 || +v === 0.5)) m[k] = +v;
    if (!Object.values(m).some(v => v === 1)) return null;
    return { pat: PATTERNS.some(p => p.id === o.pat) ? o.pat : 'iso', m };
  }
  const exPrompt = name => 'Силовое упражнение называется «' + String(name).slice(0, 80) + '». Определи, какие мышцы оно тренирует, и ответь одной строкой JSON без пояснений: {"pat":"…","m":{"…":1}}.\n' +
    'pat — одно из: ' + PATTERNS.map(p => p.id + ' (' + p.n.toLowerCase() + ')').join(', ') + '.\n' +
    'm — мышцы только из списка: ' + MUSCLES.map(x => x.id + ' (' + x.n.toLowerCase() + ')').join(', ') + '. Значение 1 — основная мышца, 0.5 — помогает. Основных одна-три, помогающих не больше трёх.';
  const parseDef = text => { const t = String(text || ''), i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null; try { return cleanDef(JSON.parse(t.slice(i, j + 1))); } catch (e) { return null; } };

  /* ---------- config ---------- */
  const OFF_DEFAULT = { calves: 1, abs: 1, erectors: 1 };
  function mergeCfg(raw) {
    raw = raw || {};
    const c = {
      start: raw.start || null,
      zones: Object.assign({ min: 4, opt: 10, high: 20 }, raw.zones || {}),
      cycle: { inc: 2, sets: 4, pct: { 5: 77, 4: 82, 3: 87 } },
      method: raw.method || '',
      ex: {}
    };
    if (raw.cycle) { c.cycle.inc = +raw.cycle.inc || 0; c.cycle.sets = +raw.cycle.sets || 4; if (raw.cycle.pct) c.cycle.pct = Object.assign({}, raw.cycle.pct); }
    c.gear = {};
    { const rg = raw.gear || {};
      for (const g of GEAR) { const v = +((rg[g.id] || {}).step); c.gear[g.id] = { n: g.n, step: v > 0 ? v : g.step }; }
      for (const [id, g] of Object.entries(rg)) if (!c.gear[id] && id !== NO_GEAR && g && String(g.n || '').trim()) c.gear[id] = { n: String(g.n).trim(), step: +g.step > 0 ? +g.step : 2.5, own: true };
      c.gear[NO_GEAR] = { n: 'Без снаряда', step: +((rg[NO_GEAR] || {}).step) > 0 ? +rg[NO_GEAR].step : 2.5 }; }
    /* steps written by older versions are not read any more: the step is the equipment's. A light day rounds as its lift does, so it goes second */
    for (const [id, e] of Object.entries(raw.ex || {})) if (e.mode !== 'light') c.ex[id] = placed(c, Object.assign({ n: id }, e));
    for (const [id, e] of Object.entries(raw.ex || {})) if (e.mode === 'light') c.ex[id] = placed(c, Object.assign({ n: id }, e));
    c.program = raw.program && raw.program.slots ? clone(raw.program) : null;
    /* muscles left out of the count: the diary gives them no sets of its own and does not call them a gap.
       Calves, abs and erectors are out by default (the athlete adds to them by hand); a stored 0 puts a muscle back in. */
    c.ignore = {};
    { const ig = Object.assign({}, OFF_DEFAULT, raw.ignore || {}); for (const k of Object.keys(ig)) if (ig[k]) c.ignore[k] = 1; }
    c.rir = raw.rir != null && +raw.rir >= 0 && +raw.rir <= 4 ? Math.round(+raw.rir) : 1;   // reps left in reserve by the method
    c.bw = raw.bw === 'track' ? 'track' : 'gain';                 // body weight: watched for gaining, or only recorded
    /* the athlete's own limits: sets for one muscle in one training day, working sets in the whole week */
    c.caps = { day: 11, week: 100 };
    if (raw.caps) { if (+raw.caps.day > 0) c.caps.day = +raw.caps.day; if (+raw.caps.week > 0) c.caps.week = +raw.caps.week; }
    c.rest = +raw.rest >= 30 && +raw.rest <= 600 ? +raw.rest : 120;   // seconds of rest between sets, for the time estimate
    return c;
  }
  const exName = (cfg, id) => (cfg.ex[id] && cfg.ex[id].n) || id;
  const isCycle = (cfg, id) => !!(cfg.ex[id] && cfg.ex[id].mode === 'cycle');
  /* the light day of a priority lift is its own exercise: a fixed share of that lift's maximum, far from failure */
  const isLight = (cfg, id) => !!(cfg.ex[id] && cfg.ex[id].mode === 'light');
  const LIGHT = { pct: 75, reps: 5, sets: 3 };
  /* what an exercise is: a percentage lift, its light day, a multi-joint accessory or an isolation move */
  const kindOf = (cfg, id) => { const e = cfg.ex[id] || {}; return e.mode === 'cycle' ? 'base' : e.mode === 'light' ? 'light' : e.pat && e.pat !== 'iso' ? 'compound' : 'iso'; };
  /* reps scheme order inside the wave: 5 -> 4 -> 3 -> 5 ... */
  const cycleOrder = cfg => Object.keys(cfg.cycle.pct).map(Number).sort((a, b) => b - a);

  /* ---------- per-set maths ---------- */
  const work = it => it.skip ? [] : it.sets.filter(s => s.r > 0 && !s.warm && !s.skip);
  const e1 = (w, r) => r <= 1 ? w : w * (1 + r / 30);                      // Epley
  const topSet = sets => sets.reduce((t, s) => (s.w > t.w || (s.w === t.w && s.r > t.r)) ? s : t, sets[0]);
  /* reps normalised to the method's reserve (one rep unless the profile says otherwise): 10 reps with 3 in reserve count as 12 */
  let TARGET = 1;
  const setTarget = v => { TARGET = v >= 0 && v <= 4 ? Math.round(v) : 1; };
  const effReps = s => s.r + (s.q == null ? 0 : s.q - TARGET);
  const bestSet = sets => sets.reduce((t, s) => e1(s.w, effReps(s)) > e1(t.w, effReps(t)) ? s : t, sets[0]);
  /* reps in reserve: logged, or for wave sets estimated from the percentage (Epley) */
  const estRir = (pct, reps) => Math.round(30 * (100 / pct - 1) - reps);
  const setRir = (s, it) => s.q != null ? s.q : it.cyc && it.cyc.pct ? estRir(it.cyc.pct, s.r) : null;
  const EASY = 3;                                              // a set this far from failure counts as half a set for muscle volume
  const setVol = (s, it) => { const q = setRir(s, it); return q != null && q >= EASY ? 0.5 : 1; };
  /* what the athlete wants from one exercise. It sets the rep range of a double-progression exercise and the wave of a percentage lift */
  const GOALS = { mass: { n: 'масса', lo: 8, w: 4 }, both: { n: 'сила и масса', lo: 6, w: 4 }, strength: { n: 'приоритет силы' }, hold: { n: 'поддержание' }, auto: { n: 'сила по запасу' } };
  /* the mark counts only where it means something: a wave for a percentage lift, 8–12 or 6–10 for a multi-joint accessory, nothing for isolation */
  const goalOf = (cfg, id) => {
    const g = (cfg.ex[id] || {}).goal, k = kindOf(cfg, id);
    if (!g) return null;
    if (k === 'base') return g === 'strength' || g === 'hold' || g === 'auto' ? g : null;
    if (k === 'compound') return g === 'strength' ? 'both' : g === 'mass' || g === 'both' ? g : null;
    return null;
  };
  const goalName = (cfg, id) => { const g = goalOf(cfg, id); return g ? GOALS[g].n : ''; };
  /* lower bound from the goal, width from the athlete's own rule (weight step in % / 2.5), never narrower than the goal's minimum */
  const goalRange = (goal, w, step) => { const g = GOALS[goal], k = Math.min(8, Math.max(g.w, w > 0 ? Math.round(step / w * 100 / 2.5) : 0)); return [g.lo, g.lo + k]; };
  /* the heavy wave for the priority lift: up to doubles at 92.5%, the maximum grows once per cycle.
     A lift on «поддержание» keeps the usual wave with one set fewer and a frozen maximum */
  const WAVE_S = { pct: { 5: 77.5, 4: 82.5, 3: 87.5, 2: 92.5 }, sets: { 5: 4, 4: 4, 3: 4, 2: 3 }, inc: 2.5 };
  /* «сила по запасу»: the same four sets of four every week with one weight, and the reserve of the last set decides the next week —
     two or more: one step up, one: the same weight, none or a set not closed: 5% down. The weight starts at 83% of the maximum,
     which leaves about two reps in the last set. Its second day is three sets of four at 78%: three to four reps in reserve. */
  const AUTO = { pct: 83, reps: 4, sets: 4, aim: 2, down: 5 };
  const LIGHT_A = { pct: 78, reps: 4, sets: 3 };
  function waveOf(cfg, id) {
    const g = goalOf(cfg, id), strong = g === 'strength', hold = g === 'hold', auto = g === 'auto', pct = auto ? { [AUTO.reps]: AUTO.pct } : strong ? WAVE_S.pct : cfg.cycle.pct;
    return { strong, hold, auto, keep: strong || hold || auto, pct, order: Object.keys(pct).map(Number).sort((a, b) => b - a),
      sets: r => auto ? AUTO.sets : strong ? (WAVE_S.sets[r] || 4) : hold ? Math.max(2, cfg.cycle.sets - 1) : cfg.cycle.sets, inc: auto ? 0 : strong ? WAVE_S.inc : hold ? 0 : cfg.cycle.inc, perCycle: strong };
  }
  /* the light day follows its lift: 3 × 5 at 75% beside a wave, 3 × 4 at 78% beside «сила по запасу» */
  const lightOf = (cfg, id) => goalOf(cfg, isLight(cfg, id) ? (cfg.ex[id] || {}).of : id) === 'auto' ? LIGHT_A : LIGHT;
  const cycleVol = (cfg, id) => {
    if (isLight(cfg, id)) { const L = lightOf(cfg, id); return estRir(L.pct, L.reps) >= EASY ? 0.5 : 1; }
    const e = Object.entries(waveOf(cfg, id).pct);
    return e.length ? e.reduce((a, x) => a + (estRir(+x[1], +x[0]) >= EASY ? 0.5 : 1), 0) / e.length : 1;
  };
  const waveSetsAvg = (cfg, id) => { const wv = waveOf(cfg, id); return wv.order.length ? wv.order.reduce((a, r) => a + wv.sets(r), 0) / wv.order.length : cfg.cycle.sets; };
  /* the accepted programme stands in for a day until the first workout of that day is done under it */
  const progPending = (cfg, slot, w) => { const P = cfg && cfg.program; return !!(P && P.slots && Array.isArray(P.slots[slot]) && P.slots[slot].length && (!w || w.date < P.since)); };

  /* sets that have not moved for four sessions of the same day while the sets before them did not grow either.
     A last set that merely holds its reps after heavier first sets is not stalled. */
  function stalledSets(hist, hi) {
    if (hist.length < 4) return [];
    const rows = hist.slice(-4).map(x => x.item.sets.filter(k => !k.warm)), n = Math.min(...rows.map(r => r.length)), out = [];
    const grew = j => { const a = rows[0][j], b = rows[3][j]; return a.r != null && b.r != null && e1(b.w, effReps(b)) > e1(a.w, effReps(a)) * 1.005; };
    for (let i = 0; i < n; i++) {
      const seq = rows.map(r => r[i]);
      if (seq.some(k => k.r == null) || !seq.every(k => k.w === seq[0].w)) continue;
      if (seq[3].q != null && seq[3].q >= 2) continue;                       // held back on purpose
      const rs = seq.map(k => k.r);
      if (!(seq[3].r <= seq[0].r && Math.max(...rs) - Math.min(...rs) <= 1)) continue;
      if (hi != null && seq[3].r >= hi) continue;
      let before = false;
      for (let j = 0; j < i && !before; j++) before = grew(j);
      if (!before) out.push({ i, w: seq[3].w, r: seq[3].r });
    }
    return out;
  }

  function sortW(workouts) { return workouts.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1); }

  /* every session of one exercise, oldest first */
  function sessions(workouts, cfg, exId) {
    const out = [];
    for (const w of workouts) for (const it of w.items) {
      if (it.ex !== exId) continue;
      const sets = work(it);
      if (!sets.length) continue;
      const top = topSet(sets), best = bestSet(sets);
      const tm = it.cyc && it.cyc.pct ? (it.tm || top.w / (it.cyc.pct / 100)) : null;
      out.push({ date: w.date, wid: w.id, slot: w.slot, item: it, sets, top, best, e1: e1(best.w, effReps(best)), tm, metric: tm != null ? tm : e1(best.w, effReps(best)) });
    }
    return out;
  }

  /* exercises of the current programme: whatever the latest finished workout of each day contains */
  function program(workouts, cfg) {
    const last = {};
    for (const w of workouts) if (!w.open && w.slot && w.items.some(it => work(it).length)) last[w.slot] = w;
    const ids = new Set();
    for (const [slot, w] of Object.entries(last)) if (!progPending(cfg, slot, w)) for (const it of w.items) ids.add(it.ex);
    if (cfg && cfg.program) for (const sl of SLOTS) if (progPending(cfg, sl.id, last[sl.id])) for (const e of cfg.program.slots[sl.id]) ids.add(e.ex);
    return ids;
  }

  function exStats(workouts, cfg, exId, prog) {
    const ss = sessions(workouts, cfg, exId);
    if (!ss.length) return null;
    let prIdx = 0;
    ss.forEach((s, i) => { if (s.metric > ss[prIdx].metric * 1.0005) prIdx = i; });
    const n = ss.length, last = ss[n - 1], first = ss[0], sincePR = n - 1 - prIdx;
    let status = 'new';
    if (n >= 4) status = sincePR >= 3 ? (last.metric < ss[prIdx].metric * 0.95 ? 'down' : 'flat') : 'up';
    else if (n >= 2) status = last.metric > first.metric ? 'up' : 'new';
    if (isLight(cfg, exId)) status = 'light';
    const active = prog.has(exId);
    return { id: exId, ss, n, first, last, pr: ss[prIdx], prIdx, sincePR, status, active, delta: pct(last.metric, first.metric) };
  }

  function allStats(workouts, cfg) {
    const prog = program(workouts, cfg);
    const ids = [];
    for (const w of workouts) for (const it of w.items) if (!ids.includes(it.ex)) ids.push(it.ex);
    return ids.map(id => exStats(workouts, cfg, id, prog)).filter(Boolean);
  }

  /* ---------- weeks ---------- */
  function weeksInfo(workouts, cfg, today) {
    const start = cfg.start;
    const cur = Math.max(1, weekNo(today, start));
    const count = {};
    let maxW = cur;
    for (const w of workouts) { if (!w.items.some(it => work(it).length)) continue; const k = weekNo(w.date, start); count[k] = (count[k] || 0) + 1; if (k > maxW) maxW = k; }
    const weeks = [];
    for (let k = 1; k <= maxW; k++) {
      const [a, b] = weekRange(k, start);
      weeks.push({ no: k, from: a, to: b, count: count[k] || 0, current: k === cur, complete: k < cur || (count[k] || 0) >= SLOTS.length });
    }
    const ref = weeks.filter(w => w.complete && w.count > 0).slice(-3);
    return { weeks, cur, ref };
  }

  /* ---------- weekly volume per muscle: direct set = 1, indirect = its coefficient (0.5) ---------- */
  function volume(workouts, cfg) {
    const out = {};
    for (const w of workouts) {
      const k = weekNo(w.date, cfg.start);
      /* s: the part of m that comes from the lifts done by percentages — strength work */
      const o = out[k] || (out[k] = { m: {}, s: {}, detail: {}, pat: {}, sets: 0, n: 0, unknown: [] });
      let any = false;
      for (const it of w.items) {
        const ws = work(it), n = ws.length;
        if (!n) continue;
        any = true;
        const ex = cfg.ex[it.ex], f = ex && ex.uni ? 0.5 : 1, eff = ws.reduce((a, s) => a + setVol(s, it), 0);
        o.sets += n * f;
        if (!ex || !ex.m || !Object.keys(ex.m).length) { if (!o.unknown.includes(it.ex)) o.unknown.push(it.ex); continue; }
        if (ex.pat) o.pat[ex.pat] = (o.pat[ex.pat] || 0) + n * f;
        for (const [m, c] of Object.entries(ex.m)) {
          if (!c) continue;
          o.m[m] = (o.m[m] || 0) + eff * c * f;
          if (it.cyc) o.s[m] = (o.s[m] || 0) + eff * c * f;
          const d = o.detail[m] || (o.detail[m] = {});
          const e = d[it.ex] || (d[it.ex] = { ex: it.ex, n: 0, eff: 0, c, v: 0 });
          e.n += n * f; e.eff += eff * f; e.v += eff * c * f;
        }
      }
      if (any) o.n++;
    }
    return out;
  }
  const zone = (v, z) => v <= 0 ? 'none' : v < z.min ? 'low' : v < z.opt ? 'base' : v <= z.high ? 'opt' : 'high';
  const ZONE = {
    none: { n: 'нет нагрузки', sev: 'crit' }, low: { n: 'мало', sev: 'serious' }, base: { n: 'ниже рабочей зоны', sev: 'warn' },
    opt: { n: 'рабочая зона', sev: 'good' }, high: { n: 'выше зоны', sev: 'over' }
  };
  function avgVolume(vol, ref) {
    const avg = {}, avgS = {};
    for (const m of MUSCLES) {
      avg[m.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].m[m.id]) || 0), 0) / ref.length : 0;
      avgS[m.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].s && vol[w.no].s[m.id]) || 0), 0) / ref.length : 0;
    }
    const pat = {};
    for (const p of PATTERNS) pat[p.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].pat[p.id]) || 0), 0) / ref.length : 0;
    return { avg, avgS, pat };
  }

  /* how a total splits into work for mass and strength work, rounded so that the two add up to the shown total */
  const splitText = (total, strong) => { const r1 = x => Math.round(x * 10) / 10; return strong >= 0.05 ? 'масса ' + fmt(Math.max(0, r1(r1(total) - r1(strong))), 1) + ' · сила ' + fmt(r1(strong), 1) : ''; };

  /* ---------- chained strength index: geometric mean of week-over-week change in every exercise done in both weeks ---------- */
  function strengthIndex(workouts, cfg) {
    const per = {};
    for (const w of workouts) {
      const k = weekNo(w.date, cfg.start);
      for (const it of w.items) {
        const sets = work(it);
        if (!sets.length) continue;
        const b = bestSet(sets), t = topSet(sets);
        const metric = it.cyc && it.cyc.pct ? t.w / (it.cyc.pct / 100) : e1(b.w, effReps(b));
        if (!(metric > 0)) continue;
        const o = per[k] || (per[k] = {});
        if (!(o[it.ex] >= metric)) o[it.ex] = metric;
      }
    }
    const ks = Object.keys(per).map(Number).sort((a, b) => a - b);
    const out = [];
    let idx = 100;
    ks.forEach((k, i) => {
      let shared = 0;
      if (i > 0) {
        const prev = per[ks[i - 1]];
        let sum = 0;
        for (const [ex, v] of Object.entries(per[k])) if (prev[ex] > 0) { sum += Math.log(v / prev[ex]); shared++; }
        if (shared) idx *= Math.exp(sum / shared);
      }
      out.push({ week: k, idx, shared });
    });
    return out;
  }

  /* ---------- planning by the athlete's own rules ---------- */
  function lastSessionItem(workouts, exId, slot, before) {
    let same = null, any = null;
    for (const w of workouts) {
      if (before && !(w.date < before)) continue;
      if (w.open) continue;
      for (const it of w.items) if (it.ex === exId && it.sets.length) { any = { w, it }; if (w.slot === slot) same = { w, it }; }
    }
    return same || any;
  }
  function inferStep(workouts, exId) {
    const ws = [];
    for (let i = workouts.length - 1; i >= 0 && ws.length < 24; i--)
      for (const it of workouts[i].items) if (it.ex === exId) for (const s of it.sets) if (!ws.includes(s.w)) ws.push(s.w);
    ws.sort((a, b) => a - b);
    let step = 0;
    for (let i = 1; i < ws.length; i++) { const d = +(ws[i] - ws[i - 1]).toFixed(3); if (d > 0 && (!step || d < step)) step = d; }
    return step || 2.5;
  }
  const stepOf = (workouts, cfg, exId) => (cfg.ex[exId] && +cfg.ex[exId].step) || inferStep(workouts, exId);
  /* his formula: reps lost on a weight jump = step% / 2.5, lower bound 8, never narrower than 4 */
  const formulaRange = (w, step, lo = 8) => w > 0 ? [lo, lo + Math.max(4, Math.round((step / w * 100) / 2.5))] : [lo, lo + 4];

  function suggestSet(prev, range, step) {
    const [lo, hi] = range;
    if (!prev) return { w: null, rule: 'new', target: [lo, hi] };
    if (prev.r == null) return { w: prev.w, rule: 'repeat', target: [lo, hi] };
    if (prev.r >= hi) return { w: +(prev.w + step).toFixed(3), rule: 'up', target: [lo, hi] };
    if (prev.r < lo) return { w: Math.max(0, +(prev.w - step).toFixed(3)), rule: 'down', target: [lo, hi] };
    return { w: prev.w, rule: 'hold', target: [Math.min(hi, prev.r + 1), hi] };
  }
  const roundTo = (v, q) => Math.round(v / q) * q;

  function planCycle(workouts, cfg, exId, before) {
    const wv = waveOf(cfg, exId), order = wv.order, first = order[0], ex = cfg.ex[exId] || {}, q = +ex.round || 2.5;
    const ss = sessions(workouts.filter(w => !w.open && (!before || w.date < before)), cfg, exId).filter(s => s.item.cyc);
    if (!ss.length) {                                                 // no sessions yet: from the maximum the athlete named, if any
      const tm = knownMax(cfg, exId), p0 = wv.pct[first];
      return { reps: first, pct: p0, sets: wv.sets(first), w: tm ? +roundTo(tm * p0 / 100, q).toFixed(3) : null, tm, prev: null, repeat: false, strong: wv.strong, hold: wv.hold, keep: wv.keep, known: !!tm, auto: wv.auto, verdict: wv.auto ? 'start' : undefined };
    }
    const last = ss[ss.length - 1], lr = last.item.cyc.reps;
    const planned = last.item.sets.filter(s => !s.warm);
    const done = planned.length > 0 && planned.every(s => s.r != null && s.r >= lr) && !last.item.skip;
    const hard = last.sets.some(s => s.q === 0);
    const repeat = !done;
    const inWave = wv.pct[lr] === last.item.cyc.pct;                 // the last session was planned by this wave
    if (wv.auto && inWave) {
      /* one weight, four by four: the last set says what the next week is */
      const lw = last.top.w, end = planned[planned.length - 1], rz = end && end.q != null ? end.q : null;
      const verdict = !done || hard ? 'down' : rz === 1 ? 'hold' : 'up';
      const w = +(verdict === 'up' ? lw + q : verdict === 'hold' ? lw : Math.min(lw - q, roundTo(lw * (1 - AUTO.down / 100), q))).toFixed(3);
      return { reps: AUTO.reps, pct: AUTO.pct, sets: AUTO.sets, w, tm: w / (AUTO.pct / 100), prev: last, repeat: false, hard: false, strong: false, hold: false, keep: true, auto: true, verdict, rz, closed: done };
    }
    let reps, tm;
    if (!inWave) { reps = first; tm = last.tm; }                     // the wave was switched: start it from the top on the same maximum
    else if (repeat) { reps = lr; tm = last.tm; }
    else {
      const i = order.indexOf(lr);
      reps = order[(i + 1) % order.length];
      const grows = wv.perCycle ? i === order.length - 1 : true;     // the heavy wave adds once per cycle, the usual one every week
      tm = last.tm * (grows && !hard ? 1 + wv.inc / 100 : 1);
    }
    const p = wv.pct[reps];
    return { reps, pct: p, sets: wv.sets(reps), w: repeat && inWave ? last.top.w : +roundTo(tm * p / 100, q).toFixed(3), tm, prev: last, repeat: repeat && inWave, hard, strong: wv.strong, hold: wv.hold, keep: wv.keep, switched: !inWave, auto: wv.auto, verdict: wv.auto ? 'start' : undefined };
  }
  function planLight(workouts, cfg, exId, before) {
    const ex = cfg.ex[exId] || {}, par = ex.of, q = +ex.round || +((cfg.ex[par] || {}).round) || 2.5, LIGHT = lightOf(cfg, exId);
    const c = par ? planCycle(workouts, cfg, par, before) : null, tm = c && c.prev ? c.prev.tm : c && c.known ? c.tm : null;
    let w = tm ? +roundTo(tm * LIGHT.pct / 100, q).toFixed(3) : null;
    if (w != null) {                                                    // never below the lightest weight ever logged in the lift (body weight in pull-ups)
      let min = null;
      for (const x of workouts) for (const it of x.items) if (it.ex === par) for (const k of work(it)) if (k.w > 0 && (min == null || k.w < min)) min = k.w;
      if (min != null && w < min) w = min;
    }
    return { pct: LIGHT.pct, reps: LIGHT.reps, sets: LIGHT.sets, w, tm, of: par };
  }

  /* ---------- weights the athlete names before there is a journal: a one-rep maximum or a working weight ---------- */
  /* the maximum an exercise without sessions is planned from: the named one, else the working weight raised by Epley over its reps plus the method's reserve */
  function knownMax(cfg, exId) {
    const e = cfg.ex[exId] || {};
    if (+e.max > 0) return +e.max;
    if (!(+e.work > 0)) return null;
    const r = +e.workR > 0 ? +e.workR : isCycle(cfg, exId) ? waveOf(cfg, exId).order[0] : Math.round(((+e.lo || 8) + (+e.hi || 12)) / 2);
    return e1(+e.work, r + cfg.rir);
  }
  /* the weight a double-progression exercise starts with: the working weight as it is when its reps fit the range,
     else the weight for the middle of the range with the method's reserve, rounded down to the step */
  function startWeight(workouts, cfg, exId, range) {
    const e = cfg.ex[exId] || {}, lo = range[0], hi = range[1];
    if (+e.work > 0 && !(+e.workR > 0 && (+e.workR < lo || +e.workR > hi))) return +e.work;
    const mx = knownMax(cfg, exId);
    if (!mx) return null;
    const step = stepOf(workouts, cfg, exId), v = Math.floor(mx / (1 + (Math.round((lo + hi) / 2) + cfg.rir) / 30) / step + 1e-6) * step;
    return v > 0 ? +v.toFixed(3) : null;
  }
  /* what the first plan of an exercise without sessions starts from: { w, tm, pct, reps, src } or null (there is a journal, or nothing is named) */
  function startOf(workouts, cfg, exId) {
    const done = workouts.filter(w => !w.open), e = cfg.ex[exId] || {}, own = isLight(cfg, exId) ? cfg.ex[e.of] || {} : e;
    if (lastSessionItem(done, isLight(cfg, exId) ? e.of : exId, null, null) || !(+own.max > 0 || +own.work > 0)) return null;
    const src = +own.max > 0 ? 'max' : 'work';
    if (isLight(cfg, exId)) { const c = planLight(done, cfg, exId, null); return c.w ? { w: c.w, tm: c.tm, pct: c.pct, reps: c.reps, src } : null; }
    if (isCycle(cfg, exId)) { const c = planCycle(done, cfg, exId, null); return c.w ? { w: c.w, tm: c.tm, pct: c.pct, reps: c.reps, src } : null; }
    const w = startWeight(done, cfg, exId, rangeOf(done, cfg, exId));
    return w ? { w, src: +e.work > 0 && w === +e.work ? 'work' : src } : null;
  }

  /* hints for one exercise in a workout being planned or edited */
  function hints(workouts, cfg, exId, slot, before) {
    const ex = cfg.ex[exId] || {};
    const p = lastSessionItem(workouts, exId, slot, before);
    const step = stepOf(workouts, cfg, exId);
    const g = goalOf(cfg, exId);
    const range = (p && p.it.range) || (g && GOALS[g].lo ? goalRange(g, 0, step) : [ex.lo || 8, ex.hi || 12]);
    const prevSets = p ? p.it.sets.filter(s => !s.warm) : [];
    return { step, range, prevDate: p ? p.w.date : null, prevSlot: p ? p.w.slot : null, prevSkipped: p ? p.it.skip : false, prevSets, sets: prevSets.map(s => suggestSet(s, range, step)), start: p ? null : startWeight(workouts, cfg, exId, range) };
  }

  function nextSlot(workouts, today) {
    const done = workouts.filter(w => !w.open && w.slot);
    if (!done.length) { const d = today ? dow(today) : 1; return SLOTS.slice().sort((a, b) => ((a.dow - d + 7) % 7) - ((b.dow - d + 7) % 7))[0].id; }
    const i = SLOTS.findIndex(s => s.id === done[done.length - 1].slot);
    return SLOTS[(i + 1) % SLOTS.length].id;
  }
  function nextDate(slot, today, workouts) {
    const want = SLOT[slot].dow, taken = workouts.some(w => w.date === today && !w.open);
    for (let k = taken ? 1 : 0; k < 8; k++) { const d = addDays(today, k); if (dow(d) === want) return d; }
    return today;
  }

  /* one exercise of a plan: by its wave, as a light day, or by double progression; `n` fixes the number of sets */
  function makeItem(workouts, cfg, exId, slot, date, n) {
    if (isLight(cfg, exId)) {
      const c = planLight(workouts, cfg, exId, date);
      return { ex: exId, cyc: { pct: c.pct, reps: c.reps }, range: null, sets: Array.from({ length: c.sets }, () => ({ w: c.w, r: null })), note: '', skip: false, rir: null, tm: c.tm ? +c.tm.toFixed(2) : null };
    }
    if (isCycle(cfg, exId)) {
      const c = planCycle(workouts, cfg, exId, date);
      return { ex: exId, cyc: { pct: c.pct, reps: c.reps }, range: null, sets: Array.from({ length: c.sets }, () => ({ w: c.w, r: null })), note: '', skip: false, rir: null, tm: c.keep && c.tm ? +c.tm.toFixed(2) : null };
    }
    const h = hints(workouts, cfg, exId, slot, date);
    let sets = h.sets.map(x => ({ w: x.w, r: null }));
    if (n > 0) { if (sets.length > n) sets = sets.slice(0, n); while (sets.length < n) sets.push({ w: sets.length ? sets[sets.length - 1].w : h.start, r: null }); }
    return { ex: exId, cyc: null, range: h.range.slice(), sets, note: '', skip: false, rir: null };
  }

  function plan(workouts, cfg, slot, date) {
    let tpl = null;
    for (const w of workouts) if (!w.open && w.slot === slot && w.date < date) tpl = w;
    const prog = progPending(cfg, slot, tpl);
    const src = prog ? cfg.program.slots[slot].filter(e => cfg.ex[e.ex]) : tpl ? tpl.items.map(it => ({ ex: it.ex })) : [];
    const items = src.map(e => makeItem(workouts, cfg, e.ex, slot, date, prog ? e.n : 0));
    return { slot, date, template: prog ? null : tpl ? tpl.id : null, prog, items };
  }

  /* ---------- adaptive layer: what the diary would change on top of the athlete's rules ---------- */
  const ADDS = [
    { key: 'abs', id: 'x_abs', prio: 4, sets: 3, times: 2, def: { n: 'Пресс', pat: 'iso', m: { abs: 1 } }, cover: e => ((e || {}).m || {}).abs >= 1,
      need: c => c.pv('abs') < c.z.min, why: c => 'пресс по программе получает ' + nSets(c.pv('abs')) + ' в неделю при минимуме ' + c.z.min },
    { key: 'rdl', id: 'x_rdl', prio: 1, sets: 4, times: 1, def: { n: 'Румынская тяга', pat: 'hinge', m: { hams: 1, glutes: 1, erectors: 1 } }, cover: e => (e || {}).pat === 'hinge',
      need: c => !c.pp('hinge'), why: c => 'в программе нет тяги с наклоном: разгибатели спины — ' + nSets(c.pv('erectors')) + ', ягодицы — ' + nSets(c.pv('glutes')) + ' в неделю' },
    { key: 'calf', id: 'x_calf', prio: 3, sets: 3, times: 2, def: { n: 'Подъёмы на носки', pat: 'iso', m: { calves: 1 } }, cover: e => ((e || {}).m || {}).calves >= 1,
      need: c => c.pv('calves') < c.z.min, why: c => 'икры по программе получают ' + nSets(c.pv('calves')) + ' в неделю при минимуме ' + c.z.min },
    { key: 'ohp', id: 'x_ohp', prio: 2, sets: 3, times: 1, def: { n: 'Жим над головой', pat: 'v_push', m: { delt_front: 1, delt_mid: 0.5, triceps: 0.5 } }, cover: e => (e || {}).pat === 'v_push',
      need: c => !c.pp('v_push'), why: c => 'в программе нет вертикального жима: передние дельты — ' + nSets(c.pv('delt_front')) + ' в неделю' },
    { key: 'rear', id: 'x_rear', prio: 5, sets: 3, times: 2, def: { n: 'Обратная бабочка', pat: 'iso', m: { delt_rear: 1, upper_back: 0.5 } }, cover: e => ((e || {}).m || {}).delt_rear >= 1,
      need: c => c.pv('delt_rear') < c.z.opt && !c.prim('delt_rear'), why: c => 'задние дельты работают только косвенно: ' + nSets(c.pv('delt_rear')) + ' в неделю при рабочей зоне от ' + c.z.opt }
  ];

  /* where a week of day templates breaks the athlete's limits */
  function ruleBreaks(cfg, T) {
    const out = [], total = SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0), caps = cfg.caps;
    if (total > caps.week + 0.01) out.push('В неделю ' + nSets(+total.toFixed(1)) + ' при лимите ' + caps.week);
    for (const sl of SLOTS) for (const m of MUSCLES) { const v = (T.day[sl.id] || {})[m.id] || 0; if (v > caps.day + 0.01) out.push(sl.n + ': ' + m.n.toLowerCase() + ' — ' + nSets(+v.toFixed(1)) + ' при лимите ' + caps.day + ' за тренировку'); }
    return out;
  }
  /* minutes a workout takes: a warm-up, a minute to set up each exercise (three more to warm up a percentage lift), every set and the rest after it */
  const REST_OPTS = [60, 90, 120, 150, 180];
  function estMinutes(cfg, items, rest, leftOnly) {
    rest = rest || cfg.rest || 120;
    let sec = 0, any = false;
    for (const it of items) {
      if (it.skip) continue;
      const ex = cfg.ex[it.ex] || {}, wave = isCycle(cfg, it.ex), light = isLight(cfg, it.ex);
      const all = it.sets ? it.sets.filter(x => !x.warm && !x.skip) : null;
      const n = all ? (leftOnly ? all.filter(x => x.r == null).length : all.length) : light ? lightOf(cfg, it.ex).sets : wave ? waveSetsAvg(cfg, it.ex) : (+it.n || 0);
      if (!n) continue;
      const started = leftOnly && all && all.some(x => x.r != null);
      sec += (started ? 0 : 60 + (wave ? 180 : 0)) + n * ((wave || light ? 25 : 40) + (wave ? rest + 60 : ex.uni ? rest / 2 : rest));
      any = true;
    }
    return any ? (sec + (leftOnly ? 0 : 300)) / 60 : 0;
  }
  const fmtDur = min => { const m = Math.max(5, Math.round(min / 5) * 5); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : ''); };
  const fmtRest = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');

  /* weekly sets per muscle, movement type and day for a set of day templates {slot: {items}} */
  function tally(cfg, t) {
    /* ps: the part of pv that comes from the lifts done by percentages — strength work; the rest of pv is work for mass */
    const pv = {}, ps = {}, pp = {}, prim = {}, load = {}, day = {};
    for (const sl of SLOTS) {
      load[sl.id] = 0; day[sl.id] = {};
      const w = t[sl.id];
      if (!w) continue;
      for (const it of w.items) {
        const ex = cfg.ex[it.ex], wave = isCycle(cfg, it.ex), light = isLight(cfg, it.ex);
        const n = light ? lightOf(cfg, it.ex).sets : wave ? waveSetsAvg(cfg, it.ex) : it.sets ? it.sets.filter(x => !x.warm).length : (+it.n || 0);
        const heavy = !!(wave || light || it.cyc), f = ex && ex.uni ? 0.5 : 1, k = heavy ? cycleVol(cfg, it.ex) : 1;
        load[sl.id] += n * f;
        if (!ex) continue;
        if (ex.pat) pp[ex.pat] = (pp[ex.pat] || 0) + n * f;
        for (const [m, c] of Object.entries(ex.m || {})) { pv[m] = (pv[m] || 0) + n * c * f * k; if (heavy) ps[m] = (ps[m] || 0) + n * c * f * k; day[sl.id][m] = (day[sl.id][m] || 0) + n * c * f * k; if (c >= 1) prim[m] = true; }
      }
    }
    return { t, pv, ps, pp, prim, load, day };
  }
  /* the programme as it stands: the latest finished workout of each day, or the accepted programme where it has not been trained yet */
  function planned(workouts, cfg) {
    const t = {};
    for (const w of workouts) if (!w.open && w.slot && w.items.length) t[w.slot] = w;
    for (const sl of SLOTS) if (progPending(cfg, sl.id, t[sl.id])) t[sl.id] = { prog: true, items: cfg.program.slots[sl.id].filter(e => cfg.ex[e.ex]).map(e => ({ ex: e.ex, n: e.n || 0 })) };
    return tally(cfg, t);
  }

  /* a missing exercise is not offered when every muscle it is for is outside the athlete's goal */
  const offGoal = (cfg, a) => Object.entries(a.def.m).filter(e => e[1] >= 1).every(e => cfg.ignore && cfg.ignore[e[0]]);
  /* exercises the programme lacks, spread over the days so that no day gets all of them */
  function additions(workouts, cfg, pl) {
    const ctx = { z: cfg.zones, pv: m => pl.pv[m] || 0, pp: p => pl.pp[p] || 0, prim: m => !!pl.prim[m] };
    const load = Object.assign({}, pl.load), out = {};
    for (const sl of SLOTS) out[sl.id] = [];
    for (const a of ADDS) {
      if (!a.need(ctx) || offGoal(cfg, a)) continue;
      const covered = sl => !!pl.t[sl.id] && pl.t[sl.id].items.some(it => a.cover(cfg.ex[it.ex]));
      const free = SLOTS.filter(sl => pl.t[sl.id] && !covered(sl));
      let needN = a.times - SLOTS.filter(covered).length;
      let exId = null;
      for (let i = workouts.length - 1; i >= 0 && !exId; i--) for (const it of workouts[i].items) if (a.cover(cfg.ex[it.ex])) { exId = it.ex; break; }
      if (!exId) exId = Object.keys(cfg.ex).find(id => a.cover(cfg.ex[id])) || null;
      const def = exId ? null : a.def;
      while (needN-- > 0 && free.length) {
        free.sort((x, y) => load[x.id] - load[y.id]);
        const sl = free.shift();
        load[sl.id] += a.sets;
        out[sl.id].push({ key: 'add:' + a.key, a, exId: exId || a.id, def, name: exId ? exName(cfg, exId) : a.def.n, sets: a.sets, range: [8, 12], why: a.why(ctx) });
      }
    }
    return out;
  }

  function adapt(workouts, cfg, slot, date) {
    const past = workouts.filter(w => !w.open && w.date < date);
    const base = plan(workouts, cfg, slot, date), z = cfg.zones, prog = program(past, cfg), pl = planned(past, cfg), props = [];
    const dps = allStats(past, cfg).filter(s => s.active && !isCycle(cfg, s.id) && !isLight(cfg, s.id) && s.n >= 2);
    const worse = dps.filter(s => s.last.metric < s.ss[s.n - 2].metric * 0.98);
    const deload = dps.length >= 6 && worse.length >= dps.length / 2;
    const short = {}, over = {}, used = {};
    /* his limits: nothing is added past the weekly total or past the daily amount for one muscle */
    const caps = cfg.caps, weekCap = Math.min(caps.week, cfg.program && +cfg.program.budget > 0 ? +cfg.program.budget : Infinity);
    let room = weekCap - SLOTS.reduce((a, sl) => a + (pl.load[sl.id] || 0), 0);
    const dayV = pl.day[slot] || {};
    const fitsDay = (e, n) => Object.entries(e.m || {}).every(([m, c]) => !c || (dayV[m] || 0) + n * c * (e.uni ? 0.5 : 1) <= caps.day + 0.01);
    for (const m of MUSCLES) { const v = pl.pv[m.id] || 0; if (v > 0 && v < z.opt - 0.5 && pl.prim[m.id] && !cfg.ignore[m.id]) short[m.id] = v; if (v > z.high) over[m.id] = v; }
    const q = n => n + ' ' + plural(n, ['день', 'дня', 'дней']);

    base.items.forEach((it, idx) => {
      const ex = cfg.ex[it.ex] || { m: {} }, s = exStats(past, cfg, it.ex, prog);
      const gap = s ? dnum(date) - dnum(s.last.date) : 0;
      const push = (tag, notes, sets, cyc, range) => props.push({ key: it.ex, ex: it.ex, idx, tag, notes, sets, cyc: cyc || null, range: range || null });

      if (isLight(cfg, it.ex)) return;                                  // the light day follows the lift's maximum, nothing to adjust
      if (it.cyc) {
        const c = planCycle(workouts, cfg, it.ex, date), rq = +ex.round || 2.5;
        if (!c.prev) return;
        const ss = sessions(past, cfg, it.ex).filter(x => x.item.cyc);
        const failed = x => { const p = x.item.sets.filter(k => !k.warm); return p.some(k => k.r == null || k.r < x.item.cyc.reps); };
        const flat = w => +roundTo(w, rq).toFixed(3);
        if (deload) {
          const w = flat(c.prev.tm * c.pct / 100), n = Math.max(1, Math.ceil(c.sets / 2));
          push('Разгрузка', [n + ' × ' + c.reps + ' по ' + fmt(w) + ' кг вместо ' + c.sets + ' × ' + c.reps + ' по ' + fmt(c.w) + ': половина подходов, максимум без прибавки'], Array.from({ length: n }, () => ({ w, tg: [c.reps, c.reps] })), { pct: c.pct, reps: c.reps });
        } else if (c.auto) {
          /* «сила по запасу» moves its own weight after every session: nothing to add here */
        } else if (ss.length >= 2 && failed(ss[ss.length - 1]) && failed(ss[ss.length - 2])) {
          const wv = waveOf(cfg, it.ex), r0 = wv.order[0], p0 = wv.pct[r0], n0 = wv.sets(r0), tm = c.prev.tm * 0.9, w = flat(tm * p0 / 100);
          push('Плато', ['два раза подряд подходы не закрыты: расчётный максимум −10% (до ' + fmt(tm, 1) + ' кг), волна заново с ' + n0 + ' × ' + r0 + ' по ' + fmt(w) + ' кг'], Array.from({ length: n0 }, () => ({ w, tg: [r0, r0] })), { pct: p0, reps: r0 });
        } else if (gap >= 14 && !c.repeat && !c.hard) {
          const w = flat(c.prev.tm * c.pct / 100);
          if (w !== c.w) push('После перерыва', [q(gap) + ' без этого упражнения: ' + fmt(w) + ' кг вместо ' + fmt(c.w) + ', волна идёт дальше без прибавки к максимуму'], Array.from({ length: c.sets }, () => ({ w, tg: [c.reps, c.reps] })), { pct: c.pct, reps: c.reps });
        } else if (!c.repeat && !c.hard) {
          const qs = c.prev.sets.filter(k => k.q != null).map(k => k.q);
          if (qs.length) {
            const exp = estRir(c.prev.item.cyc.pct, c.prev.item.cyc.reps), mn = Math.min(...qs);
            const same = Array.from({ length: c.sets }, w => w), cy = { pct: c.pct, reps: c.reps };
            if (mn >= exp + 2 && !c.hold) {
              const w = flat(c.tm * 1.025 * c.pct / 100);
              if (w !== c.w) push('Недогруз', ['в прошлый раз запас ' + mn + ' при расчётных ' + exp + ': максимум занижен, ' + fmt(w) + ' кг вместо ' + fmt(c.w)], same.map(() => ({ w, tg: [c.reps, c.reps] })), cy);
            } else if (mn <= exp - 2) {
              const w = flat(c.prev.tm * c.pct / 100);
              if (w !== c.w) push('Запас меньше расчётного', ['в прошлый раз запас ' + mn + ' при расчётных ' + exp + ': максимум завышен, эта неделя без прибавки — ' + fmt(w) + ' кг вместо ' + fmt(c.w)], same.map(() => ({ w, tg: [c.reps, c.reps] })), cy);
            }
          }
        }
        return;
      }

      const h = hints(workouts, cfg, it.ex, slot, date), prev = h.prevSets, lo = it.range[0], hi = it.range[1], step = h.step;
      if (!prev.length) return;
      if (deload) {
        const n = Math.max(1, Math.ceil(prev.length / 2));
        push('Разгрузка', [n + ' ' + plural(n, ['подход', 'подхода', 'подходов']) + ' вместо ' + prev.length + ' на весах прошлого раза, по 2 повтора в запасе'], prev.slice(0, n).map(p => ({ w: p.w, tg: [lo, Math.max(lo, (p.r == null ? lo : p.r) - 2)] })));
        return;
      }
      if (s && gap >= 14 && h.sets.some(x => x.rule === 'up')) {
        push('После перерыва', [q(gap) + ' без этого упражнения: веса прошлого раза, без повышения'], prev.map(p => ({ w: p.w, tg: [Math.max(lo, Math.min(hi, p.r == null ? lo : p.r)), hi] })));
        return;
      }
      if (s && s.n >= 4 && (s.status === 'flat' || s.status === 'down')) {
        const b = s.pr.best;
        push(s.status === 'down' ? 'Откат' : 'Плато', [s.sincePR + ' ' + plural(s.sincePR, ['тренировка', 'тренировки', 'тренировок']) + ' без рекорда (лучший — ' + fmt(b.w) + ' × ' + b.r + ', ' + fmtDate(s.pr.date, true) + '): все подходы −10%, повторы набираются заново до верха диапазона'],
          prev.map(p => { const k = Math.max(1, Math.round(p.w * 0.1 / step)); return { w: Math.max(0, +(p.w - k * step).toFixed(3)), tg: [Math.min(hi, (p.r == null ? lo : p.r) + 2), hi] }; }));
        return;
      }

      const goal = goalOf(cfg, it.ex);
      if (goal) {
        const R = goalRange(goal, prev.reduce((m, p) => Math.max(m, p.w || 0), 0), step);
        if (R[0] !== lo) {
          const shift = lo - R[0];
          push('Цель: ' + GOALS[goal].n, ['диапазон ' + lo + '–' + hi + ' → ' + R[0] + '–' + R[1] + ', потому что цель упражнения — ' + GOALS[goal].n + '; веса ' + (shift > 0 ? 'выше' : 'ниже') + ' из расчёта 2.5% на повтор' + (goal === 'strength' ? ', в запасе оставляй 2 повтора' : '')],
            it.sets.map(x => { const k = x.w > 0 ? Math.round(shift * 0.025 * x.w / step) : 0; return { w: x.w == null ? null : Math.max(0, +(x.w + k * step).toFixed(3)), tg: [R[0], R[1]] }; }), null, R);
          return;
        }
      }
      /* isolation: the range must be wide enough to survive one weight step (his own formula) */
      if (kindOf(cfg, it.ex) === 'iso') {
        const top = prev.reduce((m, p) => Math.max(m, p.w || 0), 0), F = formulaRange(top, step, lo);
        if (top > 0 && F[1] >= hi + 2) {
          push('Диапазон по шагу веса', ['диапазон ' + lo + '–' + hi + ' → ' + F[0] + '–' + F[1] + ': шаг ' + fmt(step) + ' кг — это ' + fmt(step / top * 100, 0) + '% от ' + fmt(top) + ' кг, по твоей формуле на новом весе теряется около ' + (F[1] - F[0]) + ' повторов, и при верхней границе ' + hi + ' подход после повышения падает ниже ' + lo],
            it.sets.map((x, i) => { const g = prev[i] ? suggestSet(prev[i], F, step) : null; return { w: g ? g.w : x.w, tg: g ? g.target.slice() : F.slice() }; }), null, F);
          return;
        }
      }
      const sets = it.sets.map((x, i) => ({ w: x.w, tg: h.sets[i] ? h.sets[i].target.slice() : [lo, hi] })), notes = [], tags = [];
      const tag = t => { if (!tags.includes(t)) tags.push(t); }, stalled = {};
      /* a set that has not moved for four sessions of this day while the sets before it did not grow either: one step down, rebuild the reps */
      const hist = s ? s.ss.filter(x => x.slot === slot).slice(-4) : [];
      if (hist.length === 4 && s.status === 'up' && hist[3].date === h.prevDate) {
        for (const k of stalledSets(hist, hi)) {
          if (!sets[k.i] || !(k.w > 0)) continue;
          const nw = Math.max(0, +(k.w - step).toFixed(3)), t0 = Math.min(hi, k.r + Math.max(1, Math.round(step / k.w * 100 / 2.5)));
          sets[k.i] = { w: nw, tg: [t0, hi] };
          notes.push('подход ' + (k.i + 1) + ': ' + fmt(k.w) + ' → ' + fmt(nw) + ' кг, цель ' + t0 + '+ — четыре тренировки подряд на ' + fmt(k.w) + ' × ' + k.r + (k.i ? ', и подходы перед ним за это время не выросли' : ''));
          tag('Подход стоит'); stalled[k.i] = true;
        }
      }
      /* the same rule, read with the logged reserve: 10 reps with 3 left are worth 12, 12 reps to failure are worth 11 */
      prev.forEach((p, i) => {
        if (!sets[i] || !h.sets[i] || p.r == null || stalled[i]) return;
        const pr = effReps(p), base = h.sets[i].rule, rule = pr >= hi ? 'up' : pr < lo ? 'down' : 'hold', was = sets[i].w;
        const seen = p.q != null && p.q !== TARGET ? p.r + ' ' + plural(p.r, ['повтор', 'повтора', 'повторов']) + ' с запасом ' + p.q : null;
        if (rule === 'up') {
          const extra = p.w > 0 && pr >= hi + 2 ? Math.floor(((pr - hi) * 0.025 * p.w) / step) : 0;
          if (base === 'up' && extra < 1) return;
          const nw = +(p.w + (1 + extra) * step).toFixed(3);
          sets[i] = { w: nw, tg: [lo, hi] };
          notes.push('подход ' + (i + 1) + ': ' + (extra >= 1 ? 'сразу ' : '') + fmt(nw) + ' кг вместо ' + fmt(was) + ' — в прошлый раз ' + (seen || p.r + ' повторов при верхней границе ' + hi));
          tag('Недогруз');
        } else if (rule !== base && rule === 'hold') {
          sets[i] = { w: p.w, tg: [Math.min(hi, Math.max(lo, pr + 1)), hi] };
          notes.push('подход ' + (i + 1) + ': остаётся ' + fmt(p.w) + ' кг вместо ' + fmt(was) + ' — ' + (p.q === 0 ? p.r + ' повторов получились только в отказ' : 'в прошлый раз ' + seen + ', до нижней границы хватало'));
          tag(p.q === 0 ? 'Отказ' : 'Недогруз');
        } else if (rule !== base && rule === 'down') {
          const nw = Math.max(0, +(p.w - step).toFixed(3));
          sets[i] = { w: nw, tg: [lo, hi] };
          notes.push('подход ' + (i + 1) + ': ' + fmt(p.w) + ' → ' + fmt(nw) + ' кг — ' + p.r + ' повторов получились только в отказ');
          tag('Отказ');
        }
      });
      /* weekly volume of the main muscle: one more set below the working zone, one less above it */
      for (const [m, c] of Object.entries(ex.m || {})) {
        if (c < 1) continue;
        if ((dayV[m] || 0) > caps.day + 0.01 && sets.length > 2 && !used['day-' + m]) {
          sets.pop();
          notes.push('−1 подход: ' + MUSCLE[m].n.toLowerCase() + ' в этот день — ' + nSets(+dayV[m].toFixed(1)) + ' при твоём лимите ' + caps.day + ' на мышцу за тренировку');
          used['day-' + m] = true; tag('Лимит на день');
          break;
        }
        if (short[m] != null && sets.length < 5 && s && s.status === 'up' && (!used[m] || ex.uni) && room >= (ex.uni ? 0.5 : 1) - 0.01 && fitsDay(ex, 1)) {
          room -= ex.uni ? 0.5 : 1;
          const l = sets[sets.length - 1];
          sets.push({ w: l.w, tg: [lo, hi] });
          notes.push('+1 подход: ' + MUSCLE[m].n.toLowerCase() + ' по программе — ' + nSets(+short[m].toFixed(1)) + ' в неделю, рабочая зона от ' + z.opt);
          used[m] = true; tag('Мало объёма');
          break;
        }
        if (over[m] != null && sets.length > 2 && !used['-' + m]) {
          sets.pop();
          notes.push('−1 подход: ' + MUSCLE[m].n.toLowerCase() + ' по программе — ' + nSets(+over[m].toFixed(1)) + ' в неделю, выше ' + z.high + ' отдача мала');
          used['-' + m] = true; tag('Лишний объём');
          break;
        }
      }
      if (notes.length) push(tags.join(' · '), notes, sets);
    });

    const adds = deload ? [] : (additions(past, cfg, pl)[slot] || []).filter(d => { const e = d.def || cfg.ex[d.exId] || {}; if (room < d.sets - 0.01 || !fitsDay(e, d.sets)) return false; room -= d.sets; return true; });
    for (const d of adds) if (cfg.ex[d.exId] && !lastSessionItem(past, d.exId, null, null)) d.w = startWeight(past, cfg, d.exId, d.range);   // a named weight for an exercise new to the journal
    /* what is switched on by default: every change of weight, at most two extra sets and one new exercise per workout */
    const off0 = {};
    /* a programme built around one lift stays lean: extra sets and new exercises are offered, not switched on */
    const lean = !!(cfg.program && (cfg.program.focus || cfg.program.lean));
    let extra = 0;
    for (const p of props) {
      const d = (p.sets.length - base.items[p.idx].sets.length) * ((cfg.ex[p.ex] || {}).uni ? 0.5 : 1);
      if (d > 0) { if (lean || extra + d > 2) off0[p.key] = true; else extra += d; }
    }
    adds.slice().sort((a, b) => a.a.prio - b.a.prio).forEach((d, i) => { if (i > 0 || lean) off0[d.key] = true; });
    return { base, props, adds, off0, deload, worse: worse.length, of: dps.length };
  }

  /* the plan with the chosen proposals applied; `off` holds the keys the athlete unticked */
  function applyAdapt(a, off) {
    off = off || {};
    const items = clone(a.base.items), create = {}, used = [];
    for (const p of a.props) {
      if (off[p.key] || !items[p.idx]) continue;
      items[p.idx].sets = p.sets.map(x => ({ w: x.w, r: null }));
      if (p.cyc) { items[p.idx].cyc = { pct: p.cyc.pct, reps: p.cyc.reps }; items[p.idx].tm = null; }
      if (p.range) items[p.idx].range = p.range.slice();
      used.push(p.key);
    }
    for (const d of a.adds) {
      if (off[d.key]) continue;
      if (d.def) create[d.exId] = d.def;
      items.push({ ex: d.exId, cyc: null, range: d.range.slice(), sets: Array.from({ length: d.sets }, () => ({ w: d.w == null ? null : d.w, r: null })), note: '', skip: false, rir: null });
      used.push(d.key);
    }
    return { items, create, used };
  }

  /* ---------- a new programme: the current one rebuilt around one priority ---------- */
  /* the range the next plan of a double-progression exercise ends up with (its goal may move it) */
  function rangeOf(workouts, cfg, exId) {
    const p = lastSessionItem(workouts.filter(w => !w.open), exId, null, null), ex = cfg.ex[exId] || {}, g = goalOf(cfg, exId);
    const cur = (p && p.it.range) || [ex.lo || 8, ex.hi || 12];
    if (g && GOALS[g].lo) {
      const top = p ? p.it.sets.reduce((m, x) => Math.max(m, x.w || 0), 0) : 0, R = goalRange(g, top, stepOf(workouts, cfg, exId));
      if (R[0] !== cur[0]) return R;
    }
    return cur;
  }
  function currentSlots(workouts, cfg) {
    const pl = planned(workouts.filter(w => !w.open), cfg), out = {};
    for (const sl of SLOTS) {
      const w = pl.t[sl.id];
      out[sl.id] = !w ? [] : w.items.filter(it => cfg.ex[it.ex]).map(it => {
        const e = { ex: it.ex };
        if (!isCycle(cfg, it.ex) && !isLight(cfg, it.ex)) e.n = it.sets ? it.sets.filter(x => !x.warm).length : (+it.n || 3);
        return e;
      });
    }
    return out;
  }
  const wrapSlots = slots => Object.fromEntries(SLOTS.map(sl => [sl.id, { items: slots[sl.id] || [] }]));
  const progTally = (cfg, slots) => tally(cfg, wrapSlots(slots));
  const ON_DAY = { mon: 'в понедельник', wed: 'в среду', fri: 'в пятницу' };

  /* muscle priorities a programme can be built around */
  const PRIOS = [
    { id: 'legs', n: 'Ноги и ягодицы', m: ['quads', 'hams', 'glutes'] },
    { id: 'glutes', n: 'Ягодицы', m: ['glutes'] },
    { id: 'upper', n: 'Верх тела', m: ['chest', 'lats', 'upper_back', 'delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps'] },
    { id: 'back', n: 'Спина', m: ['lats', 'upper_back', 'delt_rear'] },
    { id: 'chest', n: 'Грудь и плечи', m: ['chest', 'delt_front', 'delt_mid'] },
    { id: 'arms', n: 'Руки', m: ['biceps', 'triceps'] }
  ];
  /* a stock exercise for every muscle, used when the athlete's own list has nothing for it */
  const addDef = k => ADDS.find(a => a.key === k).def;
  const LIB = [
    { id: 'x_press', def: { n: 'Жим в тренажере на грудь', pat: 'h_push', m: { chest: 1, delt_front: 0.5, triceps: 0.5 } } },
    { id: 'x_pulldown', def: { n: 'Вертикальная тяга в тренажере', pat: 'v_pull', m: { lats: 1, upper_back: 0.5, biceps: 0.5 } } },
    { id: 'x_pullover', def: { n: 'Пуловер на верхнем блоке', pat: 'iso', m: { lats: 1 }, lo: 10, hi: 15 } },
    { id: 'x_row', def: { n: 'Горизонтальная тяга в тренажере', pat: 'h_pull', m: { upper_back: 1, lats: 0.5, delt_rear: 0.5, biceps: 0.5 } } },
    { id: 'x_ohp', def: addDef('ohp') },
    { id: 'x_raise', def: { n: 'Махи в стороны', pat: 'iso', m: { delt_mid: 1 }, lo: 10, hi: 20 } },
    { id: 'x_rear', def: addDef('rear') },
    { id: 'x_curl', def: { n: 'Сгибания на бицепс', pat: 'iso', m: { biceps: 1 } } },
    { id: 'x_pushdown', def: { n: 'Разгибания на трицепс на блоке', pat: 'iso', m: { triceps: 1 } } },
    { id: 'x_wrist', def: { n: 'Сгибания кисти', pat: 'iso', m: { forearms: 1 } } },
    { id: 'x_abs', def: addDef('abs') },
    { id: 'x_rdl', def: addDef('rdl') },
    { id: 'x_backext', def: { n: 'Гиперэкстензия', pat: 'hinge', m: { erectors: 1, glutes: 0.5, hams: 0.5 }, lo: 10, hi: 15 } },
    { id: 'x_legext', def: { n: 'Разгибания ног', pat: 'iso', m: { quads: 1 }, lo: 10, hi: 15 } },
    { id: 'x_legcurl', def: { n: 'Сгибания ног', pat: 'iso', m: { hams: 1 }, lo: 10, hi: 15 } },
    { id: 'x_thrust', def: { n: 'Ягодичный мост', pat: 'hinge', m: { glutes: 1, hams: 0.5 } } },
    { id: 'x_calf', def: addDef('calf') }
  ];

  /* Other exercises for the same place in a day. `same` — the main muscles are the same (an exact match of the whole muscle map first);
     `near` — at least one main muscle is shared. Percentage lifts and light days are not offered, a one-sided exercise changes
     for a one-sided one only, and a stock exercise is offered when the athlete's list has nothing with its muscles. */
  function swapsFor(cfg, id, skip) {
    const out = { same: [], near: [] }, e = cfg.ex[id];
    if (!e) return out;
    const mainOf = m => Object.keys(m || {}).filter(k => m[k] >= 1).sort(), key = m => JSON.stringify(Object.entries(m || {}).filter(x => x[1] > 0).sort());
    const dp = x => { const k = kindOf(cfg, x); return k === 'compound' || k === 'iso'; };
    const mine = mainOf(e.m), own = Object.keys(cfg.ex).filter(dp);
    const side = n => /(^|\s)лев/i.test(n) ? 'l' : /(^|\s)прав/i.test(n) ? 'r' : '';                 // the left wrist is not changed for the right one
    if (!mine.length || !dp(id)) return out;
    const pool = own.map(x => ({ id: x, n: cfg.ex[x].n, m: cfg.ex[x].m || {}, uni: !!cfg.ex[x].uni }))
      .concat(LIB.filter(L => !cfg.ex[L.id] && !own.some(x => key(cfg.ex[x].m) === key(L.def.m))).map(L => ({ id: L.id, n: L.def.n, m: L.def.m, uni: !!L.def.uni, def: L.def })));
    for (const c of pool) {
      if (c.id === id || (skip || []).includes(c.id) || c.uni !== !!e.uni || (side(c.n) && side(e.n) && side(c.n) !== side(e.n))) continue;
      const cm = mainOf(c.m), shared = cm.filter(x => mine.includes(x)).length;
      if (!shared) continue;
      /* how alike two muscle maps are: what they share over what they cover together */
      const ks = [...new Set(Object.keys(c.m).concat(Object.keys(e.m || {})))], like = ks.reduce((a, k) => a + Math.min(c.m[k] || 0, e.m[k] || 0), 0) / (ks.reduce((a, k) => a + Math.max(c.m[k] || 0, e.m[k] || 0), 0) || 1);
      if (shared === mine.length && cm.length === mine.length) out.same.push(Object.assign(c, { exact: key(c.m) === key(e.m), like }));
      else out.near.push(Object.assign(c, { shared, main: cm, like }));
    }
    const byName = (a, b) => a.n.localeCompare(b.n, 'ru');
    out.same.sort((a, b) => (b.exact - a.exact) || (b.like - a.like) || byName(a, b));
    out.near.sort((a, b) => (b.like - a.like) || byName(a, b));
    return out;
  }

  /* Fit a week to the limits and to one common level.
     Every muscle in the goal aims at `o.level` sets a week, a priority muscle at PRIO_K times that; nobody rises more than two sets above its aim.
     First the limits (a day, the week), then a local search: a shortfall costs more than an excess, so the muscles that got much more than the rest lose sets
     and the ones that lag get them. `noFill` stops after the limits. Percentage lifts are never touched. */
  const PRIO_K = 1.5;
  function optimise(c2, slots, o, define) {
    const z = o.z, ign = o.ignore || {}, prio = o.prio || {}, lvl = o.level != null ? o.level : z.opt;
    const tgt = m => ign[m] ? 0 : prio[m] ? Math.min(z.high - 2, Math.round(lvl * PRIO_K)) : lvl, top = m => tgt(m) + 2;
    const used = SLOTS.filter(sl => slots[sl.id].length), days = used.length ? used : SLOTS.slice();
    const dayMax = Math.ceil(o.budget / days.length) + 2, cut = [];
    const info = id => c2.ex[id] || (LIB.find(L => L.id === id) || {}).def || { m: {} };
    const mOf = id => info(id).m || {};
    const uniF = id => info(id).uni ? 0.5 : 1;
    const isDp = id => { const k = kindOf(c2, id); return k === 'compound' || k === 'iso'; };
    const now = () => progTally(c2, slots);
    const total = T => SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0);
    const sibling = (L, e) => info(e.ex).uni ? L.find(x => x !== e && info(x.ex).uni && x.n === e.n && JSON.stringify(mOf(x.ex)) === JSON.stringify(mOf(e.ex))) || null : null;
    const step = (L, e, k) => { const sb = sibling(L, e); e.n += k; e.chg = (e.chg || 0) + k; if (sb) { sb.n += k; sb.chg = (sb.chg || 0) + k; } };
    const weight = L => L.reduce((a, e) => a + (info(e.ex).uni ? 0.5 : 1), 0);
    /* an exercise only for muscles left out of the count is the athlete's own business: its sets are in the week, but the search leaves it alone */
    const byHand = id => { const ms = Object.entries(mOf(id)).filter(x => x[1] > 0); return ms.length > 0 && ms.every(x => ign[x[0]]); };
    /* how much of an exercise goes to muscles left out of the count: the search prefers a cleaner choice,
       and never brings in a new exercise where such a muscle is a main mover — that would be giving it sets after all */
    const aside = id => Object.entries(mOf(id)).reduce((a, x) => a + (ign[x[0]] ? x[1] : 0), 0);
    const mainOff = id => Object.entries(mOf(id)).some(x => x[1] >= 1 && ign[x[0]]);

    /* frequency: a day trains a muscle when it gives it two sets or more (indirect work counts in halves, as everywhere);
       with two or more training days a muscle whose weekly aim allows it should have two such days, not one big one */
    const FQ = { sets: 2, days: 2, pen: 4, slack: 0.5 };
    const twice = m => !ign[m] && days.length >= FQ.days && tgt(m) >= FQ.sets * FQ.days;
    const trainedDays = (m, dOf) => SLOTS.filter(sl => dOf(sl.id, m) >= FQ.sets - 0.01).length;
    const thinOf = dOf => MUSCLES.filter(m => twice(m.id) && trainedDays(m.id, dOf) < FQ.days).map(m => m.id);
    const miss = dOf => MUSCLES.reduce((a, m) => a + (twice(m.id) ? Math.max(0, FQ.days - trainedDays(m.id, dOf)) : 0), 0);

    /* 0a. no muscle above the daily limit */
    for (let g = 0; g < 200; g++) {
      const T = now();
      let hit = null;
      for (const sl of SLOTS) { for (const m of MUSCLES) if ((T.day[sl.id][m.id] || 0) > o.dayCap + 0.01) { hit = { sl, m: m.id }; break; } if (hit) break; }
      if (!hit) break;
      const e = slots[hit.sl.id].filter(x => x.n > 1 && mOf(x.ex)[hit.m] > 0).sort((a, b) => (mOf(b.ex)[hit.m] - mOf(a.ex)[hit.m]) || (b.n - a.n))[0];
      if (!e) break;
      step(slots[hit.sl.id], e, -1);
    }
    /* 0b. the week within the budget: sets go first from where a muscle is furthest above its target, priority muscles last */
    for (let g = 0; g < 400 && total(now()) > o.budget + 0.01; g++) {
      const T = now();
      let best = null;
      const spare = e => Math.min(...Object.entries(mOf(e.ex)).filter(x => x[1] > 0).map(([m, c]) => ign[m] ? 99 : (T.pv[m] || 0) - c * uniF(e.ex) - tgt(m) - (prio[m] ? 3 : 0)));
      for (const sl of SLOTS) for (const e of slots[sl.id]) { if (!e.n || e.n <= 2 || byHand(e.ex)) continue; const sc = spare(e) + 0.05 * T.load[sl.id]; if (!best || sc > best.sc) best = { sc, sl, e }; }
      if (best) { step(slots[best.sl.id], best.e, -1); continue; }
      for (const sl of SLOTS) for (const e of slots[sl.id]) { if (!e.n || byHand(e.ex) || e.pin) continue; const sc = spare(e) + 0.05 * T.load[sl.id]; if (!best || sc > best.sc) best = { sc, sl, e }; }
      if (!best) break;
      const L = slots[best.sl.id], sb = sibling(L, best.e);
      for (const x of [best.e, sb]) if (x) { L.splice(L.indexOf(x), 1); cut.push({ ex: x.ex, sl: best.sl }); }
    }
    if (o.noFill) return { left: [], cut, once: [], hit: null };
    /* a local search. A shortfall below the aim costs six times more than an excess above aim + 2.
       One step changes one exercise; when a day or the week is full, two at once: a set or an exercise goes and another comes. */
    {
      const sameM = (a, b) => JSON.stringify(Object.entries(a).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b).filter(x => x[1] > 0).sort());
      const lim = id => info(id).pat === 'iso' ? 3 : 2;
      const cost = pv => MUSCLES.reduce((a, m) => { if (ign[m.id]) return a; const v = pv[m.id] || 0, d = tgt(m.id) - v, u = v - top(m.id); return a + (d > 0.25 ? 3 * d * d : 0) + (u > 0.01 ? 0.5 * u * u : 0); }, 0);
      /* two passes: first the volumes alone, to their balance; then the second training day for the muscles that have one,
         with steps that leave that balance as it is */
      let fq = false;
      for (let g = 0; g < 360; g++) {
        const T = now(), tot = total(T), dNow = (d, m) => T.day[d][m] || 0, vol0 = cost(T.pv), base = vol0 + (fq ? FQ.pen * miss(dNow) : 0);
        if (base < 0.01) { if (fq) break; fq = true; continue; }
        const pool = Object.keys(c2.ex).filter(id => isDp(id) && !c2.ex[id].uni).concat(LIB.filter(L => !c2.ex[L.id] && !L.def.uni && !Object.keys(c2.ex).some(id => isDp(id) && sameM(mOf(id), L.def.m))).map(L => L.id));
        const nDays = id => SLOTS.filter(x => slots[x.id].some(e => e.ex === id)).length;
        /* a step up is worth trying only for a muscle that is short, a step down alone only for one that is above the top */
        const short = {}, above = {};
        for (const m of MUSCLES) { if (ign[m.id]) continue; const v = T.pv[m.id] || 0; if (tgt(m.id) - v > 0.25) short[m.id] = 1; if (v - top(m.id) > 0.01) above[m.id] = 1; }
        const hits = (id, set) => Object.entries(mOf(id)).some(([m, c]) => c > 0 && set[m]);
        /* a muscle with one training day: work for it is worth trying on a day that does not train it yet */
        const thin = {}; if (fq) for (const m of thinOf(dNow)) thin[m] = 1;
        const fills = (id, sl) => Object.entries(mOf(id)).some(([m, c]) => c > 0 && thin[m] && dNow(sl.id, m) < FQ.sets - 0.01);
        const less = [], more = [];
        for (const sl of days) {
          const L = slots[sl.id], seen = [];
          for (const e of L) {
            if (!e.n || !isDp(e.ex) || seen.includes(e) || byHand(e.ex)) continue;
            const sb = sibling(L, e);
            if (info(e.ex).uni && !sb) continue;
            if (sb) seen.push(sb);
            const a = { sl, e, id: e.ex, f: uniF(e.ex) * (sb ? 2 : 1) };
            if (e.n < 5 && (hits(e.ex, short) || fills(e.ex, sl))) more.push(Object.assign({ dn: 1, dw: 0, pen: (e.n >= 4 ? 0.3 : 0) + 0.5 * aside(e.ex) }, a));
            if (e.n > 2) less.push(Object.assign({ dn: -1, dw: 0, pen: 0 }, a));
            if (e.n > 3) less.push(Object.assign({ dn: -2, dw: 0, pen: 0 }, a));       // two sets at once: they can move to another day as a new exercise
            if (!e.pin) less.push(Object.assign({ dn: -e.n, dw: -1, pen: e.isNew ? 0.1 : 0.8, drop: true }, a));     // an exercise the build put on its day for a reason stays there
          }
          for (const id of pool) if ((hits(id, short) || fills(id, sl)) && !mainOff(id) && !L.some(e => e.ex === id) && !cut.some(c => c.ex === id && c.sl === sl)) more.push({ sl, e: null, id, f: uniF(id), dn: 2, dw: 1, pen: (c2.ex[id] ? 0.4 : 0.5) + 0.3 * aside(id), add: true });
        }
        const rate = list => {
          const dt = list.reduce((a, x) => a + x.dn * x.f, 0);
          if (dt > 0.01 && tot + dt > o.budget + 0.01) return null;
          const pv = Object.assign({}, T.pv), dayM = {}, load = {}, wt = {};
          for (const a of list) {
            const k = a.dn * a.f, d = a.sl.id;
            load[d] = (load[d] || 0) + k; wt[d] = (wt[d] || 0) + a.dw; dayM[d] = dayM[d] || {};
            for (const [m, c] of Object.entries(mOf(a.id))) if (c > 0) { pv[m] = (pv[m] || 0) + c * k; dayM[d][m] = (dayM[d][m] || 0) + c * k; }
          }
          for (const d of Object.keys(load)) {
            if (load[d] > 0.01 && T.load[d] + load[d] > dayMax + 0.01) return null;
            if (wt[d] > 0 && weight(slots[d]) + wt[d] > 9.6) return null;
            for (const [m, v] of Object.entries(dayM[d])) if (v > 0.01 && (T.day[d][m] || 0) + v > o.dayCap + 0.01) return null;
          }
          for (const a of list) if (a.add && nDays(a.id) - list.filter(x => x.drop && x.id === a.id).length + 1 > lim(a.id)) return null;
          for (const m of Object.keys(pv)) if (!ign[m] && pv[m] > (T.pv[m] || 0) + 0.01 && pv[m] > z.high + 0.01) return null;
          /* a second day is not bought with the balance of the week: a step that the volumes themselves do not pay for
             may not lift any muscle above its top, nor leave one short */
          const vol = cost(pv);
          if (vol > vol0 - 0.01) {
            if (vol > vol0 + FQ.slack) return null;
            for (const m of Object.keys(pv)) if (!ign[m] && pv[m] > (T.pv[m] || 0) + 0.01 && pv[m] > top(m) + 0.01) return null;
          }
          return base - vol - (fq ? FQ.pen * miss((d, m) => (T.day[d][m] || 0) + ((dayM[d] || {})[m] || 0)) : 0) - list.reduce((a, x) => a + x.pen, 0) - 0.002 * dt;
        };
        let best = null;
        const take = list => { const sc = rate(list); if (sc != null && sc > 0.15 && (!best || sc > best.sc)) best = { sc, list }; };
        for (const a of more) take([a]);
        for (const a of less) if (hits(a.id, above)) take([a]);
        if (!best) for (const a of less) for (const b of more) if (a.e !== b.e) take([a, b]);
        /* the second pass may also carry an exercise over to another day as it is: the week's volumes stay, the days change */
        if (fq) for (const sl of days) for (const e of slots[sl.id]) {
          if (!e.n || !isDp(e.ex) || byHand(e.ex) || e.pin || info(e.ex).uni || !hits(e.ex, thin)) continue;
          for (const to of days) if (to !== sl && !slots[to.id].some(x => x.ex === e.ex) && !cut.some(c => c.ex === e.ex && c.sl === to))
            take([{ sl, e, id: e.ex, f: 1, dn: -e.n, dw: -1, pen: 0.3, drop: true, to }, { sl: to, e: null, id: e.ex, f: 1, dn: e.n, dw: 1, pen: 0, add: true, n: e.n, from: sl }]);
        }
        if (!best) { if (fq) break; fq = true; continue; }
        for (const a of best.list) {
          const L = slots[a.sl.id];
          if (a.add) {
            if (!c2.ex[a.id]) define(a.id, clone((LIB.find(x => x.id === a.id) || {}).def));
            const e = { ex: a.id, n: a.n || 2, isNew: true };
            if (a.from) e.from = a.from.id;                               // carried over from another day, not new to the programme
            if (kindOf(c2, a.id) === 'iso') L.push(e);
            else { let i = 0; L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light' || k === 'compound') i = j + 1; }); L.splice(i, 0, e); }
          } else if (a.drop) { for (const x of [a.e, sibling(L, a.e)]) if (x) { L.splice(L.indexOf(x), 1); if (!x.isNew || x.from) cut.push({ ex: x.ex, sl: a.sl, to: a.to ? a.to.id : null }); } }
          else step(L, a.e, a.dn);
        }
      }
      /* half a set short still counts as level: indirect work comes in halves */
      const T = now(), left = MUSCLES.filter(m => !ign[m.id] && (T.pv[m.id] || 0) < tgt(m.id) - 0.75).map(m => m.id);
      const over = MUSCLES.filter(m => !ign[m.id] && (T.pv[m.id] || 0) > top(m.id) + 1.25).map(m => m.id);
      return { left, over, cut, once: thinOf((d, m) => T.day[d][m] || 0), hit: left.length ? (total(T) >= o.budget - 1.5 ? 'budget' : 'full') : null };
    }

  }

  /* One step for one muscle in a draft programme: dir +1 adds a set (or a two-set exercise when nothing fits), -1 takes one away.
     o: { z, ignore, budget, dayCap }. Returns { ok, text } and changes `slots` in place. */
  function nudgeMuscle(c2, slots, m, dir, o, define) {
    const info = id => c2.ex[id] || (LIB.find(L => L.id === id) || {}).def || { m: {} }, mOf = id => info(id).m || {}, uniF = id => info(id).uni ? 0.5 : 1;
    const T = progTally(c2, slots), tot = SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0), ign = o.ignore || {};
    const pair = (L, e) => info(e.ex).uni ? L.find(x => x !== e && info(x.ex).uni && x.n === e.n && JSON.stringify(mOf(x.ex)) === JSON.stringify(mOf(e.ex))) || null : null;
    const label = (id, sl, sb) => exName(c2, id) + (sb ? ' и ' + exName(c2, sb.ex) : '') + ' (' + sl.s.toLowerCase() + ')';
    if (dir < 0) {
      let best = null;
      for (const sl of SLOTS) for (const e of slots[sl.id]) {
        const c = mOf(e.ex)[m] || 0;
        if (!e.n || c <= 0) continue;
        /* the purest exercise for this muscle first: the neighbours should lose as little as possible, least of all those not yet in the working zone */
        const others = Object.entries(mOf(e.ex)).filter(([x, v]) => x !== m && v > 0 && !ign[x]);
        const side = others.reduce((a, x) => a + x[1], 0), harm = others.filter(([x, v]) => (T.pv[x] || 0) - v * uniF(e.ex) < o.z.opt).reduce((a, x) => a + x[1], 0);
        const sc = c * 3 - 0.5 * side - 0.5 * harm + 0.05 * e.n + 0.01 * T.load[sl.id];
        if (!best || sc > best.sc) best = { sc, sl, e };
      }
      if (!best) return { ok: false, text: SLOTS.some(sl => slots[sl.id].some(e => !e.n && (mOf(e.ex)[m] || 0) > 0)) ? 'Эту мышцу нагружают только упражнения по процентам: число подходов в них задаёт волна' : 'В программе нет упражнений на эту мышцу' };
      const L = slots[best.sl.id], sb = pair(L, best.e);
      if (best.e.n <= 1) { for (const x of [best.e, sb]) if (x) L.splice(L.indexOf(x), 1); return { ok: true, text: 'Убрано: ' + label(best.e.ex, best.sl, sb) }; }
      for (const x of [best.e, sb]) if (x) { x.n--; x.chg = (x.chg || 0) - 1; }
      return { ok: true, text: '−1 подход: ' + label(best.e.ex, best.sl, sb) };
    }
    const sameM = (a, b) => JSON.stringify(Object.entries(a).filter(x => x[1] > 0).sort()) === JSON.stringify(Object.entries(b).filter(x => x[1] > 0).sort());
    const isDp = id => { const k = kindOf(c2, id); return k === 'compound' || k === 'iso'; };
    const days = SLOTS.filter(sl => slots[sl.id].length).length ? SLOTS.filter(sl => slots[sl.id].length) : SLOTS.slice();
    const pool = Object.keys(c2.ex).filter(id => isDp(id) && !c2.ex[id].uni).concat(LIB.filter(L => !c2.ex[L.id] && !Object.keys(c2.ex).some(id => isDp(id) && sameM(mOf(id), L.def.m))).map(L => L.id));
    let best = null, why = '', full = 0;                              // full: 1 — the week is full, 2 — one set is free but a new exercise takes two
    const rate = (sl, id, sets, isAdd) => {
      const c = mOf(id)[m] || 0, cost = sets * uniF(id), ms = Object.entries(mOf(id)).filter(x => x[1] > 0);
      if (c < (isAdd ? 1 : 0.5)) return;
      if (tot + cost > o.budget + 0.01) { full = Math.max(full, tot + 1 <= o.budget + 0.01 ? 2 : 1); return; }
      if (ms.some(([x, v]) => (T.day[sl.id][x] || 0) + v * cost > o.dayCap + 0.01)) { why = why || 'мешает лимит ' + o.dayCap + ' подходов на мышцу за тренировку'; return; }
      if (ms.some(([x, v]) => !ign[x] && x !== m && (T.pv[x] || 0) + v * cost > o.z.high + 0.01)) { why = why || 'соседние мышцы уже у верха рабочей зоны'; return; }
      /* the purest exercise first, so the neighbours gain as little as possible; a new exercise only when the ones in the programme do not fit */
      const others = ms.filter(([x]) => x !== m), side = others.reduce((a, x) => a + x[1], 0), over = others.filter(([x]) => !ign[x] && (T.pv[x] || 0) >= o.z.opt).reduce((a, x) => a + x[1], 0);
      const sc = c * 2 - 0.3 * side - 0.3 * over - 0.012 * T.load[sl.id] - (isAdd ? 0.8 + 0.04 * slots[sl.id].length : 0);
      if (!best || sc > best.sc) best = { sc, sl, id, isAdd };
    };
    for (const sl of days) {
      const L = slots[sl.id];
      for (const e of L) { if (!e.n || e.n >= 5 || !isDp(e.ex)) continue; if (info(e.ex).uni && !pair(L, e)) continue; rate(sl, e.ex, info(e.ex).uni ? 2 : 1, false); }
      /* a new exercise goes where the day is shorter; the athlete asked for it, so a long day is no reason to refuse */
      for (const id of pool) { if (L.some(e => e.ex === id)) continue; rate(sl, id, 2, true); }
    }
    if (!best) return { ok: false, text: full === 2 ? 'Свободен один подход, а новому упражнению нужно два: убавь ещё подход у другой мышцы'
      : full ? 'Свободных подходов нет: все ' + o.budget + ' в неделю распределены. Сначала убавь другой мышце кнопкой «−»'
      : 'Добавить некуда: ' + (why || 'в днях нет места, а в подходящих упражнениях уже по пять подходов') };
    const L = slots[best.sl.id];
    if (best.isAdd) {
      if (!c2.ex[best.id]) define(best.id, clone((LIB.find(x => x.id === best.id) || {}).def));
      const e = { ex: best.id, n: 2, isNew: true };
      if (kindOf(c2, best.id) === 'iso') L.push(e); else { let i = 0; L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light' || k === 'compound') i = j + 1; }); L.splice(i, 0, e); }
      return { ok: true, text: 'Новое упражнение: ' + label(best.id, best.sl) + ', 2 подхода' };
    }
    const e = L.find(x => x.ex === best.id), sb = pair(L, e);
    for (const x of [e, sb]) if (x) { x.n++; x.chg = (x.chg || 0) + 1; }
    return { ok: true, text: '+1 подход: ' + label(best.id, best.sl, sb) };
  }

  function buildProgram(workouts, cfg, opts) {
    opts = opts || {};
    const done = workouts.filter(w => !w.open), z = cfg.zones;
    const focus = opts.focus && isCycle(cfg, opts.focus) ? opts.focus : null, hold = !!focus && opts.others !== 'grow';
    const group = !focus && PRIOS.find(g => g.id === opts.prio) || null, caps = cfg.caps;
    const budget = Math.max(10, Math.min(caps.week, +opts.budget > 0 ? +opts.budget : caps.week));
    const cur = currentSlots(done, cfg), before = progTally(cfg, cur);
    /* by hand: the programme as it stands, to be edited in the page */
    if (opts.manual) return { manual: true, focus: null, others: null, name: (cfg.program && cfg.program.name) || 'Своя программа', slots: clone(cur), cur, goals: {}, create: {}, notes: [], cfg: clone(cfg), before, after: before, same: true };
    const c2 = clone(cfg), slots = clone(cur), goals = {}, create = {}, notes = [];
    const note = (t, x) => notes.push({ t, x });
    const all = () => SLOTS.flatMap(sl => slots[sl.id]);
    const inProg = id => all().some(e => e.ex === id);
    const now = () => progTally(c2, slots);
    const nm = id => exName(c2, id);
    const mOf = id => (c2.ex[id] || {}).m || {};
    const setGoal = (id, g) => { goals[id] = g || null; if (g) c2.ex[id].goal = g; else delete c2.ex[id].goal; };
    const define = (id, def) => { create[id] = def; c2.ex[id] = placed(c2, Object.assign({ n: id }, def)); };
    /* a day for a new exercise: no heavy work for the same muscles that day, at most one new exercise a day, the shortest day first */
    const pickDay = (def, skip) => {
      const T = now();
      const clash = sl => slots[sl.id].some(e => kindOf(c2, e.ex) !== 'iso' && Object.entries(def.m).some(([m, c]) => c >= 1 && mOf(e.ex)[m] > 0)) ? 1 : 0;
      const days = SLOTS.filter(sl => slots[sl.id].length && !(skip && skip(sl)) && !slots[sl.id].some(e => e.isNew && !isLight(c2, e.ex)));
      days.sort((a, b) => (clash(a) - clash(b)) || (T.load[a.id] - T.load[b.id]));
      return days[0] || null;
    };
    /* his own order: the percentage lifts first, then the rest; a new multi-joint exercise goes right after them, an isolation one to the end */
    const insert = (sl, e) => {
      const L = slots[sl.id];
      if (kindOf(c2, e.ex) === 'iso') { L.push(e); return; }
      let i = 0;
      L.forEach((x, j) => { const k = kindOf(c2, x.ex); if (k === 'base' || k === 'light') i = j + 1; });
      L.splice(i || Math.min(1, L.length), 0, e);
    };
    const existing = a => {
      for (let i = done.length - 1; i >= 0; i--) for (const it of done[i].items) if (a.cover(cfg.ex[it.ex])) return it.ex;
      return Object.keys(cfg.ex).find(id => a.cover(cfg.ex[id])) || null;
    };

    /* 1. a light day belongs to the priority lift only */
    for (const sl of SLOTS) slots[sl.id] = slots[sl.id].filter(e => {
      if (!isLight(cfg, e.ex) || (focus && cfg.ex[e.ex].of === focus)) return true;
      note('Убрано: ' + nm(e.ex), 'Лёгкий день нужен только упражнению в приоритете.');
      return false;
    });

    /* 2. the percentage lifts: priority, maintenance or the usual wave */
    const lifts = Object.keys(cfg.ex).filter(id => isCycle(cfg, id) && inProg(id)), held = [], back = [];
    for (const id of lifts) {
      /* the lift in priority goes by reserve; the others hold, or keep what they do. A lift the athlete put on «сила по запасу» himself stays on it */
      const was = goalOf(cfg, id), want = id === focus ? 'auto' : hold ? 'hold' : was === 'auto' ? 'auto' : null;
      setGoal(id, want);
      if (want === 'hold' && was !== 'hold') held.push(id);
      if (!want && was) back.push(id);
    }
    if (focus && inProg(focus)) {
      if (goalOf(cfg, focus) !== 'auto') note(nm(focus) + ' — сила по запасу', AUTO.sets + ' × ' + AUTO.reps + ' одним весом, первый вес — ' + AUTO.pct + '% от расчётного максимума. Дальше решает запас в последнем подходе: ' + AUTO.aim + ' повтора и больше — на следующей неделе плюс шаг, 1 — вес тот же, 0 или подходы не закрыты — минус ' + AUTO.down + '%. Запас отмечается в карточке упражнения.');
      const lid = focus + '_light', home = SLOTS.find(sl => slots[sl.id].some(e => e.ex === focus));
      const at = slots[home.id].findIndex(e => e.ex === focus);
      if (at > 0) { slots[home.id].unshift(slots[home.id].splice(at, 1)[0]); note(nm(focus) + ' — первым упражнением ' + ON_DAY[home.id], 'Приоритетное упражнение делается на свежие силы, до всего остального.'); }
      /* 3. a second, light day for the priority lift */
      if (!inProg(lid)) {
        const T = now(), gap = sl => { const d = Math.abs(sl.dow - home.dow); return Math.min(d, 7 - d); };
        const day = SLOTS.filter(sl => sl !== home && slots[sl.id].length).sort((a, b) => (gap(b) - gap(a)) || (T.load[a.id] - T.load[b.id]))[0];
        if (day) {
          const par = cfg.ex[focus];
          if (!cfg.ex[lid]) define(lid, { n: par.n + ' — лёгкий день', mode: 'light', of: focus, pat: par.pat || 'iso', m: clone(par.m || {}) });
          slots[day.id].unshift({ ex: lid, isNew: true });
          note('Второй день ' + ON_DAY[day.id] + ': ' + nm(lid), LIGHT_A.sets + ' × ' + LIGHT_A.reps + ' на ' + LIGHT_A.pct + '% от расчётного максимума, в запасе около ' + estRir(LIGHT_A.pct, LIGHT_A.reps) + ' повторов. Вторая практика движения за неделю, которая почти не утомляет. Вес идёт за основным днём сам. Стоит первым, пока ты свежий.');
        }
      }
    }
    if (held.length) note(list(held.map(nm)) + ' — поддержание', 'Та же волна, ' + Math.max(2, cfg.cycle.sets - 1) + ' подхода вместо ' + cfg.cycle.sets + ', расчётный максимум не растёт. Вес остаётся прежним — этого хватает, чтобы сила не уходила, а восстановление достаётся приоритету.');
    if (back.length) note(list(back.map(nm)) + ' — снова обычная волна', cfg.cycle.sets + ' подхода, расчётный максимум +' + fmt(cfg.cycle.inc, 1) + '% в неделю.');

    if (focus && inProg(focus)) {
      /* 4. two strength days and a mass day: the remaining day gets an exercise for the main muscles of the lift, in its usual range and near failure */
      const fm = cfg.ex[focus].m || {}, mains = Object.keys(fm).filter(m => fm[m] >= 1 && !cfg.ignore[m]), lid = focus + '_light';
      const dp = id => { const k = kindOf(c2, id); return k === 'compound' || k === 'iso'; };
      const hitsMain = id => mains.some(m => (mOf(id)[m] || 0) >= 1), offMain = id => Object.entries(mOf(id)).some(([m, c]) => c >= 1 && cfg.ignore[m]);
      const like = id => { const a = mOf(id), ks = [...new Set(Object.keys(a).concat(Object.keys(fm)))]; return ks.reduce((t, k) => t + Math.min(a[k] || 0, fm[k] || 0), 0) / (ks.reduce((t, k) => t + Math.max(a[k] || 0, fm[k] || 0), 0) || 1); };
      for (const sl of SLOTS) {
        if (!slots[sl.id].length || slots[sl.id].some(e => e.ex === focus || e.ex === lid)) continue;
        const have = slots[sl.id].find(e => dp(e.ex) && hitsMain(e.ex) && !offMain(e.ex));
        if (have) { have.pin = true; note('Третий день ' + ON_DAY[sl.id] + ': ' + nm(have.ex), 'Упражнение на те же мышцы в режиме массы: ' + rangeOf(done, c2, have.ex).join('–') + ' повторов почти до отказа. Оно уже стоит в этом дне.'); continue; }
        const cand = Object.keys(c2.ex).filter(id => dp(id) && !c2.ex[id].uni && hitsMain(id) && !offMain(id)).sort((a, b) => (inProg(b) - inProg(a)) || (like(b) - like(a)) || nm(a).localeCompare(nm(b), 'ru'))[0];
        if (!cand) continue;
        insert(sl, { ex: cand, n: 3, isNew: true, pin: true });
        note('Третий день ' + ON_DAY[sl.id] + ': ' + nm(cand), '3 × ' + rangeOf(done, c2, cand).join('–') + ' почти до отказа: упражнение на те же мышцы в режиме массы. Два дня движение идёт на силу, третий — на объём.');
      }
    }
    if (!focus || inProg(focus)) {
      /* 8. the muscles: one common level, the priority group PRIO_K times higher —
            the highest level, up to the working zone, that the limits give to every muscle.
            Around a lift in priority the percentage lifts stand as they are and everything else is built the same way. */
      const prio = {}, tracked = MUSCLES.filter(m => !cfg.ignore[m.id]).map(m => m.id);
      if (group && !tracked.every(m => group.m.includes(m))) for (const m of group.m) if (!cfg.ignore[m]) prio[m] = 1;
      /* muscles left out of the count get nothing from the build: an exercise where such a muscle is a main mover leaves the programme
         (a percentage lift is never touched). The athlete gives such a muscle its sets by hand, with «+» in the volume table. */
      const offMain = id => Object.entries(mOf(id)).some(([m, c]) => c >= 1 && cfg.ignore[m]), gone = [];
      for (const sl of SLOTS) slots[sl.id] = slots[sl.id].filter(e => { const k = kindOf(c2, e.ex); if ((k !== 'compound' && k !== 'iso') || !offMain(e.ex)) return true; gone.push({ ex: e.ex, sl }); return false; });
      const empty = SLOTS.every(sl => !slots[sl.id].length), start = clone(slots);
      let why = null, pick = null;
      const attempt = lv => {
        const trial = clone(start), r = optimise(c2, trial, { z, ignore: cfg.ignore, prio, budget, dayCap: caps.day, level: lv }, define);
        if (!pick) why = r.hit;
        if (!pick || r.left.length < pick.res.left.length || (r.left.length === pick.res.left.length && lv > pick.level)) pick = { level: lv, res: r, slots: trial };
        return { ok: !r.left.length, trial };
      };
      const first = attempt(z.opt);
      if (!first.ok && z.opt > z.min) {
        /* the next guess: what the weakest muscle reached, a priority one counted at its share */
        const pv = progTally(c2, first.trial).pv, low = Math.min(...tracked.map(m => (pv[m] || 0) / (prio[m] ? PRIO_K : 1)));
        let lv = Math.max(z.min, Math.min(z.opt - 1, Math.floor(low + 0.75)));
        if (attempt(lv).ok) { while (lv + 1 < z.opt && attempt(lv + 1).ok) lv++; }
        else while (lv > z.min && !attempt(--lv).ok);
      }
      const level = pick.level, res = pick.res;
      for (const sl of SLOTS) slots[sl.id] = pick.slots[sl.id];
      for (const id of Object.keys(create)) if (!SLOTS.some(sl => slots[sl.id].some(e => e.ex === id))) { delete create[id]; delete c2.ex[id]; }
      if (empty) { const rank = e => { const k = kindOf(c2, e.ex); return k === 'base' || k === 'light' ? 0 : k === 'compound' ? 1 : 2; }; for (const sl of SLOTS) slots[sl.id] = slots[sl.id].map((e, i) => ({ e, i })).sort((a, b) => (rank(a.e) - rank(b.e)) || (a.i - b.i)).map(x => x.e); }
      const T = now(), tot = SLOTS.reduce((a, sl) => a + (T.load[sl.id] || 0), 0);
      const names = ids => list(ids.map(m => MUSCLE[m].n.toLowerCase()));
      const spanOf = ids => { const v = ids.map(m => T.pv[m] || 0), a = fmt(Math.min(...v), 1), b = fmt(Math.max(...v), 1); return a === b ? a : 'от ' + a + ' до ' + b; };
      const pm = tracked.filter(m => prio[m]), rest = tracked.filter(m => !prio[m]), half = rest.filter(m => (T.pv[m] || 0) < z.opt - 0.01);
      const noRoom = 'в днях уже по девять упражнений по пять подходов или мешает лимит ' + caps.day + ' подходов на мышцу за тренировку';
      const plus = ' Точечно прибавить или убавить мышце можно кнопками «+» и «−» в таблице объёма.', sum = ' Всего ' + nSets(+tot.toFixed(1)) + ' при лимите ' + budget + '.';
      const lower = why === 'budget' ? 'Лимита ' + budget + ' подходов в неделю не хватает, чтобы довести все мышцы до рабочей зоны (от ' + z.opt + ')' : 'До рабочей зоны (от ' + z.opt + ') все мышцы разом не дотянуть: ' + noRoom;
      const nearly = 'Почти все мышцы в рабочей зоне (от ' + z.opt + '). На полподхода не дотягивают: ' + names(half) + ' — косвенная нагрузка считается половинами, поэтому ровно не сходится.';
      const stuck = () => note('Не дотянуты: ' + names(res.left), res.hit === 'budget' ? 'Лимит ' + budget + ' подходов в неделю исчерпан. Чтобы закрыть остальное, нужен больший лимит или четвёртый тренировочный день.' : 'Добавлять некуда: ' + noRoom + '. Поможет четвёртый тренировочный день или замена упражнений вручную.');
      if (!pm.length) {
        const span = spanOf(tracked);
        if (res.left.length) stuck();
        else if (level < z.opt) note('Нагрузка поровну: ' + span + ' подходов на мышцу', lower + (why === 'budget' ? ', поэтому он разделён поровну. Чтобы поднять общий уровень, увеличь лимит недели.' : '. Поэтому уровень общий, но ниже.') + plus);
        else if (half.length) note('Нагрузка поровну: ' + span + ' подходов на мышцу', nearly + sum + plus);
        else note('Все мышцы в рабочей зоне, поровну', 'Каждая мышца в цели получает ' + span + ' подходов в неделю, ни одна не выделяется.' + sum);
      } else {
        const share = 'Приоритетные мышцы (' + names(pm) + ') получают примерно в полтора раза больше остальных, но не больше: каждый следующий подход прибавляет всё меньше, а остальным мышцам нужен свой объём. Остальные делят объём поровну. ';
        if (res.left.length) stuck();
        else note('Приоритет — ' + spanOf(pm) + ', остальные мышцы — ' + spanOf(rest) + ' подходов в неделю', share + (level < z.opt ? lower + (why === 'budget' ? ': уровни ниже, пропорция та же. Чтобы поднять всех, увеличь лимит недели.' : '. Уровни ниже, пропорция та же.') + plus
          : (half.length ? nearly : 'Все мышцы в рабочей зоне (от ' + z.opt + ').') + sum));
      }
      if (res.over.length) note('Чуть выше своего уровня: ' + names(res.over), 'Эти мышцы работают попутно почти во всех упражнениях на соседние или в упражнениях по процентам, где число подходов задаёт волна. Убрать у них ещё — значит недодать соседям.');
      for (const sl of SLOTS) for (const e of slots[sl.id]) if (e.isNew && !e.from) {
        const ms = Object.entries(mOf(e.ex)).filter(x => x[1] >= 1).map(x => x[0]);
        note('Новое ' + ON_DAY[sl.id] + ': ' + nm(e.ex), e.n + ' × ' + rangeOf(done, c2, e.ex).join('–') + '. ' + ms.map(m => MUSCLE[m].n + ': было ' + fmt(before.pv[m] || 0, 1) + ', станет ' + fmt(T.pv[m] || 0, 1) + ' в неделю').join('; ') + '.');
      }
      const moved = k => SLOTS.flatMap(sl => slots[sl.id].filter(e => !e.isNew && (k > 0 ? e.chg > 0 : e.chg < 0)).map(e => nm(e.ex) + ' (' + sl.s.toLowerCase() + ') ' + signed(e.chg)));
      if (moved(1).length) note('Прибавлены подходы', moved(1).join(', ') + '.');
      if (moved(-1).length) note('Убраны подходы', moved(-1).join(', ') + '. Эти мышцы получали заметно больше, чем им отведено.');
      if (gone.length) {
        const off = MUSCLES.filter(m => cfg.ignore[m.id] && gone.some(g => (mOf(g.ex)[m.id] || 0) >= 1)).map(m => m.id), byEx = {};
        for (const g of gone) (byEx[g.ex] = byEx[g.ex] || []).push(g.sl.s.toLowerCase());
        note('Мышцы вне расчёта: ' + names(off) + ' — без подходов', 'Убрано: ' + Object.entries(byEx).map(([id, d]) => nm(id) + ' (' + d.join(', ') + ')').join(', ') + '. В этих упражнениях основная мышца — вне расчёта, а таким мышцам сборка подходы не даёт. Нужны — прибавь кнопкой «+» у мышцы в таблице объёма.');
      }
      /* frequency: what was carried over to another day, and the muscles that still have one day only */
      const carried = SLOTS.flatMap(sl => slots[sl.id].filter(e => e.from && e.from !== sl.id).map(e => nm(e.ex) + ' (' + SLOT[e.from].s.toLowerCase() + ' → ' + sl.s.toLowerCase() + ')'));
      if (carried.length) note('Перенесено на другой день', carried.join(', ') + '. Чтобы каждая мышца получала нагрузку хотя бы в два дня недели: объём за неделю тот же, меняется только день.');
      if (res.once && res.once.length) note('Один день в неделю: ' + names(res.once), 'Второй день для этих мышц не поместился: мешает лимит недели или дня, а переносить упражнения дальше — значит ломать баланс объёма. Можно добавить подход кнопкой «+» у мышцы или перенести упражнение вручную.');
      res.cut = res.cut.filter(c => !SLOTS.some(sl => slots[sl.id].some(e => e.ex === c.ex && e.from === c.sl.id)));
      if (res.cut.length) note('Убрано из программы', res.cut.map(c => nm(c.ex) + ' (' + c.sl.s.toLowerCase() + ')').join(', ') + ': эти упражнения давали лишнее мышцам, которые и так выше своего уровня, или не помещались в лимит недели.');
    }

    /* the first weights: named in the settings, or to be found in the first workout */
    if (!opts.manual) {
      const ids = [...new Set(SLOTS.flatMap(sl => slots[sl.id].map(e => e.ex)))].filter(id => !lastSessionItem(done, isLight(c2, id) ? c2.ex[id].of : id, null, null));
      const got = ids.map(id => ({ id, s: startOf(done, c2, id) })).filter(x => x.s), none = ids.filter(id => !got.some(x => x.id === id) && !isLight(c2, id));
      if (got.length) note('Стартовые веса — из «Настройки»', got.map(x => nm(x.id) + ' — ' + fmt(x.s.w) + ' кг' + (x.s.pct ? ' (' + x.s.pct + '% от максимума ' + fmt(x.s.tm, 1) + ')' : x.s.src === 'max' ? ' (от разового максимума)' : '')).join('; ') + '. Первая тренировка начнётся с них, дальше веса ведёт журнал.');
      if (none.length && (got.length || done.length === 0)) note('Вес пока не задан: ' + none.length + ' ' + plural(none.length, ['упражнение', 'упражнения', 'упражнений']), list(none.map(nm)) + '. Его можно подобрать на первой тренировке — или указать рабочий вес либо разовый максимум в «Настройке» → «Известные веса», тогда дневник поставит его сам.');
    }
    const sig = S => SLOTS.map(sl => (S[sl.id] || []).map(e => e.ex + ':' + (e.n || '')).join(',')).join('|');
    const same = sig(slots) === sig(cur) && Object.keys(goals).every(id => (goalOf(cfg, id) || null) === goals[id]);
    return { focus, others: focus ? (hold ? 'hold' : 'grow') : null, prio: group ? group.id : '', budget, name: focus ? 'Пауэрбилдинг: ' + nm(focus).toLowerCase() : group ? 'Приоритет: ' + group.n.toLowerCase() : 'Равномерно на всё тело', slots, cur, goals, create, notes, cfg: c2, before, after: now(), same };
  }

  /* ---------- body weight ---------- */
  function bodyRate(body) {
    if (body.length < 3) return null;
    const last = body[body.length - 1], pts = body.filter(b => dnum(last.date) - dnum(b.date) <= 35);
    if (pts.length < 3 || dnum(pts[pts.length - 1].date) - dnum(pts[0].date) < 10) return null;
    const xs = pts.map(p => dnum(p.date)), ys = pts.map(p => p.kg), n = pts.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
    const perWeek = sxx ? sxy / sxx * 7 : 0;
    return { perWeek, pctWeek: perWeek / last.kg * 100, n, days: xs[n - 1] - xs[0] };
  }

  /* ---------- the rule-based review ---------- */
  function insights(st) {
    const { workouts, cfg, body, today } = st;
    const out = [];
    const add = (sev, cat, title, text, link) => out.push({ sev, cat, title, text, link });
    const done = workouts.filter(w => w.items.some(it => work(it).length));
    if (!done.length) return out;
    const wi = weeksInfo(workouts, cfg, today), vol = volume(workouts, cfg), z = cfg.zones;
    const { avg, pat } = avgVolume(vol, wi.ref);
    const refTxt = wi.ref.length ? (wi.ref.length === 1 ? 'неделю ' + wi.ref[0].no : 'недели ' + wi.ref[0].no + '–' + wi.ref[wi.ref.length - 1].no) : '';

    /* volume */
    if (wi.ref.length) {
      const by = { none: [], low: [], base: [], opt: [], high: [] };
      for (const m of MUSCLES) { const k = zone(avg[m.id], z); if (cfg.ignore[m.id] && (k === 'none' || k === 'low' || k === 'base')) continue; by[k].push(m); }
      const tag = m => m.n + ' ' + fmt(avg[m.id], 1);
      const fixes = ms => ms.map(m => m.n.toLowerCase() + ' — ' + FIX[m.id]).join('; ');
      if (by.none.length) add('crit', 'Объём', 'Без нагрузки: ' + list(by.none.map(m => m.n.toLowerCase())),
        'За ' + refTxt + ' эти мышцы не получили ни одного подхода, даже косвенно. Если они нужны — это главный пробел программы; если нет, отметь в настройке, что дневник за ними не следит. Что добавить: ' + fixes(by.none) + '.', 'muscles');
      if (by.low.length) add('warn', 'Объём', 'Меньше ' + z.min + ' подходов в неделю: ' + list(by.low.map(tag)),
        'Это ниже минимальной дозы, при которой рост заметен. Что добавить: ' + fixes(by.low) + '.', 'muscles');
      if (by.base.length) add('info', 'Объём', 'Ниже рабочей зоны: ' + list(by.base.map(tag)),
        'От ' + z.min + ' до ' + z.opt + ' подходов в неделю мышцы растут, но медленнее, чем могли бы. Если какая-то из них в приоритете, добавляй по 1–2 подхода в неделю: ' + fixes(by.base) + '.', 'muscles');
      if (by.high.length) add('warn', 'Объём', 'Больше ' + z.high + ' подходов в неделю: ' + list(by.high.map(tag)),
        'Выше ' + z.high + ' подходов отдача от каждого следующего мала. Если веса в этих упражнениях перестали расти, убери 2–4 подхода.', 'muscles');
      if (by.opt.length) add('good', 'Объём', 'В рабочей зоне ' + z.opt + '–' + z.high + ': ' + list(by.opt.map(tag)),
        'Среднее за ' + refTxt + ', в подходах в неделю. За половину подхода идут косвенная работа и подходы, где в запасе осталось 3 повтора и больше.', 'muscles');

      const miss = PATTERNS.filter(p => p.fix && !(pat[p.id] > 0));
      if (miss.length) add('warn', 'Баланс', 'В программе нет ' + list(miss.map(p => p.gen)),
        'Сила растёт в тех движениях, которые тренируешь. Чтобы закрыть пробел: ' + miss.map(p => p.n.toLowerCase() + ' — ' + p.fix).join('; ') + '.', 'muscles');
      const unk = [];
      for (const w of wi.ref) for (const id of (vol[w.no] ? vol[w.no].unknown : [])) if (!unk.includes(id)) unk.push(id);
      if (unk.length) add('warn', 'Данные', 'Упражнения без привязки к мышцам: ' + list(unk.map(id => exName(cfg, id))),
        'Их подходы не попадают в расчёт объёма. Укажи основные и вспомогательные мышцы в настройке.', 'setup');
    }

    /* the programme against the athlete's own limits */
    const br = ruleBreaks(cfg, planned(workouts.filter(w => !w.open), cfg));
    if (br.length) add('warn', 'Правила', 'Программа выходит за твои лимиты', br.join('. ') + '. Поправить можно во вкладке «Программа».', 'program');

    /* progress per exercise */
    const stats = allStats(workouts, cfg).filter(s => s.active);
    const dp = stats.filter(s => !isCycle(cfg, s.id) && !isLight(cfg, s.id));
    for (const s of dp) {
      if (s.status === 'flat' || s.status === 'down') {
        const p = s.pr.best;
        add('warn', 'Прогресс', (s.status === 'down' ? 'Откат: ' : 'Застой: ') + exName(cfg, s.id),
          'Лучший подход (' + fmt(p.w) + ' × ' + p.r + ') был ' + s.sincePR + ' ' + plural(s.sincePR, ['тренировку', 'тренировки', 'тренировок']) + ' назад, ' + fmtDate(s.pr.date, true) + '. ' +
          (s.status === 'down' ? 'Последний результат ниже рекорда больше чем на 5%. Проверь сон, питание и отдых между подходами; если так же в других упражнениях — нужна разгрузочная неделя.'
            : 'Убедись, что подход идёт до RIR ' + TARGET + '. Если да — сбрось вес на 10% на 1–2 недели и набери повторы заново, либо смени вариант упражнения.'), 'progress');
      }
    }
    /* a set stuck for four sessions of the same day while the sets before it did not grow either */
    for (const s of dp) {
      const hist = s.ss.filter(x => x.slot === s.last.slot).slice(-4);
      if (hist.length < 4 || s.status !== 'up') continue;
      const stuck = stalledSets(hist, s.last.item.range ? s.last.item.range[1] : null);
      if (stuck.length) add('info', 'Прогресс', exName(cfg, s.id) + ': ' + (stuck.length === 1 ? 'подход ' + (stuck[0].i + 1) + ' стоит' : 'подходы ' + list(stuck.map(x => x.i + 1)) + ' стоят') + ' на месте',
        'Четыре тренировки подряд без движения: ' + stuck.map(x => 'подход ' + (x.i + 1) + ' — ' + fmt(x.w) + ' × ' + x.r).join(', ') + '.' + (stuck.some(x => x.i > 0) ? ' Подходы перед ' + (stuck.length === 1 ? 'ним' : 'ними') + ' за это время тоже не выросли, так что дело не в усталости от начала упражнения.' : '') + ' В плане тренировки дневник предложит опустить вес на один шаг и набрать повторы заново.', 'workout');
    }
    /* fatigue: half of the exercises went backwards last time */
    const cmp = dp.filter(s => s.n >= 2);
    const worse = cmp.filter(s => s.last.metric < s.ss[s.n - 2].metric * 0.98);
    if (cmp.length >= 6 && worse.length >= cmp.length / 2) add('warn', 'Восстановление', 'Похоже на накопленную усталость',
      'В ' + worse.length + ' из ' + cmp.length + ' упражнений последняя тренировка слабее предыдущей: ' + list(worse.slice(0, 5).map(s => exName(cfg, s.id))) + '. Если на следующей неделе картина та же, сделай разгрузку: те же веса, половина подходов.', 'progress');

    /* the percentage wave */
    const cyc = stats.filter(s => isCycle(cfg, s.id));
    if (cyc.length) {
      const lines = [], bad = [];
      for (const s of cyc) {
        const p = planCycle(workouts, cfg, s.id, null);
        const wk = Math.max(1, Math.round((dnum(s.last.date) - dnum(s.first.date)) / 7));
        lines.push(exName(cfg, s.id) + ': расчётный максимум ' + fmt(s.first.tm, 1) + ' → ' + fmt(s.last.tm, 1) + ' кг (' + signed(pct(s.last.tm, s.first.tm)) + '% за ' + wk + ' ' + plural(wk, ['неделю', 'недели', 'недель']) + '), дальше ' + fmt(p.w) + ' × ' + p.reps + (p.auto ? ' — сила по запасу: ' + AUTO.sets + ' × ' + AUTO.reps + ' одним весом, вес по запасу в последнем подходе' : p.strong ? ' — приоритет силы, тяжёлая волна, максимум +' + fmt(WAVE_S.inc, 1) + '% раз в цикл' : p.hold ? ' — поддержание, максимум не растёт' : ''));
        if (p.repeat) bad.push(exName(cfg, s.id) + ' — не все подходы закрыты ' + fmtDate(s.last.date, true) + ', неделя повторяется без прибавки');
        else if (p.hard) bad.push(exName(cfg, s.id) + ' — подход шёл в отказ, максимум на следующую неделю не повышается');
      }
      if (bad.length) add('warn', 'Базовые', 'Волна упёрлась: ' + bad.length + ' ' + plural(bad.length, ['упражнение', 'упражнения', 'упражнений']), bad.join('; ') + '. Когда это случится второй раз подряд, переходи на прибавку раз в 3-недельный цикл.', 'progress');
      const q = Math.round((Math.pow(1 + cfg.cycle.inc / 100, 13) - 1) * 100);
      add('info', 'Базовые', 'Волна ' + Object.entries(cfg.cycle.pct).sort((a, b) => b[0] - a[0]).map(e => e[1] + '%').join(' / ') + ': максимум растёт на ' + fmt(cfg.cycle.inc, 1) + '% в неделю',
        lines.join('. ') + '. Такой темп — это +' + q + '% за квартал, и однажды он закончится. Отмечай запас (RIR) в подходах: как только он дойдёт до 0 или подходы перестанут закрываться, дневник перестанет повышать максимум и предложит повторить неделю.', 'progress');
    }

    /* rep drop-off inside the last session */
    let drops = 0;
    for (const s of dp) {
      if (drops >= 3) break;
      const sets = s.last.item.sets.filter(x => !x.warm && x.r != null);
      for (let i = 1; i < sets.length; i++) if (sets[i].w === sets[i - 1].w && sets[i - 1].r - sets[i].r >= 4) {
        add('info', 'Техника', exName(cfg, s.id) + ': −' + (sets[i - 1].r - sets[i].r) + ' повтора между подходами',
          fmtDate(s.last.date, true) + ' на ' + fmt(sets[i].w) + ' кг: ' + sets[i - 1].r + ' повторов, затем ' + sets[i].r + '. Такой провал при том же весе обычно значит короткий отдых или отказ в предыдущем подходе. Попробуй отдыхать 2–3 минуты.', 'progress');
        drops++; break;
      }
    }

    /* left / right */
    const sides = {};
    for (const s of dp) { const n = exName(cfg, s.id), m = /(правая|левая)/i.exec(n); if (!m) continue; const k = n.replace(/\s*(правая|левая)(\s+рука)?/i, '').trim(); (sides[k] || (sides[k] = {}))[m[1].toLowerCase()] = s; }
    for (const [k, v] of Object.entries(sides)) {
      if (!v['правая'] || !v['левая']) continue;
      const a = v['правая'].last.e1, b = v['левая'].last.e1, d = Math.abs(pct(a, b));
      if (d >= 8) add('info', 'Баланс', k + ': ' + (a > b ? 'правая' : 'левая') + ' сильнее на ' + fmt(d) + '%',
        'Правая ' + fmt(v['правая'].last.best.w) + ' × ' + v['правая'].last.best.r + ', левая ' + fmt(v['левая'].last.best.w) + ' × ' + v['левая'].last.best.r + '. Начинай со слабой руки и не делай сильной больше повторов, чем получилось слабой.', 'progress');
    }

    /* data quality */
    const holes = [];
    for (const w of workouts) for (const it of w.items) { if (it.skip || w.open) continue; const k = it.sets.filter(s => s.r == null && !s.skip).length; if (k) holes.push({ w, it, k }); }
    if (holes.length) {
      const total = holes.reduce((s, h) => s + h.k, 0);
      add('info', 'Данные', 'Не записаны повторы: ' + total + ' ' + plural(total, ['подход', 'подхода', 'подходов']),
        holes.slice(-6).map(h => exName(cfg, h.it.ex) + ' ' + fmtDM(h.w.date)).join(', ') + '. Эти подходы не считаются ни в объёме, ни в прогрессе. Если ты их делал, допиши повторы в журнале.', 'journal');
    }
    const gaps = wi.weeks.filter(w => !w.count && !w.current && w.no >= wi.cur - 4);
    if (gaps.length) add('info', 'Режим', 'Без тренировок: ' + (gaps.length === 1 ? 'неделя ' : 'недели ') + list(gaps.map(w => w.no)), 'После пропуска первую тренировку каждого упражнения начинай с прошлых весов, без повышения.', 'journal');

    /* body weight */
    if (cfg.bw === 'track') { /* only recorded: no advice on gaining */ }
    else if (!body.length) add('info', 'Вес тела', 'Вес тела пока не записан',
      'Набор мышц проще всего проверить по весу: для набора без лишнего жира ориентир — плюс 0.25–0.5% веса тела в неделю. Записывай вес 2–3 раза в неделю утром во вкладке «Прогресс».', 'progress');
    else {
      const r = bodyRate(body);
      if (r) {
        const t = fmt(Math.abs(r.perWeek), 2) + ' кг в неделю (' + signed(r.pctWeek, 2) + '%)';
        if (r.pctWeek < 0.1) add('warn', 'Вес тела', 'Вес не растёт: ' + (r.perWeek < 0 ? '−' : '+') + t, 'Для набора мышц нужен профицит. Добавь 200–300 ккал в день и проверь через две недели.', 'progress');
        else if (r.pctWeek > 0.75) add('warn', 'Вес тела', 'Вес растёт быстро: +' + t, 'Быстрее 0.5–0.75% в неделю лишнее обычно уходит в жир. Убери 200–300 ккал в день.', 'progress');
        else add('good', 'Вес тела', 'Вес растёт в нужном темпе: +' + t, 'Ориентир для набора — 0.25–0.5% веса тела в неделю.', 'progress');
      }
    }

    /* what went well */
    const ups = dp.filter(s => s.n >= 4 && s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4);
    if (ups.length) add('good', 'Прогресс', 'Быстрее всего растут: ' + list(ups.map(s => exName(cfg, s.id) + ' ' + signed(s.delta) + '%')),
      'Изменение расчётного максимума лучшего подхода с первой тренировки упражнения до последней.', 'progress');

    const order = { crit: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  /* ---------- exports ---------- */
  function toCsv(workouts, cfg) {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [['date', 'week', 'day', 'exercise', 'set', 'weight_kg', 'reps', 'rir', 'flag'].join(',')];
    for (const w of workouts) for (const it of w.items) {
      let i = 0;
      for (const s of it.sets) rows.push([w.date, weekNo(w.date, cfg.start), w.slot || '', q(exName(cfg, it.ex)), ++i, s.w, s.r == null ? '' : s.r, s.q == null ? '' : s.q, s.warm ? 'warmup' : (s.skip || it.skip) ? 'skipped' : s.r == null ? 'reps_missing' : ''].join(','));
    }
    return rows.join('\n');
  }

  function coachPrompt(st, question) {
    const { workouts, cfg, body, today } = st;
    const wi = weeksInfo(workouts, cfg, today), vol = volume(workouts, cfg), { avg } = avgVolume(vol, wi.ref);
    const from = wi.ref.length ? wi.ref[0].from : workouts.length ? workouts[0].date : today;
    const L = [];
    L.push('Ты — тренер по силовой подготовке. Разбери тренировочный дневник и дай практические рекомендации на ближайшие 1–2 недели.');
    L.push('Отвечай по-русски, коротко и конкретно: до 8 пунктов, каждый — что именно изменить (упражнение, вес, подходы, повторы) и почему, с цифрами из дневника. Сначала самое важное. Без общих слов и без медицинских советов. Оформи как маркированный список, заголовки не нужны.');
    L.push('');
    L.push('МЕТОДИКА АТЛЕТА: ' + (cfg.method || 'не описана'));
    const goals = Object.keys(cfg.ex).filter(id => goalOf(cfg, id)).map(id => cfg.ex[id].n + ' — ' + goalName(cfg, id));
    if (goals.length) L.push('ЦЕЛИ, КОТОРЫЕ АТЛЕТ ОТМЕТИЛ ДЛЯ УПРАЖНЕНИЙ (учитывай их): ' + goals.join('; ') + '.');
    if (Object.keys(cfg.ex).some(id => goalOf(cfg, id) === 'auto')) L.push('«СИЛА ПО ЗАПАСУ»: ' + AUTO.sets + ' × ' + AUTO.reps + ' одним весом каждую неделю. Решает запас в последнем подходе: ' + AUTO.aim + ' и больше — плюс шаг веса, 1 — вес тот же, 0 или подходы не закрыты — минус ' + AUTO.down + '%. Второй день такого упражнения — ' + LIGHT_A.sets + ' × ' + LIGHT_A.reps + ' на ' + LIGHT_A.pct + '% (в запасе 3–4 повтора). Не предлагай вернуть волну процентов без веской причины.');
    if (cfg.program) L.push('ПРОГРАММА, КОТОРУЮ АТЛЕТ ПРИНЯЛ ' + cfg.program.since + ': «' + (cfg.program.name || '') + '»' + (cfg.program.focus ? ', пауэрбилдинг: приоритет — сила в упражнении «' + exName(cfg, cfg.program.focus) + '», остальные базовые ' + (cfg.program.others === 'grow' ? 'растут как раньше' : 'на поддержании') : '') + '. Не предлагай её ломать без веской причины.');
    const named = Object.keys(cfg.ex).filter(id => +cfg.ex[id].max > 0 || +cfg.ex[id].work > 0).map(id => { const e = cfg.ex[id]; return e.n + ' — ' + [+e.work > 0 ? 'рабочий ' + fmt(+e.work) + ' кг' + (+e.workR > 0 ? ' × ' + e.workR : '') : '', +e.max > 0 ? 'разовый максимум ' + fmt(+e.max) + ' кг' : ''].filter(Boolean).join(', '); });
    if (named.length) L.push('ВЕСА, КОТОРЫЕ АТЛЕТ НАЗВАЛ САМ (для упражнений, которых ещё нет в журнале, план стартует от них): ' + named.join('; ') + '.');
    const off = MUSCLES.filter(m => cfg.ignore[m.id]).map(m => m.n.toLowerCase());
    if (off.length) L.push('МЫШЦЫ ВНЕ РАСЧЁТА (атлет ведёт их сам или не тренирует намеренно; нулевой объём у них — норма, не предлагай их добавлять): ' + off.join(', ') + '.');
    L.push('Сегодня ' + today + ', идёт неделя ' + wi.cur + ' программы.');
    L.push('');
    L.push('НЕДЕЛЬНЫЙ ОБЪЁМ ПО МЫШЦАМ (среднее за недели ' + wi.ref.map(w => w.no).join(', ') + '; прямой подход = 1, косвенный = 0.5; ориентиры: меньше ' + cfg.zones.min + ' мало, ' + cfg.zones.opt + '–' + cfg.zones.high + ' рабочая зона):');
    L.push(MUSCLES.map(m => m.n + ' ' + fmt(avg[m.id], 1)).join('; '));
    L.push('');
    L.push('ТРЕНИРОВКИ (вес x повторы; @N — запас повторов до отказа (RIR) в этом подходе, если атлет его отметил; ? — повторы не записаны; - — не делал):');
    for (const w of workouts) {
      if (w.date < from) continue;
      L.push(w.date + ' (неделя ' + weekNo(w.date, cfg.start) + ', ' + ((SLOT[w.slot] || {}).s || '') + ')');
      for (const it of w.items) L.push('  ' + exName(cfg, it.ex) + (it.cyc ? ' [' + it.cyc.pct + '%]' : it.range ? ' [' + it.range.join('-') + ']' : '') + ': ' + fmtSets(it.sets) + (it.note ? ' (' + it.note + ')' : ''));
    }
    L.push('');
    L.push('ДИНАМИКА С НАЧАЛА ПРОГРАММЫ (первый -> последний лучший подход):');
    for (const s of allStats(workouts, cfg)) L.push('  ' + exName(cfg, s.id) + ': ' + fmt(s.first.best.w) + 'x' + s.first.best.r + ' (' + s.first.date + ') -> ' + fmt(s.last.best.w) + 'x' + s.last.best.r + ' (' + s.last.date + '), тренировок ' + s.n);
    if (body.length) { L.push(''); L.push('ВЕС ТЕЛА: ' + body.slice(-8).map(b => b.date + ' ' + fmt(b.kg, 1)).join('; ')); }
    L.push('');
    L.push('АВТОМАТИЧЕСКИЕ ЗАМЕЧАНИЯ ДНЕВНИКА: ' + insights(st).filter(i => i.sev !== 'good').map(i => i.title).join(' | '));
    if (question) { L.push(''); L.push('ВОПРОС АТЛЕТА: ' + question); }
    return L.join('\n').slice(0, 60000);
  }

  return {
    MUSCLES, MUSCLE, FIX, PATTERNS, SLOTS, SLOT, ZONE,
    dnum, dstr, dow, addDays, todayStr, fmtDate, fmtDay, fmtDM, mondayOf, weekNo, weekRange,
    fmt, pct, signed, plural, nSets, list,
    parseSets, fmtSets, fromDoc, toDoc, clone, mergeCfg, exName, isCycle, cycleOrder,
    splitText, work, e1, topSet, bestSet, effReps, setTarget, estRir, setRir, setVol, cycleVol, GOALS, goalOf, goalName, goalRange, waveOf, waveSetsAvg, isLight, kindOf, LIGHT, LIGHT_A, AUTO, lightOf, progPending, sortW, sessions, exStats, allStats, weeksInfo, volume, zone, avgVolume, strengthIndex,
    program, stalledSets, planned, additions, adapt, applyAdapt, lastSessionItem, inferStep, stepOf, formulaRange, suggestSet, planCycle, planLight, makeItem, hints, nextSlot, nextDate, plan, progTally, currentSlots, buildProgram, nudgeMuscle, swapsFor, PRIO_K, OFF_DEFAULT, knownMax, startWeight, startOf, rangeOf, ruleBreaks, estMinutes, fmtDur, fmtRest, REST_OPTS, PRIOS, GEAR, NO_GEAR, gearGuess, gearList, gearOf, placed, guessEx, exPrompt, parseDef,
    bodyRate, insights, toCsv, coachPrompt
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
