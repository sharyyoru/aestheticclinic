# DocSpace SDK Integration - Setup Instructions

## Issue: Login Loop in Cross-Origin Iframe

The DocSpace SDK is loading successfully but getting stuck in a login loop. This is caused by browser blocking third-party cookies in cross-origin iframes.

## Root Cause

When embedding DocSpace (`docspace-hm9cxt.onlyoffice.com`) in your application (`aestheticclinic.vercel.app`), browsers block cookies by default for security reasons. This prevents the authentication session from persisting.

## Solution: Configure DocSpace Server

You need to configure the DocSpace server to allow cross-origin cookies. This requires server-side access.

### Steps to Fix:

1. **Access your DocSpace server** at `docspace-hm9cxt.onlyoffice.com`

2. **Locate the `appsettings.json` file** on the server

3. **Add or modify the cookie settings** to include:
   ```json
   {
     "Cookie": {
       "SameSite": "none"
     }
   }
   ```

4. **Restart the DocSpace service** for changes to take effect

### If You Don't Have Server Access

If you're using ONLYOFFICE's hosted DocSpace service:

1. **Contact ONLYOFFICE Support**: https://www.onlyoffice.com/support-contact-form.aspx
2. **Request**: Ask them to enable `SameSite: none` for cookies on your DocSpace instance
3. **Provide**: Your DocSpace URL (`docspace-hm9cxt.onlyoffice.com`) and the domains you're embedding from:
   - `https://aestheticclinic.vercel.app`
   - `http://localhost:3002`

## Alternative Workaround (Temporary)

Until the server is configured, users must:

1. Open DocSpace in a separate tab: https://docspace-hm9cxt.onlyoffice.com
2. Log in there first
3. Keep that tab open
4. Return to your application
5. The SDK should now work (session is shared)

## Technical Details

From ONLYOFFICE Documentation:
> "Please note that when working via HTTPS, it is necessary to set the 'SameSite': 'none' parameter in appsettings.json to avoid blocking the work with cookies during cross-domain requests."

Reference: https://api.onlyoffice.com/docspace/javascript-sdk/get-started/

## Current Implementation Status

✅ SDK loads correctly
✅ Domain is whitelisted
✅ SDK initializes with `initManager()`
✅ Authentication detection implemented
❌ Cross-origin cookie issue (requires server configuration)

## Next Steps

1. Configure DocSpace server with `SameSite: none`
2. Test authentication flow
3. Verify session persistence works across page reloads
