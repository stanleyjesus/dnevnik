/* Прослойка между экранами и хранилищем: экраны обращаются к ней теми же вызовами, что раньше к хранилищу артефакта. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { until } from './helpers.ts';
import { createStore } from '../src/store/store.ts';
import { memoryBackend } from '../src/store/memory.ts';
import { dbOver, platform } from '../src/ui/platform.ts';
import type { ColSnap, DocSnap } from '../src/ui/platform.ts';

test('документ: снимок, запись, удаление, подписка', async () => {
  const store = createStore(memoryBackend({ 'config/main': { start: '2025-09-08' } })), db = dbOver(store);
  const snap = await db.doc('config/main').get();
  assert.deepEqual({ id: snap.id, exists: snap.exists, data: snap.data(), fromCache: snap.metadata.fromCache }, { id: 'main', exists: true, data: { start: '2025-09-08' }, fromCache: false });
  const none = await db.doc('notes/coach').get();
  assert.deepEqual({ exists: none.exists, data: none.data() }, { exists: false, data: undefined });

  const seen: DocSnap[] = [];
  const off = db.doc('config/main').onSnapshot(s => seen.push(s));
  await until(() => seen.length === 1);                                // сразу текущее состояние
  await db.doc('config/main').set({ start: '2025-09-15' });            // запись заменяет документ целиком
  await until(() => seen.length === 2);
  assert.deepEqual(seen[1].data(), { start: '2025-09-15' });
  await db.doc('config/main').delete();
  await until(() => seen.length === 3);
  assert.equal(seen[2].exists, false);
  off();
  store.close();
});

test('коллекция: документы по возрастанию id, limit ничего не отрезает', async () => {
  const store = createStore(memoryBackend({ 'workouts/2025-11-10': { slot: 'mon' }, 'workouts/2025-09-08': { slot: 'mon' }, 'workouts_p2/2025-11-12': { slot: 'wed' } })), db = dbOver(store);
  const snap = await db.collection('workouts').limit().get();
  assert.deepEqual(snap.docs.map(d => d.id), ['2025-09-08', '2025-11-10']);
  assert.deepEqual({ size: snap.size, empty: snap.empty, changes: snap.docChanges() }, { size: 2, empty: false, changes: [] });
  assert.deepEqual(snap.docs[1].data(), { slot: 'mon' });

  const seen: ColSnap[] = [];
  const off = db.collection('workouts').limit().onSnapshot(s => seen.push(s));
  await until(() => seen.length === 1);
  await db.doc('workouts/2025-11-12').set({ slot: 'wed' });
  await until(() => seen.length === 2);
  assert.deepEqual(seen[1].docs.map(d => d.id), ['2025-09-08', '2025-11-10', '2025-11-12']);
  assert.equal(db.collection('workouts').doc('2025-11-12').path, 'workouts/2025-11-12');
  off();
  store.close();
});

/* iPhone: приложение с экрана «Домой» не скачивает файл по ссылке, поэтому он отдаётся через «Поделиться» */
test('сохранение файла на iPhone: через «Поделиться»; закрытое окно — отказ, а не сбой', async () => {
  const shared: File[] = [];
  const phone = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', platform: 'iPhone', maxTouchPoints: 5,
    canShare: (d: { files?: File[] }) => !!d.files && d.files.length === 1,
    share: async (d: { files: File[] }): Promise<void> => { shared.push(d.files[0]!); }
  };
  const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator')!;
  Object.defineProperty(globalThis, 'navigator', { value: phone, configurable: true });
  try {
    const files = await platform.use('downloads');
    assert.deepEqual(await files.save({ filename: 'dnevnik-backup-2025-11-19.json', data: '{"format":"training-diary-backup"}' }), { status: 'saved' });
    assert.deepEqual({ name: shared[0]!.name, type: shared[0]!.type, text: await shared[0]!.text() }, { name: 'dnevnik-backup-2025-11-19.json', type: 'application/json', text: '{"format":"training-diary-backup"}' });

    phone.share = async () => { throw Object.assign(new Error('закрыто'), { name: 'AbortError' }); };
    await assert.rejects(files.save({ filename: 'a.json', data: '{}' }), (e: { code?: string }) => e.code === 'declined');

    /* настоящий сбой не выдаётся за отказ: экран тогда предложит скопировать копию в буфер */
    phone.share = async () => { throw Object.assign(new Error('нельзя'), { name: 'NotAllowedError' }); };
    await assert.rejects(files.save({ filename: 'a.json', data: '{}' }), (e: { code?: string; name?: string }) => e.code === undefined && e.name === 'NotAllowedError');
  } finally { Object.defineProperty(globalThis, 'navigator', real); }
});

test('запросов к модели нет, писать можно всегда', async () => {
  assert.equal(await platform.use('sample'), null);
  const user = await platform.use('user') as { can(what: string): Promise<boolean> };
  assert.equal(await user.can('data.write'), true);
});
