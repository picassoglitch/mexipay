import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { createTransaction } from '../services/api';
import { calculateFeeDisplay } from '../utils/fees';

type Props = NativeStackScreenProps<RootStackParamList, 'Keypad'>;

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/** Max amount: $99,999.99 MXN */
const MAX_DISPLAY = '99999.99';

export default function KeypadScreen({ navigation }: Props) {
  const [display, setDisplay] = useState('0');
  const [loading, setLoading] = useState(false);

  function handleKey(key: string) {
    if (key === '⌫') {
      setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }

    setDisplay((prev) => {
      // Prevent multiple dots
      if (key === '.' && prev.includes('.')) return prev;
      // Limit to 2 decimal places
      if (prev.includes('.')) {
        const decimals = prev.split('.')[1];
        if (decimals.length >= 2) return prev;
      }
      const next = prev === '0' && key !== '.' ? key : prev + key;
      // Guard max value
      if (parseFloat(next) > parseFloat(MAX_DISPLAY)) return prev;
      return next;
    });
  }

  const amountMXN = parseFloat(display) || 0;
  const amountCentavos = Math.round(amountMXN * 100);
  const feeDisplay = amountCentavos >= 100 ? calculateFeeDisplay(amountCentavos) : null;

  async function handleCharge() {
    if (amountCentavos < 100) {
      Alert.alert('Monto inválido', 'El monto mínimo es $1.00 MXN');
      return;
    }

    setLoading(true);
    try {
      const transaction = await createTransaction({
        amountCentavos,
        description: 'Pago MexiPay',
        idempotencyKey: `${Date.now()}-${amountCentavos}`,
      });
      navigation.navigate('QRCode', { transaction });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al crear el cobro';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        {/* Amount display */}
        <View style={styles.displayArea}>
          <Text style={styles.currency}>MXN</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            ${display}
          </Text>
          {feeDisplay && (
            <Text style={styles.feeHint}>
              Comisión: ${feeDisplay.feeMXN} • Recibes: ${feeDisplay.netMXN}
            </Text>
          )}
        </View>

        {/* Number pad */}
        <View style={styles.pad}>
          {PAD_KEYS.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, key === '⌫' && styles.backspaceKey]}
              onPress={() => handleKey(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, key === '⌫' && styles.backspaceText]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Charge button */}
        <TouchableOpacity
          style={[styles.chargeButton, (loading || amountCentavos < 100) && styles.chargeDisabled]}
          onPress={handleCharge}
          disabled={loading || amountCentavos < 100}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.chargeText}>Cobrar ${display} MXN</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  displayArea: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16,
  },
  currency: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  amount: {
    fontSize: 64,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -2,
  },
  feeHint: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    flex: 1,
  },
  key: {
    width: '31%',
    aspectRatio: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  backspaceKey: { backgroundColor: '#FEF2F2' },
  keyText: { fontSize: 24, fontWeight: '600', color: '#1F2937' },
  backspaceText: { color: '#EF4444' },
  chargeButton: {
    backgroundColor: '#1A56DB',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  chargeDisabled: { opacity: 0.45 },
  chargeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
