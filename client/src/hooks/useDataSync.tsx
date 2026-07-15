import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth";
import {
  clearUserCache,
  formatSyncedAgo,
  readCached,
  writeCached,
} from "../lib/localCache";

export type DataSyncStatus = "loading_live" | "live" | "saved";

interface DataSyncContextValue {
  status: DataSyncStatus;
  lastSyncedAt: number | null;
  label: string;
  noteCached: (savedAt: number) => void;
  beginFetch: () => void;
  endFetchSuccess: (savedAt?: number) => void;
  endFetchFailure: (hadCache: boolean) => void;
  cancelFetch: () => void;
}

const DataSyncContext = createContext<DataSyncContextValue | null>(null);

export function DataSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pending, setPending] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [servingSaved, setServingSaved] = useState(false);
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    const nextId = user?._id ?? null;
    if (prevUserId.current && prevUserId.current !== nextId) {
      clearUserCache(prevUserId.current);
      setLastSyncedAt(null);
      setServingSaved(false);
      setPending(0);
    }
    prevUserId.current = nextId;
  }, [user?._id]);

  const noteCached = useCallback((savedAt: number) => {
    setServingSaved(true);
    setLastSyncedAt((current) =>
      current == null || savedAt > current ? savedAt : current,
    );
  }, []);

  const beginFetch = useCallback(() => {
    setPending((count) => count + 1);
  }, []);

  const endFetchSuccess = useCallback((savedAt?: number) => {
    setPending((count) => Math.max(0, count - 1));
    setServingSaved(false);
    setLastSyncedAt(savedAt ?? Date.now());
  }, []);

  const endFetchFailure = useCallback((hadCache: boolean) => {
    setPending((count) => Math.max(0, count - 1));
    if (hadCache) setServingSaved(true);
  }, []);

  const cancelFetch = useCallback(() => {
    setPending((count) => Math.max(0, count - 1));
  }, []);

  const status: DataSyncStatus =
    pending > 0 ? "loading_live" : servingSaved ? "saved" : "live";

  const label = useMemo(() => {
    if (status === "loading_live") return "Loading live data…";
    if (status === "saved") {
      return `Saved data · ${formatSyncedAgo(lastSyncedAt)}`;
    }
    return lastSyncedAt
      ? `Live · updated ${formatSyncedAgo(lastSyncedAt)}`
      : "Live";
  }, [status, lastSyncedAt]);

  const value = useMemo(
    () => ({
      status,
      lastSyncedAt,
      label,
      noteCached,
      beginFetch,
      endFetchSuccess,
      endFetchFailure,
      cancelFetch,
    }),
    [
      status,
      lastSyncedAt,
      label,
      noteCached,
      beginFetch,
      endFetchSuccess,
      endFetchFailure,
      cancelFetch,
    ],
  );

  return (
    <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>
  );
}

export function useDataSync() {
  const ctx = useContext(DataSyncContext);
  if (!ctx) throw new Error("useDataSync must be used within DataSyncProvider");
  return ctx;
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
) {
  const { user } = useAuth();
  const sync = useDataSync();
  const userId = user?._id ?? null;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(() => {
    if (!userId || !key) return null;
    return readCached<T>(userId, key)?.data ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (!userId || !key) return false;
    return readCached<T>(userId, key) == null;
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId || !key) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }

    const cached = readCached<T>(userId, key);
    if (cached) {
      setData(cached.data);
      setLoading(false);
      sync.noteCached(cached.savedAt);
    } else {
      setData(null);
      setLoading(true);
    }

    let cancelled = false;
    sync.beginFetch();
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) {
          sync.cancelFetch();
          return;
        }
        setData(result);
        setError("");
        writeCached(userId, key, result);
        sync.endFetchSuccess(Date.now());
      })
      .catch((err) => {
        if (cancelled) {
          sync.cancelFetch();
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load");
        sync.endFetchFailure(Boolean(cached));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key, ...deps]);

  const reload = useCallback(async () => {
    if (!userId || !key) return;
    const hadCache = data != null;
    sync.beginFetch();
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError("");
      writeCached(userId, key, result);
      sync.endFetchSuccess(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      sync.endFetchFailure(hadCache);
    } finally {
      setLoading(false);
    }
  }, [userId, key, sync, data]);

  const updateData = useCallback(
    (value: T | null | ((prev: T | null) => T | null)) => {
      setData((prev) => {
        const next =
          typeof value === "function"
            ? (value as (prev: T | null) => T | null)(prev)
            : value;
        if (userId && key && next != null) writeCached(userId, key, next);
        return next;
      });
    },
    [userId, key],
  );

  return {
    data,
    setData: updateData,
    loading: loading && data == null,
    error,
    reload,
  };
}
