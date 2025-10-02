"use client";

import { useCallback, useEffect, useState } from 'react';

interface AutoRefreshOptions {
  interval?: number;
  enabled?: boolean;
  immediate?: boolean;
}

export function useAutoRefresh(
  callback: () => Promise<void> | void,
  options?: AutoRefreshOptions,
) {
  const { interval = 60_000, enabled = true, immediate = false } = options ?? {};
  const [refreshing, setRefreshing] = useState(false);

  const trigger = useCallback(async () => {
    try {
      setRefreshing(true);
      await callback();
    } finally {
      setRefreshing(false);
    }
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    if (immediate) {
      void trigger();
    }
    const id = setInterval(() => {
      void trigger();
    }, interval);
    return () => clearInterval(id);
  }, [enabled, interval, trigger, immediate]);

  return { refreshing, trigger } as const;
}
