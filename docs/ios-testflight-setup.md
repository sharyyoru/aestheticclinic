# iOS TestFlight Setup Guide

This guide explains how to create an iOS app wrapper for Aliice CRM that can be distributed via TestFlight.

## Overview

The `/prodapp` route is designed as a mobile-first web app shell that:
- Uses iOS safe areas for notch and home indicator
- Has native-like bottom tab navigation
- Prevents external browser opening
- Supports PWA features

## iOS App Structure (Xcode Project)

### 1. Create New Xcode Project

1. Open Xcode → File → New → Project
2. Select "App" under iOS
3. Product Name: `AliiceCRM`
4. Team: Your Apple Developer account
5. Organization Identifier: `ch.aliice` (or your domain reversed)
6. Interface: SwiftUI
7. Language: Swift

### 2. Main App File

Replace `AliiceCRMApp.swift`:

```swift
import SwiftUI

@main
struct AliiceCRMApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewContainer()
                .ignoresSafeArea()
        }
    }
}
```

### 3. WebView Container

Create `WebViewContainer.swift`:

```swift
import SwiftUI
import WebKit

struct WebViewContainer: UIViewRepresentable {
    let url = URL(string: "https://aestheticclinic.vercel.app/prodapp")!
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        
        // Enable inline media playback
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        // Enable JavaScript
        configuration.preferences.javaScriptEnabled = true
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        
        // Enable swipe back navigation
        webView.allowsBackForwardNavigationGestures = true
        
        // Set scroll behavior
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        
        // Opaque background for better performance
        webView.isOpaque = true
        webView.backgroundColor = UIColor.systemBackground
        
        // Load the app
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebViewContainer
        
        init(_ parent: WebViewContainer) {
            self.parent = parent
        }
        
        // CRITICAL: Keep all navigation inside the app
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            
            let host = url.host ?? ""
            
            // Allow navigation within our domain
            if host.contains("aestheticclinic.vercel.app") || 
               host.contains("localhost") ||
               host.isEmpty {
                decisionHandler(.allow)
                return
            }
            
            // Handle tel: and mailto: links
            if url.scheme == "tel" || url.scheme == "mailto" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            
            // Block external links - keep everything in-app
            // Or open in Safari if truly external (uncomment below)
            // UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
        
        // Handle target="_blank" links
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // Load in same webview instead of opening new window
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }
        
        // Handle JavaScript alerts
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            // You could show a native alert here
            completionHandler()
        }
    }
}
```

### 4. Info.plist Configuration

Add these keys to `Info.plist`:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>

<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleDefault</string>

<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>

<key>UIRequiresFullScreen</key>
<true/>

<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>

<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

### 5. App Icons

1. Create app icons in these sizes:
   - 1024x1024 (App Store)
   - 180x180 (iPhone @3x)
   - 120x120 (iPhone @2x)
   - 167x167 (iPad Pro)
   - 152x152 (iPad)
   - 76x76 (iPad @1x)

2. Add to `Assets.xcassets` → `AppIcon`

### 6. Launch Screen

Create a simple launch screen in `LaunchScreen.storyboard` with your logo centered.

## Building for TestFlight

### 1. Configure Signing

1. Xcode → Target → Signing & Capabilities
2. Select your Team
3. Bundle Identifier: `ch.aliice.crm` (must be unique)
4. Enable "Automatically manage signing"

### 2. Archive & Upload

1. Select "Any iOS Device" as build target
2. Product → Archive
3. Window → Organizer
4. Select archive → Distribute App
5. Select "App Store Connect"
6. Upload

### 3. TestFlight Configuration

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → Your App → TestFlight
3. Add internal testers (your team)
4. Add external testers (beta users) - requires App Review

## Web App Features for Native Feel

The `/prodapp` page includes:

| Feature | Implementation |
|---------|----------------|
| Safe Areas | `env(safe-area-inset-*)` CSS |
| No Bounce | `overscroll-behavior: none` |
| No Selection | `-webkit-user-select: none` |
| Hidden Scrollbars | `::-webkit-scrollbar { display: none }` |
| Touch Feedback | `:active` states on buttons |
| Bottom Tab Bar | Native iOS tab bar pattern |
| Pull to Refresh | Supported via scroll |

## Updating the App

Since the app is a web wrapper, updates to the web app are **instant** - no App Store review needed for content changes.

Only update the iOS wrapper when you need to:
- Change the URL
- Modify native features
- Update app icons
- Change permissions

## Troubleshooting

### White Screen
- Check internet connection
- Verify URL is correct
- Check console for JavaScript errors

### Login Not Persisting
- WKWebView stores cookies by default
- Ensure Supabase session is using localStorage (default)

### Links Opening Safari
- Check `decidePolicyFor` implementation
- Ensure all your domains are whitelisted

### Status Bar Issues
- Set `UIViewControllerBasedStatusBarAppearance` to NO
- Use `preferredStatusBarStyle` if needed

## Production Checklist

- [ ] App icons at all sizes
- [ ] Launch screen configured
- [ ] Bundle ID registered in Apple Developer
- [ ] Privacy policy URL (required for App Store)
- [ ] App description and screenshots
- [ ] Test on multiple device sizes
- [ ] Test offline behavior
- [ ] Test login/logout flow
- [ ] Test all navigation paths
