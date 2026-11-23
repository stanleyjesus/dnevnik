/* ---------- UI part 1: DOM helpers, state, storage, charts ---------- */
const C = Core;
const SVGNS = 'http://www.w3.org/2000/svg';
function mk(ns, tag, attrs, kids) {
  const el = ns ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'value' && !ns) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') { el[k] = true; el.setAttribute(k, ''); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  put(el, kids);
  return el;
}
function put(el, kids) { for (const k of kids) { if (k == null || k === false) continue; if (Array.isArray(k)) put(el, k); else el.appendChild(k.nodeType ? k : document.createTextNode(String(k))); } }
const h = (t, a, ...k) => mk(false, t, a, k);
const sv = (t, a, ...k) => mk(true, t, a, k);
const $ = id => document.getElementById(id);
const toNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const toInt = v => { const n = parseInt(String(v), 10); return isNaN(n) ? null : n; };

const ICONS = {
  good: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-4-4 1.4-1.4 2.6 2.6 5.4-5.4 1.4 1.4z',
  warn: 'M12 2.5L1.5 21h21zM11 9h2v6h-2zm0 8h2v2h-2z',
  serious: 'M12 2l10 10-10 10L2 12zM11 7h2v6h-2zm0 8h2v2h-2z',
  crit: 'M12 2a10 10 0 100 20 10 10 0 000-20zm4.2 12.8l-1.4 1.4L12 13.4l-2.8 2.8-1.4-1.4 2.8-2.8-2.8-2.8 1.4-1.4 2.8 2.8 2.8-2.8 1.4 1.4-2.8 2.8z',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v2h-2zm0 4h2v6h-2z',
  up: 'M12 5l7 8h-4.5v6h-5v-6H5z', down: 'M12 19l-7-8h4.5V5h5v6H19z',
  x: 'M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z', minus: 'M5 11h14v2H5z',
  over: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4.5l5 5.5h-3.5v5.5h-3V12H7z',
  arrowU: 'M12 6l-6 6 1.4 1.4L11 9.8V19h2V9.8l3.6 3.6L18 12z', arrowD: 'M12 18l6-6-1.4-1.4L13 14.2V5h-2v9.2l-3.6-3.6L6 12z',
  skip: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 016.3 12.9L7.1 5.7A8 8 0 0112 4zM5.7 7.1l11.2 11.2A8 8 0 015.7 7.1z',
  bar: 'M2 9h2v6H2zm3-3h2.5v12H5zm11.5 0H19v12h-2.5zM20 9h2v6h-2zM8.5 11h7v2h-7z'
};
const icon = n => sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, sv('path', { d: ICONS[n] || ICONS.info, fill: 'currentColor' }));
const pill = (sev, label) => h('span', { class: 'pill ' + sev }, icon(sev), label);

/* ---------- state ---------- */
const S = {
  profile: 'me', profiles: [{ id: 'me', n: 'Мой дневник' }], gen: 0, unsubs: [],
  db: null, conn: 'connecting', slow: false, canWrite: true, sample: null, downloads: null,
  workouts: [], cfgRaw: null, cfg: C.mergeCfg(null), body: [], coach: null,
  view: 'overview', draft: null, draftSaved: null, saving: false, dirty: false,
  ui: { exSel: null, exAll: false, metric: 'w', cell: null, plan: null, confirm: null, exForm: null, hist: false, q: '', coachBusy: false, coachText: null, coachErr: null, prog: null, bodyBy: null, bodySel: null }
};
let D = null;
const VIEWS = [['overview', 'Обзор'], ['workout', 'Тренировка'], ['journal', 'Журнал'], ['progress', 'Прогресс'], ['muscles', 'Мышцы'], ['coach', 'Советы'], ['program', 'Программа'], ['setup', 'Настройка']];

/* every profile keeps its own records; the first one stays where the diary always kept them */
const paths = pid => pid === 'me' ? { w: 'workouts', cfg: 'config/main', body: 'body', coach: 'notes/coach', draft: 'td-draft' }
  : { w: 'workouts_' + pid, cfg: 'config/' + pid, body: 'body_' + pid, coach: 'notes/coach_' + pid, draft: 'td-draft-' + pid };
