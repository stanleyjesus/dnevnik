#!/usr/bin/env node
/* Сверка экранов в работе. Эталонная страница (reference/harness.html) и новое приложение открываются в настоящем браузере
   с одними и теми же записями. Сценарий (scripts/scenarios.mjs) — это шаги: нажать, ввести, выбрать. Каждый шаг выполняется
   на обеих страницах, и после него должны совпасть: разметка экрана символ в символ, шапка и вкладки, значения в полях,
   сообщение внизу экрана, сохранённые записи, черновик в памяти браузера, сохранённый файл, скопированный текст.
   Отличаться может только то, что перечислено в KNOWN. Ошибка в коде страницы или горизонтальная прокрутка — тоже провал.

   Условия у страниц одинаковые и повторяемые: часы стоят на дне, когда сделана копия записей, и идут по секунде на шаг;
   долгие ожидания страницы (автосохранение через 2,5 с) срабатывают, когда шаг говорит «подождать», а не между шагами;
   эталон работает без запросов к модели — как приложение; случайные числа у обеих страниц одни и те же.
   Записи — примерные, из data/ (атлет выдуман, их пишет data/make.cjs): основной набор и тот же дневник неделей позже
   (data/later.json — с запасом в подходах, весом тела и принятой программой). Общий сценарий идёт на обоих наборах.
   Нужен Edge или Chrome; свой путь к браузеру — в переменной CHROME_PATH.

   node scripts/screens.mjs                     все сценарии (около 15 минут)
   node scripts/screens.mjs журнал мышцы        только те, в названии которых есть одно из слов
   node scripts/screens.mjs "журнал · примерные"   один сценарий на одном наборе записей
   --шаги      показать по каждому шагу, что он изменил в приложении
   --шрифт-айфона   дать приложению размер шрифта в полях, как на iPhone: не станет ли страница шире экрана
   --кнопки    показать, что есть на экране там, где сценарий закончился или остановился
   --дни       все сценарии только в приложении и с его собственными днями «День 1…N»: без сравнения с эталоном, ловятся ошибки страницы,
               страница шире экрана, шаги, которым не нашлось кнопки, и отличие от снимка — того, что приложение показало и записало
               после каждого шага в прошлый раз (app/snapshots/, устройство снимков — scripts/snapshots.mjs)
   --переписать   то же, что --дни, но снимки не сверяются, а пишутся заново — только когда приложение изменено намеренно.
               С названиями сценариев переписываются только их снимки; без названий — все, а снимки убранных сценариев удаляются

   Дни программы. У артефакта их три, и это дни недели; у приложения — «День 1…N» без привязки к дням недели (решение владельца,
   19 ноября 2026). Сравнивать с эталоном можно только одинаковое, поэтому для общих сценариев приложение запускается с таблицей дней
   артефакта (window.__dnevnikWeek) — так сверяется вся остальная логика и разметка. Сценарии «только в приложении» и запуск с --дни
   идут с собственными днями приложения: шаг «нажать Понедельник» там сам нажимает «День 1». */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { serve } from './serve.mjs';
import { launch, sleep } from './browser.mjs';
import { RELOAD, SCENARIOS } from './scenarios.mjs';
import { firstDiff, slug, snapshotText } from './snapshots.mjs';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url))), root = path.dirname(app);
const J = v => JSON.stringify(v);

/* что в новом приложении изменено намеренно. cut выполняется в странице и возвращает, что убрать из сравнения:
   drop — куски экрана целиком, blank — элементы, у которых отличается только подпись в начале */
