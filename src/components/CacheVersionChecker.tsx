"use client";

import { useEffect } from 'react';
import { initCacheVersionCheck, stopCacheVersionCheck } from '@/lib/cache-version';

/**
 * Cache version checker component
 * Add this to your root layout to enable automatic cache invalidation
 */
export default function CacheVersionChecker() {
  useEffect(() => {
    // Initialize version checking
    initCacheVersionCheck();

    // Cleanup on unmount
    return () => {
      stopCacheVersionCheck();
    };
  }, []);

  // This component doesn't render anything
  return null;
}
