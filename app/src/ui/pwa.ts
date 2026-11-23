/* Работа без сети: страница просит браузер держать файлы приложения у себя (sw.js).
   При разработке не включается: иначе вместо свежей сборки открывалась бы сохранённая. */
import { readDevice } from './device.ts';
import { softRender } from './render.ts';
import { toast } from './toast.ts';

declare const __DEV__: boolean;

if (!__DEV__ && 'serviceWorker' in navigator) {
  /* страница уже открылась из запаса, и запас сменился — значит, пришла новая версия; работать она начнёт после перезапуска */
  const fromStock = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (fromStock) toast('Пришло обновление: закрой приложение и открой снова');
    void readDevice(softRender);
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* без этого приложение работает, но открывается только при сети */ });
  });
}
void readDevice(softRender);
