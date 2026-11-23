/* Профили дневника: список лежит в config/profiles → { list: [{ id, n }] }. Без документа есть один профиль — «Мой дневник». */
import type { Doc, Store } from '../store/types.ts';
import { ME, PROFILES_DOC, validProfileId } from './paths.ts';

export interface Profile { id: string; n: string }
export const DEFAULT_NAME = 'Мой дневник';

/** Список профилей так, как его читает дневник: неверные записи отбрасываются, имя не длиннее 40 знаков, профиль me есть всегда */
export function profilesFromDoc(doc: Doc | null): Profile[] {
  const raw: unknown[] = doc && Array.isArray(doc.list) ? doc.list : [];
  const list = raw.filter((p): p is Doc => !!p && typeof p === 'object' && validProfileId(String((p as Doc).id)))
    .map(p => ({ id: String(p.id), n: String(p.n || p.id).slice(0, 40) }));
  return list.some(p => p.id === ME) ? list : [{ id: ME, n: DEFAULT_NAME }].concat(list);
}

export const readProfiles = async (store: Store): Promise<Profile[]> => profilesFromDoc(await store.get(PROFILES_DOC));
