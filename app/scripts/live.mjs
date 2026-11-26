#!/usr/bin/env node
/* Проверка выложенного приложения — того, что лежит по адресу из deploy/site.json.
   Сайт собирает и публикует GitHub из ветки main открытого репозитория (.github/workflows/site.yml), поэтому сверяется
   сборка из исходников этой папки с тем, что отдаёт адрес. Запускать на том же коммите, что лежит в main.
   1. В коммитах репозитория нет настоящих адресов почты: репозиторий открыт, и адрес автора коммита виден в нём любому.
      Заодно видно, тот ли коммит лежит в main, что и здесь.
   2. Адрес отдаёт ту же версию и те же файлы, что сборка из этих исходников.
   3. В настоящем браузере на ширине телефона приложение открывается, складывает файлы в запас
      и открывается снова, когда сеть выключена.
   Нужен Edge или Chrome; свой путь к браузеру — в переменной CHROME_PATH.
   node scripts/live.mjs */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build, outDir } from './build.mjs';
import { launch, sleep } from './browser.mjs';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const site = JSON.parse(fs.readFileSync(path.join(app, 'deploy', 'site.json'), 'utf8'));
const dist = outDir(false);
let failed = 0;
const check = (ok, what, more) => { if (!ok) failed++; console.log((ok ? '  ok    ' : '  FAIL  ') + what + (more ? ' — ' + more : '')); return ok; };
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const fresh = name => fetch(site.url + name + '?' + Date.now(), { cache: 'no-store' });
const api = { Accept: 'application/vnd.github+json', 'User-Agent': 'dnevnik-live-check' };
/* Адреса почты, которым можно быть в открытом репозитории: служебные адреса GitHub и подпись соавтора.
   Любой другой адрес — настоящий; в выводе от него остаётся только то, что после «@». */
const MAIL = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}/g;
const SERVICE = /(?:@users\.noreply\.github\.com|^noreply@github\.com|^noreply@anthropic\.com)$/i;

const files = await build();
console.log('Адрес: ' + site.url + '\nСборка из исходников: версия ' + files.version);

/* 1. репозиторий: какой коммит лежит в main и какой — здесь */
let behind = '';
try {
  const r = await fetch('https://api.github.com/repos/' + site.repo + '/commits/' + site.branch, { headers: api });
  if (!r.ok) check(false, 'последний коммит репозитория получен', 'GitHub ответил ' + r.status);
  else {
    const theirs = String((await r.json()).sha || ''), g = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8', windowsHide: true }), mine = g.status === 0 ? g.stdout.trim() : '';
    const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: app, encoding: 'utf8', windowsHide: true }).stdout.trim() !== '';
    if (mine !== theirs || dirty) behind = mine !== theirs ? 'в main лежит коммит ' + theirs.slice(0, 7) + ', здесь — ' + (mine.slice(0, 7) || 'не git') : 'здесь есть незакоммиченные правки';
    check(true, 'последний коммит в main: ' + theirs.slice(0, 7), behind ? behind + ' — версия на сайте может отличаться от здешней сборки' : 'тот же, что здесь');
  }
} catch (e) { check(false, 'последний коммит репозитория получен', String(e && e.message || e)); }

/* 1а. коммиты: автор, тот, кто внёс, и подписи в тексте */
try {
  const real = new Map();
  let n = 0;
  for (let page = 1; page <= 20; page++) {
    const r = await fetch('https://api.github.com/repos/' + site.repo + '/commits?sha=' + site.branch + '&per_page=100&page=' + page, { headers: api });
    if (!r.ok) throw new Error('GitHub ответил ' + r.status);
    const list = await r.json();
    for (const c of list) {
      n++;
      const seen = [c.commit.author && c.commit.author.email, c.commit.committer && c.commit.committer.email, ...(String(c.commit.message || '').match(MAIL) || [])];
      for (const e of new Set(seen.filter(Boolean).filter(x => !SERVICE.test(x)).map(x => x.replace(/^.*@/, '…@')))) real.set(e, (real.get(e) || 0) + 1);
    }
    if (list.length < 100) break;
    if (page === 20) check(false, 'проверены все коммиты репозитория', 'их больше 2000 — проверены только последние 2000');
  }
  check(n > 0 && !real.size, 'в коммитах репозитория нет настоящих адресов почты', real.size ? [...real].map(([e, k]) => e + ' — коммитов: ' + k).join(', ') : 'коммитов: ' + n);
} catch (e) { check(false, 'список коммитов репозитория получен', String(e && e.message || e)); }

