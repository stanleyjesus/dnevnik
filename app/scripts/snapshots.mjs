/* Снимки прогона с днями приложения (npm run screens -- --дни). Общие сценарии сверяются с эталоном на таблице дней артефакта;
   с днями «День 1…N» эталона нет, поэтому то, что приложение показало и записало после каждого шага, запоминается
   и при следующем прогоне должно повториться: отклонение от снимка — провал. Снимки переписываются только намеренно:
   npm run screens -- --переписать (можно для части сценариев — по словам из названия, как обычно).

   Один снимок — один сценарий на одном наборе записей, текстом в app/snapshots/: так при намеренной перезаписи в запросе на слияние
   видно, что именно поменялось на экране и в записях. Что входит в снимок шага — то же, что сравнивается с эталоном:
   адрес, разметка экрана, шапка и вкладки, значения в полях, сообщение внизу экрана, поле с курсором, сохранённые записи,
   черновик в памяти браузера, сохранённый файл, скопированный текст. Чтобы снимки не разрастались:
     · разметка пишется по элементу в строке, с отступом по вложенности и коротко (div#id.класс(атрибуты) текст);
       рисунки и длинные значения атрибутов — отпечатком;
     · в каждом шаге пишется только то, что изменилось после прошлого: у разметки — изменённые строки к прошлому шагу
       или к последнему экрану той же вкладки, а если экран такой же, как в одном из прежних шагов, — ссылка на этот шаг;
     · записи в первом шаге — отпечатками документов (их загрузку сверяет с эталоном общий прогон), дальше изменённые документы целиком. */
import { createHash } from 'node:crypto';

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 10);
const J = v => JSON.stringify(v);

/** Имя файла снимка по названию прогона: буквы и цифры, остальное — дефис */
export const slug = name => name.toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.txt';

/* ---------- разметка по строкам ---------- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/* разметка, как её отдаёт innerHTML, — открывающие и закрывающие теги и текст между ними. В значениях атрибутов кавычки
   заменены на &quot;, а «>» может стоять как есть, поэтому тег читается до «>» вне кавычек */
function tokens(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { const e = html.indexOf('-->', i); const end = e < 0 ? html.length : e + 3; out.push({ text: html.slice(i, end) }); i = end; continue; }
    if (html[i] === '<' && /[A-Za-z/]/.test(html[i + 1] || '')) {
      let j = i + 1, q = false;
      while (j < html.length && (q || html[j] !== '>')) { if (html[j] === '"') q = !q; j++; }
      const raw = html.slice(i, j + 1), name = (raw.match(/^<\/?([^\s/>]+)/) || ['', ''])[1].toLowerCase();
      out.push(raw[1] === '/' ? { close: name } : { open: name, raw });
      i = j + 1;
      continue;
    }
    let j = html.indexOf('<', i + 1);
    while (j >= 0 && !/[A-Za-z/!]/.test(html[j + 1] || '')) j = html.indexOf('<', j + 1);
    if (j < 0) j = html.length;
    out.push({ text: html.slice(i, j) });
    i = j;
  }
  return out;
}
/* тег одной строкой, коротко: имя, #id, .классы и остальные атрибуты в скобках — div#plan.card.stack(style="gap:10px").
   Длинное значение атрибута (контур, данные графика) — отпечатком: изменение видно, а снимок не разрастается */
