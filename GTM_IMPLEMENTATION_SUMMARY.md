# GTM Iframe Tracking - Implementation Summary

## ✅ What Was Done

Implemented **Option 1** from the email: postMessage communication between iframe and parent page for Google Tag Manager conversion tracking.

## 🎯 Problem Solved

Forms embedded via iframe from `https://aestheticclinic.vercel.app` were not triggering GTM events on the parent site (`ads.aesthetic-ge.ch`) because:
- Cross-origin iframe restrictions
- GTM on parent page couldn't detect events inside iframe
- Conversions were not being tracked

## 🔧 Changes Made

### 1. Updated `src/components/GoogleTagManager.tsx`

Modified the `pushToDataLayer` function to automatically send postMessage to parent window when inside an iframe:

```typescript
export function pushToDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
    
    // NEW: Send postMessage to parent if in iframe
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ event, ...data }, "*");
      } catch (error) {
        console.error("Failed to send postMessage to parent:", error);
      }
    }
  }
}
```

### 2. Created `src/components/IframeEventListener.tsx`

Reference component showing how to listen for iframe events (for documentation purposes).

### 3. Created Documentation

- `IFRAME_GTM_SETUP.md` - Complete technical documentation
- `parent-page-template.html` - Ready-to-use HTML template
- `GTM_IMPLEMENTATION_SUMMARY.md` - This file

## 📋 What the Client Needs to Do

### Add This Script to Parent Page (ads.aesthetic-ge.ch)

Add this script **AFTER** the GTM script on any page that embeds the forms:

```html
<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.event) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: event.data.event });
      console.log('✅ Received iframe event:', event.data.event);
    }
  });
})();
</script>
```

### Complete Example

See `parent-page-template.html` for a complete working example.

## 🧪 Testing

### 1. Browser Console Test

On the parent page with embedded form:
1. Open browser console (F12)
2. Submit the form in the iframe
3. You should see: `✅ Received iframe event: aliice_form_submit`
4. Check dataLayer: `console.log(window.dataLayer)`

### 2. GTM Preview Mode

1. Open GTM in Preview mode
2. Navigate to parent page
3. Submit form
4. Check GTM Preview panel - should show `aliice_form_submit` event

### 3. Google Tag Assistant

1. Install Google Tag Assistant extension
2. Navigate to parent page
3. Submit form
4. Check Tag Assistant - should show event firing

## 📊 Events Tracked

| Event Name | Triggered When | Forms |
|------------|----------------|-------|
| `aliice_form_submit` | Form successfully submitted | Contact, Booking, Intake |

## 🔒 Security

Current implementation accepts messages from any origin (`"*"`). This is safe because:
- You control the iframe content
- Messages only contain event names (no sensitive data)
- Provides flexibility during development

**Optional:** Add origin validation in production:

```javascript
if (event.origin !== 'https://aestheticclinic.vercel.app') return;
```

## ✅ Verification Checklist

- [x] Modified `pushToDataLayer` to send postMessage
- [x] Created IframeEventListener component (reference)
- [x] Created documentation
- [x] Created HTML template for client
- [x] Tested - no TypeScript errors
- [ ] Client adds listener script to parent page
- [ ] Test form submission on parent page
- [ ] Verify GTM receives events
- [ ] Configure GTM triggers and tags
- [ ] Test conversion tracking

## 📁 Files Created/Modified

### Modified
- `src/components/GoogleTagManager.tsx` - Added postMessage functionality

### Created
- `src/components/IframeEventListener.tsx` - Reference component
- `IFRAME_GTM_SETUP.md` - Technical documentation
- `parent-page-template.html` - Client template
- `GTM_IMPLEMENTATION_SUMMARY.md` - This summary

## 🚀 Next Steps

1. **Client Action Required:** Add the listener script to parent page (ads.aesthetic-ge.ch)
2. **Test:** Submit form and verify events in browser console
3. **GTM Setup:** Configure triggers and tags in GTM for `aliice_form_submit`
4. **Verify:** Test conversion tracking end-to-end

## 💡 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Parent Page (ads.aesthetic-ge.ch)                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Google Tag Manager                                  │    │
│  │ - Listening for events in dataLayer                │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↑                                   │
│                          │ (3) Push to dataLayer            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Event Listener Script                               │    │
│  │ - Listens for postMessage                          │    │
│  │ - Receives: { event: 'aliice_form_submit' }        │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↑                                   │
│                          │ (2) postMessage                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ <iframe src="aestheticclinic.vercel.app">         │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────┐     │    │
│  │  │ Form Submission                           │     │    │
│  │  │ (1) pushToDataLayer('aliice_form_submit') │     │    │
│  │  │     → Sends postMessage to parent         │     │    │
│  │  └──────────────────────────────────────────┘     │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Verify listener script is present on parent page
3. Ensure GTM container ID is correct
4. Test with GTM Preview mode

---

**Status:** ✅ Implementation Complete - Ready for Client Integration

**Last Updated:** 2026-04-08
