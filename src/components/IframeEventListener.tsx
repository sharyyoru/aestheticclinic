"use client";

import { useEffect } from "react";

/**
 * IframeEventListener Component
 * 
 * Listens for postMessage events from embedded iframes and pushes them to GTM dataLayer.
 * This solves the cross-domain tracking issue where forms embedded via iframe
 * cannot directly trigger GTM events on the parent page.
 * 
 * Usage: Add this component to your main layout or page where iframes are embedded.
 */
export function IframeEventListener() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Security: Validate origin if needed
      // For now, we accept messages from any origin since we control the iframe content
      // You can add origin validation like:
      // if (event.origin !== 'https://aestheticclinic.vercel.app') return;
      
      if (event.data && event.data.event) {
        // Push the event to dataLayer for GTM to track
        if (typeof window !== "undefined") {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: event.data.event,
            ...event.data
          });
          
          console.log("Received iframe event:", event.data.event);
        }
      }
    }

    // Add event listener
    window.addEventListener("message", handleMessage);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // This component doesn't render anything
  return null;
}

// Type declaration for window.dataLayer
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}
