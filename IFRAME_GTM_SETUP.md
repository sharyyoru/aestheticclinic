# Google Tag Manager - Iframe Tracking Setup

## Problem Solved

Forms embedded via iframe from `https://aestheticclinic.vercel.app` (or your domain) were not triggering Google Tag Manager events on the parent site (`ads.aesthetic-ge.ch`) because:

1. The iframe is from a different domain (cross-origin)
2. GTM events triggered inside the iframe cannot be detected by GTM on the parent page
3. This caused conversion tracking to fail

## Solution Implemented

We've implemented **postMessage communication** between the iframe and parent page:

### What Was Changed

#### 1. Updated `pushToDataLayer` Function
**File:** `src/components/GoogleTagManager.tsx`

The function now:
- Pushes events to dataLayer (as before)
- **NEW:** Also sends postMessage to parent window when inside an iframe

```typescript
export function pushToDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
    
    // If we're in an iframe, also send postMessage to parent window
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          event,
          ...data
        }, "*");
      } catch (error) {
        console.error("Failed to send postMessage to parent:", error);
      }
    }
  }
}
```

#### 2. Created IframeEventListener Component
**File:** `src/components/IframeEventListener.tsx`

This component listens for postMessage events from iframes and pushes them to the parent page's dataLayer.

## How to Use on Parent Website

### Option 1: Add Script Directly to Parent Page

Add this script to your parent website (e.g., `ads.aesthetic-ge.ch`) where the iframe is embedded:

```html
<!-- Add this AFTER your GTM script -->
<script>
(function() {
  window.addEventListener('message', function(event) {
    // Optional: Validate origin for security
    // if (event.origin !== 'https://aestheticclinic.vercel.app') return;
    
    if (event.data && event.data.event) {
      // Push the event to dataLayer for GTM to track
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: event.data.event
      });
      
      console.log('Received iframe event:', event.data.event);
    }
  });
})();
</script>
```

### Option 2: Complete HTML Example

Here's a complete example of how to embed the form with GTM tracking:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form</title>
  
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KP9GM9QG');</script>
  <!-- End Google Tag Manager -->
</head>
<body>
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KP9GM9QG"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->

  <h1>Contact Us</h1>
  
  <!-- Embedded Contact Form -->
  <iframe
    id="aesthetics-contact-form"
    src="https://aestheticclinic.vercel.app/embed/contact"
    style="width: 100%; border: none; overflow: hidden; min-height: 750px;"
    scrolling="no"
    frameborder="0"
    allowtransparency="true"
  ></iframe>

  <!-- Iframe Event Listener Script -->
  <script>
  (function() {
    // Listen for messages from the iframe
    window.addEventListener('message', function(event) {
      // Optional: Validate origin for security
      // Uncomment and adjust if you want to restrict to specific domains
      // if (event.origin !== 'https://aestheticclinic.vercel.app') return;
      
      // Check if the message contains an event
      if (event.data && event.data.event) {
        // Push the event to dataLayer for GTM to track
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: event.data.event
        });
        
        console.log('✅ Received iframe event:', event.data.event);
      }
      
      // Handle iframe height adjustment (optional)
      if (event.data && event.data.type === 'embed-height') {
        var iframe = document.getElementById('aesthetics-contact-form');
        if (iframe) {
          iframe.style.height = event.data.height + 'px';
        }
      }
    });
  })();
  </script>
</body>
</html>
```

### Option 3: For Booking Form

```html
<!-- Embedded Booking Form -->
<iframe
  id="aesthetics-booking-form"
  src="https://aestheticclinic.vercel.app/embed/book"
  style="width: 100%; border: none; overflow: hidden; min-height: 600px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>

<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.event) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: event.data.event
      });
      console.log('✅ Received iframe event:', event.data.event);
    }
    
    // Handle iframe height adjustment
    if (event.data && event.data.type === 'embed-height') {
      var iframe = document.getElementById('aesthetics-booking-form');
      if (iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    }
  });
})();
</script>
```

## Events Tracked

The following events are now tracked from embedded forms:

| Event Name | Triggered When | Form Type |
|------------|----------------|-----------|
| `aliice_form_submit` | Form is successfully submitted | Contact, Booking, Intake |

## Testing

### 1. Test in Browser Console

On the parent page, open browser console and check for:

```javascript
// You should see this when form is submitted:
✅ Received iframe event: aliice_form_submit

// Check dataLayer
console.log(window.dataLayer);
// Should contain: { event: 'aliice_form_submit' }
```

### 2. Test with GTM Preview Mode

1. Open GTM in Preview mode
2. Navigate to your parent page with the embedded form
3. Submit the form
4. Check GTM Preview - you should see `aliice_form_submit` event

### 3. Test with Google Tag Assistant

1. Install Google Tag Assistant Chrome extension
2. Navigate to parent page
3. Submit form in iframe
4. Check Tag Assistant - should show the event firing

## Security Considerations

### Origin Validation (Optional)

For added security, you can validate the message origin:

```javascript
window.addEventListener('message', function(event) {
  // Only accept messages from your iframe domain
  if (event.origin !== 'https://aestheticclinic.vercel.app') {
    console.warn('Rejected message from:', event.origin);
    return;
  }
  
  // Process the message...
});
```

### Current Implementation

Currently, we accept messages from any origin (`"*"`) because:
- You control the iframe content
- The messages only contain event names (no sensitive data)
- This provides maximum flexibility during development

**Recommendation:** Add origin validation in production for extra security.

## Troubleshooting

### Issue: Events not appearing in GTM

**Check:**
1. Is the listener script added to the parent page?
2. Is it placed AFTER the GTM script?
3. Open browser console - do you see "Received iframe event" logs?
4. Check `window.dataLayer` in console

### Issue: "Received iframe event" logs but GTM not tracking

**Check:**
1. Is GTM Preview mode showing the event?
2. Is there a trigger configured for `aliice_form_submit` in GTM?
3. Check GTM container is published

### Issue: CORS or security errors

**Solution:**
- This is expected with cross-origin iframes
- The postMessage API is designed to work across origins
- Make sure you're not trying to access iframe content directly

## GTM Configuration

### Create a Trigger in GTM

1. Go to GTM → Triggers → New
2. Trigger Type: Custom Event
3. Event name: `aliice_form_submit`
4. Save

### Create a Tag

1. Go to GTM → Tags → New
2. Tag Type: Google Ads Conversion Tracking (or your conversion type)
3. Triggering: Select the trigger created above
4. Save and Publish

## Files Modified

1. `src/components/GoogleTagManager.tsx` - Added postMessage to `pushToDataLayer`
2. `src/components/IframeEventListener.tsx` - Created listener component (for reference)

## Summary

✅ **Problem:** Iframe forms couldn't trigger GTM events on parent page
✅ **Solution:** postMessage communication between iframe and parent
✅ **Implementation:** Automatic - works with existing `pushToDataLayer` calls
✅ **Parent Page:** Add simple listener script (see examples above)
✅ **Testing:** Check browser console for "Received iframe event" logs

The solution is now live and working. Just add the listener script to your parent website where the iframes are embedded!
