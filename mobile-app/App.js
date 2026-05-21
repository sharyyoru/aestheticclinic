import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Platform, ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useRef } from 'react';

const APP_URL = 'https://aestheticclinic.vercel.app/prodapp';

export default function App() {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  // Handle navigation to keep everything in-app
  const handleNavigationStateChange = (navState) => {
    // You can track navigation here if needed
  };

  // Block external URLs, allow only your domain
  const handleShouldStartLoadWithRequest = (request) => {
    const url = request.url;
    
    // Allow your app domain
    if (url.includes('aestheticclinic.vercel.app')) {
      return true;
    }
    
    // Allow tel: and mailto: to open native handlers
    if (url.startsWith('tel:') || url.startsWith('mailto:')) {
      return true;
    }
    
    // Block all other external URLs
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        
        // Enable JavaScript
        javaScriptEnabled={true}
        
        // Enable DOM storage for localStorage/sessionStorage
        domStorageEnabled={true}
        
        // Allow media playback
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        
        // iOS specific
        allowsBackForwardNavigationGestures={true}
        
        // Caching
        cacheEnabled={true}
        
        // Pull to refresh (iOS)
        pullToRefreshEnabled={true}
        
        // Bounce effect
        bounces={true}
        
        // Auto-adjust content
        scalesPageToFit={true}
        
        // User agent (helps identify app requests)
        userAgent="AliiceCRM/1.0 (iOS; Mobile)"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
});
