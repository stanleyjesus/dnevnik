/* Экран «Настройка».
   Перенесено из reference/src/ui3.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C, h, icon, toInt, toNum } from './dom.ts';
import { paths, profName, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { saveCfg, saveProfiles, switchProfile } from './storage.ts';
import { D, render } from './render.ts';
import { goalTag } from './overview.ts';

import { importBox, pickBackup } from './importer.ts';
import { deviceNote } from './device.ts';
import { dropExButton, starterTools } from './starter.ts';
import type { ExDef, ExGuess, MuscleMap } from '../core/index.ts';
import type { Db, El, Kid, Profile, RawCfg } from './types.ts';
import type { Backup } from '../data/backup.ts';

/* ---------- setup ---------- */
export const PAT_OPTS = () => C.PATTERNS.map(p => [p.id, p.n]);
/* kinds of equipment: each has a weight step, and every exercise lies in exactly one of them or in «без снаряда».
   An exercise has no step of its own: it works with the step of the place it lies in. */
export function gearBlock() {
  const cfg = D.cfg, ro = !S.canWrite, NONE = C.NO_GEAR, kinds = C.gearList(cfg);
  const ids = Object.keys(cfg.ex).filter(id => cfg.ex[id].mode !== 'light').sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const at = (id: string) => C.gearOf(cfg, id), nm = (g: string) => cfg.gear[g].n;
  const fresh = () => { S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null; };      // the plan and the programme draft were counted with the old steps
  const setStep = async (g: string, val: string) => {
    const v = toNum(val);
    if (!(v! > 0)) { toast('Шаг должен быть больше нуля'); render(true); return; }
    if (v === cfg.gear[g].step) return;
    if (await saveCfg(r => { r.gear = r.gear || {}; r.gear[g] = Object.assign({}, r.gear[g], { step: v }); })) toast('Шаг сохранён: ' + nm(g).toLowerCase() + ' — ' + C.fmt(v) + ' кг');
    fresh(); render(true);
  };
  const move = async (id: string, g: string) => { if (!id || !cfg.ex[id] || !cfg.gear[g]) return; await saveCfg(r => { const e = r.ex[id]; if (!e) return; e.gear = g; delete e.step; delete e.round; }); fresh(); render(true); };
  const addKind = async () => { const id = 'g_' + Date.now().toString(36); if (!(await saveCfg(r => { r.gear = r.gear || {}; r.gear[id] = { n: 'Новый снаряд', step: 2.5 }; }))) return; S.ui.gearFocus = { id, until: Date.now() + 1500 }; render(true); };
  const rename = async (g: string, val: string) => { S.ui.gearFocus = null; const v = val.trim().slice(0, 30); if (!v || v === nm(g)) { render(true); return; } await saveCfg(r => { r.gear![g] = Object.assign({}, r.gear![g], { n: v }); }); render(true); };
  /* without its kind an exercise goes where its name points, else to «без снаряда» */
  const delKind = async (g: string) => { await saveCfg(r => { delete r.gear![g]; for (const e of Object.values(r.ex)) if (e.gear === g) delete e.gear; }); fresh(); toast('Снаряд убран'); render(true); };
  const stepInput = (g: string) => h('label', { class: 'row', style: 'gap:6px;font-size:13px;flex-wrap:nowrap' }, 'Шаг, кг', h('input', { class: 'num sm', type: 'text', inputmode: 'decimal', id: 'gear-step-' + g, 'aria-label': 'Шаг веса: ' + nm(g), value: C.fmt(cfg.gear[g].step, 3), disabled: ro, onchange: e => setStep(g, e.target.value) }));
  const box = (g: string) => {
    const k = cfg.gear[g], mine = ids.filter(id => at(id) === g);
    const rest = ids.filter(id => at(id) !== g).sort((a, b) => (at(a) === NONE ? 0 : 1) - (at(b) === NONE ? 0 : 1));       // not sorted yet go first
    return h('div', { class: 'pday', id: 'gear-' + g },
      h('div', { class: 'pday-h', style: 'align-items:center' },
        k.own ? h('input', { type: 'text', class: 'gear-n', id: 'gear-n-' + g, 'aria-label': 'Название снаряда', value: k.n, disabled: ro, onchange: e => rename(g, e.target.value) }) : h('b', null, k.n),
        h('div', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, stepInput(g),
          k.own && !ro ? h('button', { class: 'icon-btn', id: 'gear-del-' + g, title: 'Убрать снаряд', 'aria-label': 'Убрать снаряд: ' + k.n, onclick: () => delKind(g) }, icon('x')) : null)),
      h('div', { class: 'chips', style: 'justify-content:flex-start;margin:8px 0' }, mine.length ? mine.map(id => h('span', { class: 'chip' }, C.exName(cfg, id),
        ro ? null : h('button', { class: 'icon-btn', style: 'width:20px;height:20px', title: 'Убрать со снаряда', 'aria-label': 'Убрать со снаряда: ' + C.exName(cfg, id), onclick: () => move(id, NONE) }, icon('x')))) : h('span', { class: 'sub' }, 'Упражнений пока нет.')),
      ro || !rest.length ? null : h('div', { class: 'row', style: 'flex-wrap:nowrap' },
        h('select', { id: 'gear-add-' + g, class: 'grow', style: 'min-width:0', 'aria-label': 'Упражнение для снаряда: ' + k.n }, rest.map(id => h('option', { value: id, text: C.exName(cfg, id) + (at(id) === NONE ? '' : ' (' + nm(at(id)).toLowerCase() + ')') }))),
        h('button', { class: 'btn sm', id: 'gear-btn-' + g, onclick: () => move($('gear-add-' + g)!.value, g) }, icon('plus'), 'Добавить')));
  };
  /* what is not sorted yet, by name, each with its own way to a kind of equipment */
  const loose = ids.filter(id => at(id) === NONE);
  const looseBox = h('div', { class: 'pday gear-loose', id: 'gear-' + NONE },
    h('div', { class: 'pday-h', style: 'align-items:center' }, h('b', null, 'Без снаряда', h('span', { class: 'cnt', id: 'gear-loose-n' }, ' ' + loose.length)), stepInput(NONE)),
    loose.length
      ? h('div', { class: 'chips', style: 'justify-content:flex-start;margin:8px 0 2px' }, loose.map(id => h('span', { class: 'chip' }, C.exName(cfg, id),
          ro ? null : h('select', { class: 'chip-sel', id: 'gear-to-' + id, 'aria-label': 'Снаряд для: ' + C.exName(cfg, id), onchange: e => move(id, e.target.value) },
            h('option', { value: '', text: 'снаряд…' }), kinds.map(x => h('option', { value: x.id, text: x.n }))))))
      : h('p', { class: 'sub', style: 'margin:8px 0 2px' }, 'Все упражнения разложены по снарядам.'));
  const out = h('div', { style: 'margin-bottom:14px' },
    h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:4px' }, h('div', { class: 'eyebrow' }, 'Снаряды'),
      ro ? null : h('button', { class: 'btn ghost sm', id: 'gear-new', onclick: addKind }, icon('plus'), 'Снаряд')),
    h('p', { class: 'note', style: 'margin-bottom:10px' }, 'Шаг веса задаётся у снаряда: упражнение берёт шаг того снаряда, в котором лежит.'),
    h('div', { class: 'gear-grid' }, kinds.map(x => box(x.id)), looseBox));
  /* a new kind waits for its name: the save is followed by a redraw or two, and the cursor has to survive them */
  { const f = S.ui.gearFocus; if (f && Date.now() < f.until) setTimeout(() => { const el = $('gear-n-' + f.id); if (el && S.ui.gearFocus === f && document.activeElement !== el) { el.focus(); el.select(); } }, 0); else S.ui.gearFocus = null; }
  return out;
}
/* weights the athlete names before the journal has them: a working weight or a one-rep maximum for every exercise */
export function knownBlock() {
  const cfg = D.cfg, ro = !S.canWrite, done = D.W.filter(w => !w.open);
  const cur = C.currentSlots(D.W, cfg), live = (id: string) => cfg.ex[id] && cfg.ex[id].mode !== 'light';
  const inProg = [...new Set(C.SLOTS.flatMap(sl => cur[sl.id].map(e => e.ex)))].filter(live);
  const rest = Object.keys(cfg.ex).filter(id => live(id) && !inProg.includes(id)).sort((a, b) => C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const logged = (id: string) => C.lastSessionItem(done, id, null, null);
  /* what the first plan will take; read from the fresh config, so the line follows the typing without redrawing the page */
  const startText = (id: string) => {
    const c = S.cfg, s = C.startOf(D.W, c, id);
    if (!s) return 'вес подберёшь на первой тренировке';
    if (s.pct) return 'старт: ' + C.fmt(s.w) + ' кг — ' + s.pct + '% от максимума ' + C.fmt(s.tm, 1) + ', ' + C.waveOf(c, id).sets(s.reps) + ' × ' + s.reps;
    return 'старт: ' + C.fmt(s.w) + ' кг на ' + C.rangeOf(D.W, c, id).join('–') + ' повторов' + (s.src === 'work' ? '' : ' (от максимума ' + C.fmt(C.knownMax(c, id), 1) + ')');
  };
  const set = async (id: string, k: 'work' | 'workR' | 'max', el: El) => {
    const txt = el.value.trim(), v = toNum(txt);
    if (txt && !(v! > 0)) { toast('Нужно число больше нуля'); el.value = ''; return; }
    const val = txt ? (k === 'workR' ? Math.max(1, Math.round(v!)) : v) : null;
    if ((+S.cfg.ex[id][k]! || null) === val) return;
    if (!(await saveCfg(r => { const e = r.ex[id]; if (!e) return; if (val) e[k] = val; else delete e[k]; }))) return;
    S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null;
    const out = $('kw-out-' + id); if (out) out.textContent = startText(id);
    toast(C.exName(S.cfg, id) + ': ' + (val ? 'сохранено' : 'убрано'));
  };
  const inp = (id: string, k: 'work' | 'workR' | 'max', ph: string, lab: string) => h('input', { class: 'num sm', type: 'text', inputmode: k === 'workR' ? 'numeric' : 'decimal', id: 'kw-' + k + '-' + id, placeholder: ph, 'aria-label': lab + ': ' + C.exName(cfg, id), value: +cfg.ex[id][k]! > 0 ? C.fmt(+cfg.ex[id][k]!, 3) : '', disabled: ro, onchange: e => set(id, k, e.target) });
  const row = (id: string) => {
    const p = logged(id), nm = h('div', { class: 'kw-n' }, C.exName(cfg, id), C.isCycle(cfg, id) ? h('span', { class: 'tag', style: 'margin-left:6px' }, 'волна') : null);
    if (p) {
      const sets = p.it.sets.filter(x => !x.warm && x.w != null), top = sets.length ? sets.reduce((t, x) => x.w! > t.w! || (x.w === t.w && (x.r || 0) > (t.r || 0)) ? x : t, sets[0]) : null;
      return h('div', { class: 'kw-row' }, nm, h('div', { class: 'kw-log sub' }, 'Есть в журнале' + (top ? ': ' + C.fmt(top.w) + ' кг' + (top.r != null ? ' × ' + top.r : '') + ', ' + C.fmtDate(p.w.date) : '') + ' — веса берутся из него.'));
    }
    return h('div', { class: 'kw-row' }, nm, inp(id, 'work', 'раб. кг', 'Рабочий вес, кг'), inp(id, 'workR', 'повт.', 'Повторов с рабочим весом'), inp(id, 'max', 'макс. кг', 'Разовый максимум, кг'), h('div', { class: 'kw-out sub', id: 'kw-out-' + id, text: startText(id) }));
  };
  /* in sight: the programme's exercises that still need a weight; the rest is one line each */
  const need = inProg.filter(id => !logged(id)), spare = rest.filter(id => !logged(id)), have = inProg.concat(rest).filter(id => logged(id));
  const fold = (title: string, ids: string[]) => ids.length ? h('details', { style: 'margin-top:10px' }, h('summary', { class: 'sub', style: 'cursor:pointer' }, title), h('div', { class: 'kw', style: 'margin-top:8px' }, ids.map(row))) : null;
  const head = h('div', { class: 'kw-row kw-head' }, h('span', null, 'Упражнение'), h('span', null, 'Рабочий вес, кг'), h('span', null, 'Повторов'), h('span', null, 'Разовый максимум, кг'), h('span', null, 'Что возьмёт дневник'));
  return h('div', { style: 'margin-bottom:14px', id: 'known' },
    h('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Известные веса'),
    h('p', { class: 'note', style: 'margin-bottom:10px' }, 'Для упражнений, которых ещё нет в журнале: рабочий вес или разовый максимум, хватит одного. С них стартует первая тренировка.'),
    need.length ? h('div', { class: 'kw' }, head, need.map(row)) : (inProg.length ? null : h('p', { class: 'sub' }, 'В программе пока нет упражнений.')),
    fold('Остальные упражнения: ' + spare.length, spare),
    fold('Уже в журнале: ' + have.length + ' — веса берутся из него', have));
}
/* the choice of equipment in a form: by name, a kind, or none */
export const gearSelect = (id: string, cur: string | null | undefined) => h('select', { id }, h('option', { value: '', text: 'по названию', selected: !cur }),
  C.gearList(D.cfg).map(x => h('option', { value: x.id, text: x.n + ' · шаг ' + C.fmt(x.step) + ' кг', selected: cur === x.id })),
  h('option', { value: C.NO_GEAR, text: 'без снаряда · шаг ' + C.fmt(D.cfg.gear[C.NO_GEAR].step) + ' кг', selected: cur === C.NO_GEAR }));
export const musText = (m: MuscleMap | null | undefined) => Object.entries(m || {}).sort((a, b) => b[1] - a[1]).map(x => (C.MUSCLE[x[0]] || { n: x[0] }).n + (x[1] < 1 ? ' ½' : '')).join(', ');
export const musGrid = (pre: string, m: MuscleMap | null | undefined) => h('div', { class: 'mgrid' }, C.MUSCLES.map(x => h('label', null, x.n, h('select', { id: pre + 'm-' + x.id }, [[0, 'нет'], [0.5, 'помогает · 0.5'], [1, 'основная · 1']].map(o => h('option', { value: o[0], text: o[1], selected: ((m || {})[x.id] || 0) === o[0] }))))));
export const musRead = (pre: string) => { const m: MuscleMap = {}; for (const x of C.MUSCLES) { const v = +$(pre + 'm-' + x.id)!.value; if (v) m[x.id] = v; } return m; };
/* a new exercise: a name and a kind of equipment. What it trains the diary reads from the name;
   a name it does not know is not sent anywhere (the app makes no requests to a model): the athlete marks the muscles. */
export function newExForm(done: (id?: string | null) => void) {
  const ui = S.ui, st = ui.newEx || (ui.newEx = { n: '', gear: '', ask: false });
  const pre = 'nx-';
  const close = (id: string | null) => { ui.newEx = null; done(id); };
  const store = async (def: ExGuess) => {
    const o: ExDef = { n: st.n, pat: def.pat || 'iso', m: def.m };
    if (def.uni) o.uni = true;
    if (st.gear) o.gear = st.gear;
    const nid = 'x_' + Date.now().toString(36);
    if (await saveCfg(raw => { raw.ex[nid] = o; })) toast('Добавлено: ' + st.n + ' — ' + musText(o.m).toLowerCase());
    if (S.ui.prog) S.ui.prog.draft = null;
    close(nid);
  };
  const save = async () => {
    st.n = $(pre + 'n')!.value.trim().slice(0, 80); st.gear = $(pre + 'gear')!.value;
    if (!st.n) { toast('Назови упражнение'); return; }
    if (Object.values(D.cfg.ex).some(e => e.n.toLowerCase() === st.n.toLowerCase())) { toast('Такое упражнение уже есть'); return; }
    if (st.ask) { const m = musRead(pre); if (!Object.values(m).some(v => v === 1)) { toast('Отметь хотя бы одну основную мышцу'); return; } return store({ pat: 'iso', m }); }
    const def = C.guessEx(st.n);
    if (def) return store(def);
    st.ask = true; render(true);
  };
  return h('div', { class: 'stack', style: 'gap:12px' },
    h('div', { class: 'form-grid' },
      h('label', { class: 'f' }, h('span', null, 'Название'), h('input', { type: 'text', id: pre + 'n', value: st.n, placeholder: 'например, Тяга к лицу на блоке', onkeydown: e => { if (e.key === 'Enter') save(); } })),
      h('label', { class: 'f' }, h('span', null, 'Снаряд'), gearSelect(pre + 'gear', st.gear))),
    st.ask ? h('div', null, h('p', { class: 'note', style: 'margin-bottom:6px' }, 'Не узнал это упражнение по названию. Отметь, какие мышцы работают.'), musGrid(pre, {})) : null,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', id: pre + 'save', onclick: save }, 'Добавить упражнение'), h('button', { class: 'btn', onclick: () => close(null) }, 'Отмена')));
}
export function exForm(id: string | null, done: (id: string | null) => void) {
  const e: ExDef = id ? C.clone(D.cfg.ex[id]) : { n: '', m: {}, pat: 'iso' };
  const raw: Partial<ExDef> = id ? ((S.cfgRaw || {}).ex || {})[id] || {} : {};
  const pre = 'xf-' + (id || 'new') + '-';
  const fld = (lab: string, el: Kid) => h('label', { class: 'f' }, h('span', null, lab), el);
  const save = async () => {
    const g = (k: string) => $(pre + k);
    const name = g('n')!.value.trim();
    if (!name) { toast('Назови упражнение'); return; }
    const o: ExDef = { n: name, pat: g('pat')!.value, m: musRead(pre) };
    if (g('gear')!.value) o.gear = g('gear')!.value;
    if (g('mode')!.value === 'cycle') o.mode = 'cycle';
    const lo = toInt(g('lo')!.value), hi = toInt(g('hi')!.value);
    if (lo && hi && hi > lo && (lo !== 8 || hi !== 12)) { o.lo = lo; o.hi = hi; }
    if (g('uni')!.checked) o.uni = true;
    if (e.goal) o.goal = e.goal;
    for (const k of ['max', 'work', 'workR'] as const) if (+e[k]! > 0) o[k] = +e[k]!;      // named weights live in their own block and stay
    if (!Object.keys(o.m).length) { toast('Отметь хотя бы одну мышцу'); return; }
    const nid = id || 'x_' + Date.now().toString(36);
    const ok = await saveCfg(r => { r.ex[nid] = o; });
    if (ok) toast('Упражнение сохранено');
    S.ui.plan = null; if (S.ui.prog) S.ui.prog.draft = null;
    done(nid);
  };
  return h('div', { class: 'stack', style: 'gap:12px' },
    h('div', { class: 'form-grid' },
      fld('Название', h('input', { type: 'text', id: pre + 'n', value: e.n || '' })),
      fld('Прогрессия', h('select', { id: pre + 'mode' }, h('option', { value: 'dp', text: 'Двойная прогрессия', selected: e.mode !== 'cycle' }), h('option', { value: 'cycle', text: 'Волна от максимума', selected: e.mode === 'cycle' }))),
      fld('Тип движения', h('select', { id: pre + 'pat' }, PAT_OPTS().map(o => h('option', { value: o[0], text: o[1], selected: (e.pat || 'iso') === o[0] })))),
      fld('Снаряд (шаг веса — от него)', gearSelect(pre + 'gear', raw.gear && D.cfg.gear[raw.gear] ? raw.gear : '')),
      fld('Диапазон повторов по умолчанию', h('div', { class: 'row' }, h('input', { class: 'num sm', type: 'text', inputmode: 'numeric', id: pre + 'lo', 'aria-label': 'Нижняя граница', value: e.lo || 8 }), '–', h('input', { class: 'num sm', type: 'text', inputmode: 'numeric', id: pre + 'hi', 'aria-label': 'Верхняя граница', value: e.hi || 12 })))),
    h('label', { class: 'row', style: 'font-size:13px' }, h('input', { type: 'checkbox', id: pre + 'uni', checked: !!e.uni }), 'Правая и левая сторона записаны отдельными упражнениями (каждое считается за половину подхода)'),
    h('div', null, h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Какие мышцы работают'), musGrid(pre, e.m)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'Сохранить упражнение'), h('button', { class: 'btn', onclick: () => done(null) }, 'Отмена')));
}
/* everything the diary keeps, for every profile, as one JSON document: a backup and the way to move the records elsewhere */
export async function exportAll() {
  const db = S.db as Db, out: Backup = { format: 'training-diary-backup', version: 1, exportedAt: new Date().toISOString(), profiles: [] };
  for (const p of S.profiles) {
    const pt = paths(p.id);
    const [cfg, ws, bs, co] = await Promise.all([db.doc(pt.cfg).get(), db.collection(pt.w).limit(1000).get(), db.collection(pt.body).limit(1000).get(), db.doc(pt.coach).get()]);
    out.profiles.push({ id: p.id, name: p.n, config: cfg.exists ? cfg.data() : null, workouts: ws.docs.map(d => Object.assign({ id: d.id }, d.data())), body: bs.docs.map(d => Object.assign({ id: d.id }, d.data())), coach: co.exists ? co.data() : null });
  }
  return JSON.stringify(out, null, 1);
}
export async function saveBackup() {
  if (!S.db) return;
  let data;
  try { data = await exportAll(); } catch (e) { toast('Не получилось собрать копию. Повтори ещё раз'); return; }
  if (S.downloads) { try { await S.downloads.save({ filename: 'dnevnik-backup-' + D.today + '.json', data }); return; } catch (e: any) { if (e && e.code === 'declined') return; } }
  try { await navigator.clipboard.writeText(data); toast('Копия скопирована в буфер: вставь её в файл .json'); } catch (e) { toast('Браузер не дал сохранить копию'); }
}
/* whose diaries live on this page */
export function profilesCard() {
  const ro = !S.canWrite;
  const rename = async (p: Profile, v: string) => { v = v.trim().slice(0, 40); if (!v || v === p.n) return; if (await saveProfiles(S.profiles.map(x => x.id === p.id ? { id: x.id, n: v } : x))) { toast('Имя сохранено'); render(true); } };
  const add = async () => {
    const name = $('pr-new')!.value.trim().slice(0, 40);
    if (!name) { toast('Назови профиль'); return; }
    const id = 'p' + Date.now().toString(36), copy = $('pr-copy')!.checked, ex: Record<string, ExDef> = {};
    if (copy) for (const [k, e] of Object.entries((S.cfgRaw || {}).ex || {})) { if (e.mode === 'light') continue; ex[k] = C.clone(e); delete ex[k].goal; }
    const doc: RawCfg = { start: C.mondayOf(D.today), zones: C.clone(D.cfg.zones), cycle: C.clone(D.cfg.cycle), method: '', ex };
    if (copy && (S.cfgRaw || {}).gear) doc.gear = C.clone(S.cfgRaw!.gear);
    try { await S.db!.doc(paths(id).cfg).set(doc); } catch (e) { dbErr(e); return; }
    if (!(await saveProfiles(S.profiles.concat([{ id, n: name }])))) return;
    switchProfile(id);
  };
  return h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Профили'), h('p', { class: 'note' }, 'У каждого профиля свои тренировки, программа, упражнения и настройка. Переключатель — в шапке страницы; всё ниже относится к открытому профилю: ' + profName() + '.'))),
    h('div', { class: 'plan-list' }, S.profiles.map(p => h('div', { class: 'plan-row', style: 'align-items:center' },
      h('input', { type: 'text', id: 'pr-n-' + p.id, 'aria-label': 'Имя профиля', value: p.n, disabled: ro, style: 'flex:1 1 200px', onchange: e => rename(p, e.target.value) }),
      p.id === S.profile ? h('span', { class: 'tag accent' }, 'открыт') : h('button', { class: 'btn sm', onclick: () => switchProfile(p.id) }, 'Открыть')))),
    ro ? null : h('div', { class: 'row', style: 'margin-top:12px;align-items:flex-end' },
      h('label', { class: 'f grow' }, h('span', null, 'Новый профиль'), h('input', { type: 'text', id: 'pr-new', placeholder: 'Имя' })),
      h('label', { class: 'row', style: 'font-size:13px;min-height:40px' }, h('input', { type: 'checkbox', id: 'pr-copy', checked: true }), 'скопировать упражнения из открытого'),
      h('button', { class: 'btn', id: 'pr-add', onclick: add }, icon('plus'), 'Добавить')));
}
export function vSetup() {
  if (S.conn !== 'ready') return [];
  const out = [], cfg = D.cfg, ui = S.ui, ro = !S.canWrite;
  /* блока «Лимиты и методика» здесь нет (решение владельца, 18 ноября 2026): методика зашита в расчёт и видна в программе и в поправках плана.
     Сохранённые в профиле лимиты, зоны, запас и волна действуют как раньше; отдых выбирается в «Тренировке» и «Программе» */
  const rest = [profilesCard()];

  /* exercises: the kinds of equipment are the list; a new one needs a name only */
  out.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('h2', null, 'Упражнения'),
      ro || ui.exForm === 'new' ? null : h('button', { class: 'btn', id: 'ex-new', onclick: () => { ui.exForm = 'new'; ui.newEx = null; render(true); } }, icon('plus'), 'Новое упражнение')),
    ui.exForm === 'new' ? h('div', { class: 'card', style: 'margin-bottom:14px' }, newExForm(() => { ui.exForm = null; render(true); })) : null,
    starterTools(),
    gearBlock(),
    knownBlock()));

  /* the catalogue with names, ranges, progression and muscles: rarely needed, so it lives in the folded part */
  const ids = Object.keys(cfg.ex).sort((a, b) => (D.prog.has(b) - D.prog.has(a)) || C.exName(cfg, a).localeCompare(C.exName(cfg, b), 'ru'));
  const list = [];
  for (const id of ids) {
    const e = cfg.ex[id];
    if (ui.exForm === id) { list.push(h('div', { class: 'card', style: 'margin:8px 0' }, exForm(id, () => { ui.exForm = null; render(true); }))); continue; }
    list.push(h('div', { class: 'plan-row' }, h('span', { class: 'n' }, e.n, D.prog.has(id) ? null : h('span', { class: 'muted' }, ' · не в программе')),
      h('span', { class: 'sub', style: 'flex:2 1 220px' }, (goalTag(cfg, id) ? goalTag(cfg, id) + ' · ' : '') + (e.mode === 'light' ? C.lightOf(cfg, id).sets + ' × ' + C.lightOf(cfg, id).reps + ' на ' + C.lightOf(cfg, id).pct + '% от максимума в «' + C.exName(cfg, e.of!) + '»' : cfg.gear[C.gearOf(cfg, id)].n.toLowerCase() + ' · ' + (e.mode === 'cycle' ? 'волна, ' : '') + 'шаг ' + C.fmt((e.mode === 'cycle' ? e.round : e.step) || 2.5) + ' кг') + ' · ' + (musText(e.m) || 'мышцы не указаны')),
      ro || e.mode === 'light' ? null : h('button', { class: 'btn ghost sm', onclick: () => { ui.exForm = id; render(true); } }, 'Изменить'),
      dropExButton(id)));
  }
  rest.push(h('section', { class: 'card', id: 'catalogue' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Справочник упражнений'), h('p', { class: 'note' }, 'Название, прогрессия, диапазон повторов и мышцы каждого упражнения. Мышцы дневник определяет сам по названию; здесь их можно поправить.'))),
    h('div', { class: 'plan-list' }, list.length ? list : h('p', { class: 'sub' }, 'Справочник пуст.'))));

  /* data */
  const csv = () => C.toCsv(D.W, cfg);
  rest.push(h('section', { class: 'card' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', null, 'Данные'), h('p', { class: 'note' }, 'Записей в дневнике: ' + D.W.length + '. Они хранятся на этом устройстве и никуда не отправляются. Выгрузка — таблица «один подход в строке».'))),
    h('div', { class: 'row' },
      S.downloads ? h('button', { class: 'btn', onclick: async () => { try { await S.downloads!.save({ filename: 'trenirovki-' + D.today + '.csv', data: '﻿' + csv() }); } catch (e: any) { if (!e || e.code !== 'declined') toast('Файл не сохранился. Попробуй скопировать таблицу'); } } }, 'Скачать CSV') : null,
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(csv()); toast('Таблица скопирована'); } catch (e) { toast('Браузер не дал скопировать'); } } }, 'Скопировать CSV'),
      h('button', { class: 'btn', id: 'backup-all', onclick: saveBackup }, 'Резервная копия всех профилей (JSON)'),
      S.canWrite ? h('button', { class: 'btn', id: 'import-backup', onclick: pickBackup }, 'Загрузить копию из файла') : null),
    h('p', { class: 'note', style: 'margin-top:8px' }, 'CSV — тренировки открытого профиля. Резервная копия — всё сразу: профили, настройка, программы, тренировки и вес тела. Это единственный способ перенести записи на другое устройство или вернуть их, если это сломается.'),
    h('p', { class: 'note', id: 'device-note', style: 'margin-top:6px' }, deviceNote()),
    importBox()));
  /* the rest is needed rarely: one folded line keeps it within reach without crowding the page */
  out.push(h('details', { class: 'morebox', id: 'setup-more', open: !!ui.setupMore, ontoggle: e => { ui.setupMore = e.target.open; } },
    h('summary', null, 'Остальные настройки: профили, справочник, данные'), rest));
  return out;
}
