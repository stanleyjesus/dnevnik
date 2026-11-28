/* Загрузка резервной копии с экрана (функция 32 в docs/05): выбрать файл → проверить → показать, что внутри → заменить записи.
   Импорт заменяет все записи приложения, поэтому перед заменой видно, что есть сейчас, и это можно сохранить.
   Справочник упражнений профиля из копии дополняется встроенным (решение владельца, 25 ноября 2026; core/starter.ts, fillStarter):
   копия первой версии приносит свой список без снарядов, и без этого встроенный справочник после загрузки пропадал.
   Сама запись копии в хранилище (data/backup.ts) кладёт то, что ей дали: дополняет экран загрузки.
   Копия прежнего дневника поверх своей программы (просьба владельца, 28 ноября 2026; с днями «День N»): если копию сделало не это приложение,
   а у её профиля в приложении уже есть программа, загрузка по умолчанию не заменяет записи, а дополняет историю (data/backup.ts, mergeBackup):
   тренировки ложатся в журнал и прогресс с пометкой «прежний дневник», программа и нынешние записи остаются. «Заменить всё» — прежняя замена. */
import { Core as C } from '../core/index.ts';
import type { Backup, BackupSummary, Merge } from '../data/backup.ts';
import { addToHistory, BackupError, backupSummary, canMerge, exportBackup, mergeBackup, parseBackup } from '../data/backup.ts';
import { appRules } from '../core/rules.ts';
import { h } from './dom.ts';
import { paths, S } from './state.ts';
import { render } from './render.ts';
import { toast } from './toast.ts';
import { openProfile } from './storage.ts';
import { saveBackup } from './setup.ts';
import { openStore, platform } from './platform.ts';
import { fillStarter } from '../core/starter.ts';
import type { Doc } from '../store/types.ts';
import type { RawCfg } from './types.ts';

declare const __DEV__: boolean;

/** Что дополнится в справочнике профиля: сколько упражнений ляжет на снаряды и сколько добавится из встроенного */
interface Fill { name: string; sorted: number; added: number }
/** Что сейчас на экране загрузки: прочитанная копия (уже со справочниками, дополненными встроенным) и её состав, что дополнится,
    состав нынешних записей, ошибка. read — копия как она есть, merge — что добавит «Добавить в историю» (если можно дополнить историю),
    replace — атлет выбрал «Заменить всё»; wait — нынешние записи ещё читаются: с днями «День N» до этого кнопки не нажимаются */
interface ImportState { file: string; backup?: Backup; read?: Backup; sum?: BackupSummary; fill?: Fill[]; now?: BackupSummary; merge?: Merge; replace?: boolean; wait?: boolean; error?: string; busy?: boolean }
let imp: ImportState | null = null;
const state = (): ImportState | null => imp;
const words = (n: number): string => n + ' ' + C.plural(n, ['тренировка', 'тренировки', 'тренировок']);
const total = (s: BackupSummary): number => s.profiles.reduce((a, p) => a + p.workouts, 0);

/** Копия, в которой справочник каждого профиля дополнен встроенным, и что у какого профиля изменится */
function filled(b: Backup): { backup: Backup; fill: Fill[] } {
  const fill: Fill[] = [];
  const profiles = b.profiles.map(p => {
    const f = fillStarter(p.config as RawCfg | null);
    if (!f.sorted.length && !f.added.length) return p;
    fill.push({ name: p.name, sorted: f.sorted.length, added: f.added.length });
    return Object.assign({}, p, { config: f.raw as unknown as Doc });
  });
  return { backup: Object.assign({}, b, { profiles }), fill };
}

/** Читает текст копии и показывает, что в ней, — или объясняет, почему она не годится.
    asIs — без дополнения справочника: так проверки экранов кладут в приложение те же записи, что получает эталон (scripts/screens.mjs) */
export function loadBackupText(text: string, file: string, asIs?: boolean): void {
  try {
    const read = parseBackup(text), { backup, fill } = asIs ? { backup: read, fill: [] } : filled(read), cur: ImportState = { file, backup, read, sum: backupSummary(read), fill, wait: appRules() && !asIs };
    imp = cur;
    /* что заменит импорт: записи всех профилей, которые лежат в приложении сейчас; с днями «День N» — и можно ли вместо замены дополнить историю */
    openStore().then(s => exportBackup(s)).then(b => {
      if (imp !== cur) return;
      cur.now = backupSummary(b); cur.wait = false;
      if (appRules() && !asIs && canMerge(b, read)) cur.merge = mergeBackup(b, read);
      render(true);
    }, () => { if (imp === cur) { cur.wait = false; render(true); } /* без этой строки подтверждение всё равно показано */ });
  } catch (e) { imp = { file, error: e instanceof BackupError ? e.message : 'Файл не удалось прочитать.' }; }
  render(true);
}

/** Открывает выбор файла */
export function pickBackup(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => { const f = input.files && input.files[0]; if (f) f.text().then(t => loadBackupText(t, f.name), () => loadBackupText('', f.name)); };
  input.click();
}

async function replaceAll(): Promise<void> {
  const cur = state();
  if (!cur || !cur.backup || !cur.sum || cur.busy) return;
  cur.busy = true;
  render(true);
  try {
    /* идущая тренировка — тоже запись: она заменяется вместе со всем остальным, и её черновик на устройстве больше не нужен */
    S.draft = null; S.draftSaved = null; S.dirty = false;
    try { for (const p of S.profiles) localStorage.removeItem(paths(p.id).draft); } catch { /* хранилище браузера недоступно */ }
    await platform.importBackup(cur.backup);
    imp = null;
    openProfile(cur.backup.profiles.some(p => p.id === S.profile) ? S.profile : 'me');
    toast('Копия загружена: ' + words(total(cur.sum)));
  } catch {
    cur.busy = false;
    cur.error = 'Копия не загрузилась. Записи остались прежними.';
    render(true);
  }
}

