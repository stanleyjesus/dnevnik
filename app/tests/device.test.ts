/* Строка об устройстве в «Настройке» → «Данные»: по ней на телефоне видно, надёжно ли лежат записи и дошло ли обновление. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceNote } from '../src/ui/device.ts';
import { isIos } from '../src/ui/platform.ts';

const d = (kept: boolean | null, installed: boolean, ios: boolean, version: string) => ({ kept, installed, ios, version });

test('установлено, записи закреплены, версия видна', () => {
  assert.equal(deviceNote(d(true, true, true, '3f2c97b48b3e'), false), 'Браузер обещал не стирать записи. Приложение установлено. Версия 3f2c97b48b3e.');
});

test('iPhone, открыто во вкладке: сначала о том, что записи сотрутся, и как поставить приложение', () => {
  const text = deviceNote(d(false, false, true, 'abc'), false);
  assert.ok(text.startsWith('Открыто в браузере, а не с экрана «Домой»: такие записи iPhone стирает, если неделю не заходить.'));
  assert.ok(text.includes('«Поделиться» → «На экран „Домой“»'));
  assert.ok(text.endsWith('Версия abc.'));
});

test('браузер не обещал хранить записи: совет держать копию', () => {
  assert.equal(deviceNote(d(false, false, false, 'abc'), false), 'Браузер не обещал хранить записи: при нехватке места он может их стереть. Держи свежую резервную копию. Версия abc.');
  assert.equal(deviceNote(d(false, true, true, 'abc'), false), 'Браузер не обещал хранить записи: при нехватке места он может их стереть. Держи свежую резервную копию. Приложение установлено. Версия abc.');
});

test('спросить браузер нельзя и запаса нет: только что известно', () => {
  assert.equal(deviceNote(d(null, false, false, ''), false), 'Работа без сети ещё не включилась: открой приложение ещё раз, пока есть сеть.');
  assert.equal(deviceNote(d(null, false, false, ''), true), 'Сборка для разработки.');
});

test('iPhone и iPad узнаются по браузеру, компьютер — нет', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator')!;
  const as = (userAgent: string, platform: string, maxTouchPoints: number) => { Object.defineProperty(globalThis, 'navigator', { value: { userAgent, platform, maxTouchPoints }, configurable: true }); return isIos(); };
  try {
    assert.equal(as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)', 'iPhone', 5), true);
    assert.equal(as('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), true);       // iPad представляется компьютером, но у него есть касания
    assert.equal(as('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), false);
    assert.equal(as('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv81', 5), false);
    assert.equal(as('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0), false);
  } finally { Object.defineProperty(globalThis, 'navigator', real); }
});
