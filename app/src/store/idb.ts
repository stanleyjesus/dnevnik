/* Хранилище на устройстве: IndexedDB. Одна база, одна таблица docs, ключ — путь документа «коллекция/документ».
   Записи лежат в браузере на этом устройстве и никуда не уходят. */
import type { Backend, Doc, DocEntry } from './types.ts';
import { StoreError } from './types.ts';

export const DB_NAME = 'dnevnik';
const TABLE = 'docs';
/* самый большой знак строки: ключи от «коллекция/» до «коллекция/» + LAST — это все документы коллекции и только они */
const LAST = String.fromCharCode(0xffff);
const done = <T,>(r: IDBRequest<T>) => new Promise<T>((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

export async function idbBackend(name: string = DB_NAME): Promise<Backend> {
  if (typeof indexedDB === 'undefined') throw new StoreError('unavailable', 'На этом устройстве нет хранилища для записей (IndexedDB)');
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(TABLE)) open.result.createObjectStore(TABLE); };
  const db = await done(open);
  db.onversionchange = () => db.close();                                // другая вкладка обновляет базу: не мешаем ей
  return {
    get(path) { return done(db.transaction(TABLE).objectStore(TABLE).get(path)).then(v => v === undefined ? null : v as Doc); },
    list(collection) {
      const os = db.transaction(TABLE).objectStore(TABLE), range = IDBKeyRange.bound(collection + '/', collection + '/' + LAST), cut = collection.length + 1;
      return Promise.all([done(os.getAllKeys(range)), done(os.getAll(range))])
        .then(([keys, vals]) => keys.map((k, i): DocEntry => ({ id: String(k).slice(cut), data: vals[i] })));
    },
    apply(ops, wipe) {
      /* одна транзакция: если что-то не записалось, не записывается ничего */
      return new Promise<void>((ok, no) => {
        const tx = db.transaction(TABLE, 'readwrite'), os = tx.objectStore(TABLE);
        tx.oncomplete = () => ok();
        tx.onabort = tx.onerror = () => no(tx.error || new StoreError('write_failed', 'Не удалось сохранить записи'));
        try {
          if (wipe) os.clear();
          for (const op of ops) { if (op.data === null) os.delete(op.path); else os.put(op.data, op.path); }
        } catch (e) { try { tx.abort(); } catch { /* транзакция уже прервана */ } no(e); }
      });
    },
    close() { db.close(); }
  };
}

/** Просит браузер не стирать записи при нехватке места. true — обещал; false — не обещал или спросить нельзя */
export async function keepOnDevice(): Promise<boolean> {
  try { return typeof navigator !== 'undefined' && !!navigator.storage && !!navigator.storage.persist && await navigator.storage.persist(); }
  catch { return false; }
}
