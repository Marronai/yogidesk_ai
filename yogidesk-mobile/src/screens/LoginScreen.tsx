import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { beginLogin, completeLogin } from '../services/api';
import { openSignupPortal } from '../services/externalLinks';

interface Props { onAuthenticated: (token: string) => void }

export function LoginScreen({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (awaitingOtp) {
        const result = await completeLogin(email.trim(), otp.trim());
        onAuthenticated(result.token);
      } else {
        const result = await beginLogin(email.trim(), password);
        if (result.token) onAuthenticated(result.token);
        else setAwaitingOtp(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>YOGIDESK ADMIN</Text>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>{awaitingOtp ? 'Enter the OTP sent to your registered email.' : 'Sign in to manage patient conversations.'}</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} editable={!awaitingOtp && !busy} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" />
      {awaitingOtp ? (
        <TextInput style={styles.input} value={otp} onChangeText={setOtp} editable={!busy} keyboardType="number-pad" placeholder="One-time password" maxLength={8} />
      ) : (
        <TextInput style={styles.input} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry placeholder="Password" />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{awaitingOtp ? 'Verify & Sign In' : 'Sign In'}</Text>}
      </Pressable>
      <View style={styles.signupRow}>
        <Text style={styles.muted}>New to YogiDesk? </Text>
        <Pressable onPress={() => void openSignupPortal().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to open sign up.'))}>
          <Text style={styles.link}>Sign Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#fff' },
  eyebrow: { color: '#ea580c', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#0f172a', fontSize: 34, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 28 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 16, height: 54, marginBottom: 12, color: '#0f172a', backgroundColor: '#f8fafc' },
  error: { color: '#dc2626', marginBottom: 10 },
  primary: { height: 54, borderRadius: 14, backgroundColor: '#ea580c', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  muted: { color: '#64748b' }, link: { color: '#ea580c', fontWeight: '800' },
});
