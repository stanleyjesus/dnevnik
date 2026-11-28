/* Копия прежнего дневника поверх своей программы (просьба владельца, 28 ноября 2026): data/backup.ts (canMerge, mergeBackup, addToHistory),
   пометка old в записи тренировки (core/records.ts) и то, что её видит только история, а не план (ui/state.ts, derive).
   Всё — на примерных данных из data/: «приложение с программой» — первый профиль с настройкой второго (в ней принятая программа)
   и без тренировок, «копия прежнего дневника» — примерный журнал, записанный по-старому. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKENDS, plain, readJson, seedBackup } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { daysOf, useDays } from '../src/core/days.ts';
import { withStarter } from '../src/core/starter.ts';
import { addToHistory, canMerge, checkBackup, exportBackup, importBackup, mergeBackup } from '../src/data/backup.ts';
import type { Backup, BackupDoc } from '../src/data/backup.ts';
import type { Doc } from '../src/store/types.ts';
import type { Workout } from '../src/core/types.ts';
import { S, derive } from '../src/ui/state.ts';

const P2 = () => readJson('data/config.p2.stored.json') as Doc;
/* приложение, в котором атлет уже собрал программу и ещё не тренировался */
const withProgram = (workouts: BackupDoc[] = []): Backup => ({ ...seedBackup(), profiles: [{ id: 'me', name: 'Мой дневник', config: P2(), workouts, body: [], coach: null }] });
const seedDocs = () => seedBackup().profiles[0].workouts;

test('пометка old переживает запись и чтение, у остальных тренировок её нет', () => {
  const d = seedDocs()[0], w = Core.fromDoc(d.id, { ...d, old: true } as never);
  assert.equal(w.old, true);
  assert.equal(Core.toDoc(w).old, true);
  assert.equal('old' in Core.fromDoc(d.id, d as never), false);
  assert.equal('old' in Core.toDoc(Core.fromDoc(d.id, d as never)), false);
  assert.equal('old' in Core.fromDoc(d.id, { ...d, old: 'да' } as never), false);            // только true
});

test('дополнить историю можно копией не из приложения, когда у её профиля в приложении есть программа', () => {
  const seed = seedBackup();
  assert.equal(canMerge(withProgram(), seed), true);
  assert.equal(canMerge(withProgram(), { ...seed, app: true }), false);                     // копию сделало приложение — она заменяет записи
  assert.equal(canMerge({ ...seed, profiles: [seed.profiles[0]] }, seed), false);           // в приложении нет программы
  assert.equal(canMerge(seed, readJson('data/later.json')), true);                         // у второго профиля программа есть
  assert.equal(checkBackup({ ...seed, app: true }).app, true);
  assert.equal('app' in checkBackup(seed), false);
  assert.equal('app' in checkBackup({ ...seed, app: 'да' }), false);
});

for (const b of BACKENDS) {
  test(b.name + ': тренировки копии ложатся в историю с пометкой, программа и настройка не меняются, повторная загрузка ничего не добавляет', async () => {
    const s = await b.open(), app = withProgram(), copy = seedBackup();
    await importBackup(s, app);
    const before = await exportBackup(s, new Date(0));
    const m = await addToHistory(s, copy);
    assert.deepEqual({ added: m.added, same: m.same }, { added: 24, same: 0 });
    assert.deepEqual(m.profiles.map(p => [p.id, p.added, p.old, p.whole, p.ex]), [['me', 24, true, false, 0], ['p2', 0, false, true, 0]]);
    const ws = await s.list('workouts');
    assert.equal(ws.length, 24);
    assert.ok(ws.every(d => d.data.old === true && !d.data.open));
    /* записи те же, что в копии, кроме пометки */
    assert.deepEqual(ws.map(d => { const x = Object.assign({ id: d.id }, d.data); delete x.old; return x; }), plain(copy.profiles[0].workouts));
    assert.deepEqual(await s.get('config/main'), before.profiles[0].config);                // программа и настройка — как были
    assert.deepEqual((await s.get('config/profiles'))!.list, [{ id: 'me', n: 'Мой дневник' }, { id: 'p2', n: 'Второй профиль' }]);   // профиль, которого не было, — целиком
    assert.ok(await s.get('config/p2'));
    const again = await addToHistory(s, copy);
    assert.deepEqual({ added: again.added, same: again.same, ops: again.ops.length }, { added: 0, same: 24, ops: 0 });
    s.close();
  });
}