/* 2. адрес */
let version = '';
try { const r = await fresh('sw.js'); version = r.ok ? ((await r.text()).match(/VERSION = '([0-9a-f]+)'/) || [])[1] || '' : ''; } catch { /* сообщит проверка ниже */ }
const same = check(version === files.version, 'адрес отдаёт ту же версию', version ? (version === files.version ? version : 'на сайте ' + version + (behind ? ' — ' + behind : ' — GitHub ещё не опубликовал этот коммит или публикация не прошла: смотри вкладку Actions репозитория')) : 'sw.js не получен');
if (same) {
  const off = [];
  for (const f of files.filter(x => x.file !== 'sw.js')) {
    try { const r = await fresh(f.file); if (!r.ok || sha(Buffer.from(await r.arrayBuffer())) !== sha(fs.readFileSync(path.join(dist, f.file)))) off.push(f.file); } catch { off.push(f.file); }
  }
  check(!off.length, 'адрес отдаёт те же файлы, что в сборке', off.length ? 'отличаются или не получены: ' + off.join(', ') : (files.length - 1) + ' из ' + (files.length - 1));
}

/* 3. настоящий браузер, ширина телефона */
if (same) {
  const page = await launch('приложение', '!!document.querySelector("#sync.ok")');
  try {
    await page.size(390, 844);
    await page.goto(site.url);
    await page.run('await navigator.serviceWorker.ready; for (let i = 0; i < 150 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));');
    const stock = await page.run('const k = (await caches.keys()).filter(x => x.startsWith("dnevnik-")); return { keys: k, n: k.length ? (await (await caches.open(k[0])).keys()).length : 0 };');
    check(stock.keys.length === 1 && stock.keys[0] === 'dnevnik-' + files.version && stock.n === files.length, 'браузер сложил файлы приложения к себе', stock.keys.join(', ') + ': ' + stock.n + ' из ' + files.length);
    const look = () => page.run('location.hash = "setup"; await new Promise(r => setTimeout(r, 600)); const d = document.getElementById("setup-more"); if (d && !d.open) d.open = true; await document.fonts.ready;'
      + ' return { note: (document.getElementById("device-note") || {}).textContent || "", wide: document.documentElement.scrollWidth, fonts: [...new Set([...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/"/g, "")))], touch: (document.querySelector("link[rel=apple-touch-icon]") || {}).href || "", manifest: (document.querySelector("link[rel=manifest]") || {}).href || "" };');
    const online = await look();
    check(online.note.includes('Версия ' + files.version), 'в «Данных» видна версия сборки', online.note);
    check(online.wide <= 391, 'страница не шире экрана телефона', 'ширина ' + online.wide);
    await page.call('Network.enable');
    await page.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const opened = await page.tryReload(20000);
    check(opened, 'без сети приложение открылось');
    if (opened) {
      const off = await look();
      check(off.fonts.includes('Inter'), 'без сети шрифты на месте', off.fonts.join(', ') || 'ни одного');
      const side = await page.run('const out = {}; for (const f of ["manifest.webmanifest", "icon-192.png", "icon-512.png"]) { try { out[f] = (await fetch(f)).status; } catch (e) { out[f] = "нет"; } } return out;');
      check(Object.values(side).every(s => s === 200), 'без сети значок и описание приложения на месте', Object.entries(side).map(([f, s]) => f + ': ' + s).join(', '));
    }
    await page.call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  } catch (e) { check(false, 'приложение открылось в браузере', String(e && e.message || e)); }
  await page.close();
  await sleep(200);
}
console.log(failed ? '\nВыложенное приложение не в порядке: ' + failed : '\nВыложенное приложение совпадает со сборкой и работает без сети');
process.exit(failed ? 1 : 0);
