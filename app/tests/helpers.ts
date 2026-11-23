/* Общее для проверок: примерные данные, логика артефакта как эталон, оба хранилища. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import 'fake-indexeddb/auto';
import { createStore } from '../src/store/store.ts';
import { memoryBackend } from '../src/store/memory.ts';
import { idbBackend } from '../src/store/idb.ts';
import type { Doc, Store } from '../src/store/types.ts';
import type { Backup } from '../src/data/backup.ts';

/* корень проекта: app/tests/helpers.ts → на три уровня выше */
export const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

/* логика артефакта как она есть: reference/src/core.js */
export const Ref = createRequire(import.meta.url)(path.join(root, 'reference', 'src', 'core.js'));

/* сравнение значений без функций и undefined */
export const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

let n = 0;
export const dbName = (): string => 'test-' + process.pid + '-' + (++n);
/* каждое хранилище проходит одни и те же проверки */
export const BACKENDS: { name: string; open: () => Promise<Store> }[] = [
  { name: 'память', open: async () => createStore(memoryBackend()) },
  { name: 'IndexedDB', open: async () => createStore(await idbBackend(dbName())) }
];

/* резервная копия, собранная из примерных данных: 24 тренировки первого профиля и настройки двух профилей */
export function seedBackup(): Backup {
  const ws = readJson('data/workouts.json') as (Doc & { date: string })[];
  return {
    format: 'training-diary-backup', version: 1, exportedAt: '2025-11-12T08:00:00.000Z',
    profiles: [
      { id: 'me', name: 'Мой дневник', config: readJson('data/config.json'), workouts: ws.map(d => Object.assign({ id: d.date }, d)), body: [], coach: null },
      { id: 'p2', name: 'Второй профиль', config: readJson('data/config.p2.stored.json'), workouts: [], body: [], coach: null }
    ]
  };
}

/* ждёт, пока условие выполнится: подписчики хранилища получают сообщения не сразу */
export async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('условие не выполнилось за ' + ms + ' мс');
    await new Promise(r => setTimeout(r, 5));
  }
}
