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
          sets: parseSets(it.sets), note: it.note || '', skip: !!it.skip, rir: null
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
      if (it.cyc) o.cyc = it.cyc.pct + '/' + it.cyc.reps; else if (it.range) o.rng = it.range[0] + '-' + it.range[1];
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

  /* ---------- config ---------- */
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
    for (const [id, e] of Object.entries(raw.ex || {})) c.ex[id] = Object.assign({ n: id, m: {} }, e);
    return c;
  }
  const exName = (cfg, id) => (cfg.ex[id] && cfg.ex[id].n) || id;
  const isCycle = (cfg, id) => !!(cfg.ex[id] && cfg.ex[id].mode === 'cycle');
  /* reps scheme order inside the wave: 5 -> 4 -> 3 -> 5 ... */
  const cycleOrder = cfg => Object.keys(cfg.cycle.pct).map(Number).sort((a, b) => b - a);

  /* ---------- per-set maths ---------- */
  const work = it => it.skip ? [] : it.sets.filter(s => s.r > 0 && !s.warm && !s.skip);
  const e1 = (w, r) => r <= 1 ? w : w * (1 + r / 30);                      // Epley
  const topSet = sets => sets.reduce((t, s) => (s.w > t.w || (s.w === t.w && s.r > t.r)) ? s : t, sets[0]);
  /* reps normalised to the method's one rep in reserve: 10 reps with 3 in reserve count as 12 */
  const effReps = s => s.r + (s.q == null ? 0 : s.q - 1);
  const bestSet = sets => sets.reduce((t, s) => e1(s.w, effReps(s)) > e1(t.w, effReps(t)) ? s : t, sets[0]);
  /* reps in reserve: logged, or for wave sets estimated from the percentage (Epley) */
  const estRir = (pct, reps) => Math.round(30 * (100 / pct - 1) - reps);
  const setRir = (s, it) => s.q != null ? s.q : it.cyc && it.cyc.pct ? estRir(it.cyc.pct, s.r) : null;
  const EASY = 3;                                              // a set this far from failure counts as half a set for muscle volume
  const setVol = (s, it) => { const q = setRir(s, it); return q != null && q >= EASY ? 0.5 : 1; };
  const cycleVol = cfg => { const e = Object.entries(cfg.cycle.pct); return e.length ? e.reduce((a, x) => a + (estRir(+x[1], +x[0]) >= EASY ? 0.5 : 1), 0) / e.length : 1; };

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
      const tm = it.cyc && it.cyc.pct ? top.w / (it.cyc.pct / 100) : null;
      out.push({ date: w.date, wid: w.id, slot: w.slot, item: it, sets, top, best, e1: e1(best.w, effReps(best)), tm, metric: tm != null ? tm : e1(best.w, effReps(best)) });
    }
    return out;
  }

  /* exercises of the current programme: whatever the latest finished workout of each day contains */
  function program(workouts) {
    const last = {};
    for (const w of workouts) if (!w.open && w.slot && w.items.some(it => work(it).length)) last[w.slot] = w;
    const ids = new Set();
    for (const w of Object.values(last)) for (const it of w.items) ids.add(it.ex);
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
    const active = prog.has(exId);
    return { id: exId, ss, n, first, last, pr: ss[prIdx], prIdx, sincePR, status, active, delta: pct(last.metric, first.metric) };
  }

  function allStats(workouts, cfg) {
    const prog = program(workouts);
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
      const o = out[k] || (out[k] = { m: {}, detail: {}, pat: {}, sets: 0, n: 0, unknown: [] });
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
    opt: { n: 'рабочая зона', sev: 'good' }, high: { n: 'очень много', sev: 'warn' }
  };
  function avgVolume(vol, ref) {
    const avg = {};
    for (const m of MUSCLES) avg[m.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].m[m.id]) || 0), 0) / ref.length : 0;
    const pat = {};
    for (const p of PATTERNS) pat[p.id] = ref.length ? ref.reduce((s, w) => s + ((vol[w.no] && vol[w.no].pat[p.id]) || 0), 0) / ref.length : 0;
    return { avg, pat };
  }

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
    const order = cycleOrder(cfg), ex = cfg.ex[exId] || {}, q = +ex.round || 2.5;
    const ss = sessions(workouts.filter(w => !w.open && (!before || w.date < before)), cfg, exId).filter(s => s.item.cyc);
    if (!ss.length) return { reps: order[0], pct: cfg.cycle.pct[order[0]], sets: cfg.cycle.sets, w: null, tm: null, prev: null, repeat: false };
    const last = ss[ss.length - 1], lr = last.item.cyc.reps;
    const planned = last.item.sets.filter(s => !s.warm);
    const done = planned.length > 0 && planned.every(s => s.r != null && s.r >= lr) && !last.item.skip;
    const hard = last.sets.some(s => s.q === 0);
    const repeat = !done;
    const hold = repeat || hard;
    const i = order.indexOf(lr);
    const reps = repeat ? lr : order[(i + 1) % order.length];
    const p = cfg.cycle.pct[reps] || last.item.cyc.pct;
    const tm = last.tm * (hold ? 1 : 1 + cfg.cycle.inc / 100);
    return { reps, pct: p, sets: cfg.cycle.sets, w: repeat ? last.top.w : +roundTo(tm * p / 100, q).toFixed(3), tm, prev: last, repeat, hard };
  }

  /* hints for one exercise in a workout being planned or edited */
  function hints(workouts, cfg, exId, slot, before) {
    const ex = cfg.ex[exId] || {};
    const p = lastSessionItem(workouts, exId, slot, before);
    const step = stepOf(workouts, cfg, exId);
    const range = (p && p.it.range) || [ex.lo || 8, ex.hi || 12];
    const prevSets = p ? p.it.sets.filter(s => !s.warm) : [];
    return { step, range, prevDate: p ? p.w.date : null, prevSlot: p ? p.w.slot : null, prevSkipped: p ? p.it.skip : false, prevSets, sets: prevSets.map(s => suggestSet(s, range, step)) };
  }

  function nextSlot(workouts) {
    const done = workouts.filter(w => !w.open && w.slot);
    if (!done.length) return SLOTS[0].id;
    const i = SLOTS.findIndex(s => s.id === done[done.length - 1].slot);
    return SLOTS[(i + 1) % SLOTS.length].id;
  }
  function nextDate(slot, today, workouts) {
    const want = SLOT[slot].dow, taken = workouts.some(w => w.date === today && !w.open);
    for (let k = taken ? 1 : 0; k < 8; k++) { const d = addDays(today, k); if (dow(d) === want) return d; }
    return today;
  }

  function plan(workouts, cfg, slot, date) {
    let tpl = null;
    for (const w of workouts) if (!w.open && w.slot === slot && w.date < date) tpl = w;
    const items = [];
    for (const src of (tpl ? tpl.items : [])) {
      if (isCycle(cfg, src.ex)) {
        const c = planCycle(workouts, cfg, src.ex, date);
        items.push({ ex: src.ex, cyc: { pct: c.pct, reps: c.reps }, range: null, sets: Array.from({ length: c.sets }, () => ({ w: c.w, r: null })), note: '', skip: false, rir: null });
      } else {
        const h = hints(workouts, cfg, src.ex, slot, date);
        items.push({ ex: src.ex, cyc: null, range: h.range.slice(), sets: h.sets.map(s => ({ w: s.w, r: null })), note: '', skip: false, rir: null });
      }
    }
    return { slot, date, template: tpl ? tpl.id : null, items };
  }

  /* ---------- adaptive layer: what the diary would change on top of the athlete's rules ---------- */
  const ADDS = [
    { key: 'abs', id: 'x_abs', prio: 4, sets: 3, times: 2, def: { n: 'Пресс', pat: 'iso', m: { abs: 1 }, step: 2.5 }, cover: e => ((e || {}).m || {}).abs >= 1,
      need: c => c.pv('abs') < c.z.min, why: c => 'пресс по программе получает ' + nSets(c.pv('abs')) + ' в неделю при минимуме ' + c.z.min },
    { key: 'rdl', id: 'x_rdl', prio: 1, sets: 4, times: 1, def: { n: 'Румынская тяга', pat: 'hinge', m: { hams: 1, glutes: 1, erectors: 1 }, step: 5 }, cover: e => (e || {}).pat === 'hinge',
      need: c => !c.pp('hinge'), why: c => 'в программе нет тяги с наклоном: разгибатели спины — ' + nSets(c.pv('erectors')) + ', ягодицы — ' + nSets(c.pv('glutes')) + ' в неделю' },
    { key: 'calf', id: 'x_calf', prio: 3, sets: 3, times: 2, def: { n: 'Подъёмы на носки', pat: 'iso', m: { calves: 1 }, step: 5 }, cover: e => ((e || {}).m || {}).calves >= 1,
      need: c => c.pv('calves') < c.z.min, why: c => 'икры по программе получают ' + nSets(c.pv('calves')) + ' в неделю при минимуме ' + c.z.min },
    { key: 'ohp', id: 'x_ohp', prio: 2, sets: 3, times: 1, def: { n: 'Жим над головой', pat: 'v_push', m: { delt_front: 1, delt_mid: 0.5, triceps: 0.5 }, step: 2.5 }, cover: e => (e || {}).pat === 'v_push',
      need: c => !c.pp('v_push'), why: c => 'в программе нет вертикального жима: передние дельты — ' + nSets(c.pv('delt_front')) + ' в неделю' },
    { key: 'rear', id: 'x_rear', prio: 5, sets: 3, times: 2, def: { n: 'Обратная бабочка', pat: 'iso', m: { delt_rear: 1, upper_back: 0.5 }, step: 5 }, cover: e => ((e || {}).m || {}).delt_rear >= 1,
      need: c => c.pv('delt_rear') < c.z.opt && !c.prim('delt_rear'), why: c => 'задние дельты работают только косвенно: ' + nSets(c.pv('delt_rear')) + ' в неделю при рабочей зоне от ' + c.z.opt }
  ];

  /* the programme as it stands: the latest finished workout of each day */
  function planned(workouts, cfg) {
    const t = {}, pv = {}, pp = {}, prim = {}, load = {};
    for (const w of workouts) if (!w.open && w.slot && w.items.length) t[w.slot] = w;
    for (const sl of SLOTS) {
      load[sl.id] = 0;
      const w = t[sl.id];
      if (!w) continue;
      for (const it of w.items) {
        const ex = cfg.ex[it.ex], n = it.sets.filter(x => !x.warm).length, f = ex && ex.uni ? 0.5 : 1, k = it.cyc ? cycleVol(cfg) : 1;
        load[sl.id] += n * f;
        if (!ex) continue;
        if (ex.pat) pp[ex.pat] = (pp[ex.pat] || 0) + n * f;
        for (const [m, c] of Object.entries(ex.m || {})) { pv[m] = (pv[m] || 0) + n * c * f * k; if (c >= 1) prim[m] = true; }
      }
    }
    return { t, pv, pp, prim, load };
  }

  /* exercises the programme lacks, spread over the days so that no day gets all of them */
  function additions(workouts, cfg, pl) {
    const ctx = { z: cfg.zones, pv: m => pl.pv[m] || 0, pp: p => pl.pp[p] || 0, prim: m => !!pl.prim[m] };
    const load = Object.assign({}, pl.load), out = {};
    for (const sl of SLOTS) out[sl.id] = [];
    for (const a of ADDS) {
      if (!a.need(ctx)) continue;
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
    const base = plan(workouts, cfg, slot, date), z = cfg.zones, prog = program(past), pl = planned(past, cfg), props = [];
    const dps = allStats(past, cfg).filter(s => s.active && !isCycle(cfg, s.id) && s.n >= 2);
    const worse = dps.filter(s => s.last.metric < s.ss[s.n - 2].metric * 0.98);
    const deload = dps.length >= 6 && worse.length >= dps.length / 2;
    const short = {}, over = {}, used = {};
    for (const m of MUSCLES) { const v = pl.pv[m.id] || 0; if (v > 0 && v < z.opt - 0.5 && pl.prim[m.id]) short[m.id] = v; if (v > z.high) over[m.id] = v; }
    const q = n => n + ' ' + plural(n, ['день', 'дня', 'дней']);

    base.items.forEach((it, idx) => {
      const ex = cfg.ex[it.ex] || { m: {} }, s = exStats(past, cfg, it.ex, prog);
      const gap = s ? dnum(date) - dnum(s.last.date) : 0;
      const push = (tag, notes, sets, cyc) => props.push({ key: it.ex, ex: it.ex, idx, tag, notes, sets, cyc: cyc || null });

      if (it.cyc) {
        const c = planCycle(workouts, cfg, it.ex, date), rq = +ex.round || 2.5;
        if (!c.prev) return;
        const ss = sessions(past, cfg, it.ex).filter(x => x.item.cyc);
        const failed = x => { const p = x.item.sets.filter(k => !k.warm); return p.some(k => k.r == null || k.r < x.item.cyc.reps); };
        const flat = w => +roundTo(w, rq).toFixed(3);
        if (deload) {
          const w = flat(c.prev.tm * c.pct / 100), n = Math.max(1, Math.ceil(c.sets / 2));
          push('Разгрузка', [n + ' × ' + c.reps + ' по ' + fmt(w) + ' кг вместо ' + c.sets + ' × ' + c.reps + ' по ' + fmt(c.w) + ': половина подходов, максимум без прибавки'], Array.from({ length: n }, () => ({ w, tg: [c.reps, c.reps] })), { pct: c.pct, reps: c.reps });
        } else if (ss.length >= 2 && failed(ss[ss.length - 1]) && failed(ss[ss.length - 2])) {
          const order = cycleOrder(cfg), r0 = order[0], p0 = cfg.cycle.pct[r0], tm = c.prev.tm * 0.9, w = flat(tm * p0 / 100);
          push('Плато', ['два раза подряд подходы не закрыты: расчётный максимум −10% (до ' + fmt(tm, 1) + ' кг), волна заново с ' + c.sets + ' × ' + r0 + ' по ' + fmt(w) + ' кг'], Array.from({ length: c.sets }, () => ({ w, tg: [r0, r0] })), { pct: p0, reps: r0 });
        } else if (gap >= 14 && !c.repeat && !c.hard) {
          const w = flat(c.prev.tm * c.pct / 100);
          if (w !== c.w) push('После перерыва', [q(gap) + ' без этого упражнения: ' + fmt(w) + ' кг вместо ' + fmt(c.w) + ', волна идёт дальше без прибавки к максимуму'], Array.from({ length: c.sets }, () => ({ w, tg: [c.reps, c.reps] })), { pct: c.pct, reps: c.reps });
        } else if (!c.repeat && !c.hard) {
          const qs = c.prev.sets.filter(k => k.q != null).map(k => k.q);
          if (qs.length) {
            const exp = estRir(c.prev.item.cyc.pct, c.prev.item.cyc.reps), mn = Math.min(...qs);
            const same = Array.from({ length: c.sets }, w => w), cy = { pct: c.pct, reps: c.reps };
            if (mn >= exp + 2) {
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
        const seen = p.q != null && p.q !== 1 ? p.r + ' ' + plural(p.r, ['повтор', 'повтора', 'повторов']) + ' с запасом ' + p.q : null;
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
        if (short[m] != null && sets.length < 5 && s && s.status === 'up' && (!used[m] || ex.uni)) {
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

    const adds = deload ? [] : additions(past, cfg, pl)[slot] || [];
    /* what is switched on by default: every change of weight, at most two extra sets and one new exercise per workout */
    const off0 = {};
    let extra = 0;
    for (const p of props) {
      const d = (p.sets.length - base.items[p.idx].sets.length) * ((cfg.ex[p.ex] || {}).uni ? 0.5 : 1);
      if (d > 0) { if (extra + d > 2) off0[p.key] = true; else extra += d; }
    }
    adds.slice().sort((a, b) => a.a.prio - b.a.prio).forEach((d, i) => { if (i > 0) off0[d.key] = true; });
    return { base, props, adds, off0, deload, worse: worse.length, of: dps.length };
  }

  /* the plan with the chosen proposals applied; `off` holds the keys the athlete unticked */
  function applyAdapt(a, off) {
    off = off || {};
    const items = clone(a.base.items), create = {}, used = [];
    for (const p of a.props) {
      if (off[p.key] || !items[p.idx]) continue;
      items[p.idx].sets = p.sets.map(x => ({ w: x.w, r: null }));
      if (p.cyc) items[p.idx].cyc = { pct: p.cyc.pct, reps: p.cyc.reps };
      used.push(p.key);
    }
    for (const d of a.adds) {
      if (off[d.key]) continue;
      if (d.def) create[d.exId] = d.def;
      items.push({ ex: d.exId, cyc: null, range: d.range.slice(), sets: Array.from({ length: d.sets }, () => ({ w: null, r: null })), note: '', skip: false, rir: null });
      used.push(d.key);
    }
    return { items, create, used };
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
      for (const m of MUSCLES) by[zone(avg[m.id], z)].push(m);
      const tag = m => m.n + ' ' + fmt(avg[m.id], 1);
      const fixes = ms => ms.map(m => m.n.toLowerCase() + ' — ' + FIX[m.id]).join('; ');
      if (by.none.length) add('crit', 'Объём', 'Без нагрузки: ' + list(by.none.map(m => m.n.toLowerCase())),
        'За ' + refTxt + ' эти мышцы не получили ни одного подхода, даже косвенно. Для цели «мышцы и сила везде» это главный пробел программы. Что добавить: ' + fixes(by.none) + '.', 'muscles');
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

    /* progress per exercise */
    const stats = allStats(workouts, cfg).filter(s => s.active);
    const dp = stats.filter(s => !isCycle(cfg, s.id));
    for (const s of dp) {
      if (s.status === 'flat' || s.status === 'down') {
        const p = s.pr.best;
        add('warn', 'Прогресс', (s.status === 'down' ? 'Откат: ' : 'Застой: ') + exName(cfg, s.id),
          'Лучший подход (' + fmt(p.w) + ' × ' + p.r + ') был ' + s.sincePR + ' ' + plural(s.sincePR, ['тренировку', 'тренировки', 'тренировок']) + ' назад, ' + fmtDate(s.pr.date, true) + '. ' +
          (s.status === 'down' ? 'Последний результат ниже рекорда больше чем на 5%. Проверь сон, питание и отдых между подходами; если так же в других упражнениях — нужна разгрузочная неделя.'
            : 'Убедись, что подход идёт до RIR 1. Если да — сбрось вес на 10% на 1–2 недели и набери повторы заново, либо смени вариант упражнения.'), 'progress');
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
        lines.push(exName(cfg, s.id) + ': расчётный максимум ' + fmt(s.first.tm, 1) + ' → ' + fmt(s.last.tm, 1) + ' кг (' + signed(pct(s.last.tm, s.first.tm)) + '% за ' + wk + ' ' + plural(wk, ['неделю', 'недели', 'недель']) + '), дальше ' + fmt(p.w) + ' × ' + p.reps);
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
    if (!body.length) add('info', 'Вес тела', 'Вес тела пока не записан',
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
    const from = wi.ref.length ? wi.ref[0].from : workouts[0].date;
    const L = [];
    L.push('Ты — тренер по силовой подготовке. Разбери тренировочный дневник и дай практические рекомендации на ближайшие 1–2 недели.');
    L.push('Отвечай по-русски, коротко и конкретно: до 8 пунктов, каждый — что именно изменить (упражнение, вес, подходы, повторы) и почему, с цифрами из дневника. Сначала самое важное. Без общих слов и без медицинских советов. Оформи как маркированный список, заголовки не нужны.');
    L.push('');
    L.push('МЕТОДИКА АТЛЕТА: ' + (cfg.method || 'не описана'));
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
    work, e1, topSet, bestSet, effReps, estRir, setRir, setVol, cycleVol, sortW, sessions, exStats, allStats, weeksInfo, volume, zone, avgVolume, strengthIndex,
    program, stalledSets, planned, additions, adapt, applyAdapt, lastSessionItem, inferStep, stepOf, formulaRange, suggestSet, planCycle, hints, nextSlot, nextDate, plan,
    bodyRate, insights, toCsv, coachPrompt
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