const PT = () => paths(S.profile);
const profName = () => (S.profiles.find(p => p.id === S.profile) || { n: '' }).n;

function derive() {
  const today = C.todayStr();
  C.setTarget(S.cfg.rir);
  const cfg = S.cfg.start ? S.cfg : Object.assign({}, S.cfg, { start: C.mondayOf(S.workouts.length ? S.workouts[0].date : today) });
  const W = S.workouts;
  const st = { workouts: W, cfg, body: S.body, today };
  const wi = C.weeksInfo(W, cfg, today), vol = C.volume(W, cfg), av = C.avgVolume(vol, wi.ref);
  const stats = C.allStats(W, cfg);
  const slot = C.nextSlot(W, today);
  return {
    today, cfg, W, st, wi, vol, avg: av.avg, avgS: av.avgS, pat: av.pat, stats, statBy: Object.fromEntries(stats.map(s => [s.id, s])),
    ins: C.insights(st), idx: C.strengthIndex(W, cfg), prog: C.program(W, cfg), slot, date: C.nextDate(slot, today, W),
    openW: W.find(w => w.open) || null
  };
}

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
const dbErr = e => { const c = e && e.code; toast(c === 'quota_exceeded' ? 'Хранилище заполнено: удали старые записи' : c === 'invalid_argument' ? 'Запись отклонена: нет прав на изменение' : 'Не удалось сохранить. Проверь связь и повтори'); if (c === 'invalid_argument') { S.canWrite = false; } };

/* ---------- storage ---------- */
async function boot() {
  route();
  render(true);
  const cl = window.claude;
  if (!cl || typeof cl.use !== 'function') { S.conn = 'none'; render(true); return; }
  let db = null;
  try { db = await cl.use('db'); } catch (e) { db = null; }
  if (!db) { S.conn = 'none'; render(true); return; }
  S.db = db;
  try { const p = localStorage.getItem('td-profile'); if (p && /^[a-z0-9]{1,24}$/.test(p)) S.profile = p; } catch (e) { /* storage may be unavailable */ }
  db.doc('config/profiles').onSnapshot(snap => {
    const raw = snap.exists && Array.isArray((snap.data() || {}).list) ? snap.data().list : [];
    const list = raw.filter(p => p && /^[a-z0-9]{1,24}$/.test(String(p.id)) && p.id !== 'main' && p.id !== 'profiles').map(p => ({ id: String(p.id), n: String(p.n || p.id).slice(0, 40) }));
    S.profiles = list.some(p => p.id === 'me') ? list : [{ id: 'me', n: 'Мой дневник' }].concat(list);
    if (!S.profiles.some(p => p.id === S.profile)) openProfile('me'); else softRender();
  }, () => {});
  openProfile(S.profile);
  cl.use('user').then(u => u && u.can ? u.can('data.write') : null).then(v => { if (v === false) { S.canWrite = false; softRender(); } }).catch(() => {});
  cl.use('sample').then(f => { S.sample = f || null; softRender(); }).catch(() => {});
  cl.use('downloads').then(d => { S.downloads = d || null; softRender(); }).catch(() => {});
}