const ATTR = /\s([^\s="]+)(?:="([^"]*)")?/g;
function tag(raw) {
  const name = raw.match(/^<([^\s/>]+)/)[1], body = raw.slice(1 + name.length, -1);
  let id = '', cls = '';
  const rest = [];
  for (const [, k, v] of body.matchAll(ATTR)) {
    if (k === 'id' && v && !/[\s.#(]/.test(v) && !id) id = '#' + v;
    else if (k === 'class' && v && /\S/.test(v) && !/[#(.]/.test(v) && !cls) cls = v.trim().split(/\s+/).map(c => '.' + c).join('');
    else rest.push(v == null ? k : v.length >= 100 ? k + '=#' + hash(v) : k + '="' + v + '"');
  }
  return name + id + cls + (rest.length ? '(' + rest.join(' ') + ')' : '');
}
/* текст в кавычках, если по-другому его не отличить: пробел в начале или в конце, перевод строки, кавычка в начале */
const text = t => /^\s|\s$|\n|^"/.test(t) ? J(t) : t;
/** Разметка по элементу в строке: отступ — вложенность; элемент с одним текстом внутри — вместе с текстом; отдельный текст — после «| ».
    Закрывающих тегов нет — их задаёт отступ */
export function lines(html) {
  const t = tokens(html), out = [];
  let depth = 0;
  const put = s => out.push(' '.repeat(depth) + s);
  for (let i = 0; i < t.length; i++) {
    const k = t[i];
    if (k.close) { depth = Math.max(0, depth - 1); continue; }
    if (k.text != null) { put('| ' + text(k.text)); continue; }
    if (VOID.has(k.open)) { put(tag(k.raw)); continue; }
    /* рисунок (значок, график, фигура человека) — одной строкой с отпечатком того, что внутри: изменение видно,
       а контуры и координаты не занимают снимок. Цифры графиков и цвета мышц экран показывает и текстом */
    if (k.open === 'svg') {
      let j = i + 1, open = 1;
      const inner = [];
      for (; j < t.length; j++) {
        const x = t[j];
        if (x.open === 'svg') open++;
        if (x.close === 'svg' && !--open) break;
        inner.push(x.text != null ? x.text : x.close ? '</' + x.close + '>' : x.raw);
      }
      put(tag(k.raw) + ' …#' + hash(inner.join('')));
      i = j;
      continue;
    }
    const a = t[i + 1], b = t[i + 2];
    if (a && a.close === k.open) { put(tag(k.raw)); i += 1; continue; }
    if (a && a.text != null && b && b.close === k.open) { put(tag(k.raw) + ' ' + text(a.text)); i += 2; continue; }
    put(tag(k.raw));
    depth++;
  }
  return out;
}

/* ---------- изменённые строки: кратчайший список правок (алгоритм Майерса), если правок не больше max ---------- */
function edits(a, b, max) {
  /* одинаковые строки в начале и в конце в поиск не входят */
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const A = a.slice(s, ea), B = b.slice(s, eb), N = A.length, M = B.length;
  if (Math.abs(N - M) > max) return null;
  max = Math.min(max, N + M);
  /* v[k + off] — докуда дошла диагональ k; перед шагом d запоминаются диагонали от −d до d */
  const off = max + 1, trace = [], v = new Int32Array(2 * off + 1);
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(off - d, off + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[k - 1 + off] < v[k + 1 + off]) ? v[k + 1 + off] : v[k - 1 + off] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      v[k + off] = x;
      if (x < N || y < M) continue;
      /* обратный путь от конца к началу: k — строка осталась, d — убрана, a — добавлена */
      const ops = [];
      let cx = N, cy = M;
      for (let e = d; e > 0; e--) {
        const w = trace[e], kk = cx - cy;
        const pk = kk === -e || (kk !== e && w[kk - 1 + e] < w[kk + 1 + e]) ? kk + 1 : kk - 1;
        const px = w[pk + e], py = px - pk;
        while (cx > px && cy > py) { ops.push('k'); cx--; cy--; }
        ops.push(cx === px ? 'a' : 'd');
        cx = px; cy = py;
      }
      while (cx > 0 && cy > 0) { ops.push('k'); cx--; cy--; }
      ops.reverse();
      /* правки подряд — один кусок: с какой строки прежнего экрана, что убрано, что добавлено */
      const hunks = [];
      let ai = 0, bi = 0, cur = null;
      for (const o of ops) {
        if (o === 'k') { ai++; bi++; cur = null; continue; }
        if (!cur) { cur = { at: ai + s, del: [], add: [] }; hunks.push(cur); }
        if (o === 'd') cur.del.push(A[ai++]); else cur.add.push(B[bi++]);
      }
      return hunks;
    }
  }
  return null;
}
/** Применяет куски правок к прежним строкам — так снимок проверяет сам себя */
function apply(was, hunks) {
  const out = [];
  let i = 0;
  for (const h of hunks) { while (i < h.at) out.push(was[i++]); i += h.del.length; out.push(...h.add); }
  while (i < was.length) out.push(was[i++]);
  return out;
}
/* разметка шага: как в одном из прежних шагов, правки к прежнему экрану или целиком — что короче.
   Прежний экран — прошлого шага или последний на той же вкладке: вернувшись на вкладку, приложение показывает почти то же, что там было.
   В куске правок убранные строки видны, если их немного (до SHOW_DEL), иначе — только их число: они есть в прежнем шаге */
const SHOW_DEL = 4, size = list => list.reduce((n, l) => n + l.length + 1, 0);
function markup(label, now, step, seen, bases) {
  const key = now.join('\n'), same = seen.get(key);
  if (bases[0] && bases[0].step === step - 1 && bases[0].key === key) return [];
  if (same != null) return [label + ': как в шаге ' + same];
  seen.set(key, step);
  let best = [label + ': целиком', ...now.map(l => '  ' + l)];
  for (const b of bases) {
    if (!b) continue;
    const hunks = edits(b.lines, now, 3000);
    if (!hunks) continue;
    /* правки обязаны давать ровно новый экран: иначе снимок читался бы неверно */
    if (apply(b.lines, hunks).join('\n') !== key) throw new Error('снимок: правки к шагу ' + b.step + ' не дают экран шага ' + step);
    const part = [label + ': правки к шагу ' + b.step];
    for (const h of hunks) part.push('@@ ' + (h.at + 1) + ' -' + h.del.length + ' +' + h.add.length, ...(h.del.length <= SHOW_DEL ? h.del.map(l => '- ' + l) : []), ...h.add.map(l => '+ ' + l));
    if (size(part) < size(best)) best = part;
  }
  return best;
}

/* документы хранилища и черновики: что появилось, изменилось или пропало */
function changes(label, now, was, first) {
  const out = [];
  for (const [k, v] of now) if (!was || was.get(k) !== v) out.push('  ' + (first ? '' : '+ ') + k + ' ' + (first === 'hash' ? hash(v) : v));
  if (was) for (const k of was.keys()) if (!now.has(k)) out.push('  - ' + k);
  return out.length || first ? [label + ':' + (out.length ? '' : ' —'), ...out] : [];
}

/* Основа для правок — экран прошлого шага и самый похожий из недавних (больше всего тех же строк): так начатая тренировка
   сравнивается с прошлой начатой, а не с планом, из которого её начали, а вернувшись на вкладку — с тем, что на ней было */
const RECENT = 40;                                                // сколько недавних экранов годятся в основу
const base = (lines, step) => ({ lines, step, key: lines.join('\n') });
function like(recent, now, n) {
  let best = null, most = 0;
  for (const sc of recent) {
    if (sc.step === n - 1) continue;
    let hits = 0;
    for (const l of now) if (sc.set.has(l)) hits++;
    if (hits && hits >= most) { most = hits; best = sc; }
  }
  return best;
}
function remember(recent, now, was, n) {
  if (!now.length || (was && now.join('\n') === was.join('\n'))) return;
  recent.push(Object.assign(base(now, n), { set: new Set(now) }));
  if (recent.length > RECENT) recent.shift();
}
/** Текст снимка прогона: steps — по каждому шагу подпись, снимок страницы (то, что вернул __t.look) и пропущен ли он */
export function snapshotText(name, steps) {
  const out = ['Снимок сценария «' + name + '» с днями приложения «День 1…N».',
    'Сверяет: npm run screens -- --дни. Переписать (только намеренно): npm run screens -- --переписать. Как устроен — app/scripts/snapshots.mjs.'];
  let was = null;
  const seenView = new Map(), seenTop = new Map(), seenFields = new Map(), recentViews = [], recentFields = [];
  steps.forEach(({ title, look, skip }, i) => {
    const n = i + 1, first = !was;
    const now = {
      hash: look.hash, view: lines(look.view), top: lines(look.top), fields: look.fields ? look.fields.split(' | ') : [], toast: look.toast, focus: look.focus,
      store: new Map(JSON.parse(look.store).map(([k, v]) => [k, J(v)])), local: new Map(JSON.parse(look.local)),
      saved: look.saved, copied: look.copied
    };
    out.push('', '=== ' + n + '. ' + title);
    if (skip) out.push('пропущен: кнопки шага на этих записях нет');
    const line = (label, key) => { if (first || now[key] !== was[key]) out.push(label + ': ' + J(now[key])); };
    line('адрес', 'hash');
    out.push(...markup('шапка', now.top, n, seenTop, [was && base(was.top, n - 1)]));
    if (!now.fields.length) { if (first || was.fields.length) out.push('поля: —'); }
    else out.push(...markup('поля', now.fields, n, seenFields, [was && was.fields.length ? base(was.fields, n - 1) : null, like(recentFields, now.fields, n)]));
    remember(recentFields, now.fields, was && was.fields, n);
    line('сообщение', 'toast');
    line('курсор', 'focus');
    line('файл', 'saved');
    line('буфер', 'copied');
    out.push(...changes('записи', now.store, was && was.store, first && 'hash'));
    out.push(...changes('черновик', now.local, was && was.local, first && 'full'));
    out.push(...markup('экран', now.view, n, seenView, [was && base(was.view, n - 1), like(recentViews, now.view, n)]));
    remember(recentViews, now.view, was && was.view, n);
    was = now;
  });
  return out.join('\n') + '\n';
}

/** Где снимки расходятся: первый шаг с отличием и строки вокруг первого отличия — в снимке и сейчас */
export function firstDiff(expected, actual) {
  const a = expected.split('\n'), b = actual.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i >= a.length && i >= b.length) return '';
  let s = i;
  while (s > 0 && !a[s].startsWith('=== ')) s--;
  const step = a[s] && a[s].startsWith('=== ') ? 'шаг ' + a[s].slice(4) : 'заголовок снимка';
  const around = list => list.slice(Math.max(0, i - 2), i + 4).map(l => '            ' + (l.length > 160 ? l.slice(0, 160) + '…' : l)).join('\n');
  return step + ', строка ' + (i + 1) + ' снимка:\n          в снимке:\n' + (around(a) || '            (снимок кончился)') + '\n          сейчас:\n' + (around(b) || '            (прогон кончился)');
}
