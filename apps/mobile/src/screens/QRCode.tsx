import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCodeSVG from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { getTransaction } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

const POLL_INTERVAL_MS = 3_000;
/** Stop polling after 30 minutes */
const MAX_POLL_MS = 30 * 60 * 1_000;

export default function QRCodeScreen({ navigation, route }: Props) {
  const { transaction: initial } = route.params;
  const [status, setStatus] = useState(initial.status);
  const [timeLeft, setTimeLeft] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Format CLABE safely for display (last 4 digits only in summary)
  const clabe = initial.clabe;
  const clabeMasked = `•••• •••• •••• ${clabe.slice(-4)}`;
  const calabeForQR = clabe;

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      if (Date.now() - startTimeRef.current > MAX_POLL_MS) {
        stopPolling();
        return;
      }
      try {
        const tx = await getTransaction(initial.id);
        setStatus(tx.status);

        if (tx.status === 'paid') {
          stopPolling();
          navigation.replace('Success', { transaction: tx });
        } else if (tx.status === 'expired' || tx.status === 'failed') {
          stopPolling();
          Alert.alert('Cobro vencido', 'El tiempo para pagar ha expirado.', [
            { text: 'Nuevo cobro', onPress: () => navigation.replace('Keypad') },
          ]);
        }
      } catch {
        // Network error — keep polling silently
      }
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [initial.id, navigation]);

  // Countdown timer
  useEffect(() => {
    const tick = setInterval(() => {
      const diff = new Date(initial.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Vencido');
        clearInterval(tick);
      } else {
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    }, 1_000);
    return () => clearInterval(tick);
  }, [initial.expiresAt]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function copyCLABE() {
    Clipboard.setString(clabe);
    Alert.alert('Copiado', 'CLABE copiada al portapapeles');
  }

  const amountMXN = (initial.amountCentavos / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status badge */}
        <View style={styles.statusRow}>
          <ActivityIndicator color="#1A56DB" size="small" />
          <Text style={styles.statusText}>Esperando pago…</Text>
          {timeLeft ? <Text style={styles.timer}>{timeLeft}</Text> : null}
        </View>

        {/* Amount */}
        <Text style={styles.amount}>${amountMXN} MXN</Text>

        {/* QR Code — encode CLABE directly so any SPEI app can scan */}
        <View style={styles.qrContainer}>
          <QRCodeSVG
            value={calabeForQR}
            size={220}
            color="#111827"
            backgroundColor="#FFFFFF"
          />
        </View>

        <Text style={styles.qrHint}>
          Escanea con tu app bancaria para pagar por SPEI
        </Text>

        {/* CLABE */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>CLABE SPEI</Text>
          <TouchableOpacity onPress={copyCLABE} activeOpacity={0.7}>
            <Text style={styles.clabeValue}>{clabeMasked}</Text>
            <Text style={styles.copyHint}>Toca para copiar</Text>
          </TouchableOpacity>
        </View>

        {/* Reference */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Referencia</Text>
          <Text style={styles.refValue}>{initial.reference}</Text>
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            stopPolling();
            navigation.replace('Keypad');
          }}
        >
          <Text style={styles.cancelText}>Cancelar cobro</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 24, alignItems: 'center' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusText: { fontSize: 14, color: '#6B7280' },
  timer: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginLeft: 8 },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
    letterSpacing: -1,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 16,
  },
  qrHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  clabeValue: { fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: 2 },
  copyHint: { fontSize: 12, color: '#1A56DB', marginTop: 4 },
  refValue: { fontSize: 18, fontWeight: '600', color: '#374151' },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  cancelText: { fontSize: 15, color: '#6B7280', textDecorationLine: 'underline' },
});