const KNOWN = [
  { view: 'setup', what: '«Настройка»: карточка «Данные» (текст о хранении на устройстве, кнопка загрузки копии)',
    cut: root => ({ drop: [...root.querySelectorAll('section.card')].filter(s => s.querySelector('#backup-all')), blank: [] }) },
  { view: 'setup', what: '«Настройка»: блока «Лимиты и методика» нет, и строка «Остальные настройки» его не называет (решение владельца, 18 ноября 2026)',
    cut: root => ({ drop: [...root.querySelectorAll('section.card')].filter(s => s.querySelector('#st-start')), blank: [...root.querySelectorAll('#setup-more > summary')] }) },
  { view: 'setup', what: '«Настройка»: кнопки встроенного справочника над снарядами и «Убрать» у неиспользуемого упражнения в справочнике',
    cut: root => ({ drop: [...root.querySelectorAll('#starter-tools, button[id^="ex-del-"]')], blank: [] }) },
  { view: 'setup', what: '«Настройка»: кнопки «+ Снаряд» нет — шаг меняется у снарядов, которые есть (решение владельца, 23 ноября 2026)',
    cut: root => ({ drop: [...root.querySelectorAll('#gear-new')], blank: [] }) },
  { view: 'program', what: '«Программа»: вместо списка «Как собрать» — кнопки цели (масса, сила, гибрид, вручную) и один уточняющий список; цель «Сила» — силовой режим; рядом список «Время на тренировку» (решения владельца, 19 ноября 2026). Шаги выбирают сценарий через __t.mode: он знает оба вида выбора',
    cut: root => ({ drop: [...root.querySelectorAll('#pg, label.f')].filter(e => e.id === 'pg' || e.querySelector('#pf, #pm, #pl, #ps, #pt')), blank: [] }) },
  { view: 'muscles', what: '«Мышцы»: карточки «Баланс движений» нет — баланс движений дневник не считает (решение владельца, 23 ноября 2026)',
    cut: root => ({ drop: [...root.querySelectorAll('section.card')].filter(s => { const t = s.querySelector('h2'); return !!t && t.textContent === 'Баланс движений'; }), blank: [] }) },
  { view: 'coach', what: '«Советы»: карточки «Разбор от Claude» нет — запросов к модели нет',
    cut: root => ({ drop: [...root.querySelectorAll('section.card')].filter(s => { const t = s.querySelector('h2'); return !!t && t.textContent === 'Разбор от Claude'; }), blank: [] }) },
  { view: 'overview', what: '«Обзор» пустого дневника: кнопка «Загрузить резервную копию»',
    cut: root => ({ drop: [...root.querySelectorAll('#import-first, #import-box')], blank: [] }) }
];
/* что сравнивается после каждого шага */
const FACETS = [['hash', 'открыта другая вкладка'], ['view', 'разметка экрана'], ['top', 'шапка или вкладки'], ['fields', 'значения в полях'], ['toast', 'сообщение внизу экрана'],
  ['store', 'сохранённые записи'], ['local', 'черновик в памяти браузера'], ['saved', 'сохранённый файл'], ['copied', 'скопированный текст'], ['focus', 'поле, в котором стоит курсор']];


/* записи для обеих страниц в виде резервной копии: примерные данные и тот же дневник неделей позже.
   Часы страниц — 10 утра того дня, когда сделана копия: планы и недели не плывут вместе с календарём.
   Часовой пояс у страниц — UTC на любом компьютере (TZ ниже): время в записях и снимки не зависят от того, где идёт проверка */
const TZ = 'UTC';
const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const clockOf = b => new Date((/^\d{4}-\d\d-\d\d/.test(b.exportedAt || '') ? b.exportedAt.slice(0, 10) : '2025-11-12') + 'T10:00:00Z').getTime();
const pack = {
  format: 'training-diary-backup', version: 1, exportedAt: '2025-11-12T08:00:00.000Z', profiles: [
    { id: 'me', name: 'Мой дневник', config: json('data/config.json'), workouts: json('data/workouts.json').map(d => Object.assign({ id: d.date }, d)), body: [], coach: null },
    { id: 'p2', name: 'Второй профиль', config: json('data/config.p2.stored.json'), workouts: [], body: [], coach: null }]
};
const DATA = { seed: { name: 'примерные данные', backup: pack, base: clockOf(pack) }, empty: { name: 'пустой дневник', backup: null, base: clockOf(pack) } };
/* то же с разбором от модели, сохранённым ещё в артефакте: приложение его не показывает, но хранит и выгружает */
DATA.notes = { name: 'примерные данные с разбором', base: clockOf(pack), backup: Object.assign({}, pack, { profiles: pack.profiles.map((p, i) => i ? p : Object.assign({}, p, { coach: { text: '- **Икры и пресс**: добавь по два подхода в пятницу.\nОстальное оставь как есть.', at: '2025-11-11', q: 'что добавить?' } })) }) };
/* то же со своими лимитами и своей методикой в настройке первого профиля. Лимит недели нарочно ниже недельной нагрузки примерной программы
   (с этой настройкой — 70 подходов): так видно замечание «Программа выходит за твои лимиты», а поправки плана выключаются. На экране приложения их больше не задать (блока «Лимиты и методика» нет),
   но в записях они остаются настройкой профиля и действуют: границы зон, лимиты дня и недели, отдых, запас, вес тела, мышцы вне расчёта, волна, начало счёта недель */
const TUNED = { start: '2025-09-01', zones: { min: 5, opt: 9, high: 18 }, caps: { day: 9, week: 60 }, rest: 150, rir: 2, bw: 'track', ignore: { forearms: 1, calves: 0 },
  cycle: { inc: 2.5, sets: 5, pct: { 5: 75, 4: 82, 3: 87 } }, method: 'Проверка: своя методика.' };
