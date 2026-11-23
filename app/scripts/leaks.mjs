#!/usr/bin/env node
/* Проверка «в проекте нет личного». Репозиторий открытый: в нём не должно быть ни записей тренировок, ни настроек профилей,
   ни адресов почты, ни ключей — ни в файлах, ни в истории git.
   Что проверяется в каждом файле:
     1. имя файла — нет ли среди файлов резервных копий и выгрузок дневника (под любым именем), архивов, картинок кроме значков
        приложения и файлов JSON вне известного списка (настоящие записи дневника тоже лежат в JSON);
     2. содержимое — нет ли резервной копии дневника по её пометке формата, адресов почты (кроме служебных), путей к папке
        пользователя, ключей и токенов;
     3. совпадения с личными записями — если на этом компьютере лежит папка с ними (private/data, в git она не входит):
        даты тренировок и взвешиваний, строки подходов, текст методики и разбора, заметки, имена профилей, названия своих снарядов
        и программ из настоящего дневника не должны встречаться нигде в проекте. Примерные данные проекта (data/) поэтому лежат
        в другом году. Числа сами по себе (вес тела, названные веса) поиском текста не сверить — это сказано в выводе.
        В облаке и там, где такой папки нет, этот шаг пропускается — о чём тоже сказано в выводе.
   Какие файлы: каждый файл под git в том виде, в каком он лежит в индексе (то, что уйдёт со следующим коммитом), его версия
   на диске, если она другая, и файлы, которые ещё не добавлены, но и не исключены .gitignore.
   Новый файл JSON в проекте — сначала в список JSON_OK ниже, с причиной.
   node scripts/leaks.mjs                  — файлы в нынешнем виде
   node scripts/leaks.mjs --история        — ещё и все прежние версии файлов в истории текущей ветки
   node scripts/leaks.mjs --личное=<папка> — где лежат личные записи для сравнения (по умолчанию private/data в корне проекта)
   Свои слова для поиска (имена людей и их падежные формы, что-то ещё узнаваемое) — по одному в строке в private/words.txt.
   Перед первой отправкой в открытый репозиторий обязателен запуск с ключом --история. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url))), root = path.dirname(app);
const history = process.argv.includes('--история');
const privDir = path.resolve(root, (process.argv.find(a => a.startsWith('--личное=')) || '--личное=private/data').slice('--личное='.length));

const git = (args, input) => { const r = spawnSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 1 << 30, windowsHide: true, input }); if (r.status !== 0) throw new Error('git ' + args[0] + ': ' + String(r.stderr || '').trim()); return r.stdout; };
/* содержимое объектов git одним процессом: sha → { type, data } */
function batch(shas) {
  const out = new Map();
  if (!shas.length) return out;
  const buf = git(['cat-file', '--batch'], Buffer.from(shas.join('\n') + '\n'));
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf(10, i), head = buf.subarray(i, nl).toString('utf8').split(' ');
    i = nl + 1;
    if (head[1] === 'missing') continue;
    const size = +head[2];
    out.set(head[0], { type: head[1], data: buf.subarray(i, i + size) });
    i += size + 1;
  }
  return out;
}

/* 1. имена файлов, которым в открытом репозитории не место */
const BAD_PATH = [
  [/(^|\/)[^/]*backup[^/]*\.json$/i, 'резервная копия дневника'],
  [/\.csv$/i, 'таблица: выгрузка тренировок'],
  [/\.seed\.json$/i, 'файл записей прежнего формата'],
  [/(^|\/)config\.p2\.live\.json$/i, 'настройка профиля прежнего формата'],
  [/^private\//, 'папка private/: она не для репозитория'],
  [/\.(zip|7z|rar|tar|gz)$/i, 'архив: что внутри, проверка не видит'],
  [/(^|\/)\.env(\.|$)/, 'файл с переменными окружения'],
  [/settings\.local\.json$/, 'настройки Claude Code этого компьютера'],
  [/(^|\/)CLAUDE\.local\.md$/, 'заметки Claude Code этого компьютера']
];
/* файлы JSON, которые в проекте есть и должны быть: любой другой — провал. Записи дневника, его настройки и выгрузки хранилища
   тоже JSON, и пометки формата у них может не быть; подмену самих примерных данных в data/ ловит npm run sample */
const JSON_OK = [/^app\/(package|package-lock|tsconfig|tsconfig\.tests)\.json$/, /^app\/deploy\/site\.json$/, /^\.claude\/launch\.json$/,
  /^data\/(workouts|config|config\.p2|config\.p2\.stored|later)\.json$/];
/* картинки и прочие нетекстовые файлы: в них записи не найти поиском, поэтому разрешён только известный список */
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|mp4|mov)$/i;
const BINARY_OK = [/^app\/src\/ui\/icons\/[^/]+\.png$/];
/* файлы, которые пишет генератор примерных данных или которые на них посчитаны: строка из одинаковых подходов в них
   совпадает с настоящей и случайно — такое совпадение показывается, но не роняет проверку */
