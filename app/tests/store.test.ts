/* Хранилище: память и IndexedDB обязаны вести себя одинаково. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKENDS, dbName, until } from './helpers.ts';
import { createStore, splitPath } from '../src/store/store.ts';
import { idbBackend } from '../src/store/idb.ts';
import { StoreError } from '../src/store/types.ts';
import type { Doc } from '../src/store/types.ts';

const err = (code: string) => (e: unknown) => e instanceof StoreError && e.code === code;

for (const b of BACKENDS) {
  test(b.name + ': пустое хранилище', async () => {
    const s = await b.open();
    assert.equal(await s.get('config/main'), null);
    assert.deepEqual(await s.list('workouts'), []);
    s.close();
  });

  test(b.name + ': запись заменяет документ целиком и не делит его с тем, кто записал', async () => {
    const s = await b.open(), doc: Doc = { a: 1, deep: { x: [1, 2] }, gone: undefined };
    await s.set('config/main', doc);
    (doc.deep as { x: number[] }).x.push(3);                         // правка после записи в хранилище не попадает
    assert.deepEqual(await s.get('config/main'), { a: 1, deep: { x: [1, 2] } });
    const got = await s.get<{ deep: { x: number[] } }>('config/main');
    got!.deep.x.push(9);                                              // правка прочитанного — тоже
    assert.deepEqual(await s.get('config/main'), { a: 1, deep: { x: [1, 2] } });
    await s.set('config/main', { b: 2 });
    assert.deepEqual(await s.get('config/main'), { b: 2 });
    s.close();
  });

  test(b.name + ': коллекция — только свои документы, по возрастанию id', async () => {
    const s = await b.open();
    await s.batch([
      { path: 'workouts/2025-11-10', data: { n: 2 } }, { path: 'workouts/2025-09-08', data: { n: 1 } }, { path: 'workouts/2025-11-10-2', data: { n: 3 } },
      { path: 'workouts_p2/2025-11-12', data: { n: 4 } }, { path: 'workoutsx/a', data: { n: 5 } }
    ]);
    assert.deepEqual(await s.list('workouts'), [{ id: '2025-09-08', data: { n: 1 } }, { id: '2025-11-10', data: { n: 2 } }, { id: '2025-11-10-2', data: { n: 3 } }]);
    assert.deepEqual((await s.list('workouts_p2')).map(d => d.id), ['2025-11-12']);
    await s.delete('workouts/2025-11-10');
    assert.deepEqual((await s.list('workouts')).map(d => d.id), ['2025-09-08', '2025-11-10-2']);
    s.close();
  });

  test(b.name + ': пакет записывается целиком или не записывается вовсе', async () => {
    const s = await b.open();
    await s.set('config/main', { keep: 1 });
    await assert.rejects(s.batch([{ path: 'workouts/a', data: { x: 1 } }, { path: 'плохой путь', data: { x: 2 } }]), err('bad_path'));
    await assert.rejects(s.batch([{ path: 'workouts/a', data: { x: 1 } }, { path: 'workouts/b', data: [] as unknown as Doc }]), err('bad_doc'));
    assert.deepEqual(await s.list('workouts'), []);
    assert.deepEqual(await s.get('config/main'), { keep: 1 });
    await s.batch([{ path: 'workouts/a', data: { x: 1 } }, { path: 'config/main', data: null }]);
    assert.equal(await s.get('config/main'), null);
    assert.deepEqual((await s.list('workouts')).map(d => d.id), ['a']);
    await s.batch([{ path: 'body/2025-11-02', data: { kg: 86 } }], { wipe: true });                 // wipe: прежнее стирается
    assert.deepEqual(await s.list('workouts'), []);
    assert.deepEqual(await s.get('body/2025-11-02'), { kg: 86 });
    s.close();
  });

  test(b.name + ': подписка сообщает текущее состояние и каждое изменение', async () => {
    const s = await b.open(), docs: (Doc | null)[] = [], cols: string[][] = [];
    await s.set('config/main', { v: 1 });
    const off1 = s.watchDoc('config/main', d => docs.push(d));
    const off2 = s.watchCollection('workouts', d => cols.push(d.map(x => x.id)));
    await until(() => docs.length === 1 && cols.length === 1);
    assert.deepEqual(docs, [{ v: 1 }]);
    assert.deepEqual(cols, [[]]);
    await s.set('config/main', { v: 2 });
    await s.set('config/p2', { v: 0 });                               // чужой документ подписчика не касается
    await s.set('workouts/2025-11-10', { date: '2025-11-10' });
    await until(() => docs.length === 2 && cols.length === 2);
    assert.deepEqual(docs[1], { v: 2 });
    assert.deepEqual(cols[1], ['2025-11-10']);
    await s.batch([{ path: 'workouts/a', data: { x: 1 } }, { path: 'workouts/b', data: { x: 2 } }]);   // пакет — одно сообщение подписчику
    await until(() => cols.length === 3);
    assert.deepEqual(cols[2], ['2025-11-10', 'a', 'b']);
    await s.delete('config/main');
    await until(() => docs.length === 3);
    assert.equal(docs[2], null);
    off1(); off2();
    await s.set('config/main', { v: 3 });
    await s.set('workouts/c', { x: 3 });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(docs.length, 3);
    assert.equal(cols.length, 3);
    s.close();
  });

  test(b.name + ': неверные пути и закрытое хранилище', async () => {
    const s = await b.open();
    await assert.rejects(s.get('workouts'), err('bad_path'));
    await assert.rejects(s.set('a/b/c', { x: 1 }), err('bad_path'));
    await assert.rejects(s.list('a/b'), err('bad_path'));
    await assert.rejects(s.set('config/main', null as unknown as Doc), err('bad_doc'));
    s.close();
    await assert.rejects(s.get('config/main'), err('closed'));
  });
}

test('IndexedDB: записи переживают закрытие', async () => {
  const name = dbName();
  let s = createStore(await idbBackend(name));
  await s.set('workouts/2025-11-10', { date: '2025-11-10', items: [] });
  s.close();
  s = createStore(await idbBackend(name));
  assert.deepEqual(await s.get('workouts/2025-11-10'), { date: '2025-11-10', items: [] });
  s.close();
});

test('IndexedDB: вторая вкладка узнаёт об изменении', async () => {
  const name = dbName(), a = createStore(await idbBackend(name), { channel: name }), b = createStore(await idbBackend(name), { channel: name }), seen: (Doc | null)[] = [];
  b.watchDoc('config/main', d => seen.push(d));
  await until(() => seen.length === 1);
  await a.set('config/main', { v: 1 });
  await until(() => seen.length === 2);
  assert.deepEqual(seen, [null, { v: 1 }]);
  a.close(); b.close();
});

test('путь — это «коллекция/документ»', () => {
  assert.deepEqual(splitPath('workouts_p2/2025-11-10-2'), ['workouts_p2', '2025-11-10-2']);
  for (const bad of ['', 'workouts', 'a/b/c', '/x', 'x/', 'a b/c']) assert.throws(() => splitPath(bad), StoreError);
});
