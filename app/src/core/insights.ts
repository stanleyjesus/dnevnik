/* Замечания дневника по правилам.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { FIX, MUSCLES, PATTERNS } from './catalog.ts';
import { dnum, fmtDate, fmtDM } from './dates.ts';
import { fmt, list, pct, plural, signed } from './format.ts';
import { exName, isCycle, isLight } from './config.ts';
import { TARGET, work } from './sets.ts';
import { AUTO, WAVE_S } from './goals.ts';
import { allStats, stalledSets, weeksInfo } from './stats.ts';
import { avgVolume, volume, zone } from './volume.ts';
import { planCycle } from './plan.ts';
import { planned, ruleBreaks } from './tally.ts';
import { appRules } from './rules.ts';
import { bodyRate } from './body.ts';
import type { ExStat } from './stats.ts';
import type { Insight, Item, Muscle, State, Workout } from './types.ts';

/* ---------- the rule-based review ---------- */
export function insights(st: State) {
  const { workouts, cfg, body, today } = st;
  const out: Insight[] = [];
  const add = (sev: string, cat: string, title: string, text: string, link?: string) => out.push({ sev, cat, title, text, link });
  const done = workouts.filter(w => w.items.some(it => work(it).length));
  if (!done.length) return out;
  const wi = weeksInfo(workouts, cfg, today), vol = volume(workouts, cfg), z = cfg.zones;
  const { avg, pat } = avgVolume(vol, wi.ref);
  const refTxt = wi.ref.length ? (wi.ref.length === 1 ? 'неделю ' + wi.ref[0].no : 'недели ' + wi.ref[0].no + '–' + wi.ref[wi.ref.length - 1].no) : '';

  /* volume */
  if (wi.ref.length) {
    const by: Record<string, Muscle[]> = { none: [], low: [], base: [], opt: [], high: [] };
    for (const m of MUSCLES) { const k = zone(avg[m.id], z); if (cfg.ignore[m.id] && (k === 'none' || k === 'low' || k === 'base')) continue; by[k].push(m); }
    const tag = (m: Muscle) => m.n + ' ' + fmt(avg[m.id], 1);
    const fixes = (ms: Muscle[]) => ms.map(m => m.n.toLowerCase() + ' — ' + FIX[m.id]).join('; ');
    if (by.none.length) add('crit', 'Объём', 'Без нагрузки: ' + list(by.none.map(m => m.n.toLowerCase())),
      'За ' + refTxt + ' эти мышцы не получили ни одного подхода, даже косвенно. Если они нужны — это главный пробел программы; если нет, отметь в настройке, что дневник за ними не следит. Что добавить: ' + fixes(by.none) + '.', 'muscles');
    if (by.low.length) add('warn', 'Объём', 'Меньше ' + z.min + ' подходов в неделю: ' + list(by.low.map(tag)),
      'Это ниже минимальной дозы, при которой рост заметен. Что добавить: ' + fixes(by.low) + '.', 'muscles');
    if (by.base.length) add('info', 'Объём', 'Ниже рабочей зоны: ' + list(by.base.map(tag)),
      'От ' + z.min + ' до ' + z.opt + ' подходов в неделю мышцы растут, но медленнее, чем могли бы. Если какая-то из них в приоритете, добавляй по 1–2 подхода в неделю: ' + fixes(by.base) + '.', 'muscles');
    if (by.high.length) add('warn', 'Объём', 'Больше ' + z.high + ' подходов в неделю: ' + list(by.high.map(tag)),
      'Выше ' + z.high + ' подходов отдача от каждого следующего мала. Если веса в этих упражнениях перестали расти, убери 2–4 подхода.', 'muscles');
    if (by.opt.length) add('good', 'Объём', 'В рабочей зоне ' + z.opt + '–' + z.high + ': ' + list(by.opt.map(tag)),
      'Среднее за ' + refTxt + ', в подходах в неделю. За половину подхода идут косвенная работа и подходы, где в запасе осталось 3 повтора и больше.', 'muscles');

    /* (в эталоне нет) с днями «День N» замечания о балансе движений нет: решение владельца, 23 ноября 2026 */
    const miss = PATTERNS.filter(p => p.fix && !(pat[p.id] > 0));
    if (miss.length && !appRules()) add('warn', 'Баланс', 'В программе нет ' + list(miss.map(p => p.gen!)),
      'Сила растёт в тех движениях, которые тренируешь. Чтобы закрыть пробел: ' + miss.map(p => p.n.toLowerCase() + ' — ' + p.fix).join('; ') + '.', 'muscles');
    const unk: string[] = [];
    for (const w of wi.ref) for (const id of (vol[w.no] ? vol[w.no].unknown : [])) if (!unk.includes(id)) unk.push(id);
    if (unk.length) add('warn', 'Данные', 'Упражнения без привязки к мышцам: ' + list(unk.map(id => exName(cfg, id))),
      'Их подходы не попадают в расчёт объёма. Укажи основные и вспомогательные мышцы в настройке.', 'setup');
  }

  /* the programme against the athlete's own limits */
  const br = ruleBreaks(cfg, planned(workouts.filter(w => !w.open), cfg));
  if (br.length) add('warn', 'Правила', 'Программа выходит за твои лимиты', br.join('. ') + '. Поправить можно во вкладке «Программа».', 'program');

  /* progress per exercise */
  const stats = allStats(workouts, cfg).filter(s => s.active);
  const dp = stats.filter(s => !isCycle(cfg, s.id) && !isLight(cfg, s.id));
  for (const s of dp) {
    if (s.status === 'flat' || s.status === 'down') {
      const p = s.pr.best;
      add('warn', 'Прогресс', (s.status === 'down' ? 'Откат: ' : 'Застой: ') + exName(cfg, s.id),
        'Лучший подход (' + fmt(p.w) + ' × ' + p.r + ') был ' + s.sincePR + ' ' + plural(s.sincePR, ['тренировку', 'тренировки', 'тренировок']) + ' назад, ' + fmtDate(s.pr.date, true) + '. ' +
        (s.status === 'down' ? 'Последний результат ниже рекорда больше чем на 5%. Проверь сон, питание и отдых между подходами; если так же в других упражнениях — нужна разгрузочная неделя.'
          : 'Убедись, что подход идёт до RIR ' + TARGET + '. Если да — сбрось вес на 10% на 1–2 недели и набери повторы заново, либо смени вариант упражнения.'), 'progress');
    }
  }
  /* a set stuck for four sessions of the same day while the sets before it did not grow either */
  for (const s of dp) {
    const hist = s.ss.filter(x => x.slot === s.last.slot).slice(-4);
    if (hist.length < 4 || s.status !== 'up') continue;
    const stuck = stalledSets(hist, s.last.item.range ? s.last.item.range[1] : null);
    if (stuck.length) add('info', 'Прогресс', exName(cfg, s.id) + ': ' + (stuck.length === 1 ? 'подход ' + (stuck[0].i + 1) + ' стоит' : 'подходы ' + list(stuck.map(x => x.i + 1)) + ' стоят') + ' на месте',
      'Четыре тренировки подряд без движения: ' + stuck.map(x => 'подход ' + (x.i + 1) + ' — ' + fmt(x.w) + ' × ' + x.r).join(', ') + '.' + (stuck.some(x => x.i > 0) ? ' Подходы перед ' + (stuck.length === 1 ? 'ним' : 'ними') + ' за это время тоже не выросли, так что дело не в усталости от начала упражнения.' : '') + ' В плане тренировки дневник предложит опустить вес на один шаг и набрать повторы заново.', 'workout');
  }
  /* fatigue: half of the exercises went backwards last time */
  const cmp = dp.filter(s => s.n >= 2);
  const worse = cmp.filter(s => s.last.metric < s.ss[s.n - 2].metric * 0.98);
  if (cmp.length >= 6 && worse.length >= cmp.length / 2) add('warn', 'Восстановление', 'Похоже на накопленную усталость',
    'В ' + worse.length + ' из ' + cmp.length + ' упражнений последняя тренировка слабее предыдущей: ' + list(worse.slice(0, 5).map(s => exName(cfg, s.id))) + '. Если на следующей неделе картина та же, сделай разгрузку: те же веса, половина подходов.', 'progress');

  /* the percentage wave */
  const cyc = stats.filter(s => isCycle(cfg, s.id));
  if (cyc.length) {
    const lines: string[] = [], bad: string[] = [];
    for (const s of cyc) {
      const p = planCycle(workouts, cfg, s.id, null);
      const wk = Math.max(1, Math.round((dnum(s.last.date) - dnum(s.first.date)) / 7));
      lines.push(exName(cfg, s.id) + ': расчётный максимум ' + fmt(s.first.tm, 1) + ' → ' + fmt(s.last.tm, 1) + ' кг (' + signed(pct(s.last.tm!, s.first.tm!)) + '% за ' + wk + ' ' + plural(wk, ['неделю', 'недели', 'недель']) + '), дальше ' + fmt(p.w) + ' × ' + p.reps + (p.auto ? ' — сила по запасу: ' + AUTO.sets + ' × ' + AUTO.reps + ' одним весом, вес по запасу в последнем подходе' : p.strong ? ' — приоритет силы, тяжёлая волна, максимум +' + fmt(WAVE_S.inc, 1) + '% раз в цикл' : p.hold ? ' — поддержание, максимум не растёт' : ''));
      if (p.repeat) bad.push(exName(cfg, s.id) + ' — не все подходы закрыты ' + fmtDate(s.last.date, true) + ', неделя повторяется без прибавки');
      else if (p.hard) bad.push(exName(cfg, s.id) + ' — подход шёл в отказ, максимум на следующую неделю не повышается');
    }
    if (bad.length) add('warn', 'Базовые', 'Волна упёрлась: ' + bad.length + ' ' + plural(bad.length, ['упражнение', 'упражнения', 'упражнений']), bad.join('; ') + '. Когда это случится второй раз подряд, переходи на прибавку раз в 3-недельный цикл.', 'progress');
    const q = Math.round((Math.pow(1 + cfg.cycle.inc / 100, 13) - 1) * 100);
    add('info', 'Базовые', 'Волна ' + Object.entries(cfg.cycle.pct).sort((a: any, b: any) => b[0] - a[0]).map(e => e[1] + '%').join(' / ') + ': максимум растёт на ' + fmt(cfg.cycle.inc, 1) + '% в неделю',
      lines.join('. ') + '. Такой темп — это +' + q + '% за квартал, и однажды он закончится. Отмечай запас (RIR) в подходах: как только он дойдёт до 0 или подходы перестанут закрываться, дневник перестанет повышать максимум и предложит повторить неделю.', 'progress');
  }

  /* rep drop-off inside the last session */
  let drops = 0;
  for (const s of dp) {
    if (drops >= 3) break;
    const sets = s.last.item.sets.filter(x => !x.warm && x.r != null);
    for (let i = 1; i < sets.length; i++) if (sets[i].w === sets[i - 1].w && sets[i - 1].r! - sets[i].r! >= 4) {
      add('info', 'Техника', exName(cfg, s.id) + ': −' + (sets[i - 1].r! - sets[i].r!) + ' повтора между подходами',
        fmtDate(s.last.date, true) + ' на ' + fmt(sets[i].w) + ' кг: ' + sets[i - 1].r + ' повторов, затем ' + sets[i].r + '. Такой провал при том же весе обычно значит короткий отдых или отказ в предыдущем подходе. Попробуй отдыхать 2–3 минуты.', 'progress');
      drops++; break;
    }
  }

  /* left / right */
  const sides: Record<string, Record<string, ExStat>> = {};
  for (const s of dp) { const n = exName(cfg, s.id), m = /(правая|левая)/i.exec(n); if (!m) continue; const k = n.replace(/\s*(правая|левая)(\s+рука)?/i, '').trim(); (sides[k] || (sides[k] = {}))[m[1].toLowerCase()] = s; }
  for (const [k, v] of Object.entries(sides)) {
    if (!v['правая'] || !v['левая']) continue;
    const a = v['правая'].last.e1, b = v['левая'].last.e1, d = Math.abs(pct(a, b));
    if (d >= 8) add('info', 'Баланс', k + ': ' + (a > b ? 'правая' : 'левая') + ' сильнее на ' + fmt(d) + '%',
      'Правая ' + fmt(v['правая'].last.best.w) + ' × ' + v['правая'].last.best.r + ', левая ' + fmt(v['левая'].last.best.w) + ' × ' + v['левая'].last.best.r + '. Начинай со слабой руки и не делай сильной больше повторов, чем получилось слабой.', 'progress');
  }

  /* data quality */
  const holes: { w: Workout; it: Item; k: number }[] = [];
  for (const w of workouts) for (const it of w.items) { if (it.skip || w.open) continue; const k = it.sets.filter(s => s.r == null && !s.skip).length; if (k) holes.push({ w, it, k }); }
  if (holes.length) {
    const total = holes.reduce((s, h) => s + h.k, 0);
    add('info', 'Данные', 'Не записаны повторы: ' + total + ' ' + plural(total, ['подход', 'подхода', 'подходов']),
      holes.slice(-6).map(h => exName(cfg, h.it.ex) + ' ' + fmtDM(h.w.date)).join(', ') + '. Эти подходы не считаются ни в объёме, ни в прогрессе. Если ты их делал, допиши повторы в журнале.', 'journal');
  }
  const gaps = wi.weeks.filter(w => !w.count && !w.current && w.no >= wi.cur - 4);
  if (gaps.length) add('info', 'Режим', 'Без тренировок: ' + (gaps.length === 1 ? 'неделя ' : 'недели ') + list(gaps.map(w => w.no)), 'После пропуска первую тренировку каждого упражнения начинай с прошлых весов, без повышения.', 'journal');

  /* body weight */
  if (cfg.bw === 'track') { /* only recorded: no advice on gaining */ }
  else if (!body.length) add('info', 'Вес тела', 'Вес тела пока не записан',
    'Набор мышц проще всего проверить по весу: для набора без лишнего жира ориентир — плюс 0.25–0.5% веса тела в неделю. Записывай вес 2–3 раза в неделю утром во вкладке «Прогресс».', 'progress');
  else {
    const r = bodyRate(body);
    if (r) {
      const t = fmt(Math.abs(r.perWeek), 2) + ' кг в неделю (' + signed(r.pctWeek, 2) + '%)';
      if (r.pctWeek < 0.1) add('warn', 'Вес тела', 'Вес не растёт: ' + (r.perWeek < 0 ? '−' : '+') + t, 'Для набора мышц нужен профицит. Добавь 200–300 ккал в день и проверь через две недели.', 'progress');
      else if (r.pctWeek > 0.75) add('warn', 'Вес тела', 'Вес растёт быстро: +' + t, 'Быстрее 0.5–0.75% в неделю лишнее обычно уходит в жир. Убери 200–300 ккал в день.', 'progress');
      else add('good', 'Вес тела', 'Вес растёт в нужном темпе: +' + t, 'Ориентир для набора — 0.25–0.5% веса тела в неделю.', 'progress');
    }
  }

  /* what went well */
  const ups = dp.filter(s => s.n >= 4 && s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4);
  if (ups.length) add('good', 'Прогресс', 'Быстрее всего растут: ' + list(ups.map(s => exName(cfg, s.id) + ' ' + signed(s.delta) + '%')),
    'Изменение расчётного максимума лучшего подхода с первой тренировки упражнения до последней.', 'progress');

  const order: Record<string, number> = { crit: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}
