import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const GAME_URL = 'https://ravik1233.github.io/Puzzle/';

export default function App() {
  const webviewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const handleAndroidBack = useCallback(() => {
    if (canGoBack && webviewRef.current) {
      webviewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  const retry = () => {
    setLoadFailed(false);
    webviewRef.current?.reload();
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', handleAndroidBack);
    return () => sub.remove();
  }, [handleAndroidBack]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {loadFailed ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn't load Dinner Rush</Text>
          <Text style={styles.errorBody}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ uri: GAME_URL }}
          style={styles.webview}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          onError={() => setLoadFailed(true)}
          onHttpError={() => setLoadFailed(true)}
          startInLoadingState
          allowsBackForwardNavigationGestures
          domStorageEnabled
          javaScriptEnabled
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141110',
  },
  webview: {
    flex: 1,
    backgroundColor: '#141110',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#f3ede4',
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    color: '#b8afa4',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#e2572b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
