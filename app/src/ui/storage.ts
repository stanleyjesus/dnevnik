/* Связь с хранилищем: профили, записи, черновик идущей тренировки.
   Перенесено из reference/src/ui1.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $, C } from './dom.ts';
import { paths, profName, PT, S } from './state.ts';
import { dbErr, toast } from './toast.ts';
import { paintTop, render, route, softRender } from './render.ts';
import { paintEta } from './overview.ts';
import { platform, weekDays } from './platform.ts';
import { daysOf, useDays } from '../core/days.ts';
import { withStarter } from '../core/starter.ts';
import type { Workout } from '../core/index.ts';
import type { Db, Profile, RawCfg, Timer } from './types.ts';

/* ---------- storage ---------- */
export async function boot() {
  route();
  render(true);
  const cl = platform;                                                // было window.claude: хранилище и файлы даёт само приложение
  if (!cl || typeof cl.use !== 'function') { S.conn = 'none'; render(true); return; }
  let db = null;
  try { db = await cl.use('db'); } catch (e) { db = null; }
  if (!db) { S.conn = 'none'; render(true); return; }
  S.db = db;
  try { const p = localStorage.getItem('td-profile'); if (p && /^[a-z0-9]{1,24}$/.test(p)) S.profile = p; } catch (e) { /* storage may be unavailable */ }
  db.doc('config/profiles').onSnapshot(snap => {
    const raw: { id?: unknown, n?: unknown }[] = snap.exists && Array.isArray((snap.data() || {}).list) ? snap.data().list : [];
    const list = raw.filter(p => p && /^[a-z0-9]{1,24}$/.test(String(p.id)) && p.id !== 'main' && p.id !== 'profiles').map(p => ({ id: String(p.id), n: String(p.n || p.id).slice(0, 40) }));
    S.profiles = list.some(p => p.id === 'me') ? list : [{ id: 'me', n: 'Мой дневник' }].concat(list);
    if (!S.profiles.some(p => p.id === S.profile)) openProfile('me'); else softRender();
  }, () => {});
  openProfile(S.profile);
  cl.use('user').then(u => u && u.can ? u.can('data.write') : null).then(v => { if (v === false) { S.canWrite = false; softRender(); } }).catch(() => {});
  cl.use('downloads').then(d => { S.downloads = d || null; softRender(); }).catch(() => {});
}
/* load one profile: drop the previous subscriptions and state, subscribe to this profile's records */
export function openProfile(pid: string) {
  const gen = ++S.gen, db = S.db as Db, pt = paths(pid), live = () => gen === S.gen;
  for (const u of S.unsubs) { try { if (typeof u === 'function') u(); } catch (e) { /* already closed */ } }
  S.unsubs = [];
  clearTimeout(saveT);
  S.profile = pid;
  try { localStorage.setItem('td-profile', pid); } catch (e) { /* storage may be unavailable */ }
  S.workouts = []; S.cfgRaw = null; S.cfg = C.mergeCfg(null); S.body = []; S.coach = null;
  useDays(null, weekDays());                                          // дни «День 1…N»; сколько их у профиля, станет известно с его настройкой
  S.draft = null; S.draftSaved = null; S.dirty = false; S.saving = false;
  Object.assign(S.ui, { exSel: null, exAll: false, cell: null, plan: null, confirm: null, exForm: null, hist: false, q: '', coachBusy: false, coachText: null, coachErr: null, prog: null });
  S.conn = 'loading'; S.slow = false;
  const got = { w: false, c: false };
  const slow = setTimeout(() => { if (live() && S.conn === 'loading') { S.slow = true; render(true); } }, 10000);
  const fail = (e: unknown) => { if (!live()) return; clearTimeout(slow); if (S.conn !== 'ready') S.conn = 'error'; render(true); };
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
  S.unsubs.push(db.doc(pt.cfg).onSnapshot(snap => { if (!live()) return; S.cfgRaw = withStarter(snap.exists ? C.clone(snap.data()) : null); S.cfg = C.mergeCfg(S.cfgRaw); useDays(daysOf(S.cfgRaw), weekDays()); got.c = true; ready(); }, fail));   // профиль без упражнений получает встроенный справочник
  S.unsubs.push(db.collection(pt.body).limit(1000).onSnapshot(snap => {
    if (!live()) return;
    S.body = snap.docs.map(d => ({ id: d.id, date: (d.data() || {}).date || d.id, kg: +(d.data() || {}).kg })).filter(x => x.kg > 0).sort((x, y) => x.date < y.date ? -1 : 1);
    softRender();
  }, () => {}));
  S.unsubs.push(db.doc(pt.coach).onSnapshot(snap => { if (!live()) return; S.coach = snap.exists ? C.clone(snap.data()) : null; softRender(); }, () => {}));
  render(true);
}
export async function switchProfile(pid: string) {
  if (pid === S.profile || !S.db) return;
  if (S.draft && S.dirty) { const ok = await flushSave(); if (!ok) { toast('Тренировка не сохранилась. Сохрани её и переключись ещё раз'); paintTop(); return; } }
  openProfile(pid);
  toast('Дневник: ' + profName());
}
export async function saveProfiles(list: Profile[]) {
  if (!S.db) return false;
  try { await S.db.doc('config/profiles').set({ list }); S.profiles = list; return true; } catch (e) { dbErr(e); return false; }
}
export const filled = (w: Workout) => w.items.reduce((n, it) => n + it.sets.filter(s => s.r != null).length, 0);
export function restoreDraft() {
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
export function backupDraft() { try { if (S.draft && S.draft.open) localStorage.setItem(PT().draft, JSON.stringify(S.draft)); else localStorage.removeItem(PT().draft); } catch (e) { /* storage may be unavailable */ } }
export let saveT: Timer = 0;
export function touch() { S.dirty = true; backupDraft(); if (S.draft && S.draft.open) queueSave(); setSaveState(); paintEta(); }
export function queueSave() { clearTimeout(saveT); saveT = setTimeout(saveDraft, 2500); }
export async function saveDraft() {
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
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function flushSave() { clearTimeout(saveT); for (let i = 0; S.saving && i < 100; i++) await sleep(100); return saveDraft(); }
export function setSaveState() {
  const el = $('save-state');
  if (!el) return;
  el.textContent = S.saving ? 'сохраняю…' : S.dirty ? (S.draft && S.draft.open ? 'есть несохранённые изменения' : 'изменения не сохранены') : 'сохранено';
}
export function uniqueId(date: string, self?: string | null) {
  const ids = new Set(S.workouts.map(w => w.id));
  if (self) ids.delete(self);
  if (!ids.has(date)) return date;
  for (let k = 2; k < 20; k++) if (!ids.has(date + '-' + k)) return date + '-' + k;
  return date + '-' + Date.now();
}
export async function saveCfg(mut: (raw: RawCfg) => void) {
  const raw = C.clone(S.cfgRaw || {}) as RawCfg;
  if (!raw.ex) raw.ex = {};
  mut(raw);
  S.cfgRaw = raw; S.cfg = C.mergeCfg(raw);
  if (!S.db) return false;
  try { await S.db.doc(PT().cfg).set(raw); return true; } catch (e) { dbErr(e); return false; }
}
