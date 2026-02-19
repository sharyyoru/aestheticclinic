# Cache Strategy for Vercel Deployment

This document explains the caching strategy implemented to ensure users always get the latest version after deployments.

## Problem

Users were experiencing stale content after deployments due to aggressive browser caching and CDN caching on Vercel.

## Solution

A multi-layered caching strategy that balances performance with freshness:

### 1. Build ID Generation (`next.config.ts`)

Each deployment gets a unique build ID:
```typescript
generateBuildId: async () => {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
```

This ensures Next.js generates new hashed filenames for all static assets on each deployment.

### 2. Cache-Control Headers

**Static Assets (JS, CSS, fonts, images):**
- `Cache-Control: public, max-age=31536000, immutable`
- Cached for 1 year because filenames include content hash
- Safe to cache aggressively - new versions get new filenames

**HTML Pages:**
- `Cache-Control: public, max-age=0, must-revalidate`
- Always revalidate with server
- Ensures users get latest HTML immediately

**API Routes:**
- `Cache-Control: no-store, no-cache, must-revalidate`
- Never cached
- Always fresh data

### 3. Middleware (`src/middleware.ts`)

Adds `X-Build-Version` header to all responses for client-side version detection.

### 4. Client-Side Version Checking (`src/lib/cache-version.ts`)

Automatically detects new deployments and forces reload:

- Checks build version every 60 seconds
- Compares with stored version in localStorage
- If different, clears cache and reloads page
- Preserves important data (auth tokens, user preferences)

### 5. Vercel Configuration (`vercel.json`)

Additional security and cache headers at the CDN level.

## How to Use

### Add to Root Layout

Add the `CacheVersionChecker` component to your root layout:

```tsx
import CacheVersionChecker from '@/components/CacheVersionChecker';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <CacheVersionChecker />
        {children}
      </body>
    </html>
  );
}
```

### Manual Cache Clear

Users can manually clear cache and reload:

```typescript
import { forceAppUpdate } from '@/lib/cache-version';

// In your component
<button onClick={forceAppUpdate}>
  Clear Cache & Reload
</button>
```

## Cache Behavior

| Resource Type | Cache Duration | Invalidation |
|--------------|----------------|--------------|
| HTML Pages | 0s (always revalidate) | Immediate |
| JS/CSS Bundles | 1 year (immutable) | New filename on build |
| Images/Fonts | 1 year (immutable) | New filename if changed |
| API Responses | No cache | N/A |
| Next.js Static | 1 year (immutable) | New build ID |

## Deployment Checklist

After each deployment:

1. ✅ New build ID is generated automatically
2. ✅ Static assets get new hashed filenames
3. ✅ HTML pages are served fresh (no cache)
4. ✅ Client-side version checker detects new version
5. ✅ Users automatically reload to get latest version

## Testing

### Test Cache Headers

```bash
# Check HTML page headers
curl -I https://your-app.vercel.app/

# Check static asset headers
curl -I https://your-app.vercel.app/_next/static/chunks/main-abc123.js

# Check API headers
curl -I https://your-app.vercel.app/api/health
```

### Test Version Detection

1. Deploy new version
2. Open browser console
3. Wait 60 seconds
4. Should see: "New version available: [timestamp]"
5. Page automatically reloads

## Troubleshooting

### Users Still Seeing Old Version

1. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear browser cache**: Settings → Clear browsing data
3. **Check build ID**: Look for `X-Build-Version` header in Network tab
4. **Verify deployment**: Check Vercel dashboard for successful deployment

### Version Checker Not Working

1. Check browser console for errors
2. Verify `CacheVersionChecker` is in root layout
3. Check that middleware is running (look for `X-Build-Version` header)
4. Ensure localStorage is not disabled

### API Responses Being Cached

1. Check response headers in Network tab
2. Should see `Cache-Control: no-store, no-cache`
3. If cached, check middleware configuration
4. Verify API route path matches `/api/*` pattern

## Performance Impact

- **Initial Load**: No impact (static assets still cached)
- **Navigation**: Faster (HTML revalidation is quick)
- **API Calls**: No caching overhead
- **Version Check**: Minimal (HEAD request every 60s)

## Best Practices

1. **Don't disable caching entirely** - Use smart cache headers instead
2. **Use content hashing** - Let Next.js handle it automatically
3. **Monitor cache hit rates** - Check Vercel Analytics
4. **Test after deployment** - Verify users get latest version
5. **Communicate updates** - Show notification before auto-reload (optional)

## Security Benefits

Additional security headers included:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

## Future Improvements

- [ ] Add visual notification before auto-reload
- [ ] Implement service worker for offline support
- [ ] Add version number to UI footer
- [ ] Track version adoption in analytics
- [ ] Add admin panel to force cache clear for all users
