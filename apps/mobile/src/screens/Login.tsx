import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { login, loginWithGoogle, loginWithApple } from '../services/api';

// Required for expo-auth-session redirect to complete on Android/web
WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // ---------------------------------------------------------------------------
  // Google Sign-In (expo-auth-session)
  // ---------------------------------------------------------------------------

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;

    const idToken = googleResponse.params?.id_token;
    if (!idToken) {
      Alert.alert('Error', 'No se recibió token de Google');
      setSocialLoading(null);
      return;
    }

    loginWithGoogle(idToken)
      .then(() => navigation.replace('Dashboard'))
      .catch((err: unknown) => {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Error al iniciar sesión con Google';
        Alert.alert('Error', message);
      })
      .finally(() => setSocialLoading(null));
  }, [googleResponse, navigation]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleGoogle() {
    setSocialLoading('google');
    try {
      await promptGoogleAsync();
      // Outcome handled in the useEffect above
    } catch {
      setSocialLoading(null);
      Alert.alert('Error', 'No se pudo abrir Google Sign-In');
    }
  }

  async function handleApple() {
    setSocialLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      await loginWithApple({
        identityToken: credential.identityToken!,
        email: credential.email ?? undefined,
        fullName: credential.fullName,
      });

      navigation.replace('Dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') {
        // User dismissed — no error alert needed
        return;
      }
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al iniciar sesión con Apple';
      Alert.alert('Error', message);
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigation.replace('Dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al iniciar sesión';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  const anyLoading = loading || socialLoading !== null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>MexiPay</Text>
            <Text style={styles.tagline}>Cobra con SPEI al instante</Text>
          </View>

          {/* Social sign-in card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Accede a tu cuenta</Text>

            {/* Google */}
            <TouchableOpacity
              style={[styles.socialBtn, styles.googleBtn, anyLoading && styles.btnDisabled]}
              onPress={handleGoogle}
              disabled={anyLoading || !googleRequest}
              activeOpacity={0.8}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator color="#374151" size="small" />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.googleBtnText}>Continuar con Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple — iOS only */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialBtn, styles.appleBtn, anyLoading && styles.btnDisabled]}
                onPress={handleApple}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                {socialLoading === 'apple' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <AppleIcon />
                    <Text style={styles.appleBtnText}>Continuar con Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o usa tu correo</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Toggle email form */}
            {!showEmailForm ? (
              <TouchableOpacity
                style={[styles.emailToggleBtn, anyLoading && styles.btnDisabled]}
                onPress={() => setShowEmailForm(true)}
                disabled={anyLoading}
              >
                <Text style={styles.emailToggleText}>Iniciar sesión con correo</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="negocio@ejemplo.mx"
                  placeholderTextColor="#9CA3AF"
                  editable={!anyLoading}
                />

                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  editable={!anyLoading}
                />

                <TouchableOpacity
                  style={[styles.emailLoginBtn, anyLoading && styles.btnDisabled]}
                  onPress={handleEmailLogin}
                  disabled={anyLoading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.emailLoginBtnText}>Iniciar Sesión</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.terms}>
            Al continuar aceptas nuestros{' '}
            <Text style={styles.termsLink}>Términos de Servicio</Text> y{' '}
            <Text style={styles.termsLink}>Política de Privacidad</Text>
          </Text>

          <Text style={styles.footer}>¿Ayuda? soporte@mexipay.mx</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG-style icons (no extra assets needed)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <View style={styles.iconBox}>
      <Text style={styles.googleIconText}>G</Text>
    </View>
  );
}

function AppleIcon() {
  return (
    <View style={styles.iconBox}>
      <Text style={styles.appleIconText}></Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A56DB' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: 15, color: '#BFDBFE', marginTop: 6 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Social buttons
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
    gap: 10,
  },
  googleBtn: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appleBtn: {
    backgroundColor: '#000',
  },
  btnDisabled: { opacity: 0.5 },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  appleBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  iconBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  googleIconText: { fontSize: 16, fontWeight: '900', color: '#4285F4' },
  appleIconText: { fontSize: 18, color: '#fff' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  // Email toggle
  emailToggleBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  emailToggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Email form
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
  },
  emailLoginBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  emailLoginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  terms: { textAlign: 'center', fontSize: 11, color: '#BFDBFE', lineHeight: 16, paddingHorizontal: 8 },
  termsLink: { color: '#fff', fontWeight: '600' },
  footer: { textAlign: 'center', color: '#BFDBFE', fontSize: 11, marginTop: 12 },
});
