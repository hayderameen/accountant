const PREFIX = "accountant:data:v1:";

function storageAvailable(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = "__accountant_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export type CachedEntry<T> = {
  savedAt: number;
  data: T;
};

export function cacheKey(userId: string, key: string): string {
  return `${PREFIX}${userId}:${key}`;
}

export function readCached<T>(userId: string, key: string): CachedEntry<T> | null {
  const storage = storageAvailable();
  if (!storage) return null;
  try {
    const raw = storage.getItem(cacheKey(userId, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCached<T>(userId: string, key: string, data: T): void {
  const storage = storageAvailable();
  if (!storage) return;
  try {
    const entry: CachedEntry<T> = { savedAt: Date.now(), data };
    storage.setItem(cacheKey(userId, key), JSON.stringify(entry));
  } catch {
    // Quota exceeded, private mode, etc. — ignore silently
  }
}

export function clearUserCache(userId: string): void {
  const storage = storageAvailable();
  if (!storage) return;
  try {
    const prefix = `${PREFIX}${userId}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(prefix)) toRemove.push(key);
    }
    for (const key of toRemove) storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function formatSyncedAgo(savedAt: number | null): string {
  if (!savedAt) return "saved data";
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
