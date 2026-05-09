const CACHE_PREFIX = 'harmonic-cache:';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheRecord<T> {
  savedAt: number;
  value: T;
}

const canUseStorage = () => typeof window !== 'undefined' && !!window.sessionStorage;

export function readPageCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const record = JSON.parse(raw) as CacheRecord<T>;
    if (Date.now() - record.savedAt > ttlMs) {
      window.sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return record.value;
  } catch {
    return null;
  }
}

export function writePageCache<T>(key: string, value: T): void {
  if (!canUseStorage()) return;

  try {
    const record: CacheRecord<T> = {
      savedAt: Date.now(),
      value,
    };
    window.sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(record));
  } catch {
    // Ignore storage quota and private-mode errors. Fresh network data still works.
  }
}

export function clearPageCache(key?: string): void {
  if (!canUseStorage()) return;

  if (key) {
    window.sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return;
  }

  Object.keys(window.sessionStorage)
    .filter(storageKey => storageKey.startsWith(CACHE_PREFIX))
    .forEach(storageKey => window.sessionStorage.removeItem(storageKey));
}
