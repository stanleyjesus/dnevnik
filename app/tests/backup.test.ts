/* Резервная копия: проверка формата, выгрузка как в артефакте, импорт с заменой. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKENDS, seedBackup } from './helpers.ts';
import { createStore } from '../src/store/store.ts';
import { memoryBackend } from '../src/store/memory.ts';
import { BackupError, backupFileName, backupSummary, backupText, checkBackup, exportBackup, importBackup, parseBackup } from '../src/data/backup.ts';
import { readProfiles } from '../src/data/profiles.ts';

const err = (code: string) => (e: unknown) => e instanceof BackupError && e.code === code;

test('копия: то, что не читается, отклоняется с объяснением', () => {
  const ok = seedBackup(), me = ok.profiles[0];
  assert.throws(() => parseBackup('не json'), err('not_json'));
  assert.throws(() => parseBackup('[]'), err('not_backup'));
  assert.throws(() => parseBackup('{"format":"что-то другое"}'), err('not_backup'));
  assert.throws(() => checkBackup({ ...ok, version: 2 }), err('newer_version'));
  assert.throws(() => checkBackup({ ...ok, version: 'x' }), err('bad_version'));
  assert.throws(() => checkBackup({ ...ok, profiles: [] }), err('no_profiles'));
  assert.throws(() => checkBackup({ ...ok, profiles: [{ ...me, id: 'main' }] }), err('bad_profile'));
  assert.throws(() => checkBackup({ ...ok, profiles: [me, me] }), err('bad_profile'));
  assert.throws(() => checkBackup({ ...ok, profiles: [{ ...me, config: [] }] }), err('bad_config'));
  assert.throws(() => checkBackup({ ...ok, profiles: [{ ...me, workouts: {} }] }), err('bad_list'));
  assert.throws(() => checkBackup({ ...ok, profiles: [{ ...me, workouts: [{ date: '2025-11-10', items: [] }] }] }), err('bad_doc'));      // нет id
  assert.throws(() => checkBackup({ ...ok, profiles: [{ ...me, workouts: [{ id: 'a', items: 'x' }] }] }), err('bad_doc'));
  assert.throws(() => checkBackup({ ...ok, profiles: [{ ...me, workouts: [{ id: 'a' }, { id: 'a' }] }] }), err('bad_doc'));             // id дважды
  assert.equal(parseBackup(backupText(ok)).profiles.length, 2);
  assert.match(new BackupError('x', 'текст').message, /текст/);
});

test('копия: коротко о содержимом', () => {
  const s = backupSummary(seedBackup());
  assert.equal(s.exportedAt, '2025-11-12T08:00:00.000Z');
  assert.deepEqual({ id: s.profiles[0].id, workouts: s.profiles[0].workouts, first: s.profiles[0].first, last: s.profiles[0].last, body: s.profiles[0].body }, { id: 'me', workouts: 24, first: '2025-09-08', last: '2025-11-10', body: 0 });
  assert.ok(s.profiles[0].exercises > 20);
  assert.deepEqual({ id: s.profiles[1].id, workouts: s.profiles[1].workouts, first: s.profiles[1].first, program: s.profiles[1].program }, { id: 'p2', workouts: 0, first: null, program: true });
  assert.equal(backupFileName('2025-11-19'), 'dnevnik-backup-2025-11-19.json');
});

test('выгрузка повторяет артефакт: тот же состав и порядок полей', async () => {
  /* хранилище разложено так, как его держит артефакт; main в списке профилей — запись, которую дневник отбрасывает */
  const w1 = { date: '2025-11-10', slot: 'mon', items: [{ ex: 'bench', cyc: '77/5', sets: '95x5@3 95x5@2' }] };
  const w2 = { date: '2025-11-12', slot: 'wed', items: [{ ex: 'lunge', rng: '8-12', sets: '6x10 6x9' }], open: true };
  const cfg = { start: '2025-09-08', ex: { bench: { n: 'Жим лежа', m: { chest: 1 }, mode: 'cycle' } } }, cfg2 = { rir: 2, ex: {} };
  const s = createStore(memoryBackend({
    'workouts/2025-11-10': w1, 'config/main': cfg, 'body/2025-11-02': { date: '2025-11-02', kg: 74.6 }, 'notes/coach': { text: 'разбор', at: '2025-11-11', q: '' },
    'config/profiles': { list: [{ id: 'me', n: 'Мой дневник' }, { id: 'p2', n: 'Второй профиль' }, { id: 'main', n: 'лишний' }] },
    'config/p2': cfg2, 'workouts_p2/2025-11-12': w2
  }));
  const got = await exportBackup(s, new Date('2025-11-15T08:00:00.000Z'));
  /* так копию собирает exportAll в reference/src/ui3.js */
  const want = JSON.stringify({
    format: 'training-diary-backup', version: 1, exportedAt: '2025-11-15T08:00:00.000Z',
    profiles: [
      { id: 'me', name: 'Мой дневник', config: cfg, workouts: [Object.assign({ id: '2025-11-10' }, w1)], body: [{ id: '2025-11-02', date: '2025-11-02', kg: 74.6 }], coach: { text: 'разбор', at: '2025-11-11', q: '' } },
      { id: 'p2', name: 'Второй профиль', config: cfg2, workouts: [Object.assign({ id: '2025-11-12' }, w2)], body: [], coach: null }
    ]
  }, null, 1);
  assert.equal(backupText(got), want);
  s.close();
});

test('пустое хранилище: один профиль «Мой дневник» и пустая копия', async () => {
  const s = createStore(memoryBackend());
  assert.deepEqual(await readProfiles(s), [{ id: 'me', n: 'Мой дневник' }]);
  assert.deepEqual((await exportBackup(s, new Date(0))).profiles, [{ id: 'me', name: 'Мой дневник', config: null, workouts: [], body: [], coach: null }]);
  s.close();
});

for (const b of BACKENDS) {
  test(b.name + ': импорт и обратная выгрузка дают ту же копию', async () => {
    const s = await b.open(), src = seedBackup();
    await importBackup(s, src);
    assert.deepEqual(await readProfiles(s), [{ id: 'me', n: 'Мой дневник' }, { id: 'p2', n: 'Второй профиль' }]);
    assert.equal((await s.list('workouts')).length, 24);
    assert.equal(backupText(await exportBackup(s, new Date(src.exportedAt))), backupText(src));
    s.close();
  });

  test(b.name + ': импорт заменяет прежние записи, а негодная копия ничего не трогает', async () => {
    const s = await b.open(), src = seedBackup();
    await s.batch([{ path: 'workouts/2020-01-01', data: { date: '2020-01-01', items: [] } }, { path: 'workouts_old/2020-01-01', data: { x: 1 } }, { path: 'config/main', data: { old: true } }]);
    await assert.rejects(importBackup(s, { ...src, version: 2 }), err('newer_version'));
    assert.deepEqual(await s.get('config/main'), { old: true });                                     // прежние записи на месте
    await importBackup(s, src);
    assert.equal(await s.get('workouts/2020-01-01'), null);
    assert.deepEqual(await s.list('workouts_old'), []);
    assert.deepEqual(await s.get('config/main'), src.profiles[0].config);
    s.close();
  });
}
