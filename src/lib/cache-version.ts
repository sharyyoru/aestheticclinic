/**
 * Cache version management for client-side cache invalidation
 * Checks if the app version has changed and forces a reload if needed
 */

const CACHE_VERSION_KEY = 'app_cache_version';
const CHECK_INTERVAL = 60000; // Check every 60 seconds

let currentVersion: string | null = null;
let checkInterval: NodeJS.Timeout | null = null;

/**
 * Initialize cache version checking
 * Call this in your root layout or app component
 */
export function initCacheVersionCheck() {
  if (typeof window === 'undefined') return;

  // Get initial version from server
  fetchCurrentVersion().then(version => {
    if (version) {
      const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
      
      if (storedVersion && storedVersion !== version) {
        console.log('New version detected, clearing cache...');
        clearAppCache();
        localStorage.setItem(CACHE_VERSION_KEY, version);
        // Force reload to get new version
        window.location.reload();
      } else {
        localStorage.setItem(CACHE_VERSION_KEY, version);
      }
      
      currentVersion = version;
    }
  });

  // Start periodic version checking
  if (!checkInterval) {
    checkInterval = setInterval(checkForNewVersion, CHECK_INTERVAL);
  }
}

/**
 * Stop cache version checking (cleanup)
 */
export function stopCacheVersionCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Fetch current build version from server
 */
async function fetchCurrentVersion(): Promise<string | null> {
  try {
    const response = await fetch('/', {
      method: 'HEAD',
      cache: 'no-store'
    });
    
    const version = response.headers.get('X-Build-Version');
    return version;
  } catch (err) {
    console.error('Failed to fetch build version:', err);
    return null;
  }
}

/**
 * Check if a new version is available
 */
async function checkForNewVersion() {
  const newVersion = await fetchCurrentVersion();
  
  if (!newVersion || !currentVersion) return;
  
  if (newVersion !== currentVersion) {
    console.log('New version available:', newVersion);
    
    // Show notification to user (optional)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Update Available', {
        body: 'A new version is available. The page will refresh automatically.',
        icon: '/favicon.ico'
      });
    }
    
    // Clear cache and reload after a short delay
    setTimeout(() => {
      clearAppCache();
      localStorage.setItem(CACHE_VERSION_KEY, newVersion);
      window.location.reload();
    }, 2000);
  }
}

/**
 * Clear all app caches
 */
function clearAppCache() {
  // Clear localStorage (except important data)
  const keysToKeep = ['supabase.auth.token', 'user_preferences'];
  const allKeys = Object.keys(localStorage);
  
  allKeys.forEach(key => {
    if (!keysToKeep.some(keep => key.includes(keep))) {
      localStorage.removeItem(key);
    }
  });

  // Clear sessionStorage
  sessionStorage.clear();

  // Clear Service Worker caches if available
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
}

/**
 * Manually trigger cache clear and reload
 */
export function forceAppUpdate() {
  clearAppCache();
  window.location.reload();
}

/**
 * Get current app version
 */
export function getCurrentVersion(): string | null {
  return currentVersion;
}
