/* (в эталоне нет) Напоминание о резервной копии (выбор владельца, 28 ноября 2026): записи лежат только на устройстве, и копия раз в неделю
   ограничивает возможную потерю одной неделей. Дата последней копии хранится в памяти браузера этого устройства — копия делается для всех
   профилей сразу, а в саму копию эта дата не попадает. Только с днями «День N»: с таблицей дней эталона экраны и память браузера — как у эталона. */
import { C, h } from './dom.ts';
import { S } from './state.ts';
import { appRules } from '../core/rules.ts';

const KEY = 'td-backup', DAYS = 7;

/** дата последней резервной копии на этом устройстве (ГГГГ-ММ-ДД) или null, если копию здесь ещё не сохраняли */
export function lastBackup(): string | null {
  try { const v = localStorage.getItem(KEY); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; } catch { return null; }
}
/** копия сохранена: запомнить сегодняшнюю дату и убрать напоминание */
export function markBackup(today: string) {
  S.ui.backupAsk = false;
  if (!appRules()) return;
  try { localStorage.setItem(KEY, today); } catch { /* хранилище браузера недоступно */ }
}
/** пора ли напомнить: копии ещё не было или с последней прошло от семи дней */
export const backupDue = (last: string | null, today: string) => !last || C.dnum(today) - C.dnum(last) >= DAYS;

/** строка в «Данных»: когда сохранялась последняя копия */
export function backupLine(): HTMLElement | null {
  if (!appRules()) return null;
  const last = lastBackup();
  return h('p', { class: 'note', id: 'backup-last', style: 'margin-top:6px' }, last ? 'Последняя резервная копия на этом устройстве — ' + C.fmtDate(last, true) + '.' : 'Резервную копию на этом устройстве ещё не сохраняли.');
}
/** после «Завершить»: напомнить, если копии не было неделю */
export function askAfterWorkout(today: string) {
  if (appRules() && S.canWrite && backupDue(lastBackup(), today)) S.ui.backupAsk = true;
}
/** карточка над «Обзором» сразу после тренировки: сохранить копию сейчас или не сейчас */
export function backupAsk(save: () => void, later: () => void): HTMLElement | null {
  if (!appRules() || !S.ui.backupAsk || S.view !== 'overview') return null;
  const last = lastBackup();
  return h('div', { class: 'banner', id: 'backup-ask' },
    h('p', null, (last ? 'Резервной копии не было с ' + C.fmtDate(last, true) : 'Резервной копии ещё нет') + '. Записи есть только на этом устройстве.'),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn primary sm', id: 'backup-now', onclick: save }, 'Сохранить копию'), h('button', { class: 'btn ghost sm', id: 'backup-later', onclick: later }, 'Не сейчас')));
}