/* load one profile: drop the previous subscriptions and state, subscribe to this profile's records */
function openProfile(pid) {
  const gen = ++S.gen, db = S.db, pt = paths(pid), live = () => gen === S.gen;
  for (const u of S.unsubs) { try { if (typeof u === 'function') u(); } catch (e) { /* already closed */ } }
  S.unsubs = [];
  clearTimeout(saveT);
  S.profile = pid;
  try { localStorage.setItem('td-profile', pid); } catch (e) { /* storage may be unavailable */ }
  S.workouts = []; S.cfgRaw = null; S.cfg = C.mergeCfg(null); S.body = []; S.coach = null;
  S.draft = null; S.draftSaved = null; S.dirty = false; S.saving = false;
  Object.assign(S.ui, { exSel: null, exAll: false, cell: null, plan: null, confirm: null, exForm: null, hist: false, q: '', coachBusy: false, coachText: null, coachErr: null, prog: null });
  S.conn = 'loading'; S.slow = false;
  const got = { w: false, c: false };
  const slow = setTimeout(() => { if (live() && S.conn === 'loading') { S.slow = true; render(true); } }, 10000);
  const fail = e => { if (!live()) return; clearTimeout(slow); if (S.conn !== 'ready') S.conn = 'error'; render(true); };
  const ready = () => {
    if (got.w && got.c && S.conn !== 'ready') { clearTimeout(slow); S.slow = false; S.conn = 'ready'; restoreDraft(); render(true); return; }
    softRender();
  };
  S.unsubs.push(db.collection(pt.w).limit(1000).onSnapshot(snap => {
    if (!live()) return;
    S.workouts = C.sortW(snap.docs.map(d => C.fromDoc(d.id, d.data())));
    /* an open workout that was finished or removed on another device must not linger here */
    if (S.draft && S.draft.open && S.draftSaved && !S.dirty && !S.saving && !snap.metadata.fromCache) {
      const srv = S.workouts.find(w => w.id === S.draftSaved);
      if (!srv || !srv.open) { S.draft = null; S.draftSaved = null; backupDraft(); got.w = true; if (S.conn === 'ready') { render(true); return; } }
    }
    got.w = true; ready();
  }, fail));
  S.unsubs.push(db.doc(pt.cfg).onSnapshot(snap => { if (!live()) return; S.cfgRaw = snap.exists ? C.clone(snap.data()) : null; S.cfg = C.mergeCfg(S.cfgRaw); got.c = true; ready(); }, fail));
  S.unsubs.push(db.collection(pt.body).limit(1000).onSnapshot(snap => {
    if (!live()) return;
    S.body = snap.docs.map(d => ({ id: d.id, date: (d.data() || {}).date || d.id, kg: +(d.data() || {}).kg })).filter(x => x.kg > 0).sort((x, y) => x.date < y.date ? -1 : 1);
    softRender();
  }, () => {}));
  S.unsubs.push(db.doc(pt.coach).onSnapshot(snap => { if (!live()) return; S.coach = snap.exists ? C.clone(snap.data()) : null; softRender(); }, () => {}));
  render(true);
}
async function switchProfile(pid) {
  if (pid === S.profile || !S.db) return;
  if (S.draft && S.dirty) { const ok = await flushSave(); if (!ok) { toast('Тренировка не сохранилась. Сохрани её и переключись ещё раз'); paintTop(); return; } }
  openProfile(pid);
  toast('Дневник: ' + profName());
}
async function saveProfiles(list) {
  if (!S.db) return false;
  try { await S.db.doc('config/profiles').set({ list }); S.profiles = list; return true; } catch (e) { dbErr(e); return false; }
}

const filled = w => w.items.reduce((n, it) => n + it.sets.filter(s => s.r != null).length, 0);
function restoreDraft() {
  const open = S.workouts.find(w => w.open);
  let local = null;
  try { local = JSON.parse(localStorage.getItem(PT().draft) || 'null'); } catch (e) { local = null; }
  if (open) {
    S.draft = (local && local.id === open.id && local.open && filled(local) > filled(open)) ? local : C.clone(open);
    S.draftSaved = open.id;
    if (S.draft === local) queueSave();
  } else if (local && local.open && S.canWrite && C.dnum(C.todayStr()) - C.dnum(local.date) <= 1 && !S.workouts.some(w => w.id === local.id)) {
    S.draft = local; S.draftSaved = null; queueSave();
  }
}
function backupDraft() { try { if (S.draft && S.draft.open) localStorage.setItem(PT().draft, JSON.stringify(S.draft)); else localStorage.removeItem(PT().draft); } catch (e) { /* storage may be unavailable */ } }

