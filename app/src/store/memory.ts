/* Хранилище в памяти: для проверок и для просмотра без записи на устройство. Ведёт себя так же, как IndexedDB. */
import type { Backend, Doc } from './types.ts';

const copy = (d: Doc): Doc => JSON.parse(JSON.stringify(d));

/** seed — документы, с которых хранилище начинает: { 'коллекция/документ': {…} } */
export function memoryBackend(seed?: Record<string, Doc>): Backend {
  const docs = new Map<string, Doc>();
  if (seed) for (const [path, d] of Object.entries(seed)) docs.set(path, copy(d));
  return {
    async get(path) { const d = docs.get(path); return d ? copy(d) : null; },
    async list(collection) {
      const pre = collection + '/';
      return [...docs.keys()].filter(k => k.startsWith(pre)).sort().map(k => ({ id: k.slice(pre.length), data: copy(docs.get(k)!) }));
    },
    async apply(ops, wipe) {
      if (wipe) docs.clear();
      for (const op of ops) { if (op.data === null) docs.delete(op.path); else docs.set(op.path, copy(op.data)); }
    },
    close() { /* нечего закрывать */ }
  };
}
