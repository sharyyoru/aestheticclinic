# Quick Start - GTM Iframe Tracking

## 🎯 Goal
Track form submissions from embedded iframes in Google Tag Manager on the parent page.

## ⚡ Quick Implementation (2 Minutes)

### Step 1: Add This Script to Your Parent Page

Add this script **AFTER** your GTM script on `ads.aesthetic-ge.ch`:

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

### Step 2: Test It

1. Open browser console (F12)
2. Submit the form in the iframe
3. Look for: `✅ Received iframe event: aliice_form_submit`

### Step 3: Configure GTM

1. Go to GTM → Triggers → New
2. Trigger Type: **Custom Event**
3. Event name: `aliice_form_submit`
4. Save & Publish

## 📍 Where to Add the Script

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Your GTM script here -->
  <script>(function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-KP9GM9QG');</script>
</head>
<body>
  <!-- Your content -->
  
  <!-- Embedded form iframe -->
  <iframe src="https://aestheticclinic.vercel.app/embed/contact"></iframe>
  
  <!-- ADD THE LISTENER SCRIPT HERE (before </body>) -->
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
</body>
</html>
```

## ✅ Verification

### Browser Console
```javascript
// After form submission, you should see:
✅ Received iframe event: aliice_form_submit

// Check dataLayer:
console.log(window.dataLayer);
// Should contain: { event: 'aliice_form_submit' }
```

### GTM Preview Mode
1. Enable GTM Preview
2. Submit form
3. Check for `aliice_form_submit` event in preview panel

## 🎉 That's It!

The iframe forms will now trigger GTM events on your parent page.

## 📚 More Info

- Full documentation: `IFRAME_GTM_SETUP.md`
- HTML template: `parent-page-template.html`
- Implementation details: `GTM_IMPLEMENTATION_SUMMARY.md`

## 🆘 Troubleshooting

**Not seeing events?**
- Check if listener script is added
- Check browser console for errors
- Verify GTM container ID is correct

**Events in console but not in GTM?**
- Check GTM trigger configuration
- Ensure GTM container is published
- Test with GTM Preview mode

---

**Need help?** Check the full documentation in `IFRAME_GTM_SETUP.md`