let saveT = 0;
function touch() { S.dirty = true; backupDraft(); if (S.draft && S.draft.open) queueSave(); setSaveState(); paintEta(); }
function queueSave() { clearTimeout(saveT); saveT = setTimeout(saveDraft, 2500); }
async function saveDraft() {
  clearTimeout(saveT);
  const d = S.draft;
  if (!d || !S.db || !S.canWrite) return false;
  if (S.saving) { queueSave(); return false; }
  S.saving = true; setSaveState();
  const doc = C.toDoc(d), id = d.id, prev = S.draftSaved, gen = S.gen, col = PT().w;
  try {
    await S.db.doc(col + '/' + id).set(doc);
    if (prev && prev !== id) { try { await S.db.doc(col + '/' + prev).delete(); } catch (e) { /* old copy stays; harmless */ } }
    if (gen !== S.gen) return true;                                   // another profile was opened meanwhile
    S.draftSaved = id;
    if (S.draft === d && JSON.stringify(C.toDoc(d)) === JSON.stringify(doc)) S.dirty = false;
    S.saving = false; setSaveState();
    return true;
  } catch (e) { if (gen === S.gen) { S.saving = false; setSaveState(); } dbErr(e); return false; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function flushSave() { clearTimeout(saveT); for (let i = 0; S.saving && i < 100; i++) await sleep(100); return saveDraft(); }
function setSaveState() {
  const el = $('save-state');
  if (!el) return;
  el.textContent = S.saving ? 'сохраняю…' : S.dirty ? (S.draft && S.draft.open ? 'есть несохранённые изменения' : 'изменения не сохранены') : 'сохранено';
}
function uniqueId(date, self) {
  const ids = new Set(S.workouts.map(w => w.id));
  if (self) ids.delete(self);
  if (!ids.has(date)) return date;
  for (let k = 2; k < 20; k++) if (!ids.has(date + '-' + k)) return date + '-' + k;
  return date + '-' + Date.now();
}
async function saveCfg(mut) {
  const raw = C.clone(S.cfgRaw || {});
  if (!raw.ex) raw.ex = {};
  mut(raw);
  S.cfgRaw = raw; S.cfg = C.mergeCfg(raw);
  if (!S.db) return false;
  try { await S.db.doc(PT().cfg).set(raw); return true; } catch (e) { dbErr(e); return false; }
}

/* ---------- routing + render loop ---------- */
function route() { const v = (location.hash || '').replace('#', ''); S.view = VIEWS.some(x => x[0] === v) ? v : 'overview'; }
let stale = false, raf = 0;
function softRender() {
  const a = document.activeElement;
  if (a && $('view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { stale = true; paintTop(); return; }
  if (S.view === 'workout' && S.draft) { stale = true; paintTop(); return; }
  cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(true));
}
function render(force) {
  stale = false;
  D = derive();
  paintTop();
  const v = $('view');
  const y = window.scrollY;
  v.textContent = '';
  const wrap = h('div', { class: 'wrap stack' });
  if (S.conn === 'none' || S.conn === 'error') wrap.appendChild(h('div', { class: 'banner crit' }, h('b', null, 'Дневник не подключился к хранилищу. '), 'Записи не загрузились, и новые сейчас не сохранятся. Открой страницу в Claude под своим аккаунтом и обнови её.'));
  else if (S.conn !== 'ready') wrap.appendChild(h('div', { class: 'banner' }, S.slow ? 'Данные пока не загрузились. Проверь связь — страница продолжает попытки.' : 'Загружаю дневник…'));
  else if (!S.canWrite) wrap.appendChild(h('div', { class: 'banner' }, 'Дневник открыт только для чтения: изменять записи может владелец.'));
  put(wrap, [VIEW_FN[S.view]()]);
  v.appendChild(wrap);
  drawCharts();
  for (const el of v.querySelectorAll('.to-end')) el.scrollLeft = el.scrollWidth;
  if (!force) window.scrollTo(0, 0); else window.scrollTo(0, y);
}
function paintTop() {
  const d = D || derive();
  const cur = d.wi.weeks.find(w => w.current);
  $('week-badge').textContent = cur ? 'Неделя ' + cur.no + ' · ' + C.fmtDate(cur.from) + ' – ' + C.fmtDate(cur.to) : '';
  const s = $('sync');
  s.className = 'sync ' + (S.conn === 'ready' ? 'ok' : S.conn === 'none' || S.conn === 'error' ? 'bad' : 'busy');
  s.lastChild.textContent = S.conn === 'ready' ? 'хранилище на связи' : S.conn === 'none' || S.conn === 'error' ? 'нет связи с хранилищем' : 'загрузка';
  const ps = $('prof-slot');
  if (ps && document.activeElement !== $('prof')) {
    ps.textContent = '';
    if (S.profiles.length > 1 && S.db) ps.appendChild(h('select', { id: 'prof', class: 'prof', 'aria-label': 'Чей дневник открыт', onchange: e => switchProfile(e.target.value) }, S.profiles.map(p => h('option', { value: p.id, selected: p.id === S.profile, text: p.n }))));
  }
  const tabs = $('tabs');
  tabs.textContent = '';
  const crit = d.ins.some(i => i.sev === 'crit');
  for (const [id, name] of VIEWS) tabs.appendChild(h('a', { href: '#' + id, 'aria-current': S.view === id ? 'page' : null }, name, id === 'workout' && S.draft && S.draft.open ? h('span', { class: 'dot', title: 'тренировка идёт' }) : null, id === 'coach' && crit ? h('span', { class: 'dot', title: 'есть важные замечания' }) : null));
}
function go(v) { if (location.hash === '#' + v) { route(); render(); } else location.hash = v; }

/* ---------- charts (drawn after the view is in the document, at its real width) ---------- */
let chartQ = [];
function chartHost(draw, cls) { const el = h('div', { class: 'chart ' + (cls || '') }); chartQ.push([el, draw]); return el; }
function drawCharts() { const q = chartQ; chartQ = []; for (const [el, draw] of q) if (el.isConnected) { try { draw(el, el.clientWidth || 320); } catch (e) { el.textContent = 'График не построился'; } } }

function niceTicks(lo, hi, n) {
  if (!(hi > lo)) { hi = lo + 1; lo = lo - 1; }
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(6));
  return t;
}
function tipBox(host) { let t = host.querySelector('.tip'); if (!t) { t = h('div', { class: 'tip' }); t.style.display = 'none'; host.appendChild(t); } return t; }
function showTip(host, t, x, y, W) {
  t.style.display = 'block';
  const tw = t.offsetWidth;
  t.style.left = Math.max(0, Math.min(W - tw, x + 12 > W - tw ? x - tw - 12 : x + 12)) + 'px';
  t.style.top = Math.max(0, y) + 'px';
}
function tipRows(t, title, rows) {
  t.textContent = '';
  t.appendChild(h('div', { class: 'th', text: title }));
  for (const r of rows) { const k = h('i', { class: 'key' }); if (r.color) k.style.borderTopColor = r.color; t.appendChild(h('div', { class: 'tr' }, r.color ? k : null, h('b', { text: r.v }), h('span', { text: r.k }))); }
}

/* line chart. o: {series:[{name,color,pts:[{x(day),y}],area,end}], dots:{name,pts:[{x,y}]}, h, unit, start, tip(x)->rows, title(x)} */
function lineChart(host, W, o) {
  const H = o.h || 220, m = { l: 38, r: o.endPad || 46, t: 12, b: 24 };
  const all = [];
  for (const s of o.series) for (const p of s.pts) all.push(p);
  if (!all.length) { host.appendChild(h('div', { class: 'empty', text: 'Пока нет данных для графика' })); return; }
  const xs = Array.from(new Set(all.map(p => p.x))).sort((a, b) => a - b);
  let x0 = xs[0], x1 = xs[xs.length - 1];
  if (x1 - x0 < 7) { x0 -= 3; x1 += 4; }
  let lo = Math.min(...all.map(p => p.y)), hi = Math.max(...all.map(p => p.y));
  if (o.dots) for (const p of o.dots.pts) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  const pad = (hi - lo || hi * 0.1 || 1) * 0.1;
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r), Y = y => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b);
  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': o.label || 'График' });
  for (const t of ticks) {
    svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === lo ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }));
    svg.appendChild(sv('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', text: C.fmt(t, 1) }));
  }
  if (o.start != null) {             /* week ticks along the bottom */
    const w0 = Math.floor((x0 - o.start) / 7) + 1, w1 = Math.floor((x1 - o.start) / 7) + 1;
    const every = Math.max(1, Math.ceil((w1 - w0 + 1) / Math.max(2, Math.floor((W - m.l - m.r) / 44))));
    for (let k = w0; k <= w1; k++) {
      const x = o.start + (k - 1) * 7;
      if (x < x0 || x > x1 || (k - w0) % every) continue;
      svg.appendChild(sv('line', { x1: X(x), x2: X(x), y1: H - m.b, y2: H - m.b + 4, stroke: 'var(--axis)' }));
      svg.appendChild(sv('text', { x: X(x), y: H - 6, 'text-anchor': 'middle', text: 'н' + k }));
    }
  }
  if (o.dots) for (const p of o.dots.pts) svg.appendChild(sv('circle', { cx: X(p.x), cy: Y(p.y), r: 3.5, fill: 'var(--deemph)', stroke: 'var(--surface)', 'stroke-width': 1.5 }));
  for (const s of o.series) {
    if (!s.pts.length) continue;
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
    if (s.area && s.pts.length > 1) svg.appendChild(sv('path', { d: d + 'L' + X(s.pts[s.pts.length - 1].x).toFixed(1) + ' ' + Y(lo) + 'L' + X(s.pts[0].x).toFixed(1) + ' ' + Y(lo) + 'Z', fill: s.color, opacity: .1 }));
    svg.appendChild(sv('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (s.pts.length <= 40) for (const p of s.pts) svg.appendChild(sv('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
    if (s.end) { const p = s.pts[s.pts.length - 1]; svg.appendChild(sv('text', { class: 'end', x: X(p.x) + 9, y: Y(p.y) + 4, text: C.fmt(p.y, 1) })); }
  }
  const cross = sv('line', { y1: m.t, y2: H - m.b, stroke: 'var(--ink-2)', 'stroke-width': 1, visibility: 'hidden' });
  svg.appendChild(cross);
  const hit = sv('rect', { x: m.l - 8, y: 0, width: W - m.l - m.r + 16, height: H - m.b, fill: 'transparent', tabindex: 0, 'aria-label': 'Значения по тренировкам: веди указателем или стрелками' });
  svg.appendChild(hit);
  if (o.series.length + (o.dots ? 1 : 0) >= 2) {
    const lg = h('div', { class: 'legend' });
    for (const s of o.series) { const k = h('i', { class: 'key' }); k.style.borderTopColor = s.color; lg.appendChild(h('span', null, k, s.name)); }
    if (o.dots) lg.appendChild(h('span', null, h('i', { class: 'sw' }), o.dots.name));
    host.appendChild(lg);
  }
  host.appendChild(svg);
  const tip = tipBox(host);
  let cur = xs.length - 1;
  const at = i => {
    cur = Math.max(0, Math.min(xs.length - 1, i));
    const x = xs[cur];
    cross.setAttribute('x1', X(x)); cross.setAttribute('x2', X(x)); cross.setAttribute('visibility', 'visible');
    const rows = o.tip ? o.tip(x) : o.series.map(s => { const p = s.pts.find(q => q.x === x); return p ? { color: s.color, v: C.fmt(p.y, 1) + (o.unit || ''), k: s.name } : null; }).filter(Boolean);
    tipRows(tip, o.title ? o.title(x) : C.fmtDay(C.dstr(x)), rows);
    showTip(host, tip, X(x), svg.getBoundingClientRect().top - host.getBoundingClientRect().top + m.t, W);
  };
  const off = () => { cross.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; };
  hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width); let b = 0; xs.forEach((x, i) => { if (Math.abs(X(x) - px) < Math.abs(X(xs[b]) - px)) b = i; }); at(b); });
  hit.addEventListener('pointerleave', off);
  hit.addEventListener('focus', () => at(cur));
  hit.addEventListener('blur', off);
  hit.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { at(cur - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { at(cur + 1); e.preventDefault(); } });
}