/** «Добавить в историю»: тренировки копии ложатся в журнал и прогресс, программа и нынешние записи остаются */
async function addAll(): Promise<void> {
  const cur = state();
  if (!cur || !cur.read || cur.busy) return;
  cur.busy = true;
  render(true);
  try {
    const m = await addToHistory(await openStore(), cur.read);
    imp = null;
    toast(m.added ? 'В историю добавлено: ' + words(m.added) : 'Новых тренировок в копии нет');
    render(true);
  } catch {
    cur.busy = false;
    cur.error = 'Копия не загрузилась. Записи остались прежними.';
    render(true);
  }
}

/* подтверждение «Добавить в историю»: что ляжет в журнал, что не добавится и почему */
function mergeBox(cur: ImportState, m: Merge, rows: HTMLElement[], title: string, close: () => void): HTMLElement {
  const plain = m.profiles.filter(p => !p.whole && !p.old && p.added), whole = m.profiles.filter(p => p.whole), ex = m.profiles.reduce((a, p) => a + p.ex, 0);
  const text = 'У тебя уже есть программа: тренировки из копии лягут в журнал и прогресс с пометкой «прежний дневник». Программа и нынешние записи не изменятся.'
    + (m.same ? ' Не добавятся ' + words(m.same) + ' на даты, где в журнале уже есть запись.' : '')
    + (ex ? ' В справочник добавится ' + ex + ' ' + C.plural(ex, ['упражнение', 'упражнения', 'упражнений']) + ' из копии.' : '')
    + plain.map(p => ' В профиле «' + p.name + '» программы нет: его тренировки лягут обычными записями.').join('')
    + whole.map(p => ' Профиль «' + p.name + '» добавится целиком.').join('');
  return h('div', { class: 'confirm', id: 'import-box', style: 'margin-top:12px;text-align:left' },
    h('p', null, h('b', null, title)),
    h('div', { class: 'sub', style: 'margin:6px 0' }, rows),
    h('p', { class: 'note', id: 'import-add-note' }, text),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn primary', id: 'import-add', disabled: !!cur.busy, onclick: addAll }, cur.busy ? 'Загружаю…' : 'Добавить в историю'),
      h('button', { class: 'btn', id: 'import-all', disabled: !!cur.busy, onclick: () => { cur.replace = true; render(true); } }, 'Заменить всё'),
      h('button', { class: 'btn', disabled: !!cur.busy, onclick: close }, 'Отмена')));
}

/** Подтверждение загрузки: состав копии, предупреждение о замене, кнопки. null, если копия не выбрана */
export function importBox(): HTMLElement | null {
  const cur = state();
  if (!cur) return null;
  const close = () => { imp = null; render(true); };
  if (cur.error || !cur.sum) return h('div', { class: 'confirm', id: 'import-box', style: 'margin-top:12px;text-align:left' },
    h('p', null, h('b', null, 'Копия не загружена. '), cur.error || ''),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: close }, 'Понятно')));
  const day = cur.sum.exportedAt.slice(0, 10), have = cur.now ? total(cur.now) : null;
  const rows = cur.sum.profiles.map(p => h('div', null, h('b', null, p.name + ': '),
    p.workouts ? words(p.workouts) + ', ' + (p.first === p.last ? C.fmtDate(p.first!, true) : C.fmtDate(p.first!, true) + ' – ' + C.fmtDate(p.last!, true)) : 'тренировок нет'));
  const title = /^\d{4}-\d\d-\d\d$/.test(day) ? 'Загрузить копию от ' + C.fmtDate(day, true) + '?' : 'Загрузить копию?';
  if (cur.merge && !cur.replace) return mergeBox(cur, cur.merge, rows, title, close);
  return h('div', { class: 'confirm', id: 'import-box', style: 'margin-top:12px;text-align:left' },
    h('p', null, h('b', null, title)),
    h('div', { class: 'sub', style: 'margin:6px 0' }, rows),
    cur.fill && cur.fill.length ? h('p', { class: 'sub', id: 'import-fill', style: 'margin-bottom:6px' }, 'Справочник дополнится встроенным' + (cur.fill.length > 1 ? ' — ' : ': ')
      + cur.fill.map(f => (cur.fill!.length > 1 ? '«' + f.name + '»: ' : '') + [f.sorted ? 'на снаряды — ' + f.sorted : '', f.added ? 'новых упражнений — ' + f.added : ''].filter(Boolean).join(', ')).join('; ') + '.') : null,
    h('p', { class: 'note' }, 'Все записи в приложении будут заменены. ' + (have == null ? '' : have ? 'Сейчас в нём ' + words(have) + '.' : 'Сейчас в нём записей нет.')),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn primary', id: 'import-go', disabled: !!cur.busy || !!cur.wait, onclick: replaceAll }, cur.busy ? 'Загружаю…' : 'Заменить записи'),
      have ? h('button', { class: 'btn', onclick: saveBackup }, 'Сначала сохранить нынешние') : null,
      h('button', { class: 'btn', disabled: !!cur.busy, onclick: close }, 'Отмена')));
}

/* для проверок при разработке: загрузить копию без окна выбора файла */
if (__DEV__) (window as unknown as { __dnevnik: unknown }).__dnevnik = { loadBackupText, S };
