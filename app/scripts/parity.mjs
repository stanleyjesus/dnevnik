#!/usr/bin/env node
/* Сверка поведения. Эталонные тесты логики из reference/tests запускаются на новом модуле src/core,
   их вывод сравнивается с reference/expected. Сам эталон не меняется: всё копируется в app/.parity/.
   node scripts/parity.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.dirname(app), ref = path.join(root, 'reference'), work = path.join(app, '.parity');
const j = path.join;

if (!process.features.typescript) { console.error('Нужен Node.js 22.18 или новее: он запускает файлы .ts без сборки.'); process.exit(1); }

/* 1. рабочая папка: тесты эталона написаны как CommonJS и ждут рядом core.js и данные */
fs.rmSync(work, { recursive: true, force: true });
for (const d of ['', 'fixtures', 'out']) fs.mkdirSync(j(work, d), { recursive: true });
fs.writeFileSync(j(work, 'package.json'), '{ "type": "commonjs" }\n');
for (const f of fs.readdirSync(j(ref, 'tests'))) if (/^test_.*\.js$/.test(f)) fs.copyFileSync(j(ref, 'tests', f), j(work, f));
for (const f of fs.readdirSync(j(ref, 'tests', 'baseline'))) if (/\.js$/.test(f)) fs.copyFileSync(j(ref, 'tests', 'baseline', f), j(work, f));
const data = { 'workouts.json': 'workouts.json', 'config.json': 'config.json', 'config.p2.json': 'config_p2.json', 'config.p2.stored.json': j('fixtures', 'p2-stored.json') };
for (const [from, to] of Object.entries(data)) fs.copyFileSync(j(root, 'data', from), j(work, to));
/* 2. вместо эталонного core.js — новый модуль */
fs.writeFileSync(j(work, 'core.js'), "module.exports = require('../src/core/index.ts').Core;\n");

/* 3. запуск и сравнение. Один из тестов сам вызывает node, поэтому его папка должна быть в PATH */
const env = Object.assign({}, process.env);
const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] || '');
/* время работы в выводе меняется от запуска к запуску: в сравнение оно не идёт (как в reference/run-checks.js) */
const norm = s => s.replace(/\r\n/g, '\n').replace(/\b\d+(\.\d+)? ms\b/g, 'N ms').trimEnd() + '\n';
let failed = 0;
const line = (ok, name, note) => { if (!ok) failed++; console.log((ok ? '  ok    ' : '  FAIL  ') + name + (note ? '  — ' + note : '')); };

console.log('Поведение: эталонные тесты на src/core');
for (const f of fs.readdirSync(work).filter(x => /^test_.*\.js$/.test(x)).sort()) {
  const r = spawnSync(process.execPath, [f], { cwd: work, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024, env });
  const out = norm((r.stdout || '') + (r.stderr || '')), name = f.replace(/\.js$/, '');
  fs.writeFileSync(j(work, 'out', name + '.txt'), out);
  if (r.status !== 0) { line(false, f, 'тест упал, см. app/.parity/out/' + name + '.txt'); continue; }
  const expFile = j(ref, 'expected', name + '.txt');
  if (!fs.existsSync(expFile)) { line(false, f, 'нет эталона reference/expected/' + name + '.txt'); continue; }
  const exp = norm(fs.readFileSync(expFile, 'utf8'));
  if (exp === out) { line(true, f, 'вывод совпадает с эталоном'); continue; }
  const a = exp.split('\n'), b = out.split('\n'), i = a.findIndex((x, k) => x !== b[k]);
  line(false, f, 'вывод отличается от эталона со строки ' + (i + 1) + ', см. app/.parity/out/' + name + '.txt');
  console.log('          эталон: ' + String(a[i]).slice(0, 160) + '\n          сейчас: ' + String(b[i]).slice(0, 160));
}
console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
