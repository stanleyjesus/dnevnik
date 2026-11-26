#!/usr/bin/env node
/* Проверка работы без сети — на готовой сборке (app/dist), в настоящем браузере.
   1. Приложение открывается с раздачи; браузер складывает все его файлы к себе.
   2. В приложение кладутся записи, раздача выключается.
   3. Приложение открывается снова: страница, стили, шрифты, значок и записи должны быть на месте, без единого запроса в сеть.
   4. Раздача включается с изменённой сборкой: браузер должен забрать новую версию и выбросить старый запас.
   Раздача устроена как у GitHub Pages: приложение лежит в подпапке адреса, а браузеру разрешено держать файлы у себя 10 минут.
   Нужен Edge или Chrome; свой путь к браузеру — в переменной CHROME_PATH.
   node scripts/offline.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, outDir, stampSw } from './build.mjs';
import { serve } from './serve.mjs';
import { launch, sleep } from './browser.mjs';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url))), root = path.dirname(app);
const J = v => JSON.stringify(v);
const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
let failed = 0;
const check = (ok, what, more) => { if (!ok) failed++; console.log((ok ? '  ok    ' : '  FAIL  ') + what + (more ? ' — ' + more : '')); };

const dist = outDir(false);
const files = await build();
/* как у GitHub Pages: https://имя.github.io/dnevnik/ и Cache-Control: max-age=600 */
const HOST = { base: '/dnevnik', maxAge: 600 };
let { server, url } = await serve(dist, 0, HOST);
const port = +new URL(url).port;
const stop = () => new Promise(done => { server.closeAllConnections(); server.close(() => done()); });
const page = await launch('приложение', '!!document.querySelector("#sync.ok")');
try {
  await page.goto(url + '/');

  /* 1. запас файлов */
  const cached = async () => page.run('const keys = (await caches.keys()).filter(k => k.startsWith("dnevnik-")); const out = []; for (const k of keys) out.push([k, (await (await caches.open(k)).keys()).length]); return out;');
  await page.run('await navigator.serviceWorker.ready; for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));');
  let have = await cached();
  check(have.length === 1 && have[0][0] === 'dnevnik-' + files.version, 'браузер сложил файлы приложения к себе', have.map(k => k[0] + ': ' + k[1] + ' файлов').join(', ') || 'запаса нет');
  check(have.length === 1 && have[0][1] === files.length, 'в запасе все файлы сборки', 'в сборке ' + (files.length - 1) + ' и адрес главной страницы, в запасе ' + (have[0] ? have[0][1] : 0));
  check(await page.run('return !!navigator.serviceWorker.controller;'), 'страница уже работает через запас');

  /* 2. записи — прямо в базу браузера, как их кладёт приложение: ключ — путь документа */
  const ws = json('data/workouts.json');
  const docs = [['config/main', json('data/config.json')]].concat(ws.map(w => ['workouts/' + w.date, w]));
  await page.run('const db = await new Promise((ok, no) => { const r = indexedDB.open("dnevnik"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });'
    + ' await new Promise((ok, no) => { const tx = db.transaction("docs", "readwrite"); for (const [k, v] of ' + J(docs) + ') tx.objectStore("docs").put(v, k); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); db.close();');
  await stop();
  let dead = false;
  try { await fetch(url + '/', { signal: AbortSignal.timeout(2000) }); } catch { dead = true; }
  check(dead, 'раздача выключена: адрес приложения не отвечает');

  /* 3. открыть без сети */
  const opened = await page.tryReload(15000);
  check(opened, 'без сети приложение открылось', opened ? '' : await page.run('return document.body.innerText.slice(0, 160).replace(/\\s+/g, " ");').catch(e => e.message));
  if (opened) {
    await page.run('location.hash = "journal"; await new Promise(r => setTimeout(r, 500));');
    const n = await page.run('return document.querySelectorAll(".wo").length;');
    check(n === ws.length, 'записи на месте', 'в журнале ' + n + ' из ' + ws.length);
    const look = await page.run('await document.fonts.ready; const css = getComputedStyle(document.querySelector("header.top")); return { fonts: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/"/g, "") + " " + f.weight), styled: css.backgroundColor !== "rgba(0, 0, 0, 0)" || css.display === "flex" || document.styleSheets.length >= 2, sheets: document.styleSheets.length };');
    check(look.sheets >= 2, 'стили загружены из запаса', 'таблиц стилей: ' + look.sheets);
    check(look.fonts.some(f => f.startsWith('Inter')), 'шрифты загружены из запаса', look.fonts.length ? [...new Set(look.fonts)].join(', ') : 'ни одного');
    const side = await page.run('const out = {}; for (const f of ["manifest.webmanifest", "icon-192.png", "icon-512.png", "app.js"]) { try { out[f] = (await fetch(f)).status; } catch (e) { out[f] = "нет"; } } return out;');
    check(Object.values(side).every(s => s === 200), 'значок, описание приложения и код отдаются из запаса', Object.entries(side).map(([f, s]) => f + ': ' + s).join(', '));
    /* запись без сети: вес тела сохраняется и переживает ещё одну перезагрузку */
    await page.run('location.hash = "progress"; await new Promise(r => setTimeout(r, 500)); const kg = document.getElementById("bw-kg"); kg.value = "82.4"; [...document.querySelectorAll("#view button")].find(b => b.textContent.trim() === "Записать").click(); await new Promise(r => setTimeout(r, 800));');
    await page.tryReload(15000);
    await sleep(600);
    const kg = await page.run('return document.querySelector("#view").innerText.includes("82.4 кг");').catch(() => false);
    check(kg, 'запись, сделанная без сети, сохранилась', kg ? '' : 'вес тела после перезагрузки не найден');
  }

  /* 4. новая версия: меняется один файл сборки, раздача включается на том же адресе */
  fs.appendFileSync(path.join(dist, 'style.css'), '\n/* проверка обновления */\n');
  const next = stampSw(dist);
  ({ server, url } = await serve(dist, port, HOST));
  check(next.version !== files.version, 'у изменённой сборки другой отпечаток', files.version + ' → ' + next.version);
  await page.run('const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); for (let i = 0; i < 100; i++) { const keys = (await caches.keys()).filter(k => k.startsWith("dnevnik-")); if (keys.length === 1 && keys[0] === "dnevnik-' + next.version + '") break; await new Promise(r => setTimeout(r, 100)); }');
  have = await cached();
  check(have.length === 1 && have[0][0] === 'dnevnik-' + next.version, 'браузер забрал новую версию и выбросил старый запас', have.map(k => k[0]).join(', '));
  await page.reload();
  const fresh = await page.run('return (await (await fetch("style.css")).text()).includes("проверка обновления");');
  check(fresh, 'после обновления страница получает новые файлы');
  const kept = await page.run('location.hash = "journal"; await new Promise(r => setTimeout(r, 500)); return document.querySelectorAll(".wo").length;');
  check(kept === ws.length, 'записи обновление не тронуло', 'в журнале ' + kept + ' из ' + ws.length);
} catch (e) { failed++; console.log('  FAIL  ' + (e && e.message || e)); }
await page.close();
await stop().catch(() => {});
/* сборка возвращается к настоящему виду: в ней остался файл, изменённый для проверки обновления */
await build();
console.log(failed ? '\nБез сети работает не всё: ' + failed : '\nБез сети приложение работает; обновление доходит');
process.exit(failed ? 1 : 0);
