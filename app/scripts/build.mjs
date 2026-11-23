#!/usr/bin/env node
/* Сборка приложения для браузера в app/dist: страница, один файл кода, стили и шрифты.
   Всё лежит в одной папке, без вложенных, и не обращается к сети: такую сборку можно выложить на хостинг за один раз.
   node scripts/build.mjs            — сжатая сборка
   node scripts/build.mjs --dev      — без сжатия, с картой исходников */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(app, 'src', 'ui');

/* шрифты страницы: пакет, название в стилях, начертания; только кириллица и латиница */
const FONTS = [['golos-text', 'Golos Text', [400, 500, 600, 700]], ['sofia-sans-extra-condensed', 'Sofia Sans Extra Condensed', [600, 800]]];
const SUBSETS = [
  ['cyrillic', 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'],
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD']
];

/* готовая сборка — в app/dist, сборка для разработки — в app/.dev: они не затирают друг друга */
export const outDir = dev => path.join(app, dev ? '.dev' : 'dist');

/** dev — сборка для разработки; dir — своя папка вместо обычной (проверки собирают себе отдельно, чтобы не мешать открытому приложению) */
export async function build({ dev = false, dir = outDir(dev) } = {}) {
  const dist = dir;
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(src, 'main.ts')], outfile: path.join(dist, 'app.js'),
    bundle: true, format: 'iife', target: 'es2020', minify: !dev, sourcemap: dev ? 'inline' : false, legalComments: 'none', logLevel: 'warning',
    define: { __DEV__: String(dev) }                                   // при разработке страница отдаёт проверкам несколько своих функций
  });
  for (const f of ['index.html', 'style.css', 'manifest.webmanifest']) fs.copyFileSync(path.join(src, f), path.join(dist, f));
  for (const f of fs.readdirSync(path.join(src, 'icons'))) if (f.endsWith('.png')) fs.copyFileSync(path.join(src, 'icons', f), path.join(dist, f));
  const css = [];
  for (const [pkg, family, weights] of FONTS) for (const w of weights) for (const [subset, range] of SUBSETS) {
    const file = pkg + '-' + subset + '-' + w + '-normal.woff2';
    fs.copyFileSync(path.join(app, 'node_modules', '@fontsource', pkg, 'files', file), path.join(dist, file));
    css.push("@font-face { font-family: '" + family + "'; font-style: normal; font-display: swap; font-weight: " + w + '; src: url(' + file + ") format('woff2'); unicode-range: " + range + '; }');
  }
  fs.writeFileSync(path.join(dist, 'fonts.css'), css.join('\n') + '\n');
  const files = stampSw(dist);
  /* для GitHub Pages: отдавать файлы как есть. В запас браузера не входит. Не пустой: пустой файл страница загрузки GitHub не принимает */
  fs.writeFileSync(path.join(dist, '.nojekyll'), 'Файлы этого сайта отдаются как есть, без обработки.\n');
  return files;
}

/** Работа без сети: список файлов сборки и отпечаток их содержимого уходят в sw.js.
    Изменился хоть один файл — отпечаток другой, и у браузера будет новый запас. Возвращает файлы сборки с размерами */
export function stampSw(dist) {
  const files = [];
  /* служебные файлы с точкой в начале имени (.nojekyll) в запас не идут: хостинг их наружу не отдаёт */
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (path.relative(dist, p) !== 'sw.js' && !f.startsWith('.')) files.push({ file: path.relative(dist, p).replace(/\\/g, '/'), size: fs.statSync(p).size }); } };
  walk(dist);
  const template = fs.readFileSync(path.join(src, 'sw.js'), 'utf8');
  const hash = crypto.createHash('sha256');
  hash.update(template);                                               // правка самого sw.js — тоже новая версия
  for (const f of files.slice().sort((a, b) => a.file < b.file ? -1 : 1)) { hash.update(f.file); hash.update(fs.readFileSync(path.join(dist, f.file))); }
  const version = hash.digest('hex').slice(0, 12);
  const sw = template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./'].concat(files.map(f => f.file))));
  fs.writeFileSync(path.join(dist, 'sw.js'), sw);
  files.push({ file: 'sw.js', size: Buffer.byteLength(sw) });
  return Object.assign(files, { version });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dev = process.argv.includes('--dev'), files = await build({ dev });
  const kb = n => (n / 1024).toFixed(1) + ' КБ';
  console.log('Собрано в app/' + path.basename(outDir(dev)) + ': ' + files.length + ' файлов, ' + kb(files.reduce((a, f) => a + f.size, 0)) + ', версия ' + files.version);
  for (const f of files.filter(x => !x.file.endsWith('.woff2'))) console.log('  ' + f.file.padEnd(22) + kb(f.size));
}
