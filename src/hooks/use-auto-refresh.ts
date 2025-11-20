"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AutoRefreshOptions {
  interval?: number;
  enabled?: boolean;
  immediate?: boolean;
  minInterval?: number;
}

interface TriggerOptions {
  force?: boolean;
}

export function useAutoRefresh(
  callback: () => Promise<void> | void,
  options?: AutoRefreshOptions,
) {
  const {
    interval = 60_000,
    enabled = true,
    immediate = false,
    minInterval = 0,
  } = options ?? {};
  const [refreshing, setRefreshing] = useState(false);
  const lastRunRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPromiseRef = useRef<Promise<void> | null>(null);
  const currentRunRef = useRef<Promise<void> | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingPromiseRef.current = null;
  }, []);

  const run = useCallback(() => {
    if (currentRunRef.current) {
      return currentRunRef.current;
    }
    const promise = (async () => {
      setRefreshing(true);
      try {
        await callback();
        lastRunRef.current = Date.now();
      } finally {
        setRefreshing(false);
        currentRunRef.current = null;
      }
    })();
    currentRunRef.current = promise;
    return promise;
  }, [callback]);

  const trigger = useCallback(
    async (triggerOptions?: TriggerOptions) => {
      const shouldForce = Boolean(triggerOptions?.force);
      if (!enabled && !shouldForce) {
        return;
      }

      if (shouldForce) {
        clearPendingTimer();
        pendingPromiseRef.current = null;
        return run();
      }

      if (currentRunRef.current) {
        return currentRunRef.current;
      }

      const now = Date.now();
      const elapsed = now - lastRunRef.current;

      if (minInterval > 0 && elapsed < minInterval) {
        if (pendingPromiseRef.current) {
          return pendingPromiseRef.current;
        }
        const delay = minInterval - elapsed;
        pendingPromiseRef.current = new Promise<void>((resolve) => {
          pendingTimerRef.current = setTimeout(() => {
            pendingTimerRef.current = null;
            const promise = run();
            promise.finally(() => {
              pendingPromiseRef.current = null;
            });
            promise.then(resolve).catch(resolve);
          }, delay);
        });
        return pendingPromiseRef.current;
      }

      return run();
    },
    [clearPendingTimer, enabled, minInterval, run],
  );

  useEffect(() => {
    if (!enabled) {
      clearPendingTimer();
      return;
    }
    if (immediate) {
      void trigger();
    }
    const id = setInterval(() => {
      void trigger();
    }, interval);
    return () => clearInterval(id);
  }, [clearPendingTimer, enabled, immediate, interval, trigger]);

  useEffect(
    () => () => {
      clearPendingTimer();
    },
    [clearPendingTimer],
  );

  return { refreshing, trigger } as const;
}
