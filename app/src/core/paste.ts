/* Программа, вставленная текстом (решение владельца, 25 ноября 2026, онбординг). В эталоне этого нет.
   Атлет вставляет программу из заметок: дни и упражнения по строкам. Дневник делит текст на дни, в строке упражнения
   находит подходы, повторы и вес, а название сверяет со справочником профиля. Чего справочник не знает, атлет выбирает сам.
   Расчётов здесь нет: только разбор текста и сверка названий. */
import { exKey } from './starter.ts';
import type { Cfg } from './types.ts';

/** Строка упражнения: исходный текст, название без чисел, подходов (null — не названо), повторы и вес, если названы */
export interface PasteItem { line: string; name: string; n: number | null; lo?: number; hi?: number; w?: number }
/** День из текста: заголовок, как он написан (пусто — дни разделены пустой строкой), и упражнения по порядку */
export interface PasteDay { name: string; items: PasteItem[] }

const WEEK = 'понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|субботу|воскресенье|пн|вт|ср|чт|пт|сб|вс';
/* заголовок дня: строка со слова «день», «тренировка», «day», «workout» («День 1», «День ног», «Тренировка А»), «Д1», день недели;
   или строка, которая кончается двоеточием и не похожа на упражнение («Грудь и спина:») */
const DAY = new RegExp('^(?:(?:день|day|тренировка|workout)(?![a-zа-я])|д\\s*\\d+(?![0-9])|(?:' + WEEK + ')(?![a-zа-я]))', 'i');
/* подходы и повторы: «3×8», «3x8-10», «4 х (6–8)», «3 подхода по 10», «3 по 12» */
const SETS = /(\d+)\s*(?:[xх×*]|подход\S*\s*(?:по|[xх×*])?|по)\s*\(?\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*\)?(?:\s*повтор\S*)?/i;
const SETS_ONLY = /(\d+)\s*подход\S*/i;
const KG = /(\d+(?:[.,]\d+)?)\s*кг|@\s*(\d+(?:[.,]\d+)?)/i;
const BULLET = /^\s*(?:\d+\s*[.)]|[-–—•*·]+)\s*/;

const num = (s: string) => +s.replace(',', '.');

/** Строка упражнения: подходы, повторы, вес и название; null — в строке нет букв */
export function pasteLine(line: string): PasteItem | null {
  let rest = line.replace(BULLET, ' ');
  const it: PasteItem = { line: line.trim(), name: '', n: null };
  const s = SETS.exec(rest);
  if (s) {
    it.n = +s[1]; it.lo = +s[2]; if (s[3]) it.hi = +s[3];
    rest = rest.slice(0, s.index) + ' ' + rest.slice(s.index + s[0].length);
  } else {
    const o = SETS_ONLY.exec(rest);
    if (o) { it.n = +o[1]; rest = rest.slice(0, o.index) + ' ' + rest.slice(o.index + o[0].length); }
  }
  const k = KG.exec(rest);
  if (k) { it.w = num(k[1] || k[2]); rest = rest.slice(0, k.index) + ' ' + rest.slice(k.index + k[0].length); }
  it.name = rest.replace(/\(\s*\)/g, ' ').replace(/[\s,;:—–\-]+$/, '').replace(/^[\s,;:—–\-]+/, '').replace(/\s+/g, ' ');
  return /[a-zа-яё]/i.test(it.name) ? it : null;
}

/** Текст программы по дням. Заголовки — «День 1», «Тренировка А», дни недели или строки с двоеточием в конце;
    если заголовков нет, дни разделяет пустая строка. Строки до первого заголовка — тоже день */
export function pasteDays(text: string): PasteDay[] {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const head = (l: string) => { const t = l.replace(BULLET, '').trim(); return DAY.test(t) || (/:\s*$/.test(t) && !SETS.test(t) && !KG.test(t)); };
  const days: PasteDay[] = [];
  let cur: PasteDay | null = null;
  const withHeads = lines.some(head);
  for (const l of lines) {
    if (!l.trim()) { if (!withHeads && cur && cur.items.length) cur = null; continue; }
    if (withHeads && head(l)) { cur = { name: l.trim().replace(/:\s*$/, ''), items: [] }; days.push(cur); continue; }
    const it = pasteLine(l);
    if (!it) continue;
    if (!cur) { cur = { name: '', items: [] }; days.push(cur); }
    cur.items.push(it);
  }
  return days.filter(d => d.items.length);
}

/* слова названия для сверки: без предлогов, по первым пяти буквам — «приседания» и «присед» одно слово */
const STOP = new Set(['на', 'в', 'во', 'с', 'со', 'к', 'ко', 'по', 'из', 'от', 'до', 'и', 'для', 'за', 'под', 'над', 'the', 'with', 'on']);
/* то же другими словами: «на наклонной» — это «под углом», «армейский жим» — жим штанги стоя */
const SAME: Record<string, string[]> = { накло: ['углом'], армей: ['штанг', 'стоя'] };
const words = (name: string) => [...new Set(exKey(name).split(' ').filter(w => w && !STOP.has(w)).flatMap(w => SAME[w.slice(0, 5)] || [w.slice(0, 5)]))];

/** Упражнение справочника по названию из текста: то же название, иначе самое похожее по словам (не меньше 0.6 по Дайсу),
    иначе самое длинное название справочника, все слова которого есть в тексте («Подтягивания широким хватом» — «Подтягивания»).
    null — похожего нет, выбирает атлет. Лёгкие и средние дни не предлагаются: они идут за своим упражнением */
export function pasteMatch(cfg: Cfg, name: string): string | null {
  const key = exKey(name), mine = words(name);
  const ids = Object.keys(cfg.ex).filter(id => cfg.ex[id].mode !== 'light');
  const same = ids.find(id => exKey(cfg.ex[id].n) === key);
  if (same) return same;
  let best: string | null = null, top = 0, part: string | null = null, size = 0;
  for (const id of ids) {
    const theirs = words(cfg.ex[id].n), common = theirs.filter(w => mine.includes(w)).length;
    const d = 2 * common / (mine.length + theirs.length || 1);
    if (d > top) { top = d; best = id; }
    if (theirs.length && common === theirs.length && theirs.length > size) { size = theirs.length; part = id; }
  }
  return top >= 0.6 ? best : part;
}
