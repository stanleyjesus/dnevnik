/* Главная проверка этапа «хранение и импорт»: записи, прошедшие путь «копия → импорт → хранилище → загрузка → новая логика»,
   дают те же расчёты, что логика артефакта (reference/src/core.js) на тех же записях, взятых напрямую. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKENDS, Ref, plain, readJson, seedBackup } from './helpers.ts';
import { Core } from '../src/core/index.ts';
import { importBackup, parseBackup } from '../src/data/backup.ts';
import type { Backup, BackupProfile } from '../src/data/backup.ts';
import { loadProfile, readyCfg } from '../src/data/load.ts';
import type { Store } from '../src/store/types.ts';

/* что считается: объём по мышцам, план с поправками на каждый день программы, замечания, индекс силы, сборка программы.
   C — логика (новая или эталонная), W — тренировки, cfg — настройка, body — вес тела */
function everything(C: any, W: any, cfg: any, body: any, today: string) {
  C.setTarget(cfg.rir);
  const wi = C.weeksInfo(W, cfg, today), vol = C.volume(W, cfg);
  return {
    weeks: wi,
    volume: C.avgVolume(vol, wi.ref),
    plans: C.SLOTS.map((sl: { id: string }) => { const date = C.nextDate(sl.id, today, W), a = C.adapt(W, cfg, sl.id, date); return { slot: sl.id, date, a, items: C.applyAdapt(a, a.off0).items }; }),
    insights: C.insights({ workouts: W, cfg, body, today }),
    index: C.strengthIndex(W, cfg),
    even: (r => ({ name: r.name, slots: r.slots, notes: r.notes, after: r.after.pv }))(C.buildProgram(W, cfg, {})),
    stats: C.allStats(W, cfg).map((s: any) => ({ id: s.id, n: s.n, status: s.status, delta: s.delta }))
  };
}

/* эталон: записи профиля из копии напрямую, как их читает страница артефакта */
function reference(p: BackupProfile, today: string) {
  const W = Ref.sortW(p.workouts.map(d => Ref.fromDoc(d.id, d))), c0 = Ref.mergeCfg(p.config);
  const cfg = c0.start ? c0 : Object.assign({}, c0, { start: Ref.mondayOf(W.length ? W[0].date : today) });
  const body = p.body.map(d => ({ id: d.id, date: d.date || d.id, kg: +(d.kg as number) })).filter(x => x.kg > 0).sort((x, y) => String(x.date) < String(y.date) ? -1 : 1);
  return { W, c0, cfg, body, out: everything(Ref, W, cfg, body, today) };
}

async function check(open: () => Promise<Store>, backup: Backup, today: string) {
  const s = await open();
  await importBackup(s, backup);
  for (const p of backup.profiles) {
    const got = await loadProfile(s, p.id), want = reference(p, today);
    assert.deepEqual(plain(got.workouts), plain(want.W), p.id + ': тренировки');
    assert.deepEqual(plain(got.cfg), plain(want.c0), p.id + ': настройка');
    assert.deepEqual(plain(got.body), plain(want.body), p.id + ': вес тела');
    const mine = everything(Core, got.workouts, readyCfg(got.cfg, got.workouts, today), got.body, today);
    for (const k of Object.keys(want.out) as (keyof typeof mine)[]) assert.deepEqual(plain(mine[k]), plain(want.out[k]), p.id + ': ' + k);
    /* сравнение не должно быть пустым: у профиля с журналом есть и объём, и план, и замечания */
    assert.equal(Object.keys(mine.volume.avg).length, 15, p.id + ': мышцы');
    if (p.workouts.length) {
      assert.equal(got.workouts.length, p.workouts.length, p.id + ': число тренировок');
      assert.ok(mine.plans.length === 3 && mine.plans.every((x: { items: unknown[] }) => x.items.length > 3), p.id + ': план');
      assert.ok(mine.insights.length > 3 && mine.stats.length > 10, p.id + ': замечания, история');
      /* индекс силы — по точке на неделю с тренировками: у журнала короче десяти тренировок недель ещё мало */
      assert.ok(mine.index.length > (p.workouts.length >= 10 ? 3 : 1), p.id + ': индекс силы');
    }
  }
  s.close();
}

for (const b of BACKENDS) {
  test(b.name + ': после импорта примерных данных расчёты совпадают с эталоном', async () => {
    await check(b.open, seedBackup(), '2025-11-12');                  // часы, на которые рассчитаны примерные данные
  });
}

/* дневник неделей позже: резервная копия примерных данных — запас в подходах, вес тела, свой снаряд, у второго профиля принятая программа */
const LATER = 'data/later.json';
for (const b of BACKENDS) {
  test(b.name + ': дневник неделей позже: после импорта расчёты совпадают с эталоном', async () => {
    const backup = parseBackup(JSON.stringify(readJson(LATER)));
    const last = backup.profiles.flatMap(p => p.workouts.map(w => String(w.date || w.id))).sort().pop() || '2025-11-19';
    await check(b.open, backup, last);                                // на день последней записи
    await check(b.open, backup, Ref.addDays(last, 3));                // и через три дня после неё
  });
}
