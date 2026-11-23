/* Где лежат записи профиля: docs/02-data-model.md, раздел 1. Первый профиль (me) хранится там, где дневник держал записи всегда. */

export const ME = 'me';
export const PROFILES_DOC = 'config/profiles';

/** w — коллекция тренировок, cfg — документ настройки, body — коллекция веса тела, coach — документ разбора,
    draft — ключ черновика идущей тренировки на устройстве */
export interface ProfilePaths { w: string; cfg: string; body: string; coach: string; draft: string }

export const paths = (pid: string): ProfilePaths => pid === ME
  ? { w: 'workouts', cfg: 'config/main', body: 'body', coach: 'notes/coach', draft: 'td-draft' }
  : { w: 'workouts_' + pid, cfg: 'config/' + pid, body: 'body_' + pid, coach: 'notes/coach_' + pid, draft: 'td-draft-' + pid };

/** id профиля: строчные латинские буквы и цифры, до 24 знаков; main и profiles заняты документами настройки */
export const validProfileId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9]{1,24}$/.test(id) && id !== 'main' && id !== 'profiles';