const GENERATED = /^(data\/[^/]+\.json|reference\/expected\/[^/]+\.txt|reference\/harness\.html)$/;

/* 2. содержимое: адреса почты, пути, ключи. Адрес — то, что кончается буквенным доменом: «пакет@1.2.3» адресом не считается */
const MAIL = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}/g;
const MAIL_OK = /(?:@users\.noreply\.github\.com|^noreply@github\.com|^noreply@anthropic\.com|^git@github\.com|@example\.(?:com|org)|\.(?:png|js|ts|mjs|css|json|woff2)$)$/i;
const CONTENT = [
  [/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"']+/g, 'путь к папке пользователя'],
  [/\/(?:home|Users)\/[A-Za-z][\w.-]+\//g, 'путь к папке пользователя'],
  [/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/g, 'токен GitHub'],
  [/sk-ant-[A-Za-z0-9-]{20,}/g, 'ключ API'],
  [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g, 'закрытый ключ']
];

/* 3. образцы из личных записей, если они лежат на этом компьютере */
const samples = { dates: new Set(), sets: new Set(), same: new Set(), text: [], words: new Set(), short: new Set() };
/* слова, которые есть в самом приложении: имя профиля по умолчанию и названия из встроенного справочника — личным не считаются */
const PUBLIC = (fs.readFileSync(path.join(app, 'src', 'core', 'starter.ts'), 'utf8') + ' Мой дневник Второй профиль').toLowerCase();
/* названия программ, которые даёт сама сборка: строки продукта, а не то, что ввёл человек */
const AUTO_NAME = /^(Равномерно на всё тело|Своя программа|Пауэрбилдинг: |Сила: |Приоритет: )/;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = w => new RegExp('(?<![\\p{L}\\p{N}])' + esc(w.toLowerCase()) + '(?![\\p{L}\\p{N}])', 'u');
/* слово или имя: от пяти знаков ищется подстрокой, в три-четыре знака — целым словом, короче — не ищется */
const word = (v, min = 3) => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (t.length >= 5) { if (!PUBLIC.includes(t.toLowerCase())) samples.words.add(t); }
  else if (t.length >= min) { if (!wholeWord(t).test(PUBLIC)) samples.short.add(t); }
};
const text = v => { if (typeof v === 'string' && v.trim().length >= 12) samples.text.push(v); };
const priv = { files: 0, read: 0, bad: [] };
if (fs.existsSync(privDir)) {
  const take = w => {
    if (!w || typeof w !== 'object') return;
    if (typeof w.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(w.date) && (Array.isArray(w.items) || w.kg != null)) { samples.dates.add(w.date); word(w.note); }   // тренировка или взвешивание
    if (typeof w.id === 'string' && typeof w.name === 'string' && Array.isArray(w.workouts)) word(w.name);                 // имя профиля в копии
    if (Array.isArray(w.list)) for (const p of w.list) if (p && typeof p === 'object') word(p.n);                             // список профилей в хранилище
    if (w.gear && typeof w.gear === 'object' && !Array.isArray(w.gear)) for (const g of Object.values(w.gear)) if (g && typeof g === 'object') word(g.n);   // свои снаряды
    if (w.slots && typeof w.name === 'string' && !AUTO_NAME.test(w.name)) { word(w.name); text(w.name); }                  // название программы, введённое человеком
    if (typeof w.method === 'string') text(w.method);
    if (w.coach && typeof w.coach === 'object') { text(w.coach.text); text(w.coach.q); }                                   // разбор и вопрос к нему
    if (typeof w.text === 'string' && typeof w.at === 'string') { text(w.text); text(w.q); }                               // документ разбора в хранилище
    for (const it of Array.isArray(w.items) ? w.items : []) {
      /* строка подходов узнаваема, когда в ней хотя бы два разных подхода (вес и повторы меняются от подхода к подходу). Строка из одинаковых
         подходов (четыре подхода волны одним весом) совпадает и с выдуманными данными, поэтому в файлах генератора она только показывается */
      if (it && typeof it.sets === 'string') { const s = it.sets.trim(), parts = s.split(/\s+/); if (parts.length >= 3) (new Set(parts).size >= 2 ? samples.sets : samples.same).add(s); }
      if (it) word(it.note);
    }
  };
  const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { take(v); Object.values(v).forEach(walk); } };
  /* файл читается по своей кодировке: UTF-8 с пометкой BOM и без неё, UTF-16 (так пишет Windows PowerShell); битый файл — провал, а не молчание */
  const decode = b => {
    if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(3));
    if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(b.subarray(2));
    if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(b.subarray(2));
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  };
  for (const e of fs.readdirSync(privDir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const full = path.join(e.parentPath || e.path, e.name), rel = path.relative(privDir, full).replace(/\\/g, '/');
    priv.files++;
    if (!/\.json$/i.test(e.name)) { priv.bad.push(rel + ' — не JSON'); continue; }
    try { walk(JSON.parse(decode(fs.readFileSync(full)))); priv.read++; } catch (err) { priv.bad.push(rel + ' — ' + String(err && err.message || err).slice(0, 80)); }
  }
  const words = path.join(path.dirname(privDir), 'words.txt');
  if (fs.existsSync(words)) for (const w of fs.readFileSync(words, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) word(w, 2);
}
/* из длинного текста берутся куски по 40 знаков: пересказ своими словами не ловится, дословная вставка — ловится; короткий текст — целиком */
const chunks = [];
for (const t of samples.text) { const s = t.replace(/\s+/g, ' ').trim().toLowerCase(); if (s.length <= 40) chunks.push(s); else for (let i = 0; i + 40 <= s.length; i += 20) chunks.push(s.slice(i, i + 40)); }
const shortRe = [...samples.short].map(w => [w, wholeWord(w)]);
/* строка из одинаковых подходов ищется целой: «95x3 95x3 95x3» внутри «95x3 95x3 95x3 95x3» — другая запись */
const TOKEN = /[dx.@w?-]/;
const wholeSets = (text, s) => { for (let i = text.indexOf(s); i >= 0; i = text.indexOf(s, i + 1)) { const b = text.slice(Math.max(0, i - 2), i), a = text.slice(i + s.length, i + s.length + 2); if (TOKEN.test(b.slice(-1)) || (b.endsWith(' ') && TOKEN.test(b.slice(0, 1))) || TOKEN.test(a.slice(0, 1)) || (a.startsWith(' ') && /d/.test(a.slice(1)))) continue; return true; } return false; };

const found = new Map(), noted = new Map();
const hit = (where, what) => { const k = what + ' — ' + where; found.set(k, (found.get(k) || 0) + 1); };
const note = (where, what) => { const k = what + ' — ' + where; noted.set(k, (noted.get(k) || 0) + 1); };
/* имя файла; true — содержимое смотреть не нужно (картинка, шрифт) */
function scanName(name, where) {
  for (const [re, what] of BAD_PATH) if (re.test(name)) hit(where, 'файл: ' + what);
  if (/\.json$/i.test(name) && !JSON_OK.some(re => re.test(name))) hit(where, 'файл JSON вне разрешённого списка (JSON_OK в leaks.mjs)');
  if (BINARY.test(name)) { if (!BINARY_OK.some(re => re.test(name))) hit(where, 'картинка или другой нетекстовый файл вне разрешённого списка'); return true; }
  return false;
}
function scan(name, data, where) {
  if (scanName(name, where)) return;
  if (data.includes(0)) { hit(where, 'нетекстовый файл'); return; }
  const text = data.toString('utf8');
  if (/\.json$/i.test(name) && name !== 'data/later.json') { try { const v = JSON.parse(text.replace(/^﻿/, '')); if (v && v.format === 'training-diary-backup') hit(where, 'резервная копия дневника (по содержимому)'); } catch { /* не JSON — не копия */ } }
  for (const m of text.match(MAIL) || []) if (!MAIL_OK.test(m)) hit(where, 'адрес почты …@' + m.replace(/^.*@/, ''));
  for (const [re, what] of CONTENT) if (re.test(text)) { re.lastIndex = 0; hit(where, what); }
  for (const d of samples.dates) if (text.includes(d)) hit(where, 'дата тренировки или взвешивания из личного дневника (' + d + ')');
  for (const s of samples.sets) if (text.includes(s)) hit(where, 'подходы из личного дневника');
  for (const s of samples.same) if (wholeSets(text, s)) (GENERATED.test(name) ? note : hit)(where, 'подходы из личного дневника (строка из одинаковых подходов)');
  if (chunks.length || samples.words.size || shortRe.length) {
    const low = text.replace(/\s+/g, ' ').toLowerCase();
    for (const c of chunks) if (low.includes(c)) { hit(where, 'текст из личных записей'); break; }
    for (const w of samples.words) if (low.includes(w.toLowerCase())) { hit(where, 'имя, заметка или название из личных записей'); break; }
    for (const [, re] of shortRe) if (re.test(low)) { hit(where, 'короткое имя или слово из личных записей'); break; }
  }
}

/* файлы в нынешнем виде: версия из индекса — то, что уйдёт со следующим коммитом; версия с диска, если она другая; ещё не добавленные */
const entries = git(['ls-files', '-s', '-z']).toString('utf8').split('\0').filter(Boolean).map(l => { const tab = l.indexOf('\t'), [mode, sha] = l.slice(0, tab).split(' '); return { mode, sha, name: l.slice(tab + 1) }; }).filter(e => e.mode !== '160000');
const untracked = git(['ls-files', '-z', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean);
const idx = batch([...new Set(entries.map(e => e.sha))]);
let onlyIndex = 0, changed = 0;
for (const e of entries) {
  const p = path.join(root, e.name), disk = fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p) : null, blob = (idx.get(e.sha) || { data: Buffer.alloc(0) }).data;
  if (!disk) onlyIndex++;
  scan(e.name, blob, e.name + (disk ? '' : ' (только в индексе: уйдёт со следующим коммитом)'));
  if (disk && !disk.equals(blob)) { changed++; scan(e.name, disk, e.name + ' (на диске: правка ещё не добавлена)'); }
}
for (const f of untracked) { const p = path.join(root, f); if (fs.existsSync(p) && fs.statSync(p).isFile()) scan(f, fs.readFileSync(p), f + ' (ещё не добавлен)'); }
let blobs = 0;
if (history) {
  /* все версии всех файлов, до которых можно дойти от текущего коммита */
  const objs = git(['rev-list', '--objects', 'HEAD']).toString('utf8').split('\n').map(l => { const sp = l.indexOf(' '); return sp < 0 ? null : { sha: l.slice(0, sp), name: l.slice(sp + 1) }; }).filter(o => o && o.name);
  const all = batch([...new Set(objs.map(o => o.sha))]), seen = new Set();
  for (const o of objs) {
    const b = all.get(o.sha);
    if (!b || b.type !== 'blob') continue;
    const where = o.name + ' (история, ' + o.sha.slice(0, 7) + ')';
    if (seen.has(o.sha)) { scanName(o.name, where); continue; }
    seen.add(o.sha); blobs++;
    scan(o.name, b.data, where);
  }
}
if (priv.bad.length) for (const b of priv.bad) hit('private/data/' + b.replace(/ — /g, ': '), 'личный файл не прочитан, сверка с ним не шла');
const sampleCount = samples.dates.size + samples.sets.size + samples.same.size + chunks.length + samples.words.size + samples.short.size;
if (fs.existsSync(privDir) && priv.files && !sampleCount) hit(path.relative(root, privDir).replace(/\\/g, '/'), 'папка с личными записями есть, а образцов в ней нет: проверь формат файлов');

console.log('Файлов под git: ' + entries.length + (onlyIndex ? ' (только в индексе: ' + onlyIndex + ')' : '') + (changed ? ', с неотданной правкой на диске: ' + changed : '') + '; ещё не добавленных: ' + untracked.length
  + (history ? '; версий файлов в истории ветки: ' + blobs : '; история не проверялась (ключ --история)'));
console.log(fs.existsSync(privDir) ? 'Личные образцы для сравнения: файлов ' + priv.files + ' (прочитано ' + priv.read + '); дат ' + samples.dates.size + ', узнаваемых строк подходов ' + samples.sets.size
  + ', строк из одинаковых подходов ' + samples.same.size + ', кусков текста ' + chunks.length + ', имён и названий ' + samples.words.size + ', коротких — целым словом ' + samples.short.size + '. Числа (вес тела, названные веса) поиском текста не сверяются.'
  : 'Личных образцов на этом компьютере нет (' + path.relative(root, privDir).replace(/\\/g, '/') + '): сравнение с настоящими записями пропущено');
if (noted.size) { console.log('В файлах примерных данных и посчитанных на них совпали строки из одинаковых подходов — так бывает случайно, проверка их не роняет:'); for (const [k, n] of noted) console.log('  ·  ' + k.split(' — ')[1] + (n > 1 ? ' ×' + n : '')); }
if (!found.size) { console.log('\nЛичного не найдено'); process.exit(0); }
const byWhat = new Map();
for (const [k, n] of found) { const [what, where] = k.split(' — '); if (!byWhat.has(what)) byWhat.set(what, []); byWhat.get(what).push(where + (n > 1 ? ' ×' + n : '')); }
for (const [what, list] of [...byWhat].sort((a, b) => b[1].length - a[1].length)) console.log('  FAIL  ' + what + ' — мест: ' + list.length + '\n          ' + list.slice(0, 12).join('\n          ') + (list.length > 12 ? '\n          … и ещё ' + (list.length - 12) : ''));
console.log('\nНайдено личное или подозрительное: видов ' + byWhat.size + ', мест ' + found.size);
process.exit(1);