DATA.tuned = { name: 'примерные данные со своими лимитами', base: clockOf(pack), backup: Object.assign({}, pack, { profiles: pack.profiles.map((p, i) => i ? p : Object.assign({}, p, { config: Object.assign({}, p.config, TUNED) })) }) };
{ const b = json('data/later.json'); DATA.copy = { name: 'дневник неделей позже', backup: b, base: clockOf(b) }; }
/* те же записи документами хранилища — так их получает эталон */
const docsOf = b => {
  const out = [['config/profiles', { list: b.profiles.map(p => ({ id: p.id, n: p.name })) }]];
  for (const p of b.profiles) {
    const me = p.id === 'me';
    if (p.config) out.push([me ? 'config/main' : 'config/' + p.id, p.config]);
    for (const w of p.workouts) { const { id, ...doc } = w; out.push([(me ? 'workouts' : 'workouts_' + p.id) + '/' + id, doc]); }
    for (const r of p.body) { const { id, ...doc } = r; out.push([(me ? 'body' : 'body_' + p.id) + '/' + id, doc]); }
    if (p.coach) out.push([me ? 'notes/coach' : 'notes/coach_' + p.id, p.coach]);
  }
  return out;
};


/* Выполняется в каждой странице до её собственного кода: часы, случайные числа, помощники шагов, снимок состояния.
   Для эталона ещё: записи кладутся в его хранилище до запуска, запросы к модели выключены, сохранение файла запоминается. */
