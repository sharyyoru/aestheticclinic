"use client";

import { useEffect, useCallback } from "react";

/**
 * Hook to communicate iframe content height to parent window via postMessage.
 * This allows the parent page to dynamically adjust the iframe height.
 */
export function useEmbedHeight() {
  const sendHeight = useCallback(() => {
    if (typeof window === "undefined") return;
    
    // Get the full document height
    const height = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    
    // Send height to parent window
    window.parent.postMessage(
      {
        type: "embed-height",
        height: height,
      },
      "*" // Allow any origin - the parent page controls which domains can embed
    );
  }, []);

  useEffect(() => {
    // Send initial height after mount
    sendHeight();

    // Send height on resize
    window.addEventListener("resize", sendHeight);

    // Use ResizeObserver to detect content changes
    const resizeObserver = new ResizeObserver(() => {
      sendHeight();
    });
    
    resizeObserver.observe(document.body);

    // Also send height periodically for dynamic content changes
    const interval = setInterval(sendHeight, 500);

    return () => {
      window.removeEventListener("resize", sendHeight);
      resizeObserver.disconnect();
      clearInterval(interval);
    };
  }, [sendHeight]);

  // Return sendHeight in case manual triggering is needed
  return { sendHeight };
}
