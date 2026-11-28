/* Резервная копия всех профилей: формат training-diary-backup, docs/02-data-model.md, раздел 5.
   Выгрузка повторяет артефакт. Импорт заменяет всё содержимое хранилища содержимым копии,
   а копия прежнего дневника поверх своей программы дополняет историю (mergeBackup; просьба владельца, 28 ноября 2026). */
import type { Doc, Store, WriteOp } from '../store/types.ts';
import type { ExDef } from '../core/types.ts';
import { paths, PROFILES_DOC, validProfileId } from './paths.ts';
import { readProfiles } from './profiles.ts';
import { exKey, fillStarter, needGear, withStarter } from '../core/starter.ts';
import { GEAR, NO_GEAR } from '../core/gear.ts';

export const BACKUP_FORMAT = 'training-diary-backup';
export const BACKUP_VERSION = 1;

/** Документ коллекции в копии: тот же документ и его id */
export type BackupDoc = Doc & { id: string };
export interface BackupProfile { id: string; name: string; config: Doc | null; workouts: BackupDoc[]; body: BackupDoc[]; coach: Doc | null }
/** app — копию выгрузило это приложение с днями «День N» (у копии первой версии этой пометки нет): такая копия при загрузке
    заменяет записи, а не дополняет историю (mergeBackup) */
export interface Backup { format: string; version: number; exportedAt: string; app?: boolean; profiles: BackupProfile[] }

/** Ошибка копии: code — для программы, message — для человека */
export class BackupError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'BackupError'; this.code = code; }
}

/* ---------- выгрузка ---------- */

export async function exportBackup(store: Store, now: Date = new Date(), app?: boolean): Promise<Backup> {
  const out: Backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), profiles: [] };
  if (app) out.app = true;
  for (const p of await readProfiles(store)) {
    const pt = paths(p.id);
    const [cfg, ws, bs, co] = await Promise.all([store.get(pt.cfg), store.list(pt.w), store.list(pt.body), store.get(pt.coach)]);
    out.profiles.push({ id: p.id, name: p.n, config: cfg, workouts: ws.map(d => Object.assign({ id: d.id }, d.data)), body: bs.map(d => Object.assign({ id: d.id }, d.data)), coach: co });
  }
  return out;
}
export const backupText = (b: Backup): string => JSON.stringify(b, null, 1);
export const backupFileName = (today: string): string => 'dnevnik-backup-' + today + '.json';

/* ---------- проверка ---------- */

const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

/** Проверяет устройство копии и возвращает её; то, что не читается как копия, — BackupError с объяснением */
export function checkBackup(v: unknown): Backup {
  if (!isObj(v) || v.format !== BACKUP_FORMAT) throw new BackupError('not_backup', 'Это не резервная копия дневника: в файле нет пометки «' + BACKUP_FORMAT + '».');
  if (typeof v.version !== 'number' || !(v.version >= 1)) throw new BackupError('bad_version', 'В копии не указана версия формата.');
  if (v.version > BACKUP_VERSION) throw new BackupError('newer_version', 'Копия сделана более новой версией дневника (формат ' + v.version + '). Это приложение читает формат ' + BACKUP_VERSION + '.');
  if (!Array.isArray(v.profiles) || !v.profiles.length) throw new BackupError('no_profiles', 'В копии нет ни одного профиля.');
  const seen = new Set<string>();
  const profiles = v.profiles.map((p: unknown, i: number): BackupProfile => {
    const no = 'Профиль № ' + (i + 1);
    if (!isObj(p)) throw new BackupError('bad_profile', no + ': запись повреждена.');
    const id = p.id;
    if (!validProfileId(id)) throw new BackupError('bad_profile', no + ': неверный идентификатор.');
    if (seen.has(id)) throw new BackupError('bad_profile', no + ': идентификатор «' + id + '» встречается дважды.');
    seen.add(id);
    const name = typeof p.name === 'string' && p.name.trim() ? p.name : id, at = 'Профиль «' + name + '»';
    if (p.config != null && !isObj(p.config)) throw new BackupError('bad_config', at + ': настройка повреждена.');
    if (p.coach != null && !isObj(p.coach)) throw new BackupError('bad_doc', at + ': разбор повреждён.');
    const docs = (list: unknown, what: string, ok: (d: Doc) => boolean): BackupDoc[] => {
      if (list == null) return [];
      if (!Array.isArray(list)) throw new BackupError('bad_list', at + ': ' + what + ' — ожидался список.');
      const ids = new Set<string>();
      return list.map((d: unknown, k: number): BackupDoc => {
        if (!isObj(d) || typeof d.id !== 'string' || !ID.test(d.id) || ids.has(d.id) || !ok(d)) throw new BackupError('bad_doc', at + ': ' + what + ', запись № ' + (k + 1) + ' повреждена.');
        ids.add(d.id);
        return d as BackupDoc;
      });
    };
    return {
      id, name,
      config: isObj(p.config) ? p.config : null,
      /* как и при чтении тренировки: даты и списка упражнений может не быть, но если они есть — это строка и список */
      workouts: docs(p.workouts, 'тренировки', d => (d.date == null || typeof d.date === 'string') && (d.items == null || Array.isArray(d.items))),
      body: docs(p.body, 'вес тела', () => true),
      coach: isObj(p.coach) ? p.coach : null
    };
  });
  const out: Backup = { format: BACKUP_FORMAT, version: v.version, exportedAt: typeof v.exportedAt === 'string' ? v.exportedAt : '', profiles };
  if (v.app === true) out.app = true;
  return out;
}

