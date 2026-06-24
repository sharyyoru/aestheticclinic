import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Platform, ActivityIndicator, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useRef } from 'react';

const APP_URL = 'https://aestheticclinic.vercel.app/prodapp';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const webViewRef = useRef(null);

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError(nativeEvent.description || 'Failed to load app');
    setLoading(false);
  };

  const handleHttpError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('HTTP error:', nativeEvent);
  };

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
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load app</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: APP_URL }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={handleError}
          onHttpError={handleHttpError}
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
          
          // Start in loading state
          startInLoadingState={true}
          
          // Bounce effect
          bounces={true}
          
          // Mixed content mode (allow https and http)
          mixedContentMode="compatibility"
          
          // User agent (helps identify app requests)
          userAgent={`AliiceCRM/1.0 (${Platform.OS}; Mobile)`}
          
          // Allow file access
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          
          // Needed for iOS
          originWhitelist={['*']}
        />
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 10,
  },
  errorDetail: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