function inPage(base, isRef, seed, known, pack) {
  const R = Date;
  let now = base, rnd = 20261118;
  class Clock extends R { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  window.Date = Clock;
  Math.random = () => (rnd = (rnd * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const errors = [];
  window.addEventListener('error', e => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => errors.push('в обещании: ' + String(e.reason && e.reason.message || e.reason)));
  let saved = null, saving = null, copied = '';
  if (isRef) {
    let store, claude;
    Object.defineProperty(window, '__store', { configurable: true, get: () => store, set: st => { store = st; if (seed) { st.clear(); for (const [k, v] of seed) st.set(k, v); } } });
    Object.defineProperty(window, 'claude', { configurable: true, get: () => claude, set: v => {
      claude = { use: async n => n === 'sample' ? null : n === 'downloads' ? { save: async o => { saved = { filename: o.filename, text: String(o.data) }; return { status: 'saved' }; } } : v.use(n) };
    } });
  } else {
    /* обещает ли браузер хранить записи, зависит от его версии и настроек: здесь он всегда отвечает «нет» — строка о хранении
       в «Настройке» → «Данные» одна и та же на любом компьютере */
    try { if (navigator.storage) for (const k of ['persisted', 'persist']) Object.defineProperty(navigator.storage, k, { configurable: true, value: async () => false }); } catch (e) { /* останется как есть */ }
    /* приложение сохраняет файл обычным скачиванием: вместо скачивания запоминается имя и содержимое */
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.hasAttribute('download')) return click.call(this);
      const rec = { filename: this.getAttribute('download'), text: '' };
      /* байты файла читаются как есть: метка порядка байтов в начале таблицы — часть файла */
      saving = fetch(this.href).then(r => r.arrayBuffer()).then(b => { rec.text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(b); saved = rec; }, () => { rec.text = '(файл не прочитался)'; saved = rec; });
    };
  }
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { copied = String(t); } } }); } catch (e) { /* буфер обмена останется как есть */ }

  /* Долгие ожидания страницы — автосохранение через 2,5 с, скрытие сообщения, «записи долго не грузятся» — идут по часам проверки:
     срабатывают, когда шаг говорит «подождать», а не когда им случится попасть между шагами. Короткие (до секунды) идут как обычно. */
  const realSet = window.setTimeout.bind(window), realClear = window.clearTimeout.bind(window);
  let later = 0, seq = 0;
  const held = new Map();
  window.setTimeout = (fn, ms, ...args) => { if (!(ms >= 1000)) return realSet(fn, ms, ...args); const id = 'долгое ожидание ' + (++seq); held.set(id, { at: later + ms, fn, args }); return id; };
  window.clearTimeout = id => { if (typeof id === 'string') held.delete(id); else realClear(id); };
  const pause = ms => new Promise(r => realSet(r, ms));
  /* прошло ms: срабатывает всё долгое, чему подошёл срок, по порядку */
  const wait = async ms => {
    later += ms;
    for (;;) {
      let next = null;
      for (const [id, x] of held) if (x.at <= later && (!next || x.at < next[1].at)) next = [id, x];
      if (!next) break;
      held.delete(next[0]); next[1].fn(...next[1].args);
      await pause(40);
    }
    await pause(120);
  };
  const all = sel => [...document.querySelectorAll(sel)];
  /* дни артефакта и те же дни в приложении, когда оно запущено со своими днями */
  const DAY_ALIAS = { 'Понедельник': 'День 1', 'Среда': 'День 2', 'Пятница': 'День 3', 'Пн': 'День 1', 'Ср': 'День 2', 'Пт': 'День 3' };
  /* n — номер среди подходящих; отрицательный — с конца */
  const el = (sel, n = 0) => { const list = all(sel), e = list[n < 0 ? list.length + n : n]; if (!e) throw new Error('нет элемента ' + sel + ' [' + n + '] на экране ' + (location.hash || '#overview') + ', таких всего ' + list.length); return e; };
  const fill = (e, value) => { e.focus(); e.value = String(value); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); };
  const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  /* все сохранённые документы: у эталона — из его хранилища в памяти, у приложения — прямо из базы браузера, мимо кода приложения */
  const docs = async () => {
    if (isRef) return [...window.__store.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    if (!window.indexedDB) return [];
    if (!(await indexedDB.databases()).some(d => d.name === 'dnevnik')) return [];
    const db = await req(indexedDB.open('dnevnik'));
    try {
      if (!db.objectStoreNames.contains('docs')) return [];
      const os = db.transaction('docs').objectStore('docs'), [keys, vals] = await Promise.all([req(os.getAllKeys()), req(os.getAll())]);
      return keys.map((k, i) => [k, vals[i]]).sort((a, b) => a[0] < b[0] ? -1 : 1);
    } finally { db.close(); }
  };
  window.__t = {
    wait,                                                             // прошло столько-то времени по часам проверки
    pause,                                                            // настоящая пауза
    pack,                                                             // примерные данные текстом резервной копии — для шагов, которые загружают копию с экрана
    /* начало шага: часы на новое место, прошлые сообщение, файл и буфер забыты */
    begin(ms) { now = ms; saved = null; saving = null; copied = ''; const t = document.getElementById('toast'); if (t) t.textContent = ''; },
    /* страница успокоилась: 300 мс без изменений на экране */
    settle(quiet = 300, max = 8000) {
      return new Promise(done => {
        const fin = () => { mo.disconnect(); realClear(t); realClear(end); done(); };
        const mo = new MutationObserver(() => { realClear(t); t = realSet(fin, quiet); });
        let t = realSet(fin, quiet);
        const end = realSet(fin, max);
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      });
    },
    async go(view) { location.hash = view; await pause(120); },
    el,
    count: sel => all(sel).length,
    /* нажатие: у частей рисунка (svg) своего click() нет, им событие отправляется напрямую */
    click(sel, n = 0) { const e = el(sel, n); if (typeof e.click === 'function') e.click(); else e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); },
    focus(sel, n = 0) { el(sel, n).focus(); },
    blur() { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); },
    /* дата относительно дня, на котором стоят часы страницы: 0 — сегодня, -7 — неделю назад */
    day(k) { const d = new R(now + k * 86400000), p = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); },
    /* проверка для шагов, которые идут только в приложении */
    expect(ok, what) { if (!ok) throw new Error('не выполнено: ' + what); },
    /* кнопка, ссылка или заголовок раскрывающегося блока по их тексту; n — номер среди одинаковых */
    press(text, n = 0, scope = '#view') {
      if (!isRef && !window.__dnevnikWeek && DAY_ALIAS[text]) text = DAY_ALIAS[text];
      const b = all(scope + ' button, ' + scope + ' a, ' + scope + ' summary').filter(x => x.textContent.trim() === text)[n];
      if (!b) throw new Error('нет кнопки «' + text + '» [' + n + '] на экране ' + (location.hash || '#overview'));
      b.click();
    },
    /* ввод в поле: как с клавиатуры — значение, событие ввода, уход из поля */
    type(sel, n, value) { fill(el(sel, n), value); },
    /* одно и то же во все подходящие поля; нажать все подходящие кнопки — например, «Все по N» у каждого базового */
    typeAll(sel, value) { const list = all(sel); if (!list.length) throw new Error('нет элемента ' + sel + ' на экране ' + (location.hash || '#overview')); list.forEach(e => fill(e, value)); },
    clickAll(sel) { const list = all(sel); if (!list.length) throw new Error('нет элемента ' + sel + ' на экране ' + (location.hash || '#overview')); list.forEach(e => e.click()); },
    /* выбор в списке: по значению или по тексту пункта */
    pick(sel, n, value) {
      const e = el(sel, n), o = [...e.options].find(x => x.value === String(value)) || [...e.options].find(x => x.textContent.trim() === String(value));
      if (!o) throw new Error('в списке ' + sel + ' нет пункта «' + value + '»: ' + [...e.options].map(x => x.value).join(', '));
      e.focus(); e.value = o.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur();
    },
    /* выбор в списке по номеру пункта; отрицательный номер — с конца */
    pickAt(sel, n, index) {
      const e = el(sel, n), o = e.options[index < 0 ? e.options.length + index : index];
      if (!o) throw new Error('нет пункта № ' + index + ' в списке ' + sel + ': всего ' + e.options.length);
      e.focus(); e.value = o.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur();
    },
    /* сценарий сборки на «Программе». У эталона это один список «Как собрать», у приложения — кнопки цели и уточняющий список,
       поэтому шаг называет сам сценарий: значением ('manual', 'even', 'm:glutes', 'l:bench'; 's' и 's:bench' есть только в приложении) или местом в своей группе —
       { prio: 0 } первая группа мышц, { lift: -1 } последнее базовое. Приложение сначала получает нажатие на цель, потом выбор в списке */
    async mode(what) {
      const pre = typeof what === 'string' ? '' : 'prio' in what ? 'm:' : 'l:', at = pre ? (pre === 'm:' ? what.prio : what.lift) : 0;
      const choose = sel => {
        const e = el(sel), list = [...e.options].filter(o => pre ? o.value.startsWith(pre) : o.value === what), o = list[at < 0 ? list.length + at : at];
        if (!o) throw new Error('в списке ' + sel + ' нет пункта ' + JSON.stringify(what) + ': ' + [...e.options].map(x => x.value).join(', '));
        e.focus(); e.value = o.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur();
      };
      if (isRef) return choose('#pf');
      const goal = pre ? (pre === 'm:' ? 'mass' : 'mix') : what === 'manual' ? 'hand' : what === 's' || what.startsWith('s:') ? 'force' : what.startsWith('l:') ? 'mix' : 'mass';
      const b = el('#pg-' + goal);
      if (b.getAttribute('aria-pressed') !== 'true') { b.click(); await pause(60); }
      if (goal !== 'hand') choose(goal === 'mass' ? '#pm' : goal === 'mix' ? '#pl' : '#ps');
    },
    key(sel, n, key) { const e = el(sel, n); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); },
    point(sel, n, type, fx = 0.5, fy = 0.5) { const e = el(sel, n), b = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(type, { bubbles: type !== 'pointerenter' && type !== 'pointerleave', clientX: b.left + b.width * fx, clientY: b.top + b.height * fy, pointerType: 'mouse' })); },
    /* что на экране можно нажать и заполнить — подсказка, когда шаг не нашёл свою кнопку; одинаковые поля подходов свёрнуты в одну строку */
    controls() {
      const seen = new Map();
      for (const e of all('#view button, #view a, #view summary, #view input, #view select, #view textarea')) {
        const t = e.tagName.toLowerCase(), id = e.id ? '#' + e.id.replace(/\d+(-\d+)*$/, '*') : '';
        const text = (t === 'input' || t === 'textarea' || t === 'select' ? e.getAttribute('aria-label') || '' : e.textContent || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').replace(/\d+$/, '*').slice(0, 44);
        const k = t + id + (t === 'input' ? '[' + e.type + ']' : '') + (t === 'select' ? ' {' + [...e.options].map(o => o.value).join(',').slice(0, 70) + '}' : '') + (text ? ' «' + text + '»' : '');
        seen.set(k, (seen.get(k) || 0) + 1);
      }
      return [...seen].map(([k, n]) => k + (n > 1 ? ' ×' + n : '')).join('\n');
    },
    /* снимок всего, что сравнивается */
    /* width — ширина экрана, заданная проверкой: телефон при широкой странице сам отдаляет её, и своя ширина окна тогда ничего не говорит */
    async look(whole, width) {
      const view = document.getElementById('view'), name = (location.hash || '#overview').slice(1);
      const drop = [], blank = [];
      if (!whole) for (const k of known) if (k.view === name) { const c = k.cut(view); drop.push(...c.drop); blank.push(...c.blank); }
      drop.forEach(e => e.setAttribute('data-cut', '')); blank.forEach(e => e.setAttribute('data-blank', ''));
      const copy = view.cloneNode(true);
      copy.querySelectorAll('[data-cut]').forEach(e => e.remove());
      copy.querySelectorAll('[data-blank]').forEach(e => { if (e.firstChild) e.firstChild.textContent = ''; e.removeAttribute('data-blank'); });
      const fields = [...view.querySelectorAll('input, select, textarea')].filter(e => !e.closest('[data-cut]'))
        .map(e => (e.id || e.name || e.tagName) + '=' + (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value) + (e.disabled ? ' (выключено)' : '')).join(' | ');
      drop.forEach(e => e.removeAttribute('data-cut')); blank.forEach(e => e.removeAttribute('data-blank'));
      if (saving) await saving;
      /* страница шире экрана: её ширина и то, что выступает за край (кроме таблиц со своей прокруткой) */
      const limit = width || window.innerWidth, full = document.documentElement.scrollWidth;
      let wide = '';
      if (full > limit + 1) {
        const out = [...view.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > limit + 1 && !e.closest('.scroll-x'));
        wide = 'ширина страницы ' + full + ' при экране ' + limit + '; выступает: ' + (out.filter(e => ![...e.children].some(c => out.includes(c))).slice(0, 3)
          .map(e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '') + ' «' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) + '»').join('; ') || 'не нашлось что');
      }
      const a = document.activeElement, prof = document.getElementById('prof');
      return {
        hash: location.hash, view: copy.innerHTML, fields,
        top: document.querySelector('header.top').innerHTML.replace(/хранилище на связи|записи на устройстве/, '') + (prof ? ' профиль=' + prof.value : '') + document.getElementById('tabs').innerHTML,
        toast: document.getElementById('toast').textContent,
        focus: a && a !== document.body ? a.id || a.tagName : '',
        store: JSON.stringify(await docs()),
        local: JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])),
        saved: saved ? JSON.stringify(saved) : '', copied,
        errors: errors.splice(0).join('\n'), wide
      };
    }
  };
}
const initSource = (isRef, base, seed) => '(' + inPage.toString() + ')(' + base + ', ' + isRef + ', ' + J(seed) + ', [' + KNOWN.map(k => '{ view: ' + J(k.view) + ', cut: ' + k.cut.toString() + ' }').join(', ') + '], ' + (isRef ? 'null' : J(JSON.stringify(pack))) + ');';

