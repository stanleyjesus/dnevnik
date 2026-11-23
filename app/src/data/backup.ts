/* Резервная копия всех профилей: формат training-diary-backup, docs/02-data-model.md, раздел 5.
   Выгрузка повторяет артефакт. Импорт заменяет всё содержимое хранилища содержимым копии. */
import type { Doc, Store, WriteOp } from '../store/types.ts';
import { paths, PROFILES_DOC, validProfileId } from './paths.ts';
import { readProfiles } from './profiles.ts';

export const BACKUP_FORMAT = 'training-diary-backup';
export const BACKUP_VERSION = 1;

/** Документ коллекции в копии: тот же документ и его id */
export type BackupDoc = Doc & { id: string };
export interface BackupProfile { id: string; name: string; config: Doc | null; workouts: BackupDoc[]; body: BackupDoc[]; coach: Doc | null }
export interface Backup { format: string; version: number; exportedAt: string; profiles: BackupProfile[] }

/** Ошибка копии: code — для программы, message — для человека */
export class BackupError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'BackupError'; this.code = code; }
}

/* ---------- выгрузка ---------- */

export async function exportBackup(store: Store, now: Date = new Date()): Promise<Backup> {
  const out: Backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), profiles: [] };
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
  return { format: BACKUP_FORMAT, version: v.version, exportedAt: typeof v.exportedAt === 'string' ? v.exportedAt : '', profiles };
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
