#!/usr/bin/env node
/* Эталонные проверки дневника.
   node reference/run-checks.js            — логика (нужен только Node.js 18+)
   node reference/run-checks.js --update   — переписать эталонные выводы в reference/expected/ (только после намеренного изменения правил)

   Скрипт собирает рабочую папку reference/.check/ из reference/src, reference/tests и data/,
   собирает страницу и запускает тесты по очереди. Вывод каждого теста — в reference/.check/out/. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ref = __dirname, root = path.dirname(ref), work = path.join(ref, '.check');
const args = process.argv.slice(2), update = args.includes('--update');
const j = (...p) => path.join(...p);

/* 1. рабочая папка: всё лежит рядом, как ждут тесты */
fs.rmSync(work, { recursive: true, force: true });
for (const d of ['', 'fixtures', 'out']) fs.mkdirSync(j(work, d), { recursive: true });
const copyAll = (from, keep) => { for (const f of fs.readdirSync(from)) if (keep(f)) fs.copyFileSync(j(from, f), j(work, f)); };
copyAll(j(ref, 'src'), f => /\.(js|css|html)$/.test(f));
copyAll(j(ref, 'tests'), f => /\.js$/.test(f));
copyAll(j(ref, 'tests', 'baseline'), f => /\.js$/.test(f));
const data = { 'workouts.json': 'workouts.json', 'config.json': 'config.json', 'config.p2.json': 'config_p2.json', 'config.p2.stored.json': j('fixtures', 'p2-stored.json') };
for (const [from, to] of Object.entries(data)) fs.copyFileSync(j(root, 'data', from), j(work, to));

const run = (file, extra) => spawnSync(process.execPath, [file].concat(extra || []), { cwd: work, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 });
const text = r => (r.stdout || '') + (r.stderr || '');
/* время работы в выводе меняется от запуска к запуску: в сравнение оно не идёт */
const norm = s => s.replace(/\r\n/g, '\n').replace(/\b\d+(\.\d+)? ms\b/g, 'N ms').trimEnd() + '\n';
let failed = 0;
const line = (ok, name, note) => { if (!ok) failed++; console.log((ok ? '  ok    ' : '  FAIL  ') + name + (note ? '  — ' + note : '')); };

/* 2. страница */
console.log('Сборка страницы');
{ const r = run('build.js'); fs.writeFileSync(j(work, 'out', 'build.txt'), text(r)); line(r.status === 0, 'build.js', r.status === 0 ? text(r).trim() : 'см. reference/.check/out/build.txt'); }

/* 3. логика: код возврата и сравнение вывода с эталоном */
console.log('\nЛогика');
const expDir = j(ref, 'expected');
if (update) fs.mkdirSync(expDir, { recursive: true });
for (const f of fs.readdirSync(work).filter(x => /^test_.*\.js$/.test(x)).sort()) {
  const r = run(f), out = norm(text(r)), name = f.replace(/\.js$/, '');
  fs.writeFileSync(j(work, 'out', name + '.txt'), out);
  if (r.status !== 0) { line(false, f, 'тест упал, см. reference/.check/out/' + name + '.txt'); continue; }
  const expFile = j(expDir, name + '.txt');
  if (update) { fs.writeFileSync(expFile, out); line(true, f, 'эталон обновлён'); continue; }
  if (!fs.existsSync(expFile)) { line(false, f, 'нет эталонного вывода reference/expected/' + name + '.txt'); continue; }
  const same = norm(fs.readFileSync(expFile, 'utf8')) === out;
  line(same, f, same ? 'вывод совпадает с эталоном' : 'вывод отличается от reference/expected/' + name + '.txt');
}

console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