/* сценарии: все или те, что названы в командной строке. Сценарий идёт на каждом наборе записей, для которого он годится:
   на примерных данных и на дневнике неделей позже; с data: 'empty' — один раз на пустом дневнике */
const verbose = process.argv.includes('--шаги'), showControls = process.argv.includes('--кнопки'), REWRITE = process.argv.includes('--переписать'), SMOKE = REWRITE || process.argv.includes('--дни');
/* --шрифт-айфона: приложение получает размер шрифта в полях, как на iPhone (там действует правило из конца style.css,
   а в Edge и Chrome оно выключено) — так проверка «страница не шире экрана» видит то, что увидит iPhone */
const IOS_FONT = process.argv.includes('--шрифт-айфона') ? " document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'input:not(.gear-n), select, textarea { font-size: 16px !important; }'; document.head.appendChild(st); });" : '';
const words = process.argv.slice(2).filter(w => !w.startsWith('--')).map(w => w.toLowerCase());
const runs = [];
for (const sc of SCENARIOS) for (const id of sc.data ? [].concat(sc.data) : ['seed', 'copy']) if (DATA[id]) runs.push({ sc, data: DATA[id], name: sc.name + (id === 'empty' || id === 'tuned' ? '' : ' · ' + DATA[id].name) });
const chosen = runs.filter(r => !words.length || words.some(w => r.name.toLowerCase().includes(w)));
if (!chosen.length) { console.error('Нет сценария с таким названием. Есть: ' + SCENARIOS.map(s => s.name).join(', ')); process.exit(1); }
/* снимки прогона с днями приложения: по файлу на сценарий и набор записей. Что получилось сейчас, когда снимок не совпал, —
   в app/.snapshots/ рядом: его можно сравнить со снимком (git diff --no-index app/snapshots/<файл> app/.snapshots/<файл>) */
