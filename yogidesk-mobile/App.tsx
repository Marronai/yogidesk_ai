import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { InboxScreen } from './src/screens/InboxScreen';

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {accessToken ? (
        <InboxScreen accessToken={accessToken} onSignOut={() => setAccessToken(null)} />
      ) : (
        <LoginScreen onAuthenticated={setAccessToken} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f8fafc' } });
