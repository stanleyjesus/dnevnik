/* Выгрузка: CSV и запрос для разбора.
   Перенесено из reference/src/core.js: тела функций без изменений. */
import { MUSCLES, SLOT } from './catalog.ts';
import { weekNo } from './dates.ts';
import { fmt } from './format.ts';
import { fmtSets } from './records.ts';
import { exName } from './config.ts';
import { AUTO, goalName, goalOf, LIGHT_A } from './goals.ts';
import { allStats, weeksInfo } from './stats.ts';
import { avgVolume, volume } from './volume.ts';
import { insights } from './insights.ts';
import type { Cfg, Slot, State, Workout } from './types.ts';

/* ---------- exports ---------- */
export function toCsv(workouts: Workout[], cfg: Cfg) {
  const q = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
  const rows = [['date', 'week', 'day', 'exercise', 'set', 'weight_kg', 'reps', 'rir', 'flag'].join(',')];
  for (const w of workouts) for (const it of w.items) {
    let i = 0;
    for (const s of it.sets) rows.push([w.date, weekNo(w.date, cfg.start!), w.slot || '', q(exName(cfg, it.ex)), ++i, s.w, s.r == null ? '' : s.r, s.q == null ? '' : s.q, s.warm ? 'warmup' : (s.skip || it.skip) ? 'skipped' : s.r == null ? 'reps_missing' : ''].join(','));
  }
  return rows.join('\n');
}
export function coachPrompt(st: State, question?: string | null) {
  const { workouts, cfg, body, today } = st;
  const wi = weeksInfo(workouts, cfg, today), vol = volume(workouts, cfg), { avg } = avgVolume(vol, wi.ref);
  const from = wi.ref.length ? wi.ref[0].from : workouts.length ? workouts[0].date : today;
  const L: string[] = [];
  L.push('Ты — тренер по силовой подготовке. Разбери тренировочный дневник и дай практические рекомендации на ближайшие 1–2 недели.');
  L.push('Отвечай по-русски, коротко и конкретно: до 8 пунктов, каждый — что именно изменить (упражнение, вес, подходы, повторы) и почему, с цифрами из дневника. Сначала самое важное. Без общих слов и без медицинских советов. Оформи как маркированный список, заголовки не нужны.');
  L.push('');
  L.push('МЕТОДИКА АТЛЕТА: ' + (cfg.method || 'не описана'));
  const goals = Object.keys(cfg.ex).filter(id => goalOf(cfg, id)).map(id => cfg.ex[id].n + ' — ' + goalName(cfg, id));
  if (goals.length) L.push('ЦЕЛИ, КОТОРЫЕ АТЛЕТ ОТМЕТИЛ ДЛЯ УПРАЖНЕНИЙ (учитывай их): ' + goals.join('; ') + '.');
  if (Object.keys(cfg.ex).some(id => goalOf(cfg, id) === 'auto')) L.push('«СИЛА ПО ЗАПАСУ»: ' + AUTO.sets + ' × ' + AUTO.reps + ' одним весом каждую неделю. Решает запас в последнем подходе: ' + AUTO.aim + ' и больше — плюс шаг веса, 1 — вес тот же, 0 или подходы не закрыты — минус ' + AUTO.down + '%. Второй день такого упражнения — ' + LIGHT_A.sets + ' × ' + LIGHT_A.reps + ' на ' + LIGHT_A.pct + '% (в запасе 3–4 повтора). Не предлагай вернуть волну процентов без веской причины.');
  if (cfg.program) L.push('ПРОГРАММА, КОТОРУЮ АТЛЕТ ПРИНЯЛ ' + cfg.program.since + ': «' + (cfg.program.name || '') + '»' + (cfg.program.focus ? ', пауэрбилдинг: приоритет — сила в упражнении «' + exName(cfg, cfg.program.focus) + '», остальные базовые ' + (cfg.program.others === 'grow' ? 'растут как раньше' : 'на поддержании') : '') + '. Не предлагай её ломать без веской причины.');
  const named = Object.keys(cfg.ex).filter(id => +cfg.ex[id].max! > 0 || +cfg.ex[id].work! > 0).map(id => { const e = cfg.ex[id]; return e.n + ' — ' + [+e.work! > 0 ? 'рабочий ' + fmt(+e.work!) + ' кг' + (+e.workR! > 0 ? ' × ' + e.workR : '') : '', +e.max! > 0 ? 'разовый максимум ' + fmt(+e.max!) + ' кг' : ''].filter(Boolean).join(', '); });
  if (named.length) L.push('ВЕСА, КОТОРЫЕ АТЛЕТ НАЗВАЛ САМ (для упражнений, которых ещё нет в журнале, план стартует от них): ' + named.join('; ') + '.');
  const off = MUSCLES.filter(m => cfg.ignore[m.id]).map(m => m.n.toLowerCase());
  if (off.length) L.push('МЫШЦЫ ВНЕ РАСЧЁТА (атлет ведёт их сам или не тренирует намеренно; нулевой объём у них — норма, не предлагай их добавлять): ' + off.join(', ') + '.');
  L.push('Сегодня ' + today + ', идёт неделя ' + wi.cur + ' программы.');
  L.push('');
  L.push('НЕДЕЛЬНЫЙ ОБЪЁМ ПО МЫШЦАМ (среднее за недели ' + wi.ref.map(w => w.no).join(', ') + '; прямой подход = 1, косвенный = 0.5; ориентиры: меньше ' + cfg.zones.min + ' мало, ' + cfg.zones.opt + '–' + cfg.zones.high + ' рабочая зона):');
  L.push(MUSCLES.map(m => m.n + ' ' + fmt(avg[m.id], 1)).join('; '));
  L.push('');
  L.push('ТРЕНИРОВКИ (вес x повторы; @N — запас повторов до отказа (RIR) в этом подходе, если атлет его отметил; ? — повторы не записаны; - — не делал):');
  for (const w of workouts) {
    if (w.date < from) continue;
    L.push(w.date + ' (неделя ' + weekNo(w.date, cfg.start!) + ', ' + ((SLOT[w.slot!] || {} as Slot).s || '') + ')');
    for (const it of w.items) L.push('  ' + exName(cfg, it.ex) + (it.cyc ? ' [' + it.cyc.pct + '%]' : it.range ? ' [' + it.range.join('-') + ']' : '') + ': ' + fmtSets(it.sets) + (it.note ? ' (' + it.note + ')' : ''));
  }
  L.push('');
  L.push('ДИНАМИКА С НАЧАЛА ПРОГРАММЫ (первый -> последний лучший подход):');
  for (const s of allStats(workouts, cfg)) L.push('  ' + exName(cfg, s.id) + ': ' + fmt(s.first.best.w) + 'x' + s.first.best.r + ' (' + s.first.date + ') -> ' + fmt(s.last.best.w) + 'x' + s.last.best.r + ' (' + s.last.date + '), тренировок ' + s.n);
  if (body.length) { L.push(''); L.push('ВЕС ТЕЛА: ' + body.slice(-8).map(b => b.date + ' ' + fmt(b.kg, 1)).join('; ')); }
  L.push('');
  L.push('АВТОМАТИЧЕСКИЕ ЗАМЕЧАНИЯ ДНЕВНИКА: ' + insights(st).filter(i => i.sev !== 'good').map(i => i.title).join(' | '));
  if (question) { L.push(''); L.push('ВОПРОС АТЛЕТА: ' + question); }
  return L.join('\n').slice(0, 60000);
}
