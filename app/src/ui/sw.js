/* Работа без сети. При первом открытии браузер складывает файлы приложения к себе, дальше страница открывается из этого запаса.
   Записи дневника здесь не участвуют: они лежат в IndexedDB и в сеть не уходят.
   VERSION и FILES подставляет сборка (scripts/build.mjs): новая сборка — новый запас, старый удаляется. */
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'dnevnik-' + VERSION;

self.addEventListener('install', e => {
  /* файлы берутся с сервера заново, мимо обычного кэша браузера (cache: 'reload'): хостинг разрешает браузеру держать файл
     у себя минут десять, и без этого в новый запас попала бы старая копия — и осталась бы там до следующей версии */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('dnevnik-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  /* сначала запас; страницу, которой в запасе нет под этим адресом, заменяет главная; сеть — только если запаса нет */
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))
    .then(hit => hit || fetch(e.request)));
});
