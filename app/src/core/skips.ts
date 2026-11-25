/* Упражнение, которое два раза подряд не сделано (просьба владельца, 25 ноября 2026; docs/03, раздел 18). Только с днями «День N».
   Пропущенное упражнение («не делал» или оставлено пустым) остаётся в плане с прежним весом, а программа и время дня считают его сделанным:
   по программе мышца в зоне, по факту — нет. Поэтому когда в двух последних тренировках дня упражнение не сделано, в плане этого дня появляется
   поправка «Не делал два раза»: упражнение уходит из дня, и дневник выбирает, куда деть его подходы, — по порядку:
   1. перенести в другой день, где на него хватит времени: с ним тот день выйдет не дольше самой длинной тренировки, которую ты успеваешь
      целиком, — этого дня без пропущенного или другого дня, последняя тренировка которого сделана вся; лимит на мышцу за тренировку и число
      упражнений в дне соблюдены, упражнения на те же мышцы там нет. Сначала — день, где эти мышцы ещё не работают основными (так у мышцы
      не пропадает день), из таких — самый короткий;
   2. если такого дня нет — раздать его подходы по одному упражнениям других дней на ту же основную мышцу: сначала тому же упражнению,
      потом с теми же мышцами, потом с большим числом общих мышц, в самый короткий день; с тем же условием о времени, лимитом на мышцу
      за тренировку и не больше MAX_SETS подходов в упражнении;
   3. если и так некуда — просто убрать: заметка называет настоящую причину (время или место в днях) и сколько подходов у мышцы останется
      по программе, а когда причина — время, подсказывает, что дни короче делает выбор времени на тренировку на «Программе».
   Пара сторон (одна рука, другая) идёт вместе, как одно упражнение. Время дня — оценка дневника с темпом атлета (pace.ts). Базовые по проценту
   и лёгкие дни поправка не трогает: их дни задаёт цель программы. Поправка снимается галочкой, как любая. Перенос и раздача пишутся в принятую
   программу, когда тренировка закончена без этого упражнения (ui/skipfix.ts, skipProgram): другие дни получают его со следующей тренировки.
   Правила — тренерские [Т]. */
import { MUSCLE, SLOT, SLOTS } from './catalog.ts';
import { fmtDate } from './dates.ts';
import { list, nSets } from './format.ts';
import { exName, isCycle, isLight } from './config.ts';
import { dayStale } from './days.ts';
import { planned, tally } from './tally.ts';
import { estMinutes, fmtDur } from './time.ts';
import { appRules, byPct, MAX_EX, MAX_SETS, PACE, sameMuscles, shown, TIME_EX } from './rules.ts';
import type { Cfg, ExDef, Item, MuscleMap, ProgEntry, ProgSlots, SkipFix, Workout } from './types.ts';

export const SKIP = { times: 2, tag: 'Не делал два раза' };
/* a раньше b: сравнение по порядку признаков */
const less = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

