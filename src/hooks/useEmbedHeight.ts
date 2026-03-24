"use client";

import { useEffect, useCallback } from "react";

/**
 * Hook to communicate iframe content height to parent window via postMessage.
 * This allows the parent page to dynamically adjust the iframe height.
 */
export function useEmbedHeight() {
  const sendHeight = useCallback(() => {
    if (typeof window === "undefined") return;
    
    // Get the full document height - use multiple methods for accuracy
    const body = document.body;
    const html = document.documentElement;
    
    const height = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
    
    // Add small buffer to prevent any edge-case scrollbars
    const finalHeight = height + 2;
    
    // Send height to parent window
    window.parent.postMessage(
      {
        type: "embed-height",
        height: finalHeight,
      },
      "*" // Allow any origin - the parent page controls which domains can embed
    );
  }, []);

  useEffect(() => {
    // Send initial height after a small delay to ensure DOM is ready
    const initialTimeout = setTimeout(sendHeight, 100);
    
    // Send again after fonts and images may have loaded
    const secondTimeout = setTimeout(sendHeight, 500);

    // Send height on resize
    window.addEventListener("resize", sendHeight);

    // Use ResizeObserver to detect content changes
    const resizeObserver = new ResizeObserver(() => {
      // Small delay to let animations complete
      setTimeout(sendHeight, 50);
    });
    
    resizeObserver.observe(document.body);

    // Also send height periodically for dynamic content changes
    const interval = setInterval(sendHeight, 300);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
      window.removeEventListener("resize", sendHeight);
      resizeObserver.disconnect();
      clearInterval(interval);
    };
  }, [sendHeight]);

  // Return sendHeight in case manual triggering is needed
  return { sendHeight };
}
