"use client";

import { useEffect, useRef } from "react";

export const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Poll while the tab is visible without allowing overlapping executions.
 * A newly visible tab refreshes immediately instead of waiting for the timer.
 */
export function useVisibilityPolling(
  callback: () => Promise<void>,
  enabled = true,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
) {
  const callbackRef = useRef(callback);
  const pendingRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    async function refresh() {
      if (disposed || document.hidden || pendingRef.current) return;

      pendingRef.current = true;
      try {
        await callbackRef.current();
      } catch {
        // Background refreshes are best-effort. Callers handle their own UI state.
      } finally {
        pendingRef.current = false;
      }
    }

    function handleVisibilityChange() {
      if (!document.hidden) void refresh();
    }

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), intervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