/* column chart. o: {bars:[{label,v,note,muted}], h, unit} */
function barChart(host, W, o) {
  const H = o.h || 200, m = { l: 34, r: 8, t: 16, b: 24 }, n = o.bars.length;
  if (!n) { host.appendChild(h('div', { class: 'empty', text: 'Пока нет данных' })); return; }
  const ticks = niceTicks(0, Math.max(...o.bars.map(b => b.v), 1), 4), hi = ticks[ticks.length - 1];
  const Y = y => m.t + (1 - y / hi) * (H - m.t - m.b), slot = (W - m.l - m.r) / n, bw = Math.min(24, Math.max(4, slot - 4));
  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': o.label || 'Диаграмма' });
  for (const t of ticks) {
    svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === 0 ? 'var(--axis)' : 'var(--grid)' }));
    svg.appendChild(sv('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', text: C.fmt(t, 0) }));
  }
  host.appendChild(svg);
  const tip = tipBox(host), every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - m.l - m.r) / 36))));
  o.bars.forEach((b, i) => {
    const cx = m.l + slot * (i + .5), y = Y(b.v), ht = Math.max(0, H - m.b - y), r = Math.min(4, bw / 2, ht);
    const g = sv('g', { tabindex: 0, role: 'img', 'aria-label': b.label + ': ' + C.fmt(b.v, 1) + (o.unit || '') });
    if (ht > 0) g.appendChild(sv('path', { d: 'M' + (cx - bw / 2) + ' ' + (H - m.b) + 'V' + (y + r) + 'q0 ' + (-r) + ' ' + r + ' ' + (-r) + 'h' + (bw - 2 * r) + 'q' + r + ' 0 ' + r + ' ' + r + 'V' + (H - m.b) + 'Z', fill: b.muted ? 'var(--deemph)' : 'var(--s1)' }));
    g.appendChild(sv('rect', { x: cx - slot / 2, y: m.t, width: slot, height: H - m.t - m.b, fill: 'transparent' }));
    const on = () => { tipRows(tip, b.title || b.label, [{ v: C.fmt(b.v, 1) + (o.unit || ''), k: b.note || '' }]); showTip(host, tip, cx, Math.max(0, y - 44), W); };
    const offf = () => { tip.style.display = 'none'; };
    g.addEventListener('pointerenter', on); g.addEventListener('pointerleave', offf); g.addEventListener('focus', on); g.addEventListener('blur', offf);
    svg.appendChild(g);
    if (i % every === 0) svg.appendChild(sv('text', { x: cx, y: H - 6, 'text-anchor': 'middle', text: b.label }));
    if (i === n - 1 || b.v === Math.max(...o.bars.map(q => q.v))) svg.appendChild(sv('text', { class: 'end', x: cx, y: y - 5, 'text-anchor': 'middle', text: C.fmt(b.v, 0) }));
  });
}

