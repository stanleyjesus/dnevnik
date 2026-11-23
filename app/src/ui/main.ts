/* Вход в приложение: подписки на события страницы и запуск.
   Перенесено из reference/src/ui3.js без изменения кода: добавлены только типы.
   Всё, чем экраны отличаются от эталона, перечислено в scripts/tokens.mjs. */
import { S } from './state.ts';
import { boot, saveDraft } from './storage.ts';
import { render, route, stale } from './render.ts';
import './pwa.ts';
import type { Timer } from './types.ts';

window.addEventListener('hashchange', () => { route(); S.ui.confirm = null; render(); });
document.addEventListener('focusout', () => { setTimeout(() => { if (stale && !(S.view === 'workout' && S.draft)) { const a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) render(true); } }, 60); });
export let rsT: Timer = 0, lastW = window.innerWidth;
window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rsT); rsT = setTimeout(() => { if (!(S.view === 'workout' && S.draft)) render(true); }, 200); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.draft && S.draft.open && S.dirty) saveDraft(); });
boot();
