/* Хранилище поверх бэкенда: проверка путей, документы как JSON, подписки, оповещение других вкладок. */
import type { Backend, Doc, DocEntry, Store } from './types.ts';
import { StoreError } from './types.ts';

const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const badPath = (p: unknown) => new StoreError('bad_path', 'Неверный путь в хранилище: ' + String(p));

/** «коллекция/документ» → [коллекция, документ]; путь из других частей не принимается */
export function splitPath(path: string): [string, string] {
  const i = typeof path === 'string' ? path.indexOf('/') : -1;
  if (i < 0) throw badPath(path);
  const col = path.slice(0, i), id = path.slice(i + 1);
  if (!SEG.test(col) || !SEG.test(id)) throw badPath(path);
  return [col, id];
}
const checkCollection = (c: string) => { if (typeof c !== 'string' || !SEG.test(c)) throw badPath(c); };

/* документ хранится таким, каким его сохранит JSON: без undefined, функций и общих ссылок с тем, кто его записал */
const plain = (data: Doc): Doc => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new StoreError('bad_doc', 'Документ должен быть объектом');
  return JSON.parse(JSON.stringify(data));
};

interface Watcher { doc: boolean; key: string; next: (v: any) => void; onError?: (e: unknown) => void; seq: number }

/** channel — имя общего канала: вкладки с одним и тем же хранилищем сообщают по нему друг другу об изменениях */
export function createStore(backend: Backend, opts: { channel?: string } = {}): Store {
  const watchers = new Set<Watcher>();
  let closed = false;
  const bc = opts.channel && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(opts.channel) : null;

  const fire = (w: Watcher) => {
    const seq = ++w.seq;
    (w.doc ? backend.get(w.key) : backend.list(w.key)).then(
      v => { if (!closed && watchers.has(w) && seq === w.seq) w.next(v); },          // чтение, которое уже устарело, не доставляется
      e => { if (watchers.has(w) && w.onError) w.onError(e); });
  };
  /* paths = null: изменилось всё */
  const notify = (paths: string[] | null) => {
    const docs = new Set(paths || []), cols = new Set((paths || []).map(p => p.slice(0, p.indexOf('/'))));
    for (const w of watchers) if (!paths || (w.doc ? docs.has(w.key) : cols.has(w.key))) fire(w);
  };
  const changed = (paths: string[] | null) => { notify(paths); if (bc) bc.postMessage({ paths }); };
  if (bc) bc.onmessage = (e: MessageEvent) => { const p = e.data && e.data.paths; notify(Array.isArray(p) ? p : null); };

  const alive = () => { if (closed) throw new StoreError('closed', 'Хранилище закрыто'); };
  const watch = (doc: boolean, key: string, next: (v: any) => void, onError?: (e: unknown) => void) => {
    alive();
    const w: Watcher = { doc, key, next, onError, seq: 0 };
    watchers.add(w);
    fire(w);
    return () => { watchers.delete(w); };
  };

  return {
    async get<T = Doc>(path: string) { alive(); splitPath(path); return await backend.get(path) as T | null; },
    async list<T = Doc>(collection: string) { alive(); checkCollection(collection); return await backend.list(collection) as DocEntry<T>[]; },
    async set(path, data) { alive(); splitPath(path); const d = plain(data); await backend.apply([{ path, data: d }], false); changed([path]); },
    async delete(path) { alive(); splitPath(path); await backend.apply([{ path, data: null }], false); changed([path]); },
    async batch(ops, o) {
      alive();
      /* всё проверяется до первой записи: неверный путь или документ отменяет пакет целиком */
      const clean = ops.map(op => { splitPath(op.path); return { path: op.path, data: op.data === null ? null : plain(op.data) }; });
      const wipe = !!(o && o.wipe);
      await backend.apply(clean, wipe);
      changed(wipe ? null : clean.map(op => op.path));
    },
    watchDoc(path, next, onError) { splitPath(path); return watch(true, path, next, onError); },
    watchCollection(collection, next, onError) { checkCollection(collection); return watch(false, collection, next, onError); },
    close() { if (closed) return; closed = true; watchers.clear(); if (bc) bc.close(); backend.close(); }
  };
}