/** Текст файла → копия */
export function parseBackup(text: string): Backup {
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new BackupError('not_json', 'Файл не читается: это не JSON.'); }
  return checkBackup(v);
}

/* ---------- что внутри ---------- */

export interface BackupSummary { exportedAt: string; profiles: { id: string; name: string; workouts: number; first: string | null; last: string | null; body: number; exercises: number; program: boolean }[] }

/** Коротко о копии — чтобы показать перед импортом, что именно заменит записи */
export function backupSummary(b: Backup): BackupSummary {
  return {
    exportedAt: b.exportedAt,
    profiles: b.profiles.map(p => {
      const dates = p.workouts.map(w => typeof w.date === 'string' ? w.date : w.id.slice(0, 10)).sort();
      const cfg = p.config || {};
      return {
        id: p.id, name: p.name, workouts: p.workouts.length, first: dates.length ? dates[0] : null, last: dates.length ? dates[dates.length - 1] : null,
        body: p.body.length, exercises: isObj(cfg.ex) ? Object.keys(cfg.ex).length : 0, program: isObj(cfg.program)
      };
    })
  };
}

/* ---------- импорт ---------- */

/** Заменяет всё содержимое хранилища содержимым копии — одной записью: либо целиком, либо никак.
    Прежние записи после этого не вернуть: перед вызовом их стоит выгрузить (exportBackup). */
export async function importBackup(store: Store, backup: Backup): Promise<void> {
  const b = checkBackup(backup);
  const ops: WriteOp[] = [{ path: PROFILES_DOC, data: { list: b.profiles.map(p => ({ id: p.id, n: p.name })) } }];
  for (const p of b.profiles) {
    const pt = paths(p.id);
    if (p.config) ops.push({ path: pt.cfg, data: p.config });
    for (const w of p.workouts) { const { id, ...doc } = w; ops.push({ path: pt.w + '/' + id, data: doc }); }
    for (const r of p.body) { const { id, ...doc } = r; ops.push({ path: pt.body + '/' + id, data: doc }); }
    if (p.coach) ops.push({ path: pt.coach, data: p.coach });
  }
  await store.batch(ops, { wipe: true });
}

/* ---------- дополнить историю ---------- */
/* Копия прежнего дневника поверх своей программы (просьба владельца, 28 ноября 2026). Атлет уже собрал программу в приложении
   и загружает тренировки первой версии: они ложатся в журнал и прогресс, а программа, настройка и нынешние записи не меняются.
   Тренировки профиля, в котором есть программа, помечены old: в истории они видны с пометкой «прежний дневник», а план новой программы
   их не видит (ui/state.ts, derive). Профиль без программы получает их обычными записями, профиль, которого в приложении нет, — целиком.
   - Тренировка на дату, на которую в профиле уже есть тренировка, не добавляется: это та же тренировка или повторная загрузка той же копии.
   - Идущая тренировка из копии ложится законченной.
   - Упражнение, которого в справочнике профиля нет, сначала ищется по названию, иначе добавляется из справочника копии
     (со снарядом, как при обычной загрузке, — fillStarter); свои упражнения профиля не меняются.
   - Вес тела — те записи, которых в профиле нет. Разбор и остальная настройка из копии не берутся. */

/** В профиле есть принятая программа */
export const hasProgram = (cfg: Doc | null | undefined): boolean => isObj(cfg) && isObj(cfg.program) && isObj((cfg.program as Doc).slots);
/** Копию можно не заменять, а дополнить ею историю: её сделало не это приложение, и хотя бы у одного её профиля в приложении есть программа */
export const canMerge = (cur: Backup, copy: Backup): boolean => !copy.app && copy.profiles.some(p => cur.profiles.some(c => c.id === p.id && hasProgram(c.config)));

/** Что дополнение меняет в профиле: added — тренировок добавится, same — не добавится (на эти даты уже есть), ex — упражнений добавится
    в справочник, body — записей веса тела; old — тренировки помечены «прежний дневник» (в профиле есть программа); whole — профиля в приложении не было */
export interface MergeProfile { id: string; name: string; added: number; same: number; ex: number; body: number; old: boolean; whole: boolean }
export interface Merge { ops: WriteOp[]; profiles: MergeProfile[]; added: number; same: number }

