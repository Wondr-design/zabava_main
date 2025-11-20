"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/lib/web/api-client";
import type {
  GlobalValueRecord,
  GlobalValueType,
} from "@/lib/data/global-values";

interface UseGlobalValuesOptions {
  includeInactive?: boolean;
  initialValues?: GlobalValueRecord[];
}

export function useGlobalValues(
  type: GlobalValueType,
  { includeInactive = true, initialValues }: UseGlobalValuesOptions = {},
) {
  const [values, setValues] = useState<GlobalValueRecord[]>(
    initialValues ?? [],
  );
  const [loading, setLoading] = useState(!initialValues);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.globalsList(
        { type, includeInactive },
        {},
      );
      setValues(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load values.");
    } finally {
      setLoading(false);
    }
  }, [type, includeInactive]);

  useEffect(() => {
    if (initialValues) return;
    void refresh();
  }, [refresh, initialValues]);

  return { values, loading, error, refresh, setValues };
}
