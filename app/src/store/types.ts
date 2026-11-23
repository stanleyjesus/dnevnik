/* Хранилище документов на устройстве. Пути вида «коллекция/документ», запись заменяет документ целиком,
   подписчики узнают о каждом изменении. Смысл тот же, что у хранилища артефакта: docs/02-data-model.md, раздел 7. */

/** Документ: то, что переживает JSON */
export type Doc = Record<string, unknown>;
/** Документ коллекции вместе с его id */
export interface DocEntry<T = Doc> { id: string; data: T }
/** Одна запись пакета; data = null — удалить документ */
export interface WriteOp { path: string; data: Doc | null }

/** То, что хранит данные на самом деле: память (для проверок) или IndexedDB (на устройстве) */
export interface Backend {
  get(path: string): Promise<Doc | null>;
  /** Документы коллекции по возрастанию id */
  list(collection: string): Promise<DocEntry[]>;
  /** Все записи применяются разом или не применяется ни одна; wipe — перед этим стереть всё */
  apply(ops: WriteOp[], wipe: boolean): Promise<void>;
  close(): void;
}

/** Хранилище, с которым работает приложение */
export interface Store {
  get<T = Doc>(path: string): Promise<T | null>;
  /** Документы коллекции по возрастанию id */
  list<T = Doc>(collection: string): Promise<DocEntry<T>[]>;
  /** Заменяет документ целиком */
  set(path: string, data: Doc): Promise<void>;
  delete(path: string): Promise<void>;
  /** Несколько записей разом: либо все, либо ни одной. wipe — сначала стереть всё хранилище */
  batch(ops: WriteOp[], opts?: { wipe?: boolean }): Promise<void>;
  /** next вызывается сразу с текущим состоянием и после каждого изменения; возвращает отписку */
  watchDoc<T = Doc>(path: string, next: (data: T | null) => void, onError?: (e: unknown) => void): () => void;
  watchCollection<T = Doc>(collection: string, next: (docs: DocEntry<T>[]) => void, onError?: (e: unknown) => void): () => void;
  close(): void;
}

/** Ошибка хранилища: code — для программы, message — для человека */
export class StoreError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'StoreError'; this.code = code; }
}