const dateOf = (w: BackupDoc): string => typeof w.date === 'string' ? w.date : w.id.slice(0, 10);
const copyOf = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
type RawCfg = { ex?: Record<string, ExDef>; gear?: Record<string, { n?: string; step?: number }> };

/** Записи, которые добавит в хранилище копия cur → copy: всё одной пачкой (store.batch) */
export function mergeBackup(cur: Backup, copy: Backup): Merge {
  const ops: WriteOp[] = [], out: MergeProfile[] = [];
  const list = cur.profiles.map(p => ({ id: p.id, n: p.name }));
  for (const p of copy.profiles) {
    const pt = paths(p.id), c = cur.profiles.find(x => x.id === p.id);
    if (!c) {
      /* профиля в приложении нет: он ложится целиком, как при замене, со справочником, дополненным встроенным */
      const cfg = fillStarter(p.config as RawCfg | null).raw as Doc | null;
      if (cfg) ops.push({ path: pt.cfg, data: cfg });
      for (const w of p.workouts) { const doc: Doc = Object.assign({}, w); delete doc.id; ops.push({ path: pt.w + '/' + w.id, data: doc }); }
      for (const r of p.body) { const doc: Doc = Object.assign({}, r); delete doc.id; ops.push({ path: pt.body + '/' + r.id, data: doc }); }
      if (p.coach) ops.push({ path: pt.coach, data: p.coach });
      list.push({ id: p.id, n: p.name });
      out.push({ id: p.id, name: p.name, added: p.workouts.length, same: 0, ex: 0, body: p.body.length, old: false, whole: true });
      continue;
    }
    const old = hasProgram(c.config);
    const raw = copyOf(withStarter(c.config as RawCfg | null)) as RawCfg & { ex: Record<string, ExDef> };
    const from = (fillStarter(p.config as RawCfg | null).raw || {}) as RawCfg, fromEx = from.ex || {}, fromGear = from.gear || {};
    const map: Record<string, string> = {};
    let ex = 0;
    /* id упражнения из копии → id в справочнике профиля */
    const need = (id: string): string => {
      if (map[id]) return map[id];
      if (raw.ex[id]) return (map[id] = id);
      const def = fromEx[id], key = def ? exKey(def.n) : '';
      const same = key ? Object.keys(raw.ex).find(k => exKey(raw.ex[k].n) === key) : undefined;
      if (same) return (map[id] = same);
      map[id] = id;
      if (!def) return id;                                            // описания нет и в копии: запись остаётся как есть
      const d = copyOf(def);
      if (d.mode === 'light' && d.of) d.of = need(d.of);
      const g = d.gear;
      if (g && g !== NO_GEAR && !GEAR.some(x => x.id === g) && !(raw.gear && raw.gear[g])) {
        if (fromGear[g]) { raw.gear = raw.gear || {}; raw.gear[g] = copyOf(fromGear[g]); }
        else { needGear(raw, g); if (!(raw.gear && raw.gear[g])) delete d.gear; }
      }
      raw.ex[id] = d; ex++;
      return id;
    };
    const dates = new Set(c.workouts.map(dateOf)), ids = new Set(c.workouts.map(w => w.id));
    let added = 0, same = 0, body = 0;
    for (const w of p.workouts) {
      if (dates.has(dateOf(w))) { same++; continue; }
      const doc: Doc = Object.assign({}, w);
      delete doc.id; delete doc.open; delete doc.began;               // идущая тренировка из копии ложится законченной
      if (Array.isArray(doc.items)) doc.items = doc.items.map((it: unknown) => isObj(it) && typeof it.ex === 'string' ? Object.assign({}, it, { ex: need(it.ex) }) : it);
      if (old) doc.old = true;
      let id = w.id;
      for (let k = 2; ids.has(id); k++) id = dateOf(w) + '-' + k;
      ids.add(id); added++;
      ops.push({ path: pt.w + '/' + id, data: doc });
    }
    const have = new Set(c.body.map(r => r.id));
    for (const r of p.body) if (!have.has(r.id)) { const doc: Doc = Object.assign({}, r); delete doc.id; ops.push({ path: pt.body + '/' + r.id, data: doc }); body++; }
    if (ex) ops.unshift({ path: pt.cfg, data: raw as Doc });
    out.push({ id: p.id, name: p.name, added, same, ex, body, old, whole: false });
  }
  if (list.length > cur.profiles.length) ops.unshift({ path: PROFILES_DOC, data: { list } });
  return { ops, profiles: out, added: out.reduce((a, p) => a + p.added, 0), same: out.reduce((a, p) => a + p.same, 0) };
}

/** Дополняет историю копией: одной записью, либо целиком, либо никак. Нынешние записи остаются как есть */
export async function addToHistory(store: Store, copy: Backup): Promise<Merge> {
  const m = mergeBackup(await exportBackup(store), checkBackup(copy));
  if (m.ops.length) await store.batch(m.ops);
  return m;
}
