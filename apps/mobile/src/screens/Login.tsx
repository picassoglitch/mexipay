import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { login, loginWithGoogle, loginWithApple } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { C, FONTS } from '../utils/colors';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const GOOGLE_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_AND = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

export default function LoginScreen({ navigation }: Props) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [socialBusy, setSocialBusy] = useState<'google' | 'apple' | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  // ── Google ────────────────────────────────────────────────────────────────
  const [, googleResponse, promptGoogle] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB,
    iosClientId:     GOOGLE_IOS,
    androidClientId: GOOGLE_AND,
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params?.id_token;
    if (!idToken) { setSocialBusy(null); return; }

    loginWithGoogle(idToken)
      .then((r) => { setAuth(r.merchant, r.accessToken, r.refreshToken); })
      .catch((e: unknown) => {
        Alert.alert('Error', apiMsg(e) ?? 'Error al iniciar con Google');
      })
      .finally(() => setSocialBusy(null));
  }, [googleResponse]);

  async function handleGoogle() {
    setSocialBusy('google');
    try { await promptGoogle(); }
    catch { setSocialBusy(null); }
  }

  // ── Apple ────────────────────────────────────────────────────────────────
  async function handleApple() {
    setSocialBusy('apple');
    try {
      const c = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const r = await loginWithApple({
        identityToken: c.identityToken!,
        email:    c.email ?? undefined,
        fullName: c.fullName,
      });
      setAuth(r.merchant, r.accessToken, r.refreshToken);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Error', apiMsg(e) ?? 'Error al iniciar con Apple');
    } finally {
      setSocialBusy(null);
    }
  }

  // ── Email/password ────────────────────────────────────────────────────────
  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    try {
      const r = await login(email.trim().toLowerCase(), password);
      setAuth(r.merchant, r.accessToken, r.refreshToken);
    } catch (e: unknown) {
      Alert.alert('Error', apiMsg(e) ?? 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || socialBusy !== null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <View style={s.logoArea}>
            <View style={s.logoMark}>
              <Text style={s.logoMarkText}>M</Text>
            </View>
            <Text style={s.logoText}>MexiPay</Text>
            <Text style={s.tagline}>Tu terminal de cobro SPEI</Text>
          </View>

          {/* ── Card ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Accede a tu cuenta</Text>

            {/* Google */}
            <SocialBtn
              label="Continuar con Google"
              icon="G"
              iconColor="#4285F4"
              bg={C.surface2}
              textColor={C.text}
              busy={socialBusy === 'google'}
              disabled={busy}
              onPress={handleGoogle}
            />

            {/* Apple – iOS only */}
            {Platform.OS === 'ios' && (
              <SocialBtn
                label="Continuar con Apple"
                icon=""
                iconColor={C.text}
                bg="#1A1A1A"
                textColor={C.text}
                busy={socialBusy === 'apple'}
                disabled={busy}
                onPress={handleApple}
              />
            )}

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.divLine} />
              <Text style={s.divText}>o con correo</Text>
              <View style={s.divLine} />
            </View>

            {/* Toggle email form */}
            {!showEmail ? (
              <TouchableOpacity
                style={[s.emailToggle, busy && s.dimmed]}
                disabled={busy}
                onPress={() => setShowEmail(true)}
              >
                <Text style={s.emailToggleText}>Iniciar sesión con correo</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={s.label}>Correo electrónico</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="negocio@ejemplo.mx"
                  placeholderTextColor={C.textDim}
                  selectionColor={C.accent}
                  editable={!busy}
                />

                <Text style={s.label}>Contraseña</Text>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="••••••••"
                  placeholderTextColor={C.textDim}
                  selectionColor={C.accent}
                  editable={!busy}
                />

                <TouchableOpacity
                  style={[s.loginBtn, busy && s.dimmed]}
                  onPress={handleEmailLogin}
                  disabled={busy}
                >
                  {loading
                    ? <ActivityIndicator color={C.bg} />
                    : <Text style={s.loginBtnText}>Iniciar sesión</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={s.terms}>
            Al continuar aceptas los{' '}
            <Text style={s.termsLink}>Términos de servicio</Text>
            {' '}y la{' '}
            <Text style={s.termsLink}>Política de privacidad</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Social button helper ────────────────────────────────────────────────────

function SocialBtn({
  label, icon, iconColor, bg, textColor, busy, disabled, onPress,
}: {
  label: string; icon: string; iconColor: string;
  bg: string; textColor: string;
  busy: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.socialBtn, { backgroundColor: bg }, disabled && s.dimmed]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      {busy ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          <Text style={[s.socialIcon, { color: iconColor }]}>{icon}</Text>
          <Text style={[s.socialLabel, { color: textColor }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function apiMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  // Logo
  logoArea:     { alignItems: 'center', marginBottom: 40 },
  logoMark:     {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 12,
  },
  logoMarkText: { fontFamily: FONTS.heading, fontSize: 32, color: C.bg },
  logoText:     { fontFamily: FONTS.heading, fontSize: 36, color: C.text, letterSpacing: -1 },
  tagline:      { fontFamily: FONTS.body,    fontSize: 14, color: C.textSub, marginTop: 6 },

  // Card
  card:      {
    backgroundColor: C.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 24,
  },
  cardTitle: { fontFamily: FONTS.subheading, fontSize: 18, color: C.text, textAlign: 'center', marginBottom: 24 },

  // Social
  socialBtn:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border2, gap: 10,
  },
  socialIcon:  { fontFamily: FONTS.bold, fontSize: 17, width: 22, textAlign: 'center' },
  socialLabel: { fontFamily: FONTS.medium, fontSize: 15 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { fontFamily: FONTS.body, fontSize: 12, color: C.textSub },

  // Email toggle
  emailToggle:     {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border2,
  },
  emailToggleText: { fontFamily: FONTS.medium, fontSize: 15, color: C.text },

  // Email form
  label: { fontFamily: FONTS.medium, fontSize: 13, color: C.textSub, marginBottom: 8 },
  input: {
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border2,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: C.text, marginBottom: 14,
    fontFamily: FONTS.body,
  },
  loginBtn:     { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  loginBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: C.bg },

  dimmed: { opacity: 0.45 },
  terms:  { fontFamily: FONTS.body, fontSize: 11, color: C.textSub, textAlign: 'center', lineHeight: 17 },
  termsLink: { color: C.accent },
});