const SNAP = path.join(app, 'snapshots'), NOW = path.join(app, '.snapshots');
{ const names = new Map(); for (const r of runs) { const f = slug(r.name); if (names.has(f)) { console.error('У прогонов «' + names.get(f) + '» и «' + r.name + '» одно имя снимка: ' + f); process.exit(1); } names.set(f, r.name); r.file = f; } }
if (SMOKE) { fs.rmSync(NOW, { recursive: true, force: true }); if (REWRITE) fs.mkdirSync(SNAP, { recursive: true }); }

/* своя сборка в своей папке: правка исходников или открытое рядом приложение не меняют то, что проверяется */
const out = path.join(app, '.screens');
await build({ dev: true, dir: out });
const { server, url } = await serve(out, 0);
/* у страниц разные адреса, чтобы у каждой была своя память браузера: черновик одной не должен попадать в другую */
const APP = url, REF = url.replace('localhost', '127.0.0.1');
let failed = 0, steps = 0, idle = 0, skipped = 0, written = 0;
const started = Date.now();
/* у каждой страницы свой браузер: обе на виду и в фокусе, ни одна не лежит фоновой вкладкой.
   Страница готова, когда её помощники на месте и записи загружены: значок в шапке стал «на связи» */
const READY = '!!window.__t && !!document.querySelector("#sync.ok")';
const ref = await launch('эталон', READY), mine = await launch('приложение', READY);
try {
  for (const p of [ref, mine]) await p.call('Emulation.setTimezoneOverride', { timezoneId: TZ });

  /* обе страницы запускаются заново с одними и теми же сохранёнными записями */
  /* noStore — приложение запускается так, будто база браузера недоступна (как в режиме «инкогнито» некоторых браузеров) */
  const fresh = async (data, noStore, week) => {
    await ref.blank(); await mine.blank();
    await ref.call('Storage.clearDataForOrigin', { origin: REF, storageTypes: 'all' });
    await mine.call('Storage.clearDataForOrigin', { origin: APP, storageTypes: 'all' });
    await ref.init(initSource(true, data.base, data.backup ? docsOf(data.backup) : []));
    await mine.init(initSource(false, data.base, null) + IOS_FONT + (week ? ' window.__dnevnikWeek = true;' : '') + (noStore ? ' Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });' : ''));
    await ref.goto(REF + '/__ref/harness.html');
    await mine.goto(APP + '/', noStore ? '!!window.__t && !!document.querySelector("#sync.bad")' : undefined);
    if (data.backup) {
      /* приложение получает записи так же, как их получит атлет: загрузкой резервной копии с экрана */
      await mine.run('window.__dnevnik.loadBackupText(' + J(JSON.stringify(data.backup)) + ', "backup.json"); for (let i = 0; i < 100 && !document.getElementById("import-go"); i++) await __t.pause(50);'
        + ' document.getElementById("import-go").click(); for (let i = 0; i < 200 && (document.getElementById("import-box") || window.__dnevnik.S.conn !== "ready"); i++) await __t.pause(50); await __t.settle();');
      await mine.reload();
    }
    await Promise.all([ref.run('await __t.settle();'), mine.run('await __t.settle();')]);
  };
  /* перезагрузка обеих страниц: приложение читает записи из базы браузера, эталон получает свои же записи заново */
  const reload = async data => {
    const kept = JSON.parse(await ref.run('return (await __t.look()).store;'));
    await ref.init(initSource(true, data.base, kept));
    await Promise.all([ref.reload(), mine.reload()]);
  };
  const around = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return 'с символа ' + i + '\n          эталон: …' + a.slice(Math.max(0, i - 70), i + 110) + '…\n          сейчас: …' + b.slice(Math.max(0, i - 70), i + 110) + '…'; };
  const differ = (a, b) => {
    if (a.skip !== b.skip) return 'кнопка шага есть только на одной из страниц: ' + (a.skip ? 'в эталоне её нет' : 'в приложении её нет');
    for (const [key, name] of FACETS) if (a[key] !== b[key]) return name + ': расходится ' + around(a[key], b[key]);
    if (b.errors) return 'ошибка в приложении: ' + b.errors;
    if (a.errors) return 'ошибка в эталоне (шаг сценария составлен неверно?): ' + a.errors;
    if (b.wide) return 'страница шире экрана: появилась горизонтальная прокрутка (' + b.wide + ')' + (a.wide ? ' — у эталона то же самое' : ' — у эталона этого нет');
    return '';
  };
  const plural = (n, w) => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? w[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? w[1] : w[2]);

  console.log('Записи: ' + Object.values(DATA).filter(d => d.backup).map(d => d.name + ' (' + plural(d.backup.profiles.reduce((a, p) => a + p.workouts.length, 0), ['тренировка', 'тренировки', 'тренировок']) + ', часы страниц — ' + new Date(d.base).toLocaleDateString('ru-RU') + ')').join('; '));
  for (const { sc, data, name, file } of chosen) {
    let bad = '', done = 0, was = null, tick = 0, miss = 0;
    const solo = !!sc.app || SMOKE;                                    // без сравнения с эталоном: приложение со своими днями
    const log = [], shots = [];
    try {
      let [w, h] = sc.size || [390, 844];
      await ref.size(w, h); await mine.size(w, h);
      await fresh(data, sc.noStore, !solo);
      for (const [title, code] of sc.steps) {
        const at = data.base + ++tick * 1000, begin = '__t.begin(' + at + '); let skip = false; ';
        let body = code;
        if (code === RELOAD) { if (solo) await mine.reload(); else await reload(data); body = ''; }
        else if (code.startsWith('@size ')) { [w, h] = code.split(' ').slice(1).map(Number); await ref.size(w, h); await mine.size(w, h); await sleep(450); body = ''; }
        /* шаг «если есть»: на этих записях нужной кнопки может не быть — тогда он пропускается, но на обеих страницах сразу */
        else if (code.startsWith('@maybe ')) body = 'try { ' + code.slice(7) + ' } catch (e) { if (!String(e && e.message).startsWith("нет ")) throw e; skip = true; }';
        /* сценарий с app: true идёт только в приложении: у эталона такого экрана нет, шаги проверяют себя сами через __t.expect */
        const end = ' await __t.settle(); return Object.assign(await __t.look(' + solo + ', ' + w + '), { skip });';
        const looks = await Promise.all((solo ? [mine] : [ref, mine]).map(p => p.run(begin + body + end)));
        const a = looks[0], b = looks[looks.length - 1];
        const d = solo ? (b.errors ? 'ошибка в приложении: ' + b.errors : b.wide ? 'страница шире экрана: появилась горизонтальная прокрутка (' + b.wide + ')' : '') : differ(a, b);
        if (d) { bad = 'шаг ' + (done + 1) + ' «' + title + '» — ' + d; break; }
        done++;
        if (SMOKE) shots.push({ title, look: b, skip: b.skip });
        /* что шаг изменил в приложении: шаг, после которого ничего не изменилось, скорее всего составлен неверно */
        const moved = was ? FACETS.filter(([k]) => k !== 'toast' && b[k] !== was[k]).map(([, n]) => n) : ['первый шаг'];
        if (b.skip) miss++;
        log.push('          ' + String(done).padStart(2) + '. ' + title.padEnd(46) + (b.skip ? 'пропущен: на этих записях такой кнопки нет' : moved.length ? moved.join('; ') : code === RELOAD ? 'всё как до перезагрузки' : code.startsWith('@size ') ? 'разметка от ширины экрана не зависит' : b.toast ? 'только сообщение' : sc.app || code.includes('__t.expect(') ? 'проверка без действия' : 'НИЧЕГО НЕ ИЗМЕНИЛОСЬ') + (b.toast ? ' · «' + b.toast + '»' : ''));
        was = b;
      }
    } catch (e) { bad = 'шаг ' + (done + 1) + (sc.steps[done] ? ' «' + sc.steps[done][0] + '»' : '') + ' — ' + (e && e.message || e); }
    /* снимок: все шаги прошли — сверить с прежним или записать заново */
    let text = '';
    if (SMOKE && !bad) try { text = snapshotText(name, shots); } catch (e) { bad = 'снимок не составился: ' + (e && e.message || e); }
    if (SMOKE && !bad) {
      const at = path.join(SNAP, file);
      if (REWRITE) { if (!fs.existsSync(at) || fs.readFileSync(at, 'utf8') !== text) { fs.writeFileSync(at, text); written++; } }
      else {
        const old = fs.existsSync(at) ? fs.readFileSync(at, 'utf8') : null, d = old == null ? '' : firstDiff(old, text);
        if (old == null || d) { fs.mkdirSync(NOW, { recursive: true }); fs.writeFileSync(path.join(NOW, file), text); }
        if (old == null) bad = 'снимка нет: app/snapshots/' + file + ' — сделать его: npm run screens -- --переписать "' + name + '"';
        else if (d) bad = 'не как в снимке app/snapshots/' + file + ' (что сейчас — app/.snapshots/' + file + '): ' + d;
      }
    }
    /* --кнопки: что есть на экране эталона там, где сценарий остановился или закончился */
    if (showControls || /нет (кнопки|элемента|пункта)|в списке/.test(bad)) log.push('          на экране ' + (solo ? 'приложения' : 'эталона') + ':\n' + String(await (solo ? mine : ref).run('return __t.controls();').catch(e => e.message)).split('\n').map(l => '            ' + l).join('\n'));
    steps += done - miss; skipped += miss;
    if (bad) failed++;
    idle += log.filter(l => l.includes('НИЧЕГО НЕ ИЗМЕНИЛОСЬ')).length;
    console.log((bad ? '  FAIL  ' : '  ok    ') + name.padEnd(52) + (bad ? bad : plural(done - miss, ['шаг', 'шага', 'шагов']).padStart(9) + (miss ? ', пропущено ' + miss : '')));
    const lines = log.filter(l => verbose || l.includes('НИЧЕГО НЕ ИЗМЕНИЛОСЬ') || l.includes('          на экране '));
    if (lines.length) console.log(lines.join('\n'));
  }
  /* снимки сценариев, которых больше нет: при полном прогоне — провал, при полной перезаписи они удаляются */
  if (SMOKE && !words.length && fs.existsSync(SNAP)) {
    const live = new Set(runs.map(r => r.file));
    for (const f of fs.readdirSync(SNAP).filter(f => f.endsWith('.txt') && !live.has(f)).sort()) {
      if (REWRITE) { fs.rmSync(path.join(SNAP, f)); written++; console.log('  убран снимок ' + f + ': такого сценария больше нет'); }
      else { failed++; console.log('  FAIL  снимок app/snapshots/' + f + ' — такого сценария нет: убрать его — npm run screens -- --переписать'); }
    }
  }
} catch (e) { failed++; console.log('  FAIL  ' + (e && e.message || e)); }
await ref.close();
await mine.close();
server.close();
console.log('\nНамеренные отличия, которые в сравнение не входят:');
for (const k of KNOWN) console.log('  · ' + k.what);
if (idle) console.log('\nШагов, после которых в приложении ничего не изменилось: ' + idle + ' — они ничего не проверяют, сценарий нужно поправить');
console.log(failed ? '\nНе совпало сценариев: ' + failed : idle ? '' : (REWRITE ? '\nСнимки с днями «День 1…N» переписаны: изменилось ' + written + ' из ' + chosen.length + '; шагов ' : SMOKE ? '\nВсе сценарии прошли в приложении с днями «День 1…N» и совпали со снимками: шагов ' : '\nВсе сценарии совпали с эталоном: шагов ') + steps + (skipped ? ', пропущено ' + skipped : '') + ', ' + Math.round((Date.now() - started) / 1000) + ' с');
process.exit(failed || idle ? 1 : 0);
