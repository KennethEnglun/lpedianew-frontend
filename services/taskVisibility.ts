export type VisibilityScope = 'teacher' | 'student';

const STORAGE_PREFIX = 'lpedia.visibility';

export function makeTaskKey(type: string, id: string): string {
  return `${type}:${id}`;
}

export function parseTaskKey(key: string): { type: string; id: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0 || idx === key.length - 1) return null;
  return { type: key.slice(0, idx), id: key.slice(idx + 1) };
}

function storageKey(userId: string, scope: VisibilityScope): string {
  return `${STORAGE_PREFIX}.${scope}.${userId}`;
}

export function loadHiddenTaskKeys(userId: string, scope: VisibilityScope): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(userId, scope));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function saveHiddenTaskKeys(userId: string, scope: VisibilityScope, keys: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId, scope), JSON.stringify(Array.from(keys)));
  } catch {
    // ignore
  }
}