/** Неделя, как она стоит сейчас: последняя тренировка каждого дня или принятая программа, пока по ней не тренировались (как currentSlots в program.ts) */
export function weekNow(workouts: Workout[], cfg: Cfg): ProgSlots {
  const pl = planned(workouts.filter(w => !w.open), cfg), out: ProgSlots = {};
  for (const sl of SLOTS) {
    const w = pl.t[sl.id];
    out[sl.id] = !w ? [] : w.items.filter(it => cfg.ex[it.ex]).map(it => {
      const e: ProgEntry = { ex: it.ex };
      if (!isCycle(cfg, it.ex) && !isLight(cfg, it.ex)) e.n = it.sets ? it.sets.filter(x => !x.warm).length : (+it.n! || 3);
      return e;
    });
  }
  return out;
}
/** Что делать с упражнениями плана `items` дня `slot`, которые в двух последних тренировках этого дня не сделаны */
export function skipFixes(workouts: Workout[], cfg: Cfg, slot: string, date: string, items: Item[]): SkipFix[] {
  if (!appRules()) return [];
  const P = cfg.program, past = workouts.filter(w => !w.open && w.date < date);
  /* две последние тренировки этого дня; при принятой программе — только по ней: новая программа начинает счёт заново */
  const recs = past.filter(w => w.slot === slot && !dayStale(cfg, slot, w) && !(P && w.date < P.since)).slice(-SKIP.times);
  if (recs.length < SKIP.times) return [];
  const W = weekNow(past, cfg), out: SkipFix[] = [];
  if (!W[slot] || !W[slot].length) return [];
  const mOf = (id: string): MuscleMap => (cfg.ex[id] || {} as ExDef).m || {};
  const mains = (id: string) => Object.entries(mOf(id)).filter(([m, c]) => c >= 1 && !cfg.ignore[m]).map(([m]) => m);
  const est = (L: ProgEntry[]) => estMinutes(cfg, L);
  const plain = (id: string) => !isCycle(cfg, id) && !isLight(cfg, id) && !byPct(cfg, id);
  const maxEx = P && P.fit ? TIME_EX.day : MAX_EX;
  /* лимит на мышцу за тренировку: k подходов упражнения id в день sl */
  const okDay = (sl: string, id: string, k: number) => {
    const dv = tally(cfg, Object.fromEntries(SLOTS.map(s => [s.id, { items: W[s.id] }]))).day[sl] || {}, f = (cfg.ex[id] || {} as ExDef).uni ? 0.5 : 1;
    return Object.entries(mOf(id)).every(([m, c]) => !c || (dv[m] || 0) + k * c * f <= cfg.caps.day + 0.01);
  };
  /* сколько ты успеваешь: дни, последняя тренировка которых сделана вся, — по оценке дневника с твоим темпом */
  const full = SLOTS.filter(sl => sl.id !== slot && W[sl.id].length).filter(sl => {
    const last = past.filter(w => w.slot === sl.id && !dayStale(cfg, sl.id, w)).slice(-1)[0];
    return !!last && !(P && last.date < P.since) && last.items.length > 0 && last.items.every(x => !x.skip);
  }).map(sl => est(W[sl.id]));
  const ds = list(recs.map(w => fmtDate(w.date))), f = (id: string) => (cfg.ex[id] || {} as ExDef).uni ? 0.5 : 1;
  /* упражнения плана, не сделанные оба раза; пара сторон (одна рука, другая) идёт вместе, как одно упражнение */
  const missed = items.filter(it => !it.cyc && cfg.ex[it.ex] && plain(it.ex) && recs.every(w => w.items.some(x => x.ex === it.ex && x.skip)) && W[slot].some(e => e.ex === it.ex)).map(it => it.ex);
  const done: string[] = [];
  for (const E of missed) {
    if (done.includes(E)) continue;
    const G = [E].concat(f(E) < 1 ? missed.filter(x => x !== E && !done.includes(x) && f(x) < 1 && sameMuscles(mOf(x), mOf(E))).slice(0, 1) : []);
    done.push(...G);
    const ns = G.map(id => W[slot].find(e => e.ex === id)!.n || (items.find(it => it.ex === id)!.sets.length) || 3), M = mains(E);
    const vol = Math.round(G.reduce((a, id, i) => a + ns[i] * f(id), 0));   // сколько подходов мышце это даёт: у пары сторон подход идёт за половину
    W[slot] = W[slot].filter(e => !G.includes(e.ex));
    const L = shown(Math.max(est(W[slot]), ...full)), why = 'два раза подряд не сделано (' + ds + ')';
    const mine = G.map((id, i) => ({ ex: id, n: ns[i] }));
    const each = (fix: Omit<SkipFix, 'ex' | 'n'>) => G.forEach((id, i) => out.push(Object.assign({ ex: id, n: ns[i] }, i ? Object.assign({}, fix, { adds: fix.adds ? [] : undefined }) : fix)));
    /* 1. перенос: в дне есть место (число упражнений, нет упражнения на те же мышцы, лимит на мышцу) и хватает времени */
    const other = SLOTS.filter(sl => sl.id !== slot && W[sl.id].length);
    const same = (sl: string) => W[sl].some(e => G.includes(e.ex) || sameMuscles(mOf(e.ex), mOf(E)));
    const room = other.filter(sl => W[sl.id].length + 1 <= maxEx && !same(sl.id) && G.every((id, i) => okDay(sl.id, id, ns[i] * (G.length > 1 ? 2 : 1))));
    const fits = (sl: string) => shown(est(W[sl].concat(mine))) <= L;
    const to = room.filter(sl => fits(sl.id))
      .map(sl => ({ sl: sl.id, keep: M.every(m => !W[sl.id].some(e => (mOf(e.ex)[m] || 0) >= 1)), t: est(W[sl.id].concat(mine)) }))
      .sort((a, b) => (+b.keep - +a.keep) || a.t - b.t)[0];
    /* настоящая причина, если перенести некуда: время или место в днях */
    const slow = room.length > 0, cause = slow ? 'другие дни с ним вышли бы дольше тех, что ты успеваешь целиком' : other.length && other.every(sl => same(sl.id)) ? 'в других днях уже есть упражнение на те же мышцы' : 'в других днях ему нет места: там предел упражнений в дне или подходов на мышцу за тренировку';
    if (to) {
      W[to.sl].push(...mine);
      each({ kind: 'move', to: to.sl, notes: [why + ': переезжает в ' + SLOT[to.sl].n + ' — с ним там ≈ ' + fmtDur(to.t) + ', не дольше тренировок, которые ты успеваешь целиком'] });
      continue;
    }
    /* 2. подходы — другим упражнениям на ту же мышцу */
    const adds: { sl: string; ex: string; k: number }[] = [];
    let left = M.length ? vol : 0;
    while (left > 0) {
      let best: { sl: string; e: ProgEntry; r: number[] } | null = null;
      for (const sl of SLOTS) {
        if (sl.id === slot) continue;
        for (const e of W[sl.id]) {
          if (e.n == null || !plain(e.ex) || f(e.ex) < 1 || e.n >= MAX_SETS) continue;
          const sh = M.filter(m => (mOf(e.ex)[m] || 0) >= 1).length;
          if (!sh || !okDay(sl.id, e.ex, 1)) continue;
          const t = est(W[sl.id].map(x => x === e ? { ex: x.ex, n: x.n! + 1 } : x));
          if (shown(t) > L) continue;
          const r = [G.includes(e.ex) ? 0 : 1, sameMuscles(mOf(e.ex), mOf(E)) ? 0 : 1, -sh, t];
          if (!best || less(r, best.r)) best = { sl: sl.id, e, r };
        }
      }
      if (!best) break;
      best.e.n = best.e.n! + 1; left--;
      const a = adds.find(x => x.sl === best!.sl && x.ex === best!.e.ex);
      if (a) a.k++; else adds.push({ sl: best.sl, ex: best.e.ex, k: 1 });
    }
    if (adds.length) {
      each({ kind: 'spread', adds, left, notes: [why + ': целиком ни в один день не помещается (' + cause + '), поэтому уходит, а подходы — ' + adds.map(a => '«' + exName(cfg, a.ex) + '» (' + SLOT[a.sl].n + ') +' + a.k).join(', ')
        + (left ? '; ещё ' + nSets(left) + ' не поместились' : '')] });
      continue;
    }
    /* 3. убрать */
    const pv = tally(cfg, Object.fromEntries(SLOTS.map(s => [s.id, { items: W[s.id] }]))).pv;
    each({ kind: 'drop', left: M.length ? vol : 0, notes: [why + ': уходит из программы — ' + cause
      + (M.length ? '; по программе ' + M.map(m => MUSCLE[m].n.toLowerCase() + ' — ' + nSets(+(pv[m] || 0).toFixed(1))).join(', ') + ' в неделю' : '')]
      .concat(slow ? [!(P && P.fit) ? 'не успеваешь и другие дни — выбери на «Программе» время на тренировку: дни станут короче'
        : PACE.k > 1 ? 'тренировки идут дольше расчёта — на «Программе» дневник соберёт программу под ' + fmtDur(P.fit.time) + ' с твоим темпом: дни станут короче'
        : 'не успеваешь и другие дни — называй в конце тренировки, сколько она шла: дневник подстроит дни под твой темп, или выбери на «Программе» время меньше ' + fmtDur(P.fit.time)] : []) });
  }
  return out;
}
/** Неделя после поправок: перенос — упражнение в конце своего нового дня, раздача — подходы упражнениям. `slots` — неделя без этих упражнений в их дне */
export function applySkips(slots: ProgSlots, fixes: SkipFix[]): ProgSlots {
  const out: ProgSlots = JSON.parse(JSON.stringify(slots));
  for (const f of fixes) {
    if (f.kind === 'move' && f.to && out[f.to] && !out[f.to].some(e => e.ex === f.ex)) out[f.to].push({ ex: f.ex, n: f.n });
    if (f.kind === 'spread') for (const a of f.adds || []) { const e = (out[a.sl] || []).find(x => x.ex === a.ex); if (e && e.n != null) e.n += a.k; }
  }
  return out;
}
