/* Короткие сообщения внизу экрана.
   Перенесено из reference/src/ui1.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { $ } from './dom.ts';
import { S } from './state.ts';
import type { Timer } from './types.ts';

/* ---------- toast ---------- */
export let toastT: Timer = 0;
export function toast(msg: string) { const t = $('toast'); t!.textContent = msg; t!.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t!.classList.remove('show'), 3200); }
export const dbErr = (e: any) => { const c = e && e.code; toast(c === 'quota_exceeded' ? 'На устройстве кончилось место: освободи его и повтори' : c === 'invalid_argument' ? 'Запись отклонена: нет прав на изменение' : 'Не удалось сохранить. Повтори ещё раз'); if (c === 'invalid_argument') { S.canWrite = false; } };
