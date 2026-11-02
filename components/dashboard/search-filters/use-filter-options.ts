"use client";

import { useEffect, useState } from "react";

export type FilterOptionsResponse = Record<string, string[]>;

/** Fetches distinct dropdown values for org/identity fields once on mount. */
export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptionsResponse>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search/filter-options", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { options?: FilterOptionsResponse } | null) => {
        if (data?.options) setOptions(data.options);
      })
      .catch(() => {
        // Dropdowns simply stay empty (only the "Tous" option) — not fatal.
      });
    return () => controller.abort();
  }, []);

  return options;
}