function spark(vals, color) {
  const W = 96, H = 30, n = vals.length;
  const svg = sv('svg', { class: 'spark', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
  if (n < 2) return svg;
  const lo = Math.min(...vals), hi = Math.max(...vals), X = i => 3 + i / (n - 1) * (W - 9), Y = v => 4 + (1 - (hi > lo ? (v - lo) / (hi - lo) : .5)) * (H - 8);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  svg.appendChild(sv('path', { d: d + 'L' + X(n - 1) + ' ' + H + 'L' + X(0) + ' ' + H + 'Z', fill: color || 'var(--s1)', opacity: .1 }));
  svg.appendChild(sv('path', { d, fill: 'none', stroke: color || 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  svg.appendChild(sv('circle', { cx: X(n - 1), cy: Y(vals[n - 1]), r: 3.5, fill: color || 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 }));
  return svg;
}

/* weekly sets against the zones */
function meter(v, z) {
  const max = Math.max(z.high * 1.2, v * 1.05), p = x => Math.min(100, x / max * 100) + '%';
  const zone = h('i', { class: 'zone' }); zone.style.left = p(z.opt); zone.style.width = (Math.min(100, z.high / max * 100) - z.opt / max * 100) + '%';
  const fill = h('i', { class: 'fill z-' + C.zone(v, z) }); fill.style.width = p(v);
  const t1 = h('i', { class: 'tick' }); t1.style.left = p(z.min);
  return h('div', { class: 'meter', role: 'img', 'aria-label': C.fmt(v, 1) + ' подходов в неделю' }, zone, fill, t1);
}
const zonePill = (v, z) => { const k = C.zone(v, z); return pill(C.ZONE[k].sev, C.ZONE[k].n); };
const setChip = (s, cls) => h('span', { class: 'chip ' + (cls || '') + (s.warm ? ' warmup' : s.skip ? ' off' : s.r == null ? ' hole' : ''), title: s.warm ? 'разминочный' : s.skip ? 'не делал' : s.r == null ? 'повторы не записаны' : s.q != null ? 'в запасе повторов: ' + s.q : null }, C.fmt(s.w) + ' × ' + (s.skip ? '–' : s.r == null ? '?' : s.r), s.q != null && s.r != null && !s.skip ? h('small', null, 'r' + s.q) : null);
