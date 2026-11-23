/* То, что страница раньше получала от Claude через window.claude.use(имя): хранилище, права, сохранение файла.
   Теперь это даёт само приложение, с теми же вызовами (docs/02-data-model.md, раздел 7), чтобы экраны не менялись.
   Запросов к модели нет: use('sample') возвращает null, и страница работает без них. */
import type { Doc, DocEntry, Store } from '../store/types.ts';
import { createStore } from '../store/store.ts';
import { idbBackend, keepOnDevice } from '../store/idb.ts';
import type { Backup } from '../data/backup.ts';
import type { Db, Downloads } from './types.ts';
import { importBackup } from '../data/backup.ts';

/** Снимок документа, как его ждут экраны. Содержимое — any: это данные из хранилища, экраны разбирают их сами (C.fromDoc, C.mergeCfg) */
export interface DocSnap { id: string; exists: boolean; data(): any; metadata: SnapMeta }
/** Снимок коллекции */
export interface ColSnap { docs: DocSnap[]; size: number; empty: boolean; docChanges(): never[]; metadata: SnapMeta }
interface SnapMeta { fromCache: boolean; hasPendingWrites: boolean }

/* записи лежат на этом устройстве: снимок никогда не «из кэша» и не ждёт отправки */
const META: SnapMeta = { fromCache: false, hasPendingWrites: false };
const snapDoc = (path: string, data: Doc | null): DocSnap => ({ id: path.slice(path.lastIndexOf('/') + 1), exists: data != null, data: () => data ?? undefined, metadata: META });
const snapCol = (col: string, docs: DocEntry[]): ColSnap => {
  const list = docs.map(d => snapDoc(col + '/' + d.id, d.data));
  return { docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: META };
};

/* ошибку хранилища экраны различают по code: quota_exceeded — кончилось место */
const dbError = (e: unknown): unknown => {
  if (e && typeof e === 'object' && (e as { name?: string }).name === 'QuotaExceededError') return Object.assign(new Error('На устройстве кончилось место'), { code: 'quota_exceeded' });
  return e;
};
const rethrow = (e: unknown): never => { throw dbError(e); };

/** Хранилище с вызовами, которыми пользуются экраны: db.doc(путь) и db.collection(путь) */
export function dbOver(store: Store) {
  const doc = (path: string) => ({
    id: path.slice(path.lastIndexOf('/') + 1),
    path,
    get: () => store.get(path).then(d => snapDoc(path, d), rethrow),
    set: (data: object) => store.set(path, data as Doc).catch(rethrow),   // запись — любой объект данных: тренировка, настройка, список профилей
    delete: () => store.delete(path).catch(rethrow),
    onSnapshot: (next: (s: DocSnap) => void, onError?: (e: unknown) => void) => store.watchDoc(path, d => next(snapDoc(path, d)), onError)
  });
  const collection = (col: string) => {
    const q = {
      path: col,
      limit: (_max?: number) => q,                                     // на устройстве записи читаются все, ограничение платформы не нужно
      get: () => store.list(col).then(ds => snapCol(col, ds), rethrow),
      doc: (id: string) => doc(col + '/' + id),
      onSnapshot: (next: (s: ColSnap) => void, onError?: (e: unknown) => void) => store.watchCollection(col, ds => next(snapCol(col, ds)), onError)
    };
    return q;
  };
  return { doc, collection };
}

/** iPhone и iPad: у них свои правила хранения записей и свой способ сохранить файл */
export const isIos = (): boolean => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/* сохранение файла: обычное скачивание. На iPhone в приложении с экрана «Домой» скачивание по ссылке работает ненадёжно,
   поэтому там файл отдаётся через «Поделиться»: оттуда его сохраняют в «Файлы» или отправляют себе */
const TYPES: Record<string, string> = { json: 'application/json', csv: 'text/csv' };
const downloads: Downloads = {
  async save({ filename, data }) {
    const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase(), type = TYPES[ext] || 'application/octet-stream';
    if (isIos() && typeof File !== 'undefined' && typeof navigator.canShare === 'function') {
      const file = new File([data], filename, { type });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return { status: 'saved' }; }
        catch (e) {
          /* закрыл окно «Поделиться» — это отказ, а не сбой: экраны по code: 'declined' молчат; сбой уходит дальше как есть */
          if (e && (e as { name?: string }).name === 'AbortError') throw Object.assign(new Error('Сохранение отменено'), { code: 'declined' });
          throw e;
        }
      }
    }
    const url = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { status: 'saved' };
  }
};

let opening: Promise<Store> | null = null;
/** Хранилище приложения: открывается один раз; вкладки сообщают друг другу об изменениях */
export const openStore = (): Promise<Store> => opening || (opening = idbBackend().then(b => { void keepOnDevice(); return createStore(b, { channel: 'dnevnik' }); }));

/** Что приложение даёт экранам по имени — как раньше window.claude.use(имя) */
interface Platform {
  use(name: 'db'): Promise<Db>;
  use(name: 'user'): Promise<{ can(what: string): Promise<boolean> }>;
  use(name: 'downloads'): Promise<Downloads>;
  use(name: string): Promise<unknown>;
  importBackup(backup: Backup): Promise<void>;
}
export const platform: Platform = {
  async use(name: string): Promise<any> {
    if (name === 'db') return dbOver(await openStore());
    if (name === 'user') return { can: async () => true };              // записи свои: писать можно всегда
    if (name === 'downloads') return downloads;
    return null;                                                        // sample: запросов к модели нет
  },
  /** Заменяет все записи содержимым резервной копии; экраны узнают об этом через свои подписки */
  async importBackup(backup: Backup): Promise<void> { await importBackup(await openStore(), backup); }
};

/** Дни как в артефакте — три дня с именами дней недели. Так приложение запускает только сверка экранов с эталоном (npm run screens):
    она ставит window.__dnevnikWeek до запуска страницы. Обычный запуск — дни «День 1…N» без привязки к дням недели (core/days.ts) */
export const weekDays = (): boolean => !!(globalThis as { __dnevnikWeek?: boolean }).__dnevnikWeek;
