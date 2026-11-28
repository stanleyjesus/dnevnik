/* Поправка «Не делал два раза» на экране тренировки (просьба владельца, 25 ноября 2026; docs/03, раздел 20). В эталоне этого нет.
   Правило — в core/skips.ts: упражнение, которое в двух последних тренировках дня не сделано, уходит из плана дня, а его подходы — в другой день
   или другим упражнениям. Здесь — что из этого осталось в идущей тренировке и как перенос и раздача попадают в принятую программу. */
import { C } from './dom.ts';
import { S } from './state.ts';
import { saveCfg } from './storage.ts';
import { D } from './render.ts';
import { appRules } from '../core/rules.ts';
import { applySkips } from '../core/skips.ts';
import type { Adapted, SkipFix, Workout } from '../core/index.ts';

/* поправка «Не делал два раза» (core/skips.ts) в тренировке, которая идёт: упражнения плана, которые она убрала и которых в тренировке нет.
   Тренировка с пустого листа — не по плану: там поправок нет */
export function goneOf(d: Workout, A: Adapted | null) {
  if (!A || !appRules() || !d.items.some(it => A.base.items.some(b => b.ex === it.ex))) return [];
  return A.props.filter(p => p.drop && !d.items.some(it => it.ex === p.ex));
}
export const movesOf = (d: Workout) => goneOf(d, C.adapt(D.W, D.cfg, d.slot!, d.date)).map(p => p.fix!).filter(f => f && f.kind !== 'drop');
/* перенос и раздача подходов из поправки «Не делал два раза» — в принятую программу: другие дни получают их со следующей тренировки.
   Неделя — как она стоит после этой тренировки; программа, если её не было, появляется под именем «Своя программа» (как собранная вручную: добавки плана только предлагаются),
   прежняя остаётся в «Вернуть прежнюю» */
export async function skipProgram(d: Workout, fixes: SkipFix[]) {
  const W2 = C.sortW(S.workouts.filter(w => !w.old && w.id !== d.id).concat([d])), slots = applySkips(C.currentSlots(W2, D.cfg), fixes);   // тренировки прежнего дневника в программу не входят (state.ts, derive)
  return saveCfg(raw => {
    const old = raw.program ? Object.assign({}, raw.program) : null;
    if (old) delete old.prev;
    raw.program = Object.assign({}, old || { name: 'Своя программа', focus: '', others: '', lean: true }, { since: d.date, made: D.today, slots: Object.assign({}, old ? old.slots : {}, slots), prev: old ? { goals: {}, program: old } : { goals: {} } });
  });
}
