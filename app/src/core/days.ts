/* Дни программы без привязки к дням недели и их число в неделе (решения владельца, 19 ноября 2026; в эталоне этого нет).
   В артефакте дней три, и это понедельник, среда и пятница. В приложении день — это просто «День 1…N», а сколько их —
   два, три или четыре — атлет выбирает на «Программе» (настройка профиля days). Записи при этом не меняются:
   прежние идентификаторы mon / wed / fri остаются днями 1–3, четвёртый день — d4.

   Вся логика читает дни из общей таблицы SLOTS / SLOT (catalog.ts). Пока приложение не вызвало useDays, таблица — как в эталоне:
   такой её видят эталонные тесты и сверка экранов с артефактом. useDays(n) переписывает таблицу на месте: в SLOTS — первые n дней,
   в SLOT — все четыре, чтобы прежняя запись «дня 3» читалась и при двух днях. Поле dow в этом режиме — не день недели, а место дня
   в неделе: по нему сборка ставит лёгкий день «подальше от тяжёлого». Кроме таблицы дней здесь два правила, которых в эталоне нет:
   dayStale — какая запись дня шаблоном не служит, и awayDays — что стоит в днях вне недели; оба держит tests/days.test.ts. */
import { SLOT, SLOTS } from './catalog.ts';
import { isCycle, isLight } from './config.ts';
import type { Cfg, ProgEntry, Slot, Workout } from './types.ts';

/** Идентификаторы дней по порядку: день 1, 2, 3 и 4. Первые три — как в записях артефакта */
export const DAY_IDS = ['mon', 'wed', 'fri', 'd4'];
/** Сколько дней в неделе можно выбрать */
export const DAY_COUNTS = [2, 3, 4];
/* таблица эталона, какой она была при загрузке */
const WEEK: Slot[] = SLOTS.map(s => Object.assign({}, s));
/* место дня в неделе при двух, трёх и четырёх днях: дни стоят как можно равномернее */
const POS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5] };

/** Как сейчас устроены дни: week — как в эталоне (три дня с именами дней недели); иначе «День N», n — сколько их в неделе */
export const DAYS = { week: true, n: 3 };
/** Число дней из настройки профиля, как она лежит в хранилище: 2, 3 или 4; нет поля или оно негодное — 3 */
export const daysOf = (raw: { days?: number } | null | undefined) => { const v = raw ? Math.round(+raw.days!) : 0; return DAY_COUNTS.includes(v) ? v : 3; };
/** Номер дня по идентификатору: mon — 1, wed — 2, fri — 3, d4 — 4; чужой идентификатор — 0 */
export const dayNo = (id: string) => DAY_IDS.indexOf(id) + 1;

/** Переписать таблицу дней: n дней «День 1…n» без привязки к дням недели; week — вернуть таблицу эталона */
export function useDays(n?: number | null, week?: boolean) {
  const k = week ? WEEK.length : daysOf({ days: n as number });
  const table: Slot[] = week ? WEEK.map(s => Object.assign({}, s))
    : DAY_IDS.map((id, i) => ({ id, n: 'День ' + (i + 1), s: 'День ' + (i + 1), dow: i < k ? POS[k][i] : POS[4][i] }));
  SLOTS.splice(0, SLOTS.length, ...table.slice(0, k));
  for (const id of Object.keys(SLOT)) delete SLOT[id];
  for (const s of table) SLOT[s.id] = s;
  DAYS.week = !!week; DAYS.n = k;
}

/** Запись дня, которого нет в принятой программе (или он в ней пуст), сделанная до её принятия. Программа этот день заменила, поэтому шаблоном дня
    такая запись не служит: иначе, вернувшись от двух дней к трём, атлет получил бы прежнюю пятницу поверх новой программы —
    и базовое, уже переехавшее в другой день, стояло бы дважды. С таблицей дней эталона такого не бывает: там дней всегда три */
export const dayStale = (cfg: Cfg, slot: string | null | undefined, w?: { date: string } | null) => {
  const P = cfg && cfg.program;
  return !DAYS.week && !!(slot && P && P.slots && !(Array.isArray(P.slots[slot]) && P.slots[slot].length) && w && w.date < P.since);
};
/** Дни, которых в выбранной неделе нет, но в которых сейчас что-то стоит: принятая программа, пока по ней в этом дне не тренировались,
    иначе последняя тренировка дня. В план такие дни не попадают; по ним сборка узнаёт, что переезжает, а «Сейчас» считает нынешнюю неделю целиком */
export function awayDays(workouts: Workout[], cfg: Cfg) {
  const out: { id: string; items: ProgEntry[] }[] = [];
  if (DAYS.week) return out;
  const P = cfg.program;
  for (const id of DAY_IDS) {
    if (SLOTS.some(sl => sl.id === id)) continue;
    let last: Workout | null = null;
    for (const w of workouts) if (!w.open && w.slot === id && w.items.length) last = w;
    const day = P && P.slots && Array.isArray(P.slots[id]) ? P.slots[id] : null;
    const items: ProgEntry[] = day && day.length && (!last || last.date < P!.since) ? day.filter(e => cfg.ex[e.ex]).map(e => e.n ? { ex: e.ex, n: e.n } : { ex: e.ex })
      : last && !dayStale(cfg, id, last) ? last.items.filter(it => cfg.ex[it.ex]).map(it => { const e: ProgEntry = { ex: it.ex }; if (!isCycle(cfg, it.ex) && !isLight(cfg, it.ex)) e.n = it.sets.filter(x => !x.warm).length; return e; })
      : [];
    if (items.length) out.push({ id, items });
  }
  return out;
}
