import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, StatusBar, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCodeSVG from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getTransaction } from '../services/api';
import { C, FONTS } from '../utils/colors';
import { formatMXN, formatCLABE, formatCountdown } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

const POLL_MS    = 3_000;
const MAX_POLL_MS = 30 * 60 * 1_000; // stop after 30 min

export default function QRCodeScreen({ navigation, route }: Props) {
  const {
    transactionId, clabe, reference,
    amountCentavos, feeCentavos, netCentavos, feePercent, expiresAt,
  } = route.params;

  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [dots, setDots]     = useState('');
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef  = useRef(Date.now());
  const expired   = secondsLeft <= 0;

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1_000);
    return () => clearInterval(t);
  }, []);

  // ── Animated dots ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(t);
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────────
  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      // Hard stop after 30 minutes regardless of expiry
      if (Date.now() - startRef.current > MAX_POLL_MS) { stopPoll(); return; }

      try {
        const tx = await getTransaction(transactionId);

        if (tx.status === 'paid') {
          stopPoll();
          navigation.replace('Success', {
            amountCentavos,
            feeCentavos,
            netCentavos,
            feePercent,
            reference,
            paidAt: tx.paidAt ?? new Date().toISOString(),
          });
        } else if (tx.status === 'expired' || tx.status === 'failed') {
          stopPoll();
          Alert.alert(
            tx.status === 'expired' ? 'Cobro vencido' : 'Cobro fallido',
            'Este cobro ya no puede ser pagado.',
            [{ text: 'Nuevo cobro', onPress: () => navigation.replace('Keypad') }],
          );
        }
      } catch { /* silent — keep polling */ }
    }, POLL_MS);

    return stopPoll;
  }, [transactionId, navigation, stopPoll]);

  function copyClabe() {
    Clipboard.setString(clabe);
    Alert.alert('Copiado', 'CLABE copiada al portapapeles');
  }

  const clabeDisplay = formatCLABE(clabe);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => {
          stopPoll();
          navigation.replace('Keypad');
        }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {expired ? 'Cobro vencido' : `Esperando pago${dots}`}
          </Text>
          <Text style={[s.timer, expired && s.timerExpired]}>
            {expired ? '00:00' : formatCountdown(secondsLeft)}
          </Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {/* ── Amount ── */}
      <Text style={s.amount}>{formatMXN(amountCentavos)}</Text>
      <Text style={s.amountSub}>MXN · Recibes {formatMXN(netCentavos)}</Text>

      {/* ── QR ── */}
      <View style={s.qrWrap}>
        <View style={s.qrCard}>
          <QRCodeSVG
            value={clabe}
            size={200}
            color="#000000"
            backgroundColor="#FFFFFF"
            quietZone={12}
          />
        </View>
        <Text style={s.qrHint}>Escanea con tu app bancaria</Text>
      </View>

      {/* ── CLABE ── */}
      <TouchableOpacity style={s.clabeCard} onPress={copyClabe} activeOpacity={0.7}>
        <Text style={s.clabeLabel}>CLABE SPEI</Text>
        <Text style={s.clabeValue}>{clabeDisplay}</Text>
        <Text style={s.clabeCopy}>Toca para copiar</Text>
      </TouchableOpacity>

      {/* ── Reference ── */}
      <View style={s.refRow}>
        <Text style={s.refLabel}>Referencia</Text>
        <Text style={s.refValue}>{reference}</Text>
      </View>

      {/* ── Polling indicator ── */}
      {!expired && (
        <View style={s.pollingRow}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={s.pollingText}>Verificando cada 3 segundos</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn:       { width: 40, height: 40, justifyContent: 'center' },
  backArrow:     { fontFamily: FONTS.body, fontSize: 22, color: C.text },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerTitle:   { fontFamily: FONTS.medium, fontSize: 15, color: C.textSub },
  timer:         { fontFamily: FONTS.subheading, fontSize: 22, color: C.accent, marginTop: 2 },
  timerExpired:  { color: C.failed },

  amount:    { fontFamily: FONTS.heading, fontSize: 48, color: C.text, textAlign: 'center', letterSpacing: -1 },
  amountSub: { fontFamily: FONTS.body, fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 4, marginBottom: 24 },

  qrWrap: { alignItems: 'center', marginBottom: 24 },
  qrCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 8,
  },
  qrHint: { fontFamily: FONTS.body, fontSize: 12, color: C.textSub, marginTop: 12, textAlign: 'center' },

  clabeCard: {
    marginHorizontal: 24, backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12,
  },
  clabeLabel: { fontFamily: FONTS.medium, fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  clabeValue: { fontFamily: FONTS.bold, fontSize: 22, color: C.text, letterSpacing: 2 },
  clabeCopy:  { fontFamily: FONTS.body, fontSize: 12, color: C.accent, marginTop: 6 },

  refRow:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 24, backgroundColor: C.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16,
  },
  refLabel: { fontFamily: FONTS.medium, fontSize: 13, color: C.textSub },
  refValue: { fontFamily: FONTS.bold, fontSize: 14, color: C.text },

  pollingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pollingText: { fontFamily: FONTS.body, fontSize: 12, color: C.textSub },
});
