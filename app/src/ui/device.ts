/* Что видно про это устройство: обещал ли браузер хранить записи, установлено ли приложение, какая версия сборки открыта.
   Строка об этом стоит в «Настройке» → «Данные»: по ней на телефоне видно, надёжно ли лежат записи и дошло ли обновление. */
import { keepOnDevice } from '../store/idb.ts';
import { isIos } from './platform.ts';

declare const __DEV__: boolean;

/** kept — браузер обещал не стирать записи (null — спросить нельзя); installed — открыто как установленное приложение;
    ios — iPhone или iPad; version — отпечаток сборки, которая сложена в запас браузера ('' — запаса нет) */
export interface Device { kept: boolean | null; installed: boolean; ios: boolean; version: string }
export const device: Device = { kept: null, installed: false, ios: false, version: '' };

/** Узнаёт всё заново и зовёт done — перерисовать экран. Заодно ещё раз просит браузер не стирать записи:
    установленному приложению он обычно это обещает, вкладке — нет */
export async function readDevice(done?: () => void): Promise<void> {
  device.ios = isIos();
  device.installed = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || (navigator as { standalone?: boolean }).standalone === true;
  try { device.kept = navigator.storage && navigator.storage.persisted ? (await navigator.storage.persisted()) || (await keepOnDevice()) : null; } catch { device.kept = null; }
  try { const key = typeof caches === 'undefined' ? undefined : (await caches.keys()).find(k => k.startsWith('dnevnik-')); device.version = key ? key.slice('dnevnik-'.length) : ''; } catch { device.version = ''; }
  if (done) done();
}

/** Что сказать об устройстве в «Данных»: одна-две короткие фразы */
export function deviceNote(d: Device = device, dev: boolean = __DEV__): string {
  const out: string[] = [];
  if (d.ios && !d.installed) out.push('Открыто в браузере, а не с экрана «Домой»: такие записи iPhone стирает, если неделю не заходить. Поставь приложение: «Поделиться» → «На экран „Домой“».');
  else if (d.kept === false) out.push('Браузер не обещал хранить записи: при нехватке места он может их стереть. Держи свежую резервную копию.');
  else if (d.kept) out.push('Браузер обещал не стирать записи.');
  if (d.installed) out.push('Приложение установлено.');
  out.push(d.version ? 'Версия ' + d.version + '.' : dev ? 'Сборка для разработки.' : 'Работа без сети ещё не включилась: открой приложение ещё раз, пока есть сеть.');
  return out.join(' ');
}
