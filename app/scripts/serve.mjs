/* Раздача собранного приложения с этого компьютера. Кроме файлов сборки отдаёт, только для проверок,
   эталон из reference/ по адресу /__ref/… (сравнение экранов с эталонной страницей). */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url))), root = path.dirname(app);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

/** Запускает раздачу папки dist; port = 0 — любой свободный порт. Возвращает сервер и его адрес.
    base — подпапка адреса, как у GitHub Pages (https://имя.github.io/dnevnik/): тогда приложение живёт только в ней;
    maxAge — сколько секунд браузеру разрешено держать файл у себя (у GitHub Pages — 600); 0 — не держать вовсе */
export function serve(dist, port, { base = '', maxAge = 0 } = {}) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    const no = () => { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Нет такого файла'); };
    if (base) {
      if (rel === base) { res.writeHead(301, { Location: base + '/' }); res.end(); return; }
      if (!rel.startsWith(base + '/')) return no();
      rel = rel.slice(base.length);
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const side = base ? null : /^\/__ref\//.exec(rel);
    const from = side ? path.join(root, 'reference') : dist;
    const file = path.join(from, side ? rel.slice(side[0].length - 1) : rel);
    if (!file.startsWith(from) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return no();
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': maxAge ? 'max-age=' + maxAge : 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ server, url: 'http://localhost:' + server.address().port + base })));
}