test('та же дата не добавляется, идущая тренировка ложится законченной, упражнение ищется по названию, новое — со своим снарядом', () => {
  const docs = seedDocs(), mine = { ...docs[0], items: [] }, app = withProgram([mine]), copy = seedBackup();
  const cfg = Object.assign({}, copy.profiles[0].config) as Doc & { ex: Record<string, Doc>; gear?: Record<string, Doc> };
  cfg.ex = Object.assign({}, cfg.ex, { x_bench: { n: 'жим  лёжа', m: { chest: 1 } }, x_belt: { n: 'Тяга с поясом', m: { lats: 1 }, gear: 'g_belt' } });
  cfg.gear = Object.assign({}, cfg.gear, { g_belt: { n: 'Пояс', step: 5 } });
  const open = { ...docs[1], open: true, began: 1 }, ren = { ...docs[2], items: [{ ex: 'x_bench', sets: '80x8' }, { ex: 'x_belt', sets: '40x10' }] };
  copy.profiles = [{ ...copy.profiles[0], config: cfg, workouts: [docs[0], open, ren] }];
  const m = mergeBackup(app, copy), me = m.profiles[0];
  assert.deepEqual({ added: me.added, same: me.same, ex: me.ex }, { added: 2, same: 1, ex: 1 });
  const at = (id: string) => m.ops.find(o => o.path === 'workouts/' + id)!.data as Doc & { items: { ex: string }[] };
  assert.equal(m.ops.some(o => o.path === 'workouts/' + docs[0].id), false);               // на эту дату в приложении уже есть тренировка
  assert.equal('open' in at(open.id) || 'began' in at(open.id), false);
  assert.deepEqual(at(ren.id).items.map(it => it.ex), ['bench', 'x_belt']);               // «жим  лёжа» — это жим лежа профиля
  const c = m.ops.find(o => o.path === 'config/main')!.data as { ex: Record<string, Doc>; gear: Record<string, Doc>; program: unknown };
  assert.deepEqual(c.ex.x_belt, { n: 'Тяга с поясом', m: { lats: 1 }, gear: 'g_belt' });
  assert.deepEqual(c.gear.g_belt, { n: 'Пояс', step: 5 });
  assert.equal(c.ex.x_bench, undefined);
  assert.deepEqual(c.program, (P2() as { program: unknown }).program);
  /* профиль без своих упражнений: встроенный справочник сохраняется вместе с добавленным, а не пропадает */
  const bare = mergeBackup({ ...app, profiles: [{ ...app.profiles[0], config: { program: (P2() as { program: unknown }).program } }] }, copy);
  const bc = bare.ops.find(o => o.path === 'config/main')!.data as { ex: Record<string, Doc> };
  assert.ok(Object.keys(bc.ex).length > 60 && bc.ex.x_belt);
});

test('дневник неделей позже поверх примерных данных: профиль без программы получает обычные записи, с программой — с пометкой', () => {
  const m = mergeBackup(seedBackup(), readJson('data/later.json'));
  assert.deepEqual(m.profiles.map(p => [p.id, p.added, p.same, p.body, p.ex, p.old]), [['me', 3, 24, 3, 0, false], ['p2', 2, 0, 0, 1, true]]);
  const w = (p: string) => m.ops.filter(o => o.path.startsWith(p)).map(o => (o.data as Doc).old === true);
  assert.deepEqual(w('workouts/'), [false, false, false]);
  assert.deepEqual(w('workouts_p2/'), [true, true]);
});

/* экраны: всё, что считает план, — по журналу без тренировок прежнего дневника; история — по всему журналу */
test('план новой программы тренировок прежнего дневника не видит, история и прогресс — видят', () => {
  const raw = withStarter(P2() as never), today = Core.todayStr();
  useDays(daysOf(raw), false);
  try {
    Object.assign(S, { cfgRaw: raw, cfg: Core.mergeCfg(raw), body: [] });
    const old: Workout[] = Core.sortW(seedDocs().map(d => Core.fromDoc(d.id, { ...d, old: true } as never)));
    const plan = (W: Workout[]) => { S.workouts = W; const D = derive(), A = Core.adapt(D.W, D.cfg, D.slot, D.date); return { D, A: plain(A), items: Core.applyAdapt(A, A.off0).items }; };
    const a = plan([]), b = plan(old);
    assert.equal(b.D.W.length, 0);
    assert.equal(b.D.WA.length, 24);
    assert.equal(b.D.olds.size, 24);
    assert.deepEqual([b.D.slot, b.D.date, [...b.D.prog]], [a.D.slot, a.D.date, [...a.D.prog]]);
    assert.deepEqual(b.A, a.A);                                                              // тот же план следующей тренировки
    assert.ok(b.D.stats.length > 10 && b.D.stats.every(s => s.active === a.D.prog.has(s.id)));  // в прогрессе — упражнения прежнего дневника
    assert.ok(b.D.wi.weeks.length >= 10 && b.D.idx.length > 5);
    /* первая тренировка новой программы: план дальше — по ней, а не по прежнему дневнику */
    const first = Core.fromDoc(today, { date: today, slot: a.D.slot, items: a.items.map(it => ({ ex: it.ex, rng: '8-12', sets: '20x10 20x10' })) } as never);
    const c = plan([first]), d = plan(Core.sortW(old.concat([first])));
    assert.deepEqual([d.D.slot, d.D.date, [...d.D.prog], d.A], [c.D.slot, c.D.date, [...c.D.prog], c.A]);
    assert.equal(d.D.WA.length, 25);
  } finally {
    S.workouts = []; useDays(null, true);
  }
});

/* напоминание о резервной копии (выбор владельца, 28 ноября 2026; ui/remind.ts): копии ещё не было или с последней прошло от семи дней */
test('напоминание о копии: от семи дней без копии или когда её не было', async () => {
  const { backupDue, lastBackup, markBackup } = await import('../src/ui/remind.ts');
  assert.equal(backupDue(null, '2025-11-12'), true);
  assert.equal(backupDue('2025-11-06', '2025-11-12'), false);
  assert.equal(backupDue('2025-11-05', '2025-11-12'), true);
  assert.equal(backupDue('2025-11-12', '2025-11-12'), false);
  assert.equal(lastBackup(), null);                                                          // память браузера недоступна — как будто копии не было
  S.ui.backupAsk = true; markBackup('2025-11-12');
  assert.equal(S.ui.backupAsk, false);                                                       // копия сохранена — напоминание уходит
});
